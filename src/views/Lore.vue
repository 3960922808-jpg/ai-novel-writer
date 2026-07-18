<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <h1 class="page-title">世界观设定</h1>
      <div class="flex gap-2">
        <el-select v-model="selectedCategory" placeholder="分类筛选" style="width: 160px" clearable>
          <el-option label="全部分类" value="" />
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="createEntry">新建条目</el-button>
      </div>
    </div>

    <div class="lore-layout" v-loading="loading">
      <div class="cat-list card">
        <div
          class="cat-item"
          :class="{ active: selectedCategory === '' }"
          @click="selectedCategory = ''"
        >
          <el-icon><Collection /></el-icon>
          <span>全部</span>
          <span class="cat-count">{{ projectStore.lore.length }}</span>
        </div>
        <div
          v-for="c in categories"
          :key="c"
          class="cat-item"
          :class="{ active: selectedCategory === c }"
          @click="selectedCategory = c"
        >
          <el-icon><Files /></el-icon>
          <span>{{ c }}</span>
          <span class="cat-count">{{ countByCat(c) }}</span>
        </div>
      </div>

      <div class="entry-list">
        <div v-if="filtered.length === 0" class="empty card" style="padding: 60px">
          <el-icon class="empty-icon"><Collection /></el-icon>
          <p>暂无条目</p>
          <p class="text-faint text-xs">点击「新建条目」开始构建世界观</p>
        </div>
        <div v-else class="grid grid-2">
          <div v-for="e in filtered" :key="e.id" class="entry-card card" @click="editEntry(e)">
            <div class="entry-head">
              <el-tag size="small" effect="plain">{{ e.category }}</el-tag>
              <div class="entry-title">{{ e.title }}</div>
            </div>
            <p class="entry-content">{{ e.content ? e.content.slice(0, 120) : '暂无内容' }}</p>
            <div class="entry-tags" v-if="e.tags && e.tags.length">
              <el-tag v-for="(t, i) in e.tags" :key="i" size="small" type="info">{{ t }}</el-tag>
            </div>
            <div class="entry-actions" @click.stop>
              <el-button text size="small" :icon="Edit" @click="editEntry(e)">编辑</el-button>
              <el-button text size="small" :icon="Delete" @click="removeEntry(e)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑条目' : '新建条目'" width="720px" top="6vh">
      <el-form label-width="80px" v-if="form">
        <el-form-item label="分类">
          <el-select v-model="form.category" style="width: 100%" allow-create filterable placeholder="选择或输入分类">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="条目标题" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="14"
            placeholder="详细设定内容..."
          />
        </el-form-item>
        <el-form-item label="标签">
          <div class="tag-input">
            <el-tag
              v-for="(t, i) in (form.tags || [])"
              :key="i"
              closable
              size="small"
              @close="removeTag(i)"
            >{{ t }}</el-tag>
            <el-input
              v-model="tagInput"
              size="small"
              style="width: 140px"
              placeholder="回车添加"
              @keyup.enter="addTag"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEntry">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Collection, Files } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { Lore } from '@/services/db'
import type { LoreEntry } from '@/types'

const projectStore = useProjectStore()
const project = computed(() => projectStore.current)

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const form = ref<Partial<LoreEntry> | null>(null)
const tagInput = ref('')

const categories = ['力量体系', '历史', '组织', '物品', '种族', '地理', '其他']
const selectedCategory = ref('')

const filtered = computed(() => {
  let list = projectStore.lore
  if (selectedCategory.value) list = list.filter(e => e.category === selectedCategory.value)
  return list
})

function countByCat(c: string) {
  return projectStore.lore.filter(e => e.category === c).length
}

function createEntry() {
  isEdit.value = false
  form.value = {
    projectId: project.value!.id,
    category: selectedCategory.value || '力量体系',
    title: '',
    content: '',
    tags: []
  }
  tagInput.value = ''
  dialogVisible.value = true
}

function editEntry(e: LoreEntry) {
  isEdit.value = true
  form.value = { ...e, tags: [...(e.tags || [])] }
  tagInput.value = ''
  dialogVisible.value = true
}

function addTag() {
  const v = tagInput.value.trim()
  if (v && form.value) {
    if (!form.value.tags) form.value.tags = []
    if (!form.value.tags.includes(v)) form.value.tags.push(v)
    tagInput.value = ''
  }
}

function removeTag(i: number) {
  if (form.value?.tags) form.value.tags.splice(i, 1)
}

async function saveEntry() {
  if (!form.value) return
  if (!form.value.title || !form.value.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (!form.value.category || !form.value.category.trim()) {
    ElMessage.warning('请选择或输入分类')
    return
  }
  saving.value = true
  try {
    const now = Date.now()
    const doc: any = {
      ...form.value,
      projectId: project.value!.id,
      tags: form.value.tags || [],
      updatedAt: now
    }
    if (!isEdit.value) doc.createdAt = now
    await Lore.save(doc)
    await projectStore.reloadAll()
    ElMessage.success(isEdit.value ? '已保存' : '已创建')
    dialogVisible.value = false
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function removeEntry(e: LoreEntry) {
  try {
    await ElMessageBox.confirm(`删除条目「${e.title}」？此操作不可恢复。`, '确认删除', { type: 'warning' })
  } catch {
    return
  }
  loading.value = true
  try {
    await Lore.remove(e.id)
    await projectStore.reloadAll()
    ElMessage.success('已删除')
  } catch (e: any) {
    ElMessage.error('删除失败：' + e.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.lore-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  min-height: calc(100% - 60px);
}
.cat-list {
  padding: 8px;
  height: fit-content;
  position: sticky;
  top: 0;
}
.cat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-2);
  transition: all 0.15s;
}
.cat-item:hover {
  background: var(--panel-2);
  color: var(--text);
}
.cat-item.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
}
.cat-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-3);
}
.cat-item.active .cat-count {
  color: var(--primary);
}
.entry-list {
  min-width: 0;
}
.entry-card {
  padding: 16px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.entry-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
}
.entry-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.entry-title {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-content {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 80px;
}
.entry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.entry-actions {
  display: flex;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  min-height: 32px;
  width: 100%;
}
</style>
