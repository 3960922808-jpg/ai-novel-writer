<template>
  <div class="page canvas-page" v-if="project">
    <div class="page-header">
      <div class="title-row">
        <h1 class="page-title">故事画布</h1>
        <!-- 连线模式开关 -->
        <div class="mode-switch">
          <span class="text-faint text-xs">{{ connectMode ? '连线模式' : '正常模式' }}</span>
          <el-switch v-model="connectMode" size="small" @change="onModeChange" />
        </div>
      </div>
      <div class="flex gap-2 items-center">
        <el-dropdown trigger="click" @command="addNode">
          <el-button type="primary" :icon="Plus">
            添加节点
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="scene">场景</el-dropdown-item>
              <el-dropdown-item command="plot">剧情</el-dropdown-item>
              <el-dropdown-item command="character">角色</el-dropdown-item>
              <el-dropdown-item command="theme">主题</el-dropdown-item>
              <el-dropdown-item command="note">笔记</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button :icon="DocumentChecked" @click="saveAll">保存布局</el-button>
      </div>
    </div>

    <div class="canvas-wrap card">
      <div class="canvas-area" ref="canvasRef" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp">
        <div class="canvas-inner" :style="{ width: CANVAS_W + 'px', height: CANVAS_H + 'px' }">
          <svg class="links-svg" :width="CANVAS_W" :height="CANVAS_H">
            <!-- 已有连线 -->
            <path
              v-for="l in linkPaths"
              :key="l.key"
              :d="l.d"
              :stroke="l.color"
              stroke-width="2"
              fill="none"
              :opacity="0.6"
            />
            <!-- 拖拽中的临时连线 -->
            <path
              v-if="dragLine"
              :d="dragLine"
              stroke="#ef4444"
              stroke-width="2"
              stroke-dasharray="5,3"
              fill="none"
              opacity="0.8"
            />
          </svg>
          <div
            v-for="node in nodes"
            :key="node.id"
            class="node"
            :class="[typeClass(node.type), { 'connect-mode': connectMode, 'drop-target': dragFrom && dragFrom.nodeId !== node.id && hoverNodeId === node.id }]"
            :style="nodeStyle(node)"
            @mousedown.left="startDrag($event, node)"
            @dblclick="edit(node)"
            @mouseenter="hoverNodeId = node.id"
            @mouseleave="hoverNodeId = ''"
          >
            <!-- 连线模式下的左右红点 -->
            <div
              v-if="connectMode"
              class="node-dot dot-left"
              @mousedown.stop="startConnect($event, node, 'left')"
              title="拖拽连线"
            ></div>
            <div
              v-if="connectMode"
              class="node-dot dot-right"
              @mousedown.stop="startConnect($event, node, 'right')"
              title="拖拽连线"
            ></div>
            <button class="node-del" title="删除" @click.stop="remove(node)">
              <el-icon><Close /></el-icon>
            </button>
            <div class="node-tag">{{ typeLabel(node.type) }}</div>
            <div class="node-title">{{ node.title || '未命名' }}</div>
            <div v-if="node.content" class="node-content">{{ shortContent(node.content) }}</div>
          </div>
        </div>
        <div v-if="nodes.length === 0" class="canvas-empty">
          <el-icon class="empty-icon"><Connection /></el-icon>
          <p>画布还是空的</p>
          <p class="text-faint text-xs">添加场景、剧情、角色等节点开始规划你的故事</p>
        </div>
        <!-- 连线模式提示 -->
        <div v-if="connectMode" class="mode-hint">
          <el-icon><InfoFilled /></el-icon>
          <span>连线模式：拖拽节点两侧红色圆点到其他节点即可建立连接</span>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="编辑节点" width="560px">
      <el-form label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="节点标题" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%" @change="onTypeChange">
            <el-option label="场景" value="scene" />
            <el-option label="剧情" value="plot" />
            <el-option label="角色" value="character" />
            <el-option label="主题" value="theme" />
            <el-option label="笔记" value="note" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="5" placeholder="节点详细内容" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="form.color" />
          <el-button text size="small" @click="form.color = TYPE_COLORS[form.type]">重置为类型默认色</el-button>
        </el-form-item>
        <el-form-item label="连接到">
          <el-select v-model="form.links" multiple clearable placeholder="选择关联节点" style="width: 100%">
            <el-option
              v-for="n in otherNodes(form.id)"
              :key="n.id"
              :label="(n.title || '未命名') + ' [' + typeLabel(n.type) + ']'"
              :value="n.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Close, Connection, ArrowDown, DocumentChecked, InfoFilled } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import * as db from '@/services/db'
