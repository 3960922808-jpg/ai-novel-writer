<template>
  <div class="page" :class="{ 'page-noproject': !project }">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><MagicStick /></el-icon>
          {{ project ? '技能库（Skills）' : '全局技能库' }}
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">
          技能在「写作」页的右侧 AI 对话输入框中通过 <code class="slash-code">/</code> 触发调用。这里用于管理与编辑技能。
          <span v-if="!project">此页面只显示全局技能，项目专属技能请进入对应项目内管理。</span>
        </p>
      </div>
      <div class="flex gap-2">
        <el-button v-if="!project" :icon="ArrowLeft" @click="$router.push('/')">返回书架</el-button>
        <el-button :icon="FolderOpened" @click="importFromFolder">从文件夹导入</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">添加技能</el-button>
      </div>
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
        <el-radio-button v-if="project" label="project">本项目</el-radio-button>
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
            placeholder="支持 {{变量}}，例如：请根据以下信息写战斗场景：&#10;角色：{{characters}}&#10;环境：{{env}}"
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
            <el-radio v-if="project" :label="project.id">仅当前项目</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSkill">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  MagicStick, Plus, Search, Edit, Delete, CopyDocument,
  Aim, ChatLineSquare, DataAnalysis,
  CopyDocument as CopyDoc, EditPen, Setting, Collection, Timer,
  Connection, Trophy, Files, Download, Search as SearchIcon,
  Sunny, Moon, Star, Brush, Pointer, Lightning, FolderOpened, ArrowLeft
} from '@element-plus/icons-vue'
import type { Skill } from '@/types'
import { useProjectStore } from '@/stores/project'
import { Skills as SkillsDB } from '@/services/db'
import { extractVariables } from '@/services/ai'

const projectStore = useProjectStore()
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
  loading.value = true
  try {
    // 全局模式（书架页入口）：传 'global' 只加载全局技能
    // 项目模式：传项目 ID，加载全局 + 本项目技能
    const pid = project.value?.id || 'global'
    skills.value = await SkillsDB.list(pid)
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
  // 有项目时绑定到当前项目；无项目（全局入口）时强制 global
  editing.value.projectId = project.value?.id || 'global'
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

// ===== 从本地文件夹导入 skill =====
// 支持的文件夹结构：
//   1) skill/SKILL.md（YAML frontmatter + body）
//   2) skill/prompt.md + skill/system.md
//   3) skill/config.json + skill/prompt.md
//   4) 任意 .md 文件
async function importFromFolder() {
  try {
    const folderPath = await window.api.file.selectFolder()
    if (!folderPath) return

    const data = await window.api.file.readSkillFolder(folderPath)
    if (!data) {
      ElMessage.warning('未能从该文件夹解析出 skill 内容')
      return
    }

    // 优先使用文件夹里的 systemPrompt；若 SKILL.md 的 frontmatter 没单独给出 systemPrompt，
    // 也允许把 body 拆分：前半部分作为 systemPrompt，后半部分作为 userPrompt（保持简单，不做拆分）
    const sys = (data.systemPrompt || '').trim()
    const usr = (data.userPrompt || data.systemPrompt || '').trim()

    editing.value = {
      id: '',
      projectId: project.value?.id || 'global',
      name: data.name || '导入的技能',
      description: data.description || '',
      category: data.category || '导入',
      icon: 'MagicStick',
      systemPrompt: sys,
      userPrompt: usr,
      variables: extractVariables(usr),
      recommendedModel: '',
      temperature: typeof data.temperature === 'number' ? data.temperature : 0.8,
      maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : 2048,
      tags: Array.isArray(data.tags) ? data.tags.slice(0, 20) : [],
      isBuiltIn: false,
      createdAt: 0,
      updatedAt: 0
    }
    tagInput.value = ''
    editVisible.value = true
    ElMessage.success(`已从文件夹导入：${editing.value.name}（请检查后保存）`)
  } catch (e: any) {
    ElMessage.error('导入失败：' + (e?.message || ''))
  }
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
.slash-code {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  font-family: monospace;
  color: var(--primary);
  font-weight: 600;
}
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
</style>
