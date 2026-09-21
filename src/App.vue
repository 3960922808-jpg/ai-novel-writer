<template>
  <StartupSplash :ready="appReady" />

  <!-- 自定义背景图层（毛玻璃）：位于所有内容之下，有壁纸时显示 -->
  <div class="app-wallpaper-layer"></div>
  <video
    v-if="backgroundVideoUrl"
    ref="backgroundVideoElement"
    :key="backgroundVideoUrl"
    class="app-video-wallpaper"
    :src="backgroundVideoUrl"
    autoplay muted loop playsinline disablepictureinpicture
    @loadedmetadata="applyVideoPlaybackRate"
    @error="handleBackgroundVideoError"
  ></video>
  <div class="app-wallpaper-overlay"></div>

  <router-view />

  <!-- 发现新版本：软件内下载、完整性校验并自动安装，浏览器下载仅作兜底 -->
  <el-dialog
    v-model="updateDialogVisible"
    width="560px"
    align-center
    class="update-modal"
    :show-close="!downloading"
    :close-on-click-modal="!downloading"
    :close-on-press-escape="!downloading"
  >
    <div class="update-dialog">
      <div class="update-headline">
        <span class="update-icon-wrap"><el-icon class="update-icon"><UploadFilled /></el-icon></span>
        <div>
          <div class="update-title">TrmWrite 有新版本</div>
          <div class="update-subtitle">一键下载并安全升级，无需手动替换文件</div>
        </div>
      </div>
      <div class="update-meta" v-if="updateInfo">
        <el-tag round type="success">{{ updateInfo.version }}</el-tag>
        <span class="update-author">{{ updateInfo.name }}</span>
        <span class="update-size" v-if="updateInfo.downloadSize">
          · {{ (updateInfo.downloadSize / 1024 / 1024).toFixed(1) }} MB
        </span>
      </div>

      <div v-if="!downloading" class="update-feature-grid">
        <div class="update-feature"><span>↓</span><div><b>软件内下载</b><small>显示真实下载进度</small></div></div>
        <div class="update-feature"><span>✓</span><div><b>安全校验</b><small>安装前核对 SHA-256</small></div></div>
        <div class="update-feature"><span>↻</span><div><b>自动升级</b><small>完成后退出并重启</small></div></div>
      </div>

      <div v-else class="update-progress-card" :class="{ 'is-error': !!updateError }">
        <div class="progress-heading">
          <span>{{ updateError ? '更新没有完成' : updateProgress >= 96 ? '正在完成升级' : '正在下载更新' }}</span>
          <b v-if="!updateError">{{ updateProgress }}%</b>
        </div>
        <el-progress
          :percentage="updateProgress"
          :show-text="false"
          :stroke-width="12"
          :status="updateError ? 'exception' : (updateProgress >= 100 ? 'success' : undefined)"
        />
        <div class="progress-status">{{ updateStatus }}</div>
        <div v-if="!updateError" class="progress-note">
          {{ updateProgress >= 96 ? '软件即将自动退出并安装，新版本随后会自动启动。' : '下载期间可以继续写作，请不要关闭软件。' }}
        </div>
      </div>

      <div v-if="updateInfo?.notes && !downloading" class="release-notes">
        <div class="release-notes-title">本次更新</div>
        <pre>{{ updateInfo.notes }}</pre>
      </div>

      <div v-if="updateError" class="update-fallback">
        <span>可重试软件内更新，或使用浏览器下载备用安装包。</span>
        <div class="update-url-block" v-if="downloadUrl">
          <code class="url-text">{{ downloadUrl }}</code>
          <el-button size="small" round :icon="DocumentCopy" @click="copyUrl">复制链接</el-button>
        </div>
      </div>

      <div v-if="!downloading" class="data-safe-tip">更新只替换程序文件，不会删除小说、角色、设定、对话历史或个性化配置。</div>
    </div>

    <template #footer>
      <el-button round :disabled="downloading" @click="updateDialogVisible = false">稍后提醒</el-button>
      <el-button round :disabled="downloading && !updateError" :loading="opening" @click="downloadWithBrowser">
        浏览器下载（备用）
      </el-button>
      <el-button round type="primary" :loading="downloading && !updateError" @click="startInternalUpdate">
        <el-icon v-if="!downloading || updateError" style="margin-right: 5px"><Download /></el-icon>
        {{ updateError ? '重新下载' : downloading ? '正在更新…' : '立即在软件内更新' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { UploadFilled, Download, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import StartupSplash from '@/components/StartupSplash.vue'

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
const downloadUrl = ref('')
const opening = ref(false)
const downloading = ref(false)
const updateProgress = ref(0)
const updateStatus = ref('正在准备更新…')
const updateError = ref('')
const appReady = ref(false)
const backgroundVideoFailed = ref(false)
const backgroundVideoElement = ref<HTMLVideoElement | null>(null)
const backgroundVideoPath = computed(() => {
  if (settings.settings?.backgroundType !== 'video') return ''
  return settings.settings.backgroundVideoPath || ''
})
const backgroundVideoUrl = computed(() => {
  if (!backgroundVideoPath.value || backgroundVideoFailed.value) return ''
  return `trm-media://background/current?rev=${encodeURIComponent(backgroundVideoPath.value)}`
})
const backgroundVideoPlaybackRate = computed(() => settings.settings?.backgroundVideoPlaybackRate ?? 1)

watch(backgroundVideoPath, () => { backgroundVideoFailed.value = false })
watch(backgroundVideoPlaybackRate, rate => {
  if (backgroundVideoElement.value) {
    backgroundVideoElement.value.playbackRate = Math.max(.25, Math.min(2, rate))
  }
})

function applyVideoPlaybackRate(event: Event) {
  const video = event.currentTarget as HTMLVideoElement
  video.playbackRate = Math.max(.25, Math.min(2, settings.settings?.backgroundVideoPlaybackRate ?? 1))
  video.play().catch(() => {})
}

function handleBackgroundVideoError() {
  backgroundVideoFailed.value = true
  const root = document.documentElement
  root.classList.remove('has-video-wallpaper')
  root.style.removeProperty('--bg')
  root.style.removeProperty('--panel')
  root.style.removeProperty('--panel-2')
  console.warn('[App] 背景视频无法播放，已回退为纯色背景')
}

function syncBackgroundVideoVisibility() {
  const video = backgroundVideoElement.value
  if (!video) return
  if (document.hidden) video.pause()
  else video.play().catch(() => {})
}

let unsubUpdate: (() => void) | null = null
let unsubProgress: (() => void) | null = null

onMounted(async () => {
  document.addEventListener('visibilitychange', syncBackgroundVideoVisibility)
  try {
    await settings.load()
    settings.applyTheme()
  } catch (e) {
    console.error('[App] 加载设置失败（可能是 preload 未就绪）:', e)
  } finally {
    appReady.value = true
  }
  try {
    if (window.api?.updater?.onUpdateAvailable) {
      unsubUpdate = window.api.updater.onUpdateAvailable((info: UpdateInfo) => {
        // 多窗口场景下避免重复弹窗
        if (updateDialogVisible.value) return
        updateInfo.value = info
        downloadUrl.value = info.downloadUrl || ''
        downloading.value = false
        updateProgress.value = 0
        updateStatus.value = '正在准备更新…'
        updateError.value = ''
        updateDialogVisible.value = true
      })
    }
    if (window.api?.updater?.onProgress) {
      unsubProgress = window.api.updater.onProgress((progress) => {
        updateDialogVisible.value = true
        updateStatus.value = progress.status || '正在更新…'
        if (progress.percent < 0) {
          downloading.value = false
          updateError.value = progress.status || '下载失败，请重试'
          return
        }
        updateError.value = ''
        downloading.value = true
        updateProgress.value = Math.max(0, Math.min(100, progress.percent))
      })
    }
  } catch (e) {
    console.error('[App] 注册更新监听失败:', e)
  }
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', syncBackgroundVideoVisibility)
  if (unsubUpdate) unsubUpdate()
  if (unsubProgress) unsubProgress()
})

async function startInternalUpdate() {
  if (downloading.value && !updateError.value) return
  downloading.value = true
  updateError.value = ''
  updateProgress.value = 0
  updateStatus.value = '正在连接更新服务器…'
  try {
    const result = await window.api.updater.download()
    if (!result?.success) {
      downloading.value = false
      updateError.value = result?.error || '更新没有完成，请稍后重试'
      updateStatus.value = `下载失败：${updateError.value}`
    }
  } catch (e: any) {
    downloading.value = false
    updateError.value = e?.message || '更新服务暂时不可用'
    updateStatus.value = `下载失败：${updateError.value}`
  }
}

// 软件内更新不可用时，用系统浏览器打开可信的安装包地址。
async function downloadWithBrowser() {
  opening.value = true
  try {
    const r: any = await window.api.updater.downloadWithBrowser()
    if (r?.success) {
      if (r.downloadUrl) downloadUrl.value = r.downloadUrl
      ElMessage.success('已在浏览器中打开安装包，下载完成后请运行安装程序')
    } else {
      ElMessage.error('打开浏览器失败：' + (r?.error || '未知错误'))
    }
  } catch (e: any) {
    ElMessage.error('打开浏览器失败：' + (e?.message || ''))
  } finally {
    opening.value = false
  }
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(downloadUrl.value)
    ElMessage.success('下载链接已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择链接复制')
  }
}
</script>

<style scoped>
.update-dialog {
  padding: 2px 4px 0;
}
.update-headline {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.update-icon-wrap {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: white;
  background: linear-gradient(145deg, var(--el-color-primary-light-3), var(--el-color-primary));
  box-shadow: 0 10px 24px color-mix(in srgb, var(--el-color-primary) 25%, transparent);
}
.update-icon { font-size: 24px; }
.update-title { font-size: 18px; line-height: 1.4; font-weight: 700; color: var(--el-text-color-primary); }
.update-subtitle { margin-top: 3px; font-size: 12px; color: var(--el-text-color-secondary); }
.update-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 14px;
}
.update-author {
  font-weight: 500;
}
.update-size {
  color: var(--el-text-color-secondary);
}
.update-feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-bottom: 14px; }
.update-feature { display: flex; gap: 9px; align-items: center; padding: 11px; border: 1px solid var(--el-border-color-lighter); border-radius: 14px; background: var(--el-fill-color-extra-light); }
.update-feature > span { width: 27px; height: 27px; display: grid; place-items: center; border-radius: 10px; font-weight: 700; color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.update-feature b, .update-feature small { display: block; white-space: nowrap; }
.update-feature b { font-size: 12px; color: var(--el-text-color-primary); }
.update-feature small { margin-top: 2px; font-size: 10px; color: var(--el-text-color-secondary); }
.update-progress-card { padding: 17px; border: 1px solid var(--el-border-color-lighter); border-radius: 16px; background: var(--el-fill-color-extra-light); margin-bottom: 14px; }
.update-progress-card.is-error { border-color: var(--el-color-danger-light-7); }
.progress-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px; font-size: 14px; color: var(--el-text-color-primary); }
.progress-heading b { color: var(--el-color-primary); }
.progress-status { margin-top: 10px; font-size: 12px; color: var(--el-text-color-regular); word-break: break-word; }
.progress-note { margin-top: 5px; font-size: 11px; color: var(--el-text-color-secondary); }
.release-notes { margin-bottom: 14px; padding: 12px 14px; border-radius: 14px; background: var(--el-fill-color-lighter); }
.release-notes-title { margin-bottom: 7px; font-size: 12px; font-weight: 700; color: var(--el-text-color-primary); }
.release-notes pre { max-height: 128px; margin: 0; overflow: auto; white-space: pre-wrap; word-break: break-word; font: inherit; font-size: 12px; line-height: 1.65; color: var(--el-text-color-regular); }
.data-safe-tip { padding: 9px 12px; border-radius: 12px; font-size: 11px; color: var(--el-text-color-secondary); background: color-mix(in srgb, var(--el-color-success) 8%, transparent); }
.update-fallback { margin-top: -4px; margin-bottom: 14px; font-size: 12px; color: var(--el-text-color-secondary); }
.update-url-block {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.url-text {
  flex: 1;
  background: var(--el-fill-color-darker);
  padding: 6px 8px;
  border-radius: 9px;
  font-size: 11px;
  color: var(--el-color-primary);
  word-break: break-all;
  display: block;
  max-height: 60px;
  overflow-y: auto;
}

@media (max-width: 620px) {
  .update-feature-grid { grid-template-columns: 1fr; }
  .update-feature small { white-space: normal; }
}
</style>
