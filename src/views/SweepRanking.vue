<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><TrendCharts /></el-icon>
          扫榜拆解
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">
          抓取番茄小说等榜单，AI 批量拆解热门套路：人设公式、爽点节奏、章节钩子，横向对比生成可复用模板
        </p>
      </div>
      <div class="flex gap-2">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-button :icon="Files" @click="loadHistory">扫榜历史</el-button>
        <el-button
          type="primary"
          :icon="MagicStick"
          :loading="comparing"
          :disabled="selectedRecords.length < 2"
          @click="runCompare"
        >
          套路对比（{{ selectedRecords.length }}）
        </el-button>
      </div>
    </div>

    <!-- 配置区 -->
    <div class="card config-card">
      <div class="config-row">
        <div class="config-item">
          <span class="config-label">榜单来源</span>
          <el-select v-model="currentRankId" placeholder="选择榜单" style="width: 240px" @change="onRankChange">
            <el-option v-for="r in ranks" :key="r.id" :label="r.label" :value="r.id" />
          </el-select>
          <el-button :icon="Plus" text @click="showCustomRank = !showCustomRank">自定义 URL</el-button>
        </div>
        <div class="config-item">
          <span class="config-label">AI 模型</span>
          <el-select v-model="model" placeholder="选择模型" style="width: 260px">
            <el-option v-for="m in availableModels" :key="m.model" :label="`${m.provider} / ${m.model}`" :value="m.model" />
          </el-select>
        </div>
        <div class="config-item">
          <span class="config-label">拆解数量</span>
          <el-input-number v-model="topN" :min="3" :max="20" :step="1" style="width: 110px" />
          <span class="text-faint text-xs">前 N 本</span>
        </div>
        <div class="flex-1"></div>
        <el-button type="primary" :icon="Download" :loading="fetchingRank" @click="fetchRankList">
          {{ fetchingRank ? '抓取中...' : '抓取榜单' }}
        </el-button>
        <el-button
          type="success"
          :icon="MagicStick"
          :loading="analyzing"
          :disabled="books.length === 0 || !model"
          @click="batchAnalyze"
        >
          {{ analyzing ? `拆解中 ${analyzeProgress}/${books.length}` : '批量拆解' }}
        </el-button>
      </div>

      <!-- 自定义 URL -->
      <div v-if="showCustomRank" class="custom-rank-row">
        <el-input v-model="customUrl" placeholder="粘贴榜单页 URL，如 https://fanqienovel.com/rank/xxx" style="flex: 1" />
        <el-button :icon="Download" :loading="fetchingRank" @click="fetchCustomRank">抓取</el-button>
      </div>

      <!-- 提示 -->
      <div class="text-faint text-xs" style="margin-top: 8px">
        提示：番茄/起点章节正文有字体加密，本工具基于"简介+标签+章节标题"拆解套路，已足够识别节奏与钩子模式。
        如需更深入拆解，可在拆解结果里手动粘贴正文片段重新拆解。
      </div>
    </div>

    <!-- 作品列表 -->
    <div v-if="books.length > 0" class="card books-card">
      <div class="books-header">
        <span class="section-title-inline">榜单作品（{{ books.length }}）</span>
        <div class="flex gap-2">
          <el-button text size="small" @click="selectAllBooks">{{ allBooksSelected ? '取消全选' : '全选' }}</el-button>
          <el-button text size="small" :icon="Delete" @click="books = []; records = []">清空</el-button>
        </div>
      </div>
      <div class="books-grid">
        <div
          v-for="b in books"
          :key="b.bookId"
          class="book-card"
          :class="{ selected: selectedBookIds.has(b.bookId) }"
          @click="toggleBook(b.bookId)"
        >
          <el-checkbox :model-value="selectedBookIds.has(b.bookId)" class="book-check" @click.stop @change="toggleBook(b.bookId)" />
          <div class="book-cover" :style="{ backgroundImage: b.cover ? `url(${b.cover})` : '' }">
            <el-icon v-if="!b.cover" :size="24"><Reading /></el-icon>
          </div>
          <div class="book-info">
            <div class="book-title" :title="b.title">{{ b.title }}</div>
            <div class="book-author text-faint text-xs">{{ b.author || '佚名' }}</div>
            <div class="book-meta text-faint text-xs">
              <el-tag v-if="b.category" size="small" effect="plain">{{ b.category }}</el-tag>
              <span v-if="b.wordCount">{{ b.wordCount }}</span>
            </div>
            <div class="book-summary text-muted text-xs">{{ truncate(b.summary, 80) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 拆解进度 -->
    <div v-if="analyzing" class="card progress-card">
      <div class="loading-row">
        <el-icon class="rotating"><Loading /></el-icon>
        <span>正在批量拆解 {{ analyzeProgress }} / {{ books.length }}...</span>
      </div>
      <el-progress :percentage="Math.round((analyzeProgress / Math.max(1, books.length)) * 100)" :show-text="false" :stroke-width="4" status="success" style="margin-top: 12px" />
      <div v-if="currentAnalyzeTitle" class="text-faint text-xs" style="margin-top: 8px">当前：{{ currentAnalyzeTitle }}</div>
    </div>

    <!-- 拆解结果列表 -->
    <div v-if="records.length > 0" style="margin-top: 16px">
      <div class="section-title">拆解结果（{{ records.length }}）</div>
      <div
        v-for="r in records"
        :key="r.id"
        class="card record-card"
        :class="{ selected: selectedRecords.includes(r) }"
        @click="toggleRecordSelect(r)"
      >
        <div class="record-head" @click.stop>
          <el-checkbox :model-value="selectedRecords.includes(r)" @change="toggleRecordSelect(r)" />
          <div class="record-title">
            <span class="record-title-text">{{ r.title }}</span>
            <span class="text-faint text-xs">{{ r.author }}</span>
            <el-tag size="small" effect="plain">{{ r.source }}</el-tag>
          </div>
          <div class="flex gap-2">
            <el-button text size="small" :icon="Edit" @click="openExcerpt(r)">补充正文</el-button>
            <el-button text size="small" :icon="Refresh" :loading="reAnalyzing === r.id" @click="reAnalyze(r)">重新拆解</el-button>
            <el-button text size="small" :icon="Delete" @click="removeRecord(r)">删除</el-button>
          </div>
        </div>
        <div class="record-summary text-muted text-sm">{{ r.analysis.oneLiner || r.summary }}</div>
        <div class="record-tags">
          <el-tag v-for="(t, i) in (r.analysis.genreTags || '').split(/[\/·,，、\s]+/).filter(Boolean).slice(0, 8)" :key="i" size="small" type="info">{{ t }}</el-tag>
        </div>
        <div class="record-grid">
          <div class="record-section">
            <div class="rs-title">主角人设公式</div>
            <div class="rs-content">{{ r.analysis.characterFormula || '—' }}</div>
          </div>
          <div class="record-section">
            <div class="rs-title">爽点节奏</div>
            <div class="rs-content">{{ r.analysis.rhythm || '—' }}</div>
          </div>
          <div class="record-section">
            <div class="rs-title">章节钩子套路</div>
            <div class="rs-content">{{ r.analysis.hookPattern || '—' }}</div>
          </div>
          <div class="record-section">
            <div class="rs-title">主线起承转合</div>
            <div class="rs-content">{{ r.analysis.structure || '—' }}</div>
          </div>
        </div>
        <div class="record-section full">
          <div class="rs-title">可复用写作模板</div>
          <div class="rs-content">{{ r.analysis.template || '—' }}</div>
        </div>
      </div>
    </div>

    <!-- 对比结果 -->
    <div v-if="compareResult" class="card compare-card" style="margin-top: 16px">
      <div class="result-header">
        <div class="result-title">
          <el-icon><DataAnalysis /></el-icon>
          <span>套路横向对比（{{ compareResultRecords.length }} 本）</span>
        </div>
        <el-button text size="small" :icon="DocumentCopy" @click="copyCompare">复制报告</el-button>
      </div>
      <div class="compare-section">
        <div class="cs-title">共性套路</div>
        <ul class="cs-list">
          <li v-for="(p, i) in compareResult.commonPatterns" :key="i">{{ p }}</li>
        </ul>
      </div>
      <div class="compare-section">
        <div class="cs-title">差异化卖点</div>
        <div class="diff-grid">
          <div v-for="(d, i) in compareResult.differences" :key="i" class="diff-item">
            <span class="diff-title">{{ d.title }}</span>
            <span class="diff-text">{{ d.uniqueSellingPoint }}</span>
          </div>
        </div>
      </div>
      <div class="compare-section">
        <div class="cs-title">市场趋势判断</div>
        <div class="cs-content">{{ compareResult.marketTrend }}</div>
      </div>
      <div class="compare-section">
        <div class="cs-title">可复用建议</div>
        <ul class="cs-list">
          <li v-for="(p, i) in compareResult.recommendations" :key="i">{{ p }}</li>
        </ul>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="books.length === 0 && records.length === 0" class="card empty-state">
      <el-icon class="empty-icon"><TrendCharts /></el-icon>
      <h3>开始扫榜</h3>
      <p class="text-muted">选择榜单来源，点击「抓取榜单」获取热门作品列表</p>
      <p class="text-faint text-xs">支持番茄小说男生/女生/完结/新书/飙升榜</p>
    </div>

    <!-- 补充正文抽屉 -->
    <el-drawer v-model="excerptVisible" title="补充正文片段（增强拆解）" size="560px">
      <div v-if="excerptRecord">
        <div class="text-muted text-sm" style="margin-bottom: 12px">
          为《{{ excerptRecord.title }}》粘贴前几章正文，AI 拆解会更精准。番茄章节正文有字体加密，建议从 App 或网页复制可读文本。
        </div>
        <el-input
          v-model="excerptInput"
          type="textarea"
          :rows="16"
          placeholder="粘贴正文片段，建议 3000-8000 字（前 3-5 章）"
        />
        <div class="flex gap-2" style="margin-top: 12px; justify-content: flex-end">
          <el-button @click="excerptVisible = false">取消</el-button>
          <el-button type="primary" :icon="Check" @click="saveExcerpt">保存并重新拆解</el-button>
        </div>
      </div>
    </el-drawer>

    <!-- 历史记录抽屉 -->
    <el-drawer v-model="historyVisible" title="扫榜历史记录" size="640px">
      <div v-if="history.length === 0" class="empty">
        <el-icon class="empty-icon"><Files /></el-icon>
        <p>暂无历史记录</p>
        <p class="text-faint text-xs">拆解后的作品会自动保存到此处</p>
      </div>
      <div v-else>
        <div class="flex gap-2" style="margin-bottom: 12px; justify-content: flex-end">
          <el-button text size="small" type="danger" :icon="Delete" @click="clearHistory">清空历史</el-button>
        </div>
        <div
          v-for="r in history"
          :key="r.id"
          class="card history-item"
          @click="loadHistoryItem(r)"
        >
          <div class="flex justify-between items-center">
            <div class="flex-1" style="min-width: 0">
              <div class="history-title">{{ r.title }}</div>
              <div class="text-faint text-xs">{{ r.author }} · {{ r.source }} · {{ formatTime(r.createdAt) }}</div>
              <div class="text-muted text-xs" style="margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden">
                {{ r.analysis.oneLiner || r.summary }}
              </div>
            </div>
            <el-button text size="small" :icon="View">载入</el-button>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  TrendCharts, ArrowLeft, Files, MagicStick, Download, Plus,
  Loading, Reading, Delete, Edit, Refresh, Check, View,
  DocumentCopy, DataAnalysis
} from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as ai from '@/services/ai'
import {
  BUILTIN_RANKS,
  fetchRank,
  fetchBookDetail,
  buildSweepPrompt,
  parseSweepAnalysis,
  buildComparePrompt,
  parseCompareResult,
  type RankSource,
  type RankBook,
  type SweepRecord,
  type CompareResult
} from '@/services/sweep'

const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)
const availableModels = computed(() => settings.availableModels())

