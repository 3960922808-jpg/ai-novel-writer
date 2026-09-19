import { ipcMain, safeStorage } from 'electron'
import { getDB, writeDB } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'
import path from 'node:path'

const COLLECTIONS = [
  'chapters', 'locations', 'lore',
  'timeline', 'canvas', 'prompts', 'goals',
  'truths', 'critiques', 'versions',
  'skills', 'styleProfiles', 'messages'
]
const SECRET_PREFIX = 'trmwrite-encrypted:v1:'

function encryptSecret(value: unknown): string {
  const plain = typeof value === 'string' ? value : ''
  if (!plain || plain.startsWith(SECRET_PREFIX) || !safeStorage.isEncryptionAvailable()) return plain
  return SECRET_PREFIX + safeStorage.encryptString(plain).toString('base64')
}

function decryptSecret(value: unknown): string {
  const stored = typeof value === 'string' ? value : ''
  if (!stored.startsWith(SECRET_PREFIX)) return stored
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    return safeStorage.decryptString(Buffer.from(stored.slice(SECRET_PREFIX.length), 'base64'))
  } catch {
    console.error('[settings] 无法解密本机密钥，请重新填写对应 API Key')
    return ''
  }
}

function protectSettingsSecrets(settings: any): any {
  if (!settings || typeof settings !== 'object') return settings
  return {
    ...settings,
    searchApiKey: encryptSecret(settings.searchApiKey),
    apiKeys: Array.isArray(settings.apiKeys)
      ? settings.apiKeys.map((item: any) => ({ ...item, apiKey: encryptSecret(item?.apiKey) }))
      : []
  }
}

function revealSettingsSecrets(settings: any): any {
  if (!settings || typeof settings !== 'object') return settings
  return {
    ...settings,
    searchApiKey: decryptSecret(settings.searchApiKey),
    apiKeys: Array.isArray(settings.apiKeys)
      ? settings.apiKeys.map((item: any) => ({ ...item, apiKey: decryptSecret(item?.apiKey) }))
      : []
  }
}

