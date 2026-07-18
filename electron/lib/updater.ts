/**
 * 轻量级 GitHub 更新检查器
 * - 启动后延迟 10 秒检查一次
 * - 每隔 30 分钟轮询一次
 * - 检测到 main 分支最新 commit SHA 与本地记录不同时：
 *   1. 弹出系统原生 Notification（带"前往下载"按钮）
 *   2. 通过 IPC 通知渲染进程，让前端弹 Element Plus 对话框
 * - SHA 记录在 settings.lastCommitSha，可在设置页关闭
 */
import { BrowserWindow, Notification, shell } from 'electron'
import { getDB } from './db'

const REPO = '3960922808-jpg/ai-novel-writer'
const BRANCH = 'main'
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`
const COMMITS_API = `https://api.github.com/repos/${REPO}/commits/${BRANCH}`
const INITIAL_DELAY_MS = 10_000
const INTERVAL_MS = 30 * 60 * 1000 // 30 分钟
const PER_PAGE = 5

let timer: NodeJS.Timeout | null = null
let lastKnownSha = ''
let isChecking = false

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
      body: `${firstLine(commit.commit.message)}\n点击前往下载`,
      silent: false
    })
    notif.on('click', () => {
      shell.openExternal(commit.html_url || RELEASES_URL)
    })
    notif.show()
  }

  // 2. 通知渲染进程弹对话框
  const wins = BrowserWindow.getAllWindows()
  const payload = {
    sha: newSha,
    message: commit.commit.message,
    author: commit.commit.author?.name || '',
    date: commit.commit.author?.date || '',
    url: commit.html_url || RELEASES_URL,
    releasesUrl: RELEASES_URL
  }
  for (const w of wins) {
    try {
      w.webContents.send('updater:available', payload)
    } catch (e) {
      console.error('[updater] 推送渲染进程失败:', e)
    }
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
