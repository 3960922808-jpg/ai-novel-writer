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
            <el-slider v-model="form.zoomLevel" :min="70" :max="150" :step="5" style="flex: 1" @input="onZoomChange" />
            <span class="slider-val">{{ form.zoomLevel }}%</span>
          </div>
          <span class="text-faint text-xs" style="display:block; margin-top:2px">
            像浏览器一样整体缩放界面（70%-150%），切换立即生效
          </span>
        </el-form-item>

        <el-form-item label="背景图片">
          <div class="wallpaper-row">
            <div class="wallpaper-preview" :style="wallpaperPreviewStyle">
              <el-icon v-if="!form.wallpaper" :size="28" color="#cbd5e1"><Picture /></el-icon>
            </div>
            <div class="wallpaper-actions">
              <el-button size="small" :icon="Upload" @click="pickWallpaper">上传图片</el-button>
              <el-button
                v-if="form.wallpaper"
                size="small"
                :icon="Delete"
                @click="removeWallpaper"
              >移除背景</el-button>
              <span class="text-faint text-xs">
                上传后呈毛玻璃效果，既能看清又有点看不清
              </span>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="背景模糊度" v-if="form.wallpaper">
          <div class="slider-row">
            <el-slider v-model="form.wallpaperBlur" :min="0" :max="40" :step="1" style="flex: 1" @input="onWallpaperBlurChange" />
            <span class="slider-val">{{ form.wallpaperBlur }}px</span>
          </div>
          <span class="text-faint text-xs" style="display:block; margin-top:2px">
            数值越大背景越模糊，0=清晰可见，40=高度模糊
          </span>
        </el-form-item>
      </div>

      <div class="card section-card">
        <div class="section-title-row">
          <div class="section-title">API 配置</div>
          <div class="add-provider-group">
            <el-dropdown trigger="click" @command="quickAddProvider" placement="bottom-end">
              <el-button size="small" type="primary" :icon="Plus">
                快速添加<el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="openai">
                    <div class="quick-item">
                      <div class="quick-name">OpenAI</div>
                      <div class="quick-desc text-faint text-xs">GPT-5.5 / GPT-5.4 系列</div>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item command="deepseek">
                    <div class="quick-item">
                      <div class="quick-name">DeepSeek</div>
                      <div class="quick-desc text-faint text-xs">DeepSeek-V4-Pro / V4-Flash</div>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item command="zhipu">
                    <div class="quick-item">
                      <div class="quick-name">智谱 AI</div>
                      <div class="quick-desc text-faint text-xs">GLM-5.2 系列（1M 上下文）</div>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item command="minimax">
                    <div class="quick-item">
                      <div class="quick-name">MiniMax</div>
                      <div class="quick-desc text-faint text-xs">MiniMax-M3 / M2.7 系列</div>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item command="apikl">
                    <div class="quick-item">
                      <div class="quick-name">APIKL 中转站（Grok）</div>
                      <div class="quick-desc text-faint text-xs">api.apikl.ai · grok-4.5 等</div>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item command="relay" divided>
                    <div class="quick-item">
                      <div class="quick-name">中转站 / 自定义接口</div>
                      <div class="quick-desc text-faint text-xs">任意 BaseURL + API Key（含中转站、自建网关）</div>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item command="custom">
                    <div class="quick-item">
                      <div class="quick-name">空白 Provider</div>
                      <div class="quick-desc text-faint text-xs">手动填写所有信息</div>
                    </div>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <div class="text-faint text-xs" style="margin-bottom: 12px">
          模型只能通过下方 API 配置管理。<span style="color: var(--text-2)">支持同时保留多个 Provider 与模型配置，互不影响</span> —— 第一个「已就绪」（填了 API Key 且有模型）的将作为默认使用。
          支持任意 OpenAI 兼容接口，可直接填入<span style="color: var(--text-2)">中转站</span>地址与对应 Key。
        </div>

        <!-- 可用模型总览：直观展示多个模型共存 -->
        <div v-if="readyProviders.length > 0" class="ready-overview">
          <div class="ready-overview-head">
            <el-icon class="ready-icon"><CircleCheck /></el-icon>
            <span class="ready-overview-title">当前可用模型总览</span>
            <el-tag size="small" type="success" effect="dark">
              {{ readyProviders.length }} 个 Provider · {{ readyModelCount }} 个模型
            </el-tag>
          </div>
          <div class="ready-models-list">
            <span v-for="m in allReadyModels" :key="m" class="ready-model-chip">{{ m }}</span>
          </div>
          <div class="text-faint text-xs ready-overview-tip">
            这些模型可在写作、设定对话等功能中直接选用，新增配置不会清除已有模型。
          </div>
        </div>
        <div v-else class="ready-overview empty">
          <el-icon class="ready-icon"><InfoFilled /></el-icon>
          <span class="text-faint text-xs">还没有「已就绪」的模型配置，请添加 Provider 并填写 API Key 与模型</span>
        </div>

        <div v-for="(p, idx) in form.apiKeys" :key="idx" class="provider-card">
          <div class="provider-header">
            <el-input v-model="p.provider" size="small" style="width: 180px" placeholder="Provider 名称" />
            <el-tag
              size="small"
              :type="providerStatus(p).ok ? 'success' : 'info'"
              effect="light"
            >{{ providerStatus(p).label }} · {{ p.models.length }} 个模型</el-tag>
            <div class="provider-actions">
              <el-button
                size="small"
                :icon="Connection"
                :loading="testingIdx === idx"
                @click="testConnection(idx)"
              >测试连通性</el-button>
              <el-button size="small" type="danger" :icon="Delete" @click="removeProvider(idx)" />
            </div>
          </div>

          <div v-if="testResults[idx]" class="test-result" :class="testResults[idx].ok ? 'ok' : 'fail'">
            <el-icon><CircleCheck v-if="testResults[idx].ok" /><CircleClose v-else /></el-icon>
            <span class="test-result-msg">{{ testResults[idx].msg }}</span>
            <span
              v-if="testResults[idx].latency !== undefined"
              class="test-latency-badge"
              :class="latencyLevel(testResults[idx].latency)"
              :title="'接口延迟 ' + testResults[idx].latency + ' ms'"
            >{{ testResults[idx].latency }} ms</span>
          </div>

          <el-form-item label="BaseURL">
            <el-input v-model="p.baseUrl" placeholder="API 地址，如 https://api.openai.com/v1；中转站填其分配的地址，结尾保留 /v1" />
            <div class="text-faint text-xs" style="margin-top: 4px">
              支持官方接口与任意 OpenAI 兼容中转站 / 自建网关，结尾需包含版本号（如 /v1）
            </div>
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
import { ref, reactive, computed, nextTick, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, ArrowDown, Check, Plus, Sunny, Moon, Refresh, Monitor, Link,
  Connection, Delete, CircleCheck, CircleClose, InfoFilled, Upload, Picture
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
    zoomLevel: 100,
    wallpaper: '',
    wallpaperBlur: 20
  })

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

