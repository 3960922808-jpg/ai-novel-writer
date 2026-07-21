<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><CopyDocument /></el-icon>
          蒸馏作者写作手法
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">上传小说文件，AI 自动拆解该作者的写作手法，生成可复用的文风档案</p>
      </div>
      <div class="flex gap-2">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-button :icon="Files" @click="loadProfiles">我的档案</el-button>
        <el-button type="primary" :icon="Upload" @click="pickFiles">上传小说</el-button>
      </div>
    </div>

    <!-- 上传区 -->
    <div class="card upload-card">
      <div v-if="files.length === 0" class="upload-empty" @click="pickFiles">
        <el-icon :size="40"><Upload /></el-icon>
        <h3 style="margin: 12px 0 6px">点击或拖拽上传小说文件</h3>
        <p class="text-muted text-sm">支持 .txt / .md / .docx，可多选</p>
      </div>
      <div v-else>
        <div class="file-list">
          <div v-for="(f, i) in files" :key="i" class="file-item">
            <el-icon class="file-icon"><Document /></el-icon>
            <div class="file-info">
              <div class="file-name">{{ f.fileName }}</div>
              <div class="file-meta text-faint text-xs">
                {{ f.ext.toUpperCase() }} · {{ (f.size / 1024).toFixed(1) }} KB · {{ countChars(f.content) }} 字
              </div>
            </div>
            <el-button text :icon="Delete" @click="files.splice(i, 1)" />
          </div>
        </div>
        <div class="upload-actions">
          <el-button :icon="Plus" @click="pickFiles">追加文件</el-button>
          <div class="flex-1"></div>
          <span class="text-faint text-xs">总字数：{{ totalChars.toLocaleString() }}</span>
          <el-button type="primary" :icon="MagicStick" :loading="analyzing" @click="startDistill">开始蒸馏</el-button>
        </div>
      </div>
    </div>

    <!-- 蒸馏配置 -->
    <div class="card config-card" v-if="files.length > 0 && !analyzing && !profile">
      <div class="section-title">蒸馏参数</div>
      <el-form label-width="120px">
        <el-form-item label="原作品名/作者">
          <el-input v-model="sourceTitle" placeholder="例如：余华《活着》/ 番茄《诡秘之主》" />
        </el-form-item>
        <el-form-item label="档案名称">
          <el-input v-model="profileName" placeholder="例如：余华冷峻白描风 / 乌贼克苏鲁式悬疑" />
        </el-form-item>
        <el-form-item label="分析深度">
          <el-radio-group v-model="depth">
            <el-radio-button label="quick">快速（约 1 次 AI 调用）</el-radio-button>
            <el-radio-button label="standard">标准（约 2 次 AI 调用）</el-radio-button>
            <el-radio-button label="deep">深度（约 4 次 AI 调用）</el-radio-button>
          </el-radio-group>
          <div class="text-faint text-xs" style="margin-top: 4px">
            深度分析会拆成多维度分别蒸馏，输出更细但耗时更长
          </div>
        </el-form-item>
        <el-form-item label="使用模型">
          <el-select v-model="modelChoice" style="width: 100%">
            <el-option
              v-for="m in modelOptions"
              :key="m.provider + '/' + m.model"
              :label="`${m.model}（${m.provider}）`"
              :value="m.model"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <!-- 进度 -->
    <div v-if="analyzing" class="card progress-card">
      <div class="section-title">蒸馏进行中</div>
      <div v-for="(s, i) in progressSteps" :key="i" class="step">
        <el-icon v-if="s.status === 'done'" color="var(--success)"><Check /></el-icon>
        <el-icon v-else-if="s.status === 'running'" class="is-loading"><Loading /></el-icon>
        <el-icon v-else color="var(--text-3)"><Right /></el-icon>
        <span :class="{ active: s.status === 'running', done: s.status === 'done' }">{{ s.label }}</span>
      </div>
      <div v-if="streamingText" class="streaming-text">{{ streamingText }}</div>
    </div>

    <!-- 蒸馏结果 -->
    <div v-if="profile" class="result-area">
      <div class="card profile-card">
        <div class="profile-head">
          <div>
            <h2 style="margin: 0 0 4px">{{ profile.name }}</h2>
            <div class="text-muted text-sm">源：{{ profile.sourceTitle }}</div>
          </div>
          <div class="flex gap-2">
            <el-button :icon="DocumentCopy" @click="copyGuide">复制模仿指南</el-button>
            <el-button :icon="MagicStick" @click="applyToProject">应用到当前项目</el-button>
            <el-button type="primary" :icon="Check" @click="saveProfile">保存档案</el-button>
          </div>
        </div>

        <div class="profile-section">
          <div class="ps-title">总体评价</div>
          <div class="ps-content">{{ profile.summary }}</div>
        </div>

        <div class="grid grid-2">
          <div class="profile-section">
            <div class="ps-title">视角与叙事方式</div>
            <div class="ps-content">{{ profile.narrativePOV }}</div>
          </div>
          <div class="profile-section">
            <div class="ps-title">语言风格</div>
            <div class="ps-content">{{ profile.proseStyle }}</div>
          </div>
          <div class="profile-section">
            <div class="ps-title">对话特征</div>
            <div class="ps-content">{{ profile.dialogueStyle }}</div>
          </div>
          <div class="profile-section">
            <div class="ps-title">场景建构</div>
            <div class="ps-content">{{ profile.sceneBuilding }}</div>
          </div>
          <div class="profile-section">
            <div class="ps-title">人物塑造</div>
            <div class="ps-content">{{ profile.characterBuilding }}</div>
          </div>
          <div class="profile-section">
            <div class="ps-title">节奏与结构</div>
            <div class="ps-content">{{ profile.pacing }}</div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="profile-section strengths">
            <div class="ps-title">突出优点</div>
            <div class="ps-content">{{ profile.strengths }}</div>
          </div>
          <div class="profile-section weaknesses">
            <div class="ps-title">局限</div>
            <div class="ps-content">{{ profile.weaknesses }}</div>
          </div>
        </div>

        <div class="profile-section guide">
          <div class="ps-title">
            <span>给 AI 的模仿指南（可直接作为 system prompt）</span>
            <el-button text size="small" :icon="DocumentCopy" @click="copyGuide">复制</el-button>
          </div>
          <div class="ps-content guide-content">{{ profile.imitationGuide }}</div>
        </div>
      </div>
    </div>

    <!-- 已保存档案抽屉 -->
    <el-drawer v-model="profilesVisible" title="我的文风档案" size="600px">
      <div v-loading="profilesLoading">
        <div v-if="profiles.length === 0" class="empty">
          <el-icon class="empty-icon"><Files /></el-icon>
          <h3>暂无文风档案</h3>
          <p class="text-muted">上传小说文件开始蒸馏</p>
        </div>
        <div v-else>
          <div
            v-for="p in profiles"
            :key="p.id"
            class="card profile-item"
          >
            <div class="flex justify-between items-center">
              <div class="flex-1" style="min-width: 0">
                <div class="profile-item-name">{{ p.name }}</div>
                <div class="text-faint text-xs">源：{{ p.sourceTitle }} · {{ formatTime(p.updatedAt) }}</div>
                <div class="text-muted text-xs" style="margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden">
                  {{ p.summary }}
                </div>
              </div>
              <div class="flex gap-2">
                <el-button text size="small" @click="loadProfile(p)">载入</el-button>
                <el-button text size="small" @click="applyProfileToProject(p)">应用到项目</el-button>
                <el-button text size="small" type="danger" @click="deleteProfile(p)">删除</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CopyDocument, Upload, Document, Delete, Plus, MagicStick,
  Files, Check, Right, Loading, DocumentCopy, ArrowLeft
} from '@element-plus/icons-vue'
import type { StyleProfile } from '@/types'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { StyleProfiles } from '@/services/db'
import { chat, buildRequest } from '@/services/ai'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

