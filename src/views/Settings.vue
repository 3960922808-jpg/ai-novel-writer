<template>
  <div class="settings-page" v-loading="loading">
    <div class="home-header">
      <div>
        <h1 class="page-title">应用设置</h1>
        <p class="text-muted text-sm">配置全局外观、AI 模型与 API 密钥</p>
      </div>
      <el-button :icon="ArrowLeft" @click="$router.push('/')">返回首页</el-button>
    </div>

    <el-form :model="form" label-width="110px" class="settings-form">
      <div class="card section-card">
        <div class="section-title">外观</div>

        <el-form-item label="主题">
          <el-radio-group v-model="form.themeMode" @change="onThemeChange">
            <el-radio-button label="light">
              <el-icon><Sunny /></el-icon>
              <span style="margin-left: 4px">浅色</span>
            </el-radio-button>
            <el-radio-button label="dark">
              <el-icon><Moon /></el-icon>
              <span style="margin-left: 4px">深色</span>
            </el-radio-button>
            <el-radio-button label="auto">
              <el-icon><Monitor /></el-icon>
              <span style="margin-left: 4px">跟随系统</span>
            </el-radio-button>
          </el-radio-group>
          <span class="text-faint text-xs" style="margin-left: 12px">
            切换立即生效，无需重启
          </span>
        </el-form-item>

        <el-form-item label="字体大小">
          <div class="slider-row">
            <el-slider v-model="form.fontSize" :min="12" :max="20" :step="1" style="flex: 1" @input="onFontChange" />
            <span class="slider-val">{{ form.fontSize }}px</span>
          </div>
        </el-form-item>

        <el-form-item label="编辑器字体">
          <el-select v-model="form.editorFont" style="width: 100%" @change="onFontChange">
            <el-option label="思源宋体" value="思源宋体" />
            <el-option label="思源黑体" value="思源黑体" />
            <el-option label="微软雅黑" value="微软雅黑" />
            <el-option label="宋体" value="宋体" />
            <el-option label="楷体" value="楷体" />
          </el-select>
        </el-form-item>

        <el-form-item label="界面缩放">
          <div class="slider-row">
            <el-slider v-model="form.zoomLevel" :min="70" :max="150" :step="10" style="flex: 1" @input="onZoomChange" />
            <span class="slider-val">{{ form.zoomLevel }}%</span>
          </div>
          <span class="text-faint text-xs" style="display:block; margin-top:2px">
            像浏览器一样整体缩放界面（70%-150%），切换立即生效
          </span>
        </el-form-item>
      </div>

      <div class="card section-card">
        <div class="section-title">默认 AI</div>

        <el-form-item label="默认模型">
          <el-select
            v-model="form.defaultModel"
            placeholder="选择默认模型"
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
        </el-form-item>

        <el-form-item label="默认 BaseURL">
          <el-input v-model="form.defaultBaseUrl" placeholder="例如：https://api.openai.com/v1" />
        </el-form-item>
      </div>

      <div class="card section-card">
        <div class="section-title">API 配置</div>

        <div v-for="(p, idx) in form.apiKeys" :key="p.provider" class="provider-card">
          <div class="provider-header">
            <div class="provider-name">{{ p.provider }}</div>
            <el-tag size="small" effect="plain">{{ p.models.length }} 个模型</el-tag>
          </div>

          <el-form-item label="BaseURL">
            <el-input v-model="p.baseUrl" placeholder="API 地址" />
          </el-form-item>

          <el-form-item label="API Key">
            <el-input
              v-model="p.apiKey"
              type="password"
              show-password
              placeholder="sk-..."
            />
          </el-form-item>

          <el-form-item label="模型列表">
            <div class="models-box">
              <el-tag
                v-for="(m, mi) in p.models"
                :key="mi"
                closable
                :disable-transitions="false"
                @close="removeModel(idx, mi)"
                style="margin-right: 6px; margin-bottom: 6px"
              >
                {{ m }}
              </el-tag>
              <el-input
                v-if="modelInputVisible[idx]"
                ref="modelInputRefs"
                v-model="modelInputValue[idx]"
                size="small"
                style="width: 200px"
                placeholder="模型 ID"
                @keyup.enter="addModel(idx)"
                @blur="addModel(idx)"
              />
              <el-button v-else size="small" :icon="Plus" @click="showModelInput(idx)">
                添加模型
              </el-button>
            </div>
          </el-form-item>
        </div>
      </div>

      <div class="card section-card">
        <div class="section-title">联网搜索</div>

        <el-form-item label="搜索引擎">
          <el-radio-group v-model="form.searchProvider">
            <el-radio-button label="duckduckgo">DuckDuckGo（免 Key）</el-radio-button>
            <el-radio-button label="tavily">Tavily</el-radio-button>
            <el-radio-button label="serper">Serper</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="搜索 API Key">
          <el-input
            v-model="form.searchApiKey"
            type="password"
            show-password
            placeholder="使用 DuckDuckGo 时可留空；Tavily/Serper 需填入对应 Key"
          />
          <div class="text-faint text-xs" style="margin-top: 4px">
            Tavily：<a href="https://tavily.com" target="_blank">tavily.com</a>　
            Serper：<a href="https://serper.dev" target="_blank">serper.dev</a>
          </div>
        </el-form-item>
      </div>

      <div class="card section-card">
        <div class="section-title">数据</div>

        <el-form-item label="自动保存间隔">
          <el-input-number
            v-model="form.autoSaveInterval"
            :min="5"
            :max="600"
            :step="5"
            style="width: 100%"
          />
          <span class="text-faint text-xs" style="margin-left: 8px">秒</span>
        </el-form-item>

        <el-form-item label="数据目录">
          <el-input v-model="form.dataDir" readonly />
        </el-form-item>
      </div>

      <div class="card section-card">
        <div class="section-title">应用更新</div>

        <el-form-item label="当前版本">
          <el-tag size="small" effect="plain">v{{ currentVersion }}</el-tag>
          <span v-if="lastCheckTime" class="text-faint text-xs" style="margin-left: 12px">
            上次检查：{{ lastCheckTime }}
          </span>
        </el-form-item>

        <el-form-item label="自动检查">
          <el-switch v-model="form.autoUpdateCheck" />
          <span class="text-faint text-xs" style="margin-left: 12px">
            启动后 10 秒检查一次，之后每 30 分钟轮询一次
          </span>
        </el-form-item>

        <el-form-item label="手动检查">
          <div class="update-check-row">
            <el-button type="primary" :loading="checking" :icon="Refresh" @click="checkNow">
              立即检查更新
            </el-button>
            <el-button v-if="checkResult && !checking" :icon="Link" @click="openReleases" title="在浏览器中打开 Release 页面">
              查看发布页
            </el-button>
            <span v-if="checkResult" class="text-faint text-xs" style="margin-left: 12px">
              {{ checkResult }}
            </span>
          </div>
        </el-form-item>
      </div>

      <div class="actions">
        <el-button type="primary" :icon="Check" :loading="saving" @click="save">保存设置</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, Check, Plus, Sunny, Moon, Refresh, Monitor, Link
} from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import type { AppSettings } from '@/types'

