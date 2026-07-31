import { dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getDB } from '../lib/db'

const ROOT_FOLDER = 'TrmWrite'

function safeName(value: string, fallback = '未命名'): string {
  const cleaned = String(value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim()
  return (cleaned || fallback).slice(0, 80)
}

function plainText(value: string): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function quoteYaml(value: unknown): string {
  return JSON.stringify(String(value ?? ''))
}

function note(frontmatter: Record<string, unknown>, body: string): string {
  const fields = Object.entries(frontmatter).map(([key, value]) => `${key}: ${quoteYaml(value)}`).join('\n')
  return `---\n${fields}\n---\n\n${body.trim()}\n`
}

function parseNote(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: content.trim() }
  const meta: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([\w-]+):\s*(.*)$/)
    if (!item) continue
    try { meta[item[1]] = JSON.parse(item[2]) } catch { meta[item[1]] = item[2].replace(/^['"]|['"]$/g, '') }
  }
  return { meta, body: match[2].trim() }
}

async function writeNote(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.tmp`
  await fs.writeFile(temp, content, 'utf8')
  await fs.rename(temp, filePath).catch(async () => {
    await fs.rm(filePath, { force: true })
    await fs.rename(temp, filePath)
  })
}

function getVaultPath(): string {
  const settings: any = getDB().data.settings || {}
  return String(settings.obsidianVaultPath || '')
}

function getProjectRoot(vaultPath: string, project: any): string {
  return path.join(vaultPath, ROOT_FOLDER, `${safeName(project.title)}-${String(project.id).slice(0, 8)}`)
}

async function validateVault(vaultPath: string): Promise<void> {
  if (!vaultPath) throw new Error('请先选择 Obsidian 仓库目录')
  const stat = await fs.stat(vaultPath).catch(() => null)
  if (!stat?.isDirectory()) throw new Error('Obsidian 仓库目录不存在或不可访问')
}

async function exportProject(projectId: string) {
  const db = getDB()
  const project = db.data.projects.find((item: any) => item.id === projectId)
  if (!project) throw new Error('项目不存在')
  const vaultPath = getVaultPath()
  await validateVault(vaultPath)
  const root = getProjectRoot(vaultPath, project)
  let count = 0

  const chapters = db.data.chapters.filter((item: any) => item.projectId === projectId).sort((a: any, b: any) => a.order - b.order)
  const truths = db.data.truths.filter((item: any) => item.projectId === projectId)
  const lore = db.data.lore.filter((item: any) => item.projectId === projectId)
  const locations = db.data.locations.filter((item: any) => item.projectId === projectId)
  const timeline = db.data.timeline.filter((item: any) => item.projectId === projectId).sort((a: any, b: any) => a.order - b.order)

  const index = [
    `# ${project.title}`,
    '',
    project.description || '',
    '',
    '## 创作导航',
    '',
    '- [[章节/章节索引|章节]]',
    '- [[记忆/记忆索引|长期记忆]]',
    '- [[设定/世界观索引|世界观]]',
    '- [[地点/地点索引|地点]]',
    '- [[时间线|时间线]]',
    '',
    `> 由 TrmWrite 同步于 ${new Date().toLocaleString('zh-CN', { hour12: false })}`
  ].join('\n')
  await writeNote(path.join(root, '项目主页.md'), note({ 'trmwrite-type': 'project', 'trmwrite-id': project.id }, index)); count++

  const chapterLinks: string[] = ['# 章节索引', '']
  for (const chapter of chapters) {
    const file = `${String(chapter.order + 1).padStart(4, '0')}-${safeName(chapter.title)}.md`
    chapterLinks.push(`- [[${file.replace(/\.md$/, '')}|${chapter.title}]] · ${chapter.wordCount || 0} 字`)
    await writeNote(path.join(root, '章节', file), note({
      'trmwrite-type': 'chapter', 'trmwrite-id': chapter.id, order: chapter.order, status: chapter.status
    }, `# ${chapter.title}\n\n${plainText(chapter.content)}\n\n## 章节摘要\n\n${chapter.summary || '暂无摘要'}`)); count++
  }
  await writeNote(path.join(root, '章节', '章节索引.md'), chapterLinks.join('\n')); count++

  const memoryLinks: string[] = ['# 长期记忆', '', '> 此目录支持双向同步。在 Obsidian 中修改正文后，可回到 TrmWrite 导入。', '']
  for (const truth of truths) {
    const file = `${safeName(truth.title)}-${safeName(truth.key)}.md`
    memoryLinks.push(`- [[${file.replace(/\.md$/, '')}|${truth.title}]]`)
    await writeNote(path.join(root, '记忆', file), note({
      'trmwrite-type': 'memory', 'trmwrite-id': truth.id, 'trmwrite-key': truth.key, 'trmwrite-project': projectId
    }, `# ${truth.title}\n\n${truth.content || ''}`)); count++
  }
  await writeNote(path.join(root, '记忆', '记忆索引.md'), memoryLinks.join('\n')); count++

  const loreLinks: string[] = ['# 世界观索引', '']
  for (const item of lore) {
    const file = `${safeName(item.category)}-${safeName(item.title)}.md`
    loreLinks.push(`- [[${file.replace(/\.md$/, '')}|${item.title}]]`)
    await writeNote(path.join(root, '设定', file), note({ 'trmwrite-type': 'lore', 'trmwrite-id': item.id, category: item.category }, `# ${item.title}\n\n${item.content || ''}`)); count++
  }
  await writeNote(path.join(root, '设定', '世界观索引.md'), loreLinks.join('\n')); count++

  const locationLinks: string[] = ['# 地点索引', '']
  for (const item of locations) {
    const file = `${safeName(item.name)}.md`
    locationLinks.push(`- [[${file.replace(/\.md$/, '')}|${item.name}]]`)
    await writeNote(path.join(root, '地点', file), note({ 'trmwrite-type': 'location', 'trmwrite-id': item.id, type: item.type }, `# ${item.name}\n\n${item.description || ''}\n\n## 特征\n\n${item.features || ''}\n\n## 文化\n\n${item.culture || ''}`)); count++
  }
  await writeNote(path.join(root, '地点', '地点索引.md'), locationLinks.join('\n')); count++

  const timelineBody = ['# 时间线', '', ...timeline.map((item: any) => `## ${item.time || '未定时间'} · ${item.title}\n\n${item.description || ''}`)].join('\n')
  await writeNote(path.join(root, '时间线.md'), note({ 'trmwrite-type': 'timeline', 'trmwrite-project': projectId }, timelineBody)); count++

  return { root, count, exportedAt: Date.now() }
}

