import DOMPurify from 'dompurify'
import { marked } from 'marked'

/**
 * 把 Markdown 转成可安全交给 v-html 的 HTML。
 * AI 输出、导入文本和拆书结果都属于不可信输入，不能直接渲染 marked 的原始结果。
 */
export function renderSafeMarkdown(markdown: string): string {
  const source = markdown || ''
  let rendered: string
  try {
    rendered = marked.parse(source, { breaks: true, async: false }) as string
  } catch {
    rendered = escapeHtml(source).replace(/\n/g, '<br>')
  }

  const clean = DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'img', 'svg', 'math'],
    FORBID_ATTR: ['style', 'srcdoc'],
    ALLOW_DATA_ATTR: false
  })

  // 所有外链都交给 Electron 的受限外部链接处理器，避免在应用页面内导航。
  const template = document.createElement('template')
  template.innerHTML = clean
  for (const anchor of template.content.querySelectorAll('a')) {
    const href = anchor.getAttribute('href') || ''
    if (/^https?:\/\//i.test(href)) {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener noreferrer')
    } else if (!href.startsWith('#')) {
      anchor.removeAttribute('href')
    }
  }
  return template.innerHTML
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
