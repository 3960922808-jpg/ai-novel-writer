<template>
  <div class="page">
    <!-- project 未加载时显示骨架占位 -->
    <div v-if="!project" class="loading-state">
      <el-icon class="rotating"><Loading /></el-icon>
      <p class="text-muted">正在加载项目...</p>
    </div>

    <template v-else>
    <!-- 顶部工具栏 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">人物库</h1>
        <p class="text-muted text-sm" style="margin: 4px 0 0">共 {{ people.length }} 个人物</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-input
          v-model="keyword"
          placeholder="搜索姓名/别名/标签..."
          :prefix-icon="Search"
          clearable
          style="width: 220px"
        />
        <el-select v-model="filterRole" placeholder="全部类型" clearable style="width: 130px">
          <el-option v-for="r in roles" :key="r" :label="r" :value="r" />
        </el-select>
        <el-button :icon="MagicStick" :loading="aiGenerating" @click="openAiDialog">AI 生成</el-button>
        <el-button type="primary" :icon="Plus" @click="createPerson">新建人物</el-button>
      </div>
    </div>

    <!-- 始终渲染的 wrapper：v-loading 挂这里 -->
    <div v-loading="loading" class="content-wrapper">
      <!-- 人物卡片网格 -->
      <div class="people-grid" v-if="filtered.length > 0">
        <div
          v-for="p in filtered"
          :key="p.id"
          class="person-card"
          :style="{ '--avatar-color': avatarColor(p.name) }"
          @click="openEditor(p)"
        >
          <div class="card-header">
            <div class="avatar">{{ (p.name || '?')[0] }}</div>
            <div class="card-meta">
              <div class="person-name">{{ p.name || '未命名' }}</div>
              <el-tag size="small" :type="roleType(p.role)" effect="plain">{{ p.role }}</el-tag>
            </div>
          </div>
          <div class="card-tags" v-if="p.tags && p.tags.length">
            <el-tag v-for="(t, i) in p.tags.slice(0, 3)" :key="i" size="small" type="info" effect="plain">{{ t }}</el-tag>
            <span v-if="p.tags.length > 3" class="text-faint text-xs">+{{ p.tags.length - 3 }}</span>
          </div>
          <div class="card-desc" v-if="p.personality">{{ p.personality }}</div>
          <div class="card-footer">
            <span v-if="p.age" class="text-faint text-xs">年龄 {{ p.age }}</span>
            <span v-if="p.gender" class="text-faint text-xs">{{ p.gender }}</span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <el-icon class="empty-icon"><User /></el-icon>
        <h3>{{ keyword || filterRole ? '没有匹配的人物' : '人物库还是空的' }}</h3>
        <p class="text-muted text-sm">{{ keyword || filterRole ? '试试调整搜索条件' : '点击「新建人物」或「AI 生成」开始' }}</p>
        <el-button v-if="!keyword && !filterRole" type="primary" :icon="Plus" @click="createPerson" style="margin-top: 12px">新建第一个人物</el-button>
      </div>
    </div>

    <!-- 编辑抽屉 -->
    <el-drawer
      v-model="editorVisible"
      :title="current?.id ? '编辑人物' : '新建人物'"
      direction="rtl"
      size="640px"
      :close-on-click-modal="false"
      @close="onEditorClose"
    >
      <div v-if="current" class="editor-body">
        <!-- 头部：头像 + 姓名 -->
        <div class="editor-head">
          <div class="avatar lg" :style="{ background: avatarColor(current.name) }">{{ (current.name || '?')[0] }}</div>
          <div class="flex-1">
            <input v-model="current.name" class="name-input" placeholder="人物姓名" />
            <div class="text-faint text-xs" style="margin-top: 4px">
              {{ current.createdAt ? `创建于 ${formatTime(current.createdAt)}` : '新建中' }}
            </div>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="section">
          <div class="section-label">基本信息</div>
          <div class="form-grid">
            <div class="form-item">
              <label>人物类型</label>
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
                <el-tag v-for="(a, i) in current.aliases" :key="i" closable size="small" @close="current.aliases.splice(i, 1)">{{ a }}</el-tag>
                <el-input v-model="aliasInput" size="small" style="width: 100px" placeholder="回车添加" @keyup.enter="addAlias" />
              </div>
            </div>
          </div>
        </div>

        <!-- 外貌与性格 -->
        <div class="section">
          <div class="section-label">外貌与性格</div>
          <div class="form-grid">
            <div class="form-item">
              <label>外貌</label>
              <el-input v-model="current.appearance" type="textarea" :rows="3" placeholder="外貌描写..." />
            </div>
            <div class="form-item">
              <label>性格</label>
              <el-input v-model="current.personality" type="textarea" :rows="3" placeholder="性格特点..." />
            </div>
          </div>
        </div>

        <!-- 背景与目标 -->
        <div class="section">
          <div class="section-label">背景与目标</div>
          <div class="form-grid">
            <div class="form-item">
              <label>身世背景</label>
              <el-input v-model="current.background" type="textarea" :rows="3" placeholder="身世背景..." />
            </div>
            <div class="form-item">
              <label>能力/技能</label>
              <el-input v-model="current.abilities" type="textarea" :rows="3" placeholder="能力/技能..." />
            </div>
            <div class="form-item">
              <label>人物目标</label>
              <el-input v-model="current.goals" type="textarea" :rows="3" placeholder="人物目标..." />
            </div>
            <div class="form-item">
              <label>成长弧线</label>
              <el-input v-model="current.arc" type="textarea" :rows="3" placeholder="人物成长弧线..." />
            </div>
          </div>
        </div>

        <!-- 人物关系 -->
        <div class="section">
          <div class="section-title-row">
            <span class="section-label">人物关系</span>
            <el-button size="small" :icon="Plus" @click="addRelation">添加</el-button>
          </div>
          <div v-if="current.relationships.length === 0" class="text-faint text-sm" style="padding: 4px 0">暂无关系</div>
          <div v-for="(r, i) in current.relationships" :key="i" class="rel-row">
            <el-select v-model="r.targetId" placeholder="选择人物" style="width: 140px" @change="(v: string) => onRelTargetChange(v, i)">
              <el-option v-for="oc in otherPeople(current.id)" :key="oc.id" :label="oc.name" :value="oc.id" />
            </el-select>
            <el-input v-model="r.type" placeholder="关系类型" style="width: 110px" />
            <el-input v-model="r.description" placeholder="关系描述" class="flex-1" />
            <el-button text :icon="Delete" @click="current.relationships.splice(i, 1)" />
          </div>
        </div>

        <!-- 标签 -->
        <div class="section">
          <div class="section-label">标签</div>
          <div class="tag-input">
            <el-tag v-for="(t, i) in current.tags" :key="i" closable size="small" @close="current.tags.splice(i, 1)">{{ t }}</el-tag>
            <el-input v-model="tagInput" size="small" style="width: 120px" placeholder="回车添加" @keyup.enter="addTag" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <el-button v-if="current?.id" type="danger" plain :icon="Delete" @click="removePerson">删除人物</el-button>
          <div class="flex-1"></div>
          <el-button @click="editorVisible = false">取消</el-button>
          <el-button type="primary" :icon="Check" @click="savePerson">保存</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- AI 生成对话框 -->
    <el-dialog v-model="aiVisible" title="AI 生成人物" width="560px">
      <el-form label-width="80px">
        <el-form-item label="背景设定">
          <el-input v-model="aiForm.setup" type="textarea" :rows="5" placeholder="世界观、主线、人物需求等。留空则使用项目简介" />
        </el-form-item>
        <el-form-item label="生成数量">
          <el-input-number v-model="aiForm.count" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="AI 模型">
          <el-select v-model="aiForm.model" style="width: 100%">
            <el-option v-for="m in models" :key="m.model" :label="`${m.provider} / ${m.model}`" :value="m.model" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="aiVisible = false">取消</el-button>
        <el-button type="primary" :loading="aiGenerating" @click="doAiGenerate">生成并创建</el-button>
      </template>
    </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Search, User, MagicStick, Check, ArrowLeft, Loading } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { Characters, Prompts } from '@/services/db'
