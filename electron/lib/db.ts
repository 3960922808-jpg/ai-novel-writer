import { JSONFilePreset } from 'lowdb/node'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

export interface DBShape {
  projects: any[]
  chapters: any[]
  characters: any[]
  locations: any[]
  lore: any[]
  timeline: any[]
  canvas: any[]
  prompts: any[]
  goals: any[]
  truths: any[]
  critiques: any[]
  versions: any[]
  settings: any | null
}

export const defaultData: DBShape = {
  projects: [],
  chapters: [],
  characters: [],
  locations: [],
  lore: [],
  timeline: [],
  canvas: [],
  prompts: [],
  goals: [],
  truths: [],
  critiques: [],
  versions: [],
  settings: null
}

let db: Awaited<ReturnType<typeof JSONFilePreset<DBShape>>> | null = null

export async function initDB() {
  const userData = app.getPath('userData')
  const dbDir = path.join(userData, 'ainovelwriter')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
  const dbFile = path.join(dbDir, 'db.json')
  db = await JSONFilePreset<DBShape>(dbFile, defaultData)
  await db.write()
  // 初始化内置提示词
  await seedBuiltInPrompts()
}

export function getDB() {
  if (!db) throw new Error('DB not initialized')
  return db
}

async function seedBuiltInPrompts() {
  if (!db) return
  if (!db.data.prompts || db.data.prompts.length === 0) {
    const now = Date.now()
    db.data.prompts = [
      {
        id: 'builtin-continue',
        projectId: 'global',
        category: '续写',
        title: '智能续写',
        content: '你是一位{{genre}}类型的小说家。请根据以下前文继续创作，保持文风、人物性格与情节连贯，自然推进剧情，不要重复前文，不要写"以下是续写"等说明性文字，直接输出正文：\n\n前文：\n{{context}}\n\n请继续创作{{words}}字左右：',
        variables: ['genre', 'context', 'words'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'builtin-polish',
        projectId: 'global',
        category: '润色',
        title: '文风润色',
        content: '请对以下文字进行润色：保持原意与情节不变，优化遣词造句，增强画面感与节奏感，去除冗余和"AI味"的套话，使语言更自然、更有文学性。直接输出润色后的正文，不要解释：\n\n{{content}}',
        variables: ['content'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'builtin-rewrite',
        projectId: 'global',
        category: '重写',
        title: '场景重写',
        content: '请重写以下段落，要求：{{instruction}}。保持与上下文衔接，直接输出重写后的正文：\n\n{{content}}',
        variables: ['instruction', 'content'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'builtin-expand',
        projectId: 'global',
        category: '扩写',
        title: '细节扩写',
        content: '请将以下段落扩写为更丰富的场景，加入环境描写、人物动作、心理活动和感官细节，使画面更立体。不要改变核心情节，直接输出扩写后的正文：\n\n{{content}}',
        variables: ['content'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'builtin-outline',
        projectId: 'global',
        category: '大纲',
        title: '章节大纲',
        content: '请为{{genre}}小说《{{title}}》生成章节大纲。背景设定：\n{{setup}}\n\n要求生成{{count}}章的大纲，每章包含：章节标题、主要事件、冲突点、结尾悬念。输出为 markdown 列表：',
        variables: ['genre', 'title', 'setup', 'count'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'builtin-summary',
        projectId: 'global',
        category: '摘要',
        title: '章节摘要',
        content: '请为以下章节内容生成 200 字以内的摘要，提炼主要事件、人物行动与情节进展，用于后续章节的上下文参考：\n\n{{content}}',
        variables: ['content'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'builtin-character',
        projectId: 'global',
        category: '角色',
        title: '角色生成',
        content: '请为{{genre}}小说生成{{count}}个有特色的角色设定，每个角色包含：姓名、身份、年龄、外貌、性格、能力、核心动机、与其他角色的关系。输出为 markdown：\n\n背景：{{setup}}',
        variables: ['genre', 'count', 'setup'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'builtin-dialogue',
        projectId: 'global',
        category: '对话',
        title: '对话生成',
        content: '请根据以下情境写一段人物对话，要求符合角色性格，有冲突与潜台词，避免直白说教，自然推进情节：\n\n角色：{{characters}}\n情境：{{scene}}\n当前情绪：{{emotion}}',
        variables: ['characters', 'scene', 'emotion'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'builtin-critic-voice',
        projectId: 'global',
        category: '评审',
        title: '文风评审员',
        content: '你是一位严格的文学编辑，专司文风审查。请审查以下文本，找出：套话/陈词滥调、AI 味重的句式、词汇疲劳、节奏单调、过度修饰等问题。对每个问题给出严重程度（high/medium/low）、具体位置、修改建议。最后给一段整体评价。输出 JSON：{"findings":[{"severity":"high","issue":"...","suggestion":"..."}],"summary":"..."}\n\n{{content}}',
        variables: ['content'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'builtin-critic-continuity',
        projectId: 'global',
        category: '评审',
        title: '连续性评审员',
        content: '你是一位连续性审查员。对照以下世界状态与角色档案，检查章节是否存在：角色 OOC、设定矛盾、伏笔断裂、时间线错误、信息泄露（提到不该知道的事）等问题。输出 JSON：{"findings":[{"severity":"high","issue":"...","suggestion":"..."}],"summary":"..."}\n\n世界状态：\n{{truth}}\n\n角色档案：\n{{characters}}\n\n待审章节：\n{{content}}',
        variables: ['truth', 'characters', 'content'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      }
    ]
    await db.write()
  }
}