async function importMemory(projectId: string) {
  const db = getDB()
  const project = db.data.projects.find((item: any) => item.id === projectId)
  if (!project) throw new Error('项目不存在')
  const vaultPath = getVaultPath()
  await validateVault(vaultPath)
  const folder = path.join(getProjectRoot(vaultPath, project), '记忆')
  const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => [])
  let imported = 0
  let skipped = 0
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md' || entry.name === '记忆索引.md') continue
    const content = await fs.readFile(path.join(folder, entry.name), 'utf8')
    const parsed = parseNote(content)
    if (parsed.meta['trmwrite-type'] !== 'memory') { skipped++; continue }
    const key = parsed.meta['trmwrite-key'] || path.basename(entry.name, '.md')
    const heading = parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim()
    const body = parsed.body.replace(/^#\s+.+\r?\n+/, '').trim()
    let truth = db.data.truths.find((item: any) => item.projectId === projectId && (item.id === parsed.meta['trmwrite-id'] || item.key === key))
    if (!truth) {
      truth = { id: randomUUID(), projectId, key, title: heading || key, content: body, updatedAt: Date.now() }
      db.data.truths.push(truth)
    } else {
      truth.title = heading || truth.title
      truth.content = body
      truth.updatedAt = Date.now()
    }
    imported++
  }
  if (imported) await db.write()
  return { imported, skipped, folder, importedAt: Date.now() }
}

export function registerObsidianIPC() {
  ipcMain.handle('obsidian:choose-vault', async () => {
    const result = await dialog.showOpenDialog({ title: '选择 Obsidian 仓库', properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    const vaultPath = result.filePaths[0]
    const db = getDB()
    db.data.settings = { ...(db.data.settings || {}), obsidianVaultPath: vaultPath }
    await db.write()
    return vaultPath
  })
  ipcMain.handle('obsidian:status', async (_event, projectId: string) => {
    const vaultPath = getVaultPath()
    const project = getDB().data.projects.find((item: any) => item.id === projectId)
    const connected = !!vaultPath && !!(await fs.stat(vaultPath).catch(() => null))
    const projectRoot = connected && project ? getProjectRoot(vaultPath, project) : ''
    const exists = !!projectRoot && !!(await fs.stat(projectRoot).catch(() => null))
    return { connected, vaultPath, projectRoot, exists }
  })
  ipcMain.handle('obsidian:export', (_event, projectId: string) => exportProject(projectId))
  ipcMain.handle('obsidian:import-memory', (_event, projectId: string) => importMemory(projectId))
  ipcMain.handle('obsidian:sync', async (_event, projectId: string) => {
    const imported = await importMemory(projectId).catch(() => ({ imported: 0, skipped: 0 }))
    const exported = await exportProject(projectId)
    return { ...imported, ...exported }
  })
  ipcMain.handle('obsidian:open-project', async (_event, projectId: string) => {
    const project = getDB().data.projects.find((item: any) => item.id === projectId)
    if (!project) throw new Error('项目不存在')
    const vaultPath = getVaultPath()
    await validateVault(vaultPath)
    const root = getProjectRoot(vaultPath, project)
    await fs.mkdir(root, { recursive: true })
    shell.showItemInFolder(path.join(root, '项目主页.md'))
    return root
  })
}
