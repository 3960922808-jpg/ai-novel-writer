<template>
  <div class="tools-page" v-if="project">
    <header class="page-head">
      <div>
        <h1>文本工具箱</h1>
        <p>压缩正文、清理格式、扫描关注词，并跨章节搜索替换。所有覆盖操作都会先建立版本快照。</p>
      </div>
      <el-select v-model="selectedChapterId" class="chapter-select" placeholder="选择章节">
        <el-option v-for="item in chapters" :key="item.id" :label="`第${item.order}章 · ${item.title}`" :value="item.id" />
      </el-select>
    </header>

    <el-tabs v-model="activeTab" class="tools-tabs">
      <el-tab-pane label="智能压缩" name="compress">
        <div class="two-column">
          <section class="tool-card">
            <div class="card-title"><span>原始文本</span><small>{{ sourceWords }} 字</small></div>
            <el-input v-model="sourceText" type="textarea" :rows="20" resize="none" placeholder="选择章节后自动载入，也可以粘贴任意文本" />
          </section>
          <section class="tool-card result-card">
            <div class="card-title"><span>压缩结果</span><small>{{ resultWords }} 字 · {{ compressionLabel }}</small></div>
            <el-input v-model="resultText" type="textarea" :rows="20" resize="none" placeholder="压缩结果会显示在这里，可继续手动修改" />
          </section>
        </div>
        <div class="action-bar capsule-bar">
          <span class="action-label">保留比例</span>
          <el-segmented v-model="compressionRatio" :options="ratioOptions" />
          <el-select v-model="selectedModel" placeholder="选择模型" class="model-select">
            <el-option v-for="item in availableModels" :key="`${item.provider}:${item.model}`" :label="`${item.model} · ${item.provider}`" :value="item.model" />
          </el-select>
          <el-checkbox v-model="preserveDialogue">优先保留对话</el-checkbox>
          <el-checkbox v-model="preserveStyle">保留原文语气</el-checkbox>
          <el-button type="primary" round :loading="compressing" :disabled="!sourceText.trim()" @click="compressText">开始压缩</el-button>
          <el-button round :disabled="!resultText.trim()" @click="saveResultToChapter">覆盖所选章节</el-button>
          <el-button round :disabled="!resultText.trim()" @click="copyResult">复制结果</el-button>
        </div>
        <el-progress v-if="compressing" :percentage="compressProgress" :stroke-width="10" striped striped-flow />
      </el-tab-pane>

      <el-tab-pane label="文本清理" name="clean">
        <div class="two-column">
          <section class="tool-card">
            <div class="card-title"><span>待清理文本</span><small>{{ sourceWords }} 字</small></div>
            <el-input v-model="sourceText" type="textarea" :rows="20" resize="none" />
          </section>
          <section class="tool-card result-card">
            <div class="card-title"><span>清理预览</span><small>{{ resultWords }} 字</small></div>
            <el-input v-model="resultText" type="textarea" :rows="20" resize="none" />
          </section>
        </div>
        <div class="option-grid">
          <el-checkbox v-model="cleanOptions.trimLines">清除行首行尾空格</el-checkbox>
          <el-checkbox v-model="cleanOptions.normalizeBlankLines">合并多余空行</el-checkbox>
          <el-checkbox v-model="cleanOptions.normalizePunctuation">统一中文标点</el-checkbox>
          <el-checkbox v-model="cleanOptions.removeDuplicateParagraphs">删除完全重复段落</el-checkbox>
        </div>
        <div class="action-bar">
          <el-button type="primary" round :disabled="!sourceText.trim()" @click="previewClean">生成清理预览</el-button>
          <el-button round :disabled="!resultText.trim()" @click="saveResultToChapter">覆盖所选章节</el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane label="项目搜索替换" name="replace">
        <section class="tool-card search-card">
          <div class="search-row">
            <el-input v-model="searchText" clearable placeholder="搜索内容" @keyup.enter="scanProject" />
            <el-input v-model="replacementText" clearable placeholder="替换为（可留空）" />
            <el-button type="primary" round @click="scanProject">扫描全部章节</el-button>
            <el-button type="danger" plain round :disabled="totalMatches === 0" @click="replaceProject">批量替换</el-button>
          </div>
          <div class="search-options">
            <el-checkbox v-model="regexSearch">使用正则表达式</el-checkbox>
            <el-checkbox v-model="caseSensitive">区分大小写</el-checkbox>
            <span class="result-summary">{{ searchSummary }}</span>
          </div>
        </section>
        <section class="tool-card result-list-card">
          <el-empty v-if="searchResults.length === 0" description="输入关键词后扫描项目" />
          <div v-for="item in searchResults" :key="item.chapter.id" class="chapter-result">
            <div class="result-head">
              <strong>第{{ item.chapter.order }}章 · {{ item.chapter.title }}</strong>
              <el-tag round>{{ item.matches.length }} 处</el-tag>
            </div>
            <div v-for="(match, index) in item.matches.slice(0, 5)" :key="`${match.index}:${index}`" class="match-line">
              <span>第 {{ match.line }} 行</span>{{ match.snippet }}
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="关注词扫描" name="terms">
        <section class="tool-card">
          <div class="card-title"><span>自定义关注词</span><small>每行一个，也支持逗号分隔；列表仅保存在本机</small></div>
          <el-input v-model="termInput" type="textarea" :rows="5" placeholder="待补充&#10;TODO&#10;需要留意的词" />
          <div class="action-bar">
            <el-radio-group v-model="termScope">
              <el-radio-button value="chapter">当前章节</el-radio-button>
              <el-radio-button value="project">整部小说</el-radio-button>
            </el-radio-group>
            <el-button type="primary" round @click="runTermScan">开始扫描</el-button>
          </div>
        </section>
        <section class="tool-card result-list-card">
          <el-empty v-if="termResults.length === 0" description="没有发现关注词，或尚未开始扫描" />
          <div v-for="item in termResults" :key="`${item.chapterTitle}:${item.term}`" class="term-result">
            <el-tag type="warning" round>{{ item.term }} · {{ item.count }}</el-tag>
            <strong>{{ item.chapterTitle }}</strong>
            <span>{{ item.snippets.join('　｜　') }}</span>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="版本快照" name="versions">
        <section class="tool-card result-list-card">
          <div class="card-title"><span>《{{ selectedChapter?.title || '未选择章节' }}》的历史版本</span><small>文本工具覆盖正文前会自动创建</small></div>
          <el-empty v-if="versions.length === 0" description="当前章节还没有版本快照" />
          <div v-for="version in versions" :key="version.id" class="version-row">
            <div>
              <strong>{{ version.label || '自动快照' }}</strong>
              <p>{{ formatDate(version.createdAt) }} · {{ version.wordCount }} 字</p>
            </div>
            <el-button round @click="restoreVersion(version)">恢复此版本</el-button>
          </div>
        </section>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as db from '@/services/db'
