import { ipcMain, dialog } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'

const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024
const MAX_NOVEL_BYTES = 25 * 1024 * 1024
const MAX_DOCX_XML_BYTES = 20 * 1024 * 1024
const MAX_SKILL_FILE_BYTES = 2 * 1024 * 1024
const MAX_SKILL_TOTAL_BYTES = 10 * 1024 * 1024
const MAX_SKILL_FILES = 64
const MAX_SKILL_ZIP_BYTES = 20 * 1024 * 1024
const approvedFiles = new Set<string>()
const approvedFolders = new Set<string>()

function pathKey(value: string): string {
  const resolved = path.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

async function approveFile(value: string) {
  approvedFiles.add(pathKey(value))
  try { approvedFiles.add(pathKey(await fs.realpath(value))) } catch {}
}

async function approveFolder(value: string) {
  approvedFolders.add(pathKey(value))
  try { approvedFolders.add(pathKey(await fs.realpath(value))) } catch {}
}

async function requireApprovedFile(value: unknown): Promise<string> {
  if (typeof value !== 'string' || !value) throw new Error('文件路径无效')
  const resolved = path.resolve(value)
  let real = resolved
  try { real = await fs.realpath(resolved) } catch { throw new Error('文件不存在或无法访问') }
  if (!approvedFiles.has(pathKey(resolved)) && !approvedFiles.has(pathKey(real))) {
    throw new Error('只能读取刚刚通过文件选择器授权的文件')
  }
  return real
}

async function requireApprovedFolder(value: unknown): Promise<string> {
  if (typeof value !== 'string' || !value) throw new Error('文件夹路径无效')
  const resolved = path.resolve(value)
  let real = resolved
  try { real = await fs.realpath(resolved) } catch { throw new Error('文件夹不存在或无法访问') }
  if (!approvedFolders.has(pathKey(resolved)) && !approvedFolders.has(pathKey(real))) {
    throw new Error('只能读取刚刚通过文件夹选择器授权的目录')
  }
  return real
}

async function assertFileSize(filePath: string, maxBytes: number, label: string) {
  const stat = await fs.stat(filePath)
  if (!stat.isFile()) throw new Error(`${label}不是普通文件`)
  if (stat.size > maxBytes) throw new Error(`${label}超过 ${(maxBytes / 1024 / 1024).toFixed(0)} MB 限制`)
  return stat
}

export function registerFileIPC() {
  ipcMain.handle('file:select-image', async () => {
    try {
      const r = await dialog.showOpenDialog({
        title: '选择图片',
        properties: ['openFile'],
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
      })
      if (r.canceled || r.filePaths.length === 0) return null
      await approveFile(r.filePaths[0])
      return r.filePaths[0]
    } catch (e: any) {
      throw new Error('选择图片失败：' + e.message)
    }
  })

  ipcMain.handle('file:read-image', async (_e, inputPath: string) => {
    try {
      const filePath = await requireApprovedFile(inputPath)
      await assertFileSize(filePath, MAX_IMAGE_BYTES, '图片')
      const buf = await fs.readFile(filePath)
      const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
      const map: Record<string, string> = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', gif: 'gif' }
      const mime = map[ext] || 'png'
      return `data:image/${mime};base64,${buf.toString('base64')}`
    } catch (e: any) {
      throw new Error('读取图片失败：' + e.message)
    }
  })

  ipcMain.handle('file:select-video', async () => {
    try {
      const r = await dialog.showOpenDialog({
        title: '选择工作台背景视频',
        properties: ['openFile'],
        filters: [{ name: '视频', extensions: ['mp4', 'webm', 'mov', 'm4v', 'ogv'] }]
      })
      if (r.canceled || r.filePaths.length === 0) return null
      const filePath = r.filePaths[0]
      await assertFileSize(filePath, MAX_VIDEO_BYTES, '视频')
      await approveFile(filePath)
      return filePath
    } catch (e: any) {
      throw new Error('选择视频失败：' + e.message)
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
      await Promise.all(r.filePaths.map(approveFile))
      return r.filePaths
    } catch (e: any) {
      throw new Error('选择文件失败：' + e.message)
    }
  })

  // 选择文件夹（用于 skill 导入等场景）
  ipcMain.handle('file:select-folder', async () => {
    try {
      const r = await dialog.showOpenDialog({
        title: '选择文件夹',
        properties: ['openDirectory']
      })
      if (r.canceled || r.filePaths.length === 0) return null
      await approveFolder(r.filePaths[0])
      return r.filePaths[0]
    } catch (e: any) {
      throw new Error('选择文件夹失败：' + e.message)
    }
  })

  ipcMain.handle('file:select-skill-file', async () => {
    try {
      const r = await dialog.showOpenDialog({
        title: '导入技能文件',
        properties: ['openFile'],
        filters: [{ name: '技能文件', extensions: ['md', 'markdown', 'zip'] }]
      })
      if (r.canceled || r.filePaths.length === 0) return null
      await approveFile(r.filePaths[0])
      return r.filePaths[0]
    } catch (e: any) {
      throw new Error('选择技能文件失败：' + e.message)
    }
  })

  // 读取小说文件文本内容
  ipcMain.handle('file:read-novel', async (_e, inputPath: string) => {
    try {
      const filePath = await requireApprovedFile(inputPath)
      const stat = await assertFileSize(filePath, MAX_NOVEL_BYTES, '小说文件')
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
        return { fileName: path.basename(filePath), ext, content: text, size: stat.size }
      }
      if (ext === 'docx') {
        // 解析 docx：使用 mammoth 不现实（依赖大），改用 ZIP 解包 + 简易 XML 解析
        const text = await extractDocxText(filePath)
        return { fileName: path.basename(filePath), ext, content: text, size: stat.size }
      }
      throw new Error('暂不支持的文件格式：' + ext)
    } catch (e: any) {
      throw new Error('读取文件失败：' + e.message)
    }
  })

  ipcMain.handle('file:read-skill-file', async (_e, inputPath: string) => {
    try {
      const filePath = await requireApprovedFile(inputPath)
      await assertFileSize(filePath, MAX_SKILL_ZIP_BYTES, '技能文件')
      const ext = path.extname(filePath).toLowerCase()
      const defaultName = path.basename(filePath, ext)
      const files: SkillSourceFile[] = []

      if (ext === '.md' || ext === '.markdown') {
        const buf = await fs.readFile(filePath)
        files.push({ name: path.basename(filePath), content: await decodeText(buf) })
      } else if (ext === '.zip') {
        const zip = await JSZip.loadAsync(await fs.readFile(filePath), { checkCRC32: true })
        let totalBytes = 0
        const entries = Object.values(zip.files)
          .filter(entry => !entry.dir)
          .filter(entry => ['.md', '.markdown', '.txt', '.json', '.yaml', '.yml'].includes(path.extname(entry.name).toLowerCase()))
          .slice(0, MAX_SKILL_FILES)
        for (const entry of entries) {
          const safeName = entry.name.replace(/\\/g, '/')
          if (safeName.startsWith('/') || safeName.split('/').includes('..')) continue
          const declaredSize = Number((entry as any)._data?.uncompressedSize || 0)
          if (declaredSize > MAX_SKILL_FILE_BYTES) continue
          const buf = await entry.async('nodebuffer')
          totalBytes += buf.length
          if (totalBytes > MAX_SKILL_TOTAL_BYTES) throw new Error('技能包解压后的文本总量超过 10 MB')
          files.push({ name: safeName, content: await decodeText(buf) })
        }
      } else {
        throw new Error('仅支持 Markdown 或 ZIP 技能包')
      }

      if (files.length === 0) throw new Error('技能文件中没有可读取的 Markdown 或文本资料')
      return parseSkillBundle(files, defaultName)
    } catch (e: any) {
      throw new Error('读取技能文件失败：' + e.message)
    }
  })

  // 读取 skill 文件夹，返回结构化数据
  // 支持的文件夹结构：
  //   1) skill/SKILL.md（或 skill.md）—— 整个 markdown 作为 userPrompt
  //   2) skill/prompt.md + skill/system.md（或 system.txt）—— 分离的 system/user
  //   3) skill/config.json + skill/prompt.md —— 配置 + 提示词
  //   4) skill/任意.md —— 找一个 .md 文件作为 userPrompt
  // 返回 { name, description, systemPrompt, userPrompt, files: [{name, content}] }
  ipcMain.handle('file:read-skill-folder', async (_e, inputFolderPath: string) => {
    try {
      const folderPath = await requireApprovedFolder(inputFolderPath)
      const entries = await fs.readdir(folderPath, { withFileTypes: true })
      const files: { name: string; path: string; content: string }[] = []
      let totalBytes = 0
      for (const entry of entries) {
        if (files.length >= MAX_SKILL_FILES) break
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (['.md', '.markdown', '.txt', '.json', '.yaml', '.yml'].includes(ext)) {
            const full = path.join(folderPath, entry.name)
            try {
              const real = await fs.realpath(full)
              const relative = path.relative(folderPath, real)
              if (relative.startsWith('..') || path.isAbsolute(relative)) continue
              const stat = await fs.stat(real)
              if (!stat.isFile() || stat.size > MAX_SKILL_FILE_BYTES) continue
              totalBytes += stat.size
              if (totalBytes > MAX_SKILL_TOTAL_BYTES) throw new Error('技能文件总大小超过 10 MB 限制')
              const buf = await fs.readFile(real)
              let content = buf.toString('utf-8')
              if (content.includes('\uFFFD')) {
                const iconv = await import('iconv-lite').catch(() => null)
                if (iconv) content = iconv.decode(buf, 'gbk')
              }
              files.push({ name: entry.name, path: full, content })
            } catch {
              // 跳过无法读取的文件
            }
          }
        }
      }

      return { ...parseSkillBundle(files, path.basename(folderPath)), folderPath }
    } catch (e: any) {
      throw new Error('读取 skill 文件夹失败：' + e.message)
    }
  })
}

