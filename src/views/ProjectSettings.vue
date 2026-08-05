<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <div>
        <h1 class="page-title">项目设置</h1>
        <p class="text-muted text-sm">配置《{{ form.title || '未命名' }}》的基本信息与 AI 参数</p>
      </div>
      <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
    </div>

    <el-form :model="form" label-width="100px" class="settings-form">
      <div class="card section-card">
        <div class="section-title">基本信息</div>

        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入小说标题" />
        </el-form-item>

        <el-form-item label="类型">
          <el-select v-model="form.genre" placeholder="选择类型" style="width: 100%">
            <el-option v-for="g in genres" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>

        <el-form-item label="状态">
          <el-select v-model="form.status" placeholder="选择状态" style="width: 100%">
            <el-option label="草稿" value="草稿" />
            <el-option label="连载中" value="连载中" />
            <el-option label="已完结" value="已完结" />
            <el-option label="暂停" value="暂停" />
          </el-select>
        </el-form-item>

        <el-form-item label="简介">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="一句话讲清故事核心"
          />
        </el-form-item>

        <el-form-item label="总字数目标">
          <el-input-number
            v-model="form.wordsTarget"
            :min="1000"
            :step="10000"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="标签">
          <div class="tags-box">
            <el-tag
              v-for="(tag, i) in form.tags"
              :key="i"
              closable
              :disable-transitions="false"
              @close="removeTag(i)"
              style="margin-right: 6px; margin-bottom: 6px"
            >
              {{ tag }}
            </el-tag>
            <el-input
              v-if="tagInputVisible"
              ref="tagInputRef"
              v-model="tagInputValue"
              size="small"
              style="width: 140px"
              @keyup.enter="addTag"
              @blur="addTag"
            />
            <el-button v-else size="small" :icon="Plus" @click="showTagInput">添加标签</el-button>
          </div>
        </el-form-item>

        <el-form-item label="封面">
          <div class="cover-row">
            <div class="cover-preview" :style="coverPreviewStyle">
              <el-icon v-if="!form.cover" :size="28" color="#cbd5e1"><Picture /></el-icon>
            </div>
            <div class="cover-actions">
              <el-button size="small" :icon="MagicStick" :loading="generatingCover" @click="openCoverGenDialog">
                AI 生成封面
              </el-button>
              <el-button size="small" :icon="Upload" @click="uploadCover">上传封面</el-button>
              <el-button v-if="form.cover" size="small" :icon="Delete" @click="removeCover">移除</el-button>
              <div class="text-faint text-xs">
                AI 生成需在「应用设置 → 图片生成」配置 OpenAI 或 Google Key
              </div>
            </div>
          </div>
        </el-form-item>
      </div>

      <div class="card section-card">
        <div class="section-title">AI 配置</div>

        <el-form-item label="写作模型">
          <el-select
            v-model="form.settings.model"
            placeholder="选择写作模型"
            style="width: 100%"
            filterable
          >
            <el-option
              v-for="m in modelOptions"
              :key="m.provider + '/' + m.model"
              :label="`${m.model}（${m.provider}）`"
              :value="m.model"
            />
          </el-select>
          <div v-if="modelOptions.length === 0" class="text-faint text-xs" style="margin-top: 4px">
            暂无可用模型，请先在「应用设置」中配置 API Key
          </div>
        </el-form-item>

        <el-form-item label="温度">
          <div class="slider-row">
            <el-slider
              v-model="form.settings.temperature"
              :min="0"
              :max="1.5"
              :step="0.1"
              style="flex: 1"
            />
            <span class="slider-val">{{ form.settings.temperature }}</span>
          </div>
        </el-form-item>

        <el-form-item label="最大 Tokens">
          <el-input-number
            v-model="form.settings.maxTokens"
            :min="256"
            :max="32768"
            :step="256"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="Top P">
          <div class="slider-row">
            <el-slider
              v-model="form.settings.topP"
              :min="0"
              :max="1"
              :step="0.1"
              style="flex: 1"
            />
            <span class="slider-val">{{ form.settings.topP }}</span>
          </div>
        </el-form-item>

        <el-form-item label="文风样本">
          <el-input
            v-model="form.settings.styleSample"
            type="textarea"
            :rows="5"
            placeholder="可粘贴一段参考文字，让 AI 学习并模仿该文风"
          />
        </el-form-item>

        <el-form-item label="评审模型">
          <el-select
            v-model="form.settings.criticModels"
            multiple
            filterable
            placeholder="选择多个模型用于 AI 评审"
            style="width: 100%"
          >
            <el-option
              v-for="m in modelOptions"
              :key="m.provider + '/' + m.model"
              :label="`${m.model}（${m.provider}）`"
              :value="m.model"
            />
          </el-select>
        </el-form-item>
      </div>

      <div class="actions">
        <el-button type="primary" :icon="Check" :loading="saving" @click="save">保存设置</el-button>
        <el-button :icon="RefreshLeft" @click="resetForm">重置</el-button>
      </div>

      <div class="card danger-card">
        <div class="section-title danger-title">
          <el-icon><Warning /></el-icon>
          <span>危险操作</span>
        </div>
        <div class="flex items-center justify-between danger-row">
          <div>
            <div class="danger-name">删除项目</div>
            <div class="text-muted text-sm">删除后无法恢复，所有章节、设定将一并清除</div>
          </div>
          <el-button type="danger" :icon="Delete" @click="confirmDelete">删除项目</el-button>
        </div>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, Plus, Check, RefreshLeft, Delete, Warning,
  Picture, Upload, MagicStick
} from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as db from '@/services/db'
import { generateImage } from '@/services/ai'
import type { Project, ImageGenRequest } from '@/types'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

