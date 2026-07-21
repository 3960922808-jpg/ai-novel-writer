import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { registerStoreIPC } from './ipc/store'
import { registerAIIPC } from './ipc/ai'
import { registerExportIPC } from './ipc/export'
import { registerFileIPC } from './ipc/files'
import { registerSearchIPC } from './ipc/search'
import { initDB } from './lib/db'
import { startUpdater, checkOnce, downloadAndRestart, openDownloadInBrowser } from './lib/updater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 找 preload 文件：优先 .js，回退 .mjs
function findPreload(): string {
  const candidates = [
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, 'preload.mjs'),
    path.join(__dirname, '..', 'dist-electron', 'preload.js'),
    path.join(__dirname, '..', 'dist-electron', 'preload.mjs')
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log('[main] 找到 preload:', p)
      return p
    }
  }
  console.error('[main] 未找到 preload 文件！搜索路径:', candidates)
  return candidates[0]
}

let mainWindow: BrowserWindow | null = null

// 图标路径：开发模式用 build/icon.ico，打包后从 resources 读取
function getIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.ico')
  }
  return path.join(__dirname, '..', 'build', 'icon.ico')
}

function createWindow() {
  const iconPath = getIconPath()
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#1a1a1a',
    title: 'TrmWrite',
    icon: iconPath,
    autoHideMenuBar: true, // 隐藏菜单栏（按 Alt 仍可临时显示）
    webPreferences: {
      preload: findPreload(),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 完全移除应用菜单栏（去掉左上角的"文件/编辑/视图/帮助"）
  // 保留 Ctrl+C / Ctrl+V 等基础快捷键 — 这些是 Electron 默认行为，不需要菜单
  Menu.setApplicationMenu(null)

  // 开发模式加载 dev server，生产模式加载打包文件
  const isDev = !app.isPackaged
  if (isDev) {
    // 优先用 vite-plugin-electron 注入的 URL，回退到默认端口
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    console.log('[main] 开发模式，加载:', devUrl)
    mainWindow.loadURL(devUrl).catch(err => {
      console.error('[main] 加载 dev server 失败:', err)
    })
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    console.log('[main] 生产模式，加载 dist/index.html')
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 监听加载失败
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    console.error('[main] 页面加载失败:', errorCode, errorDescription)
  })
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    console.log('[renderer]', message)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 外部链接在浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Windows 任务栏图标通过 BrowserWindow 的 icon 选项设置（见 createWindow）
  // Electron 31 的 App 类型没有公开 setIcon，这里不调用
  try {
    await initDB()
    console.log('[main] 数据库初始化成功')
  } catch (e) {
    console.error('[main] 数据库初始化失败:', e)
  }
  try {
    registerStoreIPC()
    registerAIIPC()
    registerExportIPC()
    registerFileIPC()
    registerSearchIPC()
    // 手动检查更新 — 返回完整信息给前端展示
    ipcMain.handle('updater:check', async () => {
      const r = await checkOnce({ silent: false })
      return {
        updated: r.updated,
        version: r.version || '',
        releaseName: r.release?.name || '',
        releaseNotes: r.release?.body || '',
        releaseUrl: r.release?.html_url || '',
        releaseDate: r.release?.published_at || '',
        hasRelease: !!r.release,
        error: r.error || ''
      }
    })
    // 下载并自动重启
    ipcMain.handle('updater:download', async () => {
      const r = await downloadAndRestart()
      return r
    })
    // 用系统浏览器打开下载链接（速度更快，支持 IDM/迅雷等下载工具）
    ipcMain.handle('updater:download-browser', async () => {
      const r = await openDownloadInBrowser()
      return r
    })
    console.log('[main] IPC 已注册')
  } catch (e) {
    console.error('[main] IPC 注册失败:', e)
  }
  createWindow()
  // 启动 GitHub 更新检查
  try {
    startUpdater()
  } catch (e) {
    console.error('[main] 更新检查器启动失败:', e)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
