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
