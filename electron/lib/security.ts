import dns from 'node:dns/promises'
import net from 'node:net'

export function parseHttpUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('URL 格式无效')
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅允许 HTTP 或 HTTPS 地址')
  if (url.username || url.password) throw new Error('URL 不允许包含用户名或密码')
  return url
}

export function isSafeExternalUrl(raw: string): boolean {
  try {
    parseHttpUrl(raw)
    return true
  } catch {
    return false
  }
}

export function isPrivateOrReservedAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0]
  if (net.isIPv4(normalized)) {
    const [a, b, c] = normalized.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
  }
  if (net.isIPv6(normalized)) {
    if (normalized.startsWith('::ffff:')) {
      return isPrivateOrReservedAddress(normalized.slice(7))
    }
    return normalized === '::' || normalized === '::1' ||
      normalized.startsWith('fc') || normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) || normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
  }
  return true
}

/** 阻止扫榜抓取访问本机、局域网、保留地址和内部域名。 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  const url = parseHttpUrl(raw)
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('禁止访问本机或内部网络地址')
  }
  if (net.isIP(host)) {
    if (isPrivateOrReservedAddress(host)) throw new Error('禁止访问本机、局域网或保留地址')
    return url
  }
  const addresses = await dns.lookup(host, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some(item => isPrivateOrReservedAddress(item.address))) {
    throw new Error('目标域名解析到了本机、局域网或保留地址')
  }
  return url
}
