// 全局共享类型定义

export type ID = string

/** 项目（一部小说） */
export interface Project {
  id: ID
  title: string
  description: string
  genre: string // 玄幻/都市/科幻/言情/...
  status: '连载中' | '已完结' | '暂停' | '草稿'
  cover?: string // base64 或路径
  tags: string[]
  createdAt: number
  updatedAt: number
  wordsTarget: number // 总字数目标
  settings: ProjectSettings
}

export interface ProjectSettings {
  model: string
  baseUrl: string
  apiKey: string // 实际使用时从全局设置注入
  temperature: number
  maxTokens: number
  topP: number
  criticModels: string[] // 评审用的多模型
  styleSample?: string // 文风样本
}

/** 章节 */
export interface Chapter {
  id: ID
  projectId: ID
  title: string
  content: string // 富文本 HTML 或 markdown
  contentType: 'html' | 'markdown'
  summary: string // 章节摘要
  status: '草稿' | '完成' | '已发表'
  order: number
  wordCount: number
  notes: string
  createdAt: number
  updatedAt: number
}

/** 地点 */
export interface Location {
  id: ID
  projectId: ID
  name: string
  type: string // 城市/荒野/建筑/...
  description: string
  features: string
  culture: string
  createdAt: number
  updatedAt: number
}

/** 世界观设定条目 */
export interface LoreEntry {
  id: ID
  projectId: ID
  category: string // 力量体系/历史/组织/物品/...
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

/** 时间线事件 */
export interface TimelineEvent {
  id: ID
  projectId: ID
  time: string // 故事内时间描述
  title: string
  description: string
  chapterId?: ID
  characterIds: ID[]
  importance: '关键' | '重要' | '一般'
  order: number
  createdAt: number
}

/** 故事画布节点（工作流语义：AI 可按此顺序生成故事） */
export interface CanvasNode {
  id: ID
  projectId: ID
  /** 节点类型：原 5 种基础类型 + 5 种工作流类型 */
  type:
    | 'scene' | 'plot' | 'character' | 'theme' | 'note'
    | 'start' | 'inciting' | 'rising' | 'climax' | 'resolution'
  x: number
  y: number
  width: number
  height: number
  title: string
  content: string
  color: string
  links: ID[] // 连接的其他节点
  createdAt: number
  /** AI 提示词：告诉 AI 这个节点要写什么（工作流核心字段） */
  aiPrompt?: string
  /** 工作流顺序号：按此排序生成章节 */
  order?: number
}

/** 提示词 */
export interface Prompt {
  id: ID
  projectId: ID | 'global' // 全局或项目级
  category: string // 续写/润色/大纲/对话/场景/...
  title: string
  content: string // 模板，支持 {{变量}}
  variables: string[]
  isBuiltIn: boolean
  createdAt: number
  updatedAt: number
}

/** 写作目标 */
export interface WritingGoal {
  id: ID
  projectId: ID
  dailyTarget: number
  weeklyTarget: number
  monthlyTarget: number
  streak: number
  lastWriteDate?: string
  history: { date: string; words: number }[]
}

/** 长期记忆真相文件（参考 InkOS） */
export interface TruthFile {
  id: ID
  projectId: ID
  key: string // current_state / character_matrix / pending_hooks / chapter_summaries / subplot_board / emotional_arcs / particle_ledger
  title: string
  content: string
  updatedAt: number
}

/** AI 评审记录 */
export interface CritiqueRecord {
  id: ID
  projectId: ID
  chapterId: ID
  model: string
  role: string // voice/continuity/naturalism/...
  findings: { severity: 'high' | 'medium' | 'low'; issue: string; suggestion: string }[]
  summary: string
  createdAt: number
}

/** 版本快照 */
export interface ChapterVersion {
  id: ID
  chapterId: ID
  content: string
  wordCount: number
  label: string
  createdAt: number
}

/** 全局设置 */
export interface AppSettings {
  /** @deprecated v1.4.0：模型只能通过 apiKeys 配置，defaultModel 不再使用 */
  defaultModel?: string
  /** @deprecated v1.4.0：默认 baseUrl 由 apiKeys 中第一个 provider 决定 */
  defaultBaseUrl?: string
  apiKeys: { provider: string; baseUrl: string; apiKey: string; models: string[] }[]
  theme: 'light' | 'dark'
  fontSize: number
  editorFont: string
  autoSaveInterval: number
  dataDir: string
  // 联网搜索配置
  searchProvider: 'duckduckgo' | 'tavily' | 'serper'
  searchApiKey: string
  // 自动更新检查
  autoUpdateCheck: boolean
  lastCommitSha: string
  // AI 提问模式：auto=卡壳时问 / always=每次都问 / never=从不问
  askMode: 'auto' | 'always' | 'never'
  // 主题模式：light/dark/auto（auto 跟随系统）
  themeMode?: 'light' | 'dark' | 'auto'
  // 界面缩放（百分比，70-150，类似浏览器缩放）
  zoomLevel?: number
}

/** Skill（技能）— 比普通提示词更高级的 AI 工作流 */
export interface Skill {
  id: ID
  projectId: ID | 'global' // 全局或项目级
  name: string
  description: string
  category: string // 续写/润色/大纲/对话/场景/评审/蒸馏/...
  icon: string // Element Plus 图标名
  systemPrompt: string
  userPrompt: string // 模板，支持 {{变量}}
  variables: string[]
  recommendedModel?: string
  temperature?: number
  maxTokens?: number
  tags: string[]
  isBuiltIn: boolean
  createdAt: number
  updatedAt: number
}

/** 文风档案（蒸馏产出） */
export interface StyleProfile {
  id: ID
  projectId: ID | 'global' // 可绑定到项目，也可作为全局档案
  name: string
  sourceTitle: string // 原作品名/作者
  sourceExcerpt?: string // 摘录片段
  // 蒸馏出的写作手法
  summary: string // 总体评价
  narrativePOV: string // 视角与叙事方式
  proseStyle: string // 语言风格（用词、句式、节奏）
  dialogueStyle: string // 对话特征
  sceneBuilding: string // 场景建构
  characterBuilding: string // 人物塑造
  pacing: string // 节奏与结构
  strengths: string // 突出优点
  weaknesses: string // 局限
  imitationGuide: string // 给 AI 的模仿指南（可直接作为 system prompt）
  tags: string[]
  createdAt: number
  updatedAt: number
}

/** AI 消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  /** AI 提问时的选项（ABCD） */
  options?: ChatOption[]
  /** 用户选择了哪个选项（index） */
  selectedOption?: number
  /** 该消息是否为提问消息 */
  isQuestion?: boolean
}

/** AI 提问选项 */
export interface ChatOption {
  text: string
  isCustom?: boolean
}

/** AI 请求 */
export interface AIRequest {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

/** AI 助手操作类型 */
export type AIAction =
  | 'continue' // 续写
  | 'rewrite' // 重写
  | 'polish' // 润色
  | 'expand' // 扩写
  | 'condense' // 缩写
  | 'outline' // 大纲
  | 'summary' // 摘要
  | 'custom' // 自定义
