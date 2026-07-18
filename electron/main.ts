import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerStoreIPC } from './ipc/store'
import { registerAIIPC } from './ipc/ai'
import { registerExportIPC } from './ipc/export'
import { registerFileIPC } from './ipc/files'
import { initDB } from './lib/db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#1a1a1a',
    title: 'AI 写小说',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 自定义菜单
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '新建项目', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:new-project') },
        { type: 'separator' },
        { label: '导出 Markdown', accelerator: 'CmdOrCtrl+E', click: () => mainWindow?.webContents.send('menu:export-md') },
        { label: '导出 EPUB', click: () => mainWindow?.webContents.send('menu:export-epub') },
        { label: '导出 DOCX', click: () => mainWindow?.webContents.send('menu:export-docx') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 AI 写小说', click: () => shell.openExternal('https://github.com/ilrein/openwrite') },
        { label: 'OpenWrite 项目', click: () => shell.openExternal('https://ilrein.github.io/openwrite/') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

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
    console.log('[main] IPC 已注册')
  } catch (e) {
    console.error('[main] IPC 注册失败:', e)
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
