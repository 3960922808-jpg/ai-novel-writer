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

/** 角色 */
export interface Character {
  id: ID
  projectId: ID
  name: string
  aliases: string[] // 别名
  role: '主角' | '配角' | '反派' | '龙套' | '其他'
  age: string
  gender: string
  appearance: string
  personality: string
  background: string
  abilities: string
  goals: string // 角色目标
  arc: string // 角色弧线
  relationships: CharacterRelation[]
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface CharacterRelation {
  targetId: ID
  targetName: string
  type: string // 朋友/敌人/恋人/师徒/...
  description: string
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

/** 故事画布节点 */
export interface CanvasNode {
  id: ID
  projectId: ID
  type: 'scene' | 'plot' | 'character' | 'theme' | 'note'
  x: number
  y: number
  width: number
  height: number
  title: string
  content: string
  color: string
  links: ID[] // 连接的其他节点
  createdAt: number
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
  defaultModel: string
  defaultBaseUrl: string
  apiKeys: { provider: string; baseUrl: string; apiKey: string; models: string[] }[]
  theme: 'light' | 'dark'
  fontSize: number
  editorFont: string
  autoSaveInterval: number
  dataDir: string
}

/** AI 消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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
