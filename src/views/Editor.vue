<template>
  <div class="editor-root" v-if="project && chapter">
    <!-- 顶部通栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <button class="tb-icon-btn" @click="goBack" title="返回">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <button class="tb-icon-btn" :disabled="!prevChapter" @click="prevChapter && goChapter(prevChapter)" title="上一章">
          <el-icon><Back /></el-icon>
        </button>
        <button class="tb-icon-btn" :disabled="!nextChapter" @click="nextChapter && goChapter(nextChapter)" title="下一章">
          <el-icon><Right /></el-icon>
        </button>
        <button class="tb-icon-btn" @click="searchVisible = !searchVisible" title="搜索">
          <el-icon><Search /></el-icon>
        </button>
        <span class="word-count-pill">字数: {{ wordCount }}</span>
      </div>

      <div class="topbar-center">
        <button class="tb-fn-btn" @click="runTopAction('teardown')">
          <el-icon><Document /></el-icon><span>AI拆书</span>
        </button>
        <button class="tb-fn-btn" @click="runTopAction('review')">
          <el-icon><Checked /></el-icon><span>AI审稿</span>
        </button>
        <button class="tb-fn-btn" @click="runTopAction('depolish')">
          <el-icon><Brush /></el-icon><span>AI消痕</span>
        </button>
        <button class="tb-fn-btn tb-fn-danger" @click="runTopAction('typo')">
          <el-icon><Warning /></el-icon><span>错AI检查</span>
        </button>
        <button class="tb-fn-btn" @click="runTopAction('format')">
          <el-icon><Grid /></el-icon><span>智能排版</span>
        </button>
        <button class="tb-fn-btn" @click="runTopAction('time Machine')">
          <el-icon><Timer /></el-icon><span>时光机</span>
        </button>
      </div>

      <div class="topbar-right">
        <el-select v-model="chatSessionId" size="small" placeholder="对话 ▽" style="width: 130px">
          <el-option label="默认对话" value="default" />
        </el-select>
        <button class="tb-icon-btn" @click="newConversation" title="新建对话">
          <el-icon><Plus /></el-icon>
        </button>
        <button class="tb-icon-btn" @click="historyVisible = !historyVisible" title="历史记录">
          <el-icon><Clock /></el-icon>
        </button>
      </div>
    </header>

    <!-- 搜索条 -->
    <div v-if="searchVisible" class="search-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="在当前章节中搜索..."
        size="small"
        clearable
        @input="doSearch"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <span class="text-faint text-xs">{{ searchMatches }} 个结果</span>
    </div>

    <!-- 主体三栏 -->
    <div class="main-area">
      <!-- 左侧栏 -->
      <aside class="left-panel" :class="{ collapsed: leftCollapsed }">
        <!-- 文档树 -->
        <div class="tree-section">
          <div class="tree-header">
            <span class="tree-title">文档目录</span>
            <el-button text size="small" :icon="Plus" @click="newChapterAfter" title="新建章节" />
          </div>
          <div class="tree-body">
            <!-- 项目根 -->
            <div class="tree-node root-node">
              <div class="tree-row root-row">
                <el-icon class="tree-icon"><Folder /></el-icon>
                <span class="tree-label">{{ project.title || '未命名' }}</span>
              </div>
              <!-- 主要内容 -->
              <div class="tree-children">
                <div class="tree-node">
                  <div class="tree-row" @click="toggleMainContent">
                    <el-icon class="tree-toggle">
                      <ArrowDown v-if="mainContentExpanded" /><ArrowRight v-else />
                    </el-icon>
                    <el-icon class="tree-icon"><Folder /></el-icon>
                    <span class="tree-label">主要内容</span>
                  </div>
                  <div v-if="mainContentExpanded" class="tree-children">
                    <div
                      v-for="c in projectStore.chapters"
                      :key="c.id"
                      class="tree-row leaf-row"
                      :class="{ active: c.id === chapter?.id }"
                      @click="goChapter(c)"
                    >
                      <el-icon class="tree-icon"><Document /></el-icon>
                      <span class="tree-label">第{{ c.order }}章 · {{ c.title }}</span>
                    </div>
                  </div>
                </div>
                <!-- 快捷入口 -->
                <div class="tree-row leaf-row" @click="$router.push({ name: 'lore' })">
                  <el-icon class="tree-icon"><Collection /></el-icon>
                  <span class="tree-label">设定</span>
                </div>
                <div class="tree-row leaf-row" @click="$router.push({ name: 'characters' })">
                  <el-icon class="tree-icon"><User /></el-icon>
                  <span class="tree-label">角色</span>
                </div>
                <div class="tree-row leaf-row" @click="$router.push({ name: 'lore' })">
                  <el-icon class="tree-icon"><Files /></el-icon>
                  <span class="tree-label">知识库</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI 分析 -->
        <div class="ai-analysis-section">
          <div class="section-title">AI 分析</div>
          <div class="analysis-list">
            <button class="analysis-item" @click="runAnalysis('plot')">
              <el-icon><DataAnalysis /></el-icon><span>剧情分析</span>
            </button>
            <button class="analysis-item" @click="runAnalysis('characters')">
              <el-icon><Connection /></el-icon><span>人物关系</span>
            </button>
            <button class="analysis-item" @click="runAnalysis('holes')">
              <el-icon><Warning /></el-icon><span>漏洞分析</span>
            </button>
          </div>
          <div class="analysis-actions">
            <el-button size="small" :icon="Upload" @click="uploadAttachment">上传文件</el-button>
            <el-button size="small" :icon="Download" @click="exportCurrent">导出</el-button>
          </div>
        </div>

        <!-- 保存作品悬浮按钮 -->
        <button class="save-work-btn" :class="{ saving: saveStatus === 'saving' }" @click="save">
          <el-icon v-if="saveStatus === 'saving'"><Loading /></el-icon>
          <span>{{ saveStatus === 'saving' ? '保存中...' : '保存作品' }}</span>
        </button>
      </aside>

      <!-- 收起按钮 -->
      <button class="collapse-left" @click="leftCollapsed = !leftCollapsed" :title="leftCollapsed ? '展开' : '收起'">
        <el-icon><DArrowLeft v-if="!leftCollapsed" /><DArrowRight v-else /></el-icon>
      </button>

      <!-- 中间编辑区 -->
      <main class="editor-main">
        <!-- 章节标题区 -->
        <div class="chapter-head">
          <div class="chapter-title-row">
            <h1 class="chapter-title" contenteditable="true" @blur="onTitleBlur" v-text="chapter.title"></h1>
            <div class="chapter-actions">
              <button class="chap-icon" @click="copyChapterText" title="复制文本"><el-icon><DocumentCopy /></el-icon></button>
              <button class="chap-icon" @click="speakChapter" title="朗读"><el-icon><Microphone /></el-icon></button>
              <button class="chap-icon" @click="highlightSel" title="高亮标记"><el-icon><Star /></el-icon></button>
              <button class="chap-icon" @click="clearChapter" title="清空内容"><el-icon><Delete /></el-icon></button>
              <button class="chap-icon" @click="copyChapterText" title="一键复制"><el-icon><CopyDocument /></el-icon></button>
            </div>
          </div>

          <!-- 章节概要卡片 -->
          <div class="summary-card">
            <div class="summary-left">
              <el-icon><Document /></el-icon>
              <span>章节概要</span>
            </div>
            <div class="summary-right">
              <el-button text size="small" :icon="MagicStick" :loading="generating" @click="generateSummary">总结当前章节</el-button>
              <el-button text size="small" @click="batchSummary">批量生成概要 &gt;</el-button>
            </div>
            <div class="summary-content" v-if="chapter.summary">{{ chapter.summary }}</div>
            <div class="summary-content text-faint" v-else>暂无概要，可点击"总结当前章节"由 AI 自动生成</div>
          </div>
        </div>

        <!-- 编辑区 -->
        <div class="write-area" :style="{ fontFamily: editorFont }">
          <div class="editor-toolbar" v-if="editor">
            <button class="tb-btn" @click="editor.chain().focus().undo().run()" title="撤销"><el-icon><RefreshLeft /></el-icon></button>
            <button class="tb-btn" @click="editor.chain().focus().redo().run()" title="重做"><el-icon><RefreshRight /></el-icon></button>
            <span class="tb-sep"></span>
            <button class="tb-btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()"><b>B</b></button>
            <button class="tb-btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()"><i>I</i></button>
            <button class="tb-btn" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()"><s>S</s></button>
            <span class="tb-sep"></span>
            <button class="tb-btn" :class="{ active: editor.isActive('paragraph') }" @click="editor.chain().focus().setParagraph().run()">正文</button>
            <button class="tb-btn" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
            <button class="tb-btn" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
            <span class="tb-sep"></span>
            <button class="tb-btn" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()" title="引用"><el-icon><ChatLineRound /></el-icon></button>
            <button class="tb-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" title="列表"><el-icon><List /></el-icon></button>
          </div>
          <div class="write-scroll">
            <editor-content :editor="editor" class="tiptap-content" v-if="editor" />
          </div>
        </div>

        <!-- 底部状态 -->
        <div class="editor-footer">
          <el-tag size="small" effect="plain">{{ chapter.status }}</el-tag>
          <span class="text-faint text-xs">字数 {{ wordCount }}</span>
          <span class="save-status" :class="saveStatusClass">{{ saveStatusText }}</span>
        </div>
      </main>

      <!-- 右侧 AI 对话面板 -->
      <aside class="right-panel">
        <!-- 对话显示区 -->
        <div class="chat-display">
          <div v-if="chatMessages.length === 0" class="chat-empty">
            <div class="chat-bubble-icon">
              <el-icon><ChatDotRound /></el-icon>
            </div>
            <p class="chat-empty-title">对话区域</p>
            <p class="chat-empty-tip">输入任何你对小说的疑问，比如"人物设定如何修改"，"文章建议"。</p>
            <p class="chat-empty-tip">提示：输入 <code class="hint-code">/</code> 可触发技能，输入 <code class="hint-code">@</code> 可关联章节内容</p>
            <a class="billing-link" href="javascript:void(0)">计费规则</a>
          </div>
          <div v-else class="chat-list">
            <div
              v-for="(msg, i) in chatMessages"
              :key="i"
              class="chat-msg"
              :class="msg.role"
            >
              <div class="chat-msg-role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
              <div class="chat-msg-content">{{ msg.content }}</div>
              <div class="chat-msg-actions" v-if="msg.role === 'assistant' && msg.content">
                <el-button text size="small" :icon="DocumentCopy" @click="copyText(msg.content)">复制</el-button>
                <el-button text size="small" :icon="Plus" @click="appendOutput(msg.content)">追加到正文</el-button>
              </div>
            </div>
            <div v-if="generating" class="chat-msg assistant">
              <div class="chat-msg-role">AI</div>
              <div class="chat-msg-content streaming">{{ aiStreamingText }}<span class="cursor">▌</span></div>
            </div>
          </div>
        </div>

        <!-- 关联片段 -->
        <div class="link-section">
          <div class="link-row">
            <el-button text size="small" :icon="Link" @click="linkCurrentChapter">@关联内容</el-button>
            <el-button text size="small" :icon="Upload" @click="uploadAttachment">添加文件</el-button>
            <span class="text-faint text-xs">总计:{{ linkedWordsCount }}字 ({{ linkedItems.length }}个片段)</span>
          </div>
          <div class="linked-tags" v-if="linkedItems.length">
            <el-tag
              v-for="(item, i) in linkedItems"
              :key="i"
              size="small"
              closable
              @close="linkedItems.splice(i, 1)"
            >{{ item.label }}</el-tag>
          </div>
        </div>

        <!-- 指令输入区 -->
        <div class="input-area">
          <textarea
            ref="inputRef"
            v-model="userInput"
            class="chat-input"
            placeholder="请输入指令，使用 @ 可以快速关联内容，使用 / 可以触发技能"
            rows="4"
            @input="onInput"
            @keydown="onKeydown"
          ></textarea>

          <!-- 技能弹出菜单 -->
          <div v-if="slashMenuVisible" class="slash-menu">
            <div class="slash-menu-header">
              <span>技能列表</span>
              <span class="text-faint text-xs">{{ filteredSkills.length }} 个</span>
            </div>
            <div class="slash-menu-list">
              <button
                v-for="s in filteredSkills"
                :key="s.id"
                class="slash-menu-item"
                @click="pickSkill(s)"
              >
                <el-icon class="slash-icon"><MagicStick /></el-icon>
                <div class="slash-item-body">
                  <div class="slash-item-name">{{ s.name }}</div>
                  <div class="slash-item-desc text-faint text-xs">{{ s.description || s.category }}</div>
                </div>
              </button>
              <div v-if="filteredSkills.length === 0" class="slash-empty text-faint text-xs">
                没有匹配的技能
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作行 -->
        <div class="input-bottom">
          <div class="input-bottom-left">
            <el-select v-model="selectedPromptId" placeholder="选择提示词 ▽" size="small" style="width: 140px" filterable clearable>
              <el-option-group label="内置">
                <el-option v-for="p in builtinPrompts" :key="p.id" :label="p.title" :value="p.id" />
              </el-option-group>
              <el-option-group label="项目">
                <el-option v-for="p in projectPrompts" :key="p.id" :label="p.title" :value="p.id" />
              </el-option-group>
            </el-select>
            <el-select v-model="aiModel" placeholder="进阶模型" size="small" style="width: 140px">
              <el-option v-for="m in models" :key="m.model" :label="m.model" :value="m.model" />
            </el-select>
          </div>
          <div class="input-bottom-right">
            <span class="text-faint text-xs screenshot-hint">截图 Alt+D</span>
            <button class="send-btn" :disabled="!canSend" :loading="generating" @click="sendChat">
              <el-icon><Promotion /></el-icon>
            </button>
          </div>
        </div>
      </aside>
    </div>

    <!-- 顶部功能 - 时光机抽屉 -->
    <el-drawer v-model="historyVisible" title="历史记录" direction="rtl" size="380px">
      <div class="history-list">
        <div v-for="h in chatHistoryList" :key="h.id" class="history-item">
          <div class="history-title">{{ h.title }}</div>
          <div class="history-time text-faint text-xs">{{ formatTime(h.time) }}</div>
        </div>
        <div v-if="chatHistoryList.length === 0" class="text-faint text-sm" style="padding: 20px; text-align: center">
          暂无历史记录
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, ArrowRight, ArrowDown, ArrowRight as Right, Back, Search, Plus,
  Document, Checked, Brush, Warning, Grid, Timer, Clock, Folder, Collection,
  User, Files, DataAnalysis, Connection, Upload, Download, Loading,
  DocumentCopy, Microphone, Delete, CopyDocument, MagicStick, RefreshLeft,
  RefreshRight, ChatLineRound, List, ChatDotRound, Link, Promotion,
  Star, DArrowLeft, DArrowRight
} from '@element-plus/icons-vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as db from '@/services/db'
import * as aiSvc from '@/services/ai'
import { Skills as SkillsDB } from '@/services/db'
import type { Chapter, Prompt, Skill } from '@/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)

