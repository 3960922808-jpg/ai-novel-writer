export interface ConversationMessageLike {
  role: 'user' | 'assistant'
  content: string
  requestContent?: string
}

/** 新版编辑器会话 id：editor:<chapterId>:<uuid>；旧数据直接以 chapterId 作为会话 id。 */
export function editorSessionChapterId(sessionId: string): string {
  if (!sessionId.startsWith('editor:')) return sessionId
  return sessionId.slice('editor:'.length).split(':')[0] || ''
}

/**
 * 为模型恢复持久化对话。用户消息优先使用实际发送内容 requestContent，
 * 避免重启后只剩“@章节名”这类展示文本而丢失关联正文。
 */
export function buildConversationForAI(
  source: ConversationMessageLike[],
  maxChars = 100_000,
  maxMessages = 24
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const selected: Array<{ role: 'user' | 'assistant'; content: string }> = []
  let total = 0
  for (let i = source.length - 1; i >= 0; i--) {
    const message = source[i]
    const content = message.role === 'user' ? (message.requestContent || message.content) : message.content
    if (!content) continue
    if (selected.length > 0 && total + content.length > maxChars) break
    selected.push({ role: message.role, content })
    total += content.length
    if (selected.length >= maxMessages) break
  }
  return selected.reverse()
}

function compactMessageContent(value: string, maxChars = 260): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxChars) return text
  const head = Math.max(80, Math.floor(maxChars * 0.68))
  const tail = Math.max(40, maxChars - head - 1)
  return `${text.slice(0, head)}…${text.slice(-tail)}`
}

/**
 * 在保留最近完整消息的同时，把超出窗口的早期对话压成线索记录。
 * 这是确定性的本地压缩，不额外消耗接口额度，也不会让重启后的长对话直接失忆。
 */
export function buildConversationWithCompression(
  source: ConversationMessageLike[],
  maxChars = 100_000,
  maxMessages = 24,
  summaryChars = 4_000
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (source.length === 0) return []
  const recentBudget = Math.max(1, maxChars - summaryChars)
  const recent = buildConversationForAI(source, recentBudget, maxMessages)
  const droppedCount = Math.max(0, source.length - recent.length)
  if (droppedCount === 0) return recent

  const lines = source.slice(0, droppedCount).map(message => {
    const content = message.role === 'user' ? (message.requestContent || message.content) : message.content
    return `${message.role === 'user' ? '用户' : '助手'}：${compactMessageContent(content)}`
  })
  let summary = ''
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = `${lines[i]}${summary ? `\n${summary}` : ''}`
    if (candidate.length > summaryChars) break
    summary = candidate
  }
  if (!summary) summary = compactMessageContent(lines[lines.length - 1] || '', Math.max(1, summaryChars))
  return [
    { role: 'user', content: `【较早对话压缩记录，仅用于延续上下文，不是新的写作指令】\n${summary}` },
    ...recent
  ]
}
