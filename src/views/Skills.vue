<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><MagicStick /></el-icon>
          技能库（Skills）
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">技能 = system + user 双模板 + 推荐参数，比普通提示词更强大的 AI 工作流</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">添加技能</el-button>
    </div>

    <!-- 筛选 -->
    <div class="card filter-bar">
      <div class="search-wrap">
        <el-icon class="search-icon"><Search /></el-icon>
        <input v-model="keyword" class="search-input" placeholder="按名称 / 描述 / 标签搜索..." />
      </div>
      <el-select v-model="filterCat" placeholder="全部分类" clearable size="small" style="width: 140px">
        <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
      <el-radio-group v-model="scope" size="small">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="global">全局</el-radio-button>
        <el-radio-button label="project">本项目</el-radio-button>
        <el-radio-button label="builtin">内置</el-radio-button>
      </el-radio-group>
      <span class="text-faint text-xs count-tip">共 {{ filtered.length }} / {{ skills.length }} 个</span>
    </div>

    <!-- 技能卡片网格 -->
    <div v-loading="loading" class="grid grid-3 skill-grid">
      <div
        v-for="s in filtered"
        :key="s.id"
        class="card skill-card"
      >
        <div class="skill-head">
          <div class="skill-icon" :style="{ background: iconBg(s) }">
            <el-icon :size="18"><component :is="iconComp(s.icon)" /></el-icon>
          </div>
          <div class="skill-title-area">
            <div class="skill-name">
              {{ s.name }}
              <el-tag v-if="s.isBuiltIn" size="small" type="info" effect="plain">内置</el-tag>
              <el-tag v-else-if="s.projectId === 'global'" size="small" type="success" effect="plain">全局</el-tag>
              <el-tag v-else size="small" type="warning" effect="plain">项目</el-tag>
            </div>
            <div class="skill-cat text-faint text-xs">{{ s.category }}</div>
          </div>
        </div>
        <div class="skill-desc text-sm">{{ s.description || '暂无描述' }}</div>
        <div class="skill-vars" v-if="s.variables?.length">
          <el-tag v-for="v in s.variables" :key="v" size="small" effect="plain" class="var-tag" v-text="varLabel(v)" />
        </div>
        <div class="skill-footer">
          <el-button size="small" type="primary" :icon="Promotion" @click="openRun(s)">运行</el-button>
          <el-button size="small" :icon="Edit" @click="openEdit(s)">编辑</el-button>
          <el-button size="small" :icon="CopyDocument" @click="duplicate(s)">复制</el-button>
          <el-button size="small" type="danger" :icon="Delete" @click="removeSkill(s)" plain>删除</el-button>
        </div>
      </div>
    </div>

    <div v-if="!loading && filtered.length === 0" class="card empty">
      <el-icon class="empty-icon"><MagicStick /></el-icon>
      <h3>暂无技能</h3>
      <p class="text-muted">点击右上角"添加技能"创建你的第一个 AI 工作流</p>
    </div>

    <!-- 编辑/创建对话框 -->
    <el-dialog
      v-model="editVisible"
      :title="editing.id ? '编辑技能' : '新建技能'"
      width="780px"
      top="6vh"
      :close-on-click-modal="false"
    >
      <el-form :model="editing" label-width="100px" class="skill-form">
        <el-form-item label="名称">
          <el-input v-model="editing.name" placeholder="例如：硬核冷冽战斗" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editing.description" type="textarea" :rows="2" placeholder="一句话说明这个技能做什么" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="editing.category" placeholder="续写/润色/大纲/对话/场景/评审/蒸馏..." list="skill-cats" />
          <datalist id="skill-cats">
            <option v-for="c in categories" :key="c" :value="c" />
          </datalist>
        </el-form-item>
        <el-form-item label="图标">
          <el-select v-model="editing.icon" style="width: 100%">
            <el-option v-for="ic in iconList" :key="ic.name" :label="ic.name" :value="ic.name">
              <span style="display: flex; align-items: center; gap: 8px">
                <el-icon><component :is="ic.comp" /></el-icon>
                <span>{{ ic.name }}</span>
              </span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="System 提示">
          <el-input
            v-model="editing.systemPrompt"
            type="textarea"
            :rows="6"
            placeholder="设定 AI 角色与规则，例如：你是擅长冷冽战斗描写的小说家，镜头聚焦血、汗、呼吸、骨裂..."
          />
        </el-form-item>
        <el-form-item label="User 模板">
          <el-input
            v-model="editing.userPrompt"
            type="textarea"
            :rows="6"
            placeholder="支持 {{变量}}，例如：请根据以下信息写战斗场景：\n角色：{{characters}}\n环境：{{env}}"
          />
          <div class="text-faint text-xs" style="margin-top: 4px">
            自动识别的变量：
            <el-tag
              v-for="v in detectedVars"
              :key="v"
              size="small"
              effect="plain"
              style="margin-right: 4px"
            >{{ v }}</el-tag>
            <span v-if="detectedVars.length === 0">（暂无）</span>
          </div>
        </el-form-item>
        <el-form-item label="推荐参数">
          <div class="param-row">
            <el-input-number v-model="editing.temperature" :min="0" :max="2" :step="0.05" :precision="2" />
            <span class="text-faint text-xs">temperature</span>
            <el-input-number v-model="editing.maxTokens" :min="256" :max="8192" :step="256" />
            <span class="text-faint text-xs">max_tokens</span>
          </div>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="tagInput" placeholder="回车添加标签" @keyup.enter="addTag" style="width: 200px; margin-right: 8px" />
          <el-tag
            v-for="(t, i) in editing.tags"
            :key="i"
            closable
            size="small"
            @close="editing.tags.splice(i, 1)"
            style="margin-right: 6px"
          >{{ t }}</el-tag>
        </el-form-item>
        <el-form-item label="作用域">
          <el-radio-group v-model="editing.projectId">
            <el-radio label="global">全局（所有项目可用）</el-radio>
            <el-radio :label="project.id">仅当前项目</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSkill">保存</el-button>
      </template>
    </el-dialog>

    <!-- 运行技能对话框 -->
    <el-dialog
      v-model="runVisible"
      :title="`运行技能：${running?.name || ''}`"
      width="820px"
      top="6vh"
      :close-on-click-modal="false"
    >
      <div v-if="running" class="run-body">
        <div class="run-desc text-muted text-sm">{{ running.description }}</div>
        <el-divider />
        <div v-if="running.variables && running.variables.length > 0">
          <div class="section-title text-sm" style="margin-bottom: 10px">变量输入</div>
          <el-form label-width="120px">
            <el-form-item
              v-for="v in running.variables"
              :key="v"
              :label="v"
            >
              <el-input
                v-if="isLongVar(v)"
                v-model="runVars[v]"
                type="textarea"
                :rows="4"
                :placeholder="`请输入 ${v}`"
              />
              <el-input v-else v-model="runVars[v]" :placeholder="`请输入 ${v}`" />
              <el-button
                v-if="v === 'content' || v === 'context'"
                text
                size="small"
                :icon="Document"
                @click="fillFromChapter(v)"
                style="margin-top: 4px"
              >从当前章节填充</el-button>
            </el-form-item>
          </el-form>
          <el-divider />
        </div>
        <div class="run-output">
          <div class="section-title text-sm" style="margin-bottom: 10px">
            <span>AI 输出</span>
            <el-button
              v-if="runResult"
              text
              size="small"
              :icon="DocumentCopy"
              @click="copyResult"
              style="margin-left: 8px"
            >复制</el-button>
            <el-button
              v-if="runResult"
              text
              size="small"
              :icon="Plus"
              @click="appendToChapter"
              style="margin-left: 4px"
            >追加到当前章节</el-button>
          </div>
          <div v-if="runStreaming" class="run-streaming">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span class="text-muted">生成中...</span>
          </div>
          <div v-if="runResult" class="run-result">{{ runResult }}</div>
          <div v-else-if="!runStreaming" class="run-empty text-faint text-sm">
            点击"开始生成"运行技能
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="runVisible = false">关闭</el-button>
        <el-button type="primary" :loading="runStreaming" :icon="Promotion" @click="runSkill">
          {{ runResult ? '重新生成' : '开始生成' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  MagicStick, Plus, Search, Edit, Delete, CopyDocument, Promotion,
  DocumentCopy, Document, Loading, Aim, ChatLineSquare, DataAnalysis,
  CopyDocument as CopyDoc, EditPen, Setting, Collection, Timer,
  Connection, Trophy, Files, Download, Search as SearchIcon,
  Sunny, Moon, Star, Brush, Pointer, Lightning
} from '@element-plus/icons-vue'
import type { Skill } from '@/types'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { Skills as SkillsDB } from '@/services/db'
import { streamChat, buildRequest, renderTemplate, extractVariables } from '@/services/ai'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

const project = computed(() => projectStore.current)

const skills = ref<Skill[]>([])
const loading = ref(false)
const keyword = ref('')
const filterCat = ref('')
const scope = ref<'all' | 'global' | 'project' | 'builtin'>('all')

// 图标列表
const iconList = [
  { name: 'MagicStick', comp: markRaw(MagicStick) },
  { name: 'Aim', comp: markRaw(Aim) },
  { name: 'ChatLineSquare', comp: markRaw(ChatLineSquare) },
  { name: 'DataAnalysis', comp: markRaw(DataAnalysis) },
  { name: 'CopyDocument', comp: markRaw(CopyDoc) },
  { name: 'EditPen', comp: markRaw(EditPen) },
  { name: 'Search', comp: markRaw(SearchIcon) },
  { name: 'Collection', comp: markRaw(Collection) },
  { name: 'Timer', comp: markRaw(Timer) },
  { name: 'Connection', comp: markRaw(Connection) },
  { name: 'Trophy', comp: markRaw(Trophy) },
  { name: 'Files', comp: markRaw(Files) },
  { name: 'Download', comp: markRaw(Download) },
  { name: 'Setting', comp: markRaw(Setting) },
  { name: 'Star', comp: markRaw(Star) },
  { name: 'Brush', comp: markRaw(Brush) },
  { name: 'Pointer', comp: markRaw(Pointer) },
  { name: 'Lightning', comp: markRaw(Lightning) }
]

function iconComp(name: string) {
  const found = iconList.find((i) => i.name === name)
  return found ? found.comp : MagicStick
}

function varLabel(v: string) {
  return '{{' + v + '}}'
}

const categories = computed(() => {
  const set = new Set<string>()
  for (const s of skills.value) if (s.category) set.add(s.category)
  return [...set].sort()
})

const filtered = computed(() => {
  let list = skills.value.slice()
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        (s.description || '').toLowerCase().includes(kw) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(kw))
    )
  }
  if (filterCat.value) list = list.filter((s) => s.category === filterCat.value)
  if (scope.value === 'global') list = list.filter((s) => s.projectId === 'global' && !s.isBuiltIn)
  else if (scope.value === 'project') list = list.filter((s) => s.projectId === project.value?.id)
  else if (scope.value === 'builtin') list = list.filter((s) => s.isBuiltIn)
  return list
})

