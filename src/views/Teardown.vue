<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><Document /></el-icon>
          拆书分析
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">AI 拆解章节结构，分析剧情骨架、人物动向、节奏与伏笔</p>
      </div>
      <div class="flex gap-2">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-button :icon="Download" :disabled="!lastResult" @click="exportMarkdown">导出</el-button>
        <el-button type="primary" :icon="MagicStick" :loading="analyzing" :disabled="!chapterId" @click="runTeardown">开始拆书</el-button>
      </div>
    </div>

    <div class="card config-card">
      <el-form label-width="90px" inline>
        <el-form-item label="选择章节">
          <el-select v-model="chapterId" placeholder="选择章节" style="width: 240px" filterable>
            <el-option
              v-for="c in chapters"
              :key="c.id"
              :label="`第${c.order}章 · ${c.title}`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="AI 模型">
          <el-select v-model="model" placeholder="选择模型" style="width: 240px">
            <el-option
              v-for="m in availableModels"
              :key="m.model"
              :label="`${m.provider} / ${m.model}`"
              :value="m.model"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分析维度">
          <el-checkbox-group v-model="dimensions">
            <el-checkbox value="structure">结构骨架</el-checkbox>
            <el-checkbox value="characters">人物动向</el-checkbox>
            <el-checkbox value="rhythm">节奏分析</el-checkbox>
            <el-checkbox value="foreshadowing">伏笔追踪</el-checkbox>
            <el-checkbox value="conflict">冲突点</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </div>

    <div v-if="analyzing" class="card" style="padding: 24px">
      <div class="loading-row">
        <el-icon class="rotating"><Loading /></el-icon>
        <span>正在拆解章节结构...</span>
      </div>
      <el-progress :percentage="50" :show-text="false" :stroke-width="4" status="success" style="margin-top: 12px" />
    </div>

    <div v-else-if="lastResult" class="card result-card">
      <div class="result-header">
        <div class="result-title">
          <el-icon><Document /></el-icon>
          <span>{{ lastResult.chapterTitle }} · 拆书结果</span>
        </div>
        <span class="text-faint text-xs">{{ formatTime(lastResult.createdAt) }}</span>
      </div>
      <div class="result-body markdown-body" v-html="renderMarkdown(lastResult.content)"></div>
    </div>

    <div v-else class="card empty-state">
      <el-icon class="empty-icon"><Document /></el-icon>
      <p>还没有拆书结果</p>
      <p class="text-faint text-xs">选择章节后点击「开始拆书」</p>
    </div>

    <!-- 历史记录 -->
    <div v-if="history.length > 0" style="margin-top: 16px">
      <div class="section-title">历史拆书记录</div>
      <div class="card history-card">
        <div v-for="(r, i) in history" :key="i" class="history-row" @click="loadHistory(r)">
          <div class="history-info">
            <span class="history-title">{{ r.chapterTitle }}</span>
            <span class="text-faint text-xs">{{ formatTime(r.createdAt) }}</span>
          </div>
          <el-button text size="small" :icon="View">查看</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, ArrowLeft, MagicStick, Download, Loading, View } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as ai from '@/services/ai'
import { marked } from 'marked'
import type { Chapter } from '@/types'

const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)
const chapters = computed(() => projectStore.chapters)
const availableModels = computed(() => settings.availableModels())

const chapterId = ref('')
const model = ref('')
const dimensions = ref<string[]>(['structure', 'characters', 'rhythm', 'foreshadowing', 'conflict'])
const analyzing = ref(false)

interface TeardownRecord {
  id: string
  chapterId: string
  chapterTitle: string
  content: string
  createdAt: number
}
const lastResult = ref<TeardownRecord | null>(null)
const history = ref<TeardownRecord[]>([])

// localStorage 持久化拆书记录（轻量，不进 db.json）
const STORAGE_KEY = computed(() => `trmwrite:teardown:${project.value?.id || ''}`)

function loadHistoryFromStorage() {
  if (!project.value) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY.value)
    if (raw) {
      const arr = JSON.parse(raw) as TeardownRecord[]
      history.value = arr.sort((a, b) => b.createdAt - a.createdAt)
      if (history.value.length > 0) lastResult.value = history.value[0]
    }
  } catch {}
}

function saveHistoryToStorage() {
  if (!project.value) return
  try {
    const arr: TeardownRecord[] = []
    const seen = new Set<string>()
    if (lastResult.value && !seen.has(lastResult.value.id)) {
      arr.push(lastResult.value)
      seen.add(lastResult.value.id)
    }
    for (const r of history.value) {
      if (r && !seen.has(r.id)) {
        arr.push(r)
        seen.add(r.id)
      }
    }
    const top = arr.slice(0, 30)
    localStorage.setItem(STORAGE_KEY.value, JSON.stringify(top))
    history.value = top.sort((a, b) => b.createdAt - a.createdAt)
  } catch {}
}

