import { ipcMain, dialog } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

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

  // 选择小说文件（支持多选），用于蒸馏分析
  ipcMain.handle('file:select-novel', async () => {
    try {
      const r = await dialog.showOpenDialog({
        title: '选择小说文件',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: '小说文本', extensions: ['txt', 'md', 'markdown', 'docx'] }
        ]
      })
      if (r.canceled || r.filePaths.length === 0) return []
      return r.filePaths
    } catch (e: any) {
      throw new Error('选择文件失败：' + e.message)
    }
  })

  // 读取小说文件文本内容
  ipcMain.handle('file:read-novel', async (_e, filePath: string) => {
    try {
      const ext = path.extname(filePath).toLowerCase().replace(/^\./, '')
      if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
        const buf = await fs.readFile(filePath)
        let text = ''
        // 简单判断编码：尝试 UTF-8，失败则用 GBK 兜底
        try {
          text = buf.toString('utf-8')
          // 检测是否包含替换字符（即 UTF-8 解码失败）
          if (text.includes('\uFFFD')) {
            const iconv = await import('iconv-lite').catch(() => null)
            if (iconv) text = iconv.decode(buf, 'gbk')
          }
        } catch {
          text = buf.toString('utf-8')
        }
        return { fileName: path.basename(filePath), ext, content: text, size: buf.length }
      }
      if (ext === 'docx') {
        // 解析 docx：使用 mammoth 不现实（依赖大），改用 ZIP 解包 + 简易 XML 解析
        const text = await extractDocxText(filePath)
        return { fileName: path.basename(filePath), ext, content: text, size: text.length }
      }
      throw new Error('暂不支持的文件格式：' + ext)
    } catch (e: any) {
      throw new Error('读取文件失败：' + e.message)
    }
  })
}

/** 极简 docx 文本提取：解压 docx（zip），读取 word/document.xml，剥离标签 */
async function extractDocxText(filePath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  const buf = await readFile(filePath)
  // 直接用 Node 内置 zlib 解析 docx（zip），仅读取 word/document.xml
  // 不引入 mammoth（项目未装），保持零额外依赖
  return parseDocxWithZlib(buf)
}

async function parseDocxWithZlib(buf: Buffer): Promise<string> {
  // 极简 zip central directory 解析（仅用于无依赖的 docx 文本提取）
  // 找到 PK\x03\x04 本地文件头并解压 word/document.xml
  const zlib = await import('node:zlib')
  let offset = 0
  const entries: { name: string; data: Buffer }[] = []
  while (offset < buf.length - 4) {
    if (buf[offset] === 0x50 && buf[offset + 1] === 0x4b && buf[offset + 2] === 0x03 && buf[offset + 3] === 0x04) {
      const nameLen = buf.readUInt16LE(offset + 26)
      const extraLen = buf.readUInt16LE(offset + 28)
      const compMethod = buf.readUInt16LE(offset + 8)
      const compSize = buf.readUInt32LE(offset + 18)
      const dataStart = offset + 30 + nameLen + extraLen
      const name = buf.slice(offset + 30, offset + 30 + nameLen).toString('utf-8')
      const compData = buf.slice(dataStart, dataStart + compSize)
      try {
        let data: Buffer
        if (compMethod === 0) data = compData
        else if (compMethod === 8) data = zlib.inflateRawSync(compData)
        else data = compData
        entries.push({ name, data })
      } catch {
        // skip
      }
      offset = dataStart + compSize
    } else {
      offset++
    }
  }
  const doc = entries.find((e) => e.name === 'word/document.xml')
  if (!doc) {
    throw new Error('无法解析 docx：未找到 word/document.xml。建议改用 .txt 文件。')
  }
  let xml = doc.data.toString('utf-8')
  // 段落换行
  xml = xml.replace(/<\/w:p>/g, '\n')
  // 去标签
  xml = xml.replace(/<[^>]+>/g, '')
  // 解码常见实体
  xml = xml
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
  // 压缩多余空行
  return xml.replace(/\n{3,}/g, '\n\n').trim()
}