const genres = ['玄幻', '都市', '科幻', '言情', '历史', '悬疑', '武侠', '仙侠', '其他']

const loading = ref(false)
const saving = ref(false)

const form = reactive<Project>({
  id: '',
  title: '',
  description: '',
  genre: '玄幻',
  status: '草稿',
  cover: '',
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  wordsTarget: 200000,
  settings: {
    model: '',
    baseUrl: '',
    apiKey: '',
    temperature: 0.8,
    maxTokens: 2048,
    topP: 1,
    criticModels: [],
    styleSample: ''
  }
})

const modelOptions = computed(() => settingsStore.availableModels())

const tagInputVisible = ref(false)
const tagInputValue = ref('')
const tagInputRef = ref<any>(null)

onMounted(async () => {
  if (projectStore.current) {
    fillForm(projectStore.current)
    return
  }
  const id = route.params.id as string
  if (!id) return
  loading.value = true
  try {
    await projectStore.loadProject(id)
    if (projectStore.current) fillForm(projectStore.current)
  } catch (e: any) {
    ElMessage.error('加载项目失败：' + (e?.message || '未知错误'))
  } finally {
    loading.value = false
  }
})

const defaultSettings = {
  model: '', baseUrl: '', apiKey: '',
  temperature: 0.8, maxTokens: 2048, topP: 1,
  criticModels: [] as string[], styleSample: ''
}

function fillForm(p: Project) {
  Object.assign(form, JSON.parse(JSON.stringify(p)))
  const ps = p.settings || {}
  form.settings = { ...defaultSettings, ...ps }
  if (!Array.isArray(form.tags)) form.tags = []
  if (!Array.isArray(form.settings.criticModels)) form.settings.criticModels = []
}

function showTagInput() {
  tagInputVisible.value = true
  nextTick(() => tagInputRef.value?.focus?.())
}

function addTag() {
  const v = tagInputValue.value.trim()
  if (v && !form.tags.includes(v)) {
    form.tags.push(v)
  }
  tagInputVisible.value = false
  tagInputValue.value = ''
}

function removeTag(i: number) {
  form.tags.splice(i, 1)
}

