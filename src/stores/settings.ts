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
      // 应用界面缩放（使用 Electron 原生 webFrame，避免 CSS zoom 导致 teleported popper 错位）
      if (settings.value) {
        const z = settings.value.zoomLevel ?? 100
        const factor = Math.max(0.1, Math.min(3.0, z / 100))
        // 优先使用原生 webFrame，回退到 CSS zoom
        if (typeof window !== 'undefined' && (window as any).api?.zoom) {
          ;(window as any).api.zoom.set(factor)
        } else {
          document.body.style.zoom = `${z}%`
        }
      }
      // 应用自定义背景图（毛玻璃效果）
      applyWallpaper(isDark)
    }

    /**
     * 应用自定义背景图：
     * - 有壁纸时，背景层显示图片并模糊，同时把 --bg/--panel/--panel-2 覆盖为半透明，
     *   使所有面板自然透出模糊背景，形成毛玻璃质感（既能看清又有点看不清）。
     * - 无壁纸时，恢复为不透明纯色主题。
     */
    function applyWallpaper(isDark: boolean) {
      const root = document.documentElement
      const wp = settings.value?.wallpaper
      const blur = settings.value?.wallpaperBlur ?? 20
      if (wp) {
        root.style.setProperty('--app-wallpaper', `url("${wp}")`)
        root.style.setProperty('--app-wallpaper-blur', `${blur}px`)
        root.classList.add('has-wallpaper')
        // 覆盖为半透明，让面板透出模糊背景
        if (isDark) {
          root.style.setProperty('--bg', 'rgba(15, 23, 42, 0.55)')
          root.style.setProperty('--panel', 'rgba(30, 41, 59, 0.65)')
          root.style.setProperty('--panel-2', 'rgba(51, 65, 85, 0.7)')
        } else {
          root.style.setProperty('--bg', 'rgba(255, 255, 255, 0.5)')
          root.style.setProperty('--panel', 'rgba(255, 255, 255, 0.65)')
          root.style.setProperty('--panel-2', 'rgba(241, 245, 249, 0.72)')
        }
      } else {
        root.style.setProperty('--app-wallpaper', 'none')
        root.style.removeProperty('--app-wallpaper-blur')
        root.classList.remove('has-wallpaper')
        root.style.removeProperty('--bg')
        root.style.removeProperty('--panel')
        root.style.removeProperty('--panel-2')
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

  /** 所有可用模型（已配置 Key 的） */
  function availableModels(): { provider: string; model: string }[] {
    if (!settings.value || !Array.isArray(settings.value.apiKeys)) return []
    const r: { provider: string; model: string }[] = []
    for (const p of settings.value.apiKeys) {
      if (p && p.apiKey) {
        for (const m of p.models) r.push({ provider: p.provider, model: m })
      }
    }
    return r
  }

  /** 默认模型：取 API 配置中第一个可用模型（不再允许手动指定） */
  function defaultModel(): string {
    const m = availableModels()[0]
    return m?.model || ''
  }

  /** 默认 provider：取第一个配置了 apiKey 的 provider */
  function defaultProvider(): { provider: string; baseUrl: string; apiKey: string } | null {
    if (!settings.value || !Array.isArray(settings.value.apiKeys)) return null
    for (const p of settings.value.apiKeys) {
      if (p && p.apiKey && Array.isArray(p.models) && p.models.length > 0) {
        return { provider: p.provider, baseUrl: p.baseUrl, apiKey: p.apiKey }
      }
    }
    return null
  }

  /** 根据模型名查找对应 API 配置 */
  function findProviderForModel(model: string): { baseUrl: string; apiKey: string } | null {
    if (!settings.value || !Array.isArray(settings.value.apiKeys)) return null
    for (const p of settings.value.apiKeys) {
      if (Array.isArray(p.models) && p.models.includes(model) && p.apiKey) {
        return { baseUrl: p.baseUrl, apiKey: p.apiKey }
      }
    }
    // 回退到默认 provider（第一个配置了 apiKey 的）
    const def = defaultProvider()
    if (def) return { baseUrl: def.baseUrl, apiKey: def.apiKey }
    return null
  }

  return {
    settings, loading, load, update, applyTheme,
    findProviderForModel, availableModels,
    defaultModel, defaultProvider
  }
})
