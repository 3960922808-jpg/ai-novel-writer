import { ipcMain } from 'electron'

/**
 * 联网搜索 IPC
 * - 默认使用 DuckDuckGo HTML 接口（无需 API Key，仅做轻量解析）
 * - 可选支持 Tavily / Serper API（在 Settings 中配置 searchApiKey）
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
}

export interface SearchRequest {
  query: string
  maxResults?: number
  provider?: 'duckduckgo' | 'tavily' | 'serper'
  apiKey?: string
}

export function registerSearchIPC() {
  ipcMain.handle('search:web', async (_e, req: SearchRequest) => {
    if (!req?.query?.trim()) {
      throw new Error('请输入搜索关键词')
    }
    const max = Math.min(req.maxResults || 8, 20)
    const provider = req.provider || 'duckduckgo'
    try {
      if (provider === 'tavily' && req.apiKey) {
        return await searchTavily(req.query, max, req.apiKey)
      }
      if (provider === 'serper' && req.apiKey) {
        return await searchSerper(req.query, max, req.apiKey)
      }
      // 默认走 DuckDuckGo
      return await searchDuckDuckGo(req.query, max)
    } catch (e: any) {
      throw new Error('搜索失败：' + (e?.message || '未知错误'))
    }
  })
}

/** DuckDuckGo Lite 接口（无需 API Key，HTML 结构更简单稳定） */
async function searchDuckDuckGo(query: string, max: number): Promise<SearchResult[]> {
  // 先尝试 lite 接口（更稳定）
  try {
    const url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query)
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    if (!resp.ok) throw new Error(`DuckDuckGo Lite 返回 ${resp.status}`)
    const html = await resp.text()
    const results = parseDuckDuckGoLiteHtml(html, max)
    if (results.length > 0) return results
    // lite 没结果则继续尝试 html 接口
  } catch (e) {
    console.warn('[search] DuckDuckGo Lite 失败，回退到 html 接口:', e)
  }
  // 回退到 html 接口
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query)
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  })
  if (!resp.ok) {
    throw new Error(`DuckDuckGo 返回 ${resp.status}`)
  }
  const html = await resp.text()
  return parseDuckDuckGoHtml(html, max)
}

/** DuckDuckGo Lite 版本解析（表格结构） */
function parseDuckDuckGoLiteHtml(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = []
  // Lite 版结果在 <a class="result-link" href="...">title</a>
  // 摘要在 <td class="result-snippet">snippet</td>
  const linkRe = /<a[^>]*class="[^"]*result-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  const snipRe = /<td[^>]*class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/g

  const links: { url: string; title: string }[] = []
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const rawUrl = decodeDuckDuckGoUrl(m[1])
    const title = stripTags(m[2]).trim()
    if (rawUrl && title) links.push({ url: rawUrl, title })
  }

  const snippets: string[] = []
  while ((m = snipRe.exec(html)) !== null) {
    snippets.push(stripTags(m[1]).trim())
  }

  for (let i = 0; i < links.length && results.length < max; i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
      source: domainOf(links[i].url) || 'duckduckgo'
    })
  }
  return results
}

function parseDuckDuckGoHtml(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = []
  // DuckDuckGo html 版本的结果块大致为：<a class="result__a" href="...">title</a>
  // 与 <a class="result__snippet" href="...">snippet</a>
  const linkRe =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  const snipRe =
    /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g

  const links: { url: string; title: string }[] = []
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const rawUrl = decodeDuckDuckGoUrl(m[1])
    const title = stripTags(m[2]).trim()
    if (rawUrl && title) links.push({ url: rawUrl, title })
  }

  const snippets: string[] = []
  while ((m = snipRe.exec(html)) !== null) {
    snippets.push(stripTags(m[1]).trim())
  }

  for (let i = 0; i < links.length && results.length < max; i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
      source: domainOf(links[i].url) || 'duckduckgo'
    })
  }
  return results
}

function decodeDuckDuckGoUrl(u: string): string {
  // DuckDuckGo 的跳转链接形如 //duckduckgo.com/l/?uddg=<encoded>&rut=...
  try {
    if (u.startsWith('//')) u = 'https:' + u
    if (u.includes('uddg=')) {
      const idx = u.indexOf('uddg=')
      const tail = u.slice(idx + 5)
      const end = tail.indexOf('&')
      const enc = end >= 0 ? tail.slice(0, end) : tail
      return decodeURIComponent(enc)
    }
    return u
  } catch {
    return u
  }
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Tavily API（需要 API Key，访问 https://tavily.com 注册） */
async function searchTavily(
  query: string,
  max: number,
  apiKey: string
): Promise<SearchResult[]> {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: max,
      search_depth: 'basic'
    })
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`Tavily ${resp.status}: ${txt.slice(0, 200)}`)
  }
  const json = await resp.json()
  const arr: any[] = json?.results || []
  return arr.slice(0, max).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    source: domainOf(r.url) || 'tavily'
  }))
}

/** Serper API（需要 API Key，访问 https://serper.dev 注册） */
async function searchSerper(
  query: string,
  max: number,
  apiKey: string
): Promise<SearchResult[]> {
  const resp = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({ q: query, num: max })
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`Serper ${resp.status}: ${txt.slice(0, 200)}`)
  }
  const json = await resp.json()
  const organic: any[] = json?.organic || []
  return organic.slice(0, max).map((r) => ({
    title: r.title || '',
    url: r.link || r.url || '',
    snippet: r.snippet || '',
    source: domainOf(r.link || r.url || '') || 'serper'
  }))
}
