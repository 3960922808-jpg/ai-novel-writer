// 封装所有 IPC store 调用
import type {
  Project, Chapter, Character, Location, LoreEntry,
  TimelineEvent, CanvasNode, Prompt, WritingGoal,
  TruthFile, CritiqueRecord, ChapterVersion, AppSettings,
  Skill, StyleProfile
} from '@/types'

type Collection =
  | 'chapters' | 'characters' | 'locations' | 'lore'
  | 'timeline' | 'canvas' | 'prompts' | 'goals'
  | 'truths' | 'critiques' | 'versions'
  | 'skills' | 'styleProfiles'

const C = window.api.store

// ====== 项目 ======
export const listProjects = (): Promise<Project[]> => C.getProjects()
export const getProject = (id: string): Promise<Project | null> => C.getProject(id)
export const saveProject = (p: Partial<Project> & { title: string }): Promise<Project> => {
  // 防止 Vue reactive proxy 触发 "An object could not be cloned."
  const plain = p == null ? p : JSON.parse(JSON.stringify(p))
  return C.saveProject(plain)
}
export const deleteProject = (id: string): Promise<boolean> => C.deleteProject(id)

// ====== 通用集合 ======
export async function list<T>(collection: Collection, projectId: string): Promise<T[]> {
  return C.list(collection, projectId) as Promise<T[]>
}
export async function getOne<T>(collection: Collection, id: string): Promise<T | null> {
  return C.get(collection, id) as Promise<T | null>
}
export async function save(collection: Collection, doc: any): Promise<any> {
  // IPC 走 structured clone，不能直接传 Vue reactive proxy / Tiptap editor 对象，
  // 否则会报 "An object could not be cloned."
  // 用 JSON 序列化为纯对象，顺便剥离函数/Symbol/不可枚举属性
  const plain = doc == null ? doc : JSON.parse(JSON.stringify(doc))
  return C.save(collection, plain)
}
export async function remove(collection: Collection, id: string): Promise<boolean> {
  return C.delete(collection, id)
}
export async function bulkSave(collection: Collection, docs: any[]): Promise<any[]> {
  const plain = (docs || []).map(d => (d == null ? d : JSON.parse(JSON.stringify(d))))
  return C.bulkSave(collection, plain) as Promise<any[]>
}

// ====== 设置 ======
export const getSettings = (): Promise<AppSettings> => C.getSettings()
export const saveSettings = (s: Partial<AppSettings>): Promise<AppSettings> => {
  const plain = s == null ? s : JSON.parse(JSON.stringify(s))
  return C.saveSettings(plain)
}

// ====== 类型化的快捷方法 ======
export const Chapters = {
  list: (pid: string) => list<Chapter>('chapters', pid),
  save: (c: Partial<Chapter> & { projectId: string; title: string }) => save('chapters', c),
  remove: (id: string) => remove('chapters', id)
}

export const Characters = {
  list: (pid: string) => list<Character>('characters', pid),
  save: (c: Partial<Character> & { projectId: string; name: string }) => save('characters', c),
  remove: (id: string) => remove('characters', id)
}

export const Locations = {
  list: (pid: string) => list<Location>('locations', pid),
  save: (l: Partial<Location> & { projectId: string; name: string }) => save('locations', l),
  remove: (id: string) => remove('locations', id)
}

export const Lore = {
  list: (pid: string) => list<LoreEntry>('lore', pid),
  save: (l: Partial<LoreEntry> & { projectId: string; title: string }) => save('lore', l),
  remove: (id: string) => remove('lore', id)
}

export const Timeline = {
  list: (pid: string) => list<TimelineEvent>('timeline', pid),
  save: (t: Partial<TimelineEvent> & { projectId: string; title: string }) => save('timeline', t),
  remove: (id: string) => remove('timeline', id)
}

export const Canvas = {
  list: (pid: string) => list<CanvasNode>('canvas', pid),
  save: (n: Partial<CanvasNode> & { projectId: string; type: CanvasNode['type'] }) => save('canvas', n),
  remove: (id: string) => remove('canvas', id)
}

export const Prompts = {
  list: (pid: string) => list<Prompt>('prompts', pid),
  save: (p: Partial<Prompt> & { title: string; content: string }) => save('prompts', p),
  remove: (id: string) => remove('prompts', id)
}

export const Goals = {
  list: (pid: string) => list<WritingGoal>('goals', pid),
  save: (g: Partial<WritingGoal> & { projectId: string }) => save('goals', g),
  remove: (id: string) => remove('goals', id)
}

export const Truths = {
  list: (pid: string) => list<TruthFile>('truths', pid),
  save: (t: Partial<TruthFile> & { projectId: string; key: string }) => save('truths', t),
  remove: (id: string) => remove('truths', id)
}

export const Critiques = {
  list: (pid: string) => list<CritiqueRecord>('critiques', pid),
  save: (c: Partial<CritiqueRecord> & { projectId: string; chapterId: string }) => save('critiques', c),
  remove: (id: string) => remove('critiques', id)
}

export const Versions = {
  list: (pid: string) => list<ChapterVersion>('versions', pid),
  save: (v: Partial<ChapterVersion> & { chapterId: string }) => save('versions', v),
  remove: (id: string) => remove('versions', id)
}

// ====== 技能 Skill ======
export const Skills = {
  list: (pid: string) => list<Skill>('skills', pid),
  save: (s: Partial<Skill> & { name: string }) => save('skills', s),
  remove: (id: string) => remove('skills', id)
}

// ====== 文风档案 StyleProfile（蒸馏产出） ======
export const StyleProfiles = {
  list: (pid: string) => list<StyleProfile>('styleProfiles', pid),
  save: (s: Partial<StyleProfile> & { name: string }) => save('styleProfiles', s),
  remove: (id: string) => remove('styleProfiles', id)
}
