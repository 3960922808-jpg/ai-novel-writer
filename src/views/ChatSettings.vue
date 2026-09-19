<template>
  <div class="chat-settings-root">
    <header class="chat-header">
      <div class="chat-header-left">
        <el-icon :size="18"><ChatDotRound /></el-icon>
        <span class="chat-header-title">设定对话</span>
        <el-tag size="small" effect="plain">{{ project?.title || '未命名' }}</el-tag>
        <span class="save-state" :class="saveState">{{ saveStateText }}</span>
      </div>
      <div class="chat-header-right">
        <el-select v-model="aiModel" placeholder="选择模型" size="small" style="width: 200px">
          <el-option v-for="m in models" :key="m.model" :label="m.model" :value="m.model" />
        </el-select>
        <el-button size="small" :icon="Plus" @click="newConversation" :disabled="generating">新对话</el-button>
        <el-button size="small" :icon="Clock" @click="historyVisible = true">历史记录</el-button>
        <el-button size="small" :icon="Delete" @click="clearChat" :disabled="generating || messages.length === 0">清空当前</el-button>
      </div>
    </header>

    <div class="chat-body" ref="chatBodyRef">
      <div v-if="messages.length === 0" class="chat-empty">
        <div class="chat-bubble-icon"><el-icon :size="36"><ChatDotRound /></el-icon></div>
        <p class="chat-empty-title">设定对话</p>
        <p class="chat-empty-tip">在这里与 AI 自由讨论小说设定 —— 世界观、角色、势力、剧情走向、伏笔等。</p>
        <p class="chat-empty-tip">每次对话都会自动保存，可从右上角“历史记录”恢复。</p>
      </div>
      <div v-else class="chat-list">
        <div v-for="msg in messages" :key="msg.id" class="chat-msg" :class="msg.role">
          <div class="chat-msg-role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
          <div v-if="msg.role === 'assistant'" class="ai-output-card">
            <div class="ai-output-content" v-html="renderMarkdown(msg.content)"></div>
            <div class="ai-output-actions">
              <button class="ai-act-btn" title="复制" @click="copyText(msg.content)"><el-icon><DocumentCopy /></el-icon></button>
              <button class="ai-act-btn" title="删除" @click="deleteMsg(msg.id)"><el-icon><Delete /></el-icon></button>
            </div>
          </div>
          <div v-else class="chat-msg-content" v-html="renderMarkdown(msg.content)"></div>
        </div>
        <div v-if="webSearching" class="chat-msg assistant">
          <div class="chat-msg-role">AI</div>
          <div class="ai-output-card searching-card"><el-icon class="rotating"><Loading /></el-icon><span>正在搜索互联网...</span></div>
        </div>
        <div v-if="generating && !webSearching" class="chat-msg assistant">
          <div class="chat-msg-role">AI</div>
          <div class="ai-output-card streaming-card">
            <div class="ai-output-content streaming">{{ aiStreamingText }}<span class="cursor">▌</span></div>
            <div class="ai-output-actions">
              <button class="ai-act-btn danger" title="停止生成" @click="stopGenerate"><el-icon><VideoPause /></el-icon></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <div class="chat-input-toolbar">
        <button class="context-btn" :class="{ active: canvasLinked }" :title="canvasLinked ? '发送时自动读取最新画布内容' : '让设定对话参考故事画布'" @click="toggleCanvasLink">
          <el-icon><Link /></el-icon><span>{{ canvasLinked ? `已链接画布（${canvasNodes.length}）` : '链接故事画布' }}</span>
        </button>
        <button v-if="canvasLinked" class="context-btn icon-only" title="刷新画布内容" @click="loadCanvasContext(true)"><el-icon><RefreshRight /></el-icon></button>
        <button class="context-btn" :class="{ active: webSearchEnabled }" :title="webSearchEnabled ? '联网搜索已开启（点击关闭）' : '开启联网搜索，AI 回答前先上网搜索'" @click="toggleWebSearch">
          <el-icon><Cloudy /></el-icon><span>{{ webSearchEnabled ? '联网搜索已开启' : '联网搜索' }}</span>
        </button>
      </div>
      <div class="chat-input-wrap">
        <textarea ref="inputRef" v-model="userInput" class="chat-input" placeholder="输入消息，与 AI 讨论设定…（Enter 发送，Shift+Enter 换行）" rows="3" @keydown="onKeydown"></textarea>
        <button class="send-btn" :class="{ disabled: !canSend || generating }" :disabled="!canSend || generating" @click="sendChat" :title="generating ? 'AI 正在生成…' : '发送（Enter）'">
          <el-icon v-if="generating" class="loading-icon"><Loading /></el-icon><el-icon v-else><Promotion /></el-icon><span>{{ generating ? '生成中' : '发送' }}</span>
        </button>
      </div>
    </div>

    <el-drawer v-model="historyVisible" title="设定对话历史" size="360px">
      <div class="history-actions"><el-button type="primary" :icon="Plus" @click="newConversation">开始新对话</el-button></div>
      <div v-if="historySessions.length === 0" class="history-empty">还没有已保存的对话</div>
      <div v-else class="history-list">
        <button v-for="item in historySessions" :key="item.id" class="history-item" :class="{ active: item.id === activeSessionId }" @click="openSession(item.id)">
          <span class="history-main"><strong>{{ item.title }}</strong><small>{{ formatTime(item.lastTime) }} · {{ item.count }} 条消息</small></span>
          <span class="history-delete" title="删除这段对话" @click.stop="deleteSession(item.id)"><el-icon><Delete /></el-icon></span>
        </button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatDotRound, Delete, DocumentCopy, Promotion, VideoPause, Loading, Cloudy, Clock, Plus, Link, RefreshRight } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { useWebSearch } from '@/composables/useWebSearch'