const project = computed(() => projectStore.current)
const modelOptions = computed(() => settingsStore.availableModels())

interface NovelFile {
  path: string
  fileName: string
  ext: string
  content: string
  size: number
}

const files = ref<NovelFile[]>([])
const sourceTitle = ref('')
const profileName = ref('')
const depth = ref<'quick' | 'standard' | 'deep'>('standard')
const modelChoice = ref('')

const analyzing = ref(false)
const streamingText = ref('')
const profile = ref<StyleProfile | null>(null)

const progressSteps = ref<{ label: string; status: 'pending' | 'running' | 'done' }[]>([])

const totalChars = computed(() =>
  files.value.reduce((s, f) => s + countChars(f.content), 0)
)

function countChars(text: string): number {
  if (!text) return 0
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const english = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length
  return chinese + english
}

onMounted(async () => {
  if (!settingsStore.settings) await settingsStore.load()
  if (!modelChoice.value && project.value) {
    modelChoice.value = project.value.settings.model || settingsStore.defaultModel() || ''
  }
})

async function pickFiles() {
  try {
    const paths = (await window.api.file.selectNovel()) as string[]
    if (!Array.isArray(paths) || paths.length === 0) return
    for (const p of paths) {
      const f = await window.api.file.readNovelText(p)
      files.value.push(f as NovelFile)
    }
    // 自动填充默认名
    if (!sourceTitle.value && files.value.length > 0) {
      sourceTitle.value = files.value[0].fileName.replace(/\.[^.]+$/, '')
    }
    if (!profileName.value) {
      profileName.value = sourceTitle.value + '·文风档案'
    }
  } catch (e: any) {
    ElMessage.error('读取文件失败：' + (e?.message || ''))
  }
}

