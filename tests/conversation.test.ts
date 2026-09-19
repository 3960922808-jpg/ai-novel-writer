import { describe, expect, it } from 'vitest'
import { buildConversationForAI, editorSessionChapterId } from '../src/services/conversation'

describe('对话持久化上下文', () => {
  it('兼容旧章节会话并识别新版多会话', () => {
    expect(editorSessionChapterId('chapter-1')).toBe('chapter-1')
    expect(editorSessionChapterId('editor:chapter-2:uuid-1')).toBe('chapter-2')
  })

  it('重启恢复时优先使用实际发送给模型的关联正文', () => {
    const result = buildConversationForAI([
      { role: 'user', content: '@第一章', requestContent: '【第一章正文】真实内容' },
      { role: 'assistant', content: '分析结果' }
    ])
    expect(result[0].content).toBe('【第一章正文】真实内容')
    expect(result[1].content).toBe('分析结果')
  })

  it('按字符预算保留最近对话', () => {
    const result = buildConversationForAI([
      { role: 'user', content: '旧'.repeat(20) },
      { role: 'assistant', content: '新'.repeat(8) }
    ], 10)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('新'.repeat(8))
  })
})
