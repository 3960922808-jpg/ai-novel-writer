<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><Search /></el-icon>
          联网搜索
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">为创作补充真实资料：历史 / 地理 / 行业 / 科技 / 名字 / 风俗</p>
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
          placeholder="输入关键词，例如：唐代长安城坊市制度"
          size="large"
          clearable
          @keyup.enter="doSearch"
        />
        <el-button type="primary" size="large" :icon="Search" :loading="loading" @click="doSearch">搜索</el-button>
      </div>
      <div class="quick-row">
        <span class="text-faint text-xs">快捷：</span>
        <el-tag
          v-for="q in quickQueries"
          :key="q"
          size="small"
          effect="plain"
          class="quick-tag"
          @click="useQuick(q)"
        >{{ q }}</el-tag>
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
        <el-button text size="small" :icon="DocumentCopy" @click="copyAll">复制全部</el-button>
        <el-button text size="small" :icon="MagicStick" @click="sendToAI">送入 AI 整理</el-button>
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
        <div class="result-actions">
          <el-button text size="small" :icon="CopyDocument" @click="copyOne(r)">复制</el-button>
          <el-button text size="small" :icon="MagicStick" @click="sendOneToAI(r)">送入 AI</el-button>
          <el-button text size="small" :icon="Plus" @click="addToNotes(r)">加入设定笔记</el-button>
        </div>
      </div>
    </div>

    <div v-else-if="searchedOnce" class="card empty">
      <el-icon class="empty-icon"><Search /></el-icon>
      <h3>没有匹配结果</h3>
      <p class="text-muted">换个关键词，或在设置中切换 Tavily / Serper</p>
    </div>

    <!-- 送入 AI 对话框 -->
    <el-dialog v-model="aiDialogVisible" title="联网资料整理" width="720px" top="6vh">
      <div class="ai-dialog-body">
        <div class="ai-input-block">
          <div class="text-faint text-xs" style="margin-bottom: 4px">你想让 AI 帮你整理什么？</div>
          <el-input v-model="aiTask" type="textarea" :rows="2" placeholder="例如：把这些资料整理成唐代长安市坊制度的世界观设定，可写入小说" />
        </div>
        <div class="ai-input-block">
          <div class="text-faint text-xs" style="margin-bottom: 4px">资料内容（可编辑）</div>
          <el-input v-model="aiContext" type="textarea" :rows="10" />
        </div>
        <div v-if="aiResult" class="ai-result">
          <div class="text-faint text-xs" style="margin-bottom: 4px">AI 输出</div>
          <div class="ai-result-text">{{ aiResult }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="aiDialogVisible = false">关闭</el-button>
        <el-button :icon="DocumentCopy" @click="copyResult">复制结果</el-button>
        <el-button type="primary" :loading="aiLoading" :icon="MagicStick" @click="runAI">AI 整理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search, Setting, Loading, Link, DocumentCopy,
  CopyDocument, MagicStick, Plus
} from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import { chat, buildRequest } from '@/services/ai'
import { Lore } from '@/services/db'

const settingsStore = useSettingsStore()
const projectStore = useProjectStore()

const project = computed(() => projectStore.current)

const query = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)
const searchedOnce = ref(false)

const quickQueries = [
  '唐代长安城坊市制度',
  '宋代市井生活',
  '民国上海滩帮派',
  '修仙境界体系',
  '赛博朋克常见设定',
  '冷兵器战斗术语'
]

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

async function ensureSettings() {
  if (!settingsStore.settings) await settingsStore.load()
}

