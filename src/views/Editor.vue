<template>
  <div class="editor-page" v-if="project && chapter">
    <!-- 顶部工具条 -->
    <div class="topbar">
      <div class="left">
        <el-select v-model="currentChapterId" size="small" style="width: 220px" @change="switchChapter">
          <el-option
            v-for="c in projectStore.chapters" :key="c.id"
            :label="`第${c.order}章 · ${c.title}`" :value="c.id"
          />
        </el-select>
        <el-button-group size="small">
          <el-button :icon="ArrowLeft" :disabled="!prevChapter" @click="goChapter(prevChapter!)" />
          <el-button :icon="ArrowRight" :disabled="!nextChapter" @click="goChapter(nextChapter!)" />
        </el-button-group>
        <el-input v-model="chapter.title" size="small" style="width: 240px" @change="save" placeholder="章节标题" />
      </div>
      <div class="center">
        <span class="word-count" :class="{ warn: !wordCount }">{{ wordCount }} 字</span>
        <span class="save-status" :class="saveStatusClass">{{ saveStatusText }}</span>
      </div>
      <div class="right">
        <el-tooltip content="插入到下一章" placement="bottom">
          <el-button size="small" :icon="Plus" @click="newChapterAfter" />
        </el-tooltip>
        <el-tooltip content="章节设置" placement="bottom">
          <el-button size="small" :icon="Setting" @click="chapterSettingsVisible = true" />
        </el-tooltip>
        <el-tooltip :content="aiPanelVisible ? '隐藏 AI 面板' : '显示 AI 面板'" placement="bottom">
          <el-button size="small" :icon="MagicStick" :type="aiPanelVisible ? 'primary' : ''" @click="aiPanelVisible = !aiPanelVisible" />
        </el-tooltip>
      </div>
    </div>

    <!-- 编辑器 + AI 面板 -->
    <div class="editor-body">
      <!-- 编辑区域 -->
      <div class="editor-area">
        <!-- 工具条 -->
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
          <button class="tb-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" title="无序列表"><el-icon><List /></el-icon></button>
          <span class="tb-sep"></span>
          <button class="tb-btn" @click="editor.chain().focus().setHardBreak().run()" title="换行"><el-icon><Sort /></el-icon></button>
        </div>

        <!-- 写作区 -->
        <div class="write-scroll" :style="{ fontFamily: editorFont }">
          <editor-content :editor="editor" class="tiptap-content" v-if="editor" />
        </div>

        <!-- 底部状态条 -->
        <div class="editor-footer">
          <div class="footer-left">
            <el-tag size="small" effect="plain">{{ chapter.status }}</el-tag>
            <span class="text-faint text-xs">字数 {{ wordCount }}</span>
            <span class="text-faint text-xs" v-if="chapter.summary">已生成摘要</span>
          </div>
          <div class="footer-right">
            <el-button text size="small" @click="aiPanelVisible = true">AI 续写 →</el-button>
          </div>
        </div>
      </div>

      <!-- AI 助手面板 -->
      <transition name="slide">
        <div class="ai-panel" v-if="aiPanelVisible">
          <div class="ai-header">
            <h3>AI 助手</h3>
            <el-button text :icon="Close" @click="aiPanelVisible = false" />
          </div>

          <!-- 上下文预览 -->
          <div class="ctx-section">
            <div class="ctx-title">
              <span>上下文</span>
              <el-button text size="small" @click="ctxExpanded = !ctxExpanded">{{ ctxExpanded ? '收起' : '展开' }}</el-button>
            </div>
            <div class="ctx-info" v-if="!ctxExpanded">
              <el-tag size="small" effect="plain">前 {{ ctxChaptersCount }} 章</el-tag>
              <el-tag size="small" effect="plain">{{ ctxCharsCount }} 角色</el-tag>
              <el-tag size="small" effect="plain">{{ ctxLoreCount }} 设定</el-tag>
            </div>
            <div v-else class="ctx-detail">
              <p class="text-faint text-xs">摘要：{{ contextSummary.slice(0, 200) }}{{ contextSummary.length > 200 ? '...' : '' }}</p>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="action-grid">
            <button class="action-btn" @click="runAction('continue')">
              <el-icon><MagicStick /></el-icon><span>续写</span>
            </button>
            <button class="action-btn" @click="runAction('polish')">
              <el-icon><Brush /></el-icon><span>润色</span>
            </button>
            <button class="action-btn" @click="runAction('expand')">
              <el-icon><FullScreen /></el-icon><span>扩写</span>
            </button>
            <button class="action-btn" @click="runAction('rewrite')">
              <el-icon><EditPen /></el-icon><span>重写</span>
            </button>
            <button class="action-btn" @click="runAction('condense')">
              <el-icon><Minus /></el-icon><span>缩写</span>
            </button>
            <button class="action-btn" @click="runAction('summary')">
              <el-icon><Document /></el-icon><span>摘要</span>
            </button>
          </div>

          <!-- 自定义指令 -->
          <div class="custom-prompt">
            <el-input
              v-model="customInstruction"
              type="textarea" :rows="2"
              placeholder="自定义指令：例如「用第一人称改写」，或选择下方提示词..."
              size="small"
            />
            <el-select v-model="selectedPromptId" placeholder="选择提示词模板" size="small" style="margin-top:6px; width:100%" filterable>
              <el-option-group label="内置">
                <el-option v-for="p in builtinPrompts" :key="p.id" :label="p.title" :value="p.id" />
              </el-option-group>
              <el-option-group label="项目">
                <el-option v-for="p in projectPrompts" :key="p.id" :label="p.title" :value="p.id" />
              </el-option-group>
            </el-select>
            <el-button type="primary" size="small" :icon="Promotion" :loading="generating" :disabled="!canRunCustom()" @click="runCustom" style="margin-top:6px; width:100%">
              执行
            </el-button>
          </div>

          <!-- 参数 -->
          <div class="params">
            <div class="param-row">
              <span class="param-label">模型</span>
              <el-select v-model="aiModel" size="small" style="flex:1">
                <el-option v-for="m in models" :key="m.model" :label="`${m.provider}/${m.model}`" :value="m.model" />
              </el-select>
            </div>
            <div class="param-row">
              <span class="param-label">字数</span>
              <el-input-number v-model="aiWords" :min="100" :max="8000" :step="100" size="small" style="flex:1" />
            </div>
            <div class="param-row">
              <span class="param-label">温度</span>
              <el-slider v-model="aiTemp" :min="0" :max="1.5" :step="0.1" size="small" style="flex:1" />
            </div>
          </div>

          <!-- 输出区 -->
          <div class="output-section">
            <div class="output-header">
              <span>AI 输出</span>
              <div v-if="aiOutput" class="flex gap-2">
                <el-button text size="small" :icon="DocumentCopy" @click="copyOutput">复制</el-button>
                <el-button text size="small" type="primary" :icon="Plus" @click="appendOutput">追加到正文</el-button>
                <el-button text size="small" :icon="Refresh" @click="replaceSelection" title="替换选中文本">替换</el-button>
              </div>
            </div>
            <div class="output-area" v-loading="generating" element-loading-text="AI 创作中...">
              <div v-if="!aiOutput && !generating" class="empty-output">
                <el-icon class="empty-icon"><MagicStick /></el-icon>
                <p class="text-faint text-xs">选择操作开始创作</p>
              </div>
              <div v-else class="output-text">{{ aiOutput }}<span v-if="generating" class="cursor">▌</span></div>
            </div>
            <el-button v-if="generating" text size="small" type="danger" @click="stopGenerate" style="margin-top:6px">停止</el-button>
          </div>
        </div>
      </transition>
    </div>

    <!-- 章节设置 -->
    <el-dialog v-model="chapterSettingsVisible" title="章节设置" width="480px">
      <el-form label-width="80px">
        <el-form-item label="标题"><el-input v-model="chapter.title" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="chapter.status" style="width:100%">
            <el-option label="草稿" value="草稿" />
            <el-option label="完成" value="完成" />
            <el-option label="已发表" value="已发表" />
          </el-select>
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="chapter.summary" type="textarea" :rows="3" />
          <el-button size="small" :icon="MagicStick" :loading="generating" @click="runAction('summary'); chapterSettingsVisible=false" style="margin-top:6px">AI 生成</el-button>
        </el-form-item>
        <el-form-item label="作者备注">
          <el-input v-model="chapter.notes" type="textarea" :rows="2" placeholder="此处可记录本章的关键剧情节点、伏笔、待修改之处" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="chapterSettingsVisible = false">关闭</el-button>
        <el-button type="primary" @click="() => { save(); chapterSettingsVisible = false }">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, ArrowRight, Plus, Setting, MagicStick, Brush, FullScreen,
  EditPen, Minus, Document, Promotion, DocumentCopy, Refresh, Close,
  RefreshLeft, RefreshRight, ChatLineRound, List, Sort
} from '@element-plus/icons-vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as db from '@/services/db'
import * as aiSvc from '@/services/ai'
import type { Chapter, Prompt, AIAction } from '@/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)