// 测试连通性状态
const testingIdx = ref<number | null>(null)
const testResults = ref<Record<number, { ok: boolean; msg: string; latency?: number }>>({})

// 根据延迟数值划分等级，用于徽章配色：<=300ms 优秀，<=800ms 良好，>800ms 较慢
function latencyLevel(ms: number): string {
  if (ms <= 300) return 'fast'
  if (ms <= 800) return 'ok'
  return 'slow'
}

// 多模型共存：已就绪的 Provider（填了 API Key 且至少 1 个模型）
type ApiKeyCfg = AppSettings['apiKeys'][number]
const readyProviders = computed<ApiKeyCfg[]>(() =>
  form.apiKeys.filter(p => p.apiKey && p.apiKey.trim() && p.models.length > 0)
)
const readyModelCount = computed(() => readyProviders.value.reduce((n, p) => n + p.models.length, 0))
const allReadyModels = computed(() => {
  const r: string[] = []
  for (const p of readyProviders.value) r.push(...p.models)
  return r
})
// 单个 Provider 的就绪状态徽章
function providerStatus(p: ApiKeyCfg): { ok: boolean; label: string } {
  if (p.apiKey && p.apiKey.trim() && p.models.length > 0) return { ok: true, label: '已就绪' }
  if (!p.apiKey && p.models.length === 0) return { ok: false, label: '未配置' }
  if (!p.apiKey) return { ok: false, label: '缺 API Key' }
  return { ok: false, label: '缺模型' }
}

