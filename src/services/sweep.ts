/**
 * 扫榜服务
 * - 主进程 sweep:fetch 只负责取回 HTML/JSON
 * - 本模块负责：榜单/详情/章节的解析 + AI 拆解 prompt 构建
 *
 * 设计取舍：
 * 番茄/起点等站点章节正文普遍有字体加密或反爬，
 * 直接 fetch 拿到的正文往往是乱码。
 * 因此本服务以"书名 + 简介 + 标签 + 章节标题"为主要拆解素材，
 * 章节标题已能反映节奏与钩子套路；用户也可手动粘贴正文片段增强拆解。
 */

// ====== 类型 ======

export interface RankSource {
  /** 唯一 id */
  id: string
  /** 展示名 */
  label: string
  /** 站点名 */
  site: 'fanqie' | 'qidian' | 'custom'
  /** 榜单 URL */
  url: string
  /** 抓取时使用的 Referer */
  referer?: string
}

export interface RankBook {
  /** 站内 id（番茄的 bookId / 起点的 bid） */
  bookId: string
  /** 书名 */
  title: string
  /** 作者 */
  author: string
  /** 简介 */
  summary: string
  /** 字数（字符串原样保留，如 "120.5万字"） */
  wordCount: string
  /** 分类/标签 */
  category: string
  /** 封面图 */
  cover: string
  /** 详情页 URL */
  detailUrl: string
  /** 抓取时的来源站点 */
  site: string
}

export interface ChapterBrief {
  /** 章节标题 */
  title: string
  /** 章节顺序（从 1 开始） */
  order: number
}

export interface BookDetail extends RankBook {
  /** 标签列表 */
  tags: string[]
  /** 章节标题列表（前 N 章） */
  chapters: ChapterBrief[]
  /** 状态：连载/完结 */
  status: string
  /** 评分 */
  score: string
}

export interface SweepAnalysis {
  /** 类型与标签判断 */
  genreTags: string
  /** 主角人设公式 */
  characterFormula: string
  /** 主线起承转合 */
  structure: string
  /** 爽点节奏（前5章/前30章/中段/高潮） */
  rhythm: string
  /** 章节钩子套路 */
  hookPattern: string
  /** 可复用的写作模板 */
  template: string
  /** 一句话总结 */
  oneLiner: string
}

export interface SweepRecord {
  id: string
  bookId: string
  title: string
  author: string
  summary: string
  tags: string[]
  category: string
  chapterTitles: string[]
  /** 用户手动粘贴的正文片段（可选） */
  excerpt: string
  analysis: SweepAnalysis
  source: string
  createdAt: number
}

// ====== 内置榜单 ======

export const BUILTIN_RANKS: RankSource[] = [
  {
    id: 'fanqie-boys-hot',
    label: '番茄 · 男生畅销榜',
    site: 'fanqie',
    url: 'https://fanqienovel.com/rank/most_read_boys',
    referer: 'https://fanqienovel.com/'
  },
  {
    id: 'fanqie-girls-hot',
    label: '番茄 · 女生畅销榜',
    site: 'fanqie',
    url: 'https://fanqienovel.com/rank/most_read_girls',
    referer: 'https://fanqienovel.com/'
  },
  {
    id: 'fanqie-finish',
    label: '番茄 · 完结榜',
    site: 'fanqie',
    url: 'https://fanqienovel.com/rank/finish',
    referer: 'https://fanqienovel.com/'
  },
  {
    id: 'fanqie-new',
    label: '番茄 · 新书榜',
    site: 'fanqie',
    url: 'https://fanqienovel.com/rank/new',
    referer: 'https://fanqienovel.com/'
  },
  {
    id: 'fanqie-rise',
    label: '番茄 · 飙升榜',
    site: 'fanqie',
    url: 'https://fanqienovel.com/rank/rise',
    referer: 'https://fanqienovel.com/'
  }
]

// ====== 通用 HTML 工具 ======

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 从 HTML 中提取所有非贪婪匹配 */
function matchAll(re: RegExp, html: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    out.push(m)
    if (re.lastIndex === m.index) re.lastIndex++ // 防止零宽匹配死循环
  }
  return out
}

/** 尝试从 HTML 里提取 __NEXT_DATA__ JSON（番茄/起点用 Next.js） */
function extractNextData(html: string): any | null {
  try {
    const m = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
    if (m && m[1]) {
      return JSON.parse(m[1].trim())
    }
  } catch {
    // ignore
  }
  return null
}