import type { CanvasNode, ID } from '@/types'

const projectStore = useProjectStore()
const project = computed(() => projectStore.current)

const CANVAS_W = 3000
const CANVAS_H = 2000

const nodes = ref<CanvasNode[]>([])
const canvasRef = ref<HTMLElement | null>(null)
const dialogVisible = ref(false)

// 连线模式
const connectMode = ref(false)
const dragFrom = ref<{ nodeId: string; side: 'left' | 'right'; x: number; y: number } | null>(null)
const dragLine = ref('')
const hoverNodeId = ref('')

const TYPE_COLORS: Record<CanvasNode['type'], string> = {
  scene: '#409eff',
  plot: '#ef4444',
  character: '#10b981',
  theme: '#a855f7',
  note: '#8f959e'
}

const TYPE_LABELS: Record<CanvasNode['type'], string> = {
  scene: '场景',
  plot: '剧情',
  character: '角色',
  theme: '主题',
  note: '笔记'
}

const form = reactive<{
  id?: ID
  type: CanvasNode['type']
  title: string
  content: string
  color: string
  links: ID[]
}>({
  type: 'scene',
  title: '',
  content: '',
  color: '',
  links: []
})

const linkPaths = computed(() => {
  const map = new Map(nodes.value.map(n => [n.id, n]))
  const paths: { key: string; d: string; color: string }[] = []
  const seen = new Set<string>()
  for (const node of nodes.value) {
    for (const tid of node.links) {
      const target = map.get(tid)
      if (!target) continue
      const key = [node.id, tid].sort().join('->')
      if (seen.has(key)) continue
      seen.add(key)
      const x1 = node.x + node.width / 2
      const y1 = node.y + node.height / 2
      const x2 = target.x + target.width / 2
      const y2 = target.y + target.height / 2
      const dx = (x2 - x1) / 2
      const d = `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
      paths.push({ key, d, color: node.color || TYPE_COLORS[node.type] })
    }
  }
  return paths
})

watch(project, (p) => {
  if (p) load()
}, { immediate: true })

async function load() {
  if (!project.value) return
  try {
    nodes.value = await db.Canvas.list(project.value.id)
  } catch (e: any) {
    ElMessage.error('加载失败：' + e.message)
  }
}

function typeClass(t: CanvasNode['type']) {
  return `type-${t}`
}

function typeLabel(t: CanvasNode['type']) {
  return TYPE_LABELS[t]
}

function nodeStyle(node: CanvasNode) {
  const color = node.color || TYPE_COLORS[node.type]
  return {
    left: node.x + 'px',
    top: node.y + 'px',
    width: node.width + 'px',
    minHeight: node.height + 'px',
    borderLeftColor: color,
    borderTopColor: color,
    borderRightColor: color,
    borderBottomColor: color
  }
}

function shortContent(content: string) {
  const text = (content || '').replace(/\s+/g, ' ').trim()
  return text.length > 60 ? text.slice(0, 60) + '...' : text
}

function otherNodes(currentId?: ID) {
  return nodes.value.filter(n => n.id !== currentId)
}

function onModeChange(val: boolean) {
  if (val) {
    ElMessage.info('已进入连线模式：拖拽节点两侧红色圆点到其他节点建立连接')
  } else {
    dragFrom.value = null
    dragLine.value = ''
  }
}

// 获取节点中心点（相对于 canvas-inner）
function getNodeCenter(node: CanvasNode) {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  }
}

// 获取红点在 canvas-inner 坐标系中的位置
function getDotPosition(node: CanvasNode, side: 'left' | 'right') {
  return {
    x: side === 'left' ? node.x : node.x + node.width,
    y: node.y + node.height / 2
  }
}

// 鼠标坐标（屏幕）转 canvas-inner 坐标
function toCanvasCoord(clientX: number, clientY: number) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const scrollLeft = canvas.scrollLeft
  const scrollTop = canvas.scrollTop
  return {
    x: clientX - rect.left + scrollLeft,
    y: clientY - rect.top + scrollTop
  }
}

function startDrag(e: MouseEvent, node: CanvasNode) {
  // 连线模式下不拖拽节点位置（避免与连线冲突），只允许通过红点连线
  if (connectMode.value) return
  const target = e.target as HTMLElement
  if (target.closest('.node-del')) return
  if (target.closest('.node-dot')) return
  const startX = e.clientX - node.x
  const startY = e.clientY - node.y
  const onMove = (ev: MouseEvent) => {
    node.x = Math.max(0, ev.clientX - startX)
    node.y = Math.max(0, ev.clientY - startY)
  }
  const onUp = async () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    try {
      await db.Canvas.save(node)
    } catch (e: any) {
      ElMessage.error('保存位置失败：' + e.message)
    }
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// 开始连线拖拽
function startConnect(e: MouseEvent, node: CanvasNode, side: 'left' | 'right') {
  e.preventDefault()
  e.stopPropagation()
  const dotPos = getDotPosition(node, side)
  dragFrom.value = {
    nodeId: node.id,
    side,
    x: dotPos.x,
    y: dotPos.y
  }
  const start = dotPos
  const cur = toCanvasCoord(e.clientX, e.clientY)
  dragLine.value = `M ${start.x},${start.y} L ${cur.x},${cur.y}`
}

// 画布上移动：更新临时连线
function onCanvasMouseMove(e: MouseEvent) {
  if (!dragFrom.value) return
  const fromNode = nodes.value.find(n => n.id === dragFrom.value!.nodeId)
  if (!fromNode) return
  const start = getDotPosition(fromNode, dragFrom.value.side)
  const cur = toCanvasCoord(e.clientX, e.clientY)
  // 贝塞尔曲线让连线更美观
  const dx = Math.abs(cur.x - start.x) / 2
  const sx = start.x
  const sy = start.y
  const ex = cur.x
  const ey = cur.y
  dragLine.value = `M ${sx},${sy} C ${sx + (dragFrom.value.side === 'right' ? dx : -dx)},${sy} ${ex + (cur.x > start.x ? -dx : dx)},${ey} ${ex},${ey}`
}

// 画布上松开：检测是否在某个节点上
async function onCanvasMouseUp(e: MouseEvent) {
  if (!dragFrom.value) {
    return
  }
  const fromNodeId = dragFrom.value.nodeId
  const targetId = hoverNodeId.value
  dragFrom.value = null
  dragLine.value = ''

  if (!targetId || targetId === fromNodeId) {
    return
  }
  // 建立连线
  const fromNode = nodes.value.find(n => n.id === fromNodeId)
  const toNode = nodes.value.find(n => n.id === targetId)
  if (!fromNode || !toNode) return
  // 避免重复连线
  if (fromNode.links.includes(targetId)) {
    ElMessage.info('已存在连接')
    return
  }
  // 双向连线（任意一方有对方就算已连）
  if (toNode.links.includes(fromNodeId)) {
    ElMessage.info('已存在反向连接')
    return
  }
  fromNode.links.push(targetId)
  try {
    await db.Canvas.save(fromNode)
    ElMessage.success(`已连接：${fromNode.title} → ${toNode.title}`)
  } catch (err: any) {
    ElMessage.error('连线失败：' + err.message)
  }
}

async function addNode(type: CanvasNode['type']) {
  if (!project.value) return
  try {
    const offset = (nodes.value.length % 10) * 30
    const node = await db.Canvas.save({
      projectId: project.value.id,
      type,
      x: 80 + offset,
      y: 80 + offset,
      width: 200,
      height: 120,
      title: `新${TYPE_LABELS[type]}`,
      content: '',
      color: TYPE_COLORS[type],
      links: [],
      createdAt: Date.now()
    } as any)
    nodes.value.push(node)
    ElMessage.success('已添加节点')
    edit(node)
  } catch (e: any) {
    ElMessage.error('添加失败：' + e.message)
  }
}

function edit(node: CanvasNode) {
  form.id = node.id
  form.type = node.type
  form.title = node.title
  form.content = node.content
  form.color = node.color
  form.links = [...node.links]
  dialogVisible.value = true
}

function onTypeChange(t: CanvasNode['type']) {
  if (!form.color || Object.values(TYPE_COLORS).includes(form.color)) {
    form.color = TYPE_COLORS[t]
  }
}

async function save() {
  if (!form.id) return
  const node = nodes.value.find(n => n.id === form.id)
  if (!node) return
  const updated = {
    ...node,
    title: form.title,
    type: form.type,
    content: form.content,
    color: form.color,
    links: [...form.links]
  }
  try {
    await db.Canvas.save(updated)
    node.title = form.title
    node.type = form.type
    node.content = form.content
    node.color = form.color
    node.links = [...form.links]
    ElMessage.success('已保存')
    dialogVisible.value = false
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  }
}

async function saveAll() {
  try {
    for (const n of nodes.value) {
      await db.Canvas.save(n)
    }
    ElMessage.success('布局已保存')
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  }
}

async function remove(node: CanvasNode) {
  try {
    await ElMessageBox.confirm(
      `删除节点《${node.title || typeLabel(node.type)}》？`,
      '确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    for (const n of nodes.value) {
      if (n.links.includes(node.id)) {
        n.links = n.links.filter(id => id !== node.id)
        await db.Canvas.save(n)
      }
    }
    await db.Canvas.remove(node.id)
    nodes.value = nodes.value.filter(n => n.id !== node.id)
    ElMessage.success('已删除')
  } catch (e: any) {
    ElMessage.error('删除失败：' + e.message)
  }
}
</script>

<style scoped>
.canvas-page {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mode-switch {
  display: flex;
  align-items: center;
  gap: 6px;
}
.canvas-wrap {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
  padding: 0;
}
.canvas-area {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  background-color: var(--panel-2);
  background-image: radial-gradient(var(--border) 1.2px, transparent 1.2px);
  background-size: 20px 20px;
}
.canvas-inner {
  position: relative;
}
.links-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 0;
}
.node {
  position: absolute;
  background: var(--panel);
  border: 2px solid;
  border-radius: var(--radius);
  padding: 10px 12px;
  box-shadow: var(--shadow);
  cursor: move;
  user-select: none;
  z-index: 1;
  transition: box-shadow 0.15s;
}
.node:hover {
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14);
  z-index: 2;
}
.node:active {
  cursor: grabbing;
}
/* 连线模式下节点不拖拽，鼠标改为默认 */
.node.connect-mode {
  cursor: default;
}
/* 连线模式下悬停目标高亮 */
.node.drop-target {
  box-shadow: 0 0 0 3px #ef4444, 0 6px 18px rgba(239, 68, 68, 0.3);
  border-color: #ef4444 !important;
}
/* 红点 */
.node-dot {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  cursor: crosshair;
  z-index: 4;
  top: 50%;
  transform: translateY(-50%);
  transition: transform 0.15s;
}
.node-dot:hover {
  transform: translateY(-50%) scale(1.4);
  background: #dc2626;
}
.dot-left {
  left: -8px;
}
.dot-right {
  right: -8px;
}
.node-del {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--danger);
  color: #fff;
  border: 2px solid var(--panel);
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 12px;
  z-index: 3;
}
.node:hover .node-del {
  display: flex;
}
.node-tag {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--panel-2);
  color: var(--text-2);
  margin-bottom: 4px;
}
.node-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  margin-bottom: 4px;
  word-break: break-all;
}
.node-content {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
  word-break: break-all;
}
.canvas-empty {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-3);
  text-align: center;
  pointer-events: none;
}
.canvas-empty .empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}
/* 连线模式提示条 */
.mode-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 10;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
</style>
