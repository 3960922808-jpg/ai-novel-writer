<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <h1 class="page-title">写作目标</h1>
      <el-button :icon="DataLine" @click="genMock">模拟数据</el-button>
    </div>

    <div class="grid grid-3" style="margin-bottom: 20px">
      <div class="card progress-card">
        <div class="flex items-center gap-3">
          <el-progress
            type="circle"
            :percentage="dailyPct"
            :width="72"
            :stroke-width="6"
            :color="dailyPct >= 100 ? '#10b981' : '#6366f1'"
          />
          <div class="flex-1">
            <div class="stat-label">今日字数</div>
            <div class="stat-value">{{ todayWords.toLocaleString() }}</div>
            <div class="text-faint text-xs">目标 {{ goal.dailyTarget.toLocaleString() }} 字</div>
          </div>
        </div>
      </div>
      <div class="card progress-card">
        <div class="flex items-center gap-3">
          <el-progress
            type="circle"
            :percentage="weeklyPct"
            :width="72"
            :stroke-width="6"
            :color="weeklyPct >= 100 ? '#10b981' : '#6366f1'"
          />
          <div class="flex-1">
            <div class="stat-label">本周字数</div>
            <div class="stat-value">{{ weekWords.toLocaleString() }}</div>
            <div class="text-faint text-xs">目标 {{ goal.weeklyTarget.toLocaleString() }} 字</div>
          </div>
        </div>
      </div>
      <div class="card progress-card">
        <div class="flex items-center gap-3">
          <el-progress
            type="circle"
            :percentage="monthlyPct"
            :width="72"
            :stroke-width="6"
            :color="monthlyPct >= 100 ? '#10b981' : '#6366f1'"
          />
          <div class="flex-1">
            <div class="stat-label">本月字数</div>
            <div class="stat-value">{{ monthWords.toLocaleString() }}</div>
            <div class="text-faint text-xs">目标 {{ goal.monthlyTarget.toLocaleString() }} 字</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card streak-card" style="padding: 16px; margin-bottom: 20px">
      <div class="flex items-center gap-3">
        <el-icon :size="32" color="var(--warning)"><Trophy /></el-icon>
        <div>
          <div class="streak-num">{{ goal.streak }}</div>
          <div class="text-muted text-sm">连续写作天数</div>
        </div>
        <div class="flex-1"></div>
        <div class="text-muted text-sm">
          最近写作：
          <span v-if="goal.lastWriteDate" style="color: var(--text)">{{ goal.lastWriteDate }}</span>
          <span v-else class="text-faint">暂无</span>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card" style="padding: 16px">
        <div class="flex items-center gap-2" style="margin-bottom: 16px">
          <el-icon><Setting /></el-icon>
          <h3 style="margin:0; font-size:15px">目标设置</h3>
        </div>
        <el-form label-width="100px">
          <el-form-item label="每日目标">
            <div class="flex items-center gap-2">
              <el-input-number v-model="form.dailyTarget" :min="0" :step="500" :max="50000" style="flex:1" />
              <span class="text-faint text-xs">字</span>
            </div>
          </el-form-item>
          <el-form-item label="每周目标">
            <div class="flex items-center gap-2">
              <el-input-number v-model="form.weeklyTarget" :min="0" :step="1000" :max="500000" style="flex:1" />
              <span class="text-faint text-xs">字</span>
            </div>
          </el-form-item>
          <el-form-item label="每月目标">
            <div class="flex items-center gap-2">
              <el-input-number v-model="form.monthlyTarget" :min="0" :step="5000" :max="2000000" style="flex:1" />
              <span class="text-faint text-xs">字</span>
            </div>
          </el-form-item>
        </el-form>
        <div style="text-align:right">
          <el-button type="primary" :loading="saving" @click="saveGoals">保存目标</el-button>
        </div>
      </div>

      <div class="card" style="padding: 16px">
        <div class="flex items-center gap-2" style="margin-bottom: 16px">
          <el-icon><Calendar /></el-icon>
          <h3 style="margin:0; font-size:15px">写作日历</h3>
          <span class="text-faint text-xs" style="margin-left:auto">最近 90 天</span>
        </div>
        <div class="heatmap">
          <div class="weekday-header">
            <span v-for="w in weekdays" :key="w">{{ w }}</span>
          </div>
          <div class="heatmap-grid">
            <template v-for="(d, i) in calendarDays" :key="i">
              <el-tooltip v-if="d" :content="`${d.date} · ${d.words} 字`" placement="top">
                <div class="cell" :class="levelClass(d.words)"></div>
              </el-tooltip>
              <div v-else class="cell empty"></div>
            </template>
          </div>
          <div class="legend">
            <span class="text-faint text-xs">少</span>
            <div class="cell level-0"></div>
            <div class="cell level-1"></div>
            <div class="cell level-2"></div>
            <div class="cell level-3"></div>
            <div class="cell level-4"></div>
            <span class="text-faint text-xs">多</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Trophy, Calendar, Setting, DataLine } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { Goals } from '@/services/db'
import type { WritingGoal } from '@/types'

const projectStore = useProjectStore()
const project = computed(() => projectStore.current)

const goal = reactive<WritingGoal>({
  id: '',
  projectId: '',
  dailyTarget: 2000,
  weeklyTarget: 14000,
  monthlyTarget: 60000,
  streak: 0,
  lastWriteDate: undefined,
  history: []
})

const form = reactive({
  dailyTarget: 2000,
  weeklyTarget: 14000,
  monthlyTarget: 60000
})

const saving = ref(false)
const weekdays = ['一', '二', '三', '四', '五', '六', '日']

watch(() => project.value?.id, (id) => {
  if (id) load()
}, { immediate: true })

function dateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() {
  return dateStr(new Date())
}

function wordsOn(date: string) {
  return goal.history.find(h => h.date === date)?.words || 0
}

async function load() {
  if (!project.value) return
  const list = await Goals.list(project.value.id)
  let isNew = false
  if (list.length > 0) {
    Object.assign(goal, list[0])
  } else {
    Object.assign(goal, {
      projectId: project.value.id,
      dailyTarget: 2000,
      weeklyTarget: 14000,
      monthlyTarget: 60000,
      streak: 0,
      lastWriteDate: undefined,
      history: []
    })
    isNew = true
  }
  form.dailyTarget = goal.dailyTarget
  form.weeklyTarget = goal.weeklyTarget
  form.monthlyTarget = goal.monthlyTarget
  const oldStreak = goal.streak
  const oldLast = goal.lastWriteDate
  recomputeStreak()
  if (isNew || goal.streak !== oldStreak || goal.lastWriteDate !== oldLast) {
    await Goals.save({ ...goal })
  }
}

const todayWords = computed(() => wordsOn(todayStr()))

const weekWords = computed(() => {
  const now = new Date()
  const day = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - day)
  let sum = 0
  for (const h of goal.history) {
    const d = new Date(h.date + 'T00:00:00')
    if (d >= monday) sum += h.words
  }
  return sum
})

const monthWords = computed(() => {
  const ym = todayStr().slice(0, 7)
  let sum = 0
  for (const h of goal.history) {
    if (h.date.startsWith(ym)) sum += h.words
  }
  return sum
})

const dailyPct = computed(() => {
  if (!goal.dailyTarget) return 0
  return Math.min(100, Math.round((todayWords.value / goal.dailyTarget) * 100))
})
const weeklyPct = computed(() => {
  if (!goal.weeklyTarget) return 0
  return Math.min(100, Math.round((weekWords.value / goal.weeklyTarget) * 100))
})
const monthlyPct = computed(() => {
  if (!goal.monthlyTarget) return 0
  return Math.min(100, Math.round((monthWords.value / goal.monthlyTarget) * 100))
})

const calendarDays = computed(() => {
  const days: ({ date: string; words: number } | null)[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - 89)
  const startWeekday = (start.getDay() + 6) % 7
  for (let i = 0; i < startWeekday; i++) days.push(null)
  const cur = new Date(start)
  while (cur <= today) {
    const ds = dateStr(cur)
    days.push({ date: ds, words: wordsOn(ds) })
    cur.setDate(cur.getDate() + 1)
  }
  return days
})

function levelClass(words: number) {
  if (words <= 0) return 'level-0'
  if (words <= 500) return 'level-1'
  if (words <= 1500) return 'level-2'
  if (words <= 3000) return 'level-3'
  return 'level-4'
}

function recomputeStreak() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayDS = dateStr(today)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayDS = dateStr(yesterday)

  const todayHas = wordsOn(todayDS) > 0
  const yesterdayHas = wordsOn(yesterdayDS) > 0

  if (!todayHas && !yesterdayHas) {
    goal.streak = 0
    goal.lastWriteDate = undefined
    return
  }

  let streak = 0
  let lastDate = ''
  const cur = new Date(todayHas ? today : yesterday)
  while (true) {
    const ds = dateStr(cur)
    if (wordsOn(ds) > 0) {
      streak++
      lastDate = ds
      cur.setDate(cur.getDate() - 1)
    } else {
      break
    }
  }
  goal.streak = streak
  goal.lastWriteDate = lastDate
}

async function saveGoals() {
  saving.value = true
  try {
    goal.dailyTarget = form.dailyTarget
    goal.weeklyTarget = form.weeklyTarget
    goal.monthlyTarget = form.monthlyTarget
    await Goals.save({ ...goal })
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function genMock() {
  await ElMessageBox.confirm('将随机生成最近 30 天的写作数据，会覆盖现有 history，是否继续？', '确认', { type: 'warning' })
  const history: { date: string; words: number }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const ds = dateStr(d)
    const skip = Math.random() < 0.25
    history.push({ date: ds, words: skip ? 0 : Math.floor(Math.random() * 4000) + 200 })
  }
  goal.history = history
  recomputeStreak()
  await Goals.save({ ...goal })
  ElMessage.success('已生成模拟数据')
}
</script>

<style scoped>
.progress-card { padding: 16px; }
.stat-label { font-size: 12px; color: var(--text-2); margin-bottom: 6px; }
.stat-value { font-size: 24px; font-weight: 700; }
.streak-card {
  background: linear-gradient(135deg, var(--primary-light), var(--panel));
}
.streak-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--warning);
  line-height: 1;
}
.heatmap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 18px);
  gap: 3px;
  font-size: 10px;
  color: var(--text-3);
  text-align: center;
}
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 18px);
  gap: 3px;
}
.cell {
  width: 18px;
  height: 18px;
  border-radius: 2px;
}
.cell.level-0 { background: var(--panel-2); border: 1px solid var(--border); }
.cell.level-1 { background: #c7d2fe; }
.cell.level-2 { background: #818cf8; }
.cell.level-3 { background: #6366f1; }
.cell.level-4 { background: #4338ca; }
.cell.empty { background: transparent; border: none; }
html.dark .cell.level-0 { background: #2a2a2a; border-color: #3a3a3a; }
html.dark .cell.level-1 { background: #312e81; }
html.dark .cell.level-2 { background: #4f46e5; }
html.dark .cell.level-3 { background: #6366f1; }
html.dark .cell.level-4 { background: #a5b4fc; }
.legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}
.legend .cell {
  width: 12px;
  height: 12px;
}
</style>