const currentChapterId = ref(route.params.chapterId as string)
const chapter = ref<Chapter | null>(null)
const chapterSettingsVisible = ref(false)

const aiPanelVisible = ref(true)
const ctxExpanded = ref(false)
const generating = ref(false)
const aiOutput = ref('')
const aiModel = ref('')
const aiWords = ref(800)
const aiTemp = ref(0.8)
const customInstruction = ref('')
const selectedPromptId = ref('')
const builtinPrompts = ref<Prompt[]>([])
const projectPrompts = ref<Prompt[]>([])
const stopFlag = ref(false)

const editorFont = computed(() => settings.settings?.editorFont || '思源宋体, serif')

const models = computed(() => settings.availableModels())

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: '开始你的故事...' }),
    CharacterCount.configure({ limit: null })
  ],
  autofocus: 'end',
  onUpdate: () => {
    scheduleSave()
  }
})

const wordCount = computed(() => editor.value?.storage.characterCount.characters() || 0)

// 保存状态
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
    // 同步更新 store
    const idx = projectStore.chapters.findIndex(c => c.id === chapter.value!.id)
    if (idx >= 0) projectStore.chapters[idx] = { ...chapter.value }
    saveStatus.value = 'saved'
    setTimeout(() => { saveStatus.value = 'idle' }, 1500)
  } catch (e: any) {
    saveStatus.value = 'idle'
    ElMessage.error('保存失败：' + e.message)
  }
}

