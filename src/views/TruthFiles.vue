<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><Files /></el-icon>
          长期记忆真相文件
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">维护 7 个核心文件，保证全书角色/伏笔/时间线/数值一致性</p>
      </div>
      <div class="flex gap-2">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-button type="primary" :icon="MagicStick" :loading="aiAllRunning" @click="aiUpdateAll">
          AI 更新所有真相文件
        </el-button>
      </div>
    </div>

    <!-- 整体进度 -->
    <div v-if="aiAllProgress.length > 0" class="card" style="padding: 16px; margin-bottom: 16px">
      <div class="section-title" style="margin-bottom: 12px">AI 更新进度</div>
      <div v-for="p in aiAllProgress" :key="p.key" class="ai-progress-row">
        <div class="ai-progress-label">
          <span class="ai-progress-title">{{ fileMetaByKey(p.key)?.title }}</span>
          <el-tag v-if="p.status === 'done'" size="small" type="success" effect="plain" :icon="Check">完成</el-tag>
          <el-tag v-else-if="p.status === 'error'" size="small" type="danger" effect="plain" :icon="Warning">失败</el-tag>
          <el-tag v-else-if="p.status === 'running'" size="small" type="warning" effect="plain">生成中</el-tag>
          <el-tag v-else size="small" effect="plain">等待</el-tag>
        </div>
        <el-progress
          :percentage="p.status === 'done' ? 100 : p.status === 'error' ? 100 : p.status === 'running' ? 50 : 0"
          :status="p.status === 'done' ? 'success' : p.status === 'error' ? 'exception' : undefined"
          :show-text="false"
          :stroke-width="6"
        />
      </div>
    </div>

    <!-- 7 个文件卡片 -->
    <div class="grid grid-2">
      <div v-for="meta in fileMetas" :key="meta.key" class="card truth-card">
        <div class="truth-header">
          <div class="truth-icon">
            <el-icon :size="20"><component :is="meta.icon" /></el-icon>
          </div>
          <div class="truth-titles">
            <div class="truth-title">{{ meta.title }}</div>
            <div class="truth-key text-faint text-xs">{{ meta.key }}</div>
          </div>
          <div class="truth-actions">
            <el-button text size="small" :icon="Edit" @click="openEdit(meta.key)">编辑</el-button>
            <el-button
              text
              size="small"
              :icon="MagicStick"
              :loading="singleRunningKey === meta.key"
              :disabled="aiAllRunning"
              @click="aiGenerateSingle(meta.key)"
            >AI 生成</el-button>
          </div>
        </div>
        <p class="truth-desc text-muted text-sm">{{ meta.desc }}</p>
        <div class="truth-preview">
          <pre v-if="fileByKey(meta.key)?.content">{{ previewText(fileByKey(meta.key)!.content) }}</pre>
          <span v-else class="text-faint text-sm">（暂无内容，点击「AI 生成」或「编辑」）</span>
        </div>
        <div class="truth-footer">
          <span class="text-faint text-xs">
            更新于 {{ fileByKey(meta.key)?.updatedAt ? formatTime(fileByKey(meta.key)!.updatedAt) : '—' }}
          </span>
          <el-tag v-if="singleRunningKey === meta.key" size="small" type="warning" effect="plain">生成中...</el-tag>
          <el-tag v-else-if="fileByKey(meta.key)?.content" size="small" type="success" effect="plain" :icon="Check">已维护</el-tag>
        </div>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" :title="`编辑：${editMeta?.title || ''}`" width="760px">
      <el-form label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="editForm.content"
            type="textarea"
            :rows="18"
            placeholder="使用 markdown 列表格式，条目化记录关键信息"
            class="mono-input"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Files, Edit, MagicStick, Warning, Check,
  Aim, User, Connection, Document, List, Sunny, Wallet, ArrowLeft
} from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as db from '@/services/db'
import * as ai from '@/services/ai'
import type { TruthFile } from '@/types'

const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)