// 大模型快速设置预设
interface ProviderPreset {
  key: string
  label: string
  provider: string
  baseUrl: string
  models: string[]
  website: string
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    provider: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    // 2026 年 GPT-5.5 / GPT-5.4 系列，已弃用 GPT-4o / GPT-3.5
    models: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
    website: 'https://platform.openai.com/api-keys'
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    provider: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    // 2026 年 4 月发布 V4 系列（1M 上下文 + Thinking 模式），已弃用 deepseek-chat / deepseek-reasoner
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    website: 'https://platform.deepseek.com/api_keys'
  },
  {
    key: 'zhipu',
    label: '智谱 AI',
    provider: '智谱AI',
    // GLM-5.2（2026-06 发布，1M 上下文，MIT 开源），新域名 z.ai
    baseUrl: 'https://api.z.ai/api/paas/v4',
    models: ['glm-5.2', 'glm-5.2-air', 'glm-5.2-flash'],
    website: 'https://z.ai/manage-apikey/apikey-list'
  },
  {
    key: 'minimax',
    label: 'MiniMax',
    provider: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    // 2026 年 M3（06 月发布，1M 上下文）+ M2.7（03 月发布，200K 上下文）
    models: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.5'],
    website: 'https://platform.minimaxi.com/user-center/basic-information/interface-key'
  },
  {
    key: 'apikl',
    label: 'APIKL 中转站（Grok）',
    provider: 'APIKL',
    // OpenAI 兼容中转站，端点固定 https://api.apikl.ai/v1
    baseUrl: 'https://api.apikl.ai/v1',
    // 实测支持的模型：grok-4.5（grok-3 已被官方下线，会报 model_not_found）
    models: ['grok-4.5'],
    website: 'https://api.apikl.ai'
  }
]

// 快速添加：根据预设填入 baseUrl/模型列表，apiKey 留空待用户填写
function quickAddProvider(cmd: string) {
  if (cmd === 'custom' || !cmd) {
    addProvider()
    return
  }
  // 中转站 / 自定义接口：填入占位 baseUrl 与提示，等用户改写
  if (cmd === 'relay') {
    if (form.apiKeys.some(p => p.provider === '中转站')) {
      ElMessage.warning('已存在「中转站」配置，请直接在下方填写 BaseURL 与 API Key')
      return
    }
    form.apiKeys.push({
      provider: '中转站',
      baseUrl: '',
      apiKey: '',
      models: []
    })
    ElMessage.success('已添加中转站配置，请填入中转站分配的 BaseURL 与 API Key（兼容 OpenAI 接口即可）')
    return
  }
  const preset = PROVIDER_PRESETS.find(p => p.key === cmd)
  if (!preset) {
    addProvider()
    return
  }
  // 已存在同名 provider 则提示
  if (form.apiKeys.some(p => p.provider === preset.provider)) {
    ElMessage.warning(`${preset.label} 已存在，请直接在下方填写 API Key`)
    return
  }
  // APIKL 中转站不再内置 Key（公开 Key 易被滥用/失效），统一由用户自行填写
  form.apiKeys.push({
    provider: preset.provider,
    baseUrl: preset.baseUrl,
    apiKey: '',
    models: [...preset.models]
  })
  ElMessage.success(`已添加 ${preset.label} 预设，请填写 API Key。申请地址：${preset.website}`)
}

