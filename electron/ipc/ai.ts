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

/**
 * 把 OpenAI 的 content 字段统一拍平成纯文本。
 * 兼容两种形态：
 *   - 字符串：直接返回
 *   - 数组（新版 OpenAI / 多数中转站）：[{type:'text', text:'...'}, ...]，
 *     拼接所有 text 段；忽略 image_url 等非文本段
 * 这是自定义中转站「空回复」的主要根因：返回数组 content 时旧逻辑直接丢弃。
 */
function flattenContent(content: any): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    let out = ''
    for (const seg of content) {
      if (seg && typeof seg === 'object') {
        if (typeof seg.text === 'string') out += seg.text
        else if (typeof seg.content === 'string') out += seg.content
      } else if (typeof seg === 'string') {
        out += seg
      }
    }
    return out
  }
  return ''
}

/**
 * 从一个 SSE data 块里提取增量文本，兼容各种中转站/上游的非标准返回。
 * 按优先级依次尝试常见字段路径：
 *   1. OpenAI Chat Completions 流式：choices[0].delta.content
 *   2. OpenAI Chat Completions 非流式混入：choices[0].message.content
 *   3. Completions API：choices[0].text
 *   4. 部分中转站直接返回 content / text / response 字段
 * 返回空串表示该块无文本增量。
 */
function extractDelta(json: any): string {
  if (!json || typeof json !== 'object') return ''
  const choices = json.choices
  if (Array.isArray(choices) && choices.length > 0) {
    const c0 = choices[0]
    if (c0 && typeof c0 === 'object') {
      // 流式 delta（content 可能是字符串或数组）
      const d = c0.delta
      if (d && typeof d === 'object') {
        if (d.content !== undefined) {
          const t = flattenContent(d.content)
          if (t) return t
        }
        if (typeof d.text === 'string') return d.text
      }
      // 非流式 message（部分中转站会在流里夹带完整 message）
      const m = c0.message
      if (m && typeof m === 'object') {
        if (m.content !== undefined) {
          const t = flattenContent(m.content)
          if (t) return t
        }
        if (typeof m.text === 'string') return m.text
      }
      // Completions API
      if (typeof c0.text === 'string') return c0.text
    }
  }
  // 顶层裸字段兜底
  if (json.content !== undefined) {
    const t = flattenContent(json.content)
    if (t) return t
  }
  if (typeof json.text === 'string') return json.text
  if (typeof json.response === 'string') return json.response
  return ''
}

export function registerAIIPC() {
  // 流式聊天
  ipcMain.handle('ai:stream', async (event, req: AIRequest, chan: string) => {
    if (!req.baseUrl || !req.apiKey) {
      throw new Error('未配置 baseUrl 或 apiKey')
    }
    const url = req.baseUrl.replace(/\/+$/, '') + '/chat/completions'
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
      // 部分中转站不支持流式，会一次性返回完整 JSON（Content-Type: application/json，无 SSE）
      // 收集非 SSE 响应体，结束后兜底解析
      let nonStreamBody = ''
      let looksLikeSSE = false

      // 处理单行 SSE data，返回是否遇到 [DONE]
      const processLine = (rawLine: string): boolean => {
        const t = rawLine.trim()
        if (!t) return false
        // SSE 注释行（如 ": keep-alive"）直接跳过
        if (t.startsWith(':')) return false
        // 兼容 data: / data:{...} / data: {...}（大小写不敏感）
        const dm = t.match(/^data\s*:\s*(.*)$/i)
        if (!dm) {
          // 非 data 行：如果既不是注释也不是 data，可能是非 SSE 响应，累积起来
          if (!looksLikeSSE) nonStreamBody += t + '\n'
          return false
        }
        const data = dm[1].trim()
        if (!data) return false
        // [DONE] 标记（兼容大小写、空格）
        if (/^\[?done\]?$/i.test(data)) {
          safeSend(event, chan, '')
          return true
        }
        try {
          const json = JSON.parse(data)
          const delta = extractDelta(json)
          if (delta) {
            full += delta
            safeSend(event, chan, delta)
          }
        } catch {
          // JSON 解析失败：可能是中转站直接返回纯文本增量
          // 排除明显的错误响应（以 { 开头但解析失败的，留到非流式兜底）
          if (!data.startsWith('{') && !data.startsWith('[')) {
            full += data
            safeSend(event, chan, data)
          }
        }
        return false
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunkStr = decoder.decode(value, { stream: true })
        buffer += chunkStr
        // 只要出现 "data:" 就认为是 SSE 流
        if (!looksLikeSSE && /(^|\n)\s*data:/i.test(buffer)) looksLikeSSE = true
        // 兼容 \r\n 与 \n：统一按 \n 切
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (processLine(line)) return full
        }
      }

      // 流结束后，处理 buffer 里残留的最后一行（中转站最后一帧常不带换行，
      // 旧逻辑只在非 SSE 模式才处理 buffer，SSE 模式下会丢弃最后一帧 → 丢字/空回复）
      if (buffer.trim()) {
        if (processLine(buffer)) return full
        buffer = ''
      }

      // 流结束后，如果整段都不是 SSE（中转站不支持 stream 一次性返回 JSON）
      if (!looksLikeSSE && !full) {
        const tail = (buffer + (nonStreamBody || '')).trim()
        if (tail) {
          try {
            const json = JSON.parse(tail)
            const text = extractDelta(json) || json.choices?.[0]?.message?.content || ''
            if (text) {
              full = text
              safeSend(event, chan, text)
            }
          } catch {
            // 纯文本响应
            if (tail && !tail.startsWith('{') && !tail.startsWith('<')) {
              full = tail
              safeSend(event, chan, tail)
            }
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
      const url = req.baseUrl.replace(/\/+$/, '') + '/chat/completions'
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
      return extractDelta(json) || json.choices?.[0]?.message?.content || ''
    } catch (e: any) {
      // 保留原始错误信息，避免前端再包装一次造成"AI 请求失败：AI 请求失败：API 401"
      throw e
    }
  })
}
