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
  /** 榜单 URL（番茄新版用 API 地址，含 rank_type 与 gender 参数） */
  url: string
  /** 抓取时使用的 Referer */
  referer?: string
  /** 番茄 API 模式：rank_type 参数 */
  rankType?: string
  /** 番茄 API 模式：gender 参数（male/female） */
  gender?: 'male' | 'female'
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
// 番茄 2024+ 改版：榜单页改为客户端 JS 动态请求 API 加载，SSR HTML 不再含作品列表。
// 直接抓 HTML 会解析为空，必须改调官方榜单 API：
//   /api/rank/list?rank_type=xxx&gender=male|female&page_count=0&page_index=0
// rank_type: most_read(畅销) / finish(完结) / rise(飙升) / new(新书)
// gender: male(男生) / female(女生)
const FANQIE_RANK_API = 'https://fanqienovel.com/api/rank/list'
const FANQIE_REFERER = 'https://fanqienovel.com/'

export const BUILTIN_RANKS: RankSource[] = [
  {
    id: 'fanqie-boys-hot',
    label: '番茄 · 男生畅销榜',
    site: 'fanqie',
    url: FANQIE_RANK_API,
    referer: FANQIE_REFERER,
    rankType: 'most_read',
    gender: 'male'
  },
  {
    id: 'fanqie-girls-hot',
    label: '番茄 · 女生畅销榜',
    site: 'fanqie',
    url: FANQIE_RANK_API,
    referer: FANQIE_REFERER,
    rankType: 'most_read',
    gender: 'female'
  },
  {
    id: 'fanqie-boys-finish',
    label: '番茄 · 男生完结榜',
    site: 'fanqie',
    url: FANQIE_RANK_API,
    referer: FANQIE_REFERER,
    rankType: 'finish',
    gender: 'male'
  },
  {
    id: 'fanqie-girls-finish',
    label: '番茄 · 女生完结榜',
    site: 'fanqie',
    url: FANQIE_RANK_API,
    referer: FANQIE_REFERER,
    rankType: 'finish',
    gender: 'female'
  },
  {
    id: 'fanqie-rise',
    label: '番茄 · 飙升榜',
    site: 'fanqie',
    url: FANQIE_RANK_API,
    referer: FANQIE_REFERER,
    rankType: 'rise',
    gender: 'male'
  },
  {
    id: 'fanqie-new',
    label: '番茄 · 新书榜',
    site: 'fanqie',
    url: FANQIE_RANK_API,
    referer: FANQIE_REFERER,
    rankType: 'new',
    gender: 'male'
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

/**
 * 从 HTML 中提取 window.__INITIAL_STATE__ = {...} 的 JSON 对象。
 * 番茄 2024+ 改版后用此结构（不再用 __NEXT_DATA__）。
 * 用花括号配对扫描而非正则，避免 JSON 过长时非贪婪匹配截断。
 */
function extractInitialState(html: string): any | null {
  const marker = '__INITIAL_STATE__'
  const start = html.indexOf(marker)
  if (start < 0) return null
  // 找到赋值后的第一个 {
  let i = html.indexOf('{', start)
  if (i < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (; i < html.length; i++) {
    const ch = html[i]
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const jsonStr = html.slice(html.indexOf('{', start), i + 1)
        try {
          return JSON.parse(jsonStr)
        } catch {
          return null
        }
      }
    }
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
 * 解析番茄榜单。
 * 新版番茄（2024+）榜单页 SSR HTML 不含作品列表，需调
 *   /api/rank/list?rank_type=xxx&gender=male|female&page_count=0&page_index=0
 * 返回 {data:{list:[{bookId,bookName,thumbUri,abstract,author}, ...], total}}
 * 同时保留旧版 HTML 解析作为 fallback（兼容回退 / 自定义 URL）。
 */
export function parseFanqieRank(htmlOrJson: string): RankBook[] {
  // 1. 优先尝试 JSON（新版 API 模式）
  const fromJson = tryParseFanqieRankJson(htmlOrJson)
  if (fromJson.length > 0) return fromJson
  // 2. fallback：旧版 __NEXT_DATA__
  const next = extractNextData(htmlOrJson)
  if (next) {
    const books = tryParseFanqieRankFromNext(next)
    if (books.length > 0) return books
  }
  // 3. fallback：正则匹配 /page/{bookId} 链接（最老的 SSR 版本）
  return parseFanqieRankByRegex(htmlOrJson)
}

/** 把字数（数字或字符串）格式化为"xx.x万字"，便于阅读 */
function formatWordCount(v: any): string {
  const n = Number(v)
  if (!n || isNaN(n)) return String(v || '')
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万字'
  return n + '字'
}

/** 解析番茄榜单 API 返回的 JSON */
function tryParseFanqieRankJson(raw: string): RankBook[] {
  let obj: any
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return []
  }
  if (!obj || typeof obj !== 'object') return []
  const list = obj?.data?.list || obj?.data?.bookList || obj?.list || []
  if (!Array.isArray(list) || list.length === 0) return []
  const out: RankBook[] = []
  for (const b of list) {
    if (!b || typeof b !== 'object') continue
    const bookId = String(b.bookId || b.book_id || '')
    if (!bookId) continue
    out.push({
      bookId,
      title: String(b.bookName || b.book_name || b.title || ''),
      author: String(b.author || b.authorName || ''),
      summary: String(b.abstract || b.summary || b.desc || ''),
      wordCount: formatWordCount(b.wordNumber || b.word_count || b.words),
      category: String(b.category || b.categoryName || b.genre || ''),
      cover: String(b.thumbUri || b.thumb || b.cover || ''),
      detailUrl: `https://fanqienovel.com/page/${bookId}`,
      site: 'fanqie'
    })
  }
  return out
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

/**
 * 解析番茄作品详情页 HTML，提取书名/作者/简介/字数/分类/标签。
 * 番茄 2024+ 改版后：
 *   - 详情页用 window.__INITIAL_STATE__.page 注入数据（含 bookName/author/abstract/wordNumber/category 等）
 *   - chapterList 为空（章节需另外调目录 API，见 fetchFanqieChapters）
 * 保留旧版 __NEXT_DATA__ 与正则 fallback 兼容回退。
 */
export function parseFanqieDetail(html: string, bookId: string): BookDetail | null {
  // 1. 优先 __INITIAL_STATE__（新版）
  const state = extractInitialState(html)
  if (state) {
    const detail = tryParseFanqieDetailFromState(state, bookId)
    if (detail) return detail
  }
  // 2. fallback __NEXT_DATA__（旧版）
  const next = extractNextData(html)
  if (next) {
    const detail = tryParseFanqieDetailFromNext(next, bookId)
    if (detail) return detail
  }
  // 3. fallback 正则
  return parseFanqieDetailByRegex(html, bookId)
}

/** 从 __INITIAL_STATE__.page 提取详情（新版番茄） */
function tryParseFanqieDetailFromState(state: any, bookId: string): BookDetail | null {
  const page = state?.page
  if (!page || typeof page !== 'object') return null
  const title = String(page.bookName || page.book_name || page.title || '')
  if (!title) return null
  // categoryV2 在部分版本是结构化数组，部分版本是字符串，统一兼容
  const tags: string[] = []
  if (Array.isArray(page.categoryV2)) {
    for (const t of page.categoryV2) {
      const name = t?.Name || t?.name
      if (name) tags.push(String(name))
    }
  }
  // category 字段形如 "男生/都市/都市重生"，切分后作为标签补充（去重）
  const categoryStr = String(page.category || '')
  if (categoryStr) {
    for (const seg of categoryStr.split('/')) {
      const s = seg.trim()
      if (s && !tags.includes(s)) tags.push(s)
    }
  }
  return {
    bookId,
    title,
    author: String(page.author || page.authorName || ''),
    summary: String(page.abstract || page.summary || page.desc || ''),
    wordCount: formatWordCount(page.wordNumber || page.word_count || page.words),
    category: categoryStr,
    cover: String(page.thumbUri || page.thumb || page.cover || ''),
    detailUrl: `https://fanqienovel.com/page/${bookId}`,
    site: 'fanqie',
    tags,
    chapters: [], // 新版章节需调目录 API，见 fetchFanqieChapters
    status: String(page.bookStatus || page.status || ''),
    score: String(page.score || page.rating || '')
  }
}

/**
 * 解析番茄目录 API 返回的 JSON，提取章节标题列表。
 * API: /api/reader/directory/detail?bookId=xxx
 * 返回 {data:{allItemIds:[...], chapterListWithVolume:[[{itemId,title,...}, ...], ...]}}
 * chapterListWithVolume 是「卷」的数组，每卷是章节对象的数组。
 */
export function parseFanqieChapters(json: any): ChapterBrief[] {
  const out: ChapterBrief[] = []
  let order = 0
  const data = json?.data ?? json
  const volumes = data?.chapterListWithVolume
  if (Array.isArray(volumes)) {
    for (const vol of volumes) {
      if (!Array.isArray(vol)) continue
      for (const c of vol) {
        const title = String(c?.title || c?.chapterName || c?.name || '')
        if (!title) continue
        order++
        out.push({ title, order })
      }
    }
  }
  // 兜底：扁平 chapterList
  if (out.length === 0 && Array.isArray(data?.chapterList)) {
    for (const c of data.chapterList) {
      const title = String(c?.title || c?.chapterName || '')
      if (!title) continue
      order++
      out.push({ title, order })
    }
  }
  return out
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

/**
 * 抓取榜单。
 * 番茄新版：rank 配了 rankType 时走 /api/rank/list API（返回 JSON），
 *           没配 rankType（自定义 URL）则按原 URL 抓取（HTML 或 JSON 均兼容解析）。
 */
export async function fetchRank(rank: RankSource): Promise<RankBook[]> {
  if (rank.site === 'fanqie' && rank.rankType) {
    // 新版 API 模式：拼装 rank_type + gender 参数
    const gender = rank.gender || 'male'
    const apiUrl = `${rank.url}?rank_type=${encodeURIComponent(rank.rankType)}&gender=${gender}&page_count=0&page_index=0`
    const json = (await window.api.sweep.fetch(apiUrl, {
      referer: rank.referer,
      timeout: 20000,
      asJson: true
    })) as any
    return parseFanqieRank(JSON.stringify(json))
  }
  // 自定义 URL：可能是 HTML 也可能是 JSON，统一抓回文本交给 parseFanqieRank 自动识别
  const raw = (await window.api.sweep.fetch(rank.url, {
    referer: rank.referer,
    timeout: 20000
  })) as string
  return parseFanqieRank(raw)
}

/**
 * 抓取作品详情（含章节列表）。
 * 番茄新版详情页 chapterList 为空，需额外调目录 API 拿章节标题。
 */
export async function fetchBookDetail(book: RankBook): Promise<BookDetail | null> {
  if (book.site === 'fanqie') {
    // 1. 抓详情页 HTML，提取书名/作者/简介/字数/分类/标签
    const html = (await window.api.sweep.fetch(book.detailUrl, {
      referer: 'https://fanqienovel.com/',
      timeout: 20000
    })) as string
    const detail = parseFanqieDetail(html, book.bookId)
    if (!detail) return null
    // 2. 调目录 API 补全章节标题（失败不阻塞，章节为空也能拆解）
    try {
      const dirJson = (await window.api.sweep.fetch(
        `https://fanqienovel.com/api/reader/directory/detail?bookId=${book.bookId}`,
        { referer: book.detailUrl, timeout: 20000, asJson: true }
      )) as any
      detail.chapters = parseFanqieChapters(dirJson)
    } catch {
      // 目录 API 失败不影响主流程，章节留空
    }
    return detail
  }
  // 通用 fallback
  const html = (await window.api.sweep.fetch(book.detailUrl, {
    referer: 'https://fanqienovel.com/',
    timeout: 20000
  })) as string
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
