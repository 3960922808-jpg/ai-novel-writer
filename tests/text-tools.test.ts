import { describe, expect, it } from 'vitest'
import { cleanText, findTextMatches, htmlToPlainText, plainTextToHtml, replaceText, scanTerms } from '../src/services/text-tools'

describe('文本工具箱', () => {
  it('在富文本与纯文本之间安全转换', () => {
    expect(htmlToPlainText('<p>第一段&amp;内容</p><p>第二段<br>换行</p>')).toBe('第一段&内容\n第二段\n换行')
    expect(plainTextToHtml('<危险>\n\n下一段')).toBe('<p>&lt;危险&gt;</p><p>下一段</p>')
  })

  it('清理空行、标点和重复段落', () => {
    const input = '  他说,好吧...  \n\n\n他说,好吧...\n\n结尾!!!'
    expect(cleanText(input)).toBe('他说，好吧……\n\n结尾！！')
  })

  it('支持普通搜索、正则替换与词语扫描', () => {
    expect(findTextMatches('甲乙甲', '甲')).toHaveLength(2)
    expect(replaceText('第1章 第2章', '第(\\d)章', '卷$1', { regex: true })).toBe('卷1 卷2')
    expect(scanTerms('待补充内容，稍后待补充', ['待补充', '不存在'])[0].count).toBe(2)
  })
})
