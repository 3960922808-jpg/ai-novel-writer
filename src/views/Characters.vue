<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <h1 class="page-title">角色库</h1>
      <div class="flex gap-2">
        <el-input
          v-model="keyword"
          placeholder="搜索角色..."
          :prefix-icon="Search"
          clearable
          style="width: 220px"
        />
        <el-button :icon="MagicStick" :loading="aiGenerating" @click="openAiDialog">AI 生成角色</el-button>
        <el-button type="primary" :icon="Plus" @click="createCharacter">新建角色</el-button>
      </div>
    </div>

    <div class="char-layout" v-loading="loading">
      <div class="char-list">
        <div v-if="filtered.length === 0" class="empty card" style="padding: 40px 12px">
          <el-icon class="empty-icon"><User /></el-icon>
          <p>还没有角色</p>
        </div>
        <div
          v-for="c in filtered"
          :key="c.id"
          class="char-card card"
          :class="{ active: c.id === selectedId }"
          @click="selectChar(c)"
        >
          <div class="avatar" :style="{ background: avatarColor(c.name) }">{{ (c.name || '?')[0] }}</div>
          <div class="char-info">
            <div class="char-name">{{ c.name }}</div>
            <div class="char-sub">
              <el-tag size="small" :type="roleType(c.role)" effect="plain">{{ c.role }}</el-tag>
              <span v-if="c.age" class="text-faint text-xs">{{ c.age }}</span>
              <span v-if="c.gender" class="text-faint text-xs">{{ c.gender }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="char-editor card" v-if="current">
        <div class="editor-header">
          <div class="avatar lg" :style="{ background: avatarColor(current.name) }">{{ (current.name || '?')[0] }}</div>
          <div class="flex-1">
            <input v-model="current.name" class="name-input" placeholder="角色姓名" />
            <div class="text-faint text-xs">创建于 {{ formatTime(current.createdAt) }}</div>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-item">
            <label>角色类型</label>
            <el-select v-model="current.role" style="width: 100%">
              <el-option v-for="r in roles" :key="r" :label="r" :value="r" />
            </el-select>
          </div>
          <div class="form-item">
            <label>年龄</label>
            <el-input v-model="current.age" placeholder="如 18 或 不详" />
          </div>
          <div class="form-item">
            <label>性别</label>
            <el-input v-model="current.gender" placeholder="男 / 女 / 其他" />
          </div>
          <div class="form-item">
            <label>别名</label>
            <div class="tag-input">
              <el-tag
                v-for="(a, i) in current.aliases"
                :key="i"
                closable
                size="small"
                @close="removeAlias(i)"
              >{{ a }}</el-tag>
              <el-input
                v-model="aliasInput"
                size="small"
                style="width: 120px"
                placeholder="回车添加"
                @keyup.enter="addAlias"
              />
            </div>
          </div>
        </div>

        <div class="text-area-grid">
          <div class="form-item">
            <label>外貌</label>
            <el-input v-model="current.appearance" type="textarea" :rows="3" placeholder="外貌描写..." />
          </div>
          <div class="form-item">
            <label>性格</label>
            <el-input v-model="current.personality" type="textarea" :rows="3" placeholder="性格特点..." />
          </div>
          <div class="form-item">
            <label>背景</label>
            <el-input v-model="current.background" type="textarea" :rows="3" placeholder="身世背景..." />
          </div>
          <div class="form-item">
            <label>能力</label>
            <el-input v-model="current.abilities" type="textarea" :rows="3" placeholder="能力/技能..." />
          </div>
          <div class="form-item">
            <label>目标</label>
            <el-input v-model="current.goals" type="textarea" :rows="3" placeholder="角色目标..." />
          </div>
          <div class="form-item">
            <label>角色弧线</label>
            <el-input v-model="current.arc" type="textarea" :rows="3" placeholder="角色成长弧线..." />
          </div>
        </div>

        <div class="rel-section">
          <div class="section-title">
            <span>人物关系</span>
            <el-button size="small" :icon="Plus" @click="addRelation">添加关系</el-button>
          </div>
          <div v-if="current.relationships.length === 0" class="text-faint text-sm" style="padding: 4px 0">暂无关系</div>
          <div v-for="(r, i) in current.relationships" :key="i" class="rel-row">
            <el-select
              v-model="r.targetId"
              placeholder="选择角色"
              style="width: 140px"
              @change="(v: string) => onRelTargetChange(v, i)"
            >
              <el-option
                v-for="oc in otherCharacters(current.id)"
                :key="oc.id"
                :label="oc.name"
                :value="oc.id"
              />
            </el-select>
            <el-input v-model="r.type" placeholder="关系类型" style="width: 120px" />
            <el-input v-model="r.description" placeholder="关系描述" class="flex-1" />
            <el-button text :icon="Delete" @click="removeRelation(i)" />
          </div>
        </div>

        <div class="rel-section">
          <div class="section-title"><span>标签</span></div>
          <div class="tag-input">
            <el-tag
              v-for="(t, i) in current.tags"
              :key="i"
              closable
              size="small"
              @close="removeTag(i)"
            >{{ t }}</el-tag>
            <el-input
              v-model="tagInput"
              size="small"
              style="width: 120px"
              placeholder="回车添加"
              @keyup.enter="addTag"
            />
          </div>
        </div>

        <div class="editor-actions">
          <el-button type="danger" plain :icon="Delete" @click="removeChar">删除角色</el-button>
          <div class="flex-1"></div>
          <el-button @click="cancelSelect">取消选择</el-button>
          <el-button type="primary" :icon="Check" @click="saveChar">保存</el-button>
        </div>
      </div>

      <div class="char-editor card empty-panel" v-else>
        <div class="empty">
          <el-icon class="empty-icon"><User /></el-icon>
          <p>选择左侧角色查看详情</p>
          <p class="text-faint text-xs">或点击「新建角色」开始</p>
        </div>
      </div>
    </div>

    <el-dialog v-model="aiVisible" title="AI 生成角色" width="560px">
      <el-form label-width="80px">
        <el-form-item label="背景设定">
          <el-input
            v-model="aiForm.setup"
            type="textarea"
            :rows="5"
            placeholder="世界观、主线、人物需求等。留空则使用项目简介"
          />
        </el-form-item>
        <el-form-item label="生成数量">
          <el-input-number v-model="aiForm.count" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="AI 模型">
          <el-select v-model="aiForm.model" style="width: 100%">
            <el-option
              v-for="m in models"
              :key="m.model"
              :label="`${m.provider} / ${m.model}`"
              :value="m.model"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="aiVisible = false">取消</el-button>
        <el-button type="primary" :loading="aiGenerating" @click="doAiGenerate">生成并创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Search, User, MagicStick, Check } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { Characters, Prompts } from '@/services/db'
