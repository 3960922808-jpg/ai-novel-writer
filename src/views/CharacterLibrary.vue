<template>
  <div class="page character-page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">角色库</h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">维护主要角色、关系网、阵营与当前状态</p>
      </div>
      <div class="flex gap-2 items-center">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-button type="primary" :icon="Check" :loading="saving" @click="save">保存</el-button>
      </div>
    </div>

    <div class="character-layout">
      <section class="editor-panel">
        <el-input
          v-model="content"
          type="textarea"
          :autosize="{ minRows: 20 }"
          placeholder="示例：
- 林澈：主角，当前在云岚城，目标是查清旧案。
- 沈照雪：盟友，擅长阵法，与林澈互相信任。
- 黑羽楼：敌对阵营，正在追查遗失密卷。"
        />
      </section>

      <aside class="tips-panel">
        <h2>建议字段</h2>
        <div class="tip-list">
          <span>角色姓名</span>
          <span>当前位置</span>
          <span>当前目标</span>
          <span>阵营归属</span>
          <span>关系变化</span>
          <span>隐藏秘密</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, Check } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { Truths } from '@/services/db'
import type { TruthFile } from '@/types'

const projectStore = useProjectStore()
const project = computed(() => projectStore.current)
const content = ref('')
const saving = ref(false)
const file = ref<TruthFile | null>(null)

onMounted(load)

async function load() {
  if (!project.value) return
  const files = await Truths.list(project.value.id)
  file.value = files.find(f => f.key === 'character_matrix') || null
  content.value = file.value?.content || ''
}

async function save() {
  if (!project.value) return
  saving.value = true
  try {
    file.value = await Truths.save({
      ...(file.value || {}),
      projectId: project.value.id,
      key: 'character_matrix',
      title: '角色矩阵',
      content: content.value,
      updatedAt: Date.now()
    })
    ElMessage.success('角色库已保存')
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e?.message || e))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.character-page {
  overflow: auto;
}

.character-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
}

.editor-panel {
  min-width: 0;
}

.tips-panel {
  border-left: 1px solid var(--border);
  padding-left: 16px;
}

.tips-panel h2 {
  font-size: 15px;
  margin: 0 0 12px;
}

.tip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tip-list span {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 9px;
  color: var(--text-2);
  font-size: 13px;
}

@media (max-width: 900px) {
  .character-layout {
    grid-template-columns: 1fr;
  }

  .tips-panel {
    border-left: 0;
    padding-left: 0;
  }
}
</style>
