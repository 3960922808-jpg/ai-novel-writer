// AI 服务封装
import type { AIRequest, ChatMessage } from '@/types'

/** 流式调用，onChunk 接收增量文本，返回完整文本 */
export function streamChat(req: AIRequest, onChunk: (text: string) => void): Promise<string> {
  return window.api.ai.stream(req, onChunk)
}

/** 非流式调用 */
export function chat(req: AIRequest): Promise<string> {
  return window.api.ai.chat(req)
}

/** 构造 AI 请求 */
export function buildRequest(opts: {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
}): AIRequest {
  return {
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.8,
    maxTokens: opts.maxTokens ?? 2048,
    topP: opts.topP ?? 1,
    stream: true
  }
}

/** 简单模板变量替换 */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`))
}

/** 提取模板中的变量 */
export function extractVariables(template: string): string[] {
  const set = new Set<string>()
  const re = /\{\{(\w+)\}\}/g
  let m
  while ((m = re.exec(template)) !== null) set.add(m[1])
  return [...set]
}

/** 统计字数（中文按字符，英文按词） */
export function countWords(text: string): number {
  if (!text) return 0
  // 去除 HTML 标签
  const plain = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
  if (!plain) return 0
  // 中文按字符
  const chinese = (plain.match(/[\u4e00-\u9fa5]/g) || []).length
  // 英文按词
  const english = (plain.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length
  return chinese + english
}
