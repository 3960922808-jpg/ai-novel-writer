<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <h1 class="page-title">提示词库</h1>
      <div class="flex gap-2">
        <el-input
          v-model="search"
          :prefix-icon="Search"
          placeholder="搜索标题或内容"
          clearable
          style="width: 220px"
        />
        <el-select v-model="filterCategory" placeholder="分类筛选" clearable style="width: 130px">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建提示词</el-button>
      </div>
    </div>

    <div class="layout">
      <aside class="sidebar card">
        <div class="cat-item" :class="{ active: activeCategory === '' }" @click="activeCategory = ''">
          <span>全部</span>
          <span class="cat-count">{{ prompts.length }}</span>
        </div>
        <div
          v-for="c in categories"
          :key="c"
          class="cat-item"
          :class="{ active: activeCategory === c }"
          @click="activeCategory = c"
        >
          <span>{{ c }}</span>
          <span class="cat-count">{{ countByCategory(c) }}</span>
        </div>
      </aside>

      <div class="main-area">
        <div v-if="filtered.length === 0" class="empty card">
          <el-icon class="empty-icon"><MagicStick /></el-icon>
          <p>暂无提示词</p>
          <el-button type="primary" :icon="Plus" @click="openCreate" style="margin-top:12px">新建提示词</el-button>
        </div>
        <div v-else class="grid grid-3">
          <div
            v-for="p in filtered"
            :key="p.id"
            class="prompt-card card"
            @click="openEdit(p)"
          >
            <div class="flex justify-between items-center" style="margin-bottom:8px">
              <h3 class="prompt-title">{{ p.title }}</h3>
              <el-tag size="small" effect="plain" :type="p.isBuiltIn ? 'info' : 'primary'">
                {{ p.isBuiltIn ? '内置' : '项目' }}
              </el-tag>
            </div>
            <el-tag size="small" effect="plain" style="margin-bottom:8px">{{ p.category }}</el-tag>
            <p class="prompt-content">{{ p.content.slice(0, 100) }}{{ p.content.length > 100 ? '...' : '' }}</p>
            <div class="vars" v-if="p.variables && p.variables.length">
              <el-tag
                v-for="v in p.variables"
                :key="v"
                size="small"
                type="info"
                effect="plain"
                class="var-tag"
              >{{ varTag(v) }}</el-tag>
            </div>
            <div class="card-actions" @click.stop>
              <el-button text size="small" :icon="MagicStick" @click="openTest(p)">测试</el-button>
              <el-button text size="small" :icon="Edit" @click="openEdit(p)">{{ p.isBuiltIn ? '查看' : '编辑' }}</el-button>
              <el-button
                v-if="!p.isBuiltIn"
                text
                size="small"
                :icon="Delete"
                @click="confirmDelete(p)"
                style="color: var(--danger)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="editVisible"
      :title="editing.id ? (editing.isBuiltIn ? '查看提示词' : '编辑提示词') : '新建提示词'"
      width="720px"
      @closed="onEditClose"
    >
      <el-form label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="editing.title" :disabled="editing.isBuiltIn" placeholder="提示词标题" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editing.category" :disabled="editing.isBuiltIn" style="width:100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="editing.content"
            type="textarea"
            :rows="12"
            :disabled="editing.isBuiltIn"
            placeholder="使用 {{变量名}} 表示变量，例如：请基于以下设定续写：{{设定}}"
            class="mono"
          />
        </el-form-item>
        <el-form-item label="变量">
          <div v-if="extractedVars.length" class="vars">
            <el-tag
              v-for="v in extractedVars"
              :key="v"
              size="small"
              type="info"
              effect="plain"
              class="var-tag"
            >{{ varTag(v) }}</el-tag>
          </div>
          <span v-else class="text-faint text-xs">无变量（内容中以双花括号标记变量）</span>
        </el-form-item>
        <el-form-item label="内置">
          <el-checkbox v-model="editing.isBuiltIn" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">关闭</el-button>
        <el-button v-if="!editing.isBuiltIn" type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="testVisible" title="测试运行" width="720px">
      <el-form label-width="80px">
        <el-form-item label="AI 模型">
          <el-select v-model="testModel" style="width:100%" placeholder="请选择模型">
            <el-option
              v-for="m in models"
              :key="m.model"
              :label="`${m.provider} / ${m.model}`"
              :value="m.model"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="testing.variables.length" label="变量值">
          <div style="width:100%">
            <div v-for="v in testing.variables" :key="v" class="var-input-row">
              <span class="var-label">{{ varTag(v) }}</span>
              <el-input v-model="testVars[v]" type="textarea" :rows="2" :placeholder="`输入 ${v} 的值`" />
            </div>
          </div>
        </el-form-item>
        <el-form-item v-else label="变量值">
          <span class="text-faint text-xs">该提示词无变量</span>
        </el-form-item>
        <el-form-item label="结果">
          <div v-if="testResult" class="test-result mono">{{ testResult }}</div>
          <div v-else-if="!testingRunning" class="text-faint text-xs">点击下方按钮运行</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="testVisible = false">关闭</el-button>
        <el-button type="primary" :icon="MagicStick" :loading="testingRunning" @click="runTest">运行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Search, MagicStick } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { Prompts } from '@/services/db'
import * as ai from '@/services/ai'
import type { Prompt } from '@/types'

const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)

function varTag(v: string): string {
  return '{{' + v + '}}'
}
const models = computed(() => settings.availableModels())

