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
  messages: any[]
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
  messages: [],
  settings: null
}

const ARRAY_COLLECTIONS: (keyof DBShape)[] = [
  'projects', 'chapters', 'locations', 'lore', 'timeline', 'canvas',
  'prompts', 'goals', 'truths', 'critiques', 'versions', 'skills',
  'styleProfiles', 'messages'
]

let db: Awaited<ReturnType<typeof JSONFilePreset<DBShape>>> | null = null
let dbFilePath = ''
let writeQueue: Promise<void> = Promise.resolve()

function isValidDatabaseFile(filePath: string): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
  } catch {
    return false
  }
}

function recoverDatabaseIfNeeded(filePath: string) {
  if (!fs.existsSync(filePath) || isValidDatabaseFile(filePath)) return
  const backupPath = `${filePath}.bak`
  if (fs.existsSync(backupPath) && isValidDatabaseFile(backupPath)) {
    const brokenPath = `${filePath}.corrupt-${Date.now()}`
    fs.copyFileSync(filePath, brokenPath)
    fs.copyFileSync(backupPath, filePath)
    console.warn('[db] 主数据库损坏，已从备份恢复；损坏文件保留在:', brokenPath)
    return
  }
  throw new Error(`数据库文件损坏且没有可用备份：${filePath}`)
}

/** 串行写入并维护最近一次完整备份，避免并发写入和异常退出破坏数据库。 */
export function writeDB(): Promise<void> {
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    if (!db || !dbFilePath) throw new Error('DB not initialized')
    await db.write()
    fs.copyFileSync(dbFilePath, `${dbFilePath}.bak`)
  })
  return writeQueue
}

