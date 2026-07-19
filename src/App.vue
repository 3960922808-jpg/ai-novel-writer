<template>
  <router-view />

  <!-- 更新进度对话框：进度条走满后显示"下载完成，正在重启"，不可关闭 -->
  <el-dialog
    v-model="updateDialogVisible"
    :title="downloadState === 'done' ? '下载完成' : (downloadState === 'error' ? '更新失败' : '正在更新')"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="downloadState === 'error'"
    align-center
  >
    <div class="update-dialog">
      <!-- 下载进度阶段（含 100% 完成状态） -->
      <template v-if="downloadState === 'downloading' || downloadState === 'done'">
        <div class="update-headline">
          <el-icon class="update-icon is-loading" v-if="downloadPercent < 100"><Loading /></el-icon>
          <el-icon class="update-icon success" v-else><SuccessFilled /></el-icon>
          <span v-if="downloadPercent < 100">发现新版本，正在自动更新...</span>
          <span v-else>下载完成，3 秒后自动重启应用...</span>
        </div>
        <div class="update-meta" v-if="updateInfo">
          <el-tag size="small" type="success">{{ updateInfo.version }}</el-tag>
          <span class="update-author">{{ updateInfo.name }}</span>
        </div>
        <el-progress
          :percentage="downloadPercent"
          :status="downloadPercent >= 100 ? 'success' : ''"
          :stroke-width="10"
          style="margin: 16px 0"
        />
        <div class="update-status text-muted">{{ downloadStatus }}</div>
        <div class="update-tip" v-if="downloadPercent < 100">
          更新将自动下载并覆盖旧版本，无需手动操作，请勿关闭应用
        </div>
        <div class="update-tip success" v-else>
          ✅ 下载成功！3 秒后应用将自动重启进入新版本，请勿关闭窗口
        </div>
      </template>

      <!-- 失败阶段 -->
      <template v-if="downloadState === 'error'">
        <div class="update-headline">
          <el-icon class="update-icon error"><CircleCloseFilled /></el-icon>
          <span>更新失败</span>
        </div>
        <div class="update-message error">{{ downloadStatus }}</div>
        <div class="update-tip">请检查网络连接后重试，或点击"前往发布页"手动下载安装包覆盖旧版本。</div>
      </template>
    </div>

    <template #footer>
      <el-button v-if="downloadState === 'error'" @click="openReleasePage">前往发布页</el-button>
      <el-button v-if="downloadState === 'error'" type="primary" @click="startDownload">重试</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Loading, SuccessFilled, CircleCloseFilled } from '@element-plus/icons-vue'
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

// 下载状态：发现新版本即自动下载，无需用户确认
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
        // 多窗口场景下所有窗口都会收到事件，避免重复触发下载
        if (downloadState.value === 'downloading' || downloadState.value === 'done') return
        updateInfo.value = info
        downloadState.value = 'downloading'
        downloadPercent.value = 0
        downloadStatus.value = '正在准备自动下载...'
        updateDialogVisible.value = true
        // 发现新版本 → 立即自动开始下载，不弹"立即更新"确认框
        startDownload()
      })
    }
    if (window.api?.updater?.onProgress) {
      unsubProgress = window.api.updater.onProgress((p: { percent: number; status: string }) => {
        downloadPercent.value = p.percent < 0 ? 0 : p.percent
        downloadStatus.value = p.status
        if (p.percent < 0) {
          // 下载失败
          downloadState.value = 'error'
        } else if (p.percent >= 100) {
          // 下载完成 → 保持对话框显示"下载完成，正在重启应用..."
          // 后端会自动启动 NSIS 静默安装并退出应用，新版本会自动启动
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

async function startDownload() {
  downloadState.value = 'downloading'
  downloadPercent.value = 0
  downloadStatus.value = '正在准备下载...'
  updateDialogVisible.value = true
  try {
    const r = await window.api.updater.download()
    if (!r.success) {
      downloadState.value = 'error'
      downloadStatus.value = r.error || '下载失败'
    }
    // 成功的话，应用会自动退出并被 NSIS 静默覆盖安装
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
.update-icon.success { color: var(--el-color-success); }
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
.update-tip.success {
  color: var(--el-color-success);
  font-weight: 500;
  font-size: 13px;
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