const categories = ['续写', '润色', '重写', '扩写', '缩写', '大纲', '摘要', '角色', '对话', '场景', '评审', '其他']

const prompts = ref<Prompt[]>([])
const search = ref('')
const filterCategory = ref('')
const activeCategory = ref('')

const editVisible = ref(false)
const editing = reactive<Prompt>({
  id: '',
  projectId: 'global',
  category: '续写',
  title: '',
  content: '',
  variables: [],
  isBuiltIn: false,
  createdAt: 0,
  updatedAt: 0
})

const extractedVars = computed(() => ai.extractVariables(editing.content))

const testVisible = ref(false)
const testing = reactive<{ variables: string[]; content: string }>({ variables: [], content: '' })
const testVars = reactive<Record<string, string>>({})
const testModel = ref('')
const testResult = ref('')
const testingRunning = ref(false)

watch(() => project.value?.id, (id) => {
  if (id) load()
}, { immediate: true })

async function load() {
  if (!project.value) return
  try {
    prompts.value = await Prompts.list(project.value.id)
  } catch (e: any) {
    ElMessage.error('加载失败：' + e.message)
  }
}

const filtered = computed(() => {
  let r = prompts.value
  const cat = activeCategory.value || filterCategory.value
  if (cat) r = r.filter(p => p.category === cat)
  const kw = search.value.trim().toLowerCase()
  if (kw) r = r.filter(p => p.title.toLowerCase().includes(kw) || p.content.toLowerCase().includes(kw))
  return r
})

function countByCategory(c: string) {
  return prompts.value.filter(p => p.category === c).length
}

function openCreate() {
  Object.assign(editing, {
    id: '',
    projectId: project.value?.id || 'global',
    category: '续写',
    title: '',
    content: '',
    variables: [],
    isBuiltIn: false,
    createdAt: 0,
    updatedAt: 0
  })
  editVisible.value = true
}

function openEdit(p: Prompt) {
  Object.assign(editing, p)
  editVisible.value = true
}

function onEditClose() {
  Object.assign(editing, {
    id: '',
    projectId: 'global',
    category: '续写',
    title: '',
    content: '',
    variables: [],
    isBuiltIn: false,
    createdAt: 0,
    updatedAt: 0
  })
}

async function save() {
  if (!editing.title.trim()) { ElMessage.warning('请输入标题'); return }
  if (!editing.content.trim()) { ElMessage.warning('请输入内容'); return }
  const isNew = !editing.id
  const doc: any = {
    ...editing,
    variables: extractedVars.value,
    updatedAt: Date.now()
  }
  if (isNew) {
    delete doc.id
    doc.createdAt = Date.now()
  }
  try {
    await Prompts.save(doc)
    ElMessage.success('保存成功')
    editVisible.value = false
    await load()
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  }
}

async function confirmDelete(p: Prompt) {
  try {
    await ElMessageBox.confirm(`删除提示词《${p.title}》？`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await Prompts.remove(p.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    ElMessage.error('删除失败：' + e.message)
  }
}

function openTest(p: Prompt) {
  testing.variables = [...p.variables]
  testing.content = p.content
  Object.keys(testVars).forEach(k => delete testVars[k])
  p.variables.forEach(v => { testVars[v] = '' })
  testResult.value = ''
  testModel.value = settings.settings?.defaultModel || (models.value[0]?.model || '')
  testVisible.value = true
}

async function runTest() {
  if (!testModel.value) { ElMessage.warning('请选择 AI 模型'); return }
  const provider = settings.findProviderForModel(testModel.value)
  if (!provider?.apiKey) { ElMessage.warning('请先配置 API Key'); return }
  testingRunning.value = true
  testResult.value = ''
  try {
    const content = ai.renderTemplate(testing.content, testVars)
    const text = await ai.chat(ai.buildRequest({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: testModel.value,
      messages: [{ role: 'user', content }],
      temperature: 0.7
    }))
    testResult.value = text
    ElMessage.success('生成完成')
  } catch (e: any) {
    ElMessage.error('生成失败：' + e.message)
  } finally {
    testingRunning.value = false
  }
}
</script>

<style scoped>
.layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.sidebar {
  width: 200px;
  padding: 8px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
}
.cat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-2);
  transition: all 0.15s;
}
.cat-item:hover { background: var(--panel-2); color: var(--text); }
.cat-item.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 500;
}
.cat-count {
  font-size: 11px;
  background: var(--panel-2);
  padding: 1px 6px;
  border-radius: 8px;
  color: var(--text-3);
  min-width: 20px;
  text-align: center;
}
.cat-item.active .cat-count { background: var(--primary); color: white; }
.main-area { flex: 1; min-width: 0; }
.prompt-card {
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
}
.prompt-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
}
.prompt-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 6px;
}
.prompt-content {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.6;
  margin: 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 56px;
}
.vars {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.var-tag {
  font-family: 'JetBrains Mono', 'Menlo', monospace;
  font-size: 11px;
}
.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
  margin-top: auto;
}
.mono {
  font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
}
.test-result {
  background: var(--panel-2);
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  max-height: 320px;
  overflow-y: auto;
  width: 100%;
}
.var-input-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}
.var-label {
  width: 120px;
  font-family: 'JetBrains Mono', 'Menlo', monospace;
  font-size: 12px;
  color: var(--primary);
  padding-top: 6px;
  flex-shrink: 0;
}
</style>
