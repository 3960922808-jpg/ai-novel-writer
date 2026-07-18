import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '@/types'
import { getSettings, saveSettings } from '@/services/db'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings | null>(null)
  const loading = ref(false)

  async function load() {
    loading.value = true
    settings.value = await getSettings()
    loading.value = false
  }

  async function update(patch: Partial<AppSettings>) {
    settings.value = await saveSettings(patch)
    applyTheme()
    return settings.value
  }

  function applyTheme() {
    const theme = settings.value?.theme || 'light'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    if (settings.value) {
      document.documentElement.style.fontSize = `${settings.value.fontSize}px`
    }
  }

  /** 根据模型名查找对应 API 配置 */
  function findProviderForModel(model: string): { baseUrl: string; apiKey: string } | null {
    if (!settings.value) return null
    for (const p of settings.value.apiKeys) {
      if (p.models.includes(model) && p.apiKey) {
        return { baseUrl: p.baseUrl, apiKey: p.apiKey }
      }
    }
    // 回退到默认
    return {
      baseUrl: settings.value.defaultBaseUrl,
      apiKey: settings.value.apiKeys.find(p => p.baseUrl === settings.value!.defaultBaseUrl)?.apiKey || ''
    }
  }

  /** 所有可用模型（已配置 Key 的） */
  function availableModels(): { provider: string; model: string }[] {
    if (!settings.value) return []
    const r: { provider: string; model: string }[] = []
    for (const p of settings.value.apiKeys) {
      if (p.apiKey) {
        for (const m of p.models) r.push({ provider: p.provider, model: m })
      }
    }
    return r
  }

  return { settings, loading, load, update, applyTheme, findProviderForModel, availableModels }
})
