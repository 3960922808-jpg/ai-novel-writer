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
            <el-radio-button value="light">
              <el-icon><Sunny /></el-icon>
              <span style="margin-left: 4px">浅色</span>
            </el-radio-button>
            <el-radio-button value="dark">
              <el-icon><Moon /></el-icon>
              <span style="margin-left: 4px">深色</span>
            </el-radio-button>
            <el-radio-button value="auto">
              <el-icon><Monitor /></el-icon>
              <span style="margin-left: 4px">跟随系统</span>
            </el-radio-button>
          </el-radio-group>
          <span class="text-faint text-xs" style="margin-left: 12px">
            切换立即生效，无需重启
          </span>
        </el-form-item>

        <el-form-item label="主题颜色">
          <div class="color-settings">
            <div class="color-presets">
              <button
                v-for="item in accentPresets"
                :key="item.value"
                type="button"
                class="color-swatch"
                :class="{ active: form.accentColor === item.value }"
                :style="{ '--swatch-color': item.value }"
                :title="item.label"
                @click="setAccentColor(item.value)"
              ><span></span></button>
              <el-color-picker
                v-model="form.accentColor"
                :predefine="accentPresets.map(item => item.value)"
                color-format="hex"
                @active-change="onAccentPreview"
                @change="onAccentCommit"
              />
            </div>
            <span class="text-faint text-xs">按钮、选中项、链接和编辑器焦点会同步换色</span>
          </div>
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

        <div class="appearance-preview" :class="{ 'with-wallpaper': !!form.wallpaper }" :style="appearancePreviewStyle">
          <video
            v-if="form.backgroundType === 'video' && form.backgroundVideoPath"
            class="preview-video"
            :src="backgroundVideoPreviewUrl"
            autoplay muted loop playsinline
          ></video>
          <div class="preview-sidebar"></div>
          <div class="preview-body">
            <span class="preview-pill"></span>
            <span class="preview-line long"></span>
            <span class="preview-line"></span>
            <span class="preview-button">创作</span>
          </div>
          <span class="preview-label">实时预览</span>
        </div>

        <el-form-item label="工作台背景">
          <el-segmented v-model="form.backgroundType" :options="backgroundTypeOptions" @change="onBackgroundTypeChange" />
        </el-form-item>

        <el-form-item v-if="form.backgroundType === 'image'" label="背景图片">
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
              <span class="text-faint text-xs">支持 JPG、PNG、WebP，设置会保存在本机并跨重启生效</span>
            </div>
          </div>
        </el-form-item>

        <el-form-item v-if="form.backgroundType === 'video'" label="背景视频">
          <div class="video-background-row">
            <div class="video-file-info">
              <strong>{{ backgroundVideoName || '尚未选择视频' }}</strong>
              <span class="text-faint text-xs">支持 MP4、WebM、MOV、M4V、OGV，最大 1 GB；始终静音循环播放</span>
            </div>
            <el-button size="small" :icon="Upload" @click="pickBackgroundVideo">选择视频</el-button>
            <el-button v-if="form.backgroundVideoPath" size="small" :icon="Delete" @click="removeBackgroundVideo">移除视频</el-button>
          </div>
        </el-form-item>

        <el-form-item label="背景模糊度" v-if="hasBackgroundMedia">
          <div class="slider-row">
            <el-slider v-model="form.wallpaperBlur" :min="0" :max="40" :step="1" style="flex: 1" @input="onWallpaperBlurChange" />
            <span class="slider-val">{{ form.wallpaperBlur }}px</span>
          </div>
          <span class="text-faint text-xs" style="display:block; margin-top:2px">
            数值越大背景越模糊，0=清晰可见，40=高度模糊
          </span>
        </el-form-item>

        <template v-if="hasBackgroundMedia">
          <el-form-item label="壁纸亮度">
            <div class="slider-row">
              <el-slider v-model="form.wallpaperOpacity" :min="20" :max="100" :step="1" style="flex: 1" @input="onAppearanceSliderChange" />
              <span class="slider-val">{{ form.wallpaperOpacity }}%</span>
            </div>
          </el-form-item>

          <el-form-item label="遮罩强度">
            <div class="slider-row">
              <el-slider v-model="form.wallpaperOverlay" :min="0" :max="90" :step="1" style="flex: 1" @input="onAppearanceSliderChange" />
              <span class="slider-val">{{ form.wallpaperOverlay }}%</span>
            </div>
          </el-form-item>

          <el-form-item label="面板透明度">
            <div class="slider-row">
              <el-slider v-model="form.panelOpacity" :min="35" :max="100" :step="1" style="flex: 1" @input="onAppearanceSliderChange" />
              <span class="slider-val">{{ form.panelOpacity }}%</span>
            </div>
          </el-form-item>

          <el-form-item label="媒体显示">
            <div class="wallpaper-layout-options">
              <el-segmented v-model="form.wallpaperFit" :options="wallpaperFitOptions" @change="onAppearanceSliderChange" />
              <el-segmented v-model="form.wallpaperPosition" :options="wallpaperPositionOptions" @change="onAppearanceSliderChange" />
            </div>
          </el-form-item>

          <el-form-item v-if="form.backgroundType === 'video'" label="播放速度">
            <el-segmented v-model="form.backgroundVideoPlaybackRate" :options="videoRateOptions" @change="onAppearanceSliderChange" />
          </el-form-item>
        </template>

        <div class="appearance-actions">
          <el-button size="small" @click="resetAppearance">恢复默认外观</el-button>
          <span class="text-faint text-xs">所有外观修改都会自动保存</span>
        </div>
      </div>

      <div class="card section-card community-section">
        <div class="section-title-row">
          <div>
            <div class="section-title">公益模型</div>
            <div class="text-faint text-xs">启用后会出现在写作、设定对话和技能的模型选择器中</div>
          </div>
          <el-switch v-model="communityModel.enabled" size="large" inline-prompt active-text="已启用" inactive-text="未启用" />
        </div>
        <div class="community-hero" :class="{ active: communityModel.enabled }">
          <div class="community-logo">N</div>
          <div class="community-main">
            <div class="community-name">
              NVIDIA NIM
              <el-tag round size="small" :type="communityReady ? 'success' : 'info'">{{ communityReady ? '可以直接调用' : '等待配置' }}</el-tag>
            </div>
            <div class="text-faint text-xs">英伟达官方开发者免费端点 · OpenAI 兼容接口</div>
          </div>
          <el-button round :loading="testingCommunity" @click="refreshCommunityModels">检测并获取模型</el-button>
        </div>
        <div v-if="communityTestMessage" class="test-result" :class="communityTestOk ? 'ok' : 'fail'">
          <el-icon><CircleCheck v-if="communityTestOk" /><CircleClose v-else /></el-icon>
          <span class="test-result-msg">{{ communityTestMessage }}</span>
        </div>
        <el-form-item label="选择公益模型">
          <el-select v-model="communityModel.model" filterable style="width: 100%" placeholder="先检测可用模型">
            <el-option v-for="model in communityModel.models" :key="model" :label="model" :value="model" />
          </el-select>
        </el-form-item>
        <el-form-item label="本机服务密钥">
          <el-input v-model="communityModel.apiKey" type="password" show-password placeholder="nvapi-..." autocomplete="off" />
          <div class="community-security-tip">
            仅在当前电脑使用 Windows 安全存储加密保存，不会写入源码或公开安装包。
            <el-link type="primary" :underline="false" @click="openExternal('https://build.nvidia.com/explore')">申请或管理密钥</el-link>
          </div>
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

      <div v-if="form.imageGen" class="card section-card">
        <div class="section-title">图片生成（封面）</div>
        <div class="text-faint text-xs" style="margin-bottom: 12px">
          用于在项目设置中 AI 生成小说封面。仅支持 OpenAI（gpt-image-1）与 Google Imagen，需自行配置对应 API Key。
        </div>

        <el-form-item label="使用厂商">
          <el-radio-group v-model="form.imageGen.provider">
            <el-radio-button value="openai">OpenAI (gpt-image-1)</el-radio-button>
            <el-radio-button value="google">Google Imagen</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- OpenAI 配置 -->
        <template v-if="form.imageGen.provider === 'openai'">
          <el-form-item label="BaseURL">
            <el-input v-model="form.imageGen.openaiBaseUrl" placeholder="https://api.openai.com/v1（中转站可改）" />
          </el-form-item>
          <el-form-item label="API Key">
            <el-input v-model="form.imageGen.openaiApiKey" type="password" show-password placeholder="sk-..." />
            <div class="text-faint text-xs" style="margin-top: 4px">
              可填入与上方 OpenAI 相同的 Key，也可用独立中转站 Key
            </div>
          </el-form-item>
          <el-form-item label="模型">
            <el-input v-model="form.imageGen.openaiModel" placeholder="gpt-image-1" />
            <div class="text-faint text-xs" style="margin-top: 4px">
              gpt-image-1 为 OpenAI 最新图片模型；旧 Key 可填 dall-e-3
            </div>
          </el-form-item>
        </template>

        <!-- Google Imagen 配置 -->
        <template v-if="form.imageGen.provider === 'google'">
          <el-form-item label="API Key">
            <el-input v-model="form.imageGen.googleApiKey" type="password" show-password placeholder="AIza..." />
            <div class="text-faint text-xs" style="margin-top: 4px">
              Generative Language API Key，可在 Google AI Studio 获取
            </div>
          </el-form-item>
          <el-form-item label="模型">
            <el-input v-model="form.imageGen.googleModel" placeholder="imagen-4.0-generate-001" />
          </el-form-item>
        </template>
      </div>

      <div class="card section-card">
        <div class="section-title">联网搜索</div>

        <el-form-item label="搜索引擎">
          <el-radio-group v-model="form.searchProvider">
            <el-radio-button value="duckduckgo">DuckDuckGo（免 Key）</el-radio-button>
            <el-radio-button value="tavily">Tavily</el-radio-button>
            <el-radio-button value="serper">Serper</el-radio-button>
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

        <el-form-item label="创作数据备份">
          <div class="backup-actions">
            <el-checkbox v-model="backupIncludesSecrets">备份接口密钥</el-checkbox>
            <el-button :icon="Download" :loading="backingUp" @click="exportBackup">导出完整备份</el-button>
            <el-button :icon="Upload" :loading="restoringBackup" @click="importBackup">从备份恢复</el-button>
            <span class="text-faint text-xs">默认不包含接口密钥；恢复前会自动保存当前数据库副本</span>
          </div>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, ArrowDown, Check, Plus, Sunny, Moon, Refresh, Monitor, Link,
  Connection, Delete, CircleCheck, CircleClose, InfoFilled, Upload, Download, Picture
} from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import type { AppSettings } from '@/types'