onMounted(load)

async function load() {
  if (!project.value) return
  loading.value = true
  try {
    skills.value = await SkillsDB.list(project.value.id)
  } catch (e: any) {
    ElMessage.error('加载技能失败：' + (e?.message || ''))
  } finally {
    loading.value = false
  }
}

// ===== 编辑/新建 =====
const editVisible = ref(false)
const saving = ref(false)
const tagInput = ref('')
const editing = ref<Skill>(emptySkill())

function emptySkill(): Skill {
  return {
    id: '',
    projectId: 'global',
    name: '',
    description: '',
    category: '自定义',
    icon: 'MagicStick',
    systemPrompt: '',
    userPrompt: '',
    variables: [],
    recommendedModel: '',
    temperature: 0.8,
    maxTokens: 2048,
    tags: [],
    isBuiltIn: false,
    createdAt: 0,
    updatedAt: 0
  }
}

const detectedVars = computed(() => extractVariables(editing.value.userPrompt))

function openCreate() {
  editing.value = emptySkill()
  if (project.value) editing.value.projectId = 'global'
  tagInput.value = ''
  editVisible.value = true
}

function openEdit(s: Skill) {
  editing.value = JSON.parse(JSON.stringify(s))
  tagInput.value = ''
  editVisible.value = true
}