import * as ai from '@/services/ai'
import type { Character } from '@/types'

const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)
const models = computed(() => settings.availableModels())

const loading = ref(false)
const keyword = ref('')
const selectedId = ref('')
const current = ref<Character | null>(null)
const aliasInput = ref('')
const tagInput = ref('')

const roles: Character['role'][] = ['主角', '配角', '反派', '龙套', '其他']

const aiVisible = ref(false)
const aiGenerating = ref(false)
const aiForm = ref({ setup: '', count: 3, model: '' })

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return projectStore.characters
  return projectStore.characters.filter(c =>
    c.name.toLowerCase().includes(kw) ||
    (c.aliases || []).some(a => a.toLowerCase().includes(kw)) ||
    (c.tags || []).some(t => t.toLowerCase().includes(kw))
  )
})

watch(models, (ms) => {
  if (!aiForm.value.model && ms.length > 0) {
    aiForm.value.model = ms[0].model
  }
}, { immediate: true })

watch(() => projectStore.characters, () => {
  if (selectedId.value && !projectStore.characters.find(c => c.id === selectedId.value)) {
    selectedId.value = ''
    current.value = null
  }
})

function selectChar(c: Character) {
  selectedId.value = c.id
  current.value = JSON.parse(JSON.stringify({
    ...c,
    aliases: c.aliases || [],
    tags: c.tags || [],
    relationships: c.relationships || []
  }))
}

function cancelSelect() {
  selectedId.value = ''
  current.value = null
}

function otherCharacters(excludeId: string) {
  return projectStore.characters.filter(c => c.id !== excludeId)
}

function addAlias() {
  const v = aliasInput.value.trim()
  if (v && current.value) {
    if (!current.value.aliases.includes(v)) current.value.aliases.push(v)
    aliasInput.value = ''
  }
}

function removeAlias(i: number) {
  if (current.value) current.value.aliases.splice(i, 1)
}

