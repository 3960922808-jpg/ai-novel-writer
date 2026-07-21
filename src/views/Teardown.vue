<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><Reading /></el-icon>
          拆书分析
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">上传别人的小说文件，AI 拆解其写作手法与结构套路，生成可复用的拆书报告</p>
      </div>
      <div class="flex gap-2">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-button :icon="Download" :disabled="!lastResult" @click="exportMarkdown">导出报告</el-button>
        <el-button type="primary" :icon="MagicStick" :loading="analyzing" :disabled="files.length === 0" @click="runTeardown">开始拆书</el-button>
      </div>
    </div>

    <!-- 上传区 -->
    <div class="card upload-card">
      <div v-if="files.length === 0" class="upload-empty" @click="pickFiles">
        <el-icon :size="40"><Upload /></el-icon>
        <h3 style="margin: 12px 0 6px">点击上传要拆解的小说文件</h3>
        <p class="text-muted text-sm">支持 .txt / .md / .docx，可多选</p>
        <p class="text-faint text-xs">拆的是别人的作品，不是当前项目的章节</p>
      </div>
      <div v-else>
        <div class="file-list">
          <div v-for="(f, i) in files" :key="i" class="file-item">
            <el-icon class="file-icon"><Document /></el-icon>
            <div class="file-info">
              <div class="file-name">{{ f.fileName }}</div>
              <div class="file-meta text-faint text-xs">
                {{ f.ext.toUpperCase() }} · {{ (f.size / 1024).toFixed(1) }} KB · {{ countChars(f.content) }} 字
              </div>
            </div>
            <el-button text :icon="Delete" @click="files.splice(i, 1)" />
          </div>
        </div>
        <div class="upload-actions">
          <el-button :icon="Plus" @click="pickFiles">追加文件</el-button>
          <div class="flex-1"></div>
          <span class="text-faint text-xs">总字数：{{ totalChars.toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <!-- 拆书配置 -->
    <div class="card config-card" v-if="files.length > 0">
      <div class="section-title">拆书参数</div>
      <el-form label-width="120px">
        <el-form-item label="原作品名/作者">
          <el-input v-model="sourceTitle" placeholder="例如：番茄《诡秘之主》/ 起点《遮天》" style="max-width: 420px" />
        </el-form-item>
        <el-form-item label="AI 模型">
          <el-select v-model="model" placeholder="选择模型" style="width: 320px">
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
            <el-checkbox value="characters">人物塑造</el-checkbox>
            <el-checkbox value="rhythm">节奏分析</el-checkbox>
            <el-checkbox value="hook">章节钩子</el-checkbox>
            <el-checkbox value="foreshadowing">伏笔追踪</el-checkbox>
            <el-checkbox value="conflict">冲突点</el-checkbox>
            <el-checkbox value="style">语言风格</el-checkbox>
            <el-checkbox value="template">可复用模板</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="分析样本长度">
          <el-radio-group v-model="sampleSize">
            <el-radio-button :value="6000">快速（6000 字）</el-radio-button>
            <el-radio-button :value="12000">标准（1.2 万字）</el-radio-button>
            <el-radio-button :value="20000">深度（2 万字）</el-radio-button>
          </el-radio-group>
          <div class="text-faint text-xs" style="margin-top: 4px">
            长样本分析更全面但耗时更长，多文件会均匀抽样
          </div>
        </el-form-item>
      </el-form>
    </div>

    <!-- 进度 -->
    <div v-if="analyzing" class="card progress-card">
      <div class="loading-row">
        <el-icon class="rotating"><Loading /></el-icon>
        <span>正在拆解小说结构...</span>
      </div>
      <el-progress :percentage="50" :show-text="false" :stroke-width="4" status="success" style="margin-top: 12px" />
    </div>

    <!-- 拆书结果 -->
    <div v-else-if="lastResult" class="card result-card">
      <div class="result-header">
        <div class="result-title">
          <el-icon><Document /></el-icon>
          <span>{{ lastResult.sourceTitle || '拆书报告' }}</span>
        </div>
        <span class="text-faint text-xs">{{ formatTime(lastResult.createdAt) }}</span>
      </div>
      <div class="result-body markdown-body" v-html="renderMarkdown(lastResult.content)"></div>
    </div>

    <div v-else class="card empty-state">
      <el-icon class="empty-icon"><Reading /></el-icon>
      <p>还没有拆书结果</p>
      <p class="text-faint text-xs">上传小说文件后点击「开始拆书」</p>
    </div>

    <!-- 历史记录 -->
    <div v-if="history.length > 0" style="margin-top: 16px">
      <div class="section-title">历史拆书记录</div>
      <div class="card history-card">
        <div v-for="(r, i) in history" :key="i" class="history-row" @click="loadHistory(r)">
          <div class="history-info">
            <span class="history-title">{{ r.sourceTitle || '未命名作品' }}</span>
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
import {
  Reading, ArrowLeft, MagicStick, Download, Loading, View,
  Upload, Document, Delete, Plus
} from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as ai from '@/services/ai'
import { marked } from 'marked'

const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)
const availableModels = computed(() => settings.availableModels())

interface NovelFile {
  path: string
  fileName: string
  ext: string
  content: string
  size: number
}

const files = ref<NovelFile[]>([])
const sourceTitle = ref('')
const model = ref('')
const dimensions = ref<string[]>(['structure', 'characters', 'rhythm', 'hook', 'template'])
const sampleSize = ref<number>(12000)
const analyzing = ref(false)

interface TeardownRecord {
  id: string
  sourceTitle: string
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
})

