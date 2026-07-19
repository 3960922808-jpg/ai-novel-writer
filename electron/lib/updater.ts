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
 *
 * 网络优化（解决国内访问 GitHub 慢/失败的问题）：
 * - API 检查：依次尝试多个镜像源（api.github.com → ghproxy 镜像 → jsdelivr）
 * - 下载：优先 GitHub 直链，失败回退 ghproxy 加速
 * - 超时：8 秒 AbortController，避免长时间挂起
 */
import { app, BrowserWindow, Notification, shell } from 'electron'
import { getDB } from './db'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'

const REPO = '3960922808-jpg/ai-novel-writer'
// 多个 GitHub API 镜像源（依次尝试，提高国内访问成功率）
const API_ENDPOINTS = [
  `https://api.github.com/repos/${REPO}/releases/latest`,
  `https://ghproxy.com/https://api.github.com/repos/${REPO}/releases/latest`,
  `https://gh-proxy.com/https://api.github.com/repos/${REPO}/releases/latest`,
  `https://mirror.ghproxy.com/https://api.github.com/repos/${REPO}/releases/latest`
]
// ghproxy 下载加速前缀（用于 GitHub release assets 直链下载）
const DOWNLOAD_PROXIES = [
  '', // 直链优先
  'https://ghproxy.com/',
  'https://gh-proxy.com/',
  'https://mirror.ghproxy.com/'
]
const INITIAL_DELAY_MS = 10_000
const INTERVAL_MS = 30 * 60 * 1000 // 30 分钟
const FETCH_TIMEOUT_MS = 8_000 // 8 秒超时
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000 // 下载 5 分钟超时

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

/**
 * 依次尝试多个 GitHub API 镜像源获取最新 release
 * 任一源成功即返回；全部失败抛出最后一个错误
 */
async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  let lastErr: any = null
  for (const url of API_ENDPOINTS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'ai-novel-writer-updater'
        },
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (res.status === 404) return null // 还没有 release
      if (!res.ok) {
        lastErr = new Error(`GitHub API ${res.status} (${url})`)
        continue
      }
      const data = await res.json() as GitHubRelease
      console.log(`[updater] 成功从 ${url} 获取最新 release`)
      return data
    } catch (e: any) {
      lastErr = e
      console.warn(`[updater] ${url} 失败:`, e?.message || e)
      // 继续尝试下一个源
    }
  }
  throw lastErr || new Error('所有 GitHub API 源均不可用')
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

/**
 * 选择要下载的资产：
 * 只选 Setup.exe（NSIS 安装版），用于静默覆盖安装。
 * 不再下载 zip 免安装包（无法自动覆盖当前运行中的 exe）。
 * 如果没有 exe 资产，回退到第一个资产（让用户手动处理）。
 */
function pickAsset(assets: GitHubRelease['assets']): GitHubRelease['assets'][number] | null {
  if (!assets || !assets.length) return null
  // 优先匹配 Setup.exe / NSIS 安装包
  const exe = assets.find(a =>
    /\.exe$/i.test(a.name) && /setup|installer|install/i.test(a.name)
  ) || assets.find(a => /\.exe$/i.test(a.name))
  if (exe) return exe
  // 回退到第一个
  return assets[0]
}

function buildPayload(release: GitHubRelease) {
  const asset = pickAsset(release.assets)
  return {
    version: release.tag_name,
    name: release.name || release.tag_name,
    notes: release.body || '',
    date: release.published_at || '',
    url: release.html_url || '',
    downloadUrl: asset?.browser_download_url || '',
    downloadSize: asset?.size || 0,
    downloadName: asset?.name || '',
    isArchive: asset ? /\.(zip|7z|tar\.gz|tar)$/i.test(asset.name) : false
  }
}