/** 深度遍历对象，找第一个满足 predicate 的值 */
function deepFind(obj: any, predicate: (v: any) => boolean): any | null {
  if (obj == null) return null
  if (predicate(obj)) return obj
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = deepFind(it, predicate)
      if (r) return r
    }
  } else if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const r = deepFind(obj[k], predicate)
      if (r) return r
    }
  }
  return null
}

/** 深度遍历对象，收集所有满足 predicate 的值 */
function deepCollect(obj: any, predicate: (v: any) => boolean, limit = 100): any[] {
  const out: any[] = []
  function walk(v: any) {
    if (out.length >= limit) return
    if (v == null) return
    if (predicate(v)) {
      out.push(v)
      return
    }
    if (Array.isArray(v)) {
      for (const it of v) walk(it)
    } else if (typeof v === 'object') {
      for (const k of Object.keys(v)) walk(v[k])
    }
  }
  walk(obj)
  return out
}

// ====== 番茄榜单解析 ======

/**
 * 解析番茄榜单页 HTML，提取作品列表
 * 番茄榜单页是 SSR 的，作品链接形如 /page/{bookId}
 */
export function parseFanqieRank(html: string): RankBook[] {
  // 优先从 __NEXT_DATA__ 提取
  const next = extractNextData(html)
  if (next) {
    const books = tryParseFanqieRankFromNext(next)
    if (books.length > 0) return books
  }
  // fallback：正则匹配 /page/{bookId} 链接
  return parseFanqieRankByRegex(html)
}

function tryParseFanqieRankFromNext(next: any): RankBook[] {
  const out: RankBook[] = []
  const seen = new Set<string>()
  // 番茄 __NEXT_DATA__ 里 book 对象通常有 bookId/book_id + book_name/author/abstract 字段
  const candidates = deepCollect(
    next,
    v =>
      v &&
      typeof v === 'object' &&
      (v.bookId || v.book_id) &&
      (v.bookName || v.book_name || v.title)
  )
  for (const b of candidates) {
    const bookId = String(b.bookId || b.book_id || '')
    if (!bookId || seen.has(bookId)) continue
    seen.add(bookId)
    out.push({
      bookId,
      title: String(b.bookName || b.book_name || b.title || ''),
      author: String(b.author || b.authorName || ''),
      summary: String(b.abstract || b.summary || b.desc || ''),
      wordCount: String(b.wordNumber || b.word_count || b.words || ''),
      category: String(b.category || b.categoryName || b.genre || ''),
      cover: String(b.thumb || b.cover || ''),
      detailUrl: `https://fanqienovel.com/page/${bookId}`,
      site: 'fanqie'
    })
  }
  return out
}