const currentChapterId = ref(route.params.chapterId as string)
const chapter = ref<Chapter | null>(null)

// ===== 顶部 / 左侧 =====
const leftCollapsed = ref(false)
const mainContentExpanded = ref(true)
const searchVisible = ref(false)
const searchKeyword = ref('')
const searchMatches = ref(0)
const chatSessionId = ref('default')
const historyVisible = ref(false)

const chatHistoryList = ref<Array<{ id: string; title: string; time: number }>>([])

function goBack() {
  router.push({ name: 'chapters' })
}

function toggleMainContent() {
  mainContentExpanded.value = !mainContentExpanded.value
}

function newConversation() {
  chatMessages.value = []
  ElMessage.success('已新建对话')
}

// ===== 编辑器 =====
const editorFont = computed(() => settings.settings?.editorFont || '思源宋体, serif')
const models = computed(() => settings.availableModels())
const aiModel = ref('')

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: '开始你的故事...' }),
    CharacterCount.configure({ limit: null })
  ],
  autofocus: 'end',
  onUpdate: () => { scheduleSave() }
})

const wordCount = computed(() => editor.value?.storage.characterCount.characters() || 0)

// 保存
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
let saveTimer: any = null
const saveStatusText = computed(() => ({ idle: '', saving: '保存中...', saved: '已保存' }[saveStatus.value]))
const saveStatusClass = computed(() => ({ idle: '', saving: 'saving', saved: 'saved' }[saveStatus.value]))

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveStatus.value = 'saving'
  saveTimer = setTimeout(save, 1500)
}

