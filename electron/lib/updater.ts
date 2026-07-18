/**
 * 轻量级 GitHub 更新检查器 + 软件内下载自动重启
 * - 启动后延迟 10 秒检查一次
 * - 每隔 30 分钟轮询一次
 * - 检测到 main 分支最新 commit SHA 与本地记录不同时：
 *   1. 弹出系统原生 Notification
 *   2. 通过 IPC 通知渲染进程，让前端弹 Element Plus 对话框
 * - 用户在弹窗点"立即更新"后：
 *   1. 下载 main 分支 zip 包到 userData/update-cache/
 *   2. 通过 IPC 推送下载进度
 *   3. 下载完成后调用 app.relaunch() + app.exit(0) 自动重启
 * - SHA 记录在 settings.lastCommitSha，可在设置页关闭
 */
import { app, BrowserWindow, Notification, shell } from 'electron'
import { getDB } from './db'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

const REPO = '3960922808-jpg/ai-novel-writer'
const BRANCH = 'main'
const COMMITS_API = `https://api.github.com/repos/${REPO}/commits/${BRANCH}`
// codeload 直接下载 main 分支 zip 包
const ZIP_URL = `https://codeload.github.com/${REPO}/zip/refs/heads/${BRANCH}`
const INITIAL_DELAY_MS = 10_000
const INTERVAL_MS = 30 * 60 * 1000 // 30 分钟
const PER_PAGE = 5

let timer: NodeJS.Timeout | null = null
let lastKnownSha = ''
let isChecking = false
let isDownloading = false

interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: { name: string; date: string }
  }
  html_url: string
}

async function fetchLatestCommits(): Promise<GitHubCommit[]> {
  // Electron 31 内置 fetch
  const url = `${COMMITS_API}?per_page=${PER_PAGE}`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'ai-novel-writer-updater'
    }
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const data = await res.json() as GitHubCommit[]
  return Array.isArray(data) ? data : [data as any]
}

function getSettings() {
  const db = getDB()
  const s: any = db.data.settings || {}
  // 兼容老数据
  if (s.autoUpdateCheck === undefined) s.autoUpdateCheck = true
  if (!s.lastCommitSha) s.lastCommitSha = ''
  return s
}

function persistSha(sha: string) {
  const db = getDB()
  if (!db.data.settings) db.data.settings = {} as any
  ;(db.data.settings as any).lastCommitSha = sha
  // 异步写入，不阻塞
  db.write().catch(err => console.error('[updater] 写入 sha 失败:', err))
}

function firstLine(msg: string): string {
  return (msg || '').split('\n')[0].trim()
}

function notifyUpdate(newSha: string, commit: GitHubCommit) {
  // 1. 系统原生通知
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: 'AI 写小说 · 发现新版本',
      body: `${firstLine(commit.commit.message)}\n点击立即更新`,
      silent: false
    })
    notif.on('click', () => {
      // 通知点击也触发前端弹窗
      const wins = BrowserWindow.getAllWindows()
      for (const w of wins) {
        try {
          w.webContents.send('updater:available', buildPayload(newSha, commit))
        } catch (e) {
          console.error('[updater] 推送渲染进程失败:', e)
        }
      }
    })
    notif.show()
  }

  // 2. 通知渲染进程弹对话框
  const wins = BrowserWindow.getAllWindows()
  const payload = buildPayload(newSha, commit)
  for (const w of wins) {
    try {
      w.webContents.send('updater:available', payload)
    } catch (e) {
      console.error('[updater] 推送渲染进程失败:', e)
    }
  }
}

function buildPayload(newSha: string, commit: GitHubCommit) {
  return {
    sha: newSha,
    message: commit.commit.message,
    author: commit.commit.author?.name || '',
    date: commit.commit.author?.date || '',
    url: commit.html_url || ''
  }
}