// ===== 文件上传 =====
async function pickFiles() {
  try {
    const paths = (await window.api.file.selectNovel()) as string[]
    if (!Array.isArray(paths) || paths.length === 0) return
    for (const p of paths) {
      const f = await window.api.file.readNovelText(p)
      files.value.push(f as NovelFile)
    }
    if (!sourceTitle.value && files.value.length > 0) {
      sourceTitle.value = files.value[0].fileName.replace(/\.[^.]+$/, '')
    }
  } catch (e: any) {
    ElMessage.error('读取文件失败：' + (e?.message || ''))
  }
}

function countChars(text: string): number {
  if (!text) return 0
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const english = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length
  return chinese + english
}

const totalChars = computed(() =>
  files.value.reduce((s, f) => s + countChars(f.content), 0)
)

// 在多文件中均匀抽样
function pickSample(maxChars: number): string {
  const parts: string[] = []
  let total = 0
  const fl = files.value.length || 1
  for (const f of files.value) {
    const remaining = maxChars - total
    if (remaining <= 0) break
    const slice = (f.content || '').slice(0, Math.min(remaining, Math.ceil(maxChars / fl) + 1000))
    parts.push(`【${f.fileName}】\n${slice}`)
    total += slice.length
  }
  return parts.join('\n\n')
}

function buildPrompt(sample: string): string {
  const parts: string[] = []
  parts.push('你是一位资深小说编辑与拆书分析师。请对以下小说文本进行专业拆书分析。')
  if (sourceTitle.value) parts.push(`原作：${sourceTitle.value}`)
  parts.push('')
  parts.push('## 分析维度')
  const dimMap: Record<string, string> = {
    structure: '结构骨架：拆解整体起承转合、章节结构、主线/支线分布、各部分占比与作用',
    characters: '人物塑造：主角人设公式、出场角色清单、立体度、动机、人设标签',
    rhythm: '节奏分析：段落节奏快慢、信息密度、爽点节奏（前5章/前30章/中段/高潮）、读者情绪曲线',
    hook: '章节钩子：每章结尾的悬念套路、可复用的钩子模板',
    foreshadowing: '伏笔追踪：埋下的伏笔、回收的伏笔、待回收的悬念、伏笔密度',
    conflict: '冲突点：明冲突、暗冲突、推动剧情的张力来源、冲突升级路径',
    style: '语言风格：用词偏好、句式长短、修辞习惯、对话特征、口语化/书面化程度',
    template: '可复用模板：从该作品中提炼出可直接套用的写作模板（人设公式、章节结构、爽点节奏、钩子套路）'
  }
  for (const d of dimensions.value) {
    if (dimMap[d]) parts.push(`- ${dimMap[d]}`)
  }
  parts.push('')
  parts.push('## 输出要求')
  parts.push('- 使用 Markdown 格式，每个维度用二级标题（##）')
  parts.push('- 用要点列表，简洁有重点，给出具体引用佐证')
  parts.push('- 在「可复用模板」维度，给出至少 3 条可直接套用的模板/公式')
  parts.push('- 直接输出分析结果，不要写"以下是分析"等说明性文字')
  parts.push('')
  parts.push('## 小说文本')
  parts.push(sample || '（文本为空）')
  return parts.join('\n')
}

async function runTeardown() {
  if (files.value.length === 0) {
    ElMessage.warning('请先上传小说文件')
    return
  }
  if (!model.value) {
    ElMessage.warning('请选择 AI 模型')
    return
  }
  if (dimensions.value.length === 0) {
    ElMessage.warning('请至少选择一个分析维度')
    return
  }
  const provider = settings.findProviderForModel(model.value)
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置该模型的 API Key')
    return
  }
  analyzing.value = true
  try {
    const sample = pickSample(sampleSize.value)
    const prompt = buildPrompt(sample)
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
      id: `teardown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sourceTitle: sourceTitle.value || (files.value[0]?.fileName || '未命名作品'),
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
  a.download = `${lastResult.value.sourceTitle || '拆书报告'}-拆书分析.md`
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
.upload-card {
  padding: 20px;
  margin-bottom: 16px;
}
.upload-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  color: var(--text-3);
  transition: all 0.15s;
}
.upload-empty:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--panel-2);
  border-radius: var(--radius);
}
.file-icon { color: var(--primary); font-size: 22px; }
.file-info { flex: 1; min-width: 0; }
.file-name {
  font-weight: 500;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.config-card {
  padding: 20px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 3px solid var(--primary);
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
