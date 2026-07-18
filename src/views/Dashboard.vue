<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ project.title }}</h1>
        <p class="text-muted text-sm">{{ project.description || '暂无简介' }}</p>
      </div>
      <el-button type="primary" :icon="Edit" :disabled="!latestChapterId" @click="$router.push({ name: 'editor', params: { chapterId: latestChapterId } })">
        继续写作
      </el-button>
    </div>

    <!-- 数据卡片 -->
    <div class="grid grid-4" style="margin-bottom: 20px">
      <div class="stat-card card">
        <div class="stat-label">总字数</div>
        <div class="stat-value">{{ totalWords.toLocaleString() }}</div>
        <div class="stat-bar">
          <div class="bar-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <div class="text-faint text-xs">目标 {{ project.wordsTarget.toLocaleString() }} 字（{{ progressPct }}%）</div>
      </div>
      <div class="stat-card card">
        <div class="stat-label">章节数</div>
        <div class="stat-value">{{ projectStore.chapterCount }}</div>
        <div class="text-faint text-xs">已完成 {{ completedChapters }} 章</div>
      </div>
      <div class="stat-card card">
        <div class="stat-label">角色数</div>
        <div class="stat-value">{{ projectStore.characters.length }}</div>
        <div class="text-faint text-xs">{{ projectStore.locations.length }} 个地点</div>
      </div>
      <div class="stat-card card">
        <div class="stat-label">今日写作</div>
        <div class="stat-value">{{ todayWords.toLocaleString() }}</div>
        <div class="text-faint text-xs">连续 {{ streak }} 天</div>
      </div>
    </div>

    <!-- 最近章节 -->
    <div class="grid grid-2">
      <div class="card" style="padding: 16px">
        <div class="flex justify-between items-center" style="margin-bottom: 12px">
          <h3 style="margin:0; font-size:15px">最近章节</h3>
          <el-button text size="small" @click="$router.push({ name: 'chapters' })">查看全部 →</el-button>
        </div>
        <div v-if="recentChapters.length === 0" class="empty" style="padding: 24px">
          <p class="text-faint">还没有章节，开始创作吧</p>
        </div>
        <div v-else>
          <div
            v-for="c in recentChapters" :key="c.id"
            class="chapter-row"
            @click="$router.push({ name: 'editor', params: { chapterId: c.id } })"
          >
            <div class="ch-info">
              <div class="ch-title">第{{ c.order }}章 · {{ c.title }}</div>
              <div class="ch-meta">
                <el-tag size="small" :type="statusType(c.status)" effect="plain">{{ c.status }}</el-tag>
                <span class="text-faint text-xs">{{ c.wordCount }} 字</span>
                <span class="text-faint text-xs">{{ formatTime(c.updatedAt) }}</span>
              </div>
            </div>
            <el-icon><ArrowRight /></el-icon>
          </div>
        </div>
      </div>

      <!-- 最近角色 -->
      <div class="card" style="padding: 16px">
        <div class="flex justify-between items-center" style="margin-bottom: 12px">
          <h3 style="margin:0; font-size:15px">主要角色</h3>
          <el-button text size="small" @click="$router.push({ name: 'characters' })">管理 →</el-button>
        </div>
        <div v-if="projectStore.characters.length === 0" class="empty" style="padding: 24px">
          <p class="text-faint">还没有角色</p>
        </div>
        <div v-else class="char-grid">
          <div v-for="c in projectStore.characters.slice(0, 6)" :key="c.id" class="char-item">
            <div class="avatar" :style="{ background: avatarColor(c.name) }">{{ c.name[0] }}</div>
            <div>
              <div class="char-name">{{ c.name }}</div>
              <div class="text-faint text-xs">{{ c.role }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="card" style="padding: 16px; margin-top: 16px">
      <h3 style="margin:0 0 12px; font-size:15px">快捷操作</h3>
      <div class="quick-actions">
        <div class="quick-btn" @click="$router.push({ name: 'chapters' })">
          <el-icon :size="20"><Document /></el-icon><span>章节管理</span>
        </div>
        <div class="quick-btn" @click="$router.push({ name: 'canvas' })">
          <el-icon :size="20"><Connection /></el-icon><span>故事画布</span>
        </div>
        <div class="quick-btn" @click="$router.push({ name: 'critics' })">
          <el-icon :size="20"><ChatLineSquare /></el-icon><span>AI 评审</span>
        </div>
        <div class="quick-btn" @click="$router.push({ name: 'prompts' })">
          <el-icon :size="20"><MagicStick /></el-icon><span>提示词</span>
        </div>
        <div class="quick-btn" @click="$router.push({ name: 'export' })">
          <el-icon :size="20"><Download /></el-icon><span>导出</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Edit, ArrowRight, Document, Connection, ChatLineSquare, MagicStick, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import * as db from '@/services/db'
import type { WritingGoal } from '@/types'

const projectStore = useProjectStore()
const project = computed(() => projectStore.current)
const totalWords = computed(() => projectStore.totalWords)
const recentChapters = computed(() =>
  [...projectStore.chapters].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)
)
const latestChapterId = computed(() => recentChapters.value[0]?.id || '')
const completedChapters = computed(() => projectStore.chapters.filter(c => c.status === '完成').length)

const progressPct = computed(() => {
  if (!project.value || !project.value.wordsTarget) return 0
  return Math.min(100, Math.round((totalWords.value / project.value.wordsTarget) * 100))
})

const todayWords = ref(0)
const streak = ref(0)
const goal = ref<WritingGoal | null>(null)

async function loadGoal(id: string) {
  try {
    const goals = await db.Goals.list(id)
    goal.value = goals[0] || null
    if (goal.value) {
      streak.value = goal.value.streak || 0
      const today = new Date().toISOString().slice(0, 10)
      const todayRec = goal.value.history.find(h => h.date === today)
      todayWords.value = todayRec?.words || 0
    }
  } catch (e: any) {
    console.error(e)
    ElMessage.error('加载写作目标失败：' + (e.message || ''))
  }
}

watch(() => project.value?.id, (id) => {
  if (id) loadGoal(id)
}, { immediate: true })

function statusType(s: string): any {
  return { '完成': 'success', '已发表': 'primary', '草稿': 'info' }[s] || 'info'
}
function formatTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function avatarColor(name: string) {
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4']
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return colors[Math.abs(h) % colors.length]
}
</script>

<style scoped>
.stat-card { padding: 16px; }
.stat-label { font-size: 12px; color: var(--text-2); margin-bottom: 6px; }
.stat-value { font-size: 26px; font-weight: 700; margin-bottom: 8px; }
.stat-bar { height: 4px; background: var(--panel-2); border-radius: 2px; overflow: hidden; margin-bottom: 6px; }
.bar-fill { height: 100%; background: var(--primary); transition: width 0.3s; }
.chapter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.chapter-row:hover { background: var(--panel-2); }
.ch-title { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
.ch-meta { display: flex; gap: 10px; align-items: center; }
.char-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.char-item { display: flex; align-items: center; gap: 10px; padding: 6px; }
.avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 600; font-size: 16px; flex-shrink: 0;
}
.char-name { font-size: 13px; font-weight: 500; }
.quick-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.quick-btn {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 16px 20px;
  background: var(--panel-2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 90px;
  color: var(--text-2);
  font-size: 12px;
}
.quick-btn:hover { background: var(--primary-light); color: var(--primary); }
</style>