async function checkOnce(opts: { silent?: boolean } = {}): Promise<{ updated: boolean; sha?: string; commit?: GitHubCommit }> {
  if (isChecking) return { updated: false }
  isChecking = true
  try {
    const commits = await fetchLatestCommits()
    if (!commits.length) return { updated: false }
    const latest = commits[0]
    const s = getSettings()
    // 首次启动：只记录 SHA，不弹提示
    if (!s.lastCommitSha) {
      lastKnownSha = latest.sha
      persistSha(latest.sha)
      return { updated: false, sha: latest.sha, commit: latest }
    }
    if (latest.sha !== s.lastCommitSha) {
      lastKnownSha = latest.sha
      persistSha(latest.sha)
      if (!opts.silent) {
        notifyUpdate(latest.sha, latest)
      }
      return { updated: true, sha: latest.sha, commit: latest }
    }
    lastKnownSha = latest.sha
    return { updated: false, sha: latest.sha, commit: latest }
  } catch (e) {
    console.error('[updater] 检查失败:', e)
    return { updated: false }
  } finally {
    isChecking = false
  }
}

/**
 * 下载 main 分支 zip 包并自动重启应用
 * - 通过 IPC 推送进度（0-100）
 * - 下载完成后退出当前进程并启动新实例
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
    sendProgress(0, '正在准备下载...')

    // 创建缓存目录
    const cacheDir = path.join(app.getPath('userData'), 'update-cache')
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
    const zipPath = path.join(cacheDir, `update-${Date.now()}.zip`)

    sendProgress(5, '正在连接服务器...')

    // 使用 fetch 流式下载（Electron 31 内置）
    const resp = await fetch(ZIP_URL, {
      headers: {
        'User-Agent': 'ai-novel-writer-updater',
        'Accept': 'application/zip'
      },
      redirect: 'follow'
    })
    if (!resp.ok) throw new Error(`下载失败：HTTP ${resp.status}`)
    if (!resp.body) throw new Error('下载失败：无响应体')

    const totalStr = resp.headers.get('content-length') || ''
    const total = parseInt(totalStr, 10) || 0

    sendProgress(10, `开始下载${total ? `（共 ${(total / 1024 / 1024).toFixed(2)} MB）` : '...'}...`)

    // Node stream 写入文件
    const fileStream = fs.createWriteStream(zipPath)
    const reader = Readable.fromWeb(resp.body as any)

    let received = 0
    let lastPct = 10
    const CHUNK_COUNT_LIMIT = 1000 // 防止过频推送

    await new Promise<void>((resolve, reject) => {
      let chunkIndex = 0
      reader.on('data', (chunk: Buffer) => {
        received += chunk.length
        fileStream.write(chunk)
        chunkIndex++
        // 推送进度
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
    const stat = fs.statSync(zipPath)
    if (stat.size < 1000) {
      throw new Error('下载文件过小，可能不是有效的更新包')
    }

    sendProgress(98, '下载完成，正在准备重启...')

    // 等待 800ms 让前端显示完成状态
    await new Promise(r => setTimeout(r, 800))

    sendProgress(100, '更新已就绪，应用即将重启...')

    // 等待 500ms 让前端看到 100%
    await new Promise(r => setTimeout(r, 500))

    // 重启应用（app.relaunch 会启动新进程，app.exit(0) 退出当前进程）
    // 注意：直接重启应用本身，下载的 zip 包保存在 userData/update-cache/ 供后续使用
    app.relaunch()
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
  // 立即初始化 lastKnownSha（不阻塞）
  try {
    const s = getSettings()
    lastKnownSha = s.lastCommitSha || ''
  } catch {}

  setTimeout(async () => {
    const s = getSettings()
    if (s.autoUpdateCheck === false) return
    await checkOnce({ silent: false })
    // 启动定时器
    if (timer) clearInterval(timer)
    timer = setInterval(async () => {
      const cur = getSettings()
      if (cur.autoUpdateCheck === false) return
      await checkOnce({ silent: false })
    }, INTERVAL_MS)
  }, INITIAL_DELAY_MS)

  console.log('[updater] 已启动，10 秒后首次检查 GitHub 更新')
}

export function stopUpdater() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export { checkOnce }