async function save() {
  if (!editor.value || !chapter.value) return
  saveStatus.value = 'saving'
  try {
    chapter.value.content = editor.value.getHTML()
    chapter.value.wordCount = wordCount.value
    chapter.value.updatedAt = Date.now()
    await db.Chapters.save(chapter.value)
    const idx = projectStore.chapters.findIndex(c => c.id === chapter.value!.id)
    if (idx >= 0) projectStore.chapters[idx] = { ...chapter.value }
    saveStatus.value = 'saved'
    setTimeout(() => { saveStatus.value = 'idle' }, 1500)
  } catch (e: any) {
    saveStatus.value = 'idle'
    ElMessage.error('保存失败：' + e.message)
  }
}

function onTitleBlur(e: Event) {
  const newTitle = (e.target as HTMLElement).innerText.trim()
  if (chapter.value && newTitle && newTitle !== chapter.value.title) {
    chapter.value.title = newTitle
    save()
  }
}

// ===== 章节切换 =====
const prevChapter = computed(() => {
  if (!chapter.value) return null
  const idx = projectStore.chapters.findIndex(c => c.id === chapter.value!.id)
  return idx > 0 ? projectStore.chapters[idx - 1] : null
})
const nextChapter = computed(() => {
  if (!chapter.value) return null
  const idx = projectStore.chapters.findIndex(c => c.id === chapter.value!.id)
  return idx >= 0 && idx < projectStore.chapters.length - 1 ? projectStore.chapters[idx + 1] : null
})

