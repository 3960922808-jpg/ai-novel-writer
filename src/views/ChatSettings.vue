<template>
  <div class="chat-settings-root">
    <!-- 顶部栏 -->
    <header class="chat-header">
      <div class="chat-header-left">
        <el-icon :size="18"><ChatDotRound /></el-icon>
        <span class="chat-header-title">设定对话</span>
        <el-tag size="small" effect="plain">{{ project?.title || '未命名' }}</el-tag>
      </div>
      <div class="chat-header-right">
        <el-select
          v-model="aiModel"
          placeholder="选择模型"
          size="small"
          style="width: 200px"
        >
          <el-option v-for="m in models" :key="m.model" :label="m.model" :value="m.model" />
        </el-select>
        <el-button size="small" :icon="Delete" @click="clearChat" :disabled="generating">清空对话</el-button>
      </div>
    </header>

    <!-- 对话区域 -->
    <div class="chat-body" ref="chatBodyRef">
      <div v-if="messages.length === 0" class="chat-empty">
        <div class="chat-bubble-icon">
          <el-icon :size="36"><ChatDotRound /></el-icon>
        </div>
        <p class="chat-empty-title">设定对话</p>
        <p class="chat-empty-tip">在这里与 AI 自由讨论小说设定 —— 世界观、角色、势力、剧情走向、伏笔等。</p>
        <p class="chat-empty-tip">不绑定具体章节，纯粹对话。例如：「帮我设计一个反派组织」「梳理主角的成长弧线」。</p>
      </div>
      <div v-else class="chat-list">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="chat-msg"
          :class="msg.role"
        >
          <div class="chat-msg-role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
          <div v-if="msg.role === 'assistant'" class="ai-output-card">
            <div class="ai-output-content" v-html="renderMarkdown(msg.content)"></div>
            <div class="ai-output-actions">
              <button class="ai-act-btn" title="复制" @click="copyText(msg.content)">
                <el-icon><DocumentCopy /></el-icon>
              </button>
              <button class="ai-act-btn" title="删除" @click="deleteMsg(msg.id)">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>
          <div v-else class="chat-msg-content" v-html="renderMarkdown(msg.content)"></div>
        </div>
        <!-- 流式输出占位 -->
        <div v-if="generating" class="chat-msg assistant">
          <div class="chat-msg-role">AI</div>
          <div class="ai-output-card streaming-card">
            <div class="ai-output-content streaming">
              {{ aiStreamingText }}<span class="cursor">▌</span>
            </div>
            <div class="ai-output-actions">
              <button class="ai-act-btn danger" title="停止生成" @click="stopGenerate">
                <el-icon><VideoPause /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="chat-input-area">
      <div class="chat-input-wrap">
        <textarea
          ref="inputRef"
          v-model="userInput"
          class="chat-input"
          placeholder="输入消息，与 AI 讨论设定…（Enter 发送，Shift+Enter 换行）"
          rows="3"
          @keydown="onKeydown"
        ></textarea>
        <button
          class="send-btn"
          :class="{ disabled: !canSend || generating }"
          :disabled="!canSend || generating"
          @click="sendChat"
          :title="generating ? 'AI 正在生成…' : '发送（Enter）'"
        >
          <el-icon v-if="generating" class="loading-icon"><Loading /></el-icon>
          <el-icon v-else><Promotion /></el-icon>
          <span>{{ generating ? '生成中' : '发送' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound, Delete, DocumentCopy, Promotion, VideoPause, Loading
} from '@element-plus/icons-vue'
import { marked } from 'marked'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as aiSvc from '@/services/ai'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)
const models = computed(() => settings.availableModels())

const messages = ref<ChatMsg[]>([])
const userInput = ref('')
const aiStreamingText = ref('')
const generating = ref(false)
const stopFlag = ref(false)
let currentStreamCancel: (() => void) | null = null
const aiModel = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const chatBodyRef = ref<HTMLDivElement | null>(null)

// 唯一消息 id：避免用索引作 v-for key 导致 DOM 复用错乱
let _msgIdSeq = 0
function genMsgId(): string {
  _msgIdSeq += 1
  return `c${Date.now().toString(36)}_${_msgIdSeq}`
}
function pushMsg(msg: Omit<ChatMsg, 'id'>) {
  messages.value.push({ ...msg, id: genMsgId() })
}

const canSend = computed(() => userInput.value.trim().length > 0 && !generating.value)