interface SkillSourceFile {
  name: string
  content: string
  path?: string
}

async function decodeText(buf: Buffer): Promise<string> {
  let content = buf.toString('utf-8')
  if (content.includes('\uFFFD')) {
    const iconv = await import('iconv-lite').catch(() => null)
    if (iconv) content = iconv.decode(buf, 'gbk')
  }
  return content
}

function baseName(fileName: string): string {
  return fileName.replace(/\\/g, '/').split('/').pop() || fileName
}

function parseSkillBundle(files: SkillSourceFile[], defaultName: string) {
  let name = defaultName
  let description = ''
  let systemPrompt = ''
  let userPrompt = ''
  let category = '导入'
  let temperature: number | undefined
  let maxTokens: number | undefined
  let recommendedModel = ''
  let tags: string[] = []

  const configFile = files.find(f => /^config\.json$/i.test(baseName(f.name)))
  if (configFile) {
    try {
      const cfg = JSON.parse(configFile.content)
      if (cfg.name) name = String(cfg.name)
      if (cfg.description) description = String(cfg.description)
      if (cfg.category) category = String(cfg.category)
      if (cfg.systemPrompt) systemPrompt = String(cfg.systemPrompt)
      if (cfg.userPrompt) userPrompt = String(cfg.userPrompt)
      if (typeof cfg.temperature === 'number') temperature = cfg.temperature
      if (typeof cfg.maxTokens === 'number') maxTokens = cfg.maxTokens
      if (cfg.recommendedModel) recommendedModel = String(cfg.recommendedModel)
      if (Array.isArray(cfg.tags)) tags = cfg.tags.map(String)
    } catch {
      // 配置损坏时继续尝试 Markdown。
    }
  }

  const skillMd = files.find(f => /^skill\.(md|markdown)$/i.test(baseName(f.name)))
    || (files.length === 1 && /\.(md|markdown)$/i.test(files[0].name) ? files[0] : undefined)
  if (skillMd) {
    const parsed = parseMarkdownWithFrontmatter(skillMd.content)
    if (parsed.frontmatter.name) name = String(parsed.frontmatter.name)
    if (parsed.frontmatter.description) description = String(parsed.frontmatter.description)
    if (parsed.frontmatter.category) category = String(parsed.frontmatter.category)
    if (parsed.frontmatter.tags) {
      tags = Array.isArray(parsed.frontmatter.tags)
        ? parsed.frontmatter.tags.map(String)
        : String(parsed.frontmatter.tags).split(/[,，]/).map(s => s.trim()).filter(Boolean)
    }
    if (parsed.frontmatter.temperature !== undefined) temperature = Number(parsed.frontmatter.temperature)
    if (parsed.frontmatter.maxTokens !== undefined) maxTokens = Number(parsed.frontmatter.maxTokens)
    if (parsed.frontmatter.recommendedModel) recommendedModel = String(parsed.frontmatter.recommendedModel)
    if (parsed.frontmatter.systemPrompt) systemPrompt = String(parsed.frontmatter.systemPrompt)
    if (parsed.frontmatter.userPrompt) userPrompt = String(parsed.frontmatter.userPrompt)
    if (!userPrompt && parsed.body) userPrompt = parsed.body
  }

  if (!systemPrompt) {
    const sysFile = files.find(f => /^system\.(md|markdown|txt)$/i.test(baseName(f.name)))
    if (sysFile) systemPrompt = sysFile.content.trim()
  }
  if (!userPrompt) {
    const promptFile = files.find(f => /^prompt\.(md|markdown|txt)$/i.test(baseName(f.name)))
      || files.find(f => /^user\.(md|markdown|txt)$/i.test(baseName(f.name)))
    if (promptFile) {
      const parsed = parseMarkdownWithFrontmatter(promptFile.content)
      if (parsed.frontmatter.name && !configFile) name = String(parsed.frontmatter.name)
      if (parsed.frontmatter.description && !description) description = String(parsed.frontmatter.description)
      if (parsed.frontmatter.systemPrompt && !systemPrompt) systemPrompt = String(parsed.frontmatter.systemPrompt)
      userPrompt = parsed.body || promptFile.content
    }
  }
  if (!userPrompt) {
    const anyMd = files.find(f => /\.(md|markdown)$/i.test(f.name))
    if (anyMd) userPrompt = parseMarkdownWithFrontmatter(anyMd.content).body || anyMd.content
  }

  const instructionFiles = new Set([configFile?.name, skillMd?.name].filter(Boolean))
  const referenceFiles = files
    .filter(file => !instructionFiles.has(file.name))
    .filter(file => !/^(system|prompt|user)\.(md|markdown|txt)$/i.test(baseName(file.name)))
    .map(file => ({ name: file.name, content: file.content.slice(0, MAX_SKILL_FILE_BYTES) }))

  return {
    name,
    description,
    systemPrompt,
    userPrompt,
    category,
    temperature: Number.isFinite(temperature) ? temperature : undefined,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
    recommendedModel,
    tags: tags.slice(0, 20),
    referenceFiles
  }
}

