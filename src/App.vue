<template>
  <router-view />

  <!-- 发现新版本对话框：提供"用浏览器下载"按钮，让用户用浏览器/IDM/迅雷下载 -->
  <el-dialog
    v-model="updateDialogVisible"
    title="发现新版本"
    width="540px"
    align-center
  >
    <div class="update-dialog">
      <div class="update-headline">
        <el-icon class="update-icon"><UploadFilled /></el-icon>
        <span>发现新版本 {{ updateInfo?.version }}</span>
      </div>
      <div class="update-meta" v-if="updateInfo">
        <el-tag size="small" type="success">{{ updateInfo.version }}</el-tag>
        <span class="update-author">{{ updateInfo.name }}</span>
        <span class="update-size" v-if="updateInfo.downloadSize">
          · {{ (updateInfo.downloadSize / 1024 / 1024).toFixed(1) }} MB
        </span>
      </div>

      <div class="update-tip-block">
        <div class="update-tip-row">📦 安装包：<code>{{ updateInfo?.downloadName || 'AI-Novel-Writer-Setup.exe' }}</code></div>
        <div class="update-tip-row">⬇ 大小：{{ updateInfo?.downloadSize ? (updateInfo.downloadSize / 1024 / 1024).toFixed(1) + ' MB' : '未知' }}</div>
      </div>

      <div class="update-steps">
        <div class="steps-title">更新步骤：</div>
        <ol>
          <li>点击下方"用浏览器下载安装包"按钮</li>
          <li>浏览器（或 IDM/迅雷等下载工具）会自动开始下载，速度更快</li>
          <li>下载完成后，双击运行下载的 Setup.exe</li>
          <li>安装程序会自动覆盖旧版本并启动新版本</li>
        </ol>
      </div>

      <div class="update-url-block" v-if="downloadUrl">
        <div class="url-label">下载链接（可复制到下载工具）：</div>
        <div class="url-row">
          <code class="url-text">{{ downloadUrl }}</code>
          <el-button size="small" :icon="DocumentCopy" @click="copyUrl">复制</el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="updateDialogVisible = false">稍后再说</el-button>
      <el-button @click="openReleasePage">打开发布页</el-button>
      <el-button type="primary" :loading="opening" @click="downloadWithBrowser">
        <el-icon style="margin-right: 4px"><Download /></el-icon>
        用浏览器下载安装包
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { UploadFilled, Download, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
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
const downloadUrl = ref('')
const opening = ref(false)

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
        // 多窗口场景下避免重复弹窗
        if (updateDialogVisible.value) return
        updateInfo.value = info
        downloadUrl.value = info.downloadUrl || ''
        updateDialogVisible.value = true
      })
    }
    // 保留 progress 监听以兼容旧逻辑（实际不再使用）
    if (window.api?.updater?.onProgress) {
      unsubProgress = window.api.updater.onProgress(() => {
        // no-op：已改用浏览器下载，软件内下载进度不再使用
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

// 用系统浏览器打开下载链接（推荐方式：速度快，支持 IDM/迅雷等下载工具）
async function downloadWithBrowser() {
  opening.value = true
  try {
    const r: any = await window.api.updater.downloadWithBrowser()
    if (r?.success) {
      if (r.downloadUrl) downloadUrl.value = r.downloadUrl
      ElMessage.success('已打开浏览器开始下载，下载完成后请运行 Setup.exe')
      // 不关闭对话框，让用户能看到下载链接和步骤说明
    } else {
      ElMessage.error('打开浏览器失败：' + (r?.error || '未知错误'))
    }
  } catch (e: any) {
    ElMessage.error('打开浏览器失败：' + (e?.message || ''))
  } finally {
    opening.value = false
  }
}

function openReleasePage() {
  const url = updateInfo.value?.url || 'https://github.com/3960922808-jpg/ai-novel-writer/releases'
  window.open(url, '_blank')
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(downloadUrl.value)
    ElMessage.success('下载链接已复制，可粘贴到 IDM/迅雷等下载工具')
  } catch {
    ElMessage.warning('复制失败，请手动选择链接复制')
  }
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
.update-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 16px;
}
.update-author {
  font-weight: 500;
}
.update-size {
  color: var(--el-text-color-secondary);
}
.update-tip-block {
  background: var(--el-fill-color-light);
  padding: 12px 14px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.8;
  margin-bottom: 14px;
  border-left: 3px solid var(--el-color-primary);
}
.update-tip-row {
  color: var(--el-text-color-regular);
}
.update-tip-row code {
  background: var(--el-fill-color-darker);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: var(--el-color-primary);
}
.update-steps {
  background: var(--el-fill-color-lighter);
  padding: 12px 14px 12px 14px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  margin-bottom: 14px;
}
.steps-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
}
.update-steps ol {
  margin: 0;
  padding-left: 22px;
  color: var(--el-text-color-regular);
}
.update-steps li {
  margin-bottom: 2px;
}
.update-url-block {
  background: var(--el-fill-color-light);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
}
.url-label {
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.url-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.url-text {
  flex: 1;
  background: var(--el-fill-color-darker);
  padding: 6px 8px;
  border-radius: 3px;
  font-size: 11px;
  color: var(--el-color-primary);
  word-break: break-all;
  display: block;
  max-height: 60px;
  overflow-y: auto;
}
</style>