function goChapter(c: Chapter) {
  router.push({ name: 'editor', params: { chapterId: c.id } })
}

async function newChapterAfter() {
  if (!chapter.value || !project.value) return
  await save()
  const order = chapter.value.order + 1
  for (const c of projectStore.chapters) {
    if (c.order >= order) { c.order++; await db.Chapters.save(c) }
  }
  const c = await db.Chapters.save({
    projectId: project.value.id,
    title: `第${order}章`,
    content: '', contentType: 'html', summary: '',
    status: '草稿', order, wordCount: 0, notes: '',
    createdAt: 0, updatedAt: 0
  } as any)
  await projectStore.reloadChapters()
  goChapter(c)
}

async function loadChapter(id: string) {
  try {
    if (!project.value) return
    const c = await db.Chapters.list(project.value.id)
    projectStore.chapters = c.sort((a, b) => a.order - b.order)
    const target = projectStore.chapters.find(x => x.id === id)
    if (!target) {
      ElMessage.error('章节不存在')
      return
    }
    chapter.value = target
    currentChapterId.value = id
    const all = await db.Prompts.list(project.value.id)
    builtinPrompts.value = all.filter(p => p.isBuiltIn)
    projectPrompts.value = all.filter(p => !p.isBuiltIn)
    // 加载技能
    skills.value = await SkillsDB.list(project.value.id)
    if (editor.value) {
      editor.value.commands.setContent(target.content || '', false)
      await nextTick()
      editor.value.commands.focus('end')
    }
  } catch (e: any) {
    ElMessage.error('加载章节失败：' + e.message)
  }
}

// ===== 上下文 =====
function buildContext(): string {
  if (!chapter.value || !project.value) return ''
  const prevChapters = projectStore.chapters
    .filter(c => c.order < chapter.value!.order)
    .sort((a, b) => a.order - b.order)
  const recentSummaries = prevChapters.slice(-3).map(c => `第${c.order}章《${c.title}》：${c.summary || '（无摘要）'}`).join('\n')
  const currentText = editor.value?.getText() || ''
  const tail = currentText.slice(-1500)
  const chars = projectStore.characters.slice(0, 10).map(c => `${c.name}(${c.role})：${c.personality?.slice(0, 50) || ''}`).join('；')
  const lore = projectStore.lore.slice(0, 8).map(l => `${l.category}/${l.title}：${l.content?.slice(0, 60) || ''}`).join('；')
  return `【作品信息】\n类型：${project.value.genre}\n标题：${project.value.title}\n简介：${project.value.description}\n\n【前情摘要】\n${recentSummaries}\n\n【角色】${chars}\n\n【设定】${lore}\n\n【当前章节】\n第${chapter.value.order}章《${chapter.value.title}》\n${tail}`
}

// ===== AI 对话面板 =====
const chatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])
const userInput = ref('')
const aiStreamingText = ref('')
const generating = ref(false)
const stopFlag = ref(false)
const builtinPrompts = ref<Prompt[]>([])
const projectPrompts = ref<Prompt[]>([])
const selectedPromptId = ref('')
const skills = ref<Skill[]>([])

// 关联片段
const linkedItems = ref<Array<{ label: string; content: string }>>([])
const linkedWordsCount = computed(() => linkedItems.value.reduce((s, i) => s + i.content.length, 0))

function linkCurrentChapter() {
  if (!chapter.value) return
  const text = editor.value?.getText() || ''
  linkedItems.value.push({
    label: `第${chapter.value.order}章`,
    content: text
  })
  ElMessage.success('已关联当前章节')
}