export async function initDB() {
  const userData = app.getPath('userData')
  const dbDir = path.join(userData, 'ainovelwriter')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
  const dbFile = path.join(dbDir, 'db.json')
  recoverDatabaseIfNeeded(dbFile)
  dbFilePath = dbFile
  db = await JSONFilePreset<DBShape>(dbFile, defaultData)
  // 修复老版本 db：只补齐数组集合（避免 .filter undefined 崩溃）。
  // settings 是对象，不能与集合一起按数组初始化。
  for (const k of ARRAY_COLLECTIONS) {
    if (!Array.isArray((db.data as any)[k])) {
      ;(db.data as any)[k] = []
    }
  }
  if (Array.isArray(db.data.settings) ||
      (db.data.settings !== null && typeof db.data.settings !== 'object')) {
    db.data.settings = null
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
  // v1.4.2：迁移老用户默认 apiKeys 中的过期模型名到最新版本
  // 仅在用户尚未自定义（apiKey 仍为空）的 provider 上做自动升级，避免覆盖用户已添加的自定义模型
  if (db.data.settings && Array.isArray(db.data.settings.apiKeys)) {
    const MODEL_MIGRATIONS: { provider: string; baseUrl?: string; oldModels: string[]; newModels: string[]; newBaseUrl?: string }[] = [
      {
        provider: 'OpenAI',
        oldModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        newModels: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano']
      },
      {
        provider: 'DeepSeek',
        oldModels: ['deepseek-chat', 'deepseek-reasoner'],
        newModels: ['deepseek-v4-pro', 'deepseek-v4-flash']
      },
      {
        provider: '智谱AI',
        oldModels: ['glm-4', 'glm-4-flash', 'glm-4-air', 'glm-4-long'],
        newModels: ['glm-5.2', 'glm-5.2-air', 'glm-5.2-flash'],
        newBaseUrl: 'https://api.z.ai/api/paas/v4'
      },
      {
        provider: 'MiniMax',
        oldModels: ['abab6.5-chat', 'abab6.5s-chat', 'abab6.5g-chat', 'abab6-chat'],
        newModels: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.5']
      }
    ]
    let migrated = false
    for (const p of db.data.settings.apiKeys) {
      const m = MODEL_MIGRATIONS.find(x => x.provider === p.provider)
      if (!m) continue
      // 只在 apiKey 仍为空（即用户未启用此 provider）时迁移
      if (p.apiKey) continue
      const hasOld = (p.models || []).some((mo: string) => m.oldModels.includes(mo))
      const hasNew = (p.models || []).some((mo: string) => m.newModels.includes(mo))
      if (hasOld && !hasNew) {
        p.models = [...m.newModels]
        if (m.newBaseUrl) p.baseUrl = m.newBaseUrl
        migrated = true
      }
    }
    if (migrated) {
      console.log('[settings] v1.4.2: 已自动迁移老 provider 的过期模型名到最新版本')
    }
  }
  await writeDB()
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
  if (!Array.isArray(db.data.prompts)) db.data.prompts = []
  const now = Date.now()
  const builtInPrompts = [
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
        id: 'builtin-condense',
        projectId: 'global',
        category: '缩写',
        title: '小说文本压缩',
        content: '请把以下小说正文压缩到原长度的 {{ratio}}%。严格保留人物、因果、关键动作、重要信息、伏笔和转折，不得新增事实；删去重复说明、同义反复、无效铺陈和不推动情节的句子。尽量保持原有叙事视角与语言风格，直接输出压缩后的正文，不要解释：\n\n{{content}}',
        variables: ['ratio', 'content'],
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
  let changed = false
  for (const prompt of builtInPrompts) {
    if (!db.data.prompts.some((item: any) => item.id === prompt.id)) {
      db.data.prompts.push(prompt)
      changed = true
    }
  }
  if (changed) {
    await writeDB()
  }
}

export function getDBFilePath() {
  if (!dbFilePath) throw new Error('DB not initialized')
  return dbFilePath
}

/** 内置技能：比 prompt 更高级，包含 system + user 双模板与推荐参数 */
async function seedBuiltInSkills() {
  if (!db) return
  if (!db.data.skills) db.data.skills = []
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
      id: 'skill-novel-condense',
      projectId: 'global',
      name: '小说文本压缩',
      description: '按指定比例压缩小说正文，保留人物关系、因果链、伏笔、转折和必要对话',
      category: '缩写',
      icon: 'Fold',
      systemPrompt:
        '你是小说压缩编辑。你必须在缩短篇幅的同时守住故事事实、人物关系、因果链、关键动作、伏笔和转折，不得添加原文没有的信息。删去同义反复、无效铺陈、重复心理说明和不推动情节的句子。只输出压缩后的正文。',
      userPrompt:
        '请将下列正文压缩到原长度的 {{ratio}}%，并尽量保持原文叙事视角与语言风格：\n\n{{content}}',
      variables: ['ratio', 'content'],
      recommendedModel: '',
      temperature: 0.35,
      maxTokens: 4096,
      tags: ['缩写', '压缩', '精简'],
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
    },
    {
      id: 'skill-novel-concept',
      projectId: 'global',
      name: '小说立项与主题',
      description: '把零散灵感整理成可执行的小说方案，明确卖点、冲突、代价、世界规则和结局方向',
      category: '构思',
      icon: 'Lightning',
      systemPrompt: '你是小说策划编辑。用户已确定的内容都是约束，不能擅自改写；把信息区分为“已确定、合理推断、待选择”。主题必须是可争辩的问题，核心矛盾要能持续制造选择与代价。信息不足时给出不超过三个差异明确的方向，并说明各自的叙事代价。',
      userPrompt: '请把下面的灵感整理成小说创作简报。按需输出：一句话梗概、类型与读者承诺、主题问题、主角目标与失败代价、核心对抗机制、世界规则、结局方向、独特性与待决定事项。\n\n小说类型：{{genre}}\n已有设定：{{setup}}\n我的想法：{{instruction}}',
      variables: ['genre', 'setup', 'instruction'],
      recommendedModel: '', temperature: 0.75, maxTokens: 4096,
      tags: ['写小说技能包', '立项', '主题', '灵感'],
      isBuiltIn: true, createdAt: now, updatedAt: now
    },
    {
      id: 'skill-character-design',
      projectId: 'global',
      name: '小说人物设计',
      description: '设计主角、对手、配角、人物关系和人物弧光，让人物用选择与行动推动剧情',
      category: '角色',
      icon: 'User',
      systemPrompt: '你是人物设计师。先尊重现有设定，再用选择和行动定义人物，不用形容词清单代替塑造。人物必须有外在目标、内在需要、恐惧、误信、秘密、资源与底线；优点在特定情境中也会成为缺点。对手要有自洽目标、资源和适应能力。',
      userPrompt: '请根据现有小说资料与我的要求，输出人物档案、关系动力和关键弧光节点。必须说明：已确定事实与待定项、人物现在想要什么、会采取什么策略、拒绝付出什么代价、内外矛盾如何变成行动，以及一个验证人设是否成立的场景测试。\n\n现有资料：{{context}}\n补充要求：{{instruction}}',
      variables: ['context', 'instruction'],
      recommendedModel: '', temperature: 0.75, maxTokens: 4096,
      tags: ['写小说技能包', '人物', '角色弧光', '关系'],
      isBuiltIn: true, createdAt: now, updatedAt: now
    },
    {
      id: 'skill-plot-architecture',
      projectId: 'global',
      name: '小说情节架构',
      description: '搭建因果链、递进阻力、伏笔回收、反转顺序和章节节奏，也能修复中段乏力',
      category: '大纲',
      icon: 'Connection',
      systemPrompt: '你是小说情节架构师。主要事件必须尽量用“因此”或“但是”相连，不能只是“然后”。反转要改变人物对局势的理解或可选行动，并能从前文回看成立；巧合只能制造麻烦，不能解决核心问题。每个关键节点都要迫使主角做选择并承担后果。',
      userPrompt: '请根据下列资料完成情节设计或修复。按任务规模输出故事骨架、分卷结构或章节大纲，并标出主角目标、递进阻力、失败代价、伏笔埋设与回收、揭示顺序、高潮选择和章尾钩子。发现逻辑断裂时要直接指出并给出改法。\n\n现有故事：{{context}}\n本次要求：{{instruction}}\n计划规模：{{count}} 个章节或节点',
      variables: ['context', 'instruction', 'count'],
      recommendedModel: '', temperature: 0.7, maxTokens: 6144,
      tags: ['写小说技能包', '情节', '大纲', '伏笔', '节奏'],
      isBuiltIn: true, createdAt: now, updatedAt: now
    },
    {
      id: 'skill-scene-writing',
      projectId: 'global',
      name: '小说场景写作',
      description: '把大纲或场景卡写成正文，处理视角、动作、感官、对话潜台词、转折和收尾钩子',
      category: '场景',
      icon: 'EditPen',
      systemPrompt: '你是小说正文作者。场景必须有视角人物、即时目标、阻力与结果变化。优先写人物正在感知和采取的行动，用具体细节代替解释；对话要有不同目的和潜台词。保护作者已有文风与事实，不擅自添加会改变后续剧情的新设定。只输出可直接使用的正文。',
      userPrompt: '请把以下资料写成约 {{words}} 字的小说场景。保持与前文连续，场景结尾必须产生变化或钩子。\n\n前文与设定：{{context}}\n场景要求：{{instruction}}',
      variables: ['words', 'context', 'instruction'],
      recommendedModel: '', temperature: 0.85, maxTokens: 6144,
      tags: ['写小说技能包', '正文', '场景', '对话'],
      isBuiltIn: true, createdAt: now, updatedAt: now
    },
    {
      id: 'skill-manuscript-revision',
      projectId: 'global',
      name: '小说稿件修订',
      description: '分层检查结构、因果、人物、视角、节奏、连续性和语言，并给出可直接替换的修改稿',
      category: '修订',
      icon: 'Checked',
      systemPrompt: '你是保护作者声音的小说编辑。先诊断再修订，不把个人偏好当成错误。优先处理会让读者看不懂、人物行为不成立、因果断裂和设定矛盾的问题；其次处理节奏、视角与语言。不得新增原文没有的重要事实。',
      userPrompt: '请修订以下小说文本。先用简短清单列出必须改的问题，再给出完整修改稿；若用户只要求润色，则直接给修改稿。重点检查结构、因果、人物动机、视角稳定、节奏、连续性和语言自然度。\n\n具体要求：{{instruction}}\n\n原文：\n{{content}}',
      variables: ['instruction', 'content'],
      recommendedModel: '', temperature: 0.55, maxTokens: 6144,
      tags: ['写小说技能包', '修订', '审稿', '润色'],
      isBuiltIn: true, createdAt: now, updatedAt: now
    },
    {
      id: 'skill-long-novel-workflow',
      projectId: 'global',
      name: '长篇网文写作',
      description: '从选题、大纲到单章正文的长篇写作教练，重视读者契约、情绪目标、连续性和章尾钩子',
      category: '长篇',
      icon: 'Collection',
      systemPrompt: '你是长篇网文写作教练。先定本轮要交付的读者情绪，再推进故事。写作时守住主角能动性、利益安全、升级空间、人物状态、伏笔与世界规则。裸调用时先判断用户要开书、补纲、写指定章、续写还是大修；未明确要求正文时不要擅自批量写章。单次最多输出一章完整正文。',
      userPrompt: '请依据项目资料完成本次长篇写作任务。若是正文，直接输出可用章节并保证开头承接、场景推进、情绪兑现和章尾钩子；若是规划，输出下一步可执行的大纲。\n\n作品：{{title}}（{{genre}}）\n项目资料：{{context}}\n本次任务：{{instruction}}',
      variables: ['title', 'genre', 'context', 'instruction'],
      recommendedModel: '', temperature: 0.82, maxTokens: 8192,
      tags: ['写小说技能包', '长篇', '网文', '续写'],
      isBuiltIn: true, createdAt: now, updatedAt: now
    },
    {
      id: 'skill-short-novel-workflow',
      projectId: 'global',
      name: '短篇网文写作',
      description: '从情绪目标和核心反转出发创作短篇，强调前三句钩子、单线推进与有余韵的结尾',
      category: '短篇',
      icon: 'Star',
      systemPrompt: '你是短篇网文作者。先确定目标情绪，再用一个核心反转支撑全篇；所有铺垫都服务反转和情绪升级，不铺无关世界观。每句话都要推动剧情、铺垫反转或抬高情绪。开头三句必须有钩子，结尾必须有余韵。默认第一人称，除非用户明确指定其他视角。',
      userPrompt: '请根据要求构思或创作一篇短篇小说。已有正文时延续其视角与事实；信息不足时先给三个差异明确的故事核，不要用空泛问题拖延。\n\n题材：{{genre}}\n已有资料：{{context}}\n本次要求：{{instruction}}',
      variables: ['genre', 'context', 'instruction'],
      recommendedModel: '', temperature: 0.88, maxTokens: 8192,
      tags: ['写小说技能包', '短篇', '情绪', '反转'],
      isBuiltIn: true, createdAt: now, updatedAt: now
    }
  ]
  let changed = false
  for (const skill of skills) {
    if (!db.data.skills.some((item: any) => item.id === skill.id)) {
      db.data.skills.push(skill)
      changed = true
    }
  }
  if (changed) await writeDB()
}
