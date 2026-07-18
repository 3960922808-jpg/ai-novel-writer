<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

onMounted(async () => {
  try {
    await settings.load()
    settings.applyTheme()
  } catch (e) {
    console.error('[App] 加载设置失败（可能是 preload 未就绪）:', e)
  }
})
</script>