const router = useRouter()
const settingsStore = useSettingsStore()

const loading = ref(false)
const saving = ref(false)
const backingUp = ref(false)
const restoringBackup = ref(false)
const backupIncludesSecrets = ref(false)

async function exportBackup() {
  backingUp.value = true
  try {
    if (backupIncludesSecrets.value) {
      await ElMessageBox.confirm('备份将包含接口密钥。请只保存到可信位置，不要上传或分享给他人。', '包含敏感信息', {
        confirmButtonText: '继续导出', cancelButtonText: '取消', type: 'warning'
      })
    }
    const result = await window.api.backup.exportData(backupIncludesSecrets.value)
    if (result?.filePath) ElMessage.success('创作数据备份已导出')
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(`备份失败：${error?.message || error}`)
  } finally {
    backingUp.value = false
  }
}

async function importBackup() {
  try {
    await ElMessageBox.confirm('恢复操作会用备份内容替换当前全部项目、章节、对话、技能和设置。当前数据库会自动保留一份恢复前副本。', '确认恢复备份', {
      confirmButtonText: '选择备份并恢复', cancelButtonText: '取消', type: 'warning'
    })
    restoringBackup.value = true
    const result = await window.api.backup.importData()
    if (!result) return
    await ElMessageBox.alert(`已恢复 ${result.projects} 个项目、${result.chapters} 个章节。软件界面将重新载入。`, '恢复完成', { type: 'success' })
    window.location.reload()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(`恢复失败：${error?.message || error}`)
  } finally {
    restoringBackup.value = false
  }
}