const fileMetas = [
  { key: 'current_state', title: '世界当前状态', desc: '故事世界的当前状态：势力分布、政治格局、自然环境、关键事件进展', icon: Aim },
  { key: 'character_matrix', title: '角色矩阵', desc: '主要角色的当前位置、状态、关系网、阵营归属', icon: User },
  { key: 'pending_hooks', title: '待处理伏笔池', desc: '已埋下但尚未回收的伏笔，标注所在章节与回收预期', icon: Connection },
  { key: 'chapter_summaries', title: '章节摘要', desc: '已完成章节的关键剧情摘要，按章节顺序排列', icon: Document },
  { key: 'subplot_board', title: '支线进度板', desc: '各支线的当前进度、参与角色、与主线的关联节点', icon: List },
  { key: 'emotional_arcs', title: '情感弧线', desc: '主要角色的情感变化曲线与关键转折点', icon: Sunny },
  { key: 'particle_ledger', title: '资源/物品账本', desc: '关键道具、资源、货币的流向与持有者变更记录', icon: Wallet }
]

function fileMetaByKey(key: string) {
  return fileMetas.find(m => m.key === key)
}

const files = ref<TruthFile[]>([])

function fileByKey(key: string): TruthFile | undefined {
  return files.value.find(f => f.key === key)
}

const editVisible = ref(false)
const editForm = reactive({ title: '', content: '', key: '' })
const editMeta = computed(() => fileMetaByKey(editForm.key))

const aiAllRunning = ref(false)
const singleRunningKey = ref<string | null>(null)
type AIProgress = { key: string; status: 'pending' | 'running' | 'done' | 'error' }
const aiAllProgress = ref<AIProgress[]>([])

watch(() => project.value?.id, (id) => {
  if (id) {
    ensureFiles().then(loadFiles)
  }
}, { immediate: true })

async function ensureFiles() {
  if (!project.value) return
  const pid = project.value.id
  try {
    const existing = await db.Truths.list(pid)
    const existingKeys = new Set(existing.map(f => f.key))
    const toCreate = fileMetas.filter(m => !existingKeys.has(m.key))
    if (toCreate.length === 0) return
    for (const m of toCreate) {
      await db.Truths.save({
        projectId: pid,
        key: m.key,
        title: m.title,
        content: '',
        updatedAt: 0
      })
    }
  } catch (e: any) {
    ElMessage.error(`初始化真相文件失败：${e?.message || e}`)
  }
}

async function loadFiles() {
  if (!project.value) return
  try {
    files.value = await db.Truths.list(project.value.id)
  } catch (e: any) {
    ElMessage.error(`加载真相文件失败：${e?.message || e}`)
  }
}

function previewText(content: string): string {
  if (!content) return ''
  const t = content.trim()
  return t.length > 100 ? t.slice(0, 100) + '…' : t
}