import * as ai from '@/services/ai'
import { cleanText, findTextMatches, htmlToPlainText, plainTextToHtml, replaceText, scanTerms, type TextCleanOptions, type TextMatch } from '@/services/text-tools'
import type { Chapter, ChapterVersion } from '@/types'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const project = computed(() => projectStore.current)
const chapters = computed(() => projectStore.chapters)
const activeTab = ref('compress')
const selectedChapterId = ref('')
const sourceText = ref('')
const resultText = ref('')
const compressionRatio = ref(60)
const preserveDialogue = ref(true)
const preserveStyle = ref(true)
const compressing = ref(false)
const compressProgress = ref(0)
const selectedModel = ref('')
const ratioOptions = [
  { label: '轻压 80%', value: 80 },
  { label: '标准 60%', value: 60 },
  { label: '深压 40%', value: 40 },
  { label: '梗概 20%', value: 20 }
]
const cleanOptions = reactive<TextCleanOptions>({
  trimLines: true,
  normalizeBlankLines: true,
  normalizePunctuation: true,
  removeDuplicateParagraphs: true
})
const searchText = ref('')
const replacementText = ref('')
const regexSearch = ref(false)
const caseSensitive = ref(false)
const searchResults = ref<Array<{ chapter: Chapter; matches: TextMatch[] }>>([])
const termInput = ref(localStorage.getItem('trmwrite:text-tools:terms') || '待补充\nTODO\nXXX\n某某\n总而言之\n值得注意的是')
const termScope = ref<'chapter' | 'project'>('chapter')
const termResults = ref<Array<{ chapterTitle: string; term: string; count: number; snippets: string[] }>>([])
const versions = ref<ChapterVersion[]>([])