// ===== 蒸馏流程 =====
async function startDistill() {
  if (files.value.length === 0) {
    ElMessage.warning('请先上传小说文件')
    return
  }
  if (!profileName.value.trim()) {
    ElMessage.warning('请填写档案名称')
    return
  }
  if (!modelChoice.value) {
    ElMessage.warning('请选择模型')
    return
  }
  const cfg = settingsStore.findProviderForModel(modelChoice.value)
  if (!cfg?.apiKey) {
    ElMessage.error('所选模型未配置 API Key')
    return
  }

  // 截取样本（避免上下文过长）
  const sample = pickSample(files.value, depth.value === 'deep' ? 14000 : depth.value === 'standard' ? 9000 : 5000)

  // 步骤定义
  let steps: { label: string; status: 'pending' | 'running' | 'done' }[] = []
  if (depth.value === 'quick') {
    steps = [{ label: '一次性蒸馏整体写作手法', status: 'pending' }]
  } else if (depth.value === 'standard') {
    steps = [
      { label: '1/2 分析语言风格与叙事方式', status: 'pending' },
      { label: '2/2 分析对话、场景、节奏与生成模仿指南', status: 'pending' }
    ]
  } else {
    steps = [
      { label: '1/4 语言风格 + 叙事视角', status: 'pending' },
      { label: '2/4 对话 + 场景建构', status: 'pending' },
      { label: '3/4 人物塑造 + 节奏结构', status: 'pending' },
      { label: '4/4 综合评价 + 模仿指南', status: 'pending' }
    ]
  }
  progressSteps.value = steps
  analyzing.value = true
  profile.value = null
  streamingText.value = ''

  const newProfile: StyleProfile = emptyProfile()
  newProfile.name = profileName.value.trim()
  newProfile.sourceTitle = sourceTitle.value.trim()
  newProfile.sourceExcerpt = sample.slice(0, 800)

  try {
    if (depth.value === 'quick') {
      progressSteps.value[0].status = 'running'
      const r = await callAI(buildQuickPrompt(sample), cfg)
      applyQuickResult(r, newProfile)
      progressSteps.value[0].status = 'done'
    } else if (depth.value === 'standard') {
      progressSteps.value[0].status = 'running'
      const r1 = await callAI(buildLangPrompt(sample), cfg)
      applyJsonResult(r1, newProfile, ['narrativePOV', 'proseStyle'])
      progressSteps.value[0].status = 'done'

      progressSteps.value[1].status = 'running'
      const r2 = await callAI(buildDialoguePrompt(sample), cfg)
      applyJsonResult(r2, newProfile, ['dialogueStyle', 'sceneBuilding', 'characterBuilding', 'pacing'])
      // 生成总体评价与模仿指南
      const r3 = await callAI(buildSummaryPrompt(sample, newProfile), cfg)
      applyJsonResult(r3, newProfile, ['summary', 'strengths', 'weaknesses', 'imitationGuide'])
      progressSteps.value[1].status = 'done'
    } else {
      // deep
      progressSteps.value[0].status = 'running'
      const r1 = await callAI(buildLangPrompt(sample), cfg)
      applyJsonResult(r1, newProfile, ['narrativePOV', 'proseStyle'])
      progressSteps.value[0].status = 'done'

      progressSteps.value[1].status = 'running'
      const r2 = await callAI(buildDialoguePrompt(sample), cfg)
      applyJsonResult(r2, newProfile, ['dialogueStyle', 'sceneBuilding'])
      progressSteps.value[1].status = 'done'

      progressSteps.value[2].status = 'running'
      const r3 = await callAI(buildCharacterPrompt(sample), cfg)
      applyJsonResult(r3, newProfile, ['characterBuilding', 'pacing'])
      progressSteps.value[2].status = 'done'

      progressSteps.value[3].status = 'running'
      const r4 = await callAI(buildSummaryPrompt(sample, newProfile), cfg)
      applyJsonResult(r4, newProfile, ['summary', 'strengths', 'weaknesses', 'imitationGuide'])
      progressSteps.value[3].status = 'done'
    }

    profile.value = newProfile
    ElMessage.success('蒸馏完成')
  } catch (e: any) {
    ElMessage.error('蒸馏失败：' + (e?.message || ''))
  } finally {
    analyzing.value = false
    streamingText.value = ''
  }
}