import * as ai from '@/services/ai'
import type { Character } from '@/types'

// 注：后端 db 集合仍叫 characters，前端类型仍叫 Character，仅 UI 改名为"人物库"
const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)
const models = computed(() => settings.availableModels())

const loading = ref(false)
const keyword = ref('')
const filterRole = ref('')
const editorVisible = ref(false)
const current = ref<Character | null>(null)
const aliasInput = ref('')
const tagInput = ref('')

const people = computed(() => projectStore.characters)
const roles: Character['role'][] = ['主角', '配角', '反派', '龙套', '其他']

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return people.value.filter(c => {
    if (filterRole.value && c.role !== filterRole.value) return false
    if (!kw) return true
    return (
      (c.name || '').toLowerCase().includes(kw) ||
      (c.aliases || []).some(a => a.toLowerCase().includes(kw)) ||
      (c.tags || []).some(t => t.toLowerCase().includes(kw))
    )
  })
})

const aiVisible = ref(false)
const aiGenerating = ref(false)
const aiForm = ref({ setup: '', count: 3, model: '' })

watch(models, (ms) => {
  try {
    if (!aiForm.value.model && Array.isArray(ms) && ms.length > 0) {
      aiForm.value.model = ms[0].model
    }
  } catch (e) {
    console.error('[People] watch models error:', e)
  }
}, { immediate: true })

function openEditor(c: Character) {
  current.value = JSON.parse(JSON.stringify({
    ...c,
    aliases: c.aliases || [],
    tags: c.tags || [],
    relationships: c.relationships || []
  }))
  editorVisible.value = true
}

function onEditorClose() {
  current.value = null
  aliasInput.value = ''
  tagInput.value = ''
}

function otherPeople(excludeId: string) {
  return people.value.filter(c => c.id !== excludeId)
}

function addAlias() {
  const v = aliasInput.value.trim()
  if (v && current.value) {
    if (!current.value.aliases.includes(v)) current.value.aliases.push(v)
    aliasInput.value = ''
  }
}