const ranks = ref<RankSource[]>([...BUILTIN_RANKS])
const currentRankId = ref<string>(BUILTIN_RANKS[0].id)
const currentRank = computed<RankSource | undefined>(() =>
  ranks.value.find(r => r.id === currentRankId.value)
)

const model = ref('')
const topN = ref(10)
const fetchingRank = ref(false)
const analyzing = ref(false)
const comparing = ref(false)
const reAnalyzing = ref<string | null>(null)

const books = ref<RankBook[]>([])
const selectedBookIds = ref<Set<string>>(new Set())
const records = ref<SweepRecord[]>([])
const selectedRecords = ref<SweepRecord[]>([])

const analyzeProgress = ref(0)
const currentAnalyzeTitle = ref('')

const showCustomRank = ref(false)
const customUrl = ref('')

const excerptVisible = ref(false)
const excerptRecord = ref<SweepRecord | null>(null)
const excerptInput = ref('')

const historyVisible = ref(false)
const history = ref<SweepRecord[]>([])

const compareResult = ref<CompareResult | null>(null)
const compareResultRecords = ref<SweepRecord[]>([])

const STORAGE_KEY = computed(() => `trmwrite:sweep:${project.value?.id || ''}`)

const allBooksSelected = computed(() =>
  books.value.length > 0 && books.value.every(b => selectedBookIds.value.has(b.bookId))
)

