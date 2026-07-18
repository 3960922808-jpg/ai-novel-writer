<template>
  <router-view />

  <el-dialog
    v-model="updateDialogVisible"
    title="发现新版本"
    width="520px"
    :close-on-click-modal="false"
    align-center
  >
    <div class="update-dialog">
      <div class="update-headline">
        <el-icon class="update-icon"><Upload /></el-icon>
        <span>AI 写小说 有新版本可用</span>
      </div>
      <div class="update-meta">
        <el-tag size="small">{{ shaShort }}</el-tag>
        <span class="update-author">{{ updateInfo?.author }}</span>
        <span class="update-date">{{ formatDate(updateInfo?.date) }}</span>
      </div>
      <div class="update-message">{{ firstLine(updateInfo?.message) }}</div>
      <div class="update-tip">
        点击下方按钮前往 GitHub Releases 下载最新版本，覆盖安装即可。
      </div>
    </div>
    <template #footer>
      <el-button @click="updateDialogVisible = false">稍后再说</el-button>
      <el-button type="primary" :icon="Download" @click="openReleases">
        前往下载
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Upload, Download } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

interface UpdateInfo {
  sha: string
  message: string
  author: string
  date: string
  url: string
  releasesUrl: string
}

const updateDialogVisible = ref(false)
const updateInfo = ref<UpdateInfo | null>(null)
const shaShort = computed(() => (updateInfo.value?.sha || '').slice(0, 7))

let unsubUpdate: (() => void) | null = null

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
        updateDialogVisible.value = true
      })
    }
  } catch (e) {
    console.error('[App] 注册更新监听失败:', e)
  }
})

onUnmounted(() => {
  if (unsubUpdate) unsubUpdate()
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

function openReleases() {
  const url = updateInfo.value?.releasesUrl || 'https://github.com/3960922808-jpg/ai-novel-writer/releases/latest'
  window.open(url, '_blank')
  updateDialogVisible.value = false
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
.update-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
</style>