function addTag() {
  const v = tagInput.value.trim()
  if (v && current.value) {
    if (!current.value.tags.includes(v)) current.value.tags.push(v)
    tagInput.value = ''
  }
}

function addRelation() {
  if (!current.value) return
  current.value.relationships.push({ targetId: '', targetName: '', type: '', description: '' })
}

function onRelTargetChange(targetId: string, i: number) {
  if (!current.value) return
  const t = people.value.find(c => c.id === targetId)
  if (t) current.value.relationships[i].targetName = t.name
}

async function createPerson() {
  loading.value = true
  try {
    const now = Date.now()
    const c = await Characters.save({
      projectId: project.value!.id,
      name: '新人物',
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
    openEditor(c)
    ElMessage.success('已创建人物')
  } catch (e: any) {
    ElMessage.error('创建失败：' + e.message)
  } finally {
    loading.value = false
  }
}

async function savePerson() {
  if (!current.value) return
  if (!current.value.name.trim()) {
    ElMessage.warning('请填写人物姓名')
    return
  }
  loading.value = true
  try {
    current.value.updatedAt = Date.now()
    const saved = await Characters.save(current.value as any)
    await projectStore.reloadAll()
    current.value = JSON.parse(JSON.stringify(saved))
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    loading.value = false
  }
}

async function removePerson() {
  const id = current.value?.id
  if (!id) return
  try {
    await ElMessageBox.confirm(`删除人物「${current.value!.name}」？此操作不可恢复。`, '确认删除', { type: 'warning' })
  } catch {
    return
  }
  loading.value = true
  try {
    await Characters.remove(id)
    await projectStore.reloadAll()
    editorVisible.value = false
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
    const parsed = parsePeople(text)
    if (parsed.length === 0) {
      ElMessage.warning('未能从 AI 返回中解析出人物，请重试或手动创建')
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
    ElMessage.success(`已生成 ${parsed.length} 个人物`)
    aiVisible.value = false
  } catch (e: any) {
    ElMessage.error('生成失败：' + e.message)
  } finally {
    aiGenerating.value = false
  }
}

function parsePeople(text: string) {
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
    '姓名': 'name', '名字': 'name', '名称': 'name', '人物名': 'name', '角色名': 'name',
    '别名': 'aliases', '外号': 'aliases', '曾用名': 'aliases', '别名/外号': 'aliases',
    '人物类型': 'role', '类型': 'role', '身份': 'role', '定位': 'role', '角色定位': 'role', '角色类型': 'role',
    '年龄': 'age',
    '性别': 'gender',
    '外貌': 'appearance', '外貌特征': 'appearance', '形象': 'appearance', '相貌': 'appearance', '外貌/形象': 'appearance',
    '性格': 'personality', '性格特点': 'personality', '性格特征': 'personality',
    '背景': 'background', '身世': 'background', '背景设定': 'background', '身世背景': 'background', '背景故事': 'background',
    '能力': 'abilities', '技能': 'abilities', '特长': 'abilities', '本领': 'abilities', '能力/技能': 'abilities',
    '目标': 'goals', '人物目标': 'goals', '动机': 'goals',
    '弧线': 'arc', '人物弧线': 'arc', '成长弧线': 'arc', '成长': 'arc', '角色弧线': 'arc',
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

function avatarColor(name: string): string {
  const safeName = name || '?'
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4']
  let h = 0
  for (const c of safeName) h = (h * 31 + c.charCodeAt(0)) | 0
  return colors[Math.abs(h) % colors.length]
}

function formatTime(ts: number) {
  if (!ts) return '未知'
  const d = new Date(ts)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<style scoped>
/* project 未加载时的骨架占位 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 20px;
  text-align: center;
  color: var(--text-3);
  gap: 12px;
}
.loading-state .rotating {
  animation: rotate 1s linear infinite;
  font-size: 32px;
  color: var(--primary);
}
@keyframes rotate {
  to { transform: rotate(360deg); }
}
.content-wrapper {
  min-height: 200px;
}

/* 人物卡片网格 */
.people-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.person-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.18s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.person-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: var(--avatar-color, #6366f1);
  color: white;
  font-weight: 600;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar.lg {
  width: 60px; height: 60px;
  font-size: 26px;
}
.card-meta {
  flex: 1;
  min-width: 0;
}
.person-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
}
.card-desc {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-footer {
  display: flex;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  color: var(--text-3);
}
.empty-icon {
  font-size: 56px;
  margin-bottom: 12px;
  opacity: 0.3;
}

/* 编辑抽屉 */
.editor-body {
  padding: 0 4px;
}
.editor-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 0 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border);
}
.name-input {
  border: none;
  background: transparent;
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  outline: none;
  width: 100%;
  padding: 4px 0;
  border-bottom: 1px solid transparent;
}
.name-input:focus {
  border-bottom-color: var(--primary);
}
.section {
  margin-bottom: 18px;
}
.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid var(--primary);
}
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.section-title-row .section-label {
  margin-bottom: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
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
  border-radius: 6px;
  background: var(--panel);
  min-height: 32px;
}
.rel-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.drawer-footer {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
