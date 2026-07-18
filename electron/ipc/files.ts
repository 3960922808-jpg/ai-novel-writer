import { ipcMain, dialog } from 'electron'
import fs from 'node:fs/promises'

export function registerFileIPC() {
  ipcMain.handle('file:select-image', async () => {
    try {
      const r = await dialog.showOpenDialog({
        title: '选择图片',
        properties: ['openFile'],
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
      })
      if (r.canceled || r.filePaths.length === 0) return null
      return r.filePaths[0]
    } catch (e: any) {
      throw new Error('选择图片失败：' + e.message)
    }
  })

  ipcMain.handle('file:read-image', async (_e, filePath: string) => {
    try {
      const buf = await fs.readFile(filePath)
      const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
      const map: Record<string, string> = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', gif: 'gif' }
      const mime = map[ext] || 'png'
      return `data:image/${mime};base64,${buf.toString('base64')}`
    } catch (e: any) {
      throw new Error('读取图片失败：' + e.message)
    }
  })
}