const sourceWords = computed(() => ai.countWords(sourceText.value))
const resultWords = computed(() => ai.countWords(resultText.value))
const availableModels = computed(() => settingsStore.availableModels())
const totalMatches = computed(() => searchResults.value.reduce((sum, item) => sum + item.matches.length, 0))
const searchSummary = computed(() => totalMatches.value ? `在 ${searchResults.value.length} 个章节中找到 ${totalMatches.value} 处` : '尚未发现匹配内容')
const compressionLabel = computed(() => {
  if (!sourceWords.value || !resultWords.value) return '等待生成'
  return `实际保留 ${Math.round(resultWords.value / sourceWords.value * 100)}%`
})
const selectedChapter = computed(() => chapters.value.find(item => item.id === selectedChapterId.value) || null)

watch(selectedChapterId, loadSelectedChapter)
watch(activeTab, () => {
  if (activeTab.value === 'clean') resultText.value = ''
})

onMounted(async () => {
  if (!settingsStore.settings) await settingsStore.load()
  selectedModel.value = project.value?.settings.model || settingsStore.defaultModel()
  selectedChapterId.value = chapters.value[0]?.id || ''
})

async function loadSelectedChapter() {
  const chapter = chapters.value.find(item => item.id === selectedChapterId.value)
  if (!chapter) return
  sourceText.value = htmlToPlainText(chapter.content)
  resultText.value = ''
  searchResults.value = []
  termResults.value = []
  versions.value = await db.Versions.list(chapter.id)
}

function splitForAI(text: string, maxLength = 10_000): string[] {
  if (text.length <= maxLength) return [text]
  const paragraphs = text.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxLength) {
      chunks.push(current)
      current = ''
    }
    if (paragraph.length > maxLength) {
      if (current) chunks.push(current)
      for (let i = 0; i < paragraph.length; i += maxLength) chunks.push(paragraph.slice(i, i + maxLength))
    } else {
      current += `${current ? '\n\n' : ''}${paragraph}`
    }
  }
  if (current) chunks.push(current)
  return chunks
}

async function compressText() {
  const model = selectedModel.value || settingsStore.defaultModel()
  const provider = settingsStore.findProviderForModel(model)
  if (!provider?.apiKey || !model) {
    ElMessage.warning('请先在设置中配置可用的模型和接口密钥')
    return
  }
  const chunks = splitForAI(sourceText.value)
  compressing.value = true
  compressProgress.value = 0
  resultText.value = ''
  try {
    const outputs: string[] = []
    for (let index = 0; index < chunks.length; index++) {
      const part = chunks[index]
      const targetWords = Math.max(80, Math.round(ai.countWords(part) * compressionRatio.value / 100))
      const system = `你是小说文字压缩编辑。把原文压缩到约 ${compressionRatio.value}% 的长度，同时严格保留人物、因果、关键动作、重要信息、伏笔和转折。不得新增事实，不得写解释或标题，直接输出压缩后的正文。${preserveDialogue.value ? '有推动剧情或表现人物关系的对话应优先保留。' : '对话可以转述合并。'}${preserveStyle.value ? '尽量保留原文叙事视角、语气和语言风格。' : '语言以准确、紧凑为先。'}`
      const output = await ai.chat(ai.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `目标约 ${targetWords} 字。原文如下：\n\n${part}` }
        ],
        temperature: 0.35,
        maxTokens: Math.min(8192, Math.max(1000, targetWords * 2))
      }))
      outputs.push(output.trim())
      resultText.value = outputs.join('\n\n')
      compressProgress.value = Math.round((index + 1) / chunks.length * 100)
    }
    ElMessage.success(`压缩完成：${sourceWords.value} 字 → ${resultWords.value} 字`)
  } catch (error: any) {
    ElMessage.error(`压缩失败：${error?.message || error}`)
  } finally {
    compressing.value = false
  }
}

function previewClean() {
  resultText.value = cleanText(sourceText.value, cleanOptions)
  ElMessage.success('清理预览已生成，确认无误后再覆盖章节')
}

async function createSnapshot(chapter: Chapter, label: string) {
  await db.Versions.save({
    chapterId: chapter.id,
    content: chapter.content,
    wordCount: chapter.wordCount,
    label,
    createdAt: Date.now()
  })
  versions.value = await db.Versions.list(chapter.id)
}

function formatDate(value: number) {
  return new Date(value || Date.now()).toLocaleString('zh-CN', { hour12: false })
}

async function restoreVersion(version: ChapterVersion) {
  const chapter = selectedChapter.value
  if (!chapter) return
  try {
    await ElMessageBox.confirm(`恢复“${version.label || '历史快照'}”会覆盖当前正文，当前内容也会先建立一个快照。`, '确认恢复版本', {
      confirmButtonText: '建立快照并恢复', cancelButtonText: '取消', type: 'warning'
    })
    await createSnapshot(chapter, '恢复历史版本前')
    const updated = await db.Chapters.save({
      ...chapter,
      content: version.content,
      wordCount: version.wordCount,
      updatedAt: Date.now()
    })
    const index = projectStore.chapters.findIndex(item => item.id === chapter.id)
    if (index >= 0) projectStore.chapters[index] = updated
    sourceText.value = htmlToPlainText(updated.content)
    resultText.value = ''
    versions.value = await db.Versions.list(chapter.id)
    ElMessage.success('历史版本已恢复')
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(`恢复失败：${error?.message || error}`)
  }
}

async function saveResultToChapter() {
  const chapter = chapters.value.find(item => item.id === selectedChapterId.value)
  if (!chapter || !resultText.value.trim()) return
  await ElMessageBox.confirm(`将用当前结果覆盖《${chapter.title}》，原文会保存到时光机。`, '确认覆盖章节', {
    confirmButtonText: '建立快照并覆盖', cancelButtonText: '取消', type: 'warning'
  })
  try {
    await createSnapshot(chapter, activeTab.value === 'compress' ? '文本压缩前' : '文本清理前')
    const updated = await db.Chapters.save({
      ...chapter,
      content: plainTextToHtml(resultText.value.trim()),
      wordCount: ai.countWords(resultText.value),
      updatedAt: Date.now()
    })
    const index = projectStore.chapters.findIndex(item => item.id === chapter.id)
    if (index >= 0) projectStore.chapters[index] = updated
    sourceText.value = resultText.value.trim()
    ElMessage.success('章节已更新，原文已保存到时光机')
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(`保存失败：${error?.message || error}`)
  }
}

async function copyResult() {
  await navigator.clipboard.writeText(resultText.value)
  ElMessage.success('已复制压缩结果')
}

function scanProject() {
  if (!searchText.value) {
    searchResults.value = []
    return
  }
  try {
    searchResults.value = chapters.value.map(chapter => ({
      chapter,
      matches: findTextMatches(htmlToPlainText(chapter.content), searchText.value, { regex: regexSearch.value, caseSensitive: caseSensitive.value })
    })).filter(item => item.matches.length > 0)
  } catch (error: any) {
    searchResults.value = []
    ElMessage.error(`搜索表达式无效：${error?.message || error}`)
  }
}

