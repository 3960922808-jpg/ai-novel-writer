import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const window = new JSDOM('').window
const purifier = createDOMPurify(window)

/** 清理导出 HTML/EPUB/PDF 中的章节富文本，保留排版但移除可执行内容。 */
export function sanitizeDocumentHtml(value: unknown): string {
  return purifier.sanitize(String(value || ''), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math'],
    FORBID_ATTR: ['style', 'srcdoc'],
    ALLOW_DATA_ATTR: false
  }) as string
}