function addTag() {
  const t = tagInput.value.trim()
  if (t && !editing.value.tags.includes(t)) editing.value.tags.push(t)
  tagInput.value = ''
}

async function saveSkill() {
  if (!editing.value.name.trim()) {
    ElMessage.warning('请输入技能名称')
    return
  }
  if (!editing.value.userPrompt.trim()) {
    ElMessage.warning('请填写 User 模板')
    return
  }
  saving.value = true
  try {
    editing.value.variables = detectedVars.value
    const saved = await SkillsDB.save(editing.value)
    const idx = skills.value.findIndex((s) => s.id === saved.id)
    if (idx >= 0) skills.value[idx] = saved
    else skills.value.push(saved)
    editVisible.value = false
    ElMessage.success(editing.value.id ? '已更新' : '已创建')
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e?.message || ''))
  } finally {
    saving.value = false
  }
}

async function removeSkill(s: Skill) {
  try {
    await ElMessageBox.confirm(`确定删除技能「${s.name}」？`, '删除确认', { type: 'warning' })
    await SkillsDB.remove(s.id)
    skills.value = skills.value.filter((x) => x.id !== s.id)
    ElMessage.success('已删除')
  } catch {
    // cancel
  }
}

async function duplicate(s: Skill) {
  const copy = JSON.parse(JSON.stringify(s)) as Skill
  copy.id = ''
  copy.name = s.name + ' 副本'
  copy.isBuiltIn = false
  copy.projectId = 'global'
  copy.createdAt = 0
  copy.updatedAt = 0
  const saved = await SkillsDB.save(copy)
  skills.value.push(saved)
  ElMessage.success('已复制')
}

