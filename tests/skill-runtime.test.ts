import { describe, expect, it } from 'vitest'
import { appendSkillSupplement, buildLinkedReferenceBlock, buildSkillReferenceBlock } from '../src/services/skill-runtime'

describe('技能与关联资料运行时', () => {
  it('会把技能包参考资料放进真实请求文本', () => {
    const text = buildSkillReferenceBlock({
      name: '人物一致性检查',
      referenceFiles: [{ name: '人物设定.md', content: '主角不能使用魔法。' }]
    })
    expect(text).toContain('技能参考资料')
    expect(text).toContain('人物设定.md')
    expect(text).toContain('主角不能使用魔法。')
  })

  it('会合并多个技能的参考资料并保留技能来源', () => {
    const text = buildSkillReferenceBlock([
      { name: '节奏检查', referenceFiles: [{ name: '规则.md', content: '场景必须有转折。' }] },
      { name: '人物检查', referenceFiles: [{ name: '规则.md', content: '行为必须符合动机。' }] }
    ])
    expect(text).toContain('节奏检查 / 规则.md')
    expect(text).toContain('人物检查 / 规则.md')
    expect(text).toContain('行为必须符合动机。')
  })

  it('会把 @ 和附件内容标明来源后放进真实请求文本', () => {
    const text = buildLinkedReferenceBlock([
      { type: '章节', label: '第一章', content: '夜里下着雨。' },
      { type: '附件', label: '补充.md', content: '不要改动结局。' }
    ])
    expect(text).toContain('用户明确关联的资料')
    expect(text).toContain('章节 · 第一章')
    expect(text).toContain('夜里下着雨。')
    expect(text).toContain('不要改动结局。')
  })

  it('用户补充说明不会覆盖没有变量的技能任务', () => {
    const text = appendSkillSupplement('先检查人物动机，再给修改稿。', '语气冷一点', [])
    expect(text).toContain('先检查人物动机')
    expect(text).toContain('语气冷一点')
  })
})