function getProvider() {
  const m = aiModel.value || project.value?.settings.model || ''
  return settings.findProviderForModel(m)
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  try {
    return marked.parse(text, { breaks: true, async: false }) as string
  } catch {
    return escapeHtml(text).replace(/\n/g, '<br>')
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function copyText(text: string) {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}

function deleteMsg(id: string) {
  const idx = messages.value.findIndex(m => m.id === id)
  if (idx >= 0) messages.value.splice(idx, 1)
}

function clearChat() {
  if (generating.value) return
  messages.value = []
  aiStreamingText.value = ''
  ElMessage.success('已清空对话')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendChat()
  }
}

async function scrollToBottom() {
  await nextTick()
  const el = chatBodyRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function sendChat() {
  if (!canSend.value || !project.value) return
  const provider = getProvider()
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置 API Key')
    return
  }
  const content = userInput.value.trim()
  pushMsg({ role: 'user', content })
  userInput.value = ''
  await scrollToBottom()

  const sysContent = `你是一位资深小说设定顾问，协助用户讨论与梳理小说设定。可涵盖：世界观、力量体系、角色设计与动机、势力关系、剧情走向、伏笔与时间线等。回答用中文，条理清晰，可用 markdown 列表/标题组织。

【作品背景】
标题：${project.value.title || '未命名'}
类型：${project.value.genre || '未指定'}
简介：${project.value.description || '（无）'}`

  generating.value = true
  aiStreamingText.value = ''
  stopFlag.value = false
  currentStreamCancel = null
  try {
    const ret = window.api.ai.stream(
      aiSvc.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: aiModel.value || project.value.settings.model,
        messages: [
          { role: 'system', content: sysContent },
          ...messages.value.slice(-8).map(m => ({ role: m.role as any, content: m.content })),
          { role: 'user', content }
        ],
        temperature: 0.8,
        maxTokens: 4096
      }),
      (chunk: string) => {
        if (stopFlag.value) return
        aiStreamingText.value += chunk
        scrollToBottom()
      }
    )
    if (ret && typeof (ret as any).cancel === 'function') {
      currentStreamCancel = (ret as any).cancel
    }
    const retObj = ret as { promise?: Promise<string>; cancel?: () => void } | Promise<string>
    const isWrapper = retObj && typeof (retObj as any).promise === 'object' && typeof (retObj as any).cancel === 'function'
    const full: string = isWrapper
      ? await (retObj as { promise: Promise<string> }).promise
      : await (retObj as Promise<string>)
    if (full) {
      pushMsg({ role: 'assistant', content: full })
    }
  } catch (e: any) {
    ElMessage.error('AI 调用失败：' + (e?.message || '未知错误'))
  } finally {
    generating.value = false
    aiStreamingText.value = ''
    currentStreamCancel = null
    await scrollToBottom()
  }
}

function stopGenerate() {
  stopFlag.value = true
  if (currentStreamCancel) {
    try { currentStreamCancel() } catch {}
    currentStreamCancel = null
  }
  generating.value = false
  // 保留已生成的片段作为一条 AI 消息
  if (aiStreamingText.value.trim()) {
    pushMsg({ role: 'assistant', content: aiStreamingText.value.trim() })
  }
  aiStreamingText.value = ''
}

onMounted(async () => {
  if (!settings.settings) {
    try { await settings.load() } catch {}
  }
  if (!aiModel.value && models.value.length > 0) {
    aiModel.value = project.value?.settings.model || settings.defaultModel() || models.value[0].model
  }
})
</script>

<style scoped>
.chat-settings-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
}
.chat-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
}
.chat-header-title {
  font-size: 15px;
  font-weight: 600;
}
.chat-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}
.chat-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  text-align: center;
  gap: 8px;
}
.chat-bubble-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.chat-empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}
.chat-empty-tip {
  font-size: 13px;
  color: var(--text-3);
  max-width: 480px;
  line-height: 1.6;
  margin: 0;
}
.chat-list {
  max-width: 880px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.chat-msg {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.chat-msg.user {
  align-items: flex-end;
}
.chat-msg.assistant {
  align-items: flex-start;
}
.chat-msg-role {
  font-size: 12px;
  color: var(--text-3);
  padding: 0 4px;
}
.chat-msg-content {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--primary-light);
  color: var(--text);
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}
.chat-msg.user .chat-msg-content {
  background: var(--primary);
  color: #fff;
}
.ai-output-card {
  max-width: 88%;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}
.ai-output-content :deep(h1),
.ai-output-content :deep(h2),
.ai-output-content :deep(h3) {
  margin: 10px 0 6px;
  font-weight: 600;
}
.ai-output-content :deep(p) {
  margin: 6px 0;
}
.ai-output-content :deep(ul),
.ai-output-content :deep(ol) {
  margin: 6px 0;
  padding-left: 22px;
}
.ai-output-content :deep(code) {
  background: var(--panel-2);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 13px;
}
.ai-output-content :deep(pre) {
  background: var(--panel-2);
  padding: 10px 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}
.ai-output-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  opacity: 0.7;
}
.ai-act-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 7px;
  cursor: pointer;
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  font-size: 13px;
}
.ai-act-btn:hover {
  background: var(--panel-2);
  color: var(--text);
}
.ai-act-btn.danger:hover {
  color: #ef4444;
  border-color: #ef4444;
}
.streaming-card {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-light);
}
.streaming {
  min-height: 1.2em;
}
.cursor {
  display: inline-block;
  animation: blink 1s steps(2, start) infinite;
  color: var(--primary);
  margin-left: 2px;
}
@keyframes blink {
  to { visibility: hidden; }
}
.loading-icon {
  animation: rotate 1s linear infinite;
}
@keyframes rotate {
  to { transform: rotate(360deg); }
}
.chat-input-area {
  flex-shrink: 0;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--border);
  background: var(--panel);
}
.chat-input-wrap {
  max-width: 880px;
  margin: 0 auto;
  position: relative;
  display: flex;
  gap: 10px;
  align-items: flex-end;
}
.chat-input {
  flex: 1;
  resize: none;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.6;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease;
}
.chat-input:focus {
  border-color: var(--primary);
}
.send-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.send-btn:hover {
  opacity: 0.9;
}
.send-btn.disabled {
  background: var(--text-3);
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