function uploadAttachment() {
  ElMessage.info('附件上传功能待实现')
}

function exportCurrent() {
  if (!chapter.value) return
  router.push({ name: 'export' })
}

// / 触发技能菜单
const slashMenuVisible = ref(false)
const slashKeyword = ref('')

const filteredSkills = computed(() => {
  if (!slashKeyword.value) return skills.value
  const kw = slashKeyword.value.toLowerCase()
  return skills.value.filter(s =>
    s.name.toLowerCase().includes(kw) ||
    (s.description || '').toLowerCase().includes(kw) ||
    (s.tags || []).some(t => t.toLowerCase().includes(kw))
  )
})

function onInput(e: Event) {
  const v = (e.target as HTMLTextAreaElement).value
  // 检测 / 触发
  if (v.startsWith('/')) {
    slashMenuVisible.value = true
    slashKeyword.value = v.slice(1)
  } else {
    slashMenuVisible.value = false
    slashKeyword.value = ''
  }
}

function onKeydown(e: KeyboardEvent) {
  // Enter 发送，Shift+Enter 换行
  if (e.key === 'Enter' && !e.shiftKey && !slashMenuVisible.value) {
    e.preventDefault()
    sendChat()
  } else if (e.key === 'Escape' && slashMenuVisible.value) {
    slashMenuVisible.value = false
  }
}

function pickSkill(s: Skill) {
  // 自动用上下文填充变量
  const vars: Record<string, string> = {}
  const ctx = buildContext()
  const fullText = editor.value?.getText() || ''
  const selRange = editor.value?.state.selection
  const selText = selRange && selRange.to > selRange.from
    ? editor.value!.state.doc.textBetween(selRange.from, selRange.to, '\n')
    : ''

  for (const v of (s.variables || [])) {
    if (v === 'content') vars.content = selText || fullText.slice(-2000)
    else if (v === 'context') vars.context = ctx
    else if (v === 'genre') vars.genre = project.value?.genre || ''
    else if (v === 'title') vars.title = project.value?.title || ''
    else if (v === 'setup') vars.setup = project.value?.description || ''
    else if (v === 'words') vars.words = '800'
    else if (v === 'characters') vars.characters = projectStore.characters.map(c => c.name).join('、')
    else if (v === 'instruction') vars.instruction = ''
    else if (v === 'imitationGuide') vars.imitationGuide = project.value?.settings.styleSample || ''
    else if (v === 'count') vars.count = '10'
    else if (v === 'scene') vars.scene = ''
    else if (v === 'emotion') vars.emotion = ''
    else if (v === 'searchResults') vars.searchResults = ''
    else if (v === 'excerpt') vars.excerpt = fullText.slice(0, 3000)
    else if (v === 'topic') vars.topic = ''
    else vars[v] = ''
  }

  // 检查是否还有未填变量
  const missing = (s.variables || []).filter(v => !vars[v] && v !== 'instruction' && v !== 'scene' && v !== 'emotion' && v !== 'topic')
  if (missing.length > 0) {
    ElMessage.warning(`技能「${s.name}」需要变量：${missing.join(', ')}，请补充到输入框`)
  }

  const rendered = aiSvc.renderTemplate(s.userPrompt, vars)
  // 把技能名 + 渲染后的内容放到输入框，让用户检查后发送
  userInput.value = `【技能：${s.name}】\n${rendered}`
  slashMenuVisible.value = false
  // 标记当前选中的技能，发送时用它的 system prompt
  pendingSkill.value = s
}

const pendingSkill = ref<Skill | null>(null)

const canSend = computed(() => (userInput.value.trim() || selectedPromptId.value) && !generating.value)

function getProvider() {
  const m = aiModel.value || project.value?.settings.model || ''
  return settings.findProviderForModel(m)
}

async function sendChat() {
  if (!canSend.value || !project.value) return
  const provider = getProvider()
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置 API Key')
    return
  }

  const userMsg = userInput.value.trim()
  if (!userMsg) return

  chatMessages.value.push({ role: 'user', content: userMsg })
  userInput.value = ''
  slashMenuVisible.value = false
  pendingSkill.value = null

  // 构造 system + user
  let sysContent = `你是一位资深小说家，擅长${project.value.genre}类型创作。请直接输出正文内容，不要写"以下是续写"等说明性文字，不要使用 markdown 代码块。文风自然流畅，避免AI味。${project.value.settings.styleSample ? '\n参考文风：' + project.value.settings.styleSample : ''}`
  let userContent = userMsg

  // 如果使用了技能，从消息中剥离标记，使用技能的 system prompt
  const skillMatch = userMsg.match(/^【技能：(.+?)】\n([\s\S]*)$/)
  if (skillMatch) {
    const skillName = skillMatch[1]
    const skill = skills.value.find(s => s.name === skillName)
    if (skill) {
      sysContent = skill.systemPrompt || sysContent
      userContent = skillMatch[2]
    }
  } else if (selectedPromptId.value) {
    const all = [...builtinPrompts.value, ...projectPrompts.value]
    const tpl = all.find(p => p.id === selectedPromptId.value)
    if (tpl) {
      const selRange = editor.value?.state.selection
      const selText = selRange && selRange.to > selRange.from
        ? editor.value!.state.doc.textBetween(selRange.from, selRange.to, '\n')
        : ''
      const vars: Record<string, string> = {
        content: selText || (editor.value?.getText() || '').slice(-2000),
        context: buildContext(),
        genre: project.value.genre,
        title: project.value.title,
        setup: project.value.description,
        words: '800',
        instruction: userMsg,
        count: '10',
        characters: projectStore.characters.map(c => c.name).join('、'),
        scene: userMsg,
        emotion: ''
      }
      userContent = aiSvc.renderTemplate(tpl.content, vars)
    }
  } else {
    // 普通对话：拼上上下文
    const linkedContent = linkedItems.value.map(i => i.content).join('\n\n')
    userContent = `${userMsg}\n\n${linkedContent ? '【关联内容】\n' + linkedContent + '\n\n' : ''}【当前上下文】\n${buildContext()}`
  }

  generating.value = true
  aiStreamingText.value = ''
  stopFlag.value = false
  try {
    const full = await aiSvc.streamChat(
      aiSvc.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: aiModel.value || project.value.settings.model,
        messages: [
          { role: 'system', content: sysContent },
          ...chatMessages.value.slice(-6).map(m => ({ role: m.role as any, content: m.content })),
          { role: 'user', content: userContent }
        ],
        temperature: 0.8,
        maxTokens: 4096
      }),
      (chunk) => {
        if (stopFlag.value) return
        aiStreamingText.value += chunk
      }
    )
    if (full) {
      chatMessages.value.push({ role: 'assistant', content: full })
    }
  } catch (e: any) {
    ElMessage.error('AI 调用失败：' + e.message)
  } finally {
    generating.value = false
    aiStreamingText.value = ''
  }
}