function addTag() {
  const v = tagInput.value.trim()
  if (v && current.value) {
    if (!current.value.tags.includes(v)) current.value.tags.push(v)
    tagInput.value = ''
  }
}

function removeTag(i: number) {
  if (current.value) current.value.tags.splice(i, 1)
}

function addRelation() {
  if (!current.value) return
  current.value.relationships.push({ targetId: '', targetName: '', type: '', description: '' })
}

function removeRelation(i: number) {
  if (current.value) current.value.relationships.splice(i, 1)
}

function onRelTargetChange(targetId: string, i: number) {
  if (!current.value) return
  const t = projectStore.characters.find(c => c.id === targetId)
  if (t) current.value.relationships[i].targetName = t.name
}

async function createCharacter() {
  loading.value = true
  try {
    const now = Date.now()
    const c = await Characters.save({
      projectId: project.value!.id,
      name: '新角色',
      aliases: [],
      role: '配角',
      age: '',
      gender: '',
      appearance: '',
      personality: '',
      background: '',
      abilities: '',
      goals: '',
      arc: '',
      relationships: [],
      tags: [],
      createdAt: now,
      updatedAt: now
    } as any)
    await projectStore.reloadAll()
    selectChar(c)
    ElMessage.success('已创建角色')
  } catch (e: any) {
    ElMessage.error('创建失败：' + e.message)
  } finally {
    loading.value = false
  }
}

async function saveChar() {
  if (!current.value) return
  if (!current.value.name.trim()) {
    ElMessage.warning('请填写角色姓名')
    return
  }
  loading.value = true
  try {
    current.value.updatedAt = Date.now()
    const saved = await Characters.save(current.value as any)
    await projectStore.reloadAll()
    selectChar(saved)
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    loading.value = false
  }
}

async function removeChar() {
  const id = current.value?.id
  if (!id) return
  try {
    await ElMessageBox.confirm(`删除角色「${current.value!.name}」？此操作不可恢复。`, '确认删除', { type: 'warning' })
  } catch {
    return
  }
  loading.value = true
  try {
    await Characters.remove(id)
    await projectStore.reloadAll()
    selectedId.value = ''
    current.value = null
    ElMessage.success('已删除')
  } catch (e: any) {
    ElMessage.error('删除失败：' + e.message)
  } finally {
    loading.value = false
  }
}

function openAiDialog() {
  aiForm.value.setup = project.value?.description || ''
  aiVisible.value = true
}

async function doAiGenerate() {
  const provider = settings.findProviderForModel(aiForm.value.model)
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置 API Key')
    return
  }
  aiGenerating.value = true
  try {
    const prompts = await Prompts.list(project.value!.id)
    const tpl = prompts.find(p => p.category === '角色')
    if (!tpl) {
      ElMessage.warning('未找到「角色」分类的提示词模板，请先在提示词库中创建')
      return
    }
    const setup = aiForm.value.setup || project.value?.description || ''
    const content = ai.renderTemplate(tpl.content, {
      genre: project.value!.genre,
      title: project.value!.title,
      count: aiForm.value.count,
      setup
    })
    const text = await ai.chat(ai.buildRequest({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: aiForm.value.model,
      messages: [{ role: 'user', content }],
      temperature: 0.85
    }))
    const parsed = parseCharacters(text)
    if (parsed.length === 0) {
      ElMessage.warning('未能从 AI 返回中解析出角色，请重试或手动创建')
      return
    }
    const now = Date.now()
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i]
      await Characters.save({
        projectId: project.value!.id,
        name: p.name,
        aliases: p.aliases,
        role: p.role,
        age: p.age,
        gender: p.gender,
        appearance: p.appearance,
        personality: p.personality,
        background: p.background,
        abilities: p.abilities,
        goals: p.goals,
        arc: p.arc,
        relationships: [],
        tags: p.tags,
        createdAt: now + i,
        updatedAt: now + i
      } as any)
    }
    await projectStore.reloadAll()
    ElMessage.success(`已生成 ${parsed.length} 个角色`)
    aiVisible.value = false
  } catch (e: any) {
    ElMessage.error('生成失败：' + e.message)
  } finally {
    aiGenerating.value = false
  }
}

