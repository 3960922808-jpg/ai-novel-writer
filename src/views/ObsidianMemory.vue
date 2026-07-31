<template>
  <div class="page" v-loading="loading">
    <header class="page-header">
      <div>
        <h1>Obsidian 记忆中心</h1>
        <p class="text-muted">将小说工程映射为 Markdown 知识库，并双向维护长期记忆。</p>
      </div>
      <div class="header-actions">
        <el-button :icon="FolderOpened" @click="chooseVault">选择仓库</el-button>
        <el-button type="primary" :icon="Refresh" :loading="syncing" :disabled="!status.connected" @click="syncAll">
          双向同步
        </el-button>
      </div>
    </header>

    <section class="status-band">
      <div class="status-mark" :class="status.connected ? 'online' : 'offline'">
        <el-icon :size="24"><CircleCheck v-if="status.connected" /><Warning v-else /></el-icon>
      </div>
      <div class="status-copy">
        <strong>{{ status.connected ? '仓库已连接' : '尚未连接 Obsidian' }}</strong>
        <span>{{ status.connected ? status.vaultPath : '选择一个 Obsidian 仓库目录后即可开始同步' }}</span>
      </div>
      <el-tag v-if="status.connected" :type="status.exists ? 'success' : 'info'" effect="plain">
        {{ status.exists ? '项目知识库已创建' : '等待首次同步' }}
      </el-tag>
    </section>

    <section class="workspace-grid">
      <div class="sync-panel">
        <div class="panel-heading">
          <div>
            <h2>同步操作</h2>
            <p>章节与设定以应用数据为准，记忆目录支持从 Obsidian 导回。</p>
          </div>
        </div>
        <div class="action-list">
          <button class="action-row" :disabled="!status.connected || syncing" @click="exportProject">
            <span class="action-icon"><el-icon><Upload /></el-icon></span>
            <span class="action-text"><strong>导出项目知识库</strong><small>生成章节、记忆、世界观、地点和时间线</small></span>
            <el-icon><ArrowRight /></el-icon>
          </button>
          <button class="action-row" :disabled="!status.connected || syncing" @click="importMemory">
            <span class="action-icon"><el-icon><Download /></el-icon></span>
            <span class="action-text"><strong>导入 Obsidian 记忆</strong><small>读取记忆目录并更新应用内真相文件</small></span>
            <el-icon><ArrowRight /></el-icon>
          </button>
          <button class="action-row" :disabled="!status.exists" @click="openProject">
            <span class="action-icon"><el-icon><FolderOpened /></el-icon></span>
            <span class="action-text"><strong>打开项目目录</strong><small>{{ status.projectRoot || '首次同步后可用' }}</small></span>
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
      </div>

      <aside class="activity-panel">
        <h2>最近活动</h2>
        <div v-if="activities.length" class="activity-list">
          <div v-for="item in activities" :key="item.id" class="activity-item">
            <span class="activity-dot" :class="item.type"></span>
            <div><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></div>
            <time>{{ item.time }}</time>
          </div>
        </div>
        <el-empty v-else description="还没有同步记录" :image-size="72" />
      </aside>
    </section>

    <section class="structure-section">
      <h2>知识库结构</h2>
      <div class="folder-grid">
        <div v-for="folder in folders" :key="folder.name" class="folder-item">
          <el-icon :size="20"><Folder /></el-icon>
          <div><strong>{{ folder.name }}</strong><span>{{ folder.description }}</span></div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowRight, CircleCheck, Download, Folder, FolderOpened, Refresh, Upload, Warning } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const loading = ref(true)
const syncing = ref(false)
const status = reactive({ connected: false, vaultPath: '', projectRoot: '', exists: false })
const activities = ref<{ id: number; title: string; detail: string; time: string; type: 'ok' | 'info' }[]>([])
const folders = [
  { name: '章节', description: '正文、摘要与章节索引' },
  { name: '记忆', description: '人物状态、伏笔与剧情事实' },
  { name: '设定', description: '世界规则、组织与物品' },
  { name: '地点', description: '场景、地理与文化信息' },
  { name: '时间线', description: '按故事内时间组织事件' }
]

function projectId() {
  const id = projectStore.current?.id
  if (!id) throw new Error('项目尚未加载')
  return id
}

function record(title: string, detail: string, type: 'ok' | 'info' = 'ok') {
  activities.value.unshift({ id: Date.now(), title, detail, type, time: new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }) })
}

