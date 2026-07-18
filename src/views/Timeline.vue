<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <h1 class="page-title">时间线</h1>
      <div class="flex gap-2 items-center">
        <el-select v-model="filter" placeholder="全部重要程度" style="width: 150px">
          <el-option label="全部" value="" />
          <el-option label="关键" value="关键" />
          <el-option label="重要" value="重要" />
          <el-option label="一般" value="一般" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="addEvent">添加事件</el-button>
      </div>
    </div>

    <div v-if="filteredEvents.length === 0" class="card empty">
      <el-icon class="empty-icon"><Timer /></el-icon>
      <p>还没有时间线事件</p>
      <p class="text-faint text-xs">点击「添加事件」开始记录故事中的关键时刻</p>
    </div>

    <div v-else class="timeline">
      <div v-for="ev in filteredEvents" :key="ev.id" class="tl-item">
        <div class="tl-left">
          <div class="tl-time">{{ ev.time || '未设定' }}</div>
          <div class="tl-dot" :class="importanceClass(ev.importance)"></div>
          <div class="tl-line"></div>
        </div>
        <div class="card tl-card" @click="edit(ev)">
          <div class="tl-card-head">
            <span class="tl-title">{{ ev.title }}</span>
            <el-tag size="small" :type="importanceType(ev.importance)" effect="dark">
              {{ ev.importance }}
            </el-tag>
          </div>
          <p v-if="ev.description" class="tl-desc">{{ ev.description }}</p>
          <div class="tl-meta">
            <span v-if="chapterName(ev.chapterId)" class="tl-chip">
              <el-icon><Document /></el-icon>
              {{ chapterName(ev.chapterId) }}
            </span>
            <span v-for="cid in ev.characterIds" :key="cid" class="tl-chip">
              <el-icon><User /></el-icon>
              {{ characterName(cid) }}
            </span>
            <span class="tl-order text-faint text-xs">#{{ ev.order }}</span>
          </div>
          <div class="tl-actions" @click.stop>
            <el-button text size="small" :icon="Edit" @click="edit(ev)" />
            <el-button text size="small" :icon="Delete" @click="remove(ev)" />
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑事件' : '添加事件'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="时间">
          <el-input v-model="form.time" placeholder="故事内时间，如：第三天傍晚" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="事件标题" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="4" placeholder="事件详细描述" />
        </el-form-item>
        <el-form-item label="关联章节">
          <el-select v-model="form.chapterId" clearable placeholder="选择章节" style="width: 100%">
            <el-option v-for="c in projectStore.chapters" :key="c.id" :label="c.title" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联角色">
          <el-select v-model="form.characterIds" multiple clearable placeholder="选择角色" style="width: 100%">
            <el-option v-for="ch in projectStore.characters" :key="ch.id" :label="ch.name" :value="ch.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="重要程度">
          <el-radio-group v-model="form.importance">
            <el-radio value="关键">关键</el-radio>
            <el-radio value="重要">重要</el-radio>
            <el-radio value="一般">一般</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.order" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Timer, Document, User } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import * as db from '@/services/db'
import type { TimelineEvent, ID } from '@/types'

const projectStore = useProjectStore()
const project = computed(() => projectStore.current)

const events = ref<TimelineEvent[]>([])
const filter = ref('')
const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)

const form = reactive<{
  id?: ID
  time: string
  title: string
  description: string
  chapterId?: ID
  characterIds: ID[]
  importance: TimelineEvent['importance']
  order: number
}>({
  time: '',
  title: '',
  description: '',
  chapterId: undefined,
  characterIds: [],
  importance: '一般',
  order: 1
})

const filteredEvents = computed(() => {
  const arr = filter.value
    ? events.value.filter(e => e.importance === filter.value)
    : [...events.value]
  return arr.sort((a, b) => a.order - b.order)
})

watch(project, (p) => {
  if (p) load()
}, { immediate: true })