// ====== 章节切换 ======
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

async function switchChapter(id: string) {
  router.push({ name: 'editor', params: { chapterId: id } })
}

async function newChapterAfter() {
  if (!chapter.value || !project.value) return
  await save()
  const order = chapter.value.order + 1
  // 后续章节 order+1
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

// ====== 加载章节 ======
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
    // 加载提示词
    const all = await db.Prompts.list(project.value.id)
    builtinPrompts.value = all.filter(p => p.isBuiltIn)
    projectPrompts.value = all.filter(p => !p.isBuiltIn)
    // 加载编辑器内容
    if (editor.value) {
      editor.value.commands.setContent(target.content || '', false)
      await nextTick()
      editor.value.commands.focus('end')
    }
  } catch (e: any) {
    ElMessage.error('加载章节失败：' + e.message)
  }
}

// ====== 上下文构建 ======
const ctxChaptersCount = computed(() => {
  if (!chapter.value) return 0
  return projectStore.chapters.filter(c => c.order < chapter.value!.order).length
})
const ctxCharsCount = computed(() => projectStore.characters.length)
const ctxLoreCount = computed(() => projectStore.lore.length)

const contextSummary = computed(() => {
  if (!chapter.value) return ''
  const prev = projectStore.chapters
    .filter(c => c.order < chapter.value!.order)
    .sort((a, b) => a.order - b.order)
    .slice(-3)
  return prev.map(c => c.summary || `(第${c.order}章 ${c.title} 无摘要)`).join('\n')
})

function buildContext(): string {
  if (!chapter.value || !project.value) return ''
  const prevChapters = projectStore.chapters
    .filter(c => c.order < chapter.value!.order)
    .sort((a, b) => a.order - b.order)
  // 取最近 3 章摘要 + 当前章节末尾 1500 字
  const recentSummaries = prevChapters.slice(-3).map(c => `第${c.order}章《${c.title}》：${c.summary || '（无摘要）'}`).join('\n')
  const currentText = editor.value?.getText() || ''
  const tail = currentText.slice(-1500)
  // 角色与设定
  const chars = projectStore.characters.slice(0, 10).map(c => `${c.name}(${c.role})：${c.personality?.slice(0, 50) || ''}`).join('；')
  const lore = projectStore.lore.slice(0, 8).map(l => `${l.category}/${l.title}：${l.content?.slice(0, 60) || ''}`).join('；')
  return `【作品信息】\n类型：${project.value.genre}\n标题：${project.value.title}\n简介：${project.value.description}\n\n【前情摘要】\n${recentSummaries}\n\n【角色】${chars}\n\n【设定】${lore}\n\n【当前章节】\n第${chapter.value.order}章《${chapter.value.title}》\n${tail}`
}

// ====== AI 操作 ======
function getProvider() {
  const m = aiModel.value || project.value?.settings.model || ''
  return settings.findProviderForModel(m)
}

function canRunCustom() {
  return (customInstruction.value.trim() || selectedPromptId.value) && !generating.value
}