function formatTime(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openEdit(key: string) {
  const f = fileByKey(key)
  const m = fileMetaByKey(key)
  if (!m) return
  editForm.key = key
  editForm.title = f?.title || m.title
  editForm.content = f?.content || ''
  editVisible.value = true
}

async function saveEdit() {
  if (!project.value) return
  const f = fileByKey(editForm.key)
  try {
    if (f) {
      await db.Truths.save({
        ...f,
        title: editForm.title,
        content: editForm.content,
        updatedAt: Date.now()
      })
      f.title = editForm.title
      f.content = editForm.content
      f.updatedAt = Date.now()
    } else {
      const saved = await db.Truths.save({
        projectId: project.value.id,
        key: editForm.key,
        title: editForm.title,
        content: editForm.content,
        updatedAt: Date.now()
      })
      files.value.push(saved)
    }
    ElMessage.success('已保存')
    editVisible.value = false
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.message || e}`)
  }
}

async function buildContext(): Promise<{ chapterSummaries: string }> {
  if (!project.value) return { chapterSummaries: '' }
  const pid = project.value.id
  const chs = await db.Chapters.list(pid)
  const sorted = [...chs].sort((a, b) => a.order - b.order)
  const chapterSummaries = sorted.map(c => {
    const summary = c.summary?.trim()
    if (summary) return `第${c.order}章《${c.title}》：${summary}`
    const plain = (c.content || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    const excerpt = plain.length > 200 ? plain.slice(0, 200) + '…' : plain
    return `第${c.order}章《${c.title}》：${excerpt || '(无内容)'}`
  }).join('\n')
  return { chapterSummaries }
}

function buildPrompt(file: TruthFile, ctx: { chapterSummaries: string }): string {
  return `你是小说创作助手。基于以下章节内容，重新整理「${file.title}」文件。要求：客观、简洁、条目化（用 markdown 列表）。直接输出文件内容，不要解释。\n\n章节摘要：\n${ctx.chapterSummaries || '(暂无章节)'}\n\n现有内容（参考）：\n${file.content || '(空)'}`
}

function pickModel(): string {
  if (!project.value) return ''
  return project.value.settings.model || settings.settings?.defaultModel || ''
}

async function aiGenerateSingle(key: string) {
  if (!project.value) return
  const file = fileByKey(key)
  const meta = fileMetaByKey(key)
  if (!file || !meta) return
  const model = pickModel()
  if (!model) {
    ElMessage.warning('请先在项目设置或全局设置中选择模型')
    return
  }
  const provider = settings.findProviderForModel(model)
  if (!provider?.apiKey) {
    ElMessage.warning('请先配置 API Key')
    return
  }
  singleRunningKey.value = key
  try {
    const ctx = await buildContext()
    const prompt = buildPrompt(file, ctx)
    let acc = ''
    const fullText = await ai.streamChat(
      ai.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      }),
      (chunk) => {
        acc += chunk
        file.content = acc
      }
    )
    file.content = fullText || acc
    file.updatedAt = Date.now()
    await db.Truths.save(file)
    ElMessage.success(`「${meta.title}」已生成`)
  } catch (e: any) {
    ElMessage.error(`生成失败：${e?.message || e}`)
  } finally {
    singleRunningKey.value = null
  }
}

async function aiUpdateAll() {
  if (!project.value) return
  const model = pickModel()
  if (!model) {
    ElMessage.warning('请先选择模型')
    return
  }
  const provider = settings.findProviderForModel(model)
  if (!provider?.apiKey) {
    ElMessage.warning('请先配置 API Key')
    return
  }
  if (fileMetas.every(m => !fileByKey(m.key))) {
    ElMessage.warning('文件未初始化')
    return
  }
  try {
    await ElMessageBox.confirm(
      '将依次对 7 个真相文件调用 AI 重新生成，可能需要一些时间。是否继续？',
      'AI 更新所有',
      { type: 'info', confirmButtonText: '开始', cancelButtonText: '取消' }
    )
  } catch { return }

  aiAllRunning.value = true
  aiAllProgress.value = fileMetas.map(m => ({ key: m.key, status: 'pending' as const }))
  try {
    const ctx = await buildContext()
    for (const meta of fileMetas) {
      const file = fileByKey(meta.key)
      if (!file) continue
      const idx = aiAllProgress.value.findIndex(p => p.key === meta.key)
      if (idx >= 0) aiAllProgress.value[idx].status = 'running'
      singleRunningKey.value = meta.key
      try {
        const prompt = buildPrompt(file, ctx)
        let acc = ''
        const fullText = await ai.streamChat(
          ai.buildRequest({
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          }),
          (chunk) => {
            acc += chunk
            file.content = acc
          }
        )
        file.content = fullText || acc
        file.updatedAt = Date.now()
        await db.Truths.save(file)
        if (idx >= 0) aiAllProgress.value[idx].status = 'done'
      } catch (e: any) {
        if (idx >= 0) aiAllProgress.value[idx].status = 'error'
        ElMessage.error(`「${meta.title}」生成失败：${e?.message || e}`)
      }
    }
    ElMessage.success('全部真相文件已更新')
  } finally {
    aiAllRunning.value = false
    singleRunningKey.value = null
  }
}
</script>

<style scoped>
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 3px solid var(--primary);
}

.truth-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.15s;
}
.truth-card:hover { box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08); }
.truth-header { display: flex; align-items: center; gap: 12px; }
.truth-icon {
  width: 40px;
  height: 40px;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.truth-titles { flex: 1; min-width: 0; }
.truth-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.truth-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  margin-top: 2px;
}
.truth-actions { display: flex; gap: 2px; flex-shrink: 0; }
.truth-desc { margin: 0; line-height: 1.5; }
.truth-preview {
  background: var(--panel-2);
  border-radius: 6px;
  padding: 10px 12px;
  min-height: 64px;
  max-height: 120px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border);
}
.truth-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.55;
}
.truth-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.ai-progress-row { margin-bottom: 14px; }
.ai-progress-row:last-child { margin-bottom: 0; }
.ai-progress-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}
.ai-progress-title { font-weight: 500; color: var(--text); flex: 1; }

:deep(.mono-input textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
}
</style>
