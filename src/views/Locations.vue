<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <h1 class="page-title">地点</h1>
      <el-button type="primary" :icon="Plus" @click="createLocation">新建地点</el-button>
    </div>

    <div v-loading="loading">
      <div v-if="projectStore.locations.length === 0" class="empty card" style="padding: 60px">
        <el-icon class="empty-icon"><Location /></el-icon>
        <p>还没有地点</p>
        <p class="text-faint text-xs">点击右上角「新建地点」开始</p>
      </div>

      <div v-else class="grid grid-3">
        <div v-for="l in projectStore.locations" :key="l.id" class="loc-card card" @click="editLocation(l)">
          <div class="loc-head">
            <el-icon :size="22" class="loc-icon"><Location /></el-icon>
            <div class="loc-name">{{ l.name }}</div>
            <el-tag v-if="l.type" size="small" effect="plain" class="loc-tag">{{ l.type }}</el-tag>
          </div>
          <p class="loc-desc">{{ l.description ? l.description.slice(0, 80) : '暂无描述' }}</p>
          <div class="loc-meta" v-if="l.features || l.culture">
            <span v-if="l.features" class="text-faint text-xs">特色: {{ l.features.slice(0, 30) }}</span>
          </div>
          <div class="loc-actions" @click.stop>
            <el-button text size="small" :icon="Edit" @click="editLocation(l)">编辑</el-button>
            <el-button text size="small" :icon="Delete" @click="removeLocation(l)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑地点' : '新建地点'" width="600px">
      <el-form label-width="80px" v-if="form">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="地点名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%" allow-create filterable placeholder="选择或输入类型">
            <el-option v-for="t in locationTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="地点描述..." />
        </el-form-item>
        <el-form-item label="特色">
          <el-input v-model="form.features" type="textarea" :rows="3" placeholder="地理、建筑、特色..." />
        </el-form-item>
        <el-form-item label="文化">
          <el-input v-model="form.culture" type="textarea" :rows="3" placeholder="风俗、信仰、社会..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveLocation">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Location } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { Locations } from '@/services/db'
import type { Location as LocType } from '@/types'

const projectStore = useProjectStore()
const project = computed(() => projectStore.current)

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const form = ref<Partial<LocType> | null>(null)

const locationTypes = ['城市', '荒野', '建筑', '区域', '其他']

function createLocation() {
  isEdit.value = false
  form.value = {
    projectId: project.value!.id,
    name: '',
    type: '城市',
    description: '',
    features: '',
    culture: ''
  }
  dialogVisible.value = true
}

function editLocation(l: LocType) {
  isEdit.value = true
  form.value = { ...l }
  dialogVisible.value = true
}

async function saveLocation() {
  if (!form.value) return
  if (!form.value.name || !form.value.name.trim()) {
    ElMessage.warning('请填写地点名称')
    return
  }
  saving.value = true
  try {
    const now = Date.now()
    const doc: any = {
      ...form.value,
      projectId: project.value!.id,
      updatedAt: now
    }
    if (!isEdit.value) doc.createdAt = now
    await Locations.save(doc)
    await projectStore.reloadAll()
    ElMessage.success(isEdit.value ? '已保存' : '已创建')
    dialogVisible.value = false
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function removeLocation(l: LocType) {
  try {
    await ElMessageBox.confirm(`删除地点「${l.name}」？此操作不可恢复。`, '确认删除', { type: 'warning' })
  } catch {
    return
  }
  loading.value = true
  try {
    await Locations.remove(l.id)
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
.loc-card {
  padding: 16px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.loc-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
}
.loc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.loc-icon {
  color: var(--primary);
}
.loc-name {
  font-size: 15px;
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.loc-tag {
  margin-left: auto;
}
.loc-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 60px;
}
.loc-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.loc-actions {
  display: flex;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
</style>