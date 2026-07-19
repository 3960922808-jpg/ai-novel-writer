<template>
  <div class="home">
    <header class="home-header">
      <div>
        <h1 class="page-title">我的书架</h1>
        <p class="text-muted">基于 OpenWrite 理念的 AI 长篇小说创作工作台</p>
      </div>
      <div class="flex gap-2">
        <el-button :icon="themeIcon" circle @click="toggleTheme" :title="themeTip" />
        <el-button :icon="Setting" @click="$router.push('/settings')">设置</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建小说</el-button>
      </div>
    </header>

    <!-- 搜索 + 筛选栏 -->
    <div class="toolbar card">
      <div class="search-wrap">
        <el-icon class="search-icon"><Search /></el-icon>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索书名、简介或类型..."
        />
        <el-icon v-if="keyword" class="search-clear" @click="keyword = ''"><CircleClose /></el-icon>
      </div>
      <div class="filter-group">
        <el-select v-model="filterGenre" placeholder="全部类型" clearable size="small" style="width: 120px">
          <el-option v-for="g in genres" :key="g" :label="g" :value="g" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="全部状态" clearable size="small" style="width: 120px">
          <el-option label="草稿" value="草稿" />
          <el-option label="连载中" value="连载中" />
          <el-option label="已完结" value="已完结" />
          <el-option label="暂停" value="暂停" />
        </el-select>
        <el-radio-group v-model="sortBy" size="small">
          <el-radio-button label="updated">最近更新</el-radio-button>
          <el-radio-button label="created">创建时间</el-radio-button>
          <el-radio-button label="title">书名</el-radio-button>
        </el-radio-group>
      </div>
      <div class="count-tip text-faint text-xs">
        共 {{ filteredProjects.length }} / {{ projects.length }} 本
      </div>
    </div>

    <div v-loading="loading">
      <div v-if="projects.length === 0 && !loading" class="empty card">
        <el-icon class="empty-icon"><EditPen /></el-icon>
        <h3>开始你的第一本小说</h3>
        <p class="text-muted">从空白页面到完整长篇，AI 与你共同创作</p>
        <el-button type="primary" :icon="Plus" @click="openCreate" style="margin-top: 12px">创建项目</el-button>
      </div>

      <div v-else-if="filteredProjects.length === 0" class="empty card">
        <el-icon class="empty-icon"><Search /></el-icon>
        <h3>没有匹配的小说</h3>
        <p class="text-muted">换个关键词试试</p>
      </div>

      <div v-else class="grid grid-4">
        <div
          v-for="p in filteredProjects" :key="p.id"
          class="project-card card"
          @click="open(p.id)"
        >
          <div class="cover" :style="{ background: coverGradient(p) }">
            <span class="cover-title">{{ p.title }}</span>
            <span class="cover-genre">{{ p.genre }}</span>
            <span class="cover-status" :class="'status-' + statusClass(p.status)">{{ p.status }}</span>
          </div>
          <div class="card-body">
            <div class="flex justify-between items-center">
              <h3 class="proj-title">{{ p.title }}</h3>
              <el-dropdown trigger="click" @click.stop>
                <el-button text :icon="MoreFilled" @click.stop />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="open(p.id)">打开</el-dropdown-item>
                    <el-dropdown-item @click="exportProject(p)">导出</el-dropdown-item>
                    <el-dropdown-item divided @click="confirmDelete(p)">
                      <span style="color: var(--danger)">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <p class="desc">{{ p.description || '暂无简介' }}</p>
            <div class="meta">
              <el-tag size="small" effect="plain">{{ p.genre }}</el-tag>
              <span class="text-faint text-xs">{{ formatDate(p.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建项目对话框 -->
    <el-dialog v-model="createVisible" title="新建小说项目" width="520px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="例如：风起西凉" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.genre" placeholder="选择类型" style="width:100%">
            <el-option v-for="g in genres" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="一句话讲清故事核心" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="草稿" value="草稿" />
            <el-option label="连载中" value="连载中" />
            <el-option label="已完结" value="已完结" />
            <el-option label="暂停" value="暂停" />
          </el-select>
        </el-form-item>
        <el-form-item label="总字数">
          <el-input-number v-model="form.wordsTarget" :min="10000" :step="10000" style="width:100%" />
        </el-form-item>
        <el-form-item label="AI 模板">
          <el-select v-model="form.template" placeholder="可选模板" style="width:100%">
            <el-option label="空白项目" value="blank" />
            <el-option label="玄幻修仙" value="xuanhuan" />
            <el-option label="都市言情" value="urban" />
            <el-option label="科幻未来" value="scifi" />
            <el-option label="历史权谋" value="history" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="doCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Setting, MoreFilled, EditPen, Search, CircleClose, Sunny, Moon, Monitor } from '@element-plus/icons-vue'
import type { Project } from '@/types'
import * as db from '@/services/db'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const projects = ref<Project[]>([])
const loading = ref(false)

// 主题快捷切换
const settingsStore = useSettingsStore()
const themeIcon = computed(() => {
  const mode = settingsStore.settings?.themeMode || 'light'
  if (mode === 'auto') return Monitor
  return mode === 'dark' ? Moon : Sunny
})
const themeTip = computed(() => {
  const mode = settingsStore.settings?.themeMode || 'light'
  return mode === 'auto' ? '跟随系统（点击切换）' : mode === 'dark' ? '深色模式（点击切换）' : '浅色模式（点击切换）'
})
function toggleTheme() {
  const mode = settingsStore.settings?.themeMode || 'light'
  const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light'
  settingsStore.update({ themeMode: next })
  ElMessage.success(next === 'auto' ? '已切换：跟随系统' : next === 'dark' ? '已切换：深色模式' : '已切换：浅色模式')
}

// 搜索与筛选
const keyword = ref('')
const filterGenre = ref('')
const filterStatus = ref('')
const sortBy = ref<'updated' | 'created' | 'title'>('updated')

const genres = ['玄幻', '都市', '科幻', '言情', '历史', '悬疑', '武侠', '仙侠', '游戏', '体育', '军事', '现实']

const createVisible = ref(false)
const creating = ref(false)
const form = ref({
  title: '',
  genre: '玄幻',
  description: '',
  status: '草稿',
  wordsTarget: 200000,
  template: 'blank'
})

// 过滤 + 排序后的列表
const filteredProjects = computed(() => {
  let list = projects.value.slice()
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(p =>
      p.title.toLowerCase().includes(kw) ||
      (p.description || '').toLowerCase().includes(kw) ||
      (p.genre || '').toLowerCase().includes(kw)
    )
  }
  if (filterGenre.value) list = list.filter(p => p.genre === filterGenre.value)
  if (filterStatus.value) list = list.filter(p => p.status === filterStatus.value)
  if (sortBy.value === 'updated') list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  else if (sortBy.value === 'created') list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  else if (sortBy.value === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  return list
})

function statusClass(status: string) {
  if (status === '连载中') return 'active'
  if (status === '已完结') return 'done'
  if (status === '暂停') return 'pause'
  return 'draft'
}

onMounted(load)

async function load() {
  loading.value = true
  projects.value = await db.listProjects()
  loading.value = false
}

function open(id: string) {
  router.push(`/project/${id}/dashboard`)
}

function openCreate() {
  form.value = { title: '', genre: '玄幻', description: '', status: '草稿', wordsTarget: 200000, template: 'blank' }
  createVisible.value = true
}

async function doCreate() {
  if (!form.value.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  creating.value = true
  try {
    const settings = await db.getSettings()
    const p = await db.saveProject({
      title: form.value.title.trim(),
      genre: form.value.genre,
      description: form.value.description,
      status: form.value.status as Project['status'],
      tags: [],
      wordsTarget: form.value.wordsTarget,
      createdAt: 0,
      updatedAt: 0,
      settings: {
        model: settings.defaultModel,
        baseUrl: settings.defaultBaseUrl,
        apiKey: '',
        temperature: 0.8,
        maxTokens: 2048,
        topP: 1,
        criticModels: []
      }
    } as any)
    // 应用模板
    await applyTemplate(p.id, form.value.template, form.value.genre, form.value.title, form.value.description)
    ElMessage.success('创建成功')
    createVisible.value = false
    open(p.id)
  } catch (e: any) {
    ElMessage.error('创建失败：' + e.message)
  } finally {
    creating.value = false
  }
}

async function applyTemplate(pid: string, template: string, genre: string, title: string, desc: string) {
  if (template === 'blank') return
  // 内置世界观模板
  const templates: Record<string, { category: string; title: string; content: string }[]> = {
    xuanhuan: [
      { category: '力量体系', title: '修炼境界', content: '炼气 → 筑基 → 金丹 → 元婴 → 化神 → 炼虚 → 合体 → 大乘 → 渡劫' },
      { category: '世界设定', title: '世界格局', content: '九重天界，凡人界、修真界、仙界，请在此补充...' }
    ],
    urban: [
      { category: '社会背景', title: '城市设定', content: '现代都市，请补充主要城市、行业背景...' }
    ],
    scifi: [
      { category: '科技设定', title: '技术水平', content: '近未来 / 远未来 / 太空歌剧，请补充...' }
    ],
    history: [
      { category: '历史背景', title: '朝代设定', content: '请补充历史时期、主要势力...' }
    ]
  }
  const items = templates[template]
  if (items) {
    for (const item of items) {
      await db.Lore.save({ projectId: pid, category: item.category, title: item.title, content: item.content, tags: [] })
    }
  }
  // 默认第一章
  await db.Chapters.save({
    projectId: pid,
    title: '第一章',
    content: '',
    contentType: 'html',
    summary: '',
    status: '草稿',
    order: 1,
    wordCount: 0,
    notes: '',
    createdAt: 0,
    updatedAt: 0
  } as any)
}

function confirmDelete(p: Project) {
  ElMessageBox.confirm(`确定删除《${p.title}》？所有章节、角色、设定将一并删除，且无法恢复。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(async () => {
    await db.deleteProject(p.id)
    ElMessage.success('已删除')
    load()
  }).catch(() => {})
}

function exportProject(p: Project) {
  router.push(`/project/${p.id}/export`)
}

function coverGradient(p: Project) {
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4']
  let hash = 0
  for (let i = 0; i < p.title.length; i++) hash = (hash * 31 + p.title.charCodeAt(i)) | 0
  const a = colors[Math.abs(hash) % colors.length]
  const b = colors[Math.abs(hash >> 4) % colors.length]
  return `linear-gradient(135deg, ${a}, ${b})`
}

function formatDate(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 2592000000) return `${Math.floor(diff / 86400000)} 天前`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.home {
  height: 100vh;
  overflow: auto;
  padding: 28px 36px;
}
.home-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}
.home-header p { margin: 6px 0 0; font-size: 13px; }

/* 工具栏：搜索 + 筛选 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.search-wrap {
  position: relative;
  flex: 1;
  min-width: 240px;
  max-width: 360px;
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  font-size: 16px;
}
.search-input {
  width: 100%;
  height: 34px;
  padding: 0 36px 0 36px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: var(--panel-2);
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: all 0.15s;
}
.search-input:focus {
  border-color: var(--primary);
  background: var(--panel);
  box-shadow: 0 0 0 3px var(--primary-light);
}
.search-clear {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  cursor: pointer;
  font-size: 16px;
}
.search-clear:hover { color: var(--text); }
.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.count-tip {
  margin-left: auto;
  white-space: nowrap;
}

/* 项目卡片 */
.project-card {
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}
.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.12);
}
.project-card:hover .cover {
  filter: brightness(1.05);
}
.cover {
  height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  position: relative;
  transition: filter 0.2s;
}
.cover::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 60%);
  pointer-events: none;
}
.cover-title {
  font-size: 26px;
  font-weight: 700;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
  padding: 0 16px;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 1px;
}
.cover-genre {
  font-size: 12px;
  opacity: 0.95;
  margin-top: 8px;
  background: rgba(255,255,255,0.25);
  padding: 3px 12px;
  border-radius: 12px;
  backdrop-filter: blur(4px);
}
.cover-status {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(0,0,0,0.4);
  color: white;
  backdrop-filter: blur(4px);
}
.cover-status.status-active { background: rgba(16,185,129,0.85); }
.cover-status.status-done { background: rgba(59,130,246,0.85); }
.cover-status.status-pause { background: rgba(245,158,11,0.85); }
.cover-status.status-draft { background: rgba(0,0,0,0.4); }
.card-body { padding: 14px 16px; }
.proj-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.desc {
  margin: 6px 0 10px;
  font-size: 12px;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  min-height: 36px;
}
.meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 响应式：屏幕小时自动减少列数 */
@media (max-width: 1200px) {
  .home { padding: 20px 24px; }
}
@media (max-width: 900px) {
  .filter-group { width: 100%; }
}
</style>