async function load() {
  if (!project.value) return
  try {
    events.value = await db.Timeline.list(project.value.id)
  } catch (e: any) {
    ElMessage.error('加载失败：' + e.message)
  }
}

function chapterName(id?: ID) {
  if (!id) return ''
  return projectStore.chapters.find(c => c.id === id)?.title || ''
}

function characterName(id: ID) {
  return projectStore.characters.find(c => c.id === id)?.name || '未知角色'
}

function importanceType(i: TimelineEvent['importance']): any {
  return { '关键': 'danger', '重要': 'warning', '一般': 'primary' }[i]
}

function importanceClass(i: TimelineEvent['importance']) {
  return { '关键': 'dot-danger', '重要': 'dot-warning', '一般': 'dot-primary' }[i]
}

function resetForm() {
  form.id = undefined
  form.time = ''
  form.title = ''
  form.description = ''
  form.chapterId = undefined
  form.characterIds = []
  form.importance = '一般'
  const maxOrder = events.value.length ? Math.max(...events.value.map(e => e.order)) : 0
  form.order = maxOrder + 1
}

function addEvent() {
  resetForm()
  isEdit.value = false
  dialogVisible.value = true
}

function edit(ev: TimelineEvent) {
  isEdit.value = true
  form.id = ev.id
  form.time = ev.time
  form.title = ev.title
  form.description = ev.description
  form.chapterId = ev.chapterId
  form.characterIds = [...ev.characterIds]
  form.importance = ev.importance
  form.order = ev.order
  dialogVisible.value = true
}

async function save() {
  if (!project.value) return
  if (!form.title.trim()) {
    ElMessage.warning('请填写事件标题')
    return
  }
  saving.value = true
  try {
    await db.Timeline.save({
      id: form.id,
      projectId: project.value.id,
      time: form.time,
      title: form.title,
      description: form.description,
      chapterId: form.chapterId,
      characterIds: form.characterIds,
      importance: form.importance,
      order: form.order,
      createdAt: form.id ? (events.value.find(e => e.id === form.id)?.createdAt || Date.now()) : Date.now()
    })
    ElMessage.success(isEdit.value ? '已更新' : '已添加')
    dialogVisible.value = false
    await load()
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function remove(ev: TimelineEvent) {
  try {
    await ElMessageBox.confirm(`删除事件《${ev.title}》？`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await db.Timeline.remove(ev.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    ElMessage.error('删除失败：' + e.message)
  }
}
</script>

<style scoped>
.timeline {
  position: relative;
  padding: 8px 4px;
}
.tl-item {
  display: flex;
  gap: 16px;
  position: relative;
}
.tl-left {
  width: 130px;
  flex-shrink: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-right: 18px;
  padding-top: 14px;
}
.tl-time {
  font-size: 12px;
  color: var(--text-2);
  text-align: right;
  font-weight: 500;
  line-height: 1.4;
  word-break: break-all;
}
.tl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 10px;
  border: 2px solid var(--panel);
  z-index: 1;
  position: relative;
}
.dot-primary { background: var(--primary); box-shadow: 0 0 0 2px var(--primary); }
.dot-warning { background: var(--warning); box-shadow: 0 0 0 2px var(--warning); }
.dot-danger { background: var(--danger); box-shadow: 0 0 0 2px var(--danger); }
.tl-line {
  position: absolute;
  top: 22px;
  right: 5px;
  bottom: -16px;
  width: 2px;
  background: var(--border);
}
.tl-item:last-child .tl-line { display: none; }
.tl-card {
  flex: 1;
  margin-bottom: 16px;
  padding: 14px 16px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  position: relative;
}
.tl-card:hover {
  transform: translateX(2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
}
.tl-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}
.tl-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
}
.tl-desc {
  margin: 4px 0 8px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
.tl-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.tl-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  color: var(--text-2);
}
.tl-order {
  margin-left: auto;
}
.tl-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.tl-card:hover .tl-actions {
  opacity: 1;
}
</style>
