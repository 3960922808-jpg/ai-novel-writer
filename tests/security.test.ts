import { describe, expect, it } from 'vitest'
import { isPrivateOrReservedAddress, isSafeExternalUrl, parseHttpUrl } from '../electron/lib/security'

describe('URL 与网络边界校验', () => {
  it('只允许普通 HTTP(S) 外链', () => {
    expect(isSafeExternalUrl('https://github.com/example')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
    expect(isSafeExternalUrl('file:///C:/Windows/win.ini')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('https://user:pass@example.com')).toBe(false)
  })

  it('拒绝无效协议', () => {
    expect(() => parseHttpUrl('ftp://example.com/a')).toThrow('仅允许 HTTP 或 HTTPS 地址')
  })

  it('识别私网、回环和保留地址', () => {
    for (const address of ['127.0.0.1', '10.0.0.8', '172.16.1.1', '192.168.1.1', '169.254.1.2', '::1', 'fd00::1', 'fe80::1']) {
      expect(isPrivateOrReservedAddress(address), address).toBe(true)
    }
    expect(isPrivateOrReservedAddress('8.8.8.8')).toBe(false)
    expect(isPrivateOrReservedAddress('2606:4700:4700::1111')).toBe(false)
  })
})