// 添加自定义 Provider
function addProvider() {
  form.apiKeys.push({
    provider: `自定义 ${form.apiKeys.length + 1}`,
    baseUrl: '',
    apiKey: '',
    models: []
  })
  ElMessage.success('已添加自定义 Provider，请填写信息')
}

// 删除 Provider
function removeProvider(idx: number) {
  if (form.apiKeys.length <= 1) {
    ElMessage.warning('至少保留一个 Provider')
    return
  }
  form.apiKeys.splice(idx, 1)
}

// 测试 Provider 连通性（含延迟测量，单位 ms）
async function testConnection(idx: number) {
  const p = form.apiKeys[idx]
  if (!p.baseUrl) {
    ElMessage.warning('请先填写 BaseURL')
    return
  }
  testingIdx.value = idx
  const t0 = performance.now()
  try {
    const url = p.baseUrl.replace(/\/+$/, '') + '/models'
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (p.apiKey) headers['Authorization'] = `Bearer ${p.apiKey}`
    const res = await fetch(url, { method: 'GET', headers })
    const latency = Math.round(performance.now() - t0)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      testResults.value[idx] = {
        ok: false,
        latency,
        msg: `HTTP ${res.status} ${res.statusText}${text ? ' · ' + text.slice(0, 80) : ''}`
      }
      return
    }
    const data = await res.json()
    const models: any[] = data?.data || data?.models || []
    if (models.length > 0) {
      // 自动填充模型列表
      const ids: string[] = models.map((m: any) => m.id || m.name || m).filter(Boolean)
      const newIds = ids.filter(id => !p.models.includes(id))
      if (newIds.length > 0) p.models.push(...newIds)
      testResults.value[idx] = {
        ok: true,
        latency,
        msg: `连通成功 · 共 ${ids.length} 个模型${newIds.length > 0 ? ` · 已自动添加 ${newIds.length} 个新模型` : ''}`
      }
    } else {
      testResults.value[idx] = { ok: true, latency, msg: '连通成功（响应未返回模型列表，但 API 可用）' }
    }
  } catch (e: any) {
    const latency = Math.round(performance.now() - t0)
    testResults.value[idx] = {
      ok: false,
      latency,
      msg: '连接失败：' + (e?.message || '网络错误')
    }
  } finally {
    testingIdx.value = null
  }
}

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
  autoSaveReady.value = false
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
  // wallpaper 兼容
  if (!form.wallpaper) form.wallpaper = ''
  if (form.wallpaperBlur === undefined || form.wallpaperBlur === null) form.wallpaperBlur = 20
  // 表单填充完成后再开启自动保存，避免初始化赋值触发回写
  nextTick(() => { autoSaveReady.value = true })
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