function emptyProfile(): StyleProfile {
  return {
    id: '',
    projectId: 'global',
    name: '',
    sourceTitle: '',
    sourceExcerpt: '',
    summary: '',
    narrativePOV: '',
    proseStyle: '',
    dialogueStyle: '',
    sceneBuilding: '',
    characterBuilding: '',
    pacing: '',
    strengths: '',
    weaknesses: '',
    imitationGuide: '',
    tags: [],
    createdAt: 0,
    updatedAt: 0
  }
}

function pickSample(files: NovelFile[], maxChars: number): string {
  // 在多文件中均匀抽样
  const parts: string[] = []
  let total = 0
  for (const f of files) {
    const remaining = maxChars - total
    if (remaining <= 0) break
    const slice = f.content.slice(0, Math.min(remaining, Math.ceil(maxChars / files.length) + 1000))
    parts.push(`【${f.fileName}】\n${slice}`)
    total += slice.length
  }
  return parts.join('\n\n')
}

async function callAI(messages: any[], cfg: { baseUrl: string; apiKey: string }): Promise<string> {
  const req = buildRequest({
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    model: modelChoice.value,
    messages,
    temperature: 0.4,
    maxTokens: 3072
  })
  streamingText.value = '生成中...'
  const text = await chat(req)
  streamingText.value = ''
  return text
}

// ===== 各种 Prompt =====
function buildQuickPrompt(sample: string): any[] {
  return [
    {
      role: 'system',
      content: '你是文学评论家与写作教练，擅长从小说文本中蒸馏作者的写作手法。请基于给出的小说文本，按 JSON 格式输出全面但精炼的写作手法分析。JSON 字段：summary（总体评价）、narrativePOV（视角与叙事方式）、proseStyle（语言风格：用词、句式、节奏）、dialogueStyle（对话特征）、sceneBuilding（场景建构）、characterBuilding（人物塑造）、pacing（节奏与结构）、strengths（突出优点）、weaknesses（局限）、imitationGuide（给 AI 的模仿指南，可直接作为 system prompt，要具体可执行，不要套话）。只输出 JSON，不要 markdown 代码块，不要解释。'
    },
    {
      role: 'user',
      content: `请分析以下小说文本的写作手法：\n\n${sample}`
    }
  ]
}