watch(() => project.value?.id, () => {
  lastResult.value = null
  history.value = []
  loadHistoryFromStorage()
}, { immediate: true })

onMounted(() => {
  if (availableModels.value.length > 0) {
    model.value = settings.settings?.defaultModel || availableModels.value[0].model
  }
  if (chapters.value.length > 0) {
    chapterId.value = chapters.value[0].id
  }
})

function plainText(content: string): string {
  return (content || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function buildPrompt(chapter: Chapter): string {
  const parts: string[] = []
  parts.push('你是一位资深小说编辑，请对以下章节内容进行专业拆书分析。')
  parts.push('')
  parts.push(`## 章节标题：${chapter.title}`)
  parts.push('')
  parts.push('## 分析维度')
  const dimMap: Record<string, string> = {
    structure: '结构骨架：拆解章节的开篇、铺垫、冲突、高潮、收尾，给出每部分占比与作用',
    characters: '人物动向：出场角色清单、各自的行动/心理/对话、人物关系变化',
    rhythm: '节奏分析：段落节奏快慢、信息密度、读者情绪曲线',
    foreshadowing: '伏笔追踪：埋下的伏笔、回收的伏笔、待回收的悬念',
    conflict: '冲突点：明冲突、暗冲突、推动剧情的张力来源'
  }
  for (const d of dimensions.value) {
    if (dimMap[d]) parts.push(`- ${dimMap[d]}`)
  }
  parts.push('')
  parts.push('## 输出要求')
  parts.push('- 使用 Markdown 格式，每个维度用二级标题（##）')
  parts.push('- 用要点列表，简洁有重点')
  parts.push('- 给出具体改进建议（如有）')
  parts.push('- 直接输出分析结果，不要写"以下是分析"等说明性文字')
  parts.push('')
  parts.push('## 章节内容')
  parts.push(plainText(chapter.content) || '（章节内容为空）')
  return parts.join('\n')
}

async function runTeardown() {
  if (!chapterId.value) {
    ElMessage.warning('请选择章节')
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
  const chapter = chapters.value.find(c => c.id === chapterId.value)
  if (!chapter) {
    ElMessage.warning('章节未找到')
    return
  }
  if (dimensions.value.length === 0) {
    ElMessage.warning('请至少选择一个分析维度')
    return
  }
  analyzing.value = true
  try {
    const prompt = buildPrompt(chapter)
    let acc = ''
    const fullText = await ai.streamChat(
      ai.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: model.value,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        maxTokens: 4000
      }),
      (chunk) => { acc += chunk }
    )
    const content = fullText || acc
    const record: TeardownRecord = {
      id: `${chapter.id}-${Date.now()}`,
      chapterId: chapter.id,
      chapterTitle: `第${chapter.order}章 · ${chapter.title}`,
      content,
      createdAt: Date.now()
    }
    lastResult.value = record
    saveHistoryToStorage()
    ElMessage.success('拆书完成')
  } catch (e: any) {
    ElMessage.error('拆书失败：' + (e?.message || e))
  } finally {
    analyzing.value = false
  }
}

function loadHistory(r: TeardownRecord) {
  lastResult.value = r
}

function renderMarkdown(md: string): string {
  try {
    return marked.parse(md || '', { async: false }) as string
  } catch {
    return (md || '').replace(/\n/g, '<br>')
  }
}

function exportMarkdown() {
  if (!lastResult.value) return
  const blob = new Blob([lastResult.value.content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${lastResult.value.chapterTitle}-拆书分析.md`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出')
}

function formatTime(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.config-card {
  padding: 16px;
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
.result-card {
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
  color: var(--text);
}
.result-body {
  line-height: 1.7;
  font-size: 14px;
  color: var(--text);
}
.markdown-body :deep(h2) {
  font-size: 15px;
  font-weight: 600;
  margin: 18px 0 10px;
  padding-left: 10px;
  border-left: 3px solid var(--primary);
}
.markdown-body :deep(ul) {
  padding-left: 22px;
  margin: 8px 0;
}
.markdown-body :deep(li) {
  margin-bottom: 6px;
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
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 3px solid var(--primary);
}
.history-card {
  padding: 4px;
}
.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}
.history-row:last-child {
  border-bottom: none;
}
.history-row:hover {
  background: var(--panel-2);
}
.history-info {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.history-title {
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