// ===== 自定义背景图（毛玻璃） =====
const wallpaperPreviewStyle = computed(() => {
  if (!form.wallpaper) return {}
  return {
    backgroundImage: `url("${form.wallpaper}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }
})

async function pickWallpaper() {
  try {
    const filePath = await window.api.file.selectImage()
    if (!filePath) return
    // 读取为 base64 data URL（持久化到 settings，跨设备一致）
    const dataUrl = await window.api.file.readImageBase64(filePath)
    if (!dataUrl) {
      ElMessage.error('读取图片失败')
      return
    }
    form.wallpaper = dataUrl
    await settingsStore.update({ wallpaper: dataUrl, wallpaperBlur: form.wallpaperBlur })
    ElMessage.success('背景图已设置')
  } catch (e: any) {
    ElMessage.error('上传失败：' + (e?.message || '未知错误'))
  }
}

function removeWallpaper() {
  form.wallpaper = ''
  settingsStore.update({ wallpaper: '' })
  ElMessage.success('已移除背景图')
}

function onWallpaperBlurChange() {
  settingsStore.update({ wallpaperBlur: form.wallpaperBlur })
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
  // 校验：至少配置一个 Provider 的 API Key
  const hasKey = form.apiKeys.some(p => p.apiKey && p.apiKey.trim() && p.models.length > 0)
  if (!hasKey) {
    ElMessage.warning('请至少为某个 Provider 配置 API Key 与模型')
    return
  }
  saving.value = true
  try {
    await settingsStore.update({
      apiKeys: JSON.parse(JSON.stringify(form.apiKeys)),
      theme: form.theme,
      fontSize: form.fontSize,
      editorFont: form.editorFont,
      autoSaveInterval: form.autoSaveInterval,
      dataDir: form.dataDir,
      searchProvider: form.searchProvider,
      searchApiKey: form.searchApiKey,
      autoUpdateCheck: form.autoUpdateCheck,
      zoomLevel: form.zoomLevel,
      wallpaper: form.wallpaper,
      wallpaperBlur: form.wallpaperBlur
    })
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e?.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

// ===== API / 模型配置自动保存 =====
// 修复：模型配置只有点击"保存设置"才会持久化，用户改完直接重启会丢失。
// 这里对 apiKeys 做防抖自动保存，确保任何改动（新增 Provider / 填 Key / 增删模型）
// 都在停止输入后自动落盘，重启不再丢失。
const autoSaveReady = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let pendingAutoSave: Promise<any> | null = null

async function autoSaveApiKeys() {
  // 校验：至少一个 Provider 有 Key 且有模型才写回，避免把空配置覆盖到磁盘
  const hasKey = form.apiKeys.some(p => p.apiKey && p.apiKey.trim() && p.models.length > 0)
  if (!hasKey) return
  try {
    pendingAutoSave = settingsStore.update({
      apiKeys: JSON.parse(JSON.stringify(form.apiKeys))
    })
    await pendingAutoSave
  } catch (e: any) {
    // 自动保存失败不打扰用户，仅控制台记录（手动保存仍会提示）
    console.error('[settings] 模型配置自动保存失败:', e?.message || e)
  } finally {
    pendingAutoSave = null
  }
}

watch(
  () => form.apiKeys,
  () => {
    if (!autoSaveReady.value) return
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(autoSaveApiKeys, 800)
  },
  { deep: true }
)

// 离开页面前 flush 掉挂起的自动保存，防止最后 800ms 内的改动丢失
onBeforeUnmount(() => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
    autoSaveApiKeys()
  }
})
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
.wallpaper-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}
.wallpaper-preview {
  width: 88px;
  height: 56px;
  border-radius: 6px;
  border: 1px dashed var(--border);
  background: var(--panel-2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.wallpaper-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
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
/* 可用模型总览 */
.ready-overview {
  padding: 12px 14px;
  margin-bottom: 14px;
  border-radius: var(--radius);
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.25);
}
.ready-overview.empty {
  background: var(--panel-2);
  border: 1px dashed var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
}
.ready-overview.empty .ready-icon {
  color: var(--text-3);
}
.ready-overview-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.ready-icon {
  color: #10b981;
  font-size: 16px;
}
.ready-overview-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.ready-models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.ready-model-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.ready-overview-tip {
  margin-top: 2px;
}
.provider-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.provider-header > .el-tag {
  margin-right: auto;
}
.provider-actions {
  display: flex;
  gap: 6px;
}
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.section-title-row > .section-title {
  margin-bottom: 0;
  padding-left: 0;
  border-left: none;
}
/* 快速添加下拉项 */
.quick-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}
.quick-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}
.quick-desc {
  font-size: 11px;
  color: var(--text-3);
}
.test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: var(--radius);
  font-size: 13px;
  line-height: 1.5;
}
.test-result.ok {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.test-result.fail {
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.test-result-msg {
  flex: 1;
  min-width: 0;
}
.test-latency-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
  white-space: nowrap;
}
.test-latency-badge.fast {
  background: rgba(16, 185, 129, 0.18);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.4);
}
.test-latency-badge.ok {
  background: rgba(245, 158, 11, 0.18);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.4);
}
.test-latency-badge.slow {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.4);
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
