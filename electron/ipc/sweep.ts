import { ipcMain } from 'electron'
import { assertPublicHttpUrl } from '../lib/security'

/**
 * 扫榜 IPC
 * 提供通用的网页抓取能力（带浏览器 UA / Referer / gzip），
 * 具体的榜单/详情/章节解析放在前端 services/sweep.ts，
 * 主进程只负责"取回原始文本"，不做业务解析。
 */

export interface FetchOptions {
  /** 自定义 Referer，部分站点（番茄/起点）会校验 */
  referer?: string
  /** 超时毫秒，默认 15s */
  timeout?: number
  /** 是否返回 JSON（自动 JSON.parse），默认 false 返回 HTML 文本 */
  asJson?: boolean
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024
const MAX_BATCH_URLS = 100
const MAX_REDIRECTS = 5

async function readLimitedBody(resp: Response): Promise<string> {
  const declared = Number(resp.headers.get('content-length') || 0)
  if (declared > MAX_RESPONSE_BYTES) throw new Error('响应内容超过 10 MB 限制')
  if (!resp.body) return ''
  const reader = resp.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel('响应过大')
      throw new Error('响应内容超过 10 MB 限制')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')
}

/** 单次抓取的统一实现（单条与批量共用） */
async function fetchOnce(url: string, opts?: FetchOptions): Promise<any> {
  const timeout = Math.min(Math.max(opts?.timeout ?? 15000, 3000), 30000)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      'Accept': opts?.asJson
        ? 'application/json, text/plain, */*'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    }
    if (opts?.referer) headers['Referer'] = opts.referer
    let current = await assertPublicHttpUrl(url)
    let resp: Response | null = null
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      resp = await fetch(current, { method: 'GET', headers, signal: ctrl.signal, redirect: 'manual' })
      if (resp.status < 300 || resp.status >= 400) break
      const location = resp.headers.get('location')
      if (!location) throw new Error('重定向响应缺少目标地址')
      if (redirectCount === MAX_REDIRECTS) throw new Error('重定向次数过多')
      current = await assertPublicHttpUrl(new URL(location, current).toString())
    }
    if (!resp) throw new Error('未收到网络响应')
    if (!resp.ok) {
      const txt = await readLimitedBody(resp).catch(() => '')
      throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 200) || resp.statusText}`)
    }
    const text = await readLimitedBody(resp)
    if (!opts?.asJson) return text
    try { return JSON.parse(text) } catch { throw new Error('响应不是有效的 JSON') }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`请求超时（${timeout}ms）：${url}`)
    }
    throw new Error('抓取失败：' + (e?.message || '未知错误'))
  } finally {
    clearTimeout(timer)
  }
}

export function registerSweepIPC() {
  /** 通用 GET 抓取 */
  ipcMain.handle('sweep:fetch', async (_e, url: string, opts?: FetchOptions) => {
    if (!url || typeof url !== 'string') {
      throw new Error('URL 不能为空')
    }
    return fetchOnce(url, opts)
  })

  /** 批量并发抓取（限制并发数，避免被风控） */
  ipcMain.handle(
    'sweep:fetchBatch',
    async (_e, urls: string[], opts?: FetchOptions & { concurrency?: number }) => {
      if (!Array.isArray(urls) || urls.length === 0) return []
      if (urls.length > MAX_BATCH_URLS) throw new Error(`单次最多抓取 ${MAX_BATCH_URLS} 个地址`)
      const concurrency = Math.min(Math.max(opts?.concurrency ?? 3, 1), 6)
      const results: Array<{ url: string; ok: boolean; data?: any; error?: string }> = []
      // 预先占位，保证顺序
      for (let i = 0; i < urls.length; i++) {
        results.push({ url: urls[i], ok: false, error: 'pending' })
      }
      let cursor = 0

      async function worker() {
        while (cursor < urls.length) {
          const idx = cursor++
          const u = urls[idx]
          try {
            const r = await fetchOnce(u, opts)
            results[idx] = { url: u, ok: true, data: r }
          } catch (e: any) {
            results[idx] = { url: u, ok: false, error: e?.message || '失败' }
          }
        }
      }

      const workers = Array.from({ length: concurrency }, () => worker())
      await Promise.all(workers)
      return results
    }
  )
}
