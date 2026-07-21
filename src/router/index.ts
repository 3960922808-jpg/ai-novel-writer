import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/ProjectList.vue'),
    meta: { title: '我的书架' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/skills',
    name: 'global-skills',
    component: () => import('@/views/Skills.vue'),
    meta: { title: '全局技能库' }
  },
  {
    path: '/project/:id',
    component: () => import('@/views/ProjectLayout.vue'),
    children: [
      { path: '', redirect: { name: 'dashboard' } },
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '仪表盘' } },
      { path: 'chapters', name: 'chapters', component: () => import('@/views/ChapterList.vue'), meta: { title: '章节列表' } },
      { path: 'chapters/:chapterId', name: 'editor', component: () => import('@/views/Editor.vue'), meta: { title: '写作' } },
      { path: 'locations', name: 'locations', component: () => import('@/views/Locations.vue'), meta: { title: '地点' } },
      { path: 'lore', name: 'lore', component: () => import('@/views/Lore.vue'), meta: { title: '世界观设定' } },
      { path: 'timeline', name: 'timeline', component: () => import('@/views/Timeline.vue'), meta: { title: '时间线' } },
      { path: 'canvas', name: 'canvas', component: () => import('@/views/StoryCanvas.vue'), meta: { title: '故事画布' } },
      { path: 'prompts', name: 'prompts', component: () => import('@/views/PromptLibrary.vue'), meta: { title: '提示词库' } },
      { path: 'goals', name: 'goals', component: () => import('@/views/WritingGoals.vue'), meta: { title: '写作目标' } },
      { path: 'critics', name: 'critics', component: () => import('@/views/AICritics.vue'), meta: { title: 'AI 评审' } },
      { path: 'teardown', name: 'teardown', component: () => import('@/views/Teardown.vue'), meta: { title: '拆书分析' } },
      { path: 'truth', name: 'truth', component: () => import('@/views/TruthFiles.vue'), meta: { title: '真相文件' } },
      { path: 'search', name: 'search', component: () => import('@/views/WebSearch.vue'), meta: { title: '联网搜索' } },
      { path: 'skills', name: 'skills', component: () => import('@/views/Skills.vue'), meta: { title: '技能库' } },
      { path: 'distill', name: 'distill', component: () => import('@/views/DistillNovel.vue'), meta: { title: '蒸馏文风' } },
      { path: 'export', name: 'export', component: () => import('@/views/Export.vue'), meta: { title: '导出' } },
      { path: 'project-settings', name: 'project-settings', component: () => import('@/views/ProjectSettings.vue'), meta: { title: '项目设置' } }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.afterEach((to) => {
  document.title = `${to.meta.title || 'TrmWrite'} - TrmWrite`
})

export default router