/** 解析 markdown frontmatter（YAML 头），返回 { frontmatter, body } */
function parseMarkdownWithFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const fm: Record<string, any> = {}
  let body = content
  // 匹配 --- 开头的 YAML frontmatter
  const m = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (m) {
    const yamlBlock = m[1]
    body = m[2] || ''
    // 极简 YAML 解析（只支持 key: value 和 key: [a, b]）
    for (const line of yamlBlock.split('\n')) {
      const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/)
      if (kv) {
        const key = kv[1]
        let val: any = kv[2].trim()
        // 去引号
        if (/^["'].*["']$/.test(val)) val = val.slice(1, -1)
        // 数组
        if (/^\[.*\]$/.test(val)) {
          val = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
        }
        fm[key] = val
      }
    }
  }
  return { frontmatter: fm, body }
}

/** 极简 docx 文本提取：解压 docx（zip），读取 word/document.xml，剥离标签 */
async function extractDocxText(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath)
  const zip = await JSZip.loadAsync(buf, { checkCRC32: true })
  const doc = zip.file('word/document.xml')
  if (!doc) {
    throw new Error('无法解析 docx：未找到 word/document.xml。建议改用 .txt 文件。')
  }
  const declaredSize = Number((doc as any)._data?.uncompressedSize || 0)
  if (declaredSize > MAX_DOCX_XML_BYTES) throw new Error('DOCX 正文解压后超过 20 MB 限制')
  let xml = await doc.async('string')
  if (Buffer.byteLength(xml, 'utf8') > MAX_DOCX_XML_BYTES) throw new Error('DOCX 正文解压后超过 20 MB 限制')
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
