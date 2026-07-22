import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { AIRequest } from '../../src/types'

/**
 * 安全地给渲染进程发消息：webContents 可能在流式过程中被销毁（用户关窗），
 * 直接 event.sender.send 会抛未捕获异常，这里包 try/catch 静默忽略
 */
function safeSend(event: IpcMainInvokeEvent, chan: string, payload: string) {
  try {
    if (!event.sender.isDestroyed()) event.sender.send(chan, payload)
  } catch {
    // webContents 已销毁，忽略
  }
}

export function registerAIIPC() {
  // 流式聊天
  ipcMain.handle('ai:stream', async (event, req: AIRequest, chan: string) => {
    if (!req.baseUrl || !req.apiKey) {
      throw new Error('未配置 baseUrl 或 apiKey')
    }
    const url = req.baseUrl.replace(/\/$/, '') + '/chat/completions'
    const body: any = {
      model: req.model,
      messages: req.messages,
      stream: true,
      temperature: req.temperature ?? 0.8,
      max_tokens: req.maxTokens ?? 2048,
      top_p: req.topP ?? 1
    }

    const ctrl = new AbortController()
    let aborted = false

    // 监听取消（前端可以发 'ai:stream:cancel' + chan）
    const cancelHandler = (_e: any, c: string) => {
      if (c === chan) {
        aborted = true
        ctrl.abort()
      }
    }
    ipcMain.on('ai:stream:cancel', cancelHandler)

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${req.apiKey}`,
          'HTTP-Referer': 'https://github.com/ainovelwriter',
          'X-Title': 'TrmWrite'
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      })

      if (!resp.ok || !resp.body) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`API ${resp.status}: ${txt.slice(0, 500) || resp.statusText}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const t = line.trim()
          if (!t || !t.startsWith('data:')) continue
          const data = t.slice(5).trim()
          if (data === '[DONE]') {
            safeSend(event, chan, '')
            return full
          }
          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content || ''
            if (delta) {
              full += delta
              safeSend(event, chan, delta)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
      return full
    } catch (err: any) {
      if (aborted) return ''
      // 不再把错误信息当作流式 chunk 发给前端，避免被当作正文渲染
      throw err
    } finally {
      ipcMain.removeListener('ai:stream:cancel', cancelHandler)
    }
  })

  // 非流式
  ipcMain.handle('ai:chat', async (_e, req: AIRequest) => {
    if (!req.baseUrl || !req.apiKey) {
      throw new Error('未配置 baseUrl 或 apiKey')
    }
    try {
      const url = req.baseUrl.replace(/\/$/, '') + '/chat/completions'
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${req.apiKey}`
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          temperature: req.temperature ?? 0.8,
          max_tokens: req.maxTokens ?? 2048,
          top_p: req.topP ?? 1,
          stream: false
        })
      })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`API ${resp.status}: ${txt.slice(0, 500) || resp.statusText}`)
      }
      const json = await resp.json()
      return json.choices?.[0]?.message?.content || ''
    } catch (e: any) {
      // 保留原始错误信息，避免前端再包装一次造成"AI 请求失败：AI 请求失败：API 401"
      throw e
    }
  })
}
