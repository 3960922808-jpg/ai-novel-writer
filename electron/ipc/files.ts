import { ipcMain, dialog } from 'electron'
import fs from 'node:fs/promises'

export function registerFileIPC() {
  ipcMain.handle('file:select-image', async () => {
    const r = await dialog.showOpenDialog({
      title: '选择图片',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    })
    if (r.canceled || r.filePaths.length === 0) return null
    return r.filePaths[0]
  })

  ipcMain.handle('file:read-image', async (_e, filePath: string) => {
    const buf = await fs.readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
    const mime = ext === 'jpg' ? 'jpeg' : ext
    return `data:image/${mime};base64,${buf.toString('base64')}`
  })
}
