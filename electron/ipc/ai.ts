import { ipcMain } from 'electron'
import type { AIRequest } from '../../src/types'

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
          'X-Title': 'AI Novel Writer'
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
            event.sender.send(chan, '')
            return full
          }
          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content || ''
            if (delta) {
              full += delta
              event.sender.send(chan, delta)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
      return full
    } catch (err: any) {
      if (aborted) return ''
      event.sender.send(chan, '错误：' + err.message)
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
      throw new Error('AI 请求失败：' + e.message)
    }
  })
}