const form = reactive<AppSettings>({
  defaultModel: '',
  defaultBaseUrl: '',
  apiKeys: [],
  communityModel: {
    enabled: false,
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKey: '',
    model: 'mistralai/mistral-nemotron',
    models: ['mistralai/mistral-nemotron']
  },
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
    wallpaperBlur: 20,
    accentColor: '#5b9bd5',
    wallpaperOpacity: 100,
    wallpaperOverlay: 20,
    panelOpacity: 72,
    wallpaperFit: 'cover',
    wallpaperPosition: 'center',
    backgroundType: 'none',
    backgroundVideoPath: '',
    backgroundVideoMuted: true,
    backgroundVideoPlaybackRate: 1,
    imageGen: {
      provider: 'openai',
      openaiApiKey: '',
      openaiBaseUrl: 'https://api.openai.com/v1',
      openaiModel: 'gpt-image-1',
      googleApiKey: '',
      googleModel: 'imagen-4.0-generate-001'
    }
  })

const communityModel = computed(() => form.communityModel!)
const testingCommunity = ref(false)
const communityTestOk = ref(false)
const communityTestMessage = ref('')
const communityReady = computed(() => Boolean(
  communityModel.value.enabled && communityModel.value.apiKey.trim() && communityModel.value.model
))

// 当前版本号 — 从 package.json 注入到 vite define 或回退到 1.0.0
const currentVersion = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_VERSION) || '1.0.0'