function buildLangPrompt(sample: string): any[] {
  return [
    {
      role: 'system',
      content: '你是文学评论家，专注于语言风格与叙事视角分析。请基于给出的小说文本，输出 JSON：{"narrativePOV":"视角与叙事方式（第几人称、限知/全知、视角切换规律）","proseStyle":"语言风格（用词偏好、句式长短、节奏、修辞习惯、口语化/书面化程度、形容词密度）"}。只输出 JSON，不要代码块、不要解释。语言要具体，引用文本片段佐证。'
    },
    {
      role: 'user',
      content: `请分析以下小说文本：\n\n${sample}`
    }
  ]
}

function buildDialoguePrompt(sample: string): any[] {
  return [
    {
      role: 'system',
      content: '你是文学评论家，专注于对话与场景建构分析。请基于给出的小说文本，输出 JSON：{"dialogueStyle":"对话特征（口语真实度、潜台词、对话与动作的配合、角色语气差异）","sceneBuilding":"场景建构（环境描写密度、感官调动、空间感、镜头切换）","characterBuilding":"人物塑造（外貌描写方式、心理描写、动机揭示、立体度）","pacing":"节奏与结构（叙事速度、信息密度、悬念铺设、章节钩子）"}。只输出 JSON，不要代码块、不要解释。语言要具体。'
    },
    {
      role: 'user',
      content: `请分析以下小说文本：\n\n${sample}`
    }
  ]
}

function buildCharacterPrompt(sample: string): any[] {
  return [
    {
      role: 'system',
      content: '你是文学评论家，专注于人物塑造与节奏结构分析。请基于给出的小说文本，输出 JSON：{"characterBuilding":"人物塑造（外貌、心理、动机、立体度、配角层次）","pacing":"节奏与结构（叙事速度、信息密度、悬念铺设、章节钩子、爽点节奏）"}。只输出 JSON，不要代码块、不要解释。语言要具体。'
    },
    {
      role: 'user',
      content: `请分析以下小说文本：\n\n${sample}`
    }
  ]
}

function buildSummaryPrompt(sample: string, p: StyleProfile): any[] {
  return [
    {
      role: 'system',
      content: '你是写作教练。基于已有的多维度分析，输出最终综合评价与"给 AI 的模仿指南"。模仿指南必须具体、可执行，覆盖：用词偏好、句式模板、视角规则、对话节奏、场景建构步骤、人物塑造要点、节奏控制要点，可直接作为 system prompt 让 AI 模仿该作者笔法。输出 JSON：{"summary":"总体评价（150字内）","strengths":"突出优点（分点）","weaknesses":"局限（分点）","imitationGuide":"给 AI 的模仿指南（要长，要具体，要分条）"}。只输出 JSON，不要代码块。'
    },
    {
      role: 'user',
      content: `原作：${p.sourceTitle}\n\n前序分析：\n- 视角叙事：${p.narrativePOV}\n- 语言风格：${p.proseStyle}\n- 对话特征：${p.dialogueStyle}\n- 场景建构：${p.sceneBuilding}\n- 人物塑造：${p.characterBuilding}\n- 节奏结构：${p.pacing}\n\n原始文本片段：\n${sample.slice(0, 3000)}\n\n请输出综合评价与模仿指南。`
    }
  ]
}

function applyQuickResult(text: string, p: StyleProfile) {
  applyJsonResult(text, p, [
    'summary', 'narrativePOV', 'proseStyle', 'dialogueStyle',
    'sceneBuilding', 'characterBuilding', 'pacing',
    'strengths', 'weaknesses', 'imitationGuide'
  ])
}

function applyJsonResult(text: string, p: StyleProfile, fields: string[]) {
  const obj = tryParseJson(text)
  if (!obj) {
    // JSON 解析失败：把整段写到第一个字段
    if (fields.length > 0) (p as any)[fields[0]] = text
    return
  }
  for (const f of fields) {
    if (typeof obj[f] === 'string' && obj[f].trim()) {
      (p as any)[f] = obj[f].trim()
    }
  }
}

function tryParseJson(text: string): any | null {
  if (!text) return null
  let t = text.trim()
  // 去除 ``` 代码块
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  // 找第一个 { 到最后一个 }
  const s = t.indexOf('{')
  const e = t.lastIndexOf('}')
  if (s >= 0 && e > s) t = t.slice(s, e + 1)
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}