const router = useRouter()
const settingsStore = useSettingsStore()

const loading = ref(false)
const saving = ref(false)

const form = reactive<AppSettings>({
  defaultModel: '',
  defaultBaseUrl: '',
  apiKeys: [],
  theme: 'light',
  themeMode: 'light',
  fontSize: 14,
  editorFont: '思源宋体',
  autoSaveInterval: 30,
  dataDir: '',
  searchProvider: 'duckduckgo',
  searchApiKey: '',
  autoUpdateCheck: true,
  lastCommitSha: '',
  askMode: 'auto',
  zoomLevel: 100
})

const modelOptions = computed(() => settingsStore.availableModels())

// 当前版本号 — 从 package.json 注入到 vite define 或回退到 1.0.0
const currentVersion = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_VERSION) || '1.0.0'

const checking = ref(false)
const checkResult = ref('')
const lastCheckTime = ref('')
let lastReleaseUrl = ''

async function checkNow() {
  checking.value = true
  checkResult.value = '正在检查...'
  try {
    const r = await window.api.updater.check()
    lastCheckTime.value = new Date().toLocaleString('zh-CN', { hour12: false })
    if (!r) {
      checkResult.value = '检查失败：未收到响应'
      ElMessage.error(checkResult.value)
      return
    }
    // 网络错误（所有 GitHub 源都失败）
    if (r.error) {
      lastReleaseUrl = r.releaseUrl || 'https://github.com/3960922808-jpg/ai-novel-writer/releases'
      checkResult.value = `检查失败：${r.error}`
      ElMessage.warning(checkResult.value + '，可点击"查看发布页"手动下载')
      return
    }
    if (r.updated) {
      // 发现新版本 — 通知已通过 onUpdateAvailable 推送，对话框会自动弹出
      lastReleaseUrl = r.releaseUrl || ''
      const name = (r.releaseName || r.version || '').split('\n')[0]
      checkResult.value = `发现新版本：${r.version}（${name}）`
      ElMessage.success('发现新版本，请查看更新提示')
    } else if (r.hasRelease) {
      // 已是最新
      lastReleaseUrl = r.releaseUrl || ''
      checkResult.value = `已是最新版本（${r.version}）`
      ElMessage.success('当前已是最新版本')
    } else {
      checkResult.value = '暂无可用的发布版本'
      ElMessage.info('暂无可用的发布版本')
    }
  } catch (e: any) {
    checkResult.value = '检查失败：' + (e?.message || '未知错误')
    ElMessage.error(checkResult.value)
  } finally {
    checking.value = false
  }
}

