<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><ChatLineSquare /></el-icon>
          AI 多模型评审
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">多模型交叉评审，避免单一模型盲点</p>
      </div>
      <div class="flex gap-2">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-button type="primary" :icon="MagicStick" @click="openCriticDialog">评审章节</el-button>
      </div>
    </div>

    <!-- 顶部汇总卡片 -->
    <div v-if="currentResults.length > 0" class="card summary-card">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">总问题数</div>
          <div class="summary-value">{{ totalIssues }}</div>
        </div>
        <div class="summary-item high">
          <div class="summary-label">高严重</div>
          <div class="summary-value">{{ highCount }}</div>
        </div>
        <div class="summary-item medium">
          <div class="summary-label">中严重</div>
          <div class="summary-value">{{ mediumCount }}</div>
        </div>
        <div class="summary-item low">
          <div class="summary-label">低严重</div>
          <div class="summary-value">{{ lowCount }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">参与模型</div>
          <div class="summary-value">{{ modelCount }}</div>
        </div>
      </div>
    </div>

    <!-- 评审进度 -->
    <div v-if="progressList.length > 0" class="card" style="padding: 16px; margin-top: 16px">
      <div class="section-title" style="margin-bottom: 12px">评审进度</div>
      <div v-for="(p, i) in progressList" :key="i" class="progress-row">
        <div class="progress-label">
          <span class="progress-model">{{ p.model }}</span>
          <span class="text-faint">· {{ p.role }}</span>
          <el-tag v-if="p.status === 'done'" size="small" type="success" effect="plain" :icon="Check">完成</el-tag>
          <el-tag v-else-if="p.status === 'error'" size="small" type="danger" effect="plain" :icon="Warning">失败</el-tag>
          <el-tag v-else size="small" type="warning" effect="plain">运行中</el-tag>
        </div>
        <el-progress
          :percentage="p.status === 'done' ? 100 : p.status === 'error' ? 100 : 60"
          :status="p.status === 'done' ? 'success' : p.status === 'error' ? 'exception' : undefined"
          :show-text="false"
          :stroke-width="6"
        />
      </div>
    </div>

    <!-- 本次评审结果，按模型分组 -->
    <div v-if="currentResults.length > 0" style="margin-top: 16px">
      <div class="section-title">本次评审结果</div>
      <div v-for="model in groupedByModel" :key="model" class="card model-card">
        <div class="model-card-header">
          <el-icon><ChatLineSquare /></el-icon>
          <span class="model-name">{{ model }}</span>
          <el-tag size="small" effect="plain">{{ recordsForModel(model).length }} 条评审</el-tag>
        </div>
        <div v-for="r in recordsForModel(model)" :key="r.id" class="critique-block">
          <div class="critique-role">
            <el-tag size="small" type="info" effect="dark">{{ r.role }}</el-tag>
            <span class="text-faint text-xs">{{ formatTime(r.createdAt) }}</span>
          </div>
          <div v-if="r.summary" class="critique-summary">{{ r.summary }}</div>
          <div v-if="r.findings && r.findings.length > 0" class="findings">
            <div v-for="(f, i) in r.findings" :key="i" class="finding-item">
              <el-tag :type="severityType(f.severity)" size="small" effect="dark" class="finding-tag">{{ severityLabel(f.severity) }}</el-tag>
              <div class="finding-body">
                <div class="finding-issue">{{ f.issue }}</div>
                <div class="finding-suggestion text-muted text-sm">建议：{{ f.suggestion }}</div>
              </div>
            </div>
          </div>
          <div v-else class="empty-inline text-faint text-sm">
            <el-icon><Check /></el-icon> 未发现问题
          </div>
        </div>
      </div>
    </div>

    <!-- 历史评审记录 -->
    <div v-if="history.length > 0" style="margin-top: 16px">
      <div class="section-title">历史评审记录</div>
      <div class="card history-card">
        <div v-for="r in history" :key="r.id" class="history-row">
          <div class="history-main">
            <div class="history-title">
              <span class="history-chapter">{{ chapterTitle(r.chapterId) }}</span>
              <el-tag size="small" effect="plain">{{ r.model }}</el-tag>
              <el-tag size="small" type="info" effect="plain">{{ r.role }}</el-tag>
              <span class="text-faint text-xs">{{ formatTime(r.createdAt) }}</span>
            </div>
            <div class="history-summary text-muted text-sm">{{ r.summary || '无评价' }}</div>
            <div class="history-meta text-faint text-xs">
              共 {{ r.findings?.length || 0 }} 条问题
              <template v-if="highCountOf(r) > 0">· 高 {{ highCountOf(r) }}</template>
            </div>
          </div>
          <el-button text :icon="Delete" size="small" @click="removeRecord(r)" />
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="allRecords.length === 0 && currentResults.length === 0 && progressList.length === 0" class="card empty">
      <el-icon class="empty-icon"><Warning /></el-icon>
      <p>还没有评审记录</p>
      <p class="text-faint text-sm">点击右上角「评审章节」开始</p>
    </div>

    <!-- 评审对话框 -->
    <el-dialog v-model="dialogVisible" title="发起评审" width="560px">
      <el-form label-width="90px">
        <el-form-item label="评审章节">
          <el-select v-model="form.chapterId" placeholder="选择章节" style="width: 100%">
            <el-option
              v-for="c in chapters"
              :key="c.id"
              :label="`第${c.order}章 · ${c.title}`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="评审模型">
          <el-checkbox-group v-model="form.models">
            <el-checkbox
              v-for="m in availableModels"
              :key="m.model"
              :value="m.model"
              style="display: block; margin-bottom: 6px"
            >
              {{ m.provider }} / {{ m.model }}
            </el-checkbox>
          </el-checkbox-group>
          <div class="text-faint text-xs">已选 {{ form.models.length }} 个模型（推荐至少 2 个）</div>
        </el-form-item>
        <el-form-item label="评审角色">
          <el-checkbox-group v-model="form.roles">
            <el-checkbox v-for="r in roleOptions" :key="r.key" :value="r.key">{{ r.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="running" :disabled="!canRun" @click="runCritique">开始评审</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatLineSquare, Delete, MagicStick, Warning, Check, ArrowLeft } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as db from '@/services/db'
import * as ai from '@/services/ai'
import type { CritiqueRecord } from '@/types'

const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)
const chapters = computed(() => projectStore.chapters)

const roleOptions = [
  { key: 'builtin-critic-voice', label: '文风评审员' },
  { key: 'builtin-critic-continuity', label: '连续性评审员' }
]

const availableModels = computed(() => settings.availableModels())

const dialogVisible = ref(false)
const running = ref(false)
const form = reactive({
  chapterId: '',
  models: [] as string[],
  roles: ['builtin-critic-voice', 'builtin-critic-continuity'] as string[]
})

type ProgressItem = { model: string; role: string; status: 'pending' | 'running' | 'done' | 'error' }
const progressList = ref<ProgressItem[]>([])

const currentResults = ref<CritiqueRecord[]>([])
const allRecords = ref<CritiqueRecord[]>([])

const history = computed(() => {
  const cur = new Set(currentResults.value.map(r => r.id))
  return allRecords.value.filter(r => !cur.has(r.id))
})

const canRun = computed(() =>
  !!form.chapterId && form.models.length > 0 && form.roles.length > 0
)

const totalIssues = computed(() =>
  currentResults.value.reduce((s, r) => s + (r.findings?.length || 0), 0)
)
const highCount = computed(() =>
  currentResults.value.reduce((s, r) => s + (r.findings || []).filter(f => f.severity === 'high').length, 0)
)
const mediumCount = computed(() =>
  currentResults.value.reduce((s, r) => s + (r.findings || []).filter(f => f.severity === 'medium').length, 0)
)
const lowCount = computed(() =>
  currentResults.value.reduce((s, r) => s + (r.findings || []).filter(f => f.severity === 'low').length, 0)
)
const modelCount = computed(() => new Set(currentResults.value.map(r => r.model)).size)

const groupedByModel = computed(() => {
  const arr: string[] = []
  for (const r of currentResults.value) {
    if (!arr.includes(r.model)) arr.push(r.model)
  }
  return arr
})

function recordsForModel(model: string) {
  return currentResults.value.filter(r => r.model === model)
}

async function loadHistory() {
  if (!project.value) return
  try {
    allRecords.value = (await db.Critiques.list(project.value.id))
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch (e: any) {
    ElMessage.error(`加载历史评审记录失败：${e?.message || e}`)
  }
}

watch(() => project.value?.id, (id) => {
  if (id) loadHistory()
}, { immediate: true })

onMounted(() => {
  const ms = availableModels.value.slice(0, 2).map(m => m.model)
  form.models = ms
  if (chapters.value.length > 0) {
    form.chapterId = chapters.value[0].id
  }
})

function openCriticDialog() {
  if (chapters.value.length === 0) {
    ElMessage.warning('请先创建章节')
    return
  }
  if (availableModels.value.length === 0) {
    ElMessage.warning('请先在设置中配置模型与 API Key')
    return
  }
  dialogVisible.value = true
}

function plainText(content: string): string {
  return (content || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}

async function loadTruthAndCharacters() {
  if (!project.value) return { truth: '' }
  const pid = project.value.id
  try {
    const truths = await db.Truths.list(pid)
    const truth = truths.map(t => `# ${t.title}\n${t.content || '(空)'}`).join('\n\n')
    return { truth }
  } catch (e: any) {
    ElMessage.error(`加载真相数据失败：${e?.message || e}`)
    return { truth: '' }
  }
}

// 兜底内置评审提示词（防止老用户 db 中缺失内置 prompt 导致评审失败）
const FALLBACK_PROMPTS: Record<string, string> = {
  'builtin-critic-voice': '你是一位严格的文学编辑，专司文风审查。请审查以下文本，找出：套话/陈词滥调、AI 味重的句式、词汇疲劳、节奏单调、过度修饰等问题。对每个问题给出严重程度（high/medium/low）、具体位置、修改建议。最后给一段整体评价。输出 JSON：{"findings":[{"severity":"high","issue":"...","suggestion":"..."}],"summary":"..."}\n\n{{content}}',
  'builtin-critic-continuity': '你是一位连续性审查员。对照以下世界状态，检查章节是否存在：设定矛盾、伏笔断裂、时间线错误、信息泄露（提到不该知道的事）等问题。输出 JSON：{"findings":[{"severity":"high","issue":"...","suggestion":"..."}],"summary":"..."}\n\n世界状态：\n{{truth}}\n\n待审章节：\n{{content}}'
}

// 清理已废弃的 {{characters}} 占位符（v1.3.8 移除人物库后老 prompt 仍可能引用）
function sanitizeTemplate(tpl: string): string {
  return (tpl || '')
    .replace(/\n\n角色档案：\s*\{\{characters\}\}/g, '')
    .replace(/\{\{characters\}\}/g, '（无）')
}

function parseCritiqueJSON(text: string): { summary: string; findings: CritiqueRecord['findings'] } {
  const t = (text || '').trim()
  if (!t) return { summary: '', findings: [] }
  const cleaned = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const tryParse = (s: string) => {
    try {
      const obj = JSON.parse(s)
      return {
        summary: typeof obj.summary === 'string' ? obj.summary : '',
        findings: Array.isArray(obj.findings)
          ? obj.findings.map((f: any) => ({
            severity: (['high', 'medium', 'low'].includes(f.severity) ? f.severity : 'medium') as 'high' | 'medium' | 'low',
            issue: String(f.issue || ''),
            suggestion: String(f.suggestion || '')
          }))
          : []
      }
    } catch {
      return null
    }
  }
  const direct = tryParse(cleaned)
  if (direct) return direct
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (m) {
    const extracted = tryParse(m[0])
    if (extracted) return extracted
  }
  return { summary: text, findings: [] }
}

async function runCritique() {
  if (!project.value || !form.chapterId) return
  const chapter = chapters.value.find(c => c.id === form.chapterId)
  if (!chapter) {
    ElMessage.warning('请选择有效章节')
    return
  }
  const provider0 = settings.findProviderForModel(form.models[0])
  if (!provider0?.apiKey) {
    ElMessage.warning('请先配置 API Key')
    return
  }
  let prompts: Awaited<ReturnType<typeof db.Prompts.list>> = []
  try {
    prompts = await db.Prompts.list(project.value.id)
  } catch (e: any) {
    ElMessage.error(`加载提示词失败：${e?.message || e}`)
    return
  }
  const content = plainText(chapter.content)
  if (!content) {
    ElMessage.warning('该章节内容为空')
    return
  }
  const { truth } = await loadTruthAndCharacters()

  running.value = true
  dialogVisible.value = false
  try {
    progressList.value = []
    for (const model of form.models) {
      for (const role of form.roles) {
        progressList.value.push({ model, role: roleLabel(role), status: 'pending' })
      }
    }

    const newRecords: CritiqueRecord[] = []
    const batchTime = Date.now()

    for (const model of form.models) {
      const provider = settings.findProviderForModel(model)
      if (!provider?.apiKey) {
        for (const role of form.roles) {
          const idx = progressList.value.findIndex(p => p.model === model && p.role === roleLabel(role))
          if (idx >= 0) progressList.value[idx].status = 'error'
        }
        ElMessage.warning(`模型 ${model} 缺少 API Key，已跳过`)
        continue
      }
      for (const role of form.roles) {
        const tpl = prompts.find(p => p.id === role || p.title === role)
        const idx = progressList.value.findIndex(p => p.model === model && p.role === roleLabel(role))
        // 兜底：未找到内置提示词时，使用代码内置的 fallback
        const templateContent = tpl ? sanitizeTemplate(tpl.content) : FALLBACK_PROMPTS[role]
        if (!templateContent) {
          ElMessage.warning(`未找到评审提示词：${role}`)
          if (idx >= 0) progressList.value[idx].status = 'error'
          continue
        }
        if (idx >= 0) progressList.value[idx].status = 'running'
        try {
          const userMsg = ai.renderTemplate(templateContent, {
            content,
            truth,
            chapterTitle: chapter.title
          })
          const text = await ai.chat(ai.buildRequest({
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model,
            messages: [{ role: 'user', content: userMsg }],
            temperature: 0.3,
            maxTokens: 4096
          }))
          const parsed = parseCritiqueJSON(text)
          const saved = await db.Critiques.save({
            projectId: project.value.id,
            chapterId: chapter.id,
            model,
            role: roleLabel(role),
            findings: parsed.findings,
            summary: parsed.summary,
            createdAt: batchTime
          })
          newRecords.push(saved)
          if (idx >= 0) progressList.value[idx].status = 'done'
        } catch (e: any) {
          if (idx >= 0) progressList.value[idx].status = 'error'
          ElMessage.error(`${model} · ${roleLabel(role)} 评审失败：${e?.message || e}`)
        }
      }
    }

    currentResults.value = newRecords
    allRecords.value = (await db.Critiques.list(project.value.id))
      .sort((a, b) => b.createdAt - a.createdAt)
    const okCount = progressList.value.filter(p => p.status === 'done').length
    ElMessage.success(`评审完成：${okCount}/${progressList.value.length} 成功`)
  } finally {
    running.value = false
  }
}

async function removeRecord(r: CritiqueRecord) {
  try {
    await ElMessageBox.confirm('确认删除该评审记录？', '确认', { type: 'warning' })
  } catch { return }
  try {
    await db.Critiques.remove(r.id)
  } catch (e: any) {
    ElMessage.error(`删除失败：${e?.message || e}`)
    return
  }
  allRecords.value = allRecords.value.filter(x => x.id !== r.id)
  currentResults.value = currentResults.value.filter(x => x.id !== r.id)
  ElMessage.success('已删除')
}

function roleLabel(key: string): string {
  const found = roleOptions.find(r => r.key === key)
  return found ? found.label : key
}

function severityType(s: string): any {
  return { high: 'danger', medium: 'warning', low: 'primary' }[s] || 'info'
}
function severityLabel(s: string): string {
  return { high: '高', medium: '中', low: '低' }[s] || s
}

function highCountOf(r: CritiqueRecord): number {
  return (r.findings || []).filter(f => f.severity === 'high').length
}

function chapterTitle(id: string): string {
  const c = chapters.value.find(x => x.id === id)
  return c ? `第${c.order}章 · ${c.title}` : '未知章节'
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.summary-card { padding: 16px; }
.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.summary-item {
  text-align: center;
  padding: 12px 8px;
  border-radius: 8px;
  background: var(--panel-2);
}
.summary-item.high { background: rgba(239, 68, 68, 0.08); }
.summary-item.medium { background: rgba(245, 158, 11, 0.08); }
.summary-item.low { background: rgba(99, 102, 241, 0.08); }
.summary-label {
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 6px;
}
.summary-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}
.summary-item.high .summary-value { color: var(--danger); }
.summary-item.medium .summary-value { color: var(--warning); }
.summary-item.low .summary-value { color: var(--primary); }

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 3px solid var(--primary);
}

.model-card { padding: 0; margin-bottom: 12px; overflow: hidden; }
.model-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-2);
}
.model-name { font-weight: 600; font-size: 14px; flex: 1; color: var(--text); }

.critique-block {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.critique-block:last-child { border-bottom: none; }
.critique-role {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.critique-summary {
  font-size: 13px;
  color: var(--text);
  background: var(--panel-2);
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 10px;
  line-height: 1.6;
  border-left: 3px solid var(--primary);
}

.findings { display: flex; flex-direction: column; gap: 8px; }
.finding-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--panel-2);
  align-items: flex-start;
}
.finding-tag { flex-shrink: 0; }
.finding-body { flex: 1; min-width: 0; }
.finding-issue {
  font-size: 13px;
  color: var(--text);
  margin-bottom: 4px;
  line-height: 1.5;
}
.finding-suggestion { line-height: 1.5; }
.empty-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
}

.progress-row { margin-bottom: 14px; }
.progress-row:last-child { margin-bottom: 0; }
.progress-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}
.progress-model { font-weight: 500; color: var(--text); }

.history-card { padding: 0; }
.history-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}
.history-row:hover { background: var(--panel-2); }
.history-row:last-child { border-bottom: none; }
.history-main { flex: 1; min-width: 0; }
.history-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.history-chapter { font-weight: 500; font-size: 13px; color: var(--text); }
.history-summary {
  margin-bottom: 4px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-meta { display: flex; gap: 8px; }
</style>