async function checkOnce(opts: { silent?: boolean } = {}): Promise<{ updated: boolean; version?: string; release?: GitHubRelease; error?: string }> {
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
  } catch (e: any) {
    console.error('[updater] 检查失败:', e)
    const errMsg = e?.name === 'AbortError'
      ? '连接超时'
      : e?.message?.includes('Failed to fetch') || e?.message?.includes('fetch failed')
        ? '无法连接 GitHub，请检查网络或稍后重试'
        : e?.message || '未知错误'
    return { updated: false, error: errMsg }
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
    const asset = pickAsset(release.assets)
    if (!asset) throw new Error('该版本未上传可下载的文件')

    sendProgress(5, `正在下载 ${asset.name}（${(asset.size / 1024 / 1024).toFixed(2)} MB）...`)

    // 创建缓存目录
    const cacheDir = path.join(app.getPath('userData'), 'update-cache')
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
    const savePath = path.join(cacheDir, asset.name)

    // 构造多个下载源（直链优先 → ghproxy 加速）
    const downloadUrls = DOWNLOAD_PROXIES.map(p => p + asset.browser_download_url)

    // 依次尝试下载源，成功即用
    let resp: Response | null = null
    let usedUrl = ''
    let lastErr: any = null
    for (const url of downloadUrls) {
      try {
        sendProgress(8, `正在连接下载源...`)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15_000) // 连接超时 15 秒
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'ai-novel-writer-updater',
            'Accept': 'application/octet-stream'
          },
          redirect: 'follow',
          signal: controller.signal
        })
        clearTimeout(timeout)
        if (!r.ok) {
          lastErr = new Error(`HTTP ${r.status}`)
          continue
        }
        if (!r.body) {
          lastErr = new Error('无响应体')
          continue
        }
        resp = r
        usedUrl = url
        console.log(`[updater] 下载源选择: ${url}`)
        break
      } catch (e: any) {
        lastErr = e
        console.warn(`[updater] 下载源 ${url} 连接失败:`, e?.message || e)
      }
    }
    if (!resp) {
      throw new Error(`所有下载源均不可用：${lastErr?.message || '未知错误'}。请前往 GitHub Release 页面手动下载。`)
    }

    const totalStr = resp.headers.get('content-length') || ''
    const total = parseInt(totalStr, 10) || asset.size

    sendProgress(10, `开始下载（共 ${(total / 1024 / 1024).toFixed(2)} MB）...`)

    // Node stream 写入文件
    const fileStream = fs.createWriteStream(savePath)
    const reader = Readable.fromWeb(resp.body as any)

    let received = 0
    let lastPct = 10
    // 下载超时保护：5 分钟无新数据则中止
    let downloadTimer: NodeJS.Timeout | null = setTimeout(() => {
      try { reader.destroy(new Error('下载超时')) } catch {}
    }, DOWNLOAD_TIMEOUT_MS)

    await new Promise<void>((resolve, reject) => {
      let chunkIndex = 0
      reader.on('data', (chunk: Buffer) => {
        // 收到数据就重置超时
        if (downloadTimer) clearTimeout(downloadTimer)
        downloadTimer = setTimeout(() => {
          try { reader.destroy(new Error('下载超时')) } catch {}
        }, 30_000) // 30 秒无数据则超时

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
        if (downloadTimer) clearTimeout(downloadTimer)
        fileStream.end(() => {
          sendProgress(95, '下载完成，正在校验...')
          resolve()
        })
      })
      reader.on('error', (err: any) => {
        if (downloadTimer) clearTimeout(downloadTimer)
        fileStream.destroy()
        reject(err)
      })
      fileStream.on('error', (err: any) => {
        if (downloadTimer) clearTimeout(downloadTimer)
        reject(err)
      })
    })

    // 验证文件大小
    const stat = fs.statSync(savePath)
    if (stat.size < 1000) {
      throw new Error('下载文件过小，可能不是有效的安装包')
    }

    // 安装包：用 NSIS /S 静默安装，自动覆盖旧文件
    if (/\.exe$/i.test(asset.name)) {
      // 进度条走满，明确告诉用户下载成功
      sendProgress(100, '下载完成，正在重启应用...')

      // 等 1.2 秒让前端进度条动画走满 100%
      await new Promise(r => setTimeout(r, 1200))

      // 用 NSIS /S 静默安装 + --force-run 安装后自动启动新版本
      // /S: 静默模式（无界面）
      // --force-run: 安装完成后强制运行新版本（electron-builder NSIS 支持）
      // detached + windowsHide: 子进程独立于父进程，隐藏控制台窗口
      const child = spawn(savePath, ['/S', '--force-run'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
      child.unref()

      // 不立即退出，给 NSIS 一点时间启动
      // NSIS 静默安装通常会：
      //   1. 等待旧 exe 释放文件锁（这里通过退出应用来实现）
      //   2. 替换 exe 文件
      //   3. 因为 --force-run，启动新版本
      // 这里给 800ms 让 NSIS 启动，然后退出当前应用释放文件锁
      await new Promise(r => setTimeout(r, 800))
      app.exit(0)

      return { success: true }
    }

    // 非 exe 资产（理论上 pickAsset 不会选到，兜底处理）
    sendProgress(100, '下载完成，已在资源管理器中显示文件')
    await new Promise(r => setTimeout(r, 600))
    shell.showItemInFolder(savePath)
    return { success: true }
  } catch (e: any) {
    console.error('[updater] 下载失败:', e)
    const errMsg = e?.name === 'AbortError'
      ? '连接超时，请检查网络后重试'
      : e?.message?.includes('Failed to fetch') || e?.message?.includes('fetch failed')
        ? '网络连接失败，可能是 GitHub 被屏蔽。请检查网络后重试，或前往 GitHub Release 页面手动下载。'
        : e?.message || '未知错误'
    sendProgress(-1, `下载失败：${errMsg}`)
    return { success: false, error: errMsg }
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
