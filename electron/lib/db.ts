import { JSONFilePreset } from 'lowdb/node'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

export interface DBShape {
  projects: any[]
  chapters: any[]
  locations: any[]
  lore: any[]
  timeline: any[]
  canvas: any[]
  prompts: any[]
  goals: any[]
  truths: any[]
  critiques: any[]
  versions: any[]
  skills: any[]
  styleProfiles: any[]
  settings: any | null
}

export const defaultData: DBShape = {
  projects: [],
  chapters: [],
  locations: [],
  lore: [],
  timeline: [],
  canvas: [],
  prompts: [],
  goals: [],
  truths: [],
  critiques: [],
  versions: [],
  skills: [],
  styleProfiles: [],
  settings: null
}

let db: Awaited<ReturnType<typeof JSONFilePreset<DBShape>>> | null = null

export async function initDB() {
  const userData = app.getPath('userData')
  const dbDir = path.join(userData, 'ainovelwriter')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
  const dbFile = path.join(dbDir, 'db.json')
  db = await JSONFilePreset<DBShape>(dbFile, defaultData)
  // 修复老版本 db：补齐缺失的 collection（避免 .filter undefined 崩溃）
  for (const k of Object.keys(defaultData) as (keyof DBShape)[]) {
    if (!Array.isArray((db.data as any)[k])) {
      ;(db.data as any)[k] = []
    }
  }
  // v1.3.8：彻底移除 characters 集合（人物库已下线）
  if (Array.isArray((db.data as any).characters)) {
    delete (db.data as any).characters
  }
  // v1.3.9：刷新 builtin-critic-continuity 提示词内容（移除已废弃的 {{characters}}）
  if (Array.isArray(db.data.prompts)) {
    const continuity = db.data.prompts.find((p: any) => p.id === 'builtin-critic-continuity')
    if (continuity && continuity.content && continuity.content.includes('{{characters}}')) {
      continuity.content = '你是一位连续性审查员。对照以下世界状态，检查章节是否存在：设定矛盾、伏笔断裂、时间线错误、信息泄露（提到不该知道的事）等问题。输出 JSON：{"findings":[{"severity":"high","issue":"...","suggestion":"..."}],"summary":"..."}\n\n世界状态：\n{{truth}}\n\n待审章节：\n{{content}}'
      continuity.variables = ['truth', 'content']
      continuity.updatedAt = Date.now()
    }
    // 兜底补齐缺失的内置评审提示词（老用户数据可能没有）
    const now = Date.now()
    const builtinCritics: any[] = [
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
        content: '你是一位连续性审查员。对照以下世界状态，检查章节是否存在：设定矛盾、伏笔断裂、时间线错误、信息泄露（提到不该知道的事）等问题。输出 JSON：{"findings":[{"severity":"high","issue":"...","suggestion":"..."}],"summary":"..."}\n\n世界状态：\n{{truth}}\n\n待审章节：\n{{content}}',
        variables: ['truth', 'content'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      }
    ]
    for (const b of builtinCritics) {
      if (!db.data.prompts.find((p: any) => p.id === b.id)) {
        db.data.prompts.push(b)
      }
    }
  }
  if (!db.data.settings) db.data.settings = null
  await db.write()
  // 初始化内置提示词
  await seedBuiltInPrompts()
  // 初始化内置技能
  await seedBuiltInSkills()
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
        content: '你是一位连续性审查员。对照以下世界状态，检查章节是否存在：设定矛盾、伏笔断裂、时间线错误、信息泄露（提到不该知道的事）等问题。输出 JSON：{"findings":[{"severity":"high","issue":"...","suggestion":"..."}],"summary":"..."}\n\n世界状态：\n{{truth}}\n\n待审章节：\n{{content}}',
        variables: ['truth', 'content'],
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
      }
    ]
    await db.write()
  }
}