function stopGenerate() {
  stopFlag.value = true
  generating.value = false
}

function copyText(text: string) {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}

function appendOutput(text: string) {
  if (!editor.value || !text) return
  editor.value.commands.focus('end')
  const paras = text.split(/\n+/).filter(p => p.trim())
  for (const p of paras) {
    editor.value.commands.insertContent(`<p>${escapeHtml(p)}</p>`)
  }
  ElMessage.success('已追加到正文')
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ===== 顶部功能 =====
function runTopAction(action: string) {
  if (action === 'time Machine') {
    historyVisible.value = true
    return
  }
  // 把功能映射到内置提示词或技能
  const actionMap: Record<string, string> = {
    teardown: '拆书',
    review: '评审',
    depolish: '润色',
    typo: '校对',
    format: '排版'
  }
  const skill = skills.value.find(s => s.category === actionMap[action] || s.name.includes(actionMap[action]))
  if (skill) {
    pendingSkill.value = skill
    userInput.value = `【技能：${skill.name}】\n${aiSvc.renderTemplate(skill.userPrompt, { content: editor.value?.getText() || '', context: buildContext(), genre: project.value?.genre || '', title: project.value?.title || '' })}`
    sendChat()
  } else {
    // 回退到内置提示词
    const all = [...builtinPrompts.value, ...projectPrompts.value]
    const promptCat: Record<string, string> = { teardown: '摘要', review: '评审', depolish: '润色', typo: '评审', format: '润色' }
    const tpl = all.find(p => p.category === promptCat[action])
    if (tpl) {
      selectedPromptId.value = tpl.id
      userInput.value = action === 'typo' ? '请检查文本中的错别字与 AI 痕迹' : ''
      sendChat()
    } else {
      ElMessage.info(`「${action}」功能待配置对应技能或提示词`)
    }
  }
}

// ===== AI 分析 =====
function runAnalysis(type: 'plot' | 'characters' | 'holes') {
  const map: Record<string, string> = {
    plot: '请对当前章节做剧情分析：总结主要事件、情节推进、冲突点、悬念设置，并给出节奏评价',
    characters: '请分析当前章节中的人物关系：出场角色、彼此关系、性格表现是否符合设定、有无 OOC',
    holes: '请检查当前章节是否存在逻辑漏洞、设定矛盾、伏笔断裂、时间线错误、信息泄露（角色提到不该知道的事）'
  }
  userInput.value = map[type]
  sendChat()
}

// ===== 摘要生成 =====
async function generateSummary() {
  if (!chapter.value || !project.value) return
  const provider = getProvider()
  if (!provider?.apiKey) {
    ElMessage.warning('请先配置 API Key')
    return
  }
  generating.value = true
  try {
    const fullText = editor.value?.getText() || ''
    const sys = { role: 'system' as const, content: '你是文学编辑，请为章节生成 200 字以内的摘要，提炼主要事件、人物行动与情节进展。' }
    const user = { role: 'user' as const, content: fullText }
    const result = await aiSvc.streamChat(
      aiSvc.buildRequest({
        baseUrl: provider.baseUrl, apiKey: provider.apiKey,
        model: aiModel.value || project.value.settings.model,
        messages: [sys, user], temperature: 0.5, maxTokens: 600
      }),
      () => {}
    )
    if (result && chapter.value) {
      chapter.value.summary = result.trim()
      await db.Chapters.save(chapter.value)
      ElMessage.success('概要已生成')
    }
  } catch (e: any) {
    ElMessage.error('生成失败：' + e.message)
  } finally {
    generating.value = false
  }
}

function batchSummary() {
  ElMessage.info('批量生成概要：已切换到章节列表，可逐章点击生成')
  router.push({ name: 'chapters' })
}

// ===== 编辑区操作 =====
function copyChapterText() {
  const text = editor.value?.getText() || ''
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}

function speakChapter() {
  const text = editor.value?.getText() || ''
  if (!text) {
    ElMessage.warning('章节为空')
    return
  }
  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    speechSynthesis.speak(utter)
    ElMessage.success('开始朗读')
  } else {
    ElMessage.warning('浏览器不支持朗读')
  }
}

