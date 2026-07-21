import { ipcMain } from 'electron'
import { getDB } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

const COLLECTIONS = [
  'chapters', 'locations', 'lore',
  'timeline', 'canvas', 'prompts', 'goals',
  'truths', 'critiques', 'versions',
  'skills', 'styleProfiles'
]

export function registerStoreIPC() {
  // ====== 项目 ======
  ipcMain.handle('store:projects:list', async () => {
    const db = getDB()
    return db.data.projects.sort((a, b) => b.updatedAt - a.updatedAt)
  })

  ipcMain.handle('store:project:get', async (_e, id: string) => {
    const db = getDB()
    const project = db.data.projects.find(p => p.id === id)
    if (!project) return null
    return project
  })

  ipcMain.handle('store:project:save', async (_e, p: any) => {
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
    await db.write()
    return p
  })

  ipcMain.handle('store:project:delete', async (_e, id: string) => {
    const db = getDB()
    // 防御性检查：projects 或某个 collection 可能未初始化
    if (Array.isArray(db.data.projects)) {
      db.data.projects = db.data.projects.filter(p => p.id !== id)
    }
    // 级联删除所有关联集合
    for (const c of COLLECTIONS) {
      const arr = (db.data as any)[c]
      if (Array.isArray(arr)) {
        ;(db.data as any)[c] = arr.filter((x: any) => x.projectId !== id)
      }
    }
    await db.write()
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
    const db = getDB()
    const arr = (db.data as any)[collection] as any[]
    return arr?.find(x => x.id === id) || null
  })

  ipcMain.handle('store:collection:save', async (_e, collection: string, doc: any) => {
    const db = getDB()
    const arr = (db.data as any)[collection] as any[]
    if (!arr) return null
    doc.updatedAt = Date.now()
    if (!doc.createdAt) doc.createdAt = Date.now()
    if (!doc.id) doc.id = uuidv4()
    const idx = arr.findIndex(x => x.id === doc.id)
    if (idx >= 0) arr[idx] = { ...arr[idx], ...doc }
    else arr.push(doc)
    await db.write()
    return doc
  })

  ipcMain.handle('store:collection:delete', async (_e, collection: string, id: string) => {
    const db = getDB()
    const arr = (db.data as any)[collection] as any[]
    if (!arr) return false
    const idx = arr.findIndex(x => x.id === id)
    if (idx >= 0) arr.splice(idx, 1)
    await db.write()
    return true
  })

  ipcMain.handle('store:collection:bulkSave', async (_e, collection: string, docs: any[]) => {
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
    await db.write()
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
        zoomLevel: 100
      }
      await db.write()
      console.log('[settings] 首次创建默认 settings')
    }
    // v1.4.0：清空老数据中残留的 defaultModel / defaultBaseUrl（用户应通过 API 配置管理）
    if (db.data.settings && (db.data.settings.defaultModel || db.data.settings.defaultBaseUrl)) {
      db.data.settings.defaultModel = ''
      db.data.settings.defaultBaseUrl = ''
      await db.write()
    }
    // 老数据兼容：补齐新字段
    if (db.data.settings && !('searchProvider' in db.data.settings)) {
      db.data.settings.searchProvider = 'duckduckgo'
      db.data.settings.searchApiKey = ''
    }
    if (db.data.settings && db.data.settings.autoUpdateCheck === undefined) {
      db.data.settings.autoUpdateCheck = true
      db.data.settings.lastCommitSha = ''
    }
    if (db.data.settings && db.data.settings.zoomLevel === undefined) {
      db.data.settings.zoomLevel = 100
    }
    if (db.data.settings) {
      if (!('searchProvider' in db.data.settings) || db.data.settings.autoUpdateCheck === undefined || db.data.settings.zoomLevel === undefined) {
        await db.write()
      }
    }
    return db.data.settings
  })

  ipcMain.handle('store:settings:save', async (_e, s: any) => {
    const db = getDB()
    db.data.settings = { ...db.data.settings, ...s }
    await db.write()
    return db.data.settings
  })
}
