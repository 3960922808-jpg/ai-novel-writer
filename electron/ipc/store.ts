import { ipcMain } from 'electron'
import { getDB } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

const COLLECTIONS = [
  'chapters', 'characters', 'locations', 'lore',
  'timeline', 'canvas', 'prompts', 'goals',
  'truths', 'critiques', 'versions'
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
    db.data.projects = db.data.projects.filter(p => p.id !== id)
    // 级联删除
    for (const c of COLLECTIONS) {
      ;(db.data as any)[c] = (db.data as any)[c].filter((x: any) => x.projectId !== id)
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
    if (collection === 'prompts') {
      // 全局 + 项目级
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
        defaultModel: 'gpt-4o-mini',
        defaultBaseUrl: 'https://api.openai.com/v1',
        apiKeys: [
          { provider: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] },
          { provider: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', models: ['deepseek-chat', 'deepseek-reasoner'] },
          { provider: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: '', models: ['qwen-max', 'qwen-plus', 'qwen-turbo'] },
          { provider: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro'] }
        ],
        theme: 'light',
        fontSize: 16,
        editorFont: '思源宋体, 宋体, serif',
        autoSaveInterval: 30,
        dataDir: ''
      }
      await db.write()
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