async function save() {
  if (!projectStore.current) {
    ElMessage.error('项目未加载')
    return
  }
  if (!form.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  saving.value = true
  try {
    await projectStore.saveProject({
      title: form.title.trim(),
      description: form.description,
      genre: form.genre,
      status: form.status,
      cover: form.cover,
      tags: form.tags,
      wordsTarget: form.wordsTarget,
      settings: { ...form.settings }
    })
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e?.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

function resetForm() {
  if (projectStore.current) {
    fillForm(projectStore.current)
    ElMessage.info('已重置为上次保存的内容')
  }
}

// ====== 封面：预览 / 上传 / 移除 / AI 生成 ======
const generatingCover = ref(false)
const coverPrompt = ref('')

const coverPreviewStyle = computed(() => {
  if (form.cover) {
    return {
      backgroundImage: `url("${form.cover}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {}
})

/** 上传封面：复用 file.selectImage + readImageBase64 */
async function uploadCover() {
  try {
    const filePath = await window.api.file.selectImage()
    if (!filePath) return
    const dataUrl = await window.api.file.readImageBase64(filePath)
    if (!dataUrl) {
      ElMessage.error('读取图片失败')
      return
    }
    form.cover = dataUrl
    ElMessage.success('封面已上传，记得点击「保存」生效')
  } catch (e: any) {
    ElMessage.error('上传失败：' + (e?.message || '未知错误'))
  }
}

/** 移除封面 */
function removeCover() {
  form.cover = ''
  ElMessage.info('已移除封面，记得点击「保存」生效')
}

/** 打开 AI 生成对话框：预填提示词，用户可编辑后生成 */
async function openCoverGenDialog() {
  const cfg = settingsStore.settings?.imageGen
  if (!cfg) {
    ElMessage.warning('请先在「应用设置 → 图片生成」配置')
    return
  }
  // 根据厂商校验 Key
  const provider = cfg.provider || 'openai'
  const apiKey = provider === 'google' ? cfg.googleApiKey : cfg.openaiApiKey
  if (!apiKey || !apiKey.trim()) {
    ElMessage.warning(`请先在「应用设置 → 图片生成」配置 ${provider === 'google' ? 'Google' : 'OpenAI'} 的 API Key`)
    return
  }

  // 预填提示词模板
  const genre = form.genre || '玄幻'
  const title = form.title || ''
  const desc = form.description || ''
  coverPrompt.value = `小说封面设计，${genre}题材${title ? '，作品《' + title + '》' : ''}${desc ? '，故事核心：' + desc : ''}。要求：高质量插画风格，构图饱满，氛围感强，有人物或场景主视觉，留出标题排版空间，竖版构图。`

  try {
    const { value } = await ElMessageBox.prompt(
      '编辑封面生成提示词（建议保留"竖版构图"以确保比例适合封面）',
      'AI 生成封面',
      {
        confirmButtonText: '生成',
        cancelButtonText: '取消',
        inputValue: coverPrompt.value,
        inputType: 'textarea',
        customClass: 'cover-prompt-dialog'
      }
    )
    if (!value || !value.trim()) return
    coverPrompt.value = value.trim()
    await doGenerateCover()
  } catch {
    // 用户取消
  }
}

/** 实际调用图片生成 */
async function doGenerateCover() {
  const cfg = settingsStore.settings?.imageGen
  if (!cfg) return
  const provider = cfg.provider || 'openai'
  const apiKey = provider === 'google' ? cfg.googleApiKey : cfg.openaiApiKey
  if (!apiKey) {
    ElMessage.warning('未配置 API Key')
    return
  }
  const req: ImageGenRequest = {
    provider,
    apiKey: apiKey.trim(),
    baseUrl: provider === 'google' ? undefined : (cfg.openaiBaseUrl || 'https://api.openai.com/v1'),
    model: provider === 'google' ? (cfg.googleModel || 'imagen-4.0-generate-001') : (cfg.openaiModel || 'gpt-image-1'),
    prompt: coverPrompt.value,
    size: '1024x1536',
    n: 1
  }
  generatingCover.value = true
  try {
    const dataUrl = await generateImage(req)
    form.cover = dataUrl
    ElMessage.success('封面已生成，记得点击「保存」生效')
  } catch (e: any) {
    ElMessage.error('生成失败：' + (e?.message || '未知错误'))
  } finally {
    generatingCover.value = false
  }
}

function confirmDelete() {
  const p = projectStore.current
  if (!p) return
  ElMessageBox.confirm(
    `确定删除《${p.title}》？所有章节、设定将一并删除，且无法恢复。`,
    '删除确认',
    {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      await db.deleteProject(p.id)
      ElMessage.success('项目已删除')
      projectStore.clear()
      router.push('/')
    } catch (e: any) {
      ElMessage.error('删除失败：' + (e?.message || '未知错误'))
    }
  }).catch(() => {})
}
</script>

<style scoped>
.settings-form {
  max-width: 820px;
}
.section-card {
  padding: 20px 24px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.tags-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.cover-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  width: 100%;
}
.cover-preview {
  width: 120px;
  height: 160px;
  border-radius: 8px;
  background: var(--bg-2, #f1f5f9);
  border: 1px dashed var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.cover-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.slider-val {
  width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
  font-size: 13px;
}
.actions {
  display: flex;
  gap: 12px;
  margin: 4px 0 24px;
}
.danger-card {
  padding: 20px 24px;
  border: 1px solid var(--danger);
}
.danger-title {
  color: var(--danger);
  display: flex;
  align-items: center;
  gap: 8px;
}
.danger-row {
  margin-top: 8px;
}
.danger-name {
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