/** 内置技能：比 prompt 更高级，包含 system + user 双模板与推荐参数 */
async function seedBuiltInSkills() {
  if (!db) return
  if (!db.data.skills) db.data.skills = []
  // 仅在首次启动（无任何技能）时种入
  if (db.data.skills.length > 0) return
  const now = Date.now()
  const skills = [
    {
      id: 'skill-depolish',
      projectId: 'global',
      name: '去 AI 味润色',
      description: '识别并消除 AI 写作的套话、对仗式排比、虚假情感、空洞比喻，让文字像人写的',
      category: '润色',
      icon: 'MagicStick',
      systemPrompt:
        '你是资深文学编辑，擅长识别"AI 味"写作：陈词滥调、过度对称的排比、滥用成语、空泛比喻、虚张声势的情感宣泄、同一句式反复出现、形容词堆砌。你的任务是把 AI 味浓重的文字改得自然、克制、有真实颗粒感。只输出改写后的正文，不要解释、不要加标题、不要写"以下是改写"。',
      userPrompt:
        '请对以下文字进行去 AI 味改写：\n1. 删去陈词滥调与空洞比喻\n2. 拆掉对仗式排比，让句子长短自然交错\n3. 把虚张的抒情换成具体细节\n4. 保留原意与情节\n\n原文：\n{{content}}',
      variables: ['content'],
      recommendedModel: '',
      temperature: 0.7,
      maxTokens: 2048,
      tags: ['润色', '去AI味'],
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'skill-cold-combat',
      projectId: 'global',
      name: '硬核冷冽战斗',
      description: '写出冷冽、克制、有痛感的战斗场景，拒绝主角光环式爽文套路',
      category: '场景',
      icon: 'Aim',
      systemPrompt:
        '你是一位擅长硬核冷冽战斗描写的小说家。你的战斗描写遵循：动作具体、痛感真实、节奏短促、留白克制、不写"气势暴涨""杀意凛然"等空洞形容。视角贴身，镜头聚焦在血、汗、呼吸、骨裂、错位的脚步上。拒绝主角光环式爽文套路。',
      userPrompt:
        '请根据以下信息写一段硬核冷冽战斗场景（约 {{words}} 字）：\n\n参战角色：{{characters}}\n环境：{{env}}\n冲突起因：{{cause}}\n关键转折：{{twist}}',
      variables: ['words', 'characters', 'env', 'cause', 'twist'],
      recommendedModel: '',
      temperature: 0.85,
      maxTokens: 3072,
      tags: ['战斗', '场景', '硬核'],
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'skill-multi-review',
      projectId: 'global',
      name: '多视角评章',
      description: '从正方/反方/剧情/人物/读者五个视角对章节做评审，输出综合报告',
      category: '评审',
      icon: 'ChatLineSquare',
      systemPrompt:
        '你将同时扮演 5 位评审：\n1. 正方评审（力挺作者）\n2. 反方评审（鸡蛋里挑骨头）\n3. 剧情评审（看逻辑与节奏）\n4. 人物评审（看角色是否立体、动机是否成立）\n5. 读者评审（站在普通读者立场看爽点与疲劳点）\n请对章节给出五段独立评审 + 一段综合改进建议。语言要直接、具体、不套话。',
      userPrompt:
        '请评审以下章节：\n\n章节标题：{{title}}\n章节内容：\n{{content}}',
      variables: ['title', 'content'],
      recommendedModel: '',
      temperature: 0.6,
      maxTokens: 4096,
      tags: ['评审', '多视角'],
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'skill-imitate-author',
      projectId: 'global',
      name: '文风模仿',
      description: '基于蒸馏出的文风档案，让 AI 用目标作者的笔法续写',
      category: '蒸馏',
      icon: 'CopyDocument',
      systemPrompt:
        '你将严格模仿指定作家的写作手法。模仿指南如下，请在用词、句式、节奏、视角、对话特征、场景建构上全面贴合：\n\n{{imitationGuide}}',
      userPrompt:
        '请用上述作家笔法，续写以下文字（约 {{words}} 字），不要解释、不要加"以下是续写"：\n\n{{context}}',
      variables: ['imitationGuide', 'words', 'context'],
      recommendedModel: '',
      temperature: 0.8,
      maxTokens: 3072,
      tags: ['蒸馏', '文风', '续写'],
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'skill-outline-sweep',
      projectId: 'global',
      name: '扫榜拆解',
      description: '拆解热门网文套路：起承转合、爽点节奏、人设公式、章节钩子',
      category: '大纲',
      icon: 'DataAnalysis',
      systemPrompt:
        '你是网文扫榜分析师。请用结构化方式拆解作品，输出包括：① 类型与标签 ② 主角人设公式 ③ 主线起承转合 ④ 爽点节奏（前 5 章 / 前 30 章 / 中段 / 高潮）⑤ 章节钩子套路 ⑥ 可复用的写作模板。语言精炼，用列表与短句。',
      userPrompt:
        '请拆解以下作品的写作手法：\n\n标题：{{title}}\n作品摘录：\n{{excerpt}}',
      variables: ['title', 'excerpt'],
      recommendedModel: '',
      temperature: 0.5,
      maxTokens: 4096,
      tags: ['扫榜', '拆解', '蒸馏'],
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'skill-web-research',
      projectId: 'global',
      name: '联网资料补全',
      description: '根据联网搜索结果，为小说补充真实背景资料（历史/地理/行业/科技）',
      category: '资料',
      icon: 'Search',
      systemPrompt:
        '你是一位考据编辑。基于用户提供的联网搜索结果，提炼与小说创作相关的关键事实（年代、地点、行业规则、专业术语等），并给出可直接用于正文的具体描写建议。输出分两段：【事实】【可写入小说的细节】。不要泛泛而谈。',
      userPrompt:
        '我正在写一部 {{genre}} 小说，需要补充以下方面的真实资料：\n主题：{{topic}}\n\n联网搜索结果（已为你抓取）：\n{{searchResults}}\n\n请基于以上资料，输出可直接用于小说创作的细节。',
      variables: ['genre', 'topic', 'searchResults'],
      recommendedModel: '',
      temperature: 0.4,
      maxTokens: 3072,
      tags: ['资料', '联网', '考据'],
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now
    }
  ]
  db.data.skills = skills
  await db.write()
}
