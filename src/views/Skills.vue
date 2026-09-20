<template>
  <div class="page" :class="{ 'page-noproject': !project }">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <el-icon style="vertical-align: -3px; margin-right: 6px"><MagicStick /></el-icon>
          {{ project ? '技能库' : '全局技能库' }}
        </h1>
        <p class="text-muted text-sm" style="margin: 6px 0 0">
          技能就是一套可重复使用的 AI 工作方法。在写作页输入 <code class="slash-code">/</code>，点选技能后即可真正带入规则和参考资料。
          <span v-if="!project">此页面只显示全局技能，项目专属技能请进入对应项目内管理。</span>
        </p>
      </div>
      <div class="flex gap-2">
        <el-button v-if="!project" :icon="ArrowLeft" @click="$router.push('/')">返回书架</el-button>
        <el-button :icon="Upload" @click="importFromFile">导入 MD / ZIP</el-button>
        <el-button :icon="FolderOpened" @click="importFromFolder">导入文件夹</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">添加技能</el-button>
      </div>
    </div>

    <div class="skill-guide">
      <div class="guide-step"><b>1</b><span><strong>添加</strong>：自己填写，或直接导入 <code>SKILL.md</code>、<code>.zip</code> 技能包。</span></div>
      <div class="guide-step"><b>2</b><span><strong>检查</strong>：确认“AI 要遵守的规则”和“实际执行的任务”写对了。</span></div>
      <div class="guide-step"><b>3</b><span><strong>使用</strong>：去写作页输入 <code>/</code> 选技能；参考文件会随本次请求发给 AI。</span></div>
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
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="global">全局</el-radio-button>
        <el-radio-button v-if="project" value="project">本项目</el-radio-button>
        <el-radio-button value="builtin">内置</el-radio-button>
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
        <div v-if="s.referenceFiles?.length" class="reference-badge">
          <el-icon><Files /></el-icon>
          已带 {{ s.referenceFiles.length }} 份参考资料，调用时自动引用
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
        <div class="form-explain">把它想成一张“交给 AI 的工作单”。普通用户只需填写前四项，高级参数可以保持默认。</div>
        <el-form-item label="技能名称">
          <el-input v-model="editing.name" placeholder="例如：硬核冷冽战斗" />
        </el-form-item>
        <el-form-item label="它能做什么">
          <el-input v-model="editing.description" type="textarea" :rows="2" placeholder="例如：把选中的正文润色得更自然，但不改变剧情" />
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
        <el-form-item label="AI 要遵守的规则">
          <el-input
            v-model="editing.systemPrompt"
            type="textarea"
            :rows="6"
            placeholder="告诉 AI 身份、边界和写作要求。例如：你是小说编辑，只改善语言，不新增人物，不改变剧情。"
          />
          <div class="field-help">相当于长期规则。选择这个技能后，这段内容会进入本次请求的系统指令。</div>
        </el-form-item>
        <el-form-item label="实际执行的任务">
          <el-input
            v-model="editing.userPrompt"
            type="textarea"
            :rows="6"
            placeholder="例如：请润色下面的内容：&#10;{{content}}&#10;&#10;用户补充要求：{{instruction}}"
          />
          <div class="field-help">
            可用双大括号留位置，例如 <code v-pre>{{content}}</code> 会放入正文或关联资料，<code v-pre>{{instruction}}</code> 会放入用户补充要求。已识别：
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
        <el-form-item v-if="editing.referenceFiles?.length" label="随附参考资料">
          <div class="reference-list">
            <el-tag v-for="file in editing.referenceFiles" :key="file.name" closable @close="removeReference(file.name)">
              {{ file.name }} · {{ file.content.length }} 字
            </el-tag>
            <div class="field-help">这些资料不是摆设：调用技能时会作为“技能参考资料”附在请求里。</div>
          </div>
        </el-form-item>
        <el-form-item label="推荐参数">
          <div class="param-row">
            <el-input-number v-model="editing.temperature" :min="0" :max="2" :step="0.05" :precision="2" />
            <span class="text-faint text-xs">创意程度</span>
            <el-input-number v-model="editing.maxTokens" :min="256" :max="8192" :step="256" />
            <span class="text-faint text-xs">最长输出</span>
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
            <el-radio value="global">全局（所有项目可用）</el-radio>
            <el-radio v-if="project" :value="project.id">仅当前项目</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSkill">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchImportVisible" title="选择要加入的技能" width="680px" :close-on-click-modal="false">
      <div class="batch-import-tip">这个技能包里有 {{ importChoices.length }} 个技能。已优先勾选能在写作对话中直接工作的项目；依赖浏览器、脚本或图片模型的技能暂不默认选择。</div>
      <el-checkbox-group v-model="selectedImportNames" class="batch-skill-list">
        <label v-for="item in importChoices" :key="item.name" class="batch-skill-item">
          <el-checkbox :value="item.name" />
          <div>
            <strong>{{ item.displayName || item.name }}</strong>
            <p>{{ item.description || '暂无说明' }}</p>
            <span v-if="item.referenceFiles?.length">随附 {{ item.referenceFiles.length }} 份参考资料</span>
          </div>
        </label>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="batchImportVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchImporting" :disabled="selectedImportNames.length === 0" @click="confirmBatchImport">
          加入已选的 {{ selectedImportNames.length }} 个技能
        </el-button>
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
  Sunny, Moon, Star, Brush, Pointer, Lightning, FolderOpened, ArrowLeft, Upload
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
const batchImportVisible = ref(false)
const batchImporting = ref(false)
const importChoices = ref<any[]>([])
const selectedImportNames = ref<string[]>([])

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
    referenceFiles: [],
    isBuiltIn: false,
    createdAt: 0,
    updatedAt: 0
  }
}

