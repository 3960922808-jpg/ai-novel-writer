<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <h1 class="page-title">章节列表</h1>
      <div class="flex gap-2">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-button :icon="MagicStick" :loading="autoGenerating" @click="autoGenerate">AI 生成分章大纲</el-button>
        <el-button type="primary" :icon="Plus" @click="addChapter">新建章节</el-button>
      </div>
    </div>

    <div class="card" style="padding: 8px">
      <div v-if="projectStore.chapters.length === 0" class="empty">
        <el-icon class="empty-icon"><Document /></el-icon>
        <p>还没有章节</p>
      </div>
      <div v-else>
        <div
          v-for="(c, index) in chapters" :key="c.id"
          class="ch-row"
          :class="{ active: c.id === selected, 'drag-over': dragOverIndex === index }"
          draggable="true"
          @dragstart="onDragStart(index)"
          @dragover.prevent="dragOverIndex = index"
          @dragleave="dragOverIndex = -1"
          @drop.prevent="onDrop(index)"
          @dragend="dragOverIndex = -1"
          @click="select(c)"
        >
            <div class="drag-handle" title="拖动排序">
              <el-icon><Sort /></el-icon>
            </div>
            <div class="ch-order">{{ c.order }}</div>
            <div class="ch-main">
              <input
                v-model="c.title"
                class="ch-title-input"
                @click.stop
                @blur="saveChapter(c)"
                @keyup.enter="saveChapter(c)"
              />
              <div class="ch-meta">
                <el-tag size="small" :type="statusType(c.status)" effect="plain">{{ c.status }}</el-tag>
                <span class="text-faint text-xs">{{ c.wordCount }} 字</span>
                <span class="text-faint text-xs">{{ formatTime(c.updatedAt) }}</span>
                <span v-if="c.summary" class="text-faint text-xs ch-summary">{{ c.summary }}</span>
              </div>
            </div>
            <div class="ch-actions" @click.stop>
              <el-button text size="small" :icon="Edit" @click="edit(c)" />
              <el-dropdown trigger="click">
                <el-button text size="small" :icon="MoreFilled" />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="changeStatus(c, '草稿')">标记为草稿</el-dropdown-item>
                    <el-dropdown-item @click="changeStatus(c, '完成')">标记为完成</el-dropdown-item>
                    <el-dropdown-item @click="changeStatus(c, '已发表')">标记为已发表</el-dropdown-item>
                    <el-dropdown-item @click="aiSummary(c)">AI 生成摘要</el-dropdown-item>
                    <el-dropdown-item divided @click="remove(c)">
                      <span style="color: var(--danger)">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
      </div>
    </div>

    <!-- AI 大纲生成对话框 -->
    <el-dialog v-model="outlineVisible" title="AI 生成分章大纲" width="560px">
      <el-form label-width="80px">
        <el-form-item label="小说设定">
          <el-input v-model="outlineForm.setup" type="textarea" :rows="4"
            placeholder="背景、主线、主角目标等。也可留空，使用项目简介" />
        </el-form-item>
        <el-form-item label="章节数">
          <el-input-number v-model="outlineForm.count" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="AI 模型">
          <el-select v-model="outlineForm.model" style="width:100%">
            <el-option v-for="m in models" :key="m.model" :label="`${m.provider} / ${m.model}`" :value="m.model" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="outlineVisible = false">取消</el-button>
        <el-button type="primary" :loading="autoGenerating" @click="doAutoGenerate">生成并创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, MoreFilled, Sort, MagicStick, Document, ArrowLeft } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as db from '@/services/db'
import * as ai from '@/services/ai'
import { Prompts } from '@/services/db'
import type { Chapter } from '@/types'

const router = useRouter()
const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)
const chapters = computed(() => projectStore.chapters)
const selected = ref('')
const dragIndex = ref(-1)
const dragOverIndex = ref(-1)

const models = computed(() => settings.availableModels())

const outlineVisible = ref(false)
const autoGenerating = ref(false)
const outlineForm = ref({ setup: '', count: 10, model: settings.settings?.defaultModel || '' })

onMounted(() => {
  try {
    if (!outlineForm.value.model && models.value.length > 0) {
      outlineForm.value.model = models.value[0].model
    }
  } catch (e) {
    console.error('初始化章节列表失败', e)
  }
})

async function addChapter() {
  const order = projectStore.chapters.length + 1
  const c = await db.Chapters.save({
    projectId: project.value!.id,
    title: `第${order}章`,
    content: '',
    contentType: 'html',
    summary: '',
    status: '草稿',
    order,
    wordCount: 0,
    notes: '',
    createdAt: 0,
    updatedAt: 0
  } as any)
  await projectStore.reloadChapters()
  edit(c)
}

function edit(c: Chapter) {
  router.push({ name: 'editor', params: { chapterId: c.id } })
}

function select(c: Chapter) {
  selected.value = c.id
}

async function saveChapter(c: Chapter) {
  await db.Chapters.save(c)
}

async function changeStatus(c: Chapter, status: string) {
  c.status = status as Chapter['status']
  await db.Chapters.save(c)
}

async function onDragEnd() {
  // 重新编号
  for (let i = 0; i < chapters.value.length; i++) {
    chapters.value[i].order = i + 1
  }
  // 批量保存
  await db.bulkSave('chapters', chapters.value)
}