async function replaceProject() {
  if (!totalMatches.value) return
  await ElMessageBox.confirm(`将在 ${searchResults.value.length} 个章节中替换 ${totalMatches.value} 处内容。每章都会先建立版本快照。`, '确认批量替换', {
    confirmButtonText: '建立快照并替换', cancelButtonText: '取消', type: 'warning'
  })
  try {
    for (const item of searchResults.value) {
      const original = htmlToPlainText(item.chapter.content)
      const replaced = replaceText(original, searchText.value, replacementText.value, { regex: regexSearch.value, caseSensitive: caseSensitive.value })
      if (replaced === original) continue
      await createSnapshot(item.chapter, `批量替换前：${searchText.value.slice(0, 24)}`)
      await db.Chapters.save({
        ...item.chapter,
        content: plainTextToHtml(replaced),
        wordCount: ai.countWords(replaced),
        updatedAt: Date.now()
      })
    }
    await projectStore.reloadChapters()
    loadSelectedChapter()
    searchResults.value = []
    ElMessage.success('批量替换完成，原文均已保存到时光机')
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(`替换失败：${error?.message || error}`)
  }
}

function parseTerms() {
  return termInput.value.split(/[\n,，、]+/).map(item => item.trim()).filter(Boolean)
}

function runTermScan() {
  const terms = parseTerms()
  localStorage.setItem('trmwrite:text-tools:terms', termInput.value)
  const targets = termScope.value === 'project'
    ? chapters.value
    : chapters.value.filter(item => item.id === selectedChapterId.value)
  termResults.value = targets.flatMap(chapter => scanTerms(htmlToPlainText(chapter.content), terms).map(item => ({
    chapterTitle: `第${chapter.order}章 · ${chapter.title}`,
    term: item.term,
    count: item.count,
    snippets: item.matches.slice(0, 3).map(match => match.snippet)
  })))
  ElMessage.success(termResults.value.length ? `发现 ${termResults.value.reduce((sum, item) => sum + item.count, 0)} 处关注词` : '没有发现关注词')
}
</script>

<style scoped>
.tools-page{height:100%;overflow:auto;padding:24px;background:var(--bg)}
.page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:18px}
.page-head h1{margin:0 0 7px;font-size:24px}.page-head p{margin:0;color:var(--text-2);font-size:13px;line-height:1.7}
.chapter-select{width:300px;flex:none}.tools-tabs{min-height:0}
.two-column{display:grid;grid-template-columns:1fr 1fr;gap:16px}.tool-card{padding:16px;border:1px solid var(--border);border-radius:20px;background:var(--panel);box-shadow:var(--shadow)}
.result-card{border-color:rgba(var(--primary-rgb),.35)}.card-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-weight:600}.card-title small{font-weight:400;color:var(--text-3)}
.action-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px;padding:14px 16px;border:1px solid var(--border);border-radius:18px;background:var(--panel)}
.capsule-bar{border-radius:999px}.action-label{font-size:13px;color:var(--text-2)}.model-select{width:220px}.option-grid{display:flex;gap:20px;flex-wrap:wrap;margin-top:16px;padding:14px 18px;border-radius:18px;background:var(--panel);border:1px solid var(--border)}
.el-progress{margin-top:14px}.search-card{margin-bottom:16px}.search-row{display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) auto auto;gap:12px}.search-options{display:flex;align-items:center;gap:18px;margin-top:13px}.result-summary{margin-left:auto;color:var(--text-2);font-size:13px}
.result-list-card{display:flex;flex-direction:column;gap:10px;min-height:220px}.chapter-result{padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--bg)}.result-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.match-line{padding:6px 0;color:var(--text-2);font-size:13px;border-top:1px dashed var(--border)}.match-line span{display:inline-block;min-width:72px;color:var(--primary)}
.term-result{display:grid;grid-template-columns:auto 190px 1fr;align-items:start;gap:12px;padding:12px;border-bottom:1px solid var(--border);font-size:13px}.term-result span{color:var(--text-2);line-height:1.7}
.version-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--bg)}.version-row p{margin:5px 0 0;color:var(--text-3);font-size:12px}
@media(max-width:1100px){.two-column{grid-template-columns:1fr}.capsule-bar{border-radius:18px}.search-row{grid-template-columns:1fr 1fr}.page-head{flex-direction:column}.chapter-select{width:100%}.term-result{grid-template-columns:auto 1fr}.term-result span{grid-column:1/-1}}
</style>
