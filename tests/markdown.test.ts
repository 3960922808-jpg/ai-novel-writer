import { describe, expect, it } from 'vitest'
import { renderSafeMarkdown } from '../src/services/markdown'

describe('安全 Markdown 渲染', () => {
  it('保留常用 Markdown 格式', () => {
    const html = renderSafeMarkdown('## 标题\n\n**加粗**')
    expect(html).toContain('<h2>标题</h2>')
    expect(html).toContain('<strong>加粗</strong>')
  })

  it('移除脚本、事件处理器和危险协议', () => {
    const html = renderSafeMarkdown('<script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(2)">危险</a>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('javascript:')
  })

  it('禁用远程图片并隔离外部链接', () => {
    const html = renderSafeMarkdown('![跟踪](https://example.com/a.png) [资料](https://example.com)')
    expect(html).not.toContain('<img')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('noopener noreferrer')
  })
})