async function refreshStatus() {
  Object.assign(status, await window.api.obsidian.status(projectId()))
}

async function chooseVault() {
  const selected = await window.api.obsidian.chooseVault()
  if (!selected) return
  await refreshStatus()
  record('已连接仓库', selected, 'info')
  ElMessage.success('Obsidian 仓库已连接')
}

async function run(task: () => Promise<any>, success: (result: any) => string, title: string) {
  syncing.value = true
  try {
    const result = await task()
    const detail = success(result)
    record(title, detail)
    await refreshStatus()
    ElMessage.success(detail)
  } catch (error: any) {
    ElMessage.error(error?.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

const exportProject = () => run(
  () => window.api.obsidian.exportProject(projectId()),
  result => `已写入 ${result.count} 个 Markdown 文件`,
  '项目已导出'
)

const importMemory = () => run(
  () => window.api.obsidian.importMemory(projectId()),
  result => `已导入 ${result.imported} 条长期记忆`,
  '记忆已导入'
)

const syncAll = () => run(
  () => window.api.obsidian.syncProject(projectId()),
  result => `导入 ${result.imported} 条记忆，写入 ${result.count} 个文件`,
  '双向同步完成'
)

async function openProject() {
  try { await window.api.obsidian.openProject(projectId()) } catch (error: any) { ElMessage.error(error?.message || '打开目录失败') }
}

onMounted(async () => {
  try { await refreshStatus() } catch (error: any) { ElMessage.error(error?.message || '状态读取失败') } finally { loading.value = false }
})
</script>

<style scoped>
.page { height: 100%; overflow: auto; padding: 28px 32px 40px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
.page-header h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
.page-header p { margin: 7px 0 0; font-size: 13px; }
.header-actions { display: flex; gap: 10px; }
.status-band { min-height: 76px; display: flex; align-items: center; gap: 14px; padding: 14px 18px; border: 1px solid var(--border); background: var(--panel); border-radius: 8px; }
.status-mark { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 8px; }
.status-mark.online { color: #16855b; background: rgba(22, 133, 91, .1); }
.status-mark.offline { color: #b7791f; background: rgba(183, 121, 31, .1); }
.status-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.status-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-3); font-size: 12px; }
.workspace-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(300px, .8fr); gap: 18px; margin-top: 18px; }
.sync-panel, .activity-panel { border: 1px solid var(--border); background: var(--panel); border-radius: 8px; padding: 20px; }
h2 { margin: 0; font-size: 15px; letter-spacing: 0; }
.panel-heading p { margin: 6px 0 16px; color: var(--text-3); font-size: 12px; }
.action-list { border-top: 1px solid var(--border); }
.action-row { width: 100%; min-height: 72px; display: flex; align-items: center; gap: 14px; padding: 12px 4px; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; text-align: left; }
.action-row:last-child { border-bottom: 0; }
.action-row:hover:not(:disabled) { color: var(--primary); }
.action-row:disabled { opacity: .45; cursor: not-allowed; }
.action-icon { width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 7px; background: var(--panel-2); }
.action-text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.action-text small { color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-panel { min-height: 280px; }
.activity-list { margin-top: 18px; }
.activity-item { display: grid; grid-template-columns: 10px 1fr auto; gap: 10px; align-items: start; padding: 10px 0; border-bottom: 1px solid var(--border); }
.activity-dot { width: 7px; height: 7px; margin-top: 5px; border-radius: 50%; background: #16855b; }
.activity-dot.info { background: #4777b8; }
.activity-item div { display: flex; flex-direction: column; gap: 4px; }
.activity-item small, .activity-item time { color: var(--text-3); font-size: 11px; }
.structure-section { margin-top: 18px; padding: 20px 0 0; }
.folder-grid { display: grid; grid-template-columns: repeat(5, minmax(130px, 1fr)); gap: 12px; margin-top: 14px; }
.folder-item { min-height: 84px; display: flex; gap: 12px; align-items: flex-start; padding: 15px; border: 1px solid var(--border); border-radius: 7px; background: var(--panel); }
.folder-item .el-icon { color: var(--primary); flex: 0 0 auto; }
.folder-item div { display: flex; flex-direction: column; gap: 6px; }
.folder-item span { color: var(--text-3); font-size: 11px; line-height: 1.5; }
@media (max-width: 1080px) { .folder-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 760px) { .page { padding: 20px 16px; } .page-header { flex-direction: column; } .workspace-grid { grid-template-columns: 1fr; } .folder-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