const detectedVars = computed(() => Array.from(new Set([
  ...extractVariables(editing.value.systemPrompt || ''),
  ...extractVariables(editing.value.userPrompt || '')
])))

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
  } catch {
    return
  }
  try {
    await SkillsDB.remove(s.id)
    skills.value = skills.value.filter((x) => x.id !== s.id)
    ElMessage.success('已删除')
  } catch (e: any) {
    ElMessage.error('删除失败：' + (e?.message || '未知错误'))
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

function removeReference(name: string) {
  editing.value.referenceFiles = (editing.value.referenceFiles || []).filter(file => file.name !== name)
}

function makeImportedSkill(data: any): Skill {
  const sys = String(data?.systemPrompt || '').trim()
  const usr = String(data?.userPrompt || data?.systemPrompt || '').trim()
  if (!usr) throw new Error('没有找到可执行的提示词，请确认文件中包含 SKILL.md 或 prompt.md')
  return {
    id: '',
    projectId: project.value?.id || 'global',
    name: data.displayName || data.name || '导入的技能',
    description: data.description || '',
    category: data.category || '导入',
    icon: 'MagicStick',
    systemPrompt: sys,
    userPrompt: usr,
    variables: Array.from(new Set([...extractVariables(sys), ...extractVariables(usr)])),
    recommendedModel: data.recommendedModel || '',
    temperature: typeof data.temperature === 'number' ? data.temperature : 0.8,
    maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : 2048,
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 20) : [],
    referenceFiles: Array.isArray(data.referenceFiles)
      ? data.referenceFiles
          .filter((file: any) => file && typeof file.name === 'string' && typeof file.content === 'string')
          .map((file: any) => ({ name: file.name, content: file.content }))
      : [],
    isBuiltIn: false,
    createdAt: 0,
    updatedAt: 0
  }
}

function applyImportedSkill(data: any, sourceLabel: string) {
  editing.value = makeImportedSkill(data)
  tagInput.value = ''
  editVisible.value = true
  const referenceTip = editing.value.referenceFiles?.length
    ? `，并识别到 ${editing.value.referenceFiles.length} 份参考资料`
    : ''
  ElMessage.success(`已从${sourceLabel}导入「${editing.value.name}」${referenceTip}，检查后点击保存`)
}