const checking = ref(false)
const checkResult = ref('')
const lastCheckTime = ref('')
let lastReleaseUrl = ''

const accentPresets = [
  { label: '雾霾蓝', value: '#5b9bd5' },
  { label: '石墨灰', value: '#70747a' },
  { label: '松石绿', value: '#3d9b8f' },
  { label: '葡萄紫', value: '#8067c5' },
  { label: '玫瑰粉', value: '#c96f91' },
  { label: '暖杏橙', value: '#c9854f' },
  { label: '朱砂红', value: '#bd5b5b' }
]
const wallpaperFitOptions = [
  { label: '铺满', value: 'cover' },
  { label: '完整显示', value: 'contain' }
]
const wallpaperPositionOptions = [
  { label: '顶部', value: 'top' },
  { label: '居中', value: 'center' },
  { label: '底部', value: 'bottom' }
]
const backgroundTypeOptions = [
  { label: '纯色', value: 'none' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' }
]
const videoRateOptions = [
  { label: '慢速', value: .5 },
  { label: '正常', value: 1 },
  { label: '轻快', value: 1.25 }
]

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

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
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
  ElMessage.success(`已添加 ${preset.label} 预设，请填写 API Key 后点击“测试连通性”自动获取模型`)
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

async function refreshCommunityModels() {
  if (!communityModel.value.apiKey.trim()) {
    ElMessage.warning('请先填写 NVIDIA 服务密钥')
    return
  }
  testingCommunity.value = true
  communityTestMessage.value = ''
  const started = performance.now()
  try {
    const data = await window.api.ai.listModels({
      baseUrl: communityModel.value.baseUrl,
      apiKey: communityModel.value.apiKey
    })
    const models: string[] = Array.isArray(data?.models) ? data.models : []
    if (!models.length) throw new Error('接口可连接，但没有返回可用模型')
    communityModel.value.models = [...new Set(models)].sort()
    if (!communityModel.value.models.includes(communityModel.value.model)) {
      const nemotron = communityModel.value.models.find(id => /nemotron/i.test(id))
      communityModel.value.model = nemotron || communityModel.value.models[0]
    }
    communityModel.value.enabled = true
    const latency = Math.round(performance.now() - started)
    communityTestOk.value = true
    communityTestMessage.value = `连接成功 · 已获取 ${models.length} 个可用模型 · ${latency} ms`
    await settingsStore.update({ communityModel: JSON.parse(JSON.stringify(communityModel.value)) })
    ElMessage.success('公益模型已启用，现在可以在各个模型选择器中直接使用')
  } catch (e: any) {
    communityTestOk.value = false
    communityTestMessage.value = '连接失败：' + (e?.message || '请检查密钥和网络')
  } finally {
    testingCommunity.value = false
  }
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
    const data = await window.api.ai.listModels({ baseUrl: p.baseUrl, apiKey: p.apiKey })
    const latency = Math.round(performance.now() - t0)
    const models: string[] = data?.models || []
    if (models.length > 0) {
      // 自动填充模型列表
      const ids = models
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
  if (!form.communityModel) {
    form.communityModel = {
      enabled: false,
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      apiKey: '',
      model: 'mistralai/mistral-nemotron',
      models: ['mistralai/mistral-nemotron']
    }
  }
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
  if (!form.accentColor) form.accentColor = '#5b9bd5'
  if (form.wallpaperOpacity === undefined) form.wallpaperOpacity = 100
  if (form.wallpaperOverlay === undefined) form.wallpaperOverlay = 20
  if (form.panelOpacity === undefined) form.panelOpacity = 72
  if (!form.wallpaperFit) form.wallpaperFit = 'cover'
  if (!form.wallpaperPosition) form.wallpaperPosition = 'center'
  if (!form.backgroundType) form.backgroundType = form.wallpaper ? 'image' : 'none'
  if (!form.backgroundVideoPath) form.backgroundVideoPath = ''
  form.backgroundVideoMuted = true
  if (!form.backgroundVideoPlaybackRate) form.backgroundVideoPlaybackRate = 1
  // imageGen 兼容：老数据没有此字段
  if (!form.imageGen || typeof form.imageGen !== 'object') {
    form.imageGen = {
      provider: 'openai',
      openaiApiKey: '',
      openaiBaseUrl: 'https://api.openai.com/v1',
      openaiModel: 'gpt-image-1',
      googleApiKey: '',
      googleModel: 'imagen-4.0-generate-001'
    }
  } else {
    if (!form.imageGen.provider) form.imageGen.provider = 'openai'
    if (!form.imageGen.openaiBaseUrl) form.imageGen.openaiBaseUrl = 'https://api.openai.com/v1'
    if (!form.imageGen.openaiModel) form.imageGen.openaiModel = 'gpt-image-1'
    if (!form.imageGen.googleModel) form.imageGen.googleModel = 'imagen-4.0-generate-001'
  }
  // 表单填充完成后再开启自动保存，避免初始化赋值触发回写
  nextTick(() => { autoSaveReady.value = true })
}

function onThemeChange() {
  // 立即生效，无需点"保存设置"
  settingsStore.update({ themeMode: form.themeMode })
}

function previewAppearance(patch: Partial<AppSettings>) {
  if (!settingsStore.settings) return
  Object.assign(settingsStore.settings, patch)
  settingsStore.applyTheme()
}

let appearanceSaveTimer: ReturnType<typeof setTimeout> | null = null
function persistAppearance(patch: Partial<AppSettings>, immediate = false) {
  previewAppearance(patch)
  if (appearanceSaveTimer) clearTimeout(appearanceSaveTimer)
  const commit = () => settingsStore.update(patch).catch((error: any) => {
    ElMessage.error('外观保存失败：' + (error?.message || '未知错误'))
  })

  if (immediate) commit()
  else appearanceSaveTimer = setTimeout(commit, 180)
}

function setAccentColor(color: string) {
  form.accentColor = color
  persistAppearance({ accentColor: color }, true)
}

function onAccentPreview(color: string | null) {
  if (!color) return
  form.accentColor = color
  previewAppearance({ accentColor: color })
}

function onAccentCommit(color: string | null) {
  if (!color) return
  form.accentColor = color
  persistAppearance({ accentColor: color }, true)
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

const appearancePreviewStyle = computed(() => ({
  '--preview-accent': form.accentColor || '#5b9bd5',
  '--preview-image': form.wallpaper ? `url("${form.wallpaper}")` : 'none',
  '--preview-position': form.wallpaperPosition || 'center',
  '--preview-size': form.wallpaperFit || 'cover',
  '--preview-image-opacity': String((form.wallpaperOpacity ?? 100) / 100),
  '--preview-panel-opacity': String((form.panelOpacity ?? 72) / 100)
}))

const hasBackgroundMedia = computed(() => (
  (form.backgroundType === 'image' && !!form.wallpaper) ||
  (form.backgroundType === 'video' && !!form.backgroundVideoPath)
))
const backgroundVideoName = computed(() => {
  const value = form.backgroundVideoPath || ''
  return value.split(/[\\/]/).pop() || ''
})
const backgroundVideoPreviewUrl = computed(() => form.backgroundVideoPath
  ? `trm-media://background/current?preview=${encodeURIComponent(form.backgroundVideoPath)}`
  : '')

function onBackgroundTypeChange() {
  persistAppearance({
    backgroundType: form.backgroundType,
    backgroundVideoPath: form.backgroundVideoPath,
    wallpaper: form.wallpaper
  }, true)
}

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
    form.backgroundType = 'image'
    await settingsStore.update({
      wallpaper: dataUrl,
      backgroundType: 'image',
      wallpaperBlur: form.wallpaperBlur,
      wallpaperOpacity: form.wallpaperOpacity,
      wallpaperOverlay: form.wallpaperOverlay,
      panelOpacity: form.panelOpacity,
      wallpaperFit: form.wallpaperFit,
      wallpaperPosition: form.wallpaperPosition
    })
    ElMessage.success('背景图已设置')
  } catch (e: any) {
    ElMessage.error('上传失败：' + (e?.message || '未知错误'))
  }
}

function removeWallpaper() {
  form.wallpaper = ''
  form.backgroundType = 'none'
  settingsStore.update({ wallpaper: '', backgroundType: 'none' })
  ElMessage.success('已移除背景图')
}

async function pickBackgroundVideo() {
  try {
    const filePath = await window.api.file.selectVideo()
    if (!filePath) return
    await settingsStore.update({
      backgroundType: 'video',
      backgroundVideoPath: filePath,
      backgroundVideoMuted: true,
      backgroundVideoPlaybackRate: form.backgroundVideoPlaybackRate,
      wallpaperBlur: form.wallpaperBlur,
      wallpaperOpacity: form.wallpaperOpacity,
      wallpaperOverlay: form.wallpaperOverlay,
      panelOpacity: form.panelOpacity,
      wallpaperFit: form.wallpaperFit,
      wallpaperPosition: form.wallpaperPosition
    })
    form.backgroundVideoPath = filePath
    form.backgroundType = 'video'
    ElMessage.success('背景视频已设置')
  } catch (e: any) {
    ElMessage.error('视频设置失败：' + (e?.message || '未知错误'))
  }
}

async function removeBackgroundVideo() {
  form.backgroundVideoPath = ''
  form.backgroundType = 'none'
  await settingsStore.update({ backgroundVideoPath: '', backgroundType: 'none' })
  ElMessage.success('已移除背景视频')
}

function onWallpaperBlurChange() {
  onAppearanceSliderChange()
}

function onAppearanceSliderChange() {
  persistAppearance({
    wallpaperBlur: form.wallpaperBlur,
    wallpaperOpacity: form.wallpaperOpacity,
    wallpaperOverlay: form.wallpaperOverlay,
    panelOpacity: form.panelOpacity,
    wallpaperFit: form.wallpaperFit,
    wallpaperPosition: form.wallpaperPosition,
    backgroundVideoPlaybackRate: form.backgroundVideoPlaybackRate
  })
}

async function resetAppearance() {
  Object.assign(form, {
    themeMode: 'light',
    accentColor: '#5b9bd5',
    wallpaper: '',
    wallpaperBlur: 20,
    wallpaperOpacity: 100,
    wallpaperOverlay: 20,
    panelOpacity: 72,
    wallpaperFit: 'cover',
    wallpaperPosition: 'center',
    backgroundType: 'none',
    backgroundVideoPath: '',
    backgroundVideoMuted: true,
    backgroundVideoPlaybackRate: 1
  })
  await settingsStore.update({
    themeMode: 'light',
    accentColor: '#5b9bd5',
    wallpaper: '',
    wallpaperBlur: 20,
    wallpaperOpacity: 100,
    wallpaperOverlay: 20,
    panelOpacity: 72,
    wallpaperFit: 'cover',
    wallpaperPosition: 'center',
    backgroundType: 'none',
    backgroundVideoPath: '',
    backgroundVideoMuted: true,
    backgroundVideoPlaybackRate: 1
  })
  ElMessage.success('已恢复默认外观')
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
  saving.value = true
  try {
    await settingsStore.update({
      apiKeys: JSON.parse(JSON.stringify(form.apiKeys)),
      communityModel: JSON.parse(JSON.stringify(communityModel.value)),
      theme: form.theme,
      themeMode: form.themeMode,
      fontSize: form.fontSize,
      editorFont: form.editorFont,
      autoSaveInterval: form.autoSaveInterval,
      dataDir: form.dataDir,
      searchProvider: form.searchProvider,
      searchApiKey: form.searchApiKey,
      autoUpdateCheck: form.autoUpdateCheck,
      zoomLevel: form.zoomLevel,
      wallpaper: form.wallpaper,
      wallpaperBlur: form.wallpaperBlur,
      accentColor: form.accentColor,
      wallpaperOpacity: form.wallpaperOpacity,
      wallpaperOverlay: form.wallpaperOverlay,
      panelOpacity: form.panelOpacity,
      wallpaperFit: form.wallpaperFit,
      wallpaperPosition: form.wallpaperPosition,
      backgroundType: form.backgroundType,
      backgroundVideoPath: form.backgroundVideoPath,
      backgroundVideoMuted: true,
      backgroundVideoPlaybackRate: form.backgroundVideoPlaybackRate,
      imageGen: JSON.parse(JSON.stringify(form.imageGen))
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
  try {
    pendingAutoSave = settingsStore.update({
      apiKeys: JSON.parse(JSON.stringify(form.apiKeys)),
      communityModel: JSON.parse(JSON.stringify(form.communityModel))
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

watch(
  () => form.communityModel,
  () => {
    if (!autoSaveReady.value || !form.communityModel) return
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
.backup-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%}
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
.color-settings {
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: 100%;
}
.color-presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
}
.color-swatch {
  width: 31px;
  height: 31px;
  padding: 3px;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.color-swatch span {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--swatch-color);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.32);
}
.color-swatch:hover { transform: translateY(-1px) scale(1.05); }
.color-swatch.active {
  border-color: var(--swatch-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--swatch-color) 16%, transparent);
}
.appearance-preview {
  position: relative;
  display: flex;
  width: 100%;
  height: 126px;
  margin: 2px 0 20px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 18px;
  background-color: var(--panel-2);
  background-image: var(--preview-image);
  background-size: var(--preview-size, cover);
  background-position: var(--preview-position, center);
  box-shadow: var(--shadow);
}
.appearance-preview::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--bg);
  opacity: .18;
}
.preview-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: var(--preview-size, cover);
  object-position: var(--preview-position, center);
  opacity: var(--preview-image-opacity, 1);
}
.preview-sidebar {
  position: relative;
  z-index: 1;
  width: 28%;
  margin: 9px;
  border-radius: 13px;
  background: rgba(255,255,255,var(--preview-panel-opacity));
  box-shadow: 0 5px 20px rgba(15,23,42,.08);
}
html.dark .preview-sidebar { background: rgba(30,41,59,var(--preview-panel-opacity)); }
.preview-body {
  position: relative;
  z-index: 1;
  flex: 1;
  margin: 9px 9px 9px 0;
  padding: 18px;
  border-radius: 13px;
  background: rgba(255,255,255,var(--preview-panel-opacity));
  box-shadow: 0 5px 20px rgba(15,23,42,.08);
}
html.dark .preview-body { background: rgba(30,41,59,var(--preview-panel-opacity)); }
.preview-pill { display: block; width: 50px; height: 9px; margin-bottom: 17px; border-radius: 999px; background: var(--preview-accent); }
.preview-line { display: block; width: 52%; height: 6px; margin-top: 8px; border-radius: 999px; background: rgba(100,116,139,.18); }
.preview-line.long { width: 82%; }
.preview-button { position: absolute; right: 15px; bottom: 13px; padding: 4px 13px; border-radius: 999px; color: white; background: var(--preview-accent); font-size: 10px; }
.preview-label { position: absolute; z-index: 2; right: 12px; top: 10px; padding: 3px 8px; border-radius: 999px; color: var(--text-2); background: rgba(255,255,255,.72); font-size: 9px; backdrop-filter: blur(8px); }
.wallpaper-layout-options { display: flex; flex-wrap: wrap; gap: 10px; width: 100%; }
.appearance-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 8px; }
.wallpaper-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}
.wallpaper-preview {
  width: 118px;
  height: 74px;
  border-radius: 14px;
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
.video-background-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
  width: 100%;
}
.video-file-info {
  display: flex;
  flex: 1;
  min-width: 260px;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}
.video-file-info strong {
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.provider-card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 14px;
  background: var(--panel-2);
}
.public-model-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 14px;
  border: 1px solid color-mix(in srgb, var(--primary) 30%, var(--border));
  border-radius: 18px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 9%, var(--panel)), var(--panel));
}
.community-section {
  overflow: hidden;
  border-color: color-mix(in srgb, #76b900 30%, var(--border));
}
.community-section .section-title-row { align-items: center; }
.community-section .section-title { padding: 0; margin-bottom: 4px; border: 0; }
.community-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--panel-2);
  transition: border-color .2s ease, box-shadow .2s ease;
}
.community-hero.active {
  border-color: rgba(118, 185, 0, .48);
  box-shadow: 0 8px 28px rgba(118, 185, 0, .08);
}
.community-logo {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  place-items: center;
  color: #fff;
  font-size: 21px;
  font-weight: 800;
  border-radius: 14px;
  background: #76b900;
}
.community-main { flex: 1; min-width: 0; }
.community-name { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; color: var(--text); font-size: 15px; font-weight: 700; }
.community-security-tip { margin-top: 6px; color: var(--text-3); font-size: 12px; line-height: 1.55; }
@media (max-width: 760px) {
  .community-hero { align-items: stretch; flex-direction: column; }
  .community-logo { display: none; }
}
.public-model-copy {
  display: flex;
  flex: 1;
  min-width: 240px;
  flex-direction: column;
  gap: 4px;
}
.public-model-copy strong { color: var(--text); font-size: 14px; }
.public-model-copy span { color: var(--text-3); font-size: 12px; line-height: 1.55; }
@media (max-width: 760px) {
  .public-model-notice { align-items: stretch; flex-direction: column; }
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