function onRankChange() {
  books.value = []
  selectedBookIds.value = new Set()
}

// ===== 抓取榜单 =====
async function fetchRankList() {
  if (!currentRank.value) {
    ElMessage.warning('请选择榜单')
    return
  }
  fetchingRank.value = true
  books.value = []
  selectedBookIds.value = new Set()
  try {
    const list = await fetchRank(currentRank.value)
    if (list.length === 0) {
      ElMessage.warning('未抓取到作品，站点可能改版或被风控，可尝试自定义 URL 或稍后重试')
      return
    }
    books.value = list
    // 默认全选前 topN 本
    const limit = Math.min(topN.value, list.length)
    for (let i = 0; i < limit; i++) selectedBookIds.value.add(list[i].bookId)
    ElMessage.success(`抓取到 ${list.length} 本作品`)
  } catch (e: any) {
    ElMessage.error('抓取榜单失败：' + (e?.message || ''))
  } finally {
    fetchingRank.value = false
  }
}

async function fetchCustomRank() {
  const url = customUrl.value.trim()
  if (!url) {
    ElMessage.warning('请粘贴榜单 URL')
    return
  }
  const site: RankSource['site'] = url.includes('fanqienovel') ? 'fanqie' : 'custom'
  const custom: RankSource = {
    id: 'custom-' + Date.now(),
    label: '自定义：' + url.slice(0, 30),
    site,
    url,
    referer: site === 'fanqie' ? 'https://fanqienovel.com/' : undefined
  }
  currentRankId.value = custom.id
  // 临时插入到候选列表
  if (!ranks.value.find(r => r.id === custom.id)) {
    ranks.value.push(custom)
  }
  fetchingRank.value = true
  books.value = []
  selectedBookIds.value = new Set()
  try {
    const list = await fetchRank(custom)
    if (list.length === 0) {
      ElMessage.warning('未抓取到作品，请确认 URL 是番茄榜单页或榜单 API 地址')
      return
    }
    books.value = list
    const limit = Math.min(topN.value, list.length)
    for (let i = 0; i < limit; i++) selectedBookIds.value.add(list[i].bookId)
    ElMessage.success(`抓取到 ${list.length} 本作品`)
  } catch (e: any) {
    ElMessage.error('抓取失败：' + (e?.message || ''))
  } finally {
    fetchingRank.value = false
  }
}

