import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '@/types'
import { getSettings, saveSettings } from '@/services/db'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings | null>(null)
  const loading = ref(false)
  // 跟随系统的媒体查询监听器
  let mqListener: ((e: MediaQueryListEvent) => void) | null = null

  async function load() {
    loading.value = true
    settings.value = await getSettings()
    loading.value = false
    // 加载完成后注册系统主题监听
    setupSystemThemeListener()
  }

  async function update(patch: Partial<AppSettings>) {
    settings.value = await saveSettings(patch)
    applyTheme()
    return settings.value
  }

  /**
   * 应用主题：根据 themeMode（light/dark/auto）切换 html.dark class
   * - light: 强制浅色
   * - dark: 强制深色
   * - auto: 跟随系统 prefers-color-scheme
   */
  function applyTheme() {
    const mode = settings.value?.themeMode || settings.value?.theme || 'light'
    let isDark = false
    if (mode === 'dark') isDark = true
    else if (mode === 'light') isDark = false
    else if (mode === 'auto') {
      isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    }
    document.documentElement.classList.toggle('dark', isDark)
    // 同步 theme 字段（向后兼容旧代码读取 settings.theme）
    if (settings.value) {
      settings.value.theme = isDark ? 'dark' : 'light'
    }
    // 应用字体大小
    if (settings.value) {
      document.documentElement.style.fontSize = `${settings.value.fontSize}px`
    }
    // 应用界面缩放（类似浏览器 Ctrl+加号/减号）
    if (settings.value) {
      const z = settings.value.zoomLevel ?? 100
      // Electron 是 Chromium，document.body.style.zoom 完整支持
      document.body.style.zoom = `${z}%`
    }
  }

  /** 注册系统主题变化监听（仅在 auto 模式生效） */
  function setupSystemThemeListener() {
    if (mqListener) {
      window.matchMedia?.('(prefers-color-scheme: dark)').removeEventListener?.('change', mqListener)
      mqListener = null
    }
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    mqListener = (e: MediaQueryListEvent) => {
      const mode = settings.value?.themeMode || settings.value?.theme || 'light'
      if (mode === 'auto') {
        document.documentElement.classList.toggle('dark', e.matches)
        if (settings.value) settings.value.theme = e.matches ? 'dark' : 'light'
      }
    }
    // addEventListener 在新浏览器，addListener 在老 Safari
    if (mq.addEventListener) mq.addEventListener('change', mqListener)
    else (mq as any).addListener?.(mqListener)
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