const RECOMMENDED_NOVEL_SKILLS = new Set([
  'develop-novel-concept',
  'design-novel-characters',
  'architect-novel-plot',
  'write-novel-scenes',
  'revise-novel-manuscript',
  'story-deslop',
  'story-long-write',
  'story-short-write'
])

function handleImportedData(data: any, sourceLabel: string) {
  if (!Array.isArray(data?.skills) || data.skills.length <= 1) {
    applyImportedSkill(Array.isArray(data?.skills) ? data.skills[0] : data, sourceLabel)
    return
  }
  importChoices.value = data.skills.map((item: any) => ({ ...item, displayName: item.displayName || item.name }))
  const recommended = importChoices.value.filter(item => RECOMMENDED_NOVEL_SKILLS.has(item.name)).map(item => item.name)
  selectedImportNames.value = recommended.length ? recommended : importChoices.value.map(item => item.name)
  batchImportVisible.value = true
}

async function confirmBatchImport() {
  batchImporting.value = true
  try {
    const selected = importChoices.value.filter(item => selectedImportNames.value.includes(item.name))
    let imported = 0
    for (const item of selected) {
      const skill = makeImportedSkill(item)
      const duplicate = skills.value.find(existing => existing.name === skill.name && !existing.isBuiltIn)
      if (duplicate) skill.id = duplicate.id
      const saved = await SkillsDB.save(skill)
      const index = skills.value.findIndex(existing => existing.id === saved.id)
      if (index >= 0) skills.value[index] = saved
      else skills.value.push(saved)
      imported += 1
    }
    batchImportVisible.value = false
    ElMessage.success(`已加入 ${imported} 个技能。去写作页输入 / 就能选择使用。`)
  } catch (e: any) {
    ElMessage.error('批量导入失败：' + (e?.message || ''))
  } finally {
    batchImporting.value = false
  }
}

async function importFromFile() {
  try {
    const filePath = await window.api.file.selectSkillFile()
    if (!filePath) return
    const data = await window.api.file.readSkillFile(filePath)
    handleImportedData(data, filePath.toLowerCase().endsWith('.zip') ? ' ZIP 技能包' : ' Markdown 文件')
  } catch (e: any) {
    ElMessage.error('导入失败：' + (e?.message || ''))
  }
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

    handleImportedData(data, '文件夹')
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
.skill-guide {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 16px;
}
.guide-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: linear-gradient(145deg, var(--panel), var(--panel-2));
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.55;
}
.guide-step > b {
  display: grid;
  place-items: center;
  flex: 0 0 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--primary);
  color: white;
  font-size: 12px;
}
.guide-step strong { color: var(--text); }
.guide-step code, .field-help code {
  padding: 1px 5px;
  border-radius: 6px;
  background: var(--primary-light);
  color: var(--primary);
}
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
.reference-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  padding: 4px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
  font-size: 12px;
}
.var-tag { font-family: monospace; }
.skill-footer {
  display: flex;
  gap: 4px;
  margin-top: auto;
  flex-wrap: wrap;
}
.skill-form :deep(.el-form-item__label) { font-size: 13px; }
.form-explain {
  margin: -4px 0 16px 100px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--panel-2);
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.55;
}
.field-help {
  width: 100%;
  margin-top: 5px;
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.5;
}
.reference-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}
.batch-import-tip {
  padding: 11px 13px;
  border-radius: 12px;
  background: var(--primary-light);
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.6;
}
.batch-skill-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  max-height: 460px;
  margin-top: 12px;
  overflow: auto;
}
.batch-skill-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 11px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel);
  cursor: pointer;
}
.batch-skill-item:hover { border-color: var(--primary); }
.batch-skill-item > div { min-width: 0; }
.batch-skill-item strong { color: var(--text); font-size: 13px; }
.batch-skill-item p {
  display: -webkit-box;
  margin: 4px 0;
  overflow: hidden;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.batch-skill-item span { color: var(--primary); font-size: 11px; }
.param-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 900px) {
  .skill-guide { grid-template-columns: 1fr; }
  .batch-skill-list { grid-template-columns: 1fr; }
  .form-explain { margin-left: 0; }
}
</style>
