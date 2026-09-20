import { dialog, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { defaultData, getDB, getDBFilePath, writeDB, type DBShape } from '../lib/db'

const MAX_BACKUP_BYTES = 200 * 1024 * 1024
const COLLECTIONS: Array<keyof DBShape> = [
  'projects', 'chapters', 'locations', 'lore', 'timeline', 'canvas',
  'prompts', 'goals', 'truths', 'critiques', 'versions', 'skills',
  'styleProfiles', 'messages'
]

function safeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 80) || 'TrmWrite'
}

function cloneData(includeSecrets: boolean): DBShape {
  const data = JSON.parse(JSON.stringify(getDB().data)) as DBShape
  if (!includeSecrets && data.settings) {
    if (Array.isArray(data.settings.apiKeys)) {
      data.settings.apiKeys = data.settings.apiKeys.map((item: any) => ({ ...item, apiKey: '' }))
    }
    if (data.settings.communityModel) data.settings.communityModel.apiKey = ''
    data.settings.searchApiKey = ''
    if (data.settings.imageGen) {
      data.settings.imageGen.openaiApiKey = ''
      data.settings.imageGen.googleApiKey = ''
    }
  }
  return data
}

function validateBackup(input: any): DBShape {
  const source = input?.app === 'TrmWrite' && input?.data ? input.data : input
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('备份文件结构无效')
  const normalized = JSON.parse(JSON.stringify(defaultData)) as DBShape
  for (const key of COLLECTIONS) {
    if (!Array.isArray(source[key])) throw new Error(`备份缺少数据集合：${String(key)}`)
    ;(normalized as any)[key] = source[key]
  }
  normalized.settings = source.settings && typeof source.settings === 'object' && !Array.isArray(source.settings)
    ? source.settings
    : null
  return normalized
}

export function registerBackupIPC() {
  ipcMain.handle('backup:export', async (_event, includeSecrets = false) => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
    const result = await dialog.showSaveDialog({
      title: '导出 TrmWrite 创作数据备份',
      defaultPath: `${safeFileName(`TrmWrite-创作备份-${stamp}`)}.trmbackup.json`,
      filters: [{ name: 'TrmWrite 备份', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    const payload = {
      app: 'TrmWrite',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      includesSecrets: !!includeSecrets,
      data: cloneData(!!includeSecrets)
    }
    fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { filePath: result.filePath, includesSecrets: !!includeSecrets }
  })

  ipcMain.handle('backup:import', async () => {
    const result = await dialog.showOpenDialog({
      title: '恢复 TrmWrite 创作数据备份',
      properties: ['openFile'],
      filters: [{ name: 'TrmWrite 备份', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    const stat = fs.statSync(filePath)
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_BACKUP_BYTES) throw new Error('备份文件为空或超过 200 MB')
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const restored = validateBackup(parsed)
    const currentPath = getDBFilePath()
    const safetyCopy = `${currentPath}.before-restore-${Date.now()}`
    if (fs.existsSync(currentPath)) fs.copyFileSync(currentPath, safetyCopy)
    getDB().data = restored
    await writeDB()
    return { filePath, safetyCopy, projects: restored.projects.length, chapters: restored.chapters.length }
  })
}