function iconBg(s: Skill) {
  const colors = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #10b981, #06b6d4)',
    'linear-gradient(135deg, #3b82f6, #6366f1)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)'
  ]
  let hash = 0
  for (let i = 0; i < s.name.length; i++) hash = (hash * 31 + s.name.charCodeAt(i)) | 0
  return colors[Math.abs(hash) % colors.length]
}

// ===== 运行技能 =====
const runVisible = ref(false)
const running = ref<Skill | null>(null)
const runVars = ref<Record<string, string>>({})
const runResult = ref('')
const runStreaming = ref(false)

function openRun(s: Skill) {
  running.value = s
  runVars.value = {}
  runResult.value = ''
  runStreaming.value = false
  // 预填充默认值
  if (s.variables) {
    for (const v of s.variables) {
      runVars.value[v] = ''
    }
  }
  runVisible.value = true
}

function isLongVar(v: string) {
  const long = ['content', 'context', 'excerpt', 'searchResults', 'imitationGuide', 'truth', 'characters', 'setup']
  return long.includes(v)
}

async function fillFromChapter(v: string) {
  const chapter = projectStore.chapters.find((c) => c.id === (projectStore as any).currentChapterId) || projectStore.chapters[0]
  if (!chapter) {
    ElMessage.warning('当前没有章节')
    return
  }
  // 简易去 HTML
  const text = (chapter.content || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
  runVars.value[v] = text
  ElMessage.success(`已填充「${chapter.title}」`)
}

async function runSkill() {
  const s = running.value
  if (!s) return
  const project = projectStore.current
  if (!project) {
    ElMessage.warning('请先打开项目')
    return
  }
  if (!settingsStore.settings) await settingsStore.load()
  const model = s.recommendedModel || project.settings.model || settingsStore.settings!.defaultModel
  const cfg = settingsStore.findProviderForModel(model)
  if (!cfg?.apiKey) {
    ElMessage.error('AI Key 未配置，请到设置中填写')
    return
  }
  // 检查变量是否都填了
  for (const v of s.variables || []) {
    if (!runVars.value[v]?.trim()) {
      ElMessage.warning(`请填写变量：${v}`)
      return
    }
  }
  const userContent = renderTemplate(s.userPrompt, runVars.value)
  const req = buildRequest({
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    model,
    messages: [
      { role: 'system', content: s.systemPrompt || '你是一位资深小说家' },
      { role: 'user', content: userContent }
    ],
    temperature: s.temperature ?? 0.8,
    maxTokens: s.maxTokens ?? 2048
  })
  runResult.value = ''
  runStreaming.value = true
  try {
    await streamChat(req, (chunk) => {
      runResult.value += chunk
    })
  } catch (e: any) {
    ElMessage.error('生成失败：' + (e?.message || ''))
  } finally {
    runStreaming.value = false
  }
}

function copyResult() {
  if (!runResult.value) return
  navigator.clipboard.writeText(runResult.value).then(() => ElMessage.success('已复制'))
}

async function appendToChapter() {
  if (!runResult.value) return
  // 简化：跳转到编辑器 + 写入剪贴板提示
  const chapter = projectStore.chapters[0]
  if (!chapter) {
    ElMessage.warning('当前没有章节')
    return
  }
  await navigator.clipboard.writeText(runResult.value)
  ElMessage.success('已复制到剪贴板，请到编辑器粘贴')
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.search-wrap {
  position: relative;
  flex: 1;
  min-width: 220px;
  max-width: 320px;
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
}
.search-input {
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--panel-2);
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.search-input:focus { border-color: var(--primary); background: var(--panel); }
.count-tip { margin-left: auto; }
.skill-grid { margin-top: 4px; }
.skill-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.15s, box-shadow 0.15s;
}
.skill-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}
.skill-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.skill-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}
.skill-title-area { flex: 1; min-width: 0; }
.skill-name {
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.skill-cat { margin-top: 2px; }
.skill-desc {
  color: var(--text-2);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}
.skill-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.var-tag { font-family: monospace; }
.skill-footer {
  display: flex;
  gap: 4px;
  margin-top: auto;
  flex-wrap: wrap;
}
.skill-form :deep(.el-form-item__label) { font-size: 13px; }
.param-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.run-body { display: flex; flex-direction: column; gap: 12px; }
.run-output {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  background: var(--panel-2);
  min-height: 180px;
}
.run-streaming {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}
.run-result {
  white-space: pre-wrap;
  line-height: 1.8;
  font-size: 14px;
  max-height: 360px;
  overflow: auto;
}
.run-empty { padding: 20px 0; text-align: center; }
</style>