import * as aiSvc from '@/services/ai'
import * as db from '@/services/db'
import { renderSafeMarkdown } from '@/services/markdown'
import type { CanvasNode } from '@/types'

const LEGACY_SETTINGS_SESSION = 'settings'
const SETTINGS_SESSION_PREFIX = 'settings:'
interface ChatMsg { id: string; role: 'user' | 'assistant'; content: string }
interface ChatSessionSummary { id: string; title: string; count: number; lastTime: number }

const projectStore = useProjectStore()
const settings = useSettingsStore()
const route = useRoute()
const project = computed(() => projectStore.current)
const models = computed(() => settings.availableModels())
const { webSearchEnabled, searching: webSearching, toggleWebSearch, searchAndBuildContext } = useWebSearch(`settings:${project.value?.id || route.params.id || ''}`)
const messages = ref<ChatMsg[]>([])
const historySessions = ref<ChatSessionSummary[]>([])
const activeSessionId = ref('')
const historyVisible = ref(false)
const userInput = ref('')
const aiStreamingText = ref('')
const generating = ref(false)
const stopFlag = ref(false)
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const canvasLinked = ref(false)
const canvasNodes = ref<CanvasNode[]>([])
let currentStreamCancel: (() => void) | null = null
const aiModel = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const chatBodyRef = ref<HTMLDivElement | null>(null)
const saveStateText = computed(() => ({ idle: '', saving: '正在保存…', saved: '已自动保存', error: '保存失败' }[saveState.value]))
const canSend = computed(() => userInput.value.trim().length > 0 && !generating.value)