function parseCharacters(text: string) {
  const results: any[] = []
  let cur: any = null

  const startNew = () => {
    if (cur && cur.name) results.push(cur)
    cur = {
      name: '', aliases: [] as string[], role: '配角',
      age: '', gender: '', appearance: '', personality: '',
      background: '', abilities: '', goals: '', arc: '', tags: [] as string[]
    }
  }

  const fieldMap: Record<string, string> = {
    '姓名': 'name', '名字': 'name', '名称': 'name', '角色名': 'name',
    '别名': 'aliases', '外号': 'aliases', '曾用名': 'aliases', '别名/外号': 'aliases',
    '角色类型': 'role', '类型': 'role', '身份': 'role', '定位': 'role', '角色定位': 'role',
    '年龄': 'age',
    '性别': 'gender',
    '外貌': 'appearance', '外貌特征': 'appearance', '形象': 'appearance', '相貌': 'appearance', '外貌/形象': 'appearance',
    '性格': 'personality', '性格特点': 'personality', '性格特征': 'personality',
    '背景': 'background', '身世': 'background', '背景设定': 'background', '身世背景': 'background', '背景故事': 'background',
    '能力': 'abilities', '技能': 'abilities', '特长': 'abilities', '本领': 'abilities', '能力/技能': 'abilities',
    '目标': 'goals', '角色目标': 'goals', '动机': 'goals',
    '弧线': 'arc', '角色弧线': 'arc', '成长弧线': 'arc', '成长': 'arc',
    '标签': 'tags', '关键词': 'tags'
  }

  const lines = text.split('\n')
  for (let raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const h1 = line.match(/^#{2,3}\s+(?:\d+[.、]\s*)?(.+?)\s*$/)
    const h2 = line.match(/^\d+[.、]\s+\*\*([^*]+)\*\*/)
    const h3 = line.match(/^\*\*([^*]{1,20})\*\*\s*$/)
    const headingMatch = h1 || h2 || h3
    if (headingMatch) {
      const name = headingMatch[1].trim()
      if (name && !/[：:]/.test(name) && name.length <= 20) {
        if (!cur) startNew()
        else if (cur.name && cur.name !== name) startNew()
        cur.name = name
        continue
      }
    }

    const colonMatch = line.match(/^(?:[-*]\s+)?\**([^*：:]{1,12})\**\s*[：:]\s*(.+)$/)
    if (colonMatch) {
      const key = colonMatch[1].trim()
      const val = colonMatch[2].trim().replace(/\*+$/, '').trim()
      const field = fieldMap[key]
      if (field) {
        if (!cur) startNew()
        if (field === 'aliases' || field === 'tags') {
          cur[field] = val.split(/[,，、；;|]/).map((s: string) => s.trim()).filter(Boolean)
        } else if (field === 'role') {
          const r = val.match(/主角|配角|反派|龙套|其他/)?.[0]
          if (r) cur.role = r
        } else if (field === 'name') {
          if (cur.name && cur.name !== val) startNew()
          cur.name = val
        } else {
          cur[field] = val
        }
      }
    }
  }
  if (cur && cur.name) results.push(cur)
  return results
}

function roleType(r: string): any {
  return { '主角': 'primary', '配角': 'success', '反派': 'danger', '龙套': 'info', '其他': 'warning' }[r] || 'info'
}

function avatarColor(name: string) {
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4']
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return colors[Math.abs(h) % colors.length]
}

function formatTime(ts: number) {
  if (!ts) return '未知'
  const d = new Date(ts)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<style scoped>
.char-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  height: calc(100% - 70px);
  min-height: 400px;
}
.char-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}
.char-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.char-card:hover { border-color: var(--primary); }
.char-card.active {
  border-color: var(--primary);
  background: var(--primary-light);
}
.avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 18px;
  flex-shrink: 0;
}
.avatar.lg { width: 56px; height: 56px; font-size: 24px; }
.char-info { flex: 1; min-width: 0; }
.char-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.char-sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.char-editor {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.empty-panel {
  display: flex;
  align-items: center;
  justify-content: center;
}
.editor-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.name-input {
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  outline: none;
  width: 100%;
  padding: 4px 0;
}
.name-input:focus { border-bottom: 1px solid var(--primary); }
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}
.text-area-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}
.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-item label {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 500;
}
.tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  min-height: 32px;
}
.rel-section {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--panel-2);
  border-radius: var(--radius);
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}
.rel-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  align-items: center;
}
.editor-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
</style>