function highlightSel() {
  if (!editor.value) return
  // 简单实现：把选中内容加粗 + 标黄（通过 mark）
  editor.value.chain().focus().toggleBold().run()
  ElMessage.success('已标记')
}

function clearChapter() {
  if (!editor.value || !chapter.value) return
  if (!confirm('确定清空当前章节内容？此操作不可撤销')) return
  editor.value.commands.clearContent()
  ElMessage.success('已清空')
}

function doSearch() {
  // 简单搜索实现
  if (!searchKeyword.value || !editor.value) {
    searchMatches.value = 0
    return
  }
  const text = editor.value.getText()
  const matches = text.split(searchKeyword.value).length - 1
  searchMatches.value = matches
}

function formatTime(t: number) {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ===== 生命周期 =====
let autoSaveTimer: any = null
const inputRef = ref<HTMLTextAreaElement | null>(null)

onMounted(async () => {
  try {
    if (!project.value) {
      await projectStore.loadProject(route.params.id as string)
    }
    await loadChapter(currentChapterId.value)
    if (!aiModel.value && models.value.length > 0) {
      aiModel.value = project.value?.settings.model || models.value[0].model
    }
    autoSaveTimer = setInterval(() => {
      if (saveStatus.value === 'saving') return
      save()
    }, 30000)
  } catch (e: any) {
    ElMessage.error('初始化失败：' + e.message)
  }
})

onBeforeUnmount(() => {
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  if (saveTimer) clearTimeout(saveTimer)
  save()
  editor.value?.destroy()
})

watch(() => route.params.chapterId, async (id) => {
  if (id && id !== currentChapterId.value) {
    await save()
    await loadChapter(id as string)
  }
})
</script>

<style scoped>
.editor-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

/* ===== 顶部通栏 ===== */
.topbar {
  height: 44px;
  background: #fafbfc;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  flex-shrink: 0;
  gap: 12px;
}
.topbar-left, .topbar-center, .topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.topbar-center { gap: 2px; flex: 1; justify-content: center; }
.tb-icon-btn {
  border: none;
  background: transparent;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.tb-icon-btn:hover:not(:disabled) { background: #e8eaed; color: #1a202c; }
.tb-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.word-count-pill {
  font-size: 12px;
  color: #4a5568;
  padding: 0 8px;
  border-left: 1px solid #e8eaed;
  margin-left: 4px;
}
.tb-fn-btn {
  border: none;
  background: transparent;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.tb-fn-btn:hover { background: #e8eaed; color: #1a202c; }
.tb-fn-btn .el-icon { font-size: 13px; }
.tb-fn-danger { color: #e53e3e !important; font-weight: 600; }
.tb-fn-danger:hover { background: #fed7d7 !important; color: #c53030 !important; }

/* 搜索条 */
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: #fafbfc;
  border-bottom: 1px solid #ebeef5;
}
.search-bar .el-input { max-width: 320px; }

/* ===== 主体三栏 ===== */
.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* ===== 左侧栏 ===== */
.left-panel {
  width: 220px;
  background: #f7f8fa;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s;
  position: relative;
  overflow: hidden;
}
.left-panel.collapsed { width: 0; border-right: none; }
.left-panel.collapsed > * { display: none; }

.tree-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
}
.tree-title {
  font-size: 12px;
  color: #718096;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.tree-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
  font-size: 13px;
}
.tree-node { margin-bottom: 2px; }
.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: #2d3748;
}
.tree-row:hover { background: #edf2f7; }
.tree-row.active { background: #e6f0ff; color: #2563eb; font-weight: 500; }
.tree-icon { font-size: 14px; color: #a0aec0; }
.tree-toggle { font-size: 10px; color: #a0aec0; width: 12px; }
.tree-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.root-row { font-weight: 600; }
.tree-children {
  margin-left: 14px;
  border-left: 1px dashed #e2e8f0;
  padding-left: 4px;
}
.leaf-row { padding-left: 18px; }

.ai-analysis-section {
  border-top: 1px solid #ebeef5;
  padding: 10px 12px;
  background: #fafbfc;
}
.section-title {
  font-size: 12px;
  color: #718096;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.analysis-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
}
.analysis-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
  font-size: 13px;
  text-align: left;
  width: 100%;
}
.analysis-item:hover { background: #edf2f7; color: #1a202c; }
.analysis-actions {
  display: flex;
  gap: 6px;
}
.analysis-actions .el-button { flex: 1; }

.save-work-btn {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: #1a202c;
  color: white;
  border: none;
  padding: 8px 18px;
  border-radius: 18px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 10;
}
.save-work-btn:hover { background: #2d3748; }
.save-work-btn.saving { background: #718096; }

.collapse-left {
  position: absolute;
  left: 220px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 40px;
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-left: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  color: #a0aec0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  transition: left 0.2s;
}
.left-panel.collapsed ~ .collapse-left { left: 0; }
.collapse-left:hover { background: #f7f8fa; color: #4a5568; }

/* ===== 中间编辑区 ===== */
.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  min-width: 0;
}
.chapter-head {
  padding: 18px 32px 12px;
  border-bottom: 1px solid #f1f2f5;
}
.chapter-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.chapter-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1a202c;
  flex: 1;
  outline: none;
  padding: 2px 4px;
  border-radius: 4px;
}
.chapter-title:hover { background: #f7fafc; }
.chapter-title:focus { background: #f7fafc; box-shadow: 0 0 0 2px #e6f0ff; }
.chapter-actions {
  display: flex;
  gap: 2px;
}
.chap-icon {
  border: none;
  background: transparent;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: #718096;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.chap-icon:hover { background: #edf2f7; color: #2d3748; }

.summary-card {
  background: #f0f7ff;
  border: 1px solid #d6e8ff;
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.summary-left {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
}
.summary-right {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.summary-content {
  flex-basis: 100%;
  color: #4a5568;
  font-size: 13px;
  line-height: 1.6;
  padding-top: 6px;
  border-top: 1px dashed #d6e8ff;
}

.write-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 32px;
  border-bottom: 1px solid #f1f2f5;
  flex-wrap: wrap;
}
.tb-btn {
  border: none; background: transparent;
  padding: 4px 8px; border-radius: 4px;
  cursor: pointer; color: #4a5568;
  font-size: 13px; min-width: 28px;
  display: inline-flex; align-items: center; justify-content: center;
}
.tb-btn:hover { background: #edf2f7; color: #1a202c; }
.tb-btn.active { background: #e6f0ff; color: #2563eb; }
.tb-sep { width: 1px; height: 16px; background: #e2e8f0; margin: 0 4px; }

.write-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 24px 0;
}
.tiptap-content {
  max-width: 760px;
  width: 100%;
  padding: 0 48px;
  font-size: 16px;
  line-height: 2;
  color: #1a202c;
  outline: none;
}
.tiptap-content :deep(p) { margin: 0 0 1em; }
.tiptap-content :deep(h2) { font-size: 22px; margin: 1.5em 0 0.6em; }
.tiptap-content :deep(h3) { font-size: 18px; margin: 1.2em 0 0.5em; }
.tiptap-content :deep(blockquote) {
  border-left: 3px solid #2563eb;
  padding-left: 14px; margin: 1em 0;
  color: #4a5568; font-style: italic;
}
.tiptap-content :deep(p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: #a0aec0; pointer-events: none; float: left; height: 0;
}

.editor-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 32px;
  border-top: 1px solid #f1f2f5;
  background: #fafbfc;
  font-size: 12px;
}
.save-status { margin-left: auto; }
.save-status.saving { color: #dd6b20; }
.save-status.saved { color: #38a169; }

/* ===== 右侧 AI 对话面板 ===== */
.right-panel {
  width: 340px;
  border-left: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  flex-shrink: 0;
}
.chat-display {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  height: 100%;
}
.chat-bubble-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #e6f0ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 14px;
}
.chat-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 8px;
}
.chat-empty-tip {
  font-size: 12px;
  color: #718096;
  line-height: 1.6;
  margin: 2px 0;
}
.hint-code {
  background: #f1f2f5;
  padding: 1px 6px;
  border-radius: 3px;
  font-family: monospace;
  color: #2563eb;
  font-weight: 600;
}
.billing-link {
  margin-top: 12px;
  font-size: 11px;
  color: #a0aec0;
  text-decoration: underline;
}

.chat-list { display: flex; flex-direction: column; gap: 12px; }
.chat-msg {
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
}
.chat-msg.user {
  background: #e6f0ff;
  color: #2d3748;
  margin-left: 20px;
}
.chat-msg.assistant {
  background: #f7fafc;
  color: #2d3748;
  margin-right: 20px;
  border: 1px solid #edf2f7;
}
.chat-msg-role {
  font-size: 11px;
  color: #718096;
  margin-bottom: 4px;
  font-weight: 600;
}
.chat-msg-content {
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-msg-content.streaming { color: #4a5568; }
.chat-msg-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
}
.cursor { animation: blink 1s infinite; color: #2563eb; }
@keyframes blink { 50% { opacity: 0; } }

.link-section {
  border-top: 1px solid #f1f2f5;
  padding: 8px 12px;
}
.link-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.linked-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.input-area {
  border-top: 1px solid #f1f2f5;
  padding: 10px 12px 6px;
  position: relative;
}
.chat-input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  font-family: inherit;
  outline: none;
  background: #ffffff;
  color: #1a202c;
}
.chat-input:focus { border-color: #2563eb; box-shadow: 0 0 0 2px #e6f0ff; }

.slash-menu {
  position: absolute;
  bottom: 100%;
  left: 12px;
  right: 12px;
  max-height: 280px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 -4px 16px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  margin-bottom: 4px;
  z-index: 100;
}
.slash-menu-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f2f5;
  font-size: 12px;
  color: #718096;
  font-weight: 600;
}
.slash-menu-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}
.slash-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.slash-menu-item:hover { background: #f7fafc; }
.slash-icon { color: #2563eb; font-size: 16px; }
.slash-item-body { flex: 1; min-width: 0; }
.slash-item-name { font-size: 13px; color: #2d3748; font-weight: 500; }
.slash-item-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slash-empty { padding: 20px; text-align: center; }

.input-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px 10px;
  gap: 8px;
}
.input-bottom-left {
  display: flex;
  gap: 6px;
}
.input-bottom-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.screenshot-hint { color: #cbd5e0; }
.send-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #2563eb;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.send-btn:hover:not(:disabled) { background: #1e40af; }
.send-btn:disabled { background: #cbd5e0; cursor: not-allowed; }

/* ===== 历史抽屉 ===== */
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item {
  padding: 10px 12px;
  background: #f7fafc;
  border-radius: 6px;
  cursor: pointer;
}
.history-item:hover { background: #edf2f7; }
.history-title { font-size: 13px; color: #2d3748; font-weight: 500; }
.history-time { margin-top: 2px; }
</style>