function toggleBook(id: string) {
  const s = new Set(selectedBookIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedBookIds.value = s
}

function selectAllBooks() {
  if (allBooksSelected.value) {
    selectedBookIds.value = new Set()
  } else {
    selectedBookIds.value = new Set(books.value.map(b => b.bookId))
  }
}

// ===== 批量拆解 =====
async function batchAnalyze() {
  if (!model.value) {
    ElMessage.warning('请选择 AI 模型')
    return
  }
  const provider = settings.findProviderForModel(model.value)
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置该模型的 API Key')
    return
  }
  const targets = books.value.filter(b => selectedBookIds.value.has(b.bookId))
  if (targets.length === 0) {
    ElMessage.warning('请先勾选要拆解的作品')
    return
  }
  analyzing.value = true
  analyzeProgress.value = 0
  records.value = []
  try {
    for (const b of targets) {
      analyzeProgress.value += 1
      currentAnalyzeTitle.value = b.title
      try {
        const rec = await analyzeBook(b, provider)
        if (rec) {
          records.value.push(rec)
          // 实时保存到历史
          saveHistory()
        }
      } catch (e: any) {
        console.error('[sweep] 拆解失败:', b.title, e)
        ElMessage.warning(`《${b.title}》拆解失败：${e?.message || ''}`)
      }
    }
    ElMessage.success(`拆解完成，共 ${records.value.length} 本`)
  } finally {
    analyzing.value = false
    currentAnalyzeTitle.value = ''
  }
}