async function doSearch() {
  const q = query.value.trim()
  if (!q) {
    ElMessage.warning('请输入关键词')
    return
  }
  await ensureSettings()
  loading.value = true
  searchedOnce.value = true
  try {
    const s = settingsStore.settings!
    const res = await window.api.search.web({
      query: q,
      maxResults: 8,
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

function useQuick(q: string) {
  query.value = q
  doSearch()
}

function copyOne(r: SearchResult) {
  const text = `${r.title}\n${r.url}\n${r.snippet}`
  navigator.clipboard.writeText(text).then(() => ElMessage.success('已复制'))
}

function copyAll() {
  const text = results.value
    .map((r, i) => `[${i + 1}] ${r.title}\n来源：${r.source}\n链接：${r.url}\n摘要：${r.snippet}`)
    .join('\n\n---\n\n')
  navigator.clipboard.writeText(text).then(() => ElMessage.success('已复制全部结果'))
}

// ===== 送入 AI 整理 =====
const aiDialogVisible = ref(false)
const aiTask = ref('')
const aiContext = ref('')
const aiResult = ref('')
const aiLoading = ref(false)

function sendToAI() {
  aiTask.value = ''
  aiContext.value = results.value
    .map((r, i) => `[${i + 1}] ${r.title}\n来源：${r.source}\n链接：${r.url}\n摘要：${r.snippet}`)
    .join('\n\n---\n\n')
  aiResult.value = ''
  aiDialogVisible.value = true
}

function sendOneToAI(r: SearchResult) {
  aiTask.value = ''
  aiContext.value = `[${r.title}]\n来源：${r.source}\n链接：${r.url}\n摘要：${r.snippet}`
  aiResult.value = ''
  aiDialogVisible.value = true
}

async function runAI() {
  if (!aiContext.value.trim()) {
    ElMessage.warning('没有可整理的资料')
    return
  }
  const project = projectStore.current
  if (!project) {
    ElMessage.warning('请先打开一个项目')
    return
  }
  const cfg = settingsStore.findProviderForModel(project.settings.model || settingsStore.settings?.defaultModel || '')
  if (!cfg?.apiKey) {
    ElMessage.error('AI Key 未配置，请到设置中填写')
    return
  }
  aiLoading.value = true
  try {
    const task = aiTask.value.trim() || '请把以下联网搜索资料整理成可直接写入小说设定的内容，按事实+细节分两段输出'
    const req = buildRequest({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: project.settings.model || settingsStore.settings!.defaultModel,
      messages: [
        {
          role: 'system',
          content: '你是考据编辑。基于用户提供的联网搜索结果，提炼与小说创作相关的关键事实（年代、地点、行业规则、专业术语等），并给出可直接用于正文的具体描写建议。输出分两段：【事实】【可写入小说的细节】。不要泛泛而谈，不要套话。'
        },
        {
          role: 'user',
          content: `${task}\n\n资料：\n${aiContext.value}`
        }
      ],
      temperature: 0.4,
      maxTokens: 3072
    })
    aiResult.value = await chat(req)
  } catch (e: any) {
    ElMessage.error('AI 整理失败：' + (e?.message || ''))
  } finally {
    aiLoading.value = false
  }
}

function copyResult() {
  if (!aiResult.value) {
    ElMessage.warning('还没有结果')
    return
  }
  navigator.clipboard.writeText(aiResult.value).then(() => ElMessage.success('已复制结果'))
}

async function addToNotes(r: SearchResult) {
  const project = projectStore.current
  if (!project) {
    ElMessage.warning('请先打开一个项目')
    return
  }
  try {
    await Lore.save({
      projectId: project.id,
      category: '联网资料',
      title: r.title || r.source,
      content: `来源：${r.url}\n\n${r.snippet}`,
      tags: ['联网搜索']
    })
    ElMessage.success('已加入世界观设定的"联网资料"分类')
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e?.message || ''))
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
.quick-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.quick-tag {
  cursor: pointer;
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
  display: flex;
  align-items: center;
  gap: 8px;
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
  margin: 0 0 8px 30px;
  color: var(--text-2);
  line-height: 1.6;
}
.result-actions {
  margin-left: 30px;
  display: flex;
  gap: 4px;
}
.ai-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ai-result {
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}
.ai-result-text {
  white-space: pre-wrap;
  line-height: 1.8;
  font-size: 13px;
  background: var(--panel-2);
  padding: 12px;
  border-radius: var(--radius);
  max-height: 280px;
  overflow: auto;
}
</style>
