import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getDB } from '../lib/db'
import { marked } from 'marked'
import { EPub } from 'epub-gen-memory'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

async function buildProjectData(projectId: string) {
  const db = getDB()
  const project = db.data.projects.find(p => p.id === projectId)
  if (!project) throw new Error('项目不存在')
  const chapters = db.data.chapters
    .filter(c => c.projectId === projectId)
    .sort((a, b) => a.order - b.order)
  return { project, chapters }
}

function htmlToPlain(html: string): string {
  // 简易 HTML 转纯文本
  return html
    .replace(/<p[^>]*>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** HTML 字符转义：用户输入（项目标题/描述/章节标题）拼入导出 HTML 前必须转义，防止存储型 XSS */
function escapeHtml(s: string | undefined | null): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function saveDialog(win: BrowserWindow | null, defaultName: string, ext: string) {
  if (!win) return null as any
  const result = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  })
  return result
}

export function registerExportIPC() {
  // ====== Markdown ======
  ipcMain.handle('export:md', async (e, projectId: string) => {
    const { project, chapters } = await buildProjectData(projectId)
    let md = `# ${project.title}\n\n`
    if (project.description) md += `> ${project.description}\n\n`
    md += `类型：${project.genre}　状态：${project.status}\n\n---\n\n`
    for (const c of chapters) {
      md += `## 第${c.order}章 ${c.title}\n\n`
      const text = c.contentType === 'markdown' ? c.content : htmlToPlain(c.content)
      md += text + '\n\n---\n\n'
    }
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = await saveDialog(win, `${project.title}.md`, 'md')
    if (r.canceled || !r.filePath) return null
    await fs.writeFile(r.filePath, md, 'utf-8')
    return r.filePath
  })

  // ====== HTML ======
  ipcMain.handle('export:html', async (e, projectId: string) => {
    const { project, chapters } = await buildProjectData(projectId)
    // 用户字段先转义，避免存储型 XSS（项目标题/描述/章节标题拼入导出 HTML）
    const safeTitle = escapeHtml(project.title)
    const safeDesc = escapeHtml(project.description)
    let body = `<h1>${safeTitle}</h1>`
    if (project.description) body += `<blockquote>${safeDesc}</blockquote>`
    for (const c of chapters) {
      const safeChapTitle = escapeHtml(c.title)
      body += `<h2>第${c.order}章 ${safeChapTitle}</h2>`
      body += c.contentType === 'html' ? c.content : (marked.parse(c.content) as string)
    }
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${safeTitle}</title>
    <style>body{max-width:760px;margin:40px auto;font-family:"思源宋体",serif;line-height:1.9;padding:0 16px}
    h1{text-align:center}h2{border-bottom:1px solid #ddd;padding-bottom:6px}blockquote{color:#666}</style>
    </head><body>${body}</body></html>`
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = await saveDialog(win, `${project.title}.html`, 'html')
    if (r.canceled || !r.filePath) return null
    await fs.writeFile(r.filePath, html, 'utf-8')
    return r.filePath
  })

  // ====== EPUB ======
  ipcMain.handle('export:epub', async (e, projectId: string) => {
    const { project, chapters } = await buildProjectData(projectId)
    const sections = chapters.map(c => ({
      title: `第${c.order}章 ${c.title}`,
      content: c.contentType === 'html' ? c.content : (marked.parse(c.content) as string)
    }))
    if (sections.length === 0) sections.push({ title: '空', content: '<p>暂无内容</p>' })
    const epub = new EPub(
      {
        title: project.title,
        author: 'TrmWrite',
        description: project.description || ''
      },
      sections
    )
    const buffer = await epub.render()
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = await saveDialog(win, `${project.title}.epub`, 'epub')
    if (r.canceled || !r.filePath) return null
    await fs.writeFile(r.filePath, Buffer.from(buffer as any))
    return r.filePath
  })

  // ====== DOCX ======
  ipcMain.handle('export:docx', async (e, projectId: string) => {
    const { project, chapters } = await buildProjectData(projectId)
    const children: any[] = []
    children.push(new Paragraph({ text: project.title, heading: HeadingLevel.TITLE, alignment: 'center' }))
    if (project.description) {
      children.push(new Paragraph({ text: project.description, alignment: 'center' }))
    }
    children.push(new Paragraph({ text: '' }))
    for (const c of chapters) {
      children.push(new Paragraph({
        text: `第${c.order}章 ${c.title}`,
        heading: HeadingLevel.HEADING_1
      }))
      const text = c.contentType === 'markdown' ? htmlToPlain(marked.parse(c.content) as string) : htmlToPlain(c.content)
      for (const para of text.split(/\n{2,}/)) {
        if (para.trim()) {
          children.push(new Paragraph({
            children: [new TextRun({ text: para.trim(), font: '思源宋体', size: 24 })],
            spacing: { line: 360 }
          }))
        }
      }
      children.push(new Paragraph({ text: '' }))
    }
    const doc = new Document({ sections: [{ properties: {}, children }] })
    const buf = await Packer.toBuffer(doc)
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = await saveDialog(win, `${project.title}.docx`, 'docx')
    if (r.canceled || !r.filePath) return null
    await fs.writeFile(r.filePath, buf)
    return r.filePath
  })

  // ====== PDF（通过浏览器打印） ======
  ipcMain.handle('export:pdf', async (e, projectId: string) => {
    try {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return null
      const data = await buildProjectData(projectId)
      // 用户字段转义，防止 PDF 内嵌可执行脚本
      const safePTitle = escapeHtml(data.project.title)
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safePTitle}</title>
      <style>body{font-family:'Microsoft YaHei',sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.8}
      h1{text-align:center} h2{margin-top:2em;border-bottom:1px solid #ccc;padding-bottom:5px}</style></head>
      <body><h1>${safePTitle}</h1>${data.chapters.map(c => `<h2>${escapeHtml(c.title)}</h2>${c.content}`).join('')}</body></html>`

      const pdfWin = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, sandbox: true }
      })
      try {
        await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
        const pdf = await pdfWin.webContents.printToPDF({ printBackground: false, margins: { top: 0, bottom: 0, left: 0, right: 0 } })
        const r = await saveDialog(win, `${data.project.title}.pdf`, 'pdf')
        if (!r || r.canceled || !r.filePath) return null
        await fs.writeFile(r.filePath, pdf)
        return r.filePath
      } finally {
        // 无论成功失败都销毁，避免隐藏 BrowserWindow 泄漏
        pdfWin.destroy()
      }
    } catch (e: any) {
      console.error('PDF 导出失败', e)
      throw new Error('PDF 导出失败：' + e.message)
    }
  })

  // ====== 通用文件保存 ======
  ipcMain.handle('export:save', async (e, defaultName: string, content: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const ext = path.extname(defaultName).slice(1) || 'txt'
    const r = await saveDialog(win, defaultName, ext)
    if (r.canceled || !r.filePath) return null
    await fs.writeFile(r.filePath, content, 'utf-8')
    return r.filePath
  })
}