async function analyzeBook(
  b: RankBook,
  provider: { baseUrl: string; apiKey: string }
): Promise<SweepRecord | null> {
  // 1. 抓取详情（含章节标题）
  let chapterTitles: string[] = []
  let tags: string[] = []
  let summary = b.summary
  let category = b.category
  try {
    const detail = await fetchBookDetail(b)
    if (detail) {
      chapterTitles = detail.chapters.map(c => c.title)
      tags = detail.tags
      if (detail.summary) summary = detail.summary
      if (detail.category) category = detail.category
    }
  } catch (e: any) {
    console.warn('[sweep] 抓取详情失败:', b.title, e?.message)
  }

  // 2. 调用 AI 拆解
  const { system, user } = buildSweepPrompt({
    title: b.title,
    author: b.author,
    summary,
    tags,
    category,
    chapterTitles
  })
  const req = ai.buildRequest({
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: model.value,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.4,
    maxTokens: 3072
  })
  const text = await ai.chat(req)
  const analysis = parseSweepAnalysis(text)

  return {
    id: `sweep-${b.bookId}-${Date.now()}`,
    bookId: b.bookId,
    title: b.title,
    author: b.author,
    summary,
    tags,
    category,
    chapterTitles,
    excerpt: '',
    analysis,
    source: b.site,
    createdAt: Date.now()
  }
}

async function reAnalyze(r: SweepRecord) {
  if (!model.value) {
    ElMessage.warning('请选择 AI 模型')
    return
  }
  const provider = settings.findProviderForModel(model.value)
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置该模型的 API Key')
    return
  }
  reAnalyzing.value = r.id
  try {
    const { system, user } = buildSweepPrompt({
      title: r.title,
      author: r.author,
      summary: r.summary,
      tags: r.tags,
      category: r.category,
      chapterTitles: r.chapterTitles,
      excerpt: r.excerpt
    })
    const req = ai.buildRequest({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: model.value,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.4,
      maxTokens: 3072
    })
    const text = await ai.chat(req)
    r.analysis = parseSweepAnalysis(text)
    saveHistory()
    ElMessage.success(`《${r.title}》已重新拆解`)
  } catch (e: any) {
    ElMessage.error('重新拆解失败：' + (e?.message || ''))
  } finally {
    reAnalyzing.value = null
  }
}

