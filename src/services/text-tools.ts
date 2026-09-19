export interface TextCleanOptions {
  trimLines?: boolean
  normalizeBlankLines?: boolean
  normalizePunctuation?: boolean
  removeDuplicateParagraphs?: boolean
}

export interface TextMatch {
  index: number
  length: number
  value: string
  line: number
  snippet: string
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
}

export function htmlToPlainText(value: string): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_all, code: string) => {
      if (code[0] === '#') {
        const hex = code[1]?.toLowerCase() === 'x'
        const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
        return Number.isFinite(number) ? String.fromCodePoint(number) : _all
      }
      return HTML_ENTITIES[code.toLowerCase()] ?? _all
    })
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function plainTextToHtml(value: string): string {
  const escaped = String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  return escaped
    .split(/\n{2,}/)
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function normalizeChinesePunctuation(value: string): string {
  return String(value || '')
    .replace(/\.{3,}/g, '……')
    .replace(/…{3,}/g, '……')
    .replace(/-{2,}/g, '——')
    .replace(/([\u3400-\u9fff]),/g, '$1，')
    .replace(/([\u3400-\u9fff]):/g, '$1：')
    .replace(/([\u3400-\u9fff]);/g, '$1；')
    .replace(/!+/g, marks => '！'.repeat(Math.min(2, marks.length)))
    .replace(/\?+/g, marks => '？'.repeat(Math.min(2, marks.length)))
    .replace(/[ \t]+([，。！？；：、])/g, '$1')
    .replace(/([，。！？；：、])[ \t]+/g, '$1')
    .replace(/([！？。])\1{2,}/g, '$1$1')
}

export function cleanText(value: string, options: TextCleanOptions = {}): string {
  const config = {
    trimLines: true,
    normalizeBlankLines: true,
    normalizePunctuation: true,
    removeDuplicateParagraphs: true,
    ...options
  }
  let text = String(value || '').replace(/\r\n?/g, '\n')
  if (config.trimLines) text = text.split('\n').map(line => line.trim()).join('\n')
  if (config.normalizePunctuation) text = normalizeChinesePunctuation(text)
  if (config.normalizeBlankLines) text = text.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
  if (config.removeDuplicateParagraphs) {
    const seen = new Set<string>()
    text = text.split(/\n{2,}/).filter(paragraph => {
      const key = paragraph.replace(/\s+/g, '').trim()
      if (!key || !seen.has(key)) {
        if (key) seen.add(key)
        return true
      }
      return false
    }).join('\n\n')
  }
  return text.trim()
}

function compileSearch(pattern: string, regex: boolean, caseSensitive: boolean): RegExp {
  const source = regex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(source, caseSensitive ? 'g' : 'gi')
}

export function findTextMatches(value: string, pattern: string, options: { regex?: boolean; caseSensitive?: boolean } = {}): TextMatch[] {
  if (!pattern) return []
  const text = String(value || '')
  const expression = compileSearch(pattern, !!options.regex, !!options.caseSensitive)
  const matches: TextMatch[] = []
  let match: RegExpExecArray | null
  while ((match = expression.exec(text)) !== null) {
    const start = match.index
    const line = text.slice(0, start).split('\n').length
    matches.push({
      index: start,
      length: match[0].length,
      value: match[0],
      line,
      snippet: text.slice(Math.max(0, start - 24), Math.min(text.length, start + match[0].length + 36)).replace(/\n/g, ' ')
    })
    if (match[0].length === 0) expression.lastIndex += 1
    if (matches.length >= 10_000) break
  }
  return matches
}

export function replaceText(value: string, pattern: string, replacement: string, options: { regex?: boolean; caseSensitive?: boolean } = {}): string {
  if (!pattern) return value
  return String(value || '').replace(compileSearch(pattern, !!options.regex, !!options.caseSensitive), replacement)
}

export function scanTerms(value: string, terms: string[]): Array<{ term: string; count: number; matches: TextMatch[] }> {
  const unique = [...new Set(terms.map(term => term.trim()).filter(Boolean))]
  return unique.map(term => {
    const matches = findTextMatches(value, term)
    return { term, count: matches.length, matches: matches.slice(0, 20) }
  }).filter(item => item.count > 0)
}