function onDragStart(index: number) {
  dragIndex.value = index
}

async function onDrop(targetIndex: number) {
  const from = dragIndex.value
  if (from < 0 || from === targetIndex) {
    dragIndex.value = -1
    dragOverIndex.value = -1
    return
  }
  const arr = [...chapters.value]
  const [moved] = arr.splice(from, 1)
  arr.splice(targetIndex, 0, moved)
  projectStore.chapters = arr
  dragIndex.value = -1
  dragOverIndex.value = -1
  await onDragEnd()
}

async function remove(c: Chapter) {
  await ElMessageBox.confirm(`删除《${c.title}》？`, '确认', { type: 'warning' })
  await db.Chapters.remove(c.id)
  await projectStore.reloadChapters()
  ElMessage.success('已删除')
}

async function aiSummary(c: Chapter) {
  const provider = settings.findProviderForModel(project.value!.settings.model)
  if (!provider?.apiKey) { ElMessage.warning('请先在设置中配置 API Key'); return }
  try {
    const prompts = await Prompts.list(project.value!.id)
    const tpl = prompts.find(p => p.category === '摘要')
    if (!tpl) { ElMessage.warning('未找到「摘要」分类的提示词模板，请先在提示词库中创建'); return }
    const msg = { role: 'user' as const, content: ai.renderTemplate(tpl.content, { content: c.content.replace(/<[^>]+>/g, '') }) }
    ElMessage.info('生成中...')
    const text = await ai.chat(ai.buildRequest({
      baseUrl: provider.baseUrl, apiKey: provider.apiKey,
      model: project.value!.settings.model, messages: [msg], temperature: 0.5
    }))
    c.summary = text.trim()
    await db.Chapters.save(c)
    ElMessage.success('摘要已生成')
  } catch (e: any) {
    ElMessage.error('生成失败：' + e.message)
  }
}

function autoGenerate() {
  outlineForm.value.setup = project.value?.description || ''
  outlineVisible.value = true
}

async function doAutoGenerate() {
  const provider = settings.findProviderForModel(outlineForm.value.model)
  if (!provider?.apiKey) { ElMessage.warning('请先在设置中配置 API Key'); return }
  autoGenerating.value = true
  try {
    const prompts = await Prompts.list(project.value!.id)
    const tpl = prompts.find(p => p.category === '大纲')
    if (!tpl) { ElMessage.warning('未找到「大纲」分类的提示词模板，请先在提示词库中创建'); return }
    const setup = outlineForm.value.setup || project.value?.description || ''
    const msg = { role: 'user' as const, content: ai.renderTemplate(tpl.content, {
      genre: project.value!.genre, title: project.value!.title, setup, count: outlineForm.value.count
    }) }
    const text = await ai.chat(ai.buildRequest({
      baseUrl: provider.baseUrl, apiKey: provider.apiKey,
      model: outlineForm.value.model, messages: [msg], temperature: 0.8
    }))
    // 解析大纲，每行/每条创建一章
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && /^[-*\d]/.test(l))
    const startOrder = projectStore.chapters.length + 1
    const newChs: any[] = []
    let idx = 0
    for (const line of lines) {
      if (idx >= outlineForm.value.count) break
      const cleaned = line.replace(/^[-*\d.、]+\s*/, '').replace(/^第.{1,4}章[:：]?\s*/, '')
      const title = cleaned.split(/[:：]/)[0].slice(0, 30) || `第${startOrder + idx}章`
      const summary = cleaned.includes('：') ? cleaned.split(/[:：]/).slice(1).join('：').trim() : cleaned
      newChs.push({
        projectId: project.value!.id,
        title,
        content: '',
        contentType: 'html',
        summary,
        status: '草稿',
        order: startOrder + idx,
        wordCount: 0,
        notes: '',
        createdAt: 0,
        updatedAt: 0
      })
      idx++
    }
    if (newChs.length === 0) {
      ElMessage.warning('未能解析大纲，请手动创建章节')
    } else {
      await db.bulkSave('chapters', newChs)
      await projectStore.reloadChapters()
      ElMessage.success(`已生成 ${newChs.length} 章大纲`)
      outlineVisible.value = false
    }
  } catch (e: any) {
    ElMessage.error('生成失败：' + e.message)
  } finally {
    autoGenerating.value = false
  }
}

function statusType(s: string): any {
  return { '完成': 'success', '已发表': 'primary', '草稿': 'info' }[s] || 'info'
}
function formatTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<style scoped>
.ch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--border);
}
.ch-row:hover { background: var(--panel-2); }
.ch-row.active { background: var(--primary-light); }
.ch-row.drag-over { border-top: 2px solid var(--primary); }
.ch-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}
.drag-handle { color: var(--text-3); cursor: grab; }
.ch-order {
  width: 28px; height: 28px;
  background: var(--panel-2);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600;
  color: var(--text-2);
}
.ch-main { flex: 1; min-width: 0; }
.ch-title-input {
  border: none; background: transparent;
  font-size: 14px; font-weight: 500;
  color: var(--text); outline: none;
  width: 100%; padding: 2px 4px;
  border-radius: 4px;
}
.ch-title-input:focus { background: var(--panel); border: 1px solid var(--primary); }
.ch-meta { display: flex; gap: 10px; align-items: center; margin-top: 4px; }
.ch-actions { display: flex; gap: 4px; }
</style>