// ===== 补充正文 =====
function openExcerpt(r: SweepRecord) {
  excerptRecord.value = r
  excerptInput.value = r.excerpt || ''
  excerptVisible.value = true
}

async function saveExcerpt() {
  if (!excerptRecord.value) return
  excerptRecord.value.excerpt = excerptInput.value.trim()
  excerptVisible.value = false
  // 自动重新拆解
  await reAnalyze(excerptRecord.value)
}

// ===== 套路对比 =====
function toggleRecordSelect(r: SweepRecord) {
  const idx = selectedRecords.value.indexOf(r)
  if (idx >= 0) selectedRecords.value.splice(idx, 1)
  else selectedRecords.value.push(r)
}

async function runCompare() {
  if (selectedRecords.value.length < 2) {
    ElMessage.warning('至少选择 2 本作品进行对比')
    return
  }
  if (!model.value) {
    ElMessage.warning('请选择 AI 模型')
    return
  }
  const provider = settings.findProviderForModel(model.value)
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置该模型的 API Key')
    return
  }
  comparing.value = true
  compareResult.value = null
  try {
    const { system, user } = buildComparePrompt(selectedRecords.value)
    const req = ai.buildRequest({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: model.value,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.5,
      maxTokens: 3072
    })
    const text = await ai.chat(req)
    compareResult.value = parseCompareResult(text)
    compareResultRecords.value = [...selectedRecords.value]
    ElMessage.success('对比完成')
  } catch (e: any) {
    ElMessage.error('对比失败：' + (e?.message || ''))
  } finally {
    comparing.value = false
  }
}

function copyCompare() {
  if (!compareResult.value) return
  const c = compareResult.value
  const lines: string[] = []
  lines.push('# 扫榜套路横向对比')
  lines.push('')
  lines.push('## 共性套路')
  c.commonPatterns.forEach((p, i) => lines.push(`${i + 1}. ${p}`))
  lines.push('')
  lines.push('## 差异化卖点')
  c.differences.forEach(d => lines.push(`- 《${d.title}》：${d.uniqueSellingPoint}`))
  lines.push('')
  lines.push('## 市场趋势判断')
  lines.push(c.marketTrend)
  lines.push('')
  lines.push('## 可复用建议')
  c.recommendations.forEach((p, i) => lines.push(`${i + 1}. ${p}`))
  navigator.clipboard.writeText(lines.join('\n')).then(() => ElMessage.success('已复制对比报告'))
}

// ===== 历史记录持久化 =====
function saveHistory() {
  if (!project.value) return
  try {
    // 合并：新记录覆盖同 bookId 的旧记录
    const map = new Map<string, SweepRecord>()
    for (const r of history.value) map.set(r.id, r)
    for (const r of records.value) map.set(r.id, r)
    const arr = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50)
    history.value = arr
    localStorage.setItem(STORAGE_KEY.value, JSON.stringify(arr))
  } catch (e) {
    console.error('[sweep] 保存历史失败:', e)
  }
}

function loadHistory() {
  historyVisible.value = true
  if (!project.value) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY.value)
    if (raw) {
      history.value = (JSON.parse(raw) as SweepRecord[]).sort((a, b) => b.createdAt - a.createdAt)
    }
  } catch (e) {
    console.error('[sweep] 加载历史失败:', e)
  }
}

function loadHistoryItem(r: SweepRecord) {
  // 载入到当前 records（如果没有的话）
  if (!records.value.find(x => x.id === r.id)) {
    records.value.unshift(r)
  }
  historyVisible.value = false
  ElMessage.success(`已载入《${r.title}》`)
}