async function runAction(action: AIAction) {
  if (!chapter.value || !project.value || !editor.value) return
  const provider = getProvider()
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置 API Key')
    return
  }
  // 查找对应提示词
  const allPrompts = [...builtinPrompts.value, ...projectPrompts.value]
  const actionMap: Record<AIAction, string> = {
    continue: '续写', polish: '润色', rewrite: '重写',
    expand: '扩写', condense: '缩写', outline: '大纲',
    summary: '摘要', custom: ''
  }
  const tpl = allPrompts.find(p => p.category === actionMap[action])
  if (!tpl) {
    ElMessage.error('未找到对应提示词模板')
    return
  }
  // 取选中文本或全文末尾
  const { from, to } = editor.value.state.selection
  let selText = ''
  if (to > from) selText = editor.value.state.doc.textBetween(from, to, '\n')
  const fullText = editor.value.getText()
  const contentText = selText || fullText.slice(-2000)

  let userMsg: string
  if (action === 'continue') {
    const ctx = buildContext()
    userMsg = aiSvc.renderTemplate(tpl.content, {
      genre: project.value.genre,
      context: ctx,
      words: aiWords.value
    })
  } else if (action === 'summary') {
    userMsg = aiSvc.renderTemplate(tpl.content, { content: fullText })
  } else {
    userMsg = aiSvc.renderTemplate(tpl.content, {
      content: contentText,
      instruction: customInstruction.value || '保持原意，优化表达',
      genre: project.value.genre,
      title: project.value.title,
      words: aiWords.value
    })
  }
  await runAI(userMsg, action === 'summary')
}

async function runCustom() {
  if (!chapter.value || !project.value || !editor.value) return
  const provider = getProvider()
  if (!provider?.apiKey) { ElMessage.warning('请先在设置中配置 API Key'); return }
  const allPrompts = [...builtinPrompts.value, ...projectPrompts.value]
  let userMsg = ''
  if (selectedPromptId.value) {
    const tpl = allPrompts.find(p => p.id === selectedPromptId.value)
    if (tpl) {
      const { from, to } = editor.value!.state.selection
      const selText = to > from ? editor.value!.state.doc.textBetween(from, to, '\n') : ''
      const vars: Record<string, string> = {
        content: selText || editor.value!.getText().slice(-2000),
        context: buildContext(),
        genre: project.value.genre,
        title: project.value.title,
        setup: project.value.description,
        words: String(aiWords.value),
        instruction: customInstruction.value,
        count: String(aiWords.value / 100 | 0),
        characters: projectStore.characters.map(c => c.name).join('、'),
        scene: customInstruction.value,
        emotion: ''
      }
      userMsg = aiSvc.renderTemplate(tpl.content, vars)
    }
  } else {
    userMsg = `你是一位${project.value.genre}类型小说家。${customInstruction.value}\n\n前文：\n${buildContext()}\n\n请直接输出正文：`
  }
  await runAI(userMsg, false)
}

async function runAI(userMsg: string, isSummary = false) {
  if (!project.value) return
  const provider = getProvider()!
  generating.value = true
  aiOutput.value = ''
  stopFlag.value = false
  const sys: any = { role: 'system', content: `你是一位资深小说家，擅长${project.value.genre}类型创作。请直接输出正文内容，不要写"以下是续写"等说明性文字，不要使用 markdown 代码块。文风自然流畅，避免AI味。${project.value.settings.styleSample ? '\n参考文风：' + project.value.settings.styleSample : ''}` }
  try {
    const full = await aiSvc.streamChat(
      aiSvc.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: aiModel.value || project.value.settings.model,
        messages: [sys, { role: 'user', content: userMsg }],
        temperature: aiTemp.value,
        maxTokens: Math.min(4096, aiWords.value * 3)
      }),
      (chunk) => {
        if (stopFlag.value) return
        aiOutput.value += chunk
      }
    )
    if (isSummary && full) {
      if (chapter.value) {
        chapter.value.summary = full.trim()
        await db.Chapters.save(chapter.value)
      }
      ElMessage.success('摘要已生成')
      aiOutput.value = ''
    }
  } catch (e: any) {
    ElMessage.error('AI 调用失败：' + e.message)
  } finally {
    generating.value = false
  }
}

function stopGenerate() {
  stopFlag.value = true
  generating.value = false
}

function copyOutput() {
  navigator.clipboard.writeText(aiOutput.value)
  ElMessage.success('已复制')
}

function appendOutput() {
  if (!editor.value || !aiOutput.value) return
  editor.value.commands.focus('end')
  // 按段落插入
  const paras = aiOutput.value.split(/\n+/).filter(p => p.trim())
  for (const p of paras) {
    editor.value.commands.insertContent(`<p>${escapeHtml(p)}</p>`)
  }
  ElMessage.success('已追加到正文')
  aiOutput.value = ''
}

