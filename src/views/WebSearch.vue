<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><Search /></el-icon>
          联网搜索
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">输入问题或关键词，直接给出搜索结果</p>
      </div>
      <div class="flex gap-2">
        <el-tag size="small" effect="plain" :type="providerTagType">
          {{ providerLabel }}
        </el-tag>
        <el-button :icon="Setting" @click="$router.push('/settings')">配置</el-button>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="card search-box">
      <div class="search-row">
        <el-input
          v-model="query"
          placeholder="输入问题，例如：唐代长安城坊市制度是怎样的？"
          size="large"
          clearable
          @keyup.enter="doSearch"
        />
        <el-button type="primary" size="large" :icon="Search" :loading="loading" @click="doSearch">搜索</el-button>
      </div>
      <!-- 关键词提示：长问句自动提取重点 -->
      <div v-if="extractedKeywords && !loading" class="kw-row">
        <span class="text-faint text-xs">已提取重点：</span>
        <el-tag v-for="k in extractedKeywords" :key="k" size="small" effect="plain">{{ k }}</el-tag>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="loading" class="card result-loading">
      <el-icon class="is-loading" :size="24"><Loading /></el-icon>
      <span class="text-muted" style="margin-left: 8px">正在搜索...</span>
    </div>

    <div v-else-if="results.length > 0" class="results">
      <div class="results-meta text-faint text-xs">
        共 {{ results.length }} 条结果
      </div>
      <div
        v-for="(r, i) in results"
        :key="i"
        class="card result-item"
      >
        <div class="result-head">
          <span class="result-index">{{ i + 1 }}</span>
          <a :href="r.url" target="_blank" class="result-title">{{ r.title || r.url }}</a>
        </div>
        <div class="result-source text-faint text-xs">
          <el-icon><Link /></el-icon>
          <span>{{ r.source }}</span>
        </div>
        <div class="result-snippet text-sm">{{ r.snippet }}</div>
      </div>
    </div>

    <div v-else-if="searchedOnce" class="card empty">
      <el-icon class="empty-icon"><Search /></el-icon>
      <h3>没有匹配结果</h3>
      <p class="text-muted">换个关键词，或在设置中切换 Tavily / Serper</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search, Setting, Loading, Link
} from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'

const settingsStore = useSettingsStore()
const projectStore = useProjectStore()

const project = computed(() => projectStore.current)

const query = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)
const searchedOnce = ref(false)
const usedKeywords = ref('') // 实际用于搜索的关键词

interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
}

const providerLabel = computed(() => {
  const p = settingsStore.settings?.searchProvider || 'duckduckgo'
  if (p === 'tavily') return 'Tavily'
  if (p === 'serper') return 'Serper'
  return 'DuckDuckGo（免 Key）'
})

const providerTagType = computed(() => {
  const p = settingsStore.settings?.searchProvider || 'duckduckgo'
  if (p === 'duckduckgo') return 'success'
  if (p === 'tavily') return 'primary'
  return 'warning'
})

// 从用户问句中提取重点关键词
function extractKeywords(text: string): string[] {
  if (!text) return []
  const cleaned = text.replace(/[？?！!。.,，、的了吗呢吧啊呀哦么把被让给跟和与及是了在也有又还要就都还只还再]/g, ' ')
  // 按空格切分，过滤停用词与单字
  const stop = new Set(['怎样', '怎么', '如何', '什么', '为什么', '哪些', '哪个', '请', '帮我', '我', '你', '他', '她', '它', '这', '那', '一', '一个', '一些'])
  const words = cleaned.split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2 && !stop.has(w))
  // 去重，最多 5 个
  return [...new Set(words)].slice(0, 5)
}

const extractedKeywords = computed(() => {
  if (!usedKeywords.value) return []
  return usedKeywords.value.split(/\s+/).filter(Boolean)
})

async function ensureSettings() {
  if (!settingsStore.settings) await settingsStore.load()
}

async function doSearch() {
  const q = query.value.trim()
  if (!q) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  await ensureSettings()
  loading.value = true
  searchedOnce.value = true
  try {
    const s = settingsStore.settings!
    // 提取关键词用于搜索（长问句转关键词，短问句直接用）
    const kws = extractKeywords(q)
    const searchQuery = kws.length >= 2 ? kws.join(' ') : q
    usedKeywords.value = kws.length >= 2 ? kws.join(' ') : ''
    const res = await window.api.search.web({
      query: searchQuery,
      maxResults: 10,
      provider: s.searchProvider,
      apiKey: s.searchApiKey
    })
    results.value = Array.isArray(res) ? res : []
    if (results.value.length === 0) ElMessage.info('无搜索结果')
  } catch (e: any) {
    ElMessage.error('搜索失败：' + (e?.message || ''))
    results.value = []
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.search-box {
  padding: 16px;
  margin-bottom: 16px;
}
.search-row {
  display: flex;
  gap: 12px;
}
.kw-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.result-loading {
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.results {
  margin-top: 4px;
}
.results-meta {
  margin-bottom: 8px;
  padding: 0 4px;
}
.result-item {
  padding: 14px 16px;
  margin-bottom: 10px;
  transition: border-color 0.15s;
}
.result-item:hover {
  border-color: var(--primary);
}
.result-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.result-index {
  display: inline-flex;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary);
  font-size: 12px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.result-title {
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result-title:hover { text-decoration: underline; }
.result-source {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 4px 0 8px 30px;
}
.result-snippet {
  margin: 0 0 0 30px;
  color: var(--text-2);
  line-height: 1.6;
}
</style>