// ===== 保存/加载档案 =====
async function saveProfile() {
  if (!profile.value) return
  try {
    const saved = await StyleProfiles.save(profile.value)
    profile.value = saved
    ElMessage.success('已保存到文风档案库')
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e?.message || ''))
  }
}

async function applyToProject() {
  if (!profile.value || !project.value) return
  try {
    await projectStore.saveProject({
      settings: {
        ...project.value.settings,
        styleSample: profile.value.imitationGuide
      }
    })
    ElMessage.success(`已应用到项目《${project.value.title}》，后续 AI 续写会自动注入该文风`)
  } catch (e: any) {
    ElMessage.error('应用失败：' + (e?.message || ''))
  }
}

function copyGuide() {
  if (!profile.value) return
  navigator.clipboard.writeText(profile.value.imitationGuide).then(() => ElMessage.success('已复制模仿指南'))
}

// ===== 档案库 =====
const profilesVisible = ref(false)
const profilesLoading = ref(false)
const profiles = ref<StyleProfile[]>([])

async function loadProfiles() {
  profilesVisible.value = true
  profilesLoading.value = true
  try {
    const list = await StyleProfiles.list(project.value?.id || 'global')
    profiles.value = list.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (e: any) {
    ElMessage.error('加载档案失败：' + (e?.message || ''))
  } finally {
    profilesLoading.value = false
  }
}

function loadProfile(p: StyleProfile) {
  profile.value = JSON.parse(JSON.stringify(p))
  profilesVisible.value = false
  ElMessage.success(`已载入「${p.name}」`)
}

async function applyProfileToProject(p: StyleProfile) {
  if (!project.value) return
  try {
    await projectStore.saveProject({
      settings: {
        ...project.value.settings,
        styleSample: p.imitationGuide
      }
    })
    ElMessage.success(`已把「${p.name}」应用到当前项目`)
  } catch (e: any) {
    ElMessage.error('应用失败：' + (e?.message || ''))
  }
}

async function deleteProfile(p: StyleProfile) {
  try {
    await ElMessageBox.confirm(`确定删除档案「${p.name}」？`, '删除确认', { type: 'warning' })
    await StyleProfiles.remove(p.id)
    profiles.value = profiles.value.filter((x) => x.id !== p.id)
    ElMessage.success('已删除')
  } catch {
    // cancel
  }
}

function formatTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.upload-card {
  padding: 20px;
  margin-bottom: 16px;
}
.upload-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  color: var(--text-3);
  transition: all 0.15s;
}
.upload-empty:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--panel-2);
  border-radius: var(--radius);
}
.file-icon { color: var(--primary); font-size: 22px; }
.file-info { flex: 1; min-width: 0; }
.file-name {
  font-weight: 500;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.config-card {
  padding: 20px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.progress-card {
  padding: 20px;
}
.step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 14px;
}
.step .active { color: var(--primary); font-weight: 500; }
.step .done { color: var(--success); }
.streaming-text {
  margin-top: 12px;
  padding: 12px;
  background: var(--panel-2);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--text-2);
}
.profile-card {
  padding: 20px;
}
.profile-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.profile-section {
  padding: 14px 0;
}
.profile-section.strengths {
  border-left: 3px solid var(--success);
  padding-left: 14px;
}
.profile-section.weaknesses {
  border-left: 3px solid var(--warning);
  padding-left: 14px;
}
.profile-section.guide {
  background: var(--primary-light);
  padding: 14px 16px;
  border-radius: var(--radius);
  margin-top: 12px;
}
.ps-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ps-content {
  color: var(--text-2);
  line-height: 1.7;
  font-size: 13px;
  white-space: pre-wrap;
}
.guide-content {
  font-size: 13px;
  max-height: 400px;
  overflow: auto;
}
.profile-item {
  padding: 12px 14px;
  margin-bottom: 10px;
  cursor: pointer;
}
.profile-item:hover { border-color: var(--primary); }
.profile-item-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}
</style>
