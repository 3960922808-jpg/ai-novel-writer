import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // ====== 项目数据 ======
  store: {
    getProjects: () => ipcRenderer.invoke('store:projects:list'),
    getProject: (id: string) => ipcRenderer.invoke('store:project:get', id),
    saveProject: (p: any) => ipcRenderer.invoke('store:project:save', p),
    deleteProject: (id: string) => ipcRenderer.invoke('store:project:delete', id),
    // 通用集合操作
    list: (collection: string, projectId: string) =>
      ipcRenderer.invoke('store:collection:list', collection, projectId),
    get: (collection: string, id: string) =>
      ipcRenderer.invoke('store:collection:get', collection, id),
    save: (collection: string, doc: any) =>
      ipcRenderer.invoke('store:collection:save', collection, doc),
    delete: (collection: string, id: string) =>
      ipcRenderer.invoke('store:collection:delete', collection, id),
    bulkSave: (collection: string, docs: any[]) =>
      ipcRenderer.invoke('store:collection:bulkSave', collection, docs),
    // 应用设置
    getSettings: () => ipcRenderer.invoke('store:settings:get'),
    saveSettings: (s: any) => ipcRenderer.invoke('store:settings:save', s)
  },

  // ====== AI 调用 ======
  ai: {
    // 流式聊天，回调返回每个 chunk
    stream: (req: any, onChunk: (text: string) => void) => {
      const chan = 'ai:stream:' + Math.random().toString(36).slice(2)
      const listener = (_e: any, text: string) => onChunk(text)
      ipcRenderer.on(chan, listener)
      return ipcRenderer.invoke('ai:stream', req, chan).finally(() => {
        ipcRenderer.removeListener(chan, listener)
      })
    },
    // 非流式
    chat: (req: any) => ipcRenderer.invoke('ai:chat', req)
  },

  // ====== 导出 ======
  export: {
    toMarkdown: (projectId: string) => ipcRenderer.invoke('export:md', projectId),
    toHTML: (projectId: string) => ipcRenderer.invoke('export:html', projectId),
    toEPUB: (projectId: string) => ipcRenderer.invoke('export:epub', projectId),
    toDOCX: (projectId: string) => ipcRenderer.invoke('export:docx', projectId),
    toPDF: (projectId: string) => ipcRenderer.invoke('export:pdf', projectId),
    saveFile: (defaultName: string, content: string) =>
      ipcRenderer.invoke('export:save', defaultName, content)
  },

  // ====== 文件 ======
  file: {
    selectImage: () => ipcRenderer.invoke('file:select-image'),
    readImageBase64: (filePath: string) => ipcRenderer.invoke('file:read-image', filePath),
    selectNovel: () => ipcRenderer.invoke('file:select-novel'),
    readNovelText: (filePath: string) => ipcRenderer.invoke('file:read-novel', filePath)
  },

  // ====== 联网搜索 ======
  search: {
    web: (req: any) => ipcRenderer.invoke('search:web', req)
  },

  // ====== 更新检查 ======
  updater: {
    // 手动触发一次检查
    check: () => ipcRenderer.invoke('updater:check'),
    // 下载更新并启动安装
    download: () => ipcRenderer.invoke('updater:download'),
    // 监听"发现新版本"事件
    onUpdateAvailable: (cb: (info: {
      version: string
      name: string
      notes: string
      date: string
      url: string
      downloadUrl: string
      downloadSize: number
      downloadName: string
      isArchive?: boolean
    }) => void) => {
      const listener = (_e: any, info: any) => cb(info)
      ipcRenderer.on('updater:available', listener)
      return () => ipcRenderer.removeListener('updater:available', listener)
    },
    // 监听下载进度
    onProgress: (cb: (p: { percent: number; status: string }) => void) => {
      const listener = (_e: any, p: any) => cb(p)
      ipcRenderer.on('updater:progress', listener)
      return () => ipcRenderer.removeListener('updater:progress', listener)
    }
  },

  // ====== 菜单事件 ======
  onMenu: (channel: string, cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type AppAPI = typeof api
