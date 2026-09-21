import type { Skill } from '@/types'

export interface RuntimeLinkedItem {
  type?: string
  label: string
  content: string
}

const MAX_SINGLE_REFERENCE_CHARS = 12_000
const MAX_REFERENCE_TOTAL_CHARS = 48_000

function boundedBlocks(
  items: Array<{ name: string; content: string }>,
  title: string,
  label: string
): string {
  let used = 0
  const blocks: string[] = []
  for (const item of items) {
    if (used >= MAX_REFERENCE_TOTAL_CHARS) break
    const remaining = MAX_REFERENCE_TOTAL_CHARS - used
    const max = Math.min(MAX_SINGLE_REFERENCE_CHARS, remaining)
    const source = String(item.content || '').trim()
    if (!source) continue
    const content = source.length > max ? `${source.slice(0, max)}\n……（资料过长，已截取）` : source
    blocks.push(`【${label}：${item.name}】\n${content}`)
    used += content.length
  }
  return blocks.length ? `【${title}】\n${blocks.join('\n\n')}` : ''
}

/** 生成技能包参考资料块。返回值会直接加入模型请求，而不只是显示在界面上。 */
export function buildSkillReferenceBlock(
  input?: Pick<Skill, 'name' | 'referenceFiles'> | Array<Pick<Skill, 'name' | 'referenceFiles'>> | null
): string {
  const skills = Array.isArray(input) ? input : (input ? [input] : [])
  return boundedBlocks(
    skills.flatMap(skill => (skill.referenceFiles || []).map(file => ({
      name: `${skill.name} / ${file.name}`,
      content: file.content
    }))),
    '技能参考资料（请在执行对应技能时使用）',
    '技能文件'
  )
}

/** 生成用户通过 @ 或“添加文件”明确选择的资料块。 */
export function buildLinkedReferenceBlock(items: RuntimeLinkedItem[]): string {
  return boundedBlocks(
    items.map(item => ({ name: `${item.type || '资料'} · ${item.label}`, content: item.content })),
    '用户明确关联的资料（优先依据这些内容回答）',
    '关联来源'
  )
}

export function countSkillReferenceChars(skill?: Pick<Skill, 'referenceFiles'> | null): number {
  return (skill?.referenceFiles || []).reduce((sum, file) => sum + String(file.content || '').length, 0)
}

/** 保留技能任务，并在模板没有专门接收用户要求时追加补充说明。 */
export function appendSkillSupplement(renderedPrompt: string, supplement: string, variables: Iterable<string>): string {
  if (!supplement.trim()) return renderedPrompt
  const slots = new Set(variables)
  if (['instruction', 'scene', 'emotion', 'topic'].some(name => slots.has(name))) return renderedPrompt
  return `${renderedPrompt}\n\n【用户补充说明】\n${supplement.trim()}`
}
