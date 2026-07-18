<template>
  <div class="layout">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ collapsed }">
      <div class="logo" @click="goHome">
        <el-icon :size="22"><EditPen /></el-icon>
        <span v-if="!collapsed" class="logo-text">AI 写小说</span>
      </div>

      <div class="project-info" v-if="project && !collapsed">
        <div class="proj-title">{{ project.title }}</div>
        <div class="proj-meta">
          <el-tag size="small" effect="plain">{{ project.genre }}</el-tag>
          <span class="text-faint text-xs">{{ totalWords }} 字</span>
        </div>
      </div>

      <nav class="nav">
        <router-link
          v-for="item in navItems" :key="item.name"
          :to="{ name: item.name }"
          class="nav-item"
          :title="item.label"
        >
          <el-icon :size="18"><component :is="item.icon" /></el-icon>
          <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <button class="collapse-btn" @click="collapsed = !collapsed" :title="collapsed ? '展开' : '收起'">
          <el-icon :size="16"><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
        </button>
      </div>
    </aside>

    <!-- 主区域 -->
    <main class="main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  EditPen, DataAnalysis, Document, Edit, User,
  Location, Collection, Timer, Connection,
  MagicStick, Trophy, ChatLineSquare, Files, Download, Setting, Fold, Expand
} from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const collapsed = ref(false)

const project = computed(() => projectStore.current)
const totalWords = computed(() => projectStore.totalWords)

const navItems = [
  { name: 'dashboard', label: '仪表盘', icon: DataAnalysis },
  { name: 'chapters', label: '章节列表', icon: Document },
  { name: 'editor', label: '写作', icon: Edit },
  { name: 'characters', label: '角色库', icon: User },
  { name: 'locations', label: '地点', icon: Location },
  { name: 'lore', label: '世界观', icon: Collection },
  { name: 'timeline', label: '时间线', icon: Timer },
  { name: 'canvas', label: '故事画布', icon: Connection },
  { name: 'prompts', label: '提示词库', icon: MagicStick },
  { name: 'goals', label: '写作目标', icon: Trophy },
  { name: 'critics', label: 'AI 评审', icon: ChatLineSquare },
  { name: 'truth', label: '真相文件', icon: Files },
  { name: 'export', label: '导出', icon: Download },
  { name: 'project-settings', label: '项目设置', icon: Setting }
]

onMounted(async () => {
  const id = route.params.id as string
  const ok = await projectStore.loadProject(id)
  if (!ok) {
    ElMessage.error('项目不存在')
    router.push('/')
  }
})

function goHome() {
  router.push('/')
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.sidebar {
  width: 220px;
  background: var(--panel);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s;
  flex-shrink: 0;
}
.sidebar.collapsed { width: 60px; }
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  cursor: pointer;
  color: var(--primary);
  font-weight: 600;
  font-size: 16px;
}
.logo-text { white-space: nowrap; }
.project-info {
  padding: 0 16px 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.proj-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proj-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 6px;
  color: var(--text-2);
  text-decoration: none;
  font-size: 13px;
  margin-bottom: 2px;
  transition: all 0.15s;
  cursor: pointer;
}
.nav-item:hover { background: var(--panel-2); color: var(--text); }
.nav-item.router-link-active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 500;
}
.nav-label { white-space: nowrap; }
.sidebar-footer {
  padding: 8px;
  border-top: 1px solid var(--border);
}
.collapse-btn {
  width: 100%;
  background: transparent;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-2);
  border-radius: 6px;
  display: flex;
  justify-content: center;
}
.collapse-btn:hover { background: var(--panel-2); color: var(--text); }
.main {
  flex: 1;
  overflow: hidden;
  background: var(--bg);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