function parseFanqieRankByRegex(html: string): RankBook[] {
  const out: RankBook[] = []
  const seen = new Set<string>()
  // 匹配 /page/{bookId}，bookId 是纯数字
  const linkRe = /href=["']\/page\/(\d{5,})["'][^>]*>([\s\S]*?)<\/a>/g
  for (const m of matchAll(linkRe, html)) {
    const bookId = m[1]
    if (seen.has(bookId)) continue
    seen.add(bookId)
    const inner = m[2]
    // 内部可能含 <p class="rank_i_t">书名</p> 等
    const title = stripTags(inner.match(/<[^>]*rank[^>]*i[^>]*_t[^>]*>([\s\S]*?)<\//)?.[1] || inner)
      .split(/\s+/)[0]
      .slice(0, 40)
    if (!title) continue
    out.push({
      bookId,
      title,
      author: '',
      summary: '',
      wordCount: '',
      category: '',
      cover: '',
      detailUrl: `https://fanqienovel.com/page/${bookId}`,
      site: 'fanqie'
    })
  }
  return out
}

// ====== 番茄作品详情解析 ======

export function parseFanqieDetail(html: string, bookId: string): BookDetail | null {
  const next = extractNextData(html)
  if (next) {
    const detail = tryParseFanqieDetailFromNext(next, bookId)
    if (detail) return detail
  }
  return parseFanqieDetailByRegex(html, bookId)
}

function tryParseFanqieDetailFromNext(next: any, bookId: string): BookDetail | null {
  // 找包含该 bookId 的 book 对象
  const book = deepFind(
    next,
    v =>
      v &&
      typeof v === 'object' &&
      String(v.bookId || v.book_id || '') === String(bookId)
  )
  if (!book) return null
  // 章节列表通常在 itemDataList / chapterList / chapters 字段
  let chapters: ChapterBrief[] = []
  const chapList =
    book.itemDataList || book.chapterList || book.chapters || book.directoryList || []
  if (Array.isArray(chapList)) {
    chapters = chapList
      .map((c: any, i: number) => ({
        title: String(c.title || c.chapterName || c.content || ''),
        order: Number(c.index ?? c.order ?? i + 1)
      }))
      .filter(c => c.title)
  }
  const tags: string[] = []
  if (Array.isArray(book.tag)) {
    for (const t of book.tag) tags.push(String(t))
  } else if (Array.isArray(book.tags)) {
    for (const t of book.tags) tags.push(String(t))
  }
  return {
    bookId,
    title: String(book.bookName || book.book_name || book.title || ''),
    author: String(book.author || book.authorName || ''),
    summary: String(book.abstract || book.summary || book.desc || ''),
    wordCount: String(book.wordNumber || book.word_count || book.words || ''),
    category: String(book.category || book.categoryName || book.genre || ''),
    cover: String(book.thumb || book.cover || ''),
    detailUrl: `https://fanqienovel.com/page/${bookId}`,
    site: 'fanqie',
    tags,
    chapters,
    status: String(book.bookStatus || book.status || ''),
    score: String(book.score || book.rating || '')
  }
}

function parseFanqieDetailByRegex(html: string, bookId: string): BookDetail | null {
  // 简单正则兜底，提取页面上能看到的书名/作者/简介
  const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const authorM = html.match(/作者[：:\s]*<[^>]+>([\s\S]*?)<\//)
  const summaryM = html.match(/简介[：:\s]*([\s\S]*?)(?:<\/p>|<\/div>)/)
  const title = titleM ? stripTags(titleM[1]) : ''
  if (!title) return null
  return {
    bookId,
    title,
    author: authorM ? stripTags(authorM[1]) : '',
    summary: summaryM ? stripTags(summaryM[1]) : '',
    wordCount: '',
    category: '',
    cover: '',
    detailUrl: `https://fanqienovel.com/page/${bookId}`,
    site: 'fanqie',
    tags: [],
    chapters: [],
    status: '',
    score: ''
  }
}

// ====== 抓取封装 ======

/** 抓取榜单 */
export async function fetchRank(rank: RankSource): Promise<RankBook[]> {
  const html = (await window.api.sweep.fetch(rank.url, {
    referer: rank.referer,
    timeout: 20000
  })) as string
  if (rank.site === 'fanqie') {
    return parseFanqieRank(html)
  }
  // 通用 fallback：尝试番茄解析器（结构类似）
  return parseFanqieRank(html)
}

/** 抓取作品详情（含章节列表） */
export async function fetchBookDetail(book: RankBook): Promise<BookDetail | null> {
  const html = (await window.api.sweep.fetch(book.detailUrl, {
    referer: 'https://fanqienovel.com/',
    timeout: 20000
  })) as string
  if (book.site === 'fanqie') {
    return parseFanqieDetail(html, book.bookId)
  }
  return parseFanqieDetail(html, book.bookId)
}

// ====== AI 拆解 prompt ======

/**
 * 构建扫榜拆解 prompt
 * 输入：书名 + 简介 + 标签 + 章节标题（前 N 章）+ 可选正文片段
 * 输出：结构化 JSON
 */
export function buildSweepPrompt(opts: {
  title: string
  author: string
  summary: string
  tags: string[]
  category: string
  chapterTitles: string[]
  excerpt?: string
}): { system: string; user: string } {
  const system = `你是资深网文扫榜分析师，擅长从作品公开信息（简介、标签、章节标题、可选正文片段）中拆解热门网文的套路。
请基于给出的事实信息进行分析，不要凭空编造剧情细节；若信息不足以判断某项，请明确写"信息不足"。
输出必须是严格的 JSON，不要 markdown 代码块、不要解释文字。

JSON 字段定义：
{
  "genreTags": "类型与标签判断（如：都市修真+爽文+系统流+无敌流）",
  "characterFormula": "主角人设公式（如：废柴逆袭+金手指+扮猪吃虎，给出具体人设标签组合）",
  "structure": "主线起承转合（基于章节标题推测的整体走向）",
  "rhythm": "爽点节奏（前5章/前30章/中段/高潮 分别是什么节奏，信息密度如何）",
  "hookPattern": "章节钩子套路（每章结尾埋什么悬念，可复用的钩子模板）",
  "template": "可复用的写作模板（3 条以上，可直接套用到新作品）",
  "oneLiner": "一句话总结这本作品的核心卖点"
}`

  const chapterList = (opts.chapterTitles || [])
    .slice(0, 60)
    .map((t, i) => `第${i + 1}章 ${t}`)
    .join('\n')

  const user = `请拆解以下作品：

【标题】${opts.title}
【作者】${opts.author}
【分类】${opts.category || '（未标注）'}
【标签】${(opts.tags || []).join(' / ') || '（无）'}
【简介】
${opts.summary || '（无简介）'}

【章节标题（前 ${Math.min(60, opts.chapterTitles?.length || 0)} 章）】
${chapterList || '（未抓取到章节列表）'}
${opts.excerpt ? `\n【正文片段】\n${opts.excerpt.slice(0, 6000)}` : ''}

请基于以上信息输出 JSON 拆解报告。`

  return { system, user }
}

/** 解析 AI 返回的 JSON 拆解结果 */
export function parseSweepAnalysis(text: string): SweepAnalysis {
  const empty: SweepAnalysis = {
    genreTags: '',
    characterFormula: '',
    structure: '',
    rhythm: '',
    hookPattern: '',
    template: '',
    oneLiner: ''
  }
  if (!text) return empty
  let t = text.trim()
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const s = t.indexOf('{')
  const e = t.lastIndexOf('}')
  if (s >= 0 && e > s) t = t.slice(s, e + 1)
  try {
    const obj = JSON.parse(t)
    return {
      genreTags: String(obj.genreTags || ''),
      characterFormula: String(obj.characterFormula || ''),
      structure: String(obj.structure || ''),
      rhythm: String(obj.rhythm || ''),
      hookPattern: String(obj.hookPattern || ''),
      template: String(obj.template || ''),
      oneLiner: String(obj.oneLiner || '')
    }
  } catch {
    return empty
  }
}

/**
 * 构建多本作品横向对比 prompt
 * 输出每个作品在 6 个维度的简短摘要 + 共性套路总结
 */
export function buildComparePrompt(records: SweepRecord[]): { system: string; user: string } {
  const system = `你是网文市场分析师。请对多本热门作品做横向对比，找出共性套路与差异化卖点。
输出严格 JSON：
{
  "commonPatterns": ["共性套路1", "共性套路2", ...],
  "differences": [{"title":"书名","uniqueSellingPoint":"差异化卖点"}, ...],
  "marketTrend": "当前榜单趋势判断（150字内）",
  "recommendations": ["可复用建议1","可复用建议2", ...]
}
不要 markdown、不要解释。`

  const lines: string[] = []
  for (const r of records) {
    lines.push(`《${r.title}》（${r.author}）`)
    lines.push(`  类型标签：${r.analysis.genreTags}`)
    lines.push(`  人设公式：${r.analysis.characterFormula}`)
    lines.push(`  节奏：${r.analysis.rhythm}`)
    lines.push(`  钩子套路：${r.analysis.hookPattern}`)
    lines.push(`  一句话：${r.analysis.oneLiner}`)
    lines.push('')
  }
  const user = `请横向对比以下 ${records.length} 本作品并输出 JSON：\n\n${lines.join('\n')}`
  return { system, user }
}

export interface CompareResult {
  commonPatterns: string[]
  differences: Array<{ title: string; uniqueSellingPoint: string }>
  marketTrend: string
  recommendations: string[]
}

export function parseCompareResult(text: string): CompareResult {
  const empty: CompareResult = {
    commonPatterns: [],
    differences: [],
    marketTrend: '',
    recommendations: []
  }
  if (!text) return empty
  let t = text.trim()
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const s = t.indexOf('{')
  const e = t.lastIndexOf('}')
  if (s >= 0 && e > s) t = t.slice(s, e + 1)
  try {
    const obj = JSON.parse(t)
    return {
      commonPatterns: Array.isArray(obj.commonPatterns) ? obj.commonPatterns.map(String) : [],
      differences: Array.isArray(obj.differences)
        ? obj.differences.map((d: any) => ({
            title: String(d?.title || ''),
            uniqueSellingPoint: String(d?.uniqueSellingPoint || '')
          }))
        : [],
      marketTrend: String(obj.marketTrend || ''),
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations.map(String) : []
    }
  } catch {
    return empty
  }
}
