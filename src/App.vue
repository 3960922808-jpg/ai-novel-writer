<template>
  <router-view />

  <el-dialog
    v-model="updateDialogVisible"
    :title="downloadState === 'idle' ? '发现新版本' : (downloadState === 'done' ? '更新完成' : '正在更新')"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="downloadState !== 'downloading'"
    align-center
  >
    <div class="update-dialog">
      <!-- 信息展示阶段 -->
      <template v-if="downloadState === 'idle'">
        <div class="update-headline">
          <el-icon class="update-icon"><Upload /></el-icon>
          <span>AI 写小说 有新版本可用</span>
        </div>
        <div class="update-meta">
          <el-tag size="small" type="success">{{ updateInfo?.version }}</el-tag>
          <span class="update-author">{{ updateInfo?.name }}</span>
          <span class="update-date">{{ formatDate(updateInfo?.date) }}</span>
        </div>
        <div class="update-message">{{ firstLine(updateInfo?.notes) }}</div>
        <el-button
          v-if="updateInfo?.notes && updateInfo.notes.includes('\n')"
          text
          size="small"
          @click="showFullNotes = !showFullNotes"
          style="padding: 0 0 8px"
        >
          {{ showFullNotes ? '收起更新日志' : '展开完整更新日志' }}
        </el-button>
        <div v-if="showFullNotes" class="update-notes-full">{{ updateInfo?.notes }}</div>
        <div class="update-tip">
          <template v-if="updateInfo?.isArchive">
            点击"立即更新"将下载免安装压缩包（{{ formatSize(updateInfo?.downloadSize) }}），下载完成后会自动在资源管理器中显示，请手动解压替换旧版本。
          </template>
          <template v-else>
            点击"立即更新"将自动下载安装包（{{ formatSize(updateInfo?.downloadSize) }}）并启动安装程序。
          </template>
        </div>
      </template>

      <!-- 下载进度阶段 -->
      <template v-if="downloadState === 'downloading'">
        <div class="update-headline">
          <el-icon class="update-icon is-loading" v-if="downloadPercent < 100"><Loading /></el-icon>
          <el-icon class="update-icon" v-else><SuccessFilled /></el-icon>
          <span>{{ downloadPercent >= 100 ? '下载完成，正在启动安装程序...' : '正在下载更新...' }}</span>
        </div>
        <el-progress
          :percentage="downloadPercent"
          :status="downloadPercent >= 100 ? 'success' : ''"
          :stroke-width="10"
          style="margin: 16px 0"
        />
        <div class="update-status text-muted">{{ downloadStatus }}</div>
      </template>

      <!-- 失败阶段 -->
      <template v-if="downloadState === 'error'">
        <div class="update-headline">
          <el-icon class="update-icon error"><CircleCloseFilled /></el-icon>
          <span>更新失败</span>
        </div>
        <div class="update-message error">{{ downloadStatus }}</div>
        <div class="update-tip">请检查网络连接后重试，或稍后再试。也可点击"前往发布页"手动下载。</div>
      </template>
    </div>

    <template #footer>
      <el-button v-if="downloadState === 'idle'" @click="openReleasePage">前往发布页</el-button>
      <el-button v-if="downloadState === 'idle'" @click="updateDialogVisible = false">稍后再说</el-button>
      <el-button v-if="downloadState === 'idle'" type="primary" :icon="Download" @click="startDownload">
        立即更新
      </el-button>
      <el-button v-if="downloadState === 'error'" @click="openReleasePage">前往发布页</el-button>
      <el-button v-if="downloadState === 'error'" @click="updateDialogVisible = false">关闭</el-button>
      <el-button v-if="downloadState === 'error'" type="primary" @click="startDownload">重试</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Upload, Download, Loading, SuccessFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

interface UpdateInfo {
  version: string
  name: string
  notes: string
  date: string
  url: string
  downloadUrl: string
  downloadSize: number
  downloadName: string
  isArchive?: boolean
}

const updateDialogVisible = ref(false)
const updateInfo = ref<UpdateInfo | null>(null)
const showFullNotes = ref(false)

// 下载状态
type DownloadState = 'idle' | 'downloading' | 'error' | 'done'
const downloadState = ref<DownloadState>('idle')
const downloadPercent = ref(0)
const downloadStatus = ref('')

let unsubUpdate: (() => void) | null = null
let unsubProgress: (() => void) | null = null

onMounted(async () => {
  try {
    await settings.load()
    settings.applyTheme()
  } catch (e) {
    console.error('[App] 加载设置失败（可能是 preload 未就绪）:', e)
  }
  try {
    if (window.api?.updater?.onUpdateAvailable) {
      unsubUpdate = window.api.updater.onUpdateAvailable((info: UpdateInfo) => {
        updateInfo.value = info
        downloadState.value = 'idle'
        downloadPercent.value = 0
        downloadStatus.value = ''
        updateDialogVisible.value = true
      })
    }
    if (window.api?.updater?.onProgress) {
      unsubProgress = window.api.updater.onProgress((p: { percent: number; status: string }) => {
        downloadPercent.value = p.percent < 0 ? 0 : p.percent
        downloadStatus.value = p.status
        if (p.percent < 0) {
          downloadState.value = 'error'
        } else if (p.percent >= 100) {
          downloadState.value = 'done'
        } else {
          downloadState.value = 'downloading'
        }
      })
    }
  } catch (e) {
    console.error('[App] 注册更新监听失败:', e)
  }
})

onUnmounted(() => {
  if (unsubUpdate) unsubUpdate()
  if (unsubProgress) unsubProgress()
})

function firstLine(s?: string) {
  return (s || '').split('\n')[0].trim()
}

function formatDate(s?: string) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatSize(bytes?: number) {
  if (!bytes) return '未知'
  const mb = bytes / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

async function startDownload() {
  downloadState.value = 'downloading'
  downloadPercent.value = 0
  downloadStatus.value = '正在准备下载...'
  try {
    const r = await window.api.updater.download()
    if (!r.success) {
      downloadState.value = 'error'
      downloadStatus.value = r.error || '下载失败'
    }
    // 成功的话，应用会自动重启（exe 安装包），或仅显示文件位置（zip 免安装版）
  } catch (e: any) {
    downloadState.value = 'error'
    downloadStatus.value = e?.message || '下载失败'
  }
}

function openReleasePage() {
  const url = updateInfo.value?.url || 'https://github.com/3960922808-jpg/ai-novel-writer/releases'
  window.open(url, '_blank')
}
</script>

<style scoped>
.update-dialog {
  padding: 8px 4px 0;
}
.update-headline {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}
.update-icon {
  color: var(--el-color-primary);
  font-size: 22px;
}
.update-icon.error { color: var(--el-color-danger); }
.update-icon.is-loading { animation: rotate 1.2s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
.update-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 14px;
}
.update-author {
  font-weight: 500;
}
.update-message {
  background: var(--el-fill-color-light);
  padding: 12px 14px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 14px;
  border-left: 3px solid var(--el-color-primary);
}
.update-message.error {
  border-left-color: var(--el-color-danger);
  color: var(--el-color-danger);
}
.update-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.update-notes-full {
  background: var(--el-fill-color-light);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 12px;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  color: var(--el-text-color-regular);
}
.update-status {
  font-size: 12px;
  text-align: center;
  padding: 4px 0;
}
</style>