function replaceSelection() {
  if (!editor.value || !aiOutput.value) return
  const { from, to } = editor.value.state.selection
  if (to <= from) {
    ElMessage.warning('请先在正文中选中要替换的文字')
    return
  }
  editor.value.chain().focus().deleteSelection().insertContent(escapeHtml(aiOutput.value)).run()
  ElMessage.success('已替换')
  aiOutput.value = ''
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ====== 生命周期 ======
let autoSaveTimer: any = null
onMounted(async () => {
  try {
    if (!project.value) {
      await projectStore.loadProject(route.params.id as string)
    }
    await loadChapter(currentChapterId.value)
    if (!aiModel.value && models.value.length > 0) {
      aiModel.value = project.value?.settings.model || models.value[0].model
    }
    // 定时自动保存
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
.editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 12px;
}
.topbar .left, .topbar .right { display: flex; gap: 8px; align-items: center; }
.topbar .center { display: flex; gap: 12px; align-items: center; font-size: 12px; }
.word-count { color: var(--text-2); font-weight: 500; }
.word-count.warn { color: var(--warning); }
.save-status { color: var(--text-3); }
.save-status.saving { color: var(--warning); }
.save-status.saved { color: var(--success); }

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--panel);
}
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-2);
  flex-wrap: wrap;
}
.tb-btn {
  border: none; background: transparent;
  padding: 6px 10px; border-radius: 4px;
  cursor: pointer; color: var(--text-2);
  font-size: 13px; min-width: 32px;
  display: inline-flex; align-items: center; justify-content: center;
}
.tb-btn:hover { background: var(--panel); color: var(--text); }
.tb-btn.active { background: var(--primary-light); color: var(--primary); }
.tb-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }

.write-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 32px 0;
}
.tiptap-content {
  max-width: 760px;
  width: 100%;
  padding: 0 48px;
  font-size: 16px;
  line-height: 2;
  color: var(--text);
  outline: none;
}
.tiptap-content :deep(p) { margin: 0 0 1em; }
.tiptap-content :deep(h2) { font-size: 22px; margin: 1.5em 0 0.6em; }
.tiptap-content :deep(h3) { font-size: 18px; margin: 1.2em 0 0.5em; }
.tiptap-content :deep(blockquote) {
  border-left: 3px solid var(--primary);
  padding-left: 14px; margin: 1em 0;
  color: var(--text-2); font-style: italic;
}
.tiptap-content :deep(ul) { padding-left: 24px; }
.tiptap-content :deep(p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--text-3); pointer-events: none; float: left; height: 0;
}

.editor-footer {
  display: flex;
  justify-content: space-between;
  padding: 6px 16px;
  border-top: 1px solid var(--border);
  background: var(--panel-2);
  font-size: 12px;
}
.footer-left { display: flex; gap: 12px; align-items: center; }

/* AI 面板 */
.ai-panel {
  width: 360px;
  background: var(--panel);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}
.ai-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border);
}
.ai-header h3 { margin: 0; font-size: 15px; }
.ctx-section { padding: 10px 16px; border-bottom: 1px solid var(--border); }
.ctx-title { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-2); margin-bottom: 6px; }
.ctx-info { display: flex; gap: 4px; flex-wrap: wrap; }
.ctx-detail { font-size: 12px; line-height: 1.6; }

.action-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 6px; padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.action-btn {
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
  padding: 10px 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-2); font-size: 12px;
  transition: all 0.15s;
}
.action-btn:hover { background: var(--primary-light); color: var(--primary); border-color: var(--primary); }

.custom-prompt { padding: 10px 16px; border-bottom: 1px solid var(--border); }

.params { padding: 10px 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
.param-row { display: flex; align-items: center; gap: 8px; }
.param-label { font-size: 12px; color: var(--text-2); width: 36px; flex-shrink: 0; }

.output-section { flex: 1; display: flex; flex-direction: column; padding: 10px 16px; overflow: hidden; }
.output-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; color: var(--text-2); }
.output-area {
  flex: 1;
  overflow-y: auto;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
  font-size: 13px;
  line-height: 1.8;
  min-height: 120px;
}
.empty-output { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 6px; }
.empty-output .empty-icon { font-size: 28px; opacity: 0.3; }
.output-text { white-space: pre-wrap; word-break: break-word; }
.cursor { animation: blink 1s infinite; color: var(--primary); }
@keyframes blink { 50% { opacity: 0; } }

.slide-enter-active, .slide-leave-active { transition: all 0.2s; }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); opacity: 0; }
</style>