let _msgIdSeq = 0
function genMsgId() { _msgIdSeq += 1; return `c${Date.now().toString(36)}_${_msgIdSeq}` }
function createSessionId() { return `${SETTINGS_SESSION_PREFIX}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }
function activeSessionKey(pid: string) { return `trmwrite:settings-session:${pid}` }
function canvasLinkKey(pid: string) { return `trmwrite:settings-canvas-linked:${pid}` }
function rememberActiveSession() {
  const pid = project.value?.id
  if (pid && activeSessionId.value) localStorage.setItem(activeSessionKey(pid), activeSessionId.value)
}

async function pushMsg(msg: Omit<ChatMsg, 'id'>) {
  const pid = project.value?.id
  if (!pid) return
  if (!activeSessionId.value) activeSessionId.value = createSessionId()
  rememberActiveSession()
  const record = { ...msg, id: genMsgId() }
  messages.value.push(record)
  saveState.value = 'saving'
  try {
    await db.Messages.save({ ...record, projectId: pid, sessionId: activeSessionId.value, createdAt: Date.now() })
    saveState.value = 'saved'
    await refreshHistorySessions()
  } catch (e: any) {
    saveState.value = 'error'
    console.error('[chat-settings] 保存消息失败:', e?.message || e)
    ElMessage.error('消息保存失败，请检查本地存储')
  }
}

async function refreshHistorySessions() {
  const pid = project.value?.id
  if (!pid) return
  const all = await db.Messages.list(pid)
  const grouped = new Map<string, typeof all>()
  for (const item of all) {
    if (item.sessionId !== LEGACY_SETTINGS_SESSION && !item.sessionId.startsWith(SETTINGS_SESSION_PREFIX)) continue
    const list = grouped.get(item.sessionId) || []
    list.push(item)
    grouped.set(item.sessionId, list)
  }
  historySessions.value = Array.from(grouped.entries()).map(([id, records]) => {
    records.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    const first = records.find(r => r.role === 'user') || records[0]
    const title = (first?.content || '设定对话').replace(/\s+/g, ' ').trim().slice(0, 28)
    return { id, title: title || '设定对话', count: records.length, lastTime: Math.max(...records.map(r => r.createdAt || 0)) }
  }).sort((a, b) => b.lastTime - a.lastTime)
}

async function loadHistory(sessionId?: string) {
  const pid = project.value?.id
  if (!pid) return
  const target = sessionId || activeSessionId.value
  if (!target) return
  try {
    const records = await db.Messages.listBySession(pid, target)
    messages.value = records.map(r => ({ id: r.id, role: r.role, content: r.content }))
    saveState.value = records.length > 0 ? 'saved' : 'idle'
  } catch (e: any) {
    console.error('[chat-settings] 加载历史失败:', e?.message || e)
    messages.value = []
    saveState.value = 'error'
  }
}

async function initialiseHistory() {
  const pid = project.value?.id
  if (!pid) return
  await refreshHistorySessions()
  const remembered = localStorage.getItem(activeSessionKey(pid)) || ''
  activeSessionId.value = historySessions.value.some(item => item.id === remembered) ? remembered : (historySessions.value[0]?.id || createSessionId())
  rememberActiveSession()
  await loadHistory(activeSessionId.value)
}

async function newConversation() {
  if (generating.value) return
  activeSessionId.value = createSessionId()
  rememberActiveSession()
  messages.value = []
  userInput.value = ''
  aiStreamingText.value = ''
  saveState.value = 'idle'
  historyVisible.value = false
  await nextTick(() => inputRef.value?.focus())
}

async function openSession(id: string) {
  if (generating.value || id === activeSessionId.value) { historyVisible.value = false; return }
  activeSessionId.value = id
  rememberActiveSession()
  await loadHistory(id)
  historyVisible.value = false
  await scrollToBottom()
}

async function deleteSession(id: string) {
  const pid = project.value?.id
  if (!pid || generating.value) return
  try { await ElMessageBox.confirm('确定删除这段设定对话历史吗？', '删除历史', { type: 'warning' }) } catch { return }
  await db.Messages.clearSession(pid, id)
  await refreshHistorySessions()
  if (id === activeSessionId.value) {
    activeSessionId.value = historySessions.value[0]?.id || createSessionId()
    rememberActiveSession()
    await loadHistory(activeSessionId.value)
  }
  ElMessage.success('对话历史已删除')
}

function formatTime(time: number) {
  if (!time) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(time))
}
function getProvider() { return settings.findProviderForModel(aiModel.value || project.value?.settings.model || '') }
function renderMarkdown(text: string) {
  return renderSafeMarkdown(text)
}
function copyText(text: string) { navigator.clipboard.writeText(text); ElMessage.success('已复制') }
async function deleteMsg(id: string) {
  const idx = messages.value.findIndex(m => m.id === id)
  if (idx < 0) return
  try { await db.Messages.remove(id); messages.value.splice(idx, 1); saveState.value = 'saved'; await refreshHistorySessions() }
  catch (e: any) { saveState.value = 'error'; ElMessage.error('删除失败：' + (e?.message || '未知错误')) }
}
async function clearChat() {
  const pid = project.value?.id
  if (!pid || generating.value || messages.value.length === 0) return
  try { await ElMessageBox.confirm('确定清空当前对话吗？其他历史对话不会受影响。', '清空当前对话', { type: 'warning' }) } catch { return }
  await db.Messages.clearSession(pid, activeSessionId.value)
  messages.value = []
  aiStreamingText.value = ''
  saveState.value = 'idle'
  await refreshHistorySessions()
  ElMessage.success('当前对话已清空')
}
function onKeydown(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }
async function scrollToBottom() { await nextTick(); const el = chatBodyRef.value; if (el) el.scrollTop = el.scrollHeight }

function orderCanvasNodes(source: CanvasNode[]) {
  if (source.length <= 1) return [...source]
  const map = new Map(source.map(node => [node.id, node]))
  const incoming = new Set<string>()
  for (const node of source) for (const id of node.links || []) if (map.has(id)) incoming.add(id)
  const ordered: CanvasNode[] = []
  const seen = new Set<string>()
  let current: CanvasNode | undefined = source.find(node => !incoming.has(node.id)) || source[0]
  while (current && !seen.has(current.id)) {
    ordered.push(current); seen.add(current.id)
    current = (current.links || []).map(id => map.get(id)).find(Boolean) as CanvasNode | undefined
  }
  return [...ordered, ...source.filter(node => !seen.has(node.id)).sort((a, b) => (a.order || 0) - (b.order || 0))]
}
async function loadCanvasContext(showToast = false) {
  const pid = project.value?.id
  if (!pid) return
  try {
    canvasNodes.value = orderCanvasNodes(await db.Canvas.list(pid))
    if (showToast) ElMessage.success(`已刷新 ${canvasNodes.value.length} 个画布节点`)
  } catch (e: any) { if (showToast) ElMessage.error('画布读取失败：' + (e?.message || '未知错误')) }
}
async function toggleCanvasLink() {
  const pid = project.value?.id
  if (!pid) return
  canvasLinked.value = !canvasLinked.value
  localStorage.setItem(canvasLinkKey(pid), canvasLinked.value ? '1' : '0')
  if (canvasLinked.value) { await loadCanvasContext(); ElMessage.success(`已链接故事画布，共 ${canvasNodes.value.length} 个节点`) }
}
function buildCanvasContext() {
  if (!canvasLinked.value || canvasNodes.value.length === 0) return ''
  const labels: Record<CanvasNode['type'], string> = { start: '起点', inciting: '触发事件', rising: '发展', climax: '高潮', resolution: '结局', scene: '场景', plot: '剧情', character: '角色', theme: '主题', note: '笔记' }
  const content = canvasNodes.value.map((node, index) => {
    const prompt = node.aiPrompt ? `\n写作提示：${node.aiPrompt}` : ''
    return `${index + 1}. [${labels[node.type]}] ${node.title || '未命名节点'}\n${node.content || '（无内容）'}${prompt}`
  }).join('\n\n')
  return `【已链接的故事画布】\n请优先参考以下画布节点及其连接顺序；若用户的新要求与画布冲突，应指出冲突并询问是否调整。\n\n${content.slice(0, 12000)}`
}

async function sendChat() {
  if (!canSend.value || !project.value) return
  const provider = getProvider()
  if (!provider?.apiKey) { ElMessage.warning('请先在设置中配置 API Key'); return }
  const content = userInput.value.trim()
  await pushMsg({ role: 'user', content })
  userInput.value = ''
  generating.value = true
  aiStreamingText.value = ''
  stopFlag.value = false
  currentStreamCancel = null
  await scrollToBottom()
  let finalSysContent = `你是一位资深小说设定顾问，协助用户讨论与梳理小说设定。可涵盖：世界观、力量体系、角色设计与动机、势力关系、剧情走向、伏笔与时间线等。回答用中文，条理清晰，可用 markdown 列表/标题组织。

【作品背景】
标题：${project.value.title || '未命名'}
类型：${project.value.genre || '未指定'}
简介：${project.value.description || '（无）'}`
  try {
    if (canvasLinked.value) { await loadCanvasContext(); const ctx = buildCanvasContext(); if (ctx) finalSysContent += '\n\n' + ctx }
    if (webSearchEnabled.value) { const searchCtx = await searchAndBuildContext(content, 6); if (searchCtx) finalSysContent += '\n\n' + searchCtx }
    const ret = window.api.ai.stream(aiSvc.buildRequest({
      baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: aiModel.value || project.value.settings.model,
      messages: [{ role: 'system', content: finalSysContent }, ...messages.value.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))],
      temperature: 0.8, maxTokens: 4096
    }), (chunk: string) => { if (!stopFlag.value) { aiStreamingText.value += chunk; scrollToBottom() } })
    if (ret && typeof (ret as any).cancel === 'function') currentStreamCancel = (ret as any).cancel
    const retObj = ret as { promise?: Promise<string>; cancel?: () => void } | Promise<string>
    const isWrapper = retObj && typeof (retObj as any).promise === 'object' && typeof (retObj as any).cancel === 'function'
    const full = isWrapper ? await (retObj as { promise: Promise<string> }).promise : await (retObj as Promise<string>)
    if (full && !stopFlag.value) await pushMsg({ role: 'assistant', content: full })
  } catch (e: any) {
    if (!stopFlag.value) ElMessage.error('AI 调用失败：' + (e?.message || '未知错误'))
  } finally {
    generating.value = false; aiStreamingText.value = ''; currentStreamCancel = null; await scrollToBottom()
  }
}
async function stopGenerate() {
  stopFlag.value = true
  if (currentStreamCancel) { try { currentStreamCancel() } catch {}; currentStreamCancel = null }
  const partial = aiStreamingText.value.trim()
  aiStreamingText.value = ''
  generating.value = false
  if (partial) await pushMsg({ role: 'assistant', content: partial })
}

onMounted(async () => {
  if (!settings.settings) { try { await settings.load() } catch {} }
  if (!project.value) { try { await projectStore.loadProject(route.params.id as string) } catch {} }
  if (!aiModel.value && models.value.length > 0) aiModel.value = project.value?.settings.model || settings.defaultModel() || models.value[0].model
  const pid = project.value?.id
  if (pid) {
    canvasLinked.value = route.query.canvas === 'linked' || localStorage.getItem(canvasLinkKey(pid)) === '1'
    if (canvasLinked.value) { localStorage.setItem(canvasLinkKey(pid), '1'); await loadCanvasContext() }
  }
  await initialiseHistory()
  await nextTick(() => scrollToBottom())
})
</script>

<style scoped>
.chat-settings-root{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)}
.chat-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);background:var(--panel);flex-shrink:0}.chat-header-left,.chat-header-right{display:flex;align-items:center;gap:8px}.chat-header-left{color:var(--text);min-width:0}.chat-header-right{flex-wrap:wrap;justify-content:flex-end}.chat-header-title{font-size:15px;font-weight:600}.save-state{min-width:68px;font-size:11px;color:var(--text-3)}.save-state.saved{color:var(--success)}.save-state.error{color:var(--danger)}
.chat-body{flex:1;overflow-y:auto;padding:20px;scroll-behavior:smooth}.chat-empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-3);text-align:center;gap:8px}.chat-bubble-icon{width:64px;height:64px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;margin-bottom:12px}.chat-empty-title{font-size:18px;font-weight:600;color:var(--text);margin:0}.chat-empty-tip{font-size:13px;color:var(--text-3);max-width:520px;line-height:1.6;margin:0}.chat-list{max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:16px}.chat-msg{display:flex;flex-direction:column;gap:6px}.chat-msg.user{align-items:flex-end}.chat-msg.assistant{align-items:flex-start}.chat-msg-role{font-size:11px;color:var(--text-3);font-weight:600;padding:0 2px}.chat-msg-content{max-width:80%;padding:9px 13px;border-radius:18px;background:var(--panel-2);color:var(--text);font-size:14px;line-height:1.7;word-break:break-word}.chat-msg.user .chat-msg-content{background:var(--primary);color:#fff;border-radius:18px 18px 5px 18px;box-shadow:0 1px 4px rgba(91,155,213,.25)}
.ai-output-card{max-width:88%;padding:12px 16px;border-radius:16px;background:var(--panel);border:1px solid var(--border);color:var(--text);font-size:14px;line-height:1.7;word-break:break-word;box-shadow:var(--shadow);transition:box-shadow .18s ease,border-color .18s ease}.ai-output-card:hover{border-color:var(--primary);box-shadow:var(--shadow-hover)}.ai-output-content :deep(h1),.ai-output-content :deep(h2),.ai-output-content :deep(h3){margin:10px 0 6px;font-weight:600}.ai-output-content :deep(p){margin:6px 0}.ai-output-content :deep(ul),.ai-output-content :deep(ol){margin:6px 0;padding-left:22px}.ai-output-content :deep(code){background:var(--panel-2);padding:1px 5px;border-radius:4px}.ai-output-content :deep(pre){background:var(--panel-2);padding:10px 12px;border-radius:8px;overflow-x:auto}.ai-output-actions{display:flex;gap:6px;margin-top:8px;opacity:.7}.ai-act-btn{width:30px;height:30px;background:transparent;border:1px solid var(--border);border-radius:50%;cursor:pointer;color:var(--text-2);display:inline-flex;align-items:center;justify-content:center}.ai-act-btn:hover{background:var(--panel-2);color:var(--text)}.ai-act-btn.danger:hover{color:#ef4444;border-color:#ef4444}.streaming-card{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-light)}.cursor{display:inline-block;animation:blink 1s steps(2,start) infinite;color:var(--primary)}@keyframes blink{to{visibility:hidden}}.loading-icon,.rotating{animation:rotate 1s linear infinite}@keyframes rotate{to{transform:rotate(360deg)}}
.chat-input-area{flex-shrink:0;padding:14px 20px 18px;border-top:1px solid var(--border);background:var(--panel)}.chat-input-toolbar{max-width:880px;margin:0 auto 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.context-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;font-size:12px;border:1px solid var(--border);border-radius:999px;background:var(--bg);color:var(--text-2);cursor:pointer;transition:all .15s}.context-btn:hover{border-color:var(--primary);color:var(--primary)}.context-btn.active{background:var(--primary);border-color:var(--primary);color:#fff}.context-btn.icon-only{width:30px;height:30px;padding:0;justify-content:center;border-radius:50%}.searching-card{display:flex;align-items:center;gap:8px;color:var(--primary);font-size:13px}.chat-input-wrap{max-width:880px;margin:0 auto;display:flex;gap:10px;align-items:flex-end}.chat-input{flex:1;resize:none;padding:10px 14px;border:1px solid var(--border);border-radius:16px;background:var(--bg);color:var(--text);font-size:14px;line-height:1.6;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}.chat-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-light)}.send-btn{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:10px 20px;border:none;border-radius:999px;background:var(--primary);color:#fff;font-size:14px;cursor:pointer;transition:opacity .15s,transform .15s}.send-btn:hover{opacity:.92;transform:translateY(-1px)}.send-btn.disabled{background:var(--text-3);cursor:not-allowed;opacity:.6;transform:none}
.history-actions{margin-bottom:14px}.history-empty{padding:48px 12px;text-align:center;color:var(--text-3)}.history-list{display:flex;flex-direction:column;gap:8px}.history-item{width:100%;border:1px solid var(--border);border-radius:16px;background:var(--panel);color:var(--text);padding:11px 12px 11px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left;transition:all .15s}.history-item:hover,.history-item.active{border-color:var(--primary);background:var(--primary-light)}.history-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}.history-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.history-main small{color:var(--text-3);font-size:11px}.history-delete{width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--text-3)}.history-delete:hover{color:var(--danger);background:rgba(239,68,68,.1)}
@media(max-width:900px){.chat-header{align-items:flex-start;flex-direction:column}.chat-header-right{width:100%;justify-content:flex-start}.chat-msg-content,.ai-output-card{max-width:96%}}
</style>