function openReleases() {
  const url = lastReleaseUrl || 'https://github.com/3960922808-jpg/ai-novel-writer/releases'
  window.open(url, '_blank')
}

const modelInputVisible = ref<Record<number, boolean>>({})
const modelInputValue = ref<Record<number, string>>({})
const modelInputRefs = ref<any[] | null>(null)

onMounted(async () => {
  if (settingsStore.settings) {
    fillForm(settingsStore.settings)
    return
  }
  loading.value = true
  try {
    await settingsStore.load()
    if (settingsStore.settings) fillForm(settingsStore.settings)
  } catch (e: any) {
    ElMessage.error('加载设置失败：' + (e?.message || '未知错误'))
  } finally {
    loading.value = false
  }
})

function fillForm(s: AppSettings) {
  Object.assign(form, JSON.parse(JSON.stringify(s)))
  if (!Array.isArray(form.apiKeys)) form.apiKeys = []
  // 老数据兼容
  if (!form.searchProvider) form.searchProvider = 'duckduckgo'
  if (!form.searchApiKey) form.searchApiKey = ''
  if (form.autoUpdateCheck === undefined || form.autoUpdateCheck === null) form.autoUpdateCheck = true
  if (!form.lastCommitSha) form.lastCommitSha = ''
  // themeMode 兼容：旧数据只有 theme，没有 themeMode
  if (!form.themeMode) {
    form.themeMode = form.theme === 'dark' ? 'dark' : 'light'
  }
  // askMode 兼容
  if (!form.askMode) form.askMode = 'auto'
  // zoomLevel 兼容
  if (form.zoomLevel === undefined || form.zoomLevel === null) form.zoomLevel = 100
}

function onThemeChange() {
  // 立即生效，无需点"保存设置"
  settingsStore.update({ themeMode: form.themeMode })
}

function onFontChange() {
  // 字体大小/编辑器字体实时预览
  settingsStore.update({ fontSize: form.fontSize, editorFont: form.editorFont })
}

function onZoomChange() {
  // 界面缩放实时生效（像浏览器一样）
  settingsStore.update({ zoomLevel: form.zoomLevel })
}

function showModelInput(idx: number) {
  modelInputVisible.value[idx] = true
  modelInputValue.value[idx] = ''
  nextTick(() => {
    const arr = modelInputRefs.value
    if (Array.isArray(arr) && arr.length) {
      const el = arr[arr.length - 1]
      el?.focus?.()
    }
  })
}

function addModel(idx: number) {
  const v = (modelInputValue.value[idx] || '').trim()
  if (v && !form.apiKeys[idx].models.includes(v)) {
    form.apiKeys[idx].models.push(v)
  }
  modelInputVisible.value[idx] = false
  modelInputValue.value[idx] = ''
}

function removeModel(idx: number, mi: number) {
  form.apiKeys[idx].models.splice(mi, 1)
}

async function save() {
  if (!form.defaultModel.trim()) {
    ElMessage.warning('请选择默认模型')
    return
  }
  saving.value = true
  try {
    await settingsStore.update({
      defaultModel: form.defaultModel,
      defaultBaseUrl: form.defaultBaseUrl,
      apiKeys: JSON.parse(JSON.stringify(form.apiKeys)),
      theme: form.theme,
      fontSize: form.fontSize,
      editorFont: form.editorFont,
      autoSaveInterval: form.autoSaveInterval,
      dataDir: form.dataDir,
      searchProvider: form.searchProvider,
      searchApiKey: form.searchApiKey,
      autoUpdateCheck: form.autoUpdateCheck,
      zoomLevel: form.zoomLevel
    })
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e?.message || '未知错误'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.settings-page {
  height: 100vh;
  overflow: auto;
  padding: 28px 36px;
}
.home-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}
.home-header p {
  margin: 6px 0 0;
  font-size: 13px;
}
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
.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.slider-val {
  width: 50px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
  font-size: 13px;
}
.provider-card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 14px;
  background: var(--panel-2);
}
.provider-card:last-child {
  margin-bottom: 0;
}
.provider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.provider-name {
  font-weight: 600;
  font-size: 14px;
}
.models-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.actions {
  display: flex;
  gap: 12px;
  margin: 4px 0 24px;
}
.update-check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
