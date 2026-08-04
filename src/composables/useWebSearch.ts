import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'

/**
 * 联网搜索 composable
 * 类似 DeepSeek / 元宝 / kimi / ima / glm 的联网搜索开关：
 * - 对话框里点一下开启，AI 回答前先上网搜索，把结果注入上下文
 * - 开关状态按 scopeKey 持久化到 sessionStorage（刷新不丢失，按页面/项目隔离）
 * - 默认 DuckDuckGo（无需 API Key），可在设置中切换 Tavily / Serper
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
}

export function useWebSearch(scopeKey: string) {
  const settings = useSettingsStore()
  const storageKey = `trmwrite:websearch:${scopeKey}`

  // 开关状态：从 sessionStorage 读取，默认关闭
  const webSearchEnabled = ref(sessionStorage.getItem(storageKey) === '1')
  // 搜索中状态
  const searching = ref(false)
  // 最近一次搜索结果（供 UI 显示来源引用）
  const lastResults = ref<SearchResult[]>([])

  function toggleWebSearch() {
    webSearchEnabled.value = !webSearchEnabled.value
    sessionStorage.setItem(storageKey, webSearchEnabled.value ? '1' : '0')
    if (!webSearchEnabled.value) lastResults.value = []
  }

  /**
   * 执行联网搜索，返回拼好的上下文文本（可直接追加到 system prompt）
   * 失败时返回空字符串，不阻断对话流
   */
  async function searchAndBuildContext(query: string, maxResults = 6): Promise<string> {
    const q = (query || '').trim()
    if (!q) return ''
    searching.value = true
    lastResults.value = []
    try {
      const s = settings.settings
      const provider = s?.searchProvider || 'duckduckgo'
      const apiKey = s?.searchApiKey || ''
      const results = (await window.api.search.web({
        query: q,
        maxResults,
        provider,
        apiKey
      })) as SearchResult[]
      lastResults.value = results || []
      if (!results || results.length === 0) return ''
      return buildSearchContextText(results)
    } catch (e: any) {
      console.error('[websearch] 搜索失败:', e?.message || e)
      return ''
    } finally {
      searching.value = false
    }
  }

  return {
    webSearchEnabled,
    searching,
    lastResults,
    toggleWebSearch,
    searchAndBuildContext
  }
}

/** 把搜索结果拼成可注入 system prompt 的文本 */
export function buildSearchContextText(results: SearchResult[]): string {
  if (!results || results.length === 0) return ''
  const lines = results.map((r, i) => {
    const snip = (r.snippet || '').slice(0, 300)
    return `[${i + 1}] ${r.title}\n来源：${r.source} | ${r.url}\n摘要：${snip}`
  })
  return [
    '【联网搜索结果】以下是针对用户问题的实时网络搜索结果，请基于这些信息回答，并在涉及事实性内容时引用来源编号 [1] [2] 等。若搜索结果与问题无关或不足，可结合自身知识补充，但需明确区分。',
    '',
    lines.join('\n\n')
  ].join('\n')
}