export function registerStoreIPC() {
  // ====== 项目 ======
  ipcMain.handle('store:projects:list', async () => {
    const db = getDB()
    return [...db.data.projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  })

  ipcMain.handle('store:project:get', async (_e, id: string) => {
    const db = getDB()
    const project = db.data.projects.find(p => p.id === id)
    if (!project) return null
    return project
  })

  ipcMain.handle('store:project:save', async (_e, p: any) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('项目数据格式无效')
    if (typeof p.title !== 'string' || !p.title.trim()) throw new Error('项目标题不能为空')
    const db = getDB()
    p.updatedAt = Date.now()
    if (!p.createdAt) p.createdAt = Date.now()
    const idx = db.data.projects.findIndex(x => x.id === p.id)
    if (idx >= 0) {
      db.data.projects[idx] = { ...db.data.projects[idx], ...p }
    } else {
      if (!p.id) p.id = uuidv4()
      db.data.projects.push(p)
    }
    await writeDB()
    return p
  })

  ipcMain.handle('store:project:delete', async (_e, id: string) => {
    const db = getDB()
    // 防御性检查：projects 或某个 collection 可能未初始化
    if (Array.isArray(db.data.projects)) {
      db.data.projects = db.data.projects.filter(p => p.id !== id)
    }
    // 收集该项目所有 chapterId，用于清理 versions（versions 无 projectId，只有 chapterId）
    const chapterIds = new Set(
      Array.isArray(db.data.chapters)
        ? db.data.chapters.filter(c => c.projectId === id).map(c => c.id)
        : []
    )
    // 级联删除所有关联集合
    for (const c of COLLECTIONS) {
      const arr = (db.data as any)[c]
      if (!Array.isArray(arr)) continue
      if (c === 'versions') {
        // versions 没有 projectId，用 chapterId 关联
        ;(db.data as any)[c] = arr.filter((x: any) => !chapterIds.has(x.chapterId))
      } else if (c === 'critiques') {
        // critiques 有 projectId 和 chapterId，按 projectId 删，再按死引用 chapterId 删
        ;(db.data as any)[c] = arr.filter((x: any) =>
          x.projectId !== id && !chapterIds.has(x.chapterId))
      } else {
        ;(db.data as any)[c] = arr.filter((x: any) => x.projectId !== id)
      }
    }
    await writeDB()
    return true
  })

  // ====== 通用集合 ======
  ipcMain.handle('store:collection:list', async (_e, collection: string, projectId: string) => {
    if (!COLLECTIONS.includes(collection) && collection !== 'projects') return []
    const db = getDB()
    const arr = (db.data as any)[collection] as any[]
    if (!arr) return []
    // 支持全局 + 项目级
    if (collection === 'prompts' || collection === 'skills' || collection === 'styleProfiles') {
      return arr.filter(x => x.projectId === 'global' || x.projectId === projectId)
    }
    return arr.filter(x => x.projectId === projectId)
  })

  ipcMain.handle('store:collection:get', async (_e, collection: string, id: string) => {
    if (!COLLECTIONS.includes(collection) && collection !== 'projects') return null
    const db = getDB()
    const arr = (db.data as any)[collection] as any[]
    return arr?.find(x => x.id === id) || null
  })

  ipcMain.handle('store:collection:save', async (_e, collection: string, doc: any) => {
    if (!COLLECTIONS.includes(collection) && collection !== 'projects') return null
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('保存数据格式无效')
    if (collection === 'messages') {
      if (typeof doc.projectId !== 'string' || !doc.projectId || typeof doc.sessionId !== 'string' || !doc.sessionId) {
        throw new Error('对话所属项目或会话无效')
      }
      if (!['user', 'assistant'].includes(doc.role) || typeof doc.content !== 'string') {
        throw new Error('对话消息格式无效')
      }
      if (doc.content.length > 2_000_000 || (doc.requestContent && String(doc.requestContent).length > 2_000_000)) {
        throw new Error('单条对话消息过大')
      }
      if (doc.linkedItems !== undefined) {
        if (!Array.isArray(doc.linkedItems) || doc.linkedItems.length > 100) throw new Error('关联上下文格式无效')
        doc.linkedItems = doc.linkedItems.map((item: any) => ({
          sourceId: typeof item?.sourceId === 'string' ? item.sourceId.slice(0, 200) : undefined,
          type: typeof item?.type === 'string' ? item.type.slice(0, 50) : undefined,
          label: String(item?.label || '').slice(0, 300),
          content: String(item?.content || '').slice(0, 100_000),
          updatedAt: Number.isFinite(item?.updatedAt) ? item.updatedAt : undefined
        }))
      }
    }
    const db = getDB()
    const arr = (db.data as any)[collection] as any[]
    if (!arr) return null
    doc.updatedAt = Date.now()
    if (!doc.id) doc.id = uuidv4()
    const idx = arr.findIndex(x => x.id === doc.id)
    if (idx >= 0) {
      doc.createdAt = arr[idx].createdAt || doc.createdAt || Date.now()
      arr[idx] = { ...arr[idx], ...doc }
    } else {
      if (!doc.createdAt) doc.createdAt = Date.now()
      arr.push(doc)
    }
    await writeDB()
    return doc
  })

  ipcMain.handle('store:collection:delete', async (_e, collection: string, id: string) => {
    if (!COLLECTIONS.includes(collection) && collection !== 'projects') return false
    const db = getDB()
    const arr = (db.data as any)[collection] as any[]
    if (!arr) return false
    const idx = arr.findIndex(x => x.id === id)
    if (idx >= 0) arr.splice(idx, 1)
    // 删除章节时同步清理版本、评审和该章节的对话，避免孤儿数据长期堆积或重新出现。
    if (collection === 'chapters') {
      db.data.versions = db.data.versions.filter(item => item.chapterId !== id)
      db.data.critiques = db.data.critiques.filter(item => item.chapterId !== id)
      db.data.messages = db.data.messages.filter(item => item.sessionId !== id)
    }
    await writeDB()
    return true
  })

  ipcMain.handle('store:collection:bulkSave', async (_e, collection: string, docs: any[]) => {
    if (!COLLECTIONS.includes(collection) && collection !== 'projects') return []
    if (!Array.isArray(docs)) throw new Error('批量保存数据格式无效')
    if (docs.length > 5000) throw new Error('单次批量保存最多 5000 条记录')
    const db = getDB()
    const arr = (db.data as any)[collection] as any[]
    if (!arr) return []
    for (const doc of docs) {
      doc.updatedAt = Date.now()
      if (!doc.createdAt) doc.createdAt = Date.now()
      if (!doc.id) doc.id = uuidv4()
      const idx = arr.findIndex(x => x.id === doc.id)
      if (idx >= 0) arr[idx] = { ...arr[idx], ...doc }
      else arr.push(doc)
    }
    await writeDB()
    return docs
  })

  // ====== 应用设置 ======
  ipcMain.handle('store:settings:get', async () => {
    const db = getDB()
    if (!db.data.settings) {
      db.data.settings = {
        // v1.4.0+: defaultModel / defaultBaseUrl 已废弃，模型只通过 apiKeys 配置
        // 保留字段为空字符串，仅供老版本读取兼容
        defaultModel: '',
        defaultBaseUrl: '',
        apiKeys: [
          { provider: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '', models: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'] },
          { provider: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', models: ['deepseek-v4-pro', 'deepseek-v4-flash'] },
          { provider: '智谱AI', baseUrl: 'https://api.z.ai/api/paas/v4', apiKey: '', models: ['glm-5.2', 'glm-5.2-air', 'glm-5.2-flash'] },
          { provider: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', apiKey: '', models: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.5'] }
        ],
        theme: 'light',
        fontSize: 16,
        editorFont: '思源宋体, 宋体, serif',
        autoSaveInterval: 30,
        dataDir: '',
        searchProvider: 'duckduckgo',
        searchApiKey: '',
        autoUpdateCheck: true,
        lastCommitSha: '',
        askMode: 'auto',
        themeMode: 'light',
        zoomLevel: 100,
        wallpaper: '',
        wallpaperBlur: 20,
        accentColor: '#5b9bd5',
        wallpaperOpacity: 100,
        wallpaperOverlay: 20,
        panelOpacity: 72,
        wallpaperFit: 'cover',
        wallpaperPosition: 'center',
        backgroundType: 'none',
        backgroundVideoPath: '',
        backgroundVideoMuted: true,
        backgroundVideoPlaybackRate: 1
      }
      await writeDB()
      console.log('[settings] 首次创建默认 settings')
    }
    // v1.4.0：清空老数据中残留的 defaultModel / defaultBaseUrl（用户应通过 API 配置管理）
    if (db.data.settings && (db.data.settings.defaultModel || db.data.settings.defaultBaseUrl)) {
      db.data.settings.defaultModel = ''
      db.data.settings.defaultBaseUrl = ''
      await writeDB()
    }
    // 老数据兼容：补齐新字段，并确保迁移结果真正写入磁盘。
    let settingsChanged = false
    if (db.data.settings && !('searchProvider' in db.data.settings)) {
      db.data.settings.searchProvider = 'duckduckgo'
      db.data.settings.searchApiKey = ''
      settingsChanged = true
    }
    if (db.data.settings && db.data.settings.autoUpdateCheck === undefined) {
      db.data.settings.autoUpdateCheck = true
      db.data.settings.lastCommitSha = ''
      settingsChanged = true
    }
    if (db.data.settings && db.data.settings.zoomLevel === undefined) {
      db.data.settings.zoomLevel = 100
      settingsChanged = true
    }
    if (db.data.settings && db.data.settings.askMode === undefined) {
      db.data.settings.askMode = 'auto'
      settingsChanged = true
    }
    if (db.data.settings && db.data.settings.themeMode === undefined) {
      db.data.settings.themeMode = db.data.settings.theme === 'dark' ? 'dark' : 'light'
      settingsChanged = true
    }
    if (db.data.settings && db.data.settings.wallpaperBlur === undefined) {
      db.data.settings.wallpaperBlur = 20
      settingsChanged = true
    }
    if (db.data.settings && db.data.settings.accentColor === undefined) {
      db.data.settings.accentColor = '#5b9bd5'
      db.data.settings.wallpaperOpacity = 100
      db.data.settings.wallpaperOverlay = 20
      db.data.settings.panelOpacity = 72
      db.data.settings.wallpaperFit = 'cover'
      db.data.settings.wallpaperPosition = 'center'
      settingsChanged = true
    }
    if (db.data.settings && db.data.settings.backgroundType === undefined) {
      db.data.settings.backgroundType = db.data.settings.wallpaper ? 'image' : 'none'
      db.data.settings.backgroundVideoPath = ''
      db.data.settings.backgroundVideoMuted = true
      db.data.settings.backgroundVideoPlaybackRate = 1
      settingsChanged = true
    }
    if (safeStorage.isEncryptionAvailable()) {
      const protectedSettings = protectSettingsSecrets(db.data.settings)
      if (JSON.stringify(protectedSettings) !== JSON.stringify(db.data.settings)) {
        db.data.settings = protectedSettings
        settingsChanged = true
      }
    }
    if (settingsChanged) await writeDB()
    return revealSettingsSecrets(db.data.settings)
  })

  ipcMain.handle('store:settings:save', async (_e, s: any) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('设置数据格式无效')
    const normalized = { ...s }
    const clampAppearanceNumber = (key: string, min: number, max: number) => {
      if (!(key in normalized)) return
      const value = Number(normalized[key])
      if (!Number.isFinite(value)) throw new Error(`${key} 设置无效`)
      normalized[key] = Math.max(min, Math.min(max, Math.round(value)))
    }
    if ('accentColor' in normalized && !/^#[0-9a-fA-F]{6}$/.test(normalized.accentColor)) {
      throw new Error('主题颜色格式无效')
    }
    clampAppearanceNumber('wallpaperBlur', 0, 40)
    clampAppearanceNumber('wallpaperOpacity', 20, 100)
    clampAppearanceNumber('wallpaperOverlay', 0, 90)
    clampAppearanceNumber('panelOpacity', 35, 100)
    if ('wallpaperFit' in normalized && !['cover', 'contain'].includes(normalized.wallpaperFit)) {
      throw new Error('壁纸显示方式无效')
    }
    if ('wallpaperPosition' in normalized && !['top', 'center', 'bottom'].includes(normalized.wallpaperPosition)) {
      throw new Error('壁纸位置无效')
    }
    if ('backgroundType' in normalized && !['none', 'image', 'video'].includes(normalized.backgroundType)) {
      throw new Error('背景类型无效')
    }
    if ('backgroundVideoPath' in normalized) {
      if (typeof normalized.backgroundVideoPath !== 'string' || normalized.backgroundVideoPath.length > 2048) {
        throw new Error('背景视频路径无效')
      }
      if (normalized.backgroundVideoPath && !['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(path.extname(normalized.backgroundVideoPath).toLowerCase())) {
        throw new Error('背景视频格式无效')
      }
    }
    if ('backgroundVideoPlaybackRate' in normalized) {
      const rate = Number(normalized.backgroundVideoPlaybackRate)
      if (!Number.isFinite(rate)) throw new Error('视频播放速度无效')
      normalized.backgroundVideoPlaybackRate = Math.max(0.25, Math.min(2, rate))
    }
    if ('backgroundVideoMuted' in normalized) normalized.backgroundVideoMuted = true
    if ('wallpaper' in normalized) {
      if (typeof normalized.wallpaper !== 'string' || normalized.wallpaper.length > 36 * 1024 * 1024) {
        throw new Error('背景图片数据无效或文件过大')
      }
      if (normalized.wallpaper && !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(normalized.wallpaper)) {
        throw new Error('背景图片格式无效')
      }
    }
    const db = getDB()
    db.data.settings = protectSettingsSecrets({ ...db.data.settings, ...normalized })
    await writeDB()
    return revealSettingsSecrets(db.data.settings)
  })
}
