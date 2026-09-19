import { describe, expect, it } from 'vitest'
import { sanitizeDocumentHtml } from '../electron/lib/html'

describe('导出富文本清理', () => {
  it('保留小说常用排版标签', () => {
    expect(sanitizeDocumentHtml('<p><strong>正文</strong></p>')).toBe('<p><strong>正文</strong></p>')
  })

  it('移除脚本、事件和危险链接', () => {
    const html = sanitizeDocumentHtml('<p onclick="alert(1)">正文</p><script>alert(2)</script><a href="javascript:alert(3)">链接</a>')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
  })
})
