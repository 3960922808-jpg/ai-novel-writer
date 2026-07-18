/**
 * 轻量级 GitHub 更新检查器 + 软件内下载自动重启
 * - 启动后延迟 10 秒检查一次
 * - 每隔 30 分钟轮询一次
 * - 检测到最新 Release 版本号比本地高时：
 *   1. 弹出系统原生 Notification
 *   2. 通过 IPC 通知渲染进程，让前端弹 Element Plus 对话框
 * - 用户在弹窗点"立即更新"后：
 *   1. 从 GitHub Release 下载 Setup.exe 到 userData/update-cache/
 *   2. 通过 IPC 推送下载进度
 *   3. 下载完成后启动安装程序并退出当前应用
 * - 本地版本号从 package.json 读取
 */
import { app, BrowserWindow, Notification, shell } from 'electron'
import { getDB } from './db'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

const REPO = '3960922808-jpg/ai-novel-writer'
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`
const INITIAL_DELAY_MS = 10_000
const INTERVAL_MS = 30 * 60 * 1000 // 30 分钟

let timer: NodeJS.Timeout | null = null
let lastKnownVersion = ''
let isChecking = false
let isDownloading = false

interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  body: string
  published_at: string
  html_url: string
  assets: Array<{
    id: number
    name: string
    size: number
    browser_download_url: string
    content_type: string
  }>
}

// 从 package.json 读取当前版本
function getLocalVersion(): string {
  try {
    const pkgPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'package.json')
      : path.join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return (pkg.version || '0.0.0').replace(/^v/, '')
  } catch (e) {
    console.error('[updater] 读取本地版本失败:', e)
    return '0.0.0'
  }
}

// 简单的语义版本比较（支持 1.0.0 / 1.2.3 / 1.10.0 等）
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va > vb) return 1
    if (va < vb) return -1
  }
  return 0
}

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  const res = await fetch(RELEASES_API, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'ai-novel-writer-updater'
    }
  })
  if (res.status === 404) return null // 还没有 release
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  return await res.json() as GitHubRelease
}

function getSettings() {
  const db = getDB()
  const s: any = db.data.settings || {}
  // 兼容老数据
  if (s.autoUpdateCheck === undefined) s.autoUpdateCheck = true
  if (!s.lastKnownVersion) s.lastKnownVersion = ''
  return s
}

function persistVersion(version: string) {
  const db = getDB()
  if (!db.data.settings) db.data.settings = {} as any
  ;(db.data.settings as any).lastKnownVersion = version
  db.write().catch(err => console.error('[updater] 写入版本号失败:', err))
}

function firstLine(msg: string): string {
  return (msg || '').split('\n')[0].trim()
}

function notifyUpdate(release: GitHubRelease) {
  // 1. 系统原生通知
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: 'AI 写小说 · 发现新版本',
      body: `${release.name || release.tag_name}\n点击立即更新`,
      silent: false
    })
    notif.on('click', () => {
      const wins = BrowserWindow.getAllWindows()
      for (const w of wins) {
        try {
          w.webContents.send('updater:available', buildPayload(release))
        } catch (e) {
          console.error('[updater] 推送渲染进程失败:', e)
        }
      }
    })
    notif.show()
  }

  // 2. 通知渲染进程弹对话框
  const wins = BrowserWindow.getAllWindows()
  const payload = buildPayload(release)
  for (const w of wins) {
    try {
      w.webContents.send('updater:available', payload)
    } catch (e) {
      console.error('[updater] 推送渲染进程失败:', e)
    }
  }
}

function buildPayload(release: GitHubRelease) {
  // 选最大的资产作为下载目标（通常是 Setup.exe，约 90MB；免安装版 172MB）
  const setupAsset = release.assets.find(a => /setup/i.test(a.name)) || release.assets[0]
  return {
    version: release.tag_name,
    name: release.name || release.tag_name,
    notes: release.body || '',
    date: release.published_at || '',
    url: release.html_url || '',
    downloadUrl: setupAsset?.browser_download_url || '',
    downloadSize: setupAsset?.size || 0,
    downloadName: setupAsset?.name || ''
  }
}

async function checkOnce(opts: { silent?: boolean } = {}): Promise<{ updated: boolean; version?: string; release?: GitHubRelease }> {
  if (isChecking) return { updated: false }
  isChecking = true
  try {
    const release = await fetchLatestRelease()
    if (!release) return { updated: false }
    const remoteVersion = release.tag_name.replace(/^v/, '')
    const localVersion = getLocalVersion()
    const s = getSettings()
    // 首次启动：只记录版本号，不弹提示
    if (!s.lastKnownVersion) {
      lastKnownVersion = remoteVersion
      persistVersion(remoteVersion)
      return { updated: false, version: remoteVersion, release }
    }
    // 远程版本号比本地高，且比上次记录的高 → 有更新
    if (compareVersions(remoteVersion, localVersion) > 0) {
      lastKnownVersion = remoteVersion
      persistVersion(remoteVersion)
      if (!opts.silent) {
        notifyUpdate(release)
      }
      return { updated: true, version: remoteVersion, release }
    }
    lastKnownVersion = remoteVersion
    return { updated: false, version: remoteVersion, release }
  } catch (e) {
    console.error('[updater] 检查失败:', e)
    return { updated: false }
  } finally {
    isChecking = false
  }
}

/**
 * 从最新 Release 下载 Setup.exe 并启动安装
 * - 通过 IPC 推送进度（0-100）
 * - 下载完成后用 shell.openPath 启动安装程序，并退出当前应用
 */
export async function downloadAndRestart(): Promise<{ success: boolean; error?: string }> {
  if (isDownloading) return { success: false, error: '正在下载中' }
  isDownloading = true
  const wins = BrowserWindow.getAllWindows()

  const sendProgress = (pct: number, status: string) => {
    for (const w of wins) {
      try {
        w.webContents.send('updater:progress', { percent: pct, status })
      } catch {}
    }
  }

  try {
    sendProgress(0, '正在查询最新版本...')

    // 获取最新 release 信息
    const release = await fetchLatestRelease()
    if (!release) throw new Error('未找到任何发布版本')
    const setupAsset = release.assets.find(a => /setup/i.test(a.name)) || release.assets[0]
    if (!setupAsset) throw new Error('该版本未上传可下载的文件')

    sendProgress(5, `正在下载 ${setupAsset.name}（${(setupAsset.size / 1024 / 1024).toFixed(2)} MB）...`)

    // 创建缓存目录
    const cacheDir = path.join(app.getPath('userData'), 'update-cache')
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
    const savePath = path.join(cacheDir, setupAsset.name)

    // 使用 fetch 流式下载（Electron 31 内置）
    const resp = await fetch(setupAsset.browser_download_url, {
      headers: {
        'User-Agent': 'ai-novel-writer-updater',
        'Accept': 'application/octet-stream'
      },
      redirect: 'follow'
    })
    if (!resp.ok) throw new Error(`下载失败：HTTP ${resp.status}`)
    if (!resp.body) throw new Error('下载失败：无响应体')

    const totalStr = resp.headers.get('content-length') || ''
    const total = parseInt(totalStr, 10) || setupAsset.size

    sendProgress(10, `开始下载（共 ${(total / 1024 / 1024).toFixed(2)} MB）...`)

    // Node stream 写入文件
    const fileStream = fs.createWriteStream(savePath)
    const reader = Readable.fromWeb(resp.body as any)

    let received = 0
    let lastPct = 10

    await new Promise<void>((resolve, reject) => {
      let chunkIndex = 0
      reader.on('data', (chunk: Buffer) => {
        received += chunk.length
        fileStream.write(chunk)
        chunkIndex++
        if (total > 0) {
          const pct = 10 + Math.floor((received / total) * 85)
          if (pct > lastPct || chunkIndex % 50 === 0) {
            lastPct = pct
            const mb = (received / 1024 / 1024).toFixed(2)
            const totalMb = (total / 1024 / 1024).toFixed(2)
            sendProgress(pct, `下载中 ${mb}/${totalMb} MB (${pct}%)`)
          }
        } else if (chunkIndex % 50 === 0) {
          const mb = (received / 1024 / 1024).toFixed(2)
          sendProgress(Math.min(90, 10 + Math.floor(received / 1024 / 10)), `下载中 ${mb} MB`)
        }
      })
      reader.on('end', () => {
        fileStream.end(() => {
          sendProgress(95, '下载完成，正在校验...')
          resolve()
        })
      })
      reader.on('error', (err: any) => {
        fileStream.destroy()
        reject(err)
      })
      fileStream.on('error', (err: any) => {
        reject(err)
      })
    })

    // 验证文件大小
    const stat = fs.statSync(savePath)
    if (stat.size < 1000) {
      throw new Error('下载文件过小，可能不是有效的安装包')
    }

    sendProgress(98, '下载完成，正在启动安装程序...')

    // 等待 800ms 让前端显示完成状态
    await new Promise(r => setTimeout(r, 800))

    sendProgress(100, '安装程序已启动，请按提示完成安装')

    // 等待 500ms 让前端看到 100%
    await new Promise(r => setTimeout(r, 500))

    // 启动安装程序（用户需要按提示点下一步）
    // 安装程序会替换旧版本，安装完成后用户重新打开即可
    await shell.openPath(savePath)

    // 退出当前应用，让安装程序可以替换文件
    app.exit(0)

    return { success: true }
  } catch (e: any) {
    console.error('[updater] 下载失败:', e)
    sendProgress(-1, `下载失败：${e?.message || '未知错误'}`)
    return { success: false, error: e?.message || '未知错误' }
  } finally {
    isDownloading = false
  }
}

export function startUpdater() {
  // 立即初始化 lastKnownVersion（不阻塞）
  try {
    const s = getSettings()
    lastKnownVersion = s.lastKnownVersion || ''
  } catch {}

  setTimeout(async () => {
    const s = getSettings()
    if (s.autoUpdateCheck === false) return
    await checkOnce({ silent: false })
    if (timer) clearInterval(timer)
    timer = setInterval(async () => {
      const cur = getSettings()
      if (cur.autoUpdateCheck === false) return
      await checkOnce({ silent: false })
    }, INTERVAL_MS)
  }, INITIAL_DELAY_MS)

  console.log('[updater] 已启动，10 秒后首次检查 GitHub Release 更新')
}

export function stopUpdater() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export { checkOnce }