function removeRecord(r: SweepRecord) {
  records.value = records.value.filter(x => x.id !== r.id)
  history.value = history.value.filter(x => x.id !== r.id)
  selectedRecords.value = selectedRecords.value.filter(x => x.id !== r.id)
  try {
    localStorage.setItem(STORAGE_KEY.value, JSON.stringify(history.value))
  } catch {}
}

async function clearHistory() {
  try {
    await ElMessageBox.confirm('确定清空所有扫榜历史记录？', '清空确认', { type: 'warning' })
    history.value = []
    localStorage.removeItem(STORAGE_KEY.value)
    ElMessage.success('已清空')
  } catch {
    // cancel
  }
}

// ===== 工具 =====
function formatTime(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '...' : s
}

// ===== 生命周期 =====
watch(() => project.value?.id, () => {
  books.value = []
  records.value = []
  selectedBookIds.value = new Set()
  selectedRecords.value = []
  compareResult.value = null
  history.value = []
  if (project.value) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY.value)
      if (raw) history.value = (JSON.parse(raw) as SweepRecord[]).sort((a, b) => b.createdAt - a.createdAt)
    } catch {}
  }
}, { immediate: true })

onMounted(async () => {
  if (!settings.settings) {
    try { await settings.load() } catch {}
  }
  if (!project.value) return
  if (!model.value && availableModels.value.length > 0) {
    model.value = project.value.settings.model || settings.defaultModel() || availableModels.value[0].model
  }
})
</script>

<style scoped>
.config-card {
  padding: 16px 20px;
  margin-bottom: 16px;
}
.config-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.config-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.config-label {
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
}
.custom-rank-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.books-card {
  padding: 16px 20px;
  margin-bottom: 16px;
}
.books-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title-inline {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
}
.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.book-card {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}
.book-card:hover {
  border-color: var(--primary);
}
.book-card.selected {
  border-color: var(--primary);
  background: var(--primary-light);
}
.book-check {
  position: absolute;
  top: 8px;
  right: 8px;
}
.book-cover {
  width: 56px;
  height: 80px;
  flex-shrink: 0;
  background: var(--panel);
  background-size: cover;
  background-position: center;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
}
.book-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 24px;
}
.book-title {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.book-author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.book-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
.book-summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}
.progress-card {
  padding: 16px 20px;
  margin-bottom: 16px;
}
.loading-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--primary);
  font-weight: 500;
}
.rotating {
  animation: rotate 1s linear infinite;
}
@keyframes rotate {
  to { transform: rotate(360deg); }
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 3px solid var(--primary);
}
.record-card {
  padding: 16px 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.record-card.selected {
  border-color: var(--primary);
  background: var(--primary-light);
}
.record-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.record-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.record-title-text {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.record-summary {
  margin-bottom: 10px;
  line-height: 1.6;
}
.record-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}
.record-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.record-section {
  padding: 0;
}
.record-section.full {
  margin-top: 14px;
}
.rs-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 4px;
}
.rs-content {
  font-size: 13px;
  color: var(--text);
  line-height: 1.7;
  white-space: pre-wrap;
}
.compare-card {
  padding: 20px;
}
.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.compare-section {
  margin-bottom: 16px;
}
.cs-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 8px;
  padding-left: 10px;
  border-left: 3px solid var(--primary);
}
.cs-list {
  margin: 0;
  padding-left: 22px;
}
.cs-list li {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text);
}
.cs-content {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
}
.diff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.diff-item {
  padding: 10px 12px;
  background: var(--panel-2);
  border-radius: var(--radius);
  font-size: 13px;
}
.diff-title {
  font-weight: 600;
  margin-right: 6px;
}
.diff-text {
  color: var(--text-2);
}
.empty-state {
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--text-3);
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 40px 0;
}
.empty .empty-icon {
  font-size: 40px;
  margin-bottom: 10px;
}
.history-item {
  padding: 12px 14px;
  margin-bottom: 10px;
  cursor: pointer;
}
.history-item:hover {
  border-color: var(--primary);
}
.history-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}
</style>
