<template>
  <div class="page canvas-page" v-if="project">
    <div class="page-header">
      <div class="title-row">
        <h1 class="page-title">故事画布 · AI 工作流</h1>
        <!-- 连线模式开关 -->
        <div class="mode-switch">
          <span class="text-faint text-xs">{{ connectMode ? '连线模式' : '正常模式' }}</span>
          <el-switch v-model="connectMode" size="small" @change="onModeChange" />
        </div>
      </div>
      <div class="flex gap-2 items-center flex-wrap">
        <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-dropdown trigger="click" @command="addNode">
          <el-button type="primary" :icon="Plus">
            添加节点
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>—— 工作流节点 ——</el-dropdown-item>
              <el-dropdown-item command="start">起点（开始）</el-dropdown-item>
              <el-dropdown-item command="inciting">触发事件</el-dropdown-item>
              <el-dropdown-item command="rising">发展</el-dropdown-item>
              <el-dropdown-item command="climax">高潮</el-dropdown-item>
              <el-dropdown-item command="resolution">结局</el-dropdown-item>
              <el-dropdown-item disabled divided>—— 辅助节点 ——</el-dropdown-item>
              <el-dropdown-item command="scene">场景</el-dropdown-item>
              <el-dropdown-item command="plot">剧情</el-dropdown-item>
              <el-dropdown-item command="character">角色</el-dropdown-item>
              <el-dropdown-item command="theme">主题</el-dropdown-item>
              <el-dropdown-item command="note">笔记</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button :icon="Share" @click="insertWorkflowTemplate">插入工作流模板</el-button>
        <el-button :icon="DocumentChecked" @click="saveAll">保存布局</el-button>
        <el-button :icon="Download" @click="exportWorkflowMarkdown" :disabled="nodes.length === 0">导出工作流</el-button>
        <el-button type="success" :icon="MagicStick" :loading="generating" :disabled="nodes.length === 0" @click="generateChapterFromWorkflow">
          AI 生成章节
        </el-button>
      </div>
    </div>

    <!-- 工作流概览条 -->
    <div v-if="workflowNodes.length > 0" class="workflow-overview card">
      <div class="workflow-overview-title">
        <el-icon><Connection /></el-icon>
        <span>工作流顺序</span>
        <span class="text-faint text-xs">AI 将按此顺序串联生成故事</span>
      </div>
      <div class="workflow-steps">
        <template v-for="(node, idx) in workflowNodes" :key="node.id">
          <div class="workflow-step" :style="{ borderColor: node.color || TYPE_COLORS[node.type] }">
            <span class="step-num">{{ idx + 1 }}</span>
            <span class="step-title">{{ node.title || typeLabel(node.type) }}</span>
            <span class="step-type text-faint text-xs">{{ typeLabel(node.type) }}</span>
          </div>
          <el-icon v-if="idx < workflowNodes.length - 1" class="step-arrow"><ArrowRight /></el-icon>
        </template>
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
            :class="[typeClass(node.type), { 'connect-mode': connectMode, 'drop-target': dragFrom && dragFrom.nodeId !== node.id && hoverNodeId === node.id, 'is-workflow': isWorkflowType(node.type) }]"
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
            <div class="node-header">
              <span v-if="isWorkflowType(node.type) && workflowIndex(node) >= 0" class="node-order">#{{ workflowIndex(node) + 1 }}</span>
              <span class="node-tag">{{ typeLabel(node.type) }}</span>
            </div>
            <div class="node-title">{{ node.title || '未命名' }}</div>
            <div v-if="node.aiPrompt" class="node-ai-prompt" title="AI 提示词">
              <el-icon><MagicStick /></el-icon>
              <span>{{ shortContent(node.aiPrompt) }}</span>
            </div>
            <div v-if="node.content" class="node-content">{{ shortContent(node.content) }}</div>
          </div>
        </div>
        <div v-if="nodes.length === 0" class="canvas-empty">
          <el-icon class="empty-icon"><Connection /></el-icon>
          <p>画布还是空的</p>
          <p class="text-faint text-xs">点击「插入工作流模板」一键创建标准三幕剧结构，或手动添加节点</p>
        </div>
        <!-- 连线模式提示 -->
        <div v-if="connectMode" class="mode-hint">
          <el-icon><InfoFilled /></el-icon>
          <span>连线模式：拖拽节点两侧红色圆点到其他节点即可建立连接</span>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="编辑节点" width="640px">
      <el-form label-width="90px">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="节点标题" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%" @change="onTypeChange">
            <el-option-group label="工作流节点">
              <el-option label="起点（开始）" value="start" />
              <el-option label="触发事件" value="inciting" />
              <el-option label="发展" value="rising" />
              <el-option label="高潮" value="climax" />
              <el-option label="结局" value="resolution" />
            </el-option-group>
            <el-option-group label="辅助节点">
              <el-option label="场景" value="scene" />
              <el-option label="剧情" value="plot" />
              <el-option label="角色" value="character" />
              <el-option label="主题" value="theme" />
              <el-option label="笔记" value="note" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item v-if="isWorkflowType(form.type)" label="顺序">
          <el-input-number v-model="form.order" :min="0" :max="999" :step="1" />
          <span class="text-faint text-xs" style="margin-left: 8px">数字越小越靠前（同类型内排序）</span>
        </el-form-item>
        <el-form-item label="AI 提示词">
          <el-input
            v-model="form.aiPrompt"
            type="textarea"
            :rows="4"
            placeholder="告诉 AI 这个节点要写什么，例如：主角穿越到异世界，发现自己是被选中的救世主"
          />
          <span class="text-faint text-xs">AI 按工作流生成章节时，会把每个节点的 AI 提示词按顺序拼接</span>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="节点详细内容（可选，作为 AI 生成时的参考）" />
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

    <!-- AI 生成章节对话框 -->
    <el-dialog v-model="genDialogVisible" title="AI 按工作流生成章节" width="640px">
      <el-form label-width="100px">
        <el-form-item label="目标章节">
          <el-select v-model="genForm.chapterId" placeholder="选择要写入的章节（可选）" clearable style="width: 100%">
            <el-option
              v-for="c in chapters"
              :key="c.id"
              :label="`第${c.order}章 · ${c.title}`"
              :value="c.id"
            />
          </el-select>
          <span class="text-faint text-xs">不选则只生成预览，不写入章节</span>
        </el-form-item>
        <el-form-item label="生成模型">
          <el-select v-model="genForm.model" placeholder="选择模型" style="width: 100%">
            <el-option
              v-for="m in availableModels"
              :key="m.model"
              :label="`${m.provider} / ${m.model}`"
              :value="m.model"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="字数控制">
          <el-input-number v-model="genForm.targetWords" :min="500" :max="10000" :step="500" />
          <span class="text-faint text-xs" style="margin-left: 8px">建议 2000-3000 字</span>
        </el-form-item>
        <el-form-item label="工作流预览">
          <div class="gen-preview">
            <div v-for="(node, idx) in workflowNodes" :key="node.id" class="gen-preview-item">
              <span class="gen-preview-num">{{ idx + 1 }}</span>
              <div>
                <div class="gen-preview-title">{{ node.title || typeLabel(node.type) }}</div>
                <div class="gen-preview-prompt text-muted text-sm">{{ shortContent(node.aiPrompt || node.content, 80) }}</div>
              </div>
            </div>
            <div v-if="workflowNodes.length === 0" class="text-faint text-sm">
              没有工作流节点。请先添加 start/inciting/rising/climax/resolution 类型节点，或点击「插入工作流模板」
            </div>
          </div>
        </el-form-item>
        <el-form-item v-if="generatedText" label="生成结果">
          <el-input v-model="generatedText" type="textarea" :rows="8" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genDialogVisible = false">关闭</el-button>
        <el-button v-if="generatedText" :icon="DocumentCopy" @click="copyGenerated">复制全文</el-button>
        <el-button
          v-if="generatedText && genForm.chapterId"
          type="primary"
          :icon="Check"
          @click="writeToChapter"
        >写入章节</el-button>
        <el-button
          v-else
          type="primary"
          :icon="MagicStick"
          :loading="generating"
          :disabled="!genForm.model || workflowNodes.length === 0"
          @click="doGenerate"
        >开始生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Close, Connection, ArrowDown, ArrowRight, DocumentChecked, InfoFilled,
  ArrowLeft, MagicStick, Download, Share, DocumentCopy, Check
} from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as db from '@/services/db'
import * as ai from '@/services/ai'
import type { CanvasNode, ID } from '@/types'

const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)
const chapters = computed(() => projectStore.chapters)

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
  // 工作流类型（5 色阶递进）
  start: '#10b981',
  inciting: '#f59e0b',
  rising: '#3b82f6',
  climax: '#ef4444',
  resolution: '#8b5cf6',
  // 辅助类型
  scene: '#409eff',
  plot: '#ef4444',
  character: '#10b981',
  theme: '#a855f7',
  note: '#8f959e'
}

const TYPE_LABELS: Record<CanvasNode['type'], string> = {
  start: '起点',
  inciting: '触发事件',
  rising: '发展',
  climax: '高潮',
  resolution: '结局',
  scene: '场景',
  plot: '剧情',
  character: '角色',
  theme: '主题',
  note: '笔记'
}

// 工作流类型的固定顺序
const WORKFLOW_ORDER: CanvasNode['type'][] = ['start', 'inciting', 'rising', 'climax', 'resolution']

function isWorkflowType(t: CanvasNode['type']): boolean {
  return WORKFLOW_ORDER.includes(t)
}

const form = reactive<{
  id?: ID
  type: CanvasNode['type']
  title: string
  content: string
  aiPrompt: string
  order: number
  color: string
  links: ID[]
}>({
  type: 'scene',
  title: '',
  content: '',
  aiPrompt: '',
  order: 0,
  color: '',
  links: []
})

// AI 生成章节相关
const genDialogVisible = ref(false)
const generating = ref(false)
const generatedText = ref('')
const genForm = reactive({
  chapterId: '' as string,
  model: '' as string,
  targetWords: 2500
})
const availableModels = computed(() => settings.availableModels())

// 工作流节点：按 WORKFLOW_ORDER 顺序 + order 升序排列
const workflowNodes = computed<CanvasNode[]>(() => {
  return nodes.value
    .filter(n => isWorkflowType(n.type))
    .sort((a, b) => {
      const ai2 = WORKFLOW_ORDER.indexOf(a.type)
      const bi2 = WORKFLOW_ORDER.indexOf(b.type)
      if (ai2 !== bi2) return ai2 - bi2
      return (a.order || 0) - (b.order || 0)
    })
})

function workflowIndex(node: CanvasNode): number {
  return workflowNodes.value.findIndex(n => n.id === node.id)
}

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

function shortContent(content: string, maxLen = 60) {
  const text = (content || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

function otherNodes(currentId?: ID) {
  return nodes.value.filter(n => n.id !== currentId)
}

function onModeChange(val: boolean) {
  if (val) {
    ElMessage.info('已进入连线模式：拖拽节点两侧红色圆点到其他节点建立连接（仍可拖动方块本身）')
  } else {
    dragFrom.value = null
    dragLine.value = ''
  }
}

// 把响应式节点转成纯对象，避免 IPC 序列化 Vue Proxy 时丢数据
function toPlain(n: CanvasNode): CanvasNode {
  return {
    id: n.id,
    projectId: n.projectId,
    type: n.type,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    title: n.title,
    content: n.content,
    color: n.color,
    links: [...n.links],
    createdAt: n.createdAt,
    aiPrompt: n.aiPrompt,
    order: n.order
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
  const target = e.target as HTMLElement
  // 点到删除按钮或红点时不触发拖动
  if (target.closest('.node-del')) return
  if (target.closest('.node-dot')) return
  e.preventDefault()
  const startX = e.clientX - node.x
  const startY = e.clientY - node.y
  let moved = false
  const onMove = (ev: MouseEvent) => {
    moved = true
    node.x = Math.max(0, ev.clientX - startX)
    node.y = Math.max(0, ev.clientY - startY)
  }
  const onUp = async () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    // 只有真的拖动了才保存，避免误触
    if (moved) {
      try {
        await db.Canvas.save(toPlain(node))
      } catch (e: any) {
        ElMessage.error('保存位置失败：' + e.message)
      }
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
  // 用鼠标位置做兜底检测：如果 hoverNodeId 没更新（比如鼠标快速松开），用坐标命中测试
  let targetId = hoverNodeId.value
  if (!targetId || targetId === fromNodeId) {
    // 坐标命中测试
    const pt = toCanvasCoord(e.clientX, e.clientY)
    for (const n of nodes.value) {
      if (n.id === fromNodeId) continue
      if (pt.x >= n.x && pt.x <= n.x + n.width && pt.y >= n.y && pt.y <= n.y + n.height) {
        targetId = n.id
        break
      }
    }
  }
  dragFrom.value = null
  dragLine.value = ''

  if (!targetId || targetId === fromNodeId) {
    return
  }
  // 建立连线
  const fromNode = nodes.value.find(n => n.id === fromNodeId)
  const toNode = nodes.value.find(n => n.id === targetId)
  if (!fromNode || !toNode) return
  // 避免重复连线（双向检查）
  if (fromNode.links.includes(targetId) || toNode.links.includes(fromNodeId)) {
    ElMessage.info('已存在连接')
    return
  }
  fromNode.links.push(targetId)
  try {
    await db.Canvas.save(toPlain(fromNode))
    ElMessage.success(`已连接：${fromNode.title} → ${toNode.title}`)
  } catch (err: any) {
    ElMessage.error('连线失败：' + err.message)
  }
}

async function addNode(type: CanvasNode['type']) {
  if (!project.value) return
  try {
    const offset = (nodes.value.length % 10) * 30
    // 工作流类型自动设 order：同类型按已有数量 +1
    let order = 0
    if (isWorkflowType(type)) {
      order = nodes.value.filter(n => n.type === type).length
    }
    const node = await db.Canvas.save({
      projectId: project.value.id,
      type,
      x: 80 + offset,
      y: 80 + offset,
      width: 220,
      height: 140,
      title: `新${TYPE_LABELS[type]}`,
      content: '',
      aiPrompt: '',
      order,
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
  form.aiPrompt = node.aiPrompt || ''
  form.order = node.order || 0
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
  node.title = form.title
  node.type = form.type
  node.content = form.content
  node.aiPrompt = form.aiPrompt
  node.order = form.order
  node.color = form.color
  node.links = [...form.links]
  try {
    await db.Canvas.save(toPlain(node))
    ElMessage.success('已保存')
    dialogVisible.value = false
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  }
}

async function saveAll() {
  try {
    for (const n of nodes.value) {
      await db.Canvas.save(toPlain(n))
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
        await db.Canvas.save(toPlain(n))
      }
    }
    await db.Canvas.remove(node.id)
    nodes.value = nodes.value.filter(n => n.id !== node.id)
    ElMessage.success('已删除')
  } catch (e: any) {
    ElMessage.error('删除失败：' + e.message)
  }
}

// ===== 工作流相关功能 =====

// 一键插入标准三幕剧工作流模板（5 个节点）
const WORKFLOW_TEMPLATES: Array<{
  type: CanvasNode['type']
  title: string
  aiPrompt: string
  x: number
  y: number
}> = [
  {
    type: 'start',
    title: '起点：故事开篇',
    aiPrompt: '介绍主角、世界观、初始状态。展示主角的日常生活，让读者了解故事发生的背景与人物处境。',
    x: 80,
    y: 200
  },
  {
    type: 'inciting',
    title: '触发事件：打破平衡',
    aiPrompt: '一个突发事件打破主角的平静生活，迫使主角踏上旅程。事件要有冲击力，明确主角的目标与阻碍。',
    x: 380,
    y: 200
  },
  {
    type: 'rising',
    title: '发展：冲突升级',
    aiPrompt: '主角在追求目标的过程中遇到一系列障碍，冲突不断升级。铺设伏笔，引入新角色或新信息，节奏逐渐加快。',
    x: 680,
    y: 200
  },
  {
    type: 'climax',
    title: '高潮：最大冲突',
    aiPrompt: '全书最大冲突爆发，主角面临最艰难的抉择或最强对手。所有伏笔在此回收，情感与张力达到顶点。',
    x: 980,
    y: 200
  },
  {
    type: 'resolution',
    title: '结局：解决与新生',
    aiPrompt: '冲突解决，主角完成成长。展示新的平衡状态，留下余韵或为后续故事铺垫。',
    x: 1280,
    y: 200
  }
]

async function insertWorkflowTemplate() {
  if (!project.value) return
  if (workflowNodes.value.length > 0) {
    try {
      await ElMessageBox.confirm(
        `已存在 ${workflowNodes.value.length} 个工作流节点，是否继续追加标准三幕剧模板？`,
        '提示',
        { type: 'warning', confirmButtonText: '追加', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }
  try {
    for (const tpl of WORKFLOW_TEMPLATES) {
      const order = nodes.value.filter(n => n.type === tpl.type).length
      const node = await db.Canvas.save({
        projectId: project.value.id,
        type: tpl.type,
        x: tpl.x,
        y: tpl.y + order * 20,
        width: 220,
        height: 140,
        title: tpl.title,
        content: '',
        aiPrompt: tpl.aiPrompt,
        order,
        color: TYPE_COLORS[tpl.type],
        links: [],
        createdAt: Date.now()
      } as any)
      nodes.value.push(node)
    }
    ElMessage.success('已插入 5 个工作流节点，请逐个编辑 AI 提示词')
  } catch (e: any) {
    ElMessage.error('插入失败：' + e.message)
  }
}

// 导出工作流为 Markdown（人类可读 + AI 可读）
async function exportWorkflowMarkdown() {
  if (nodes.value.length === 0) {
    ElMessage.warning('画布为空')
    return
  }
  const proj = project.value
  const lines: string[] = []
  lines.push(`# ${proj?.title || '未命名'} · 故事工作流`)
  lines.push('')
  lines.push('> 以下为按工作流顺序组织的故事节点，AI 可按此结构顺序生成章节内容。')
  lines.push('')

  if (workflowNodes.value.length > 0) {
    lines.push('## 一、核心工作流')
    lines.push('')
    workflowNodes.value.forEach((n, idx) => {
      lines.push(`### ${idx + 1}. ${TYPE_LABELS[n.type]}：${n.title || '未命名'}`)
      lines.push('')
      if (n.aiPrompt) {
        lines.push(`**AI 提示词**：${n.aiPrompt}`)
        lines.push('')
      }
      if (n.content) {
        lines.push('**内容**：')
        lines.push(n.content)
        lines.push('')
      }
      if (n.links.length > 0) {
        const linkTitles = n.links
          .map(id => nodes.value.find(x => x.id === id))
          .filter(Boolean)
          .map(x => `- ${x!.title || TYPE_LABELS[x!.type]}`)
        if (linkTitles.length > 0) {
          lines.push('**关联节点**：')
          lines.push(linkTitles.join('\n'))
          lines.push('')
        }
      }
    })
  }

  const auxNodes = nodes.value.filter(n => !isWorkflowType(n.type))
  if (auxNodes.length > 0) {
    lines.push('## 二、辅助节点')
    lines.push('')
    auxNodes.forEach((n, idx) => {
      lines.push(`### ${idx + 1}. ${TYPE_LABELS[n.type]}：${n.title || '未命名'}`)
      lines.push('')
      if (n.aiPrompt) {
        lines.push(`**AI 提示词**：${n.aiPrompt}`)
        lines.push('')
      }
      if (n.content) {
        lines.push('**内容**：')
        lines.push(n.content)
        lines.push('')
      }
    })
  }

  const md = lines.join('\n')
  try {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${proj?.title || 'story'}-workflow.md`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('已导出 Markdown 文件')
  } catch (e: any) {
    ElMessage.error('导出失败：' + e.message)
  }
}

// 打开 AI 生成对话框
function generateChapterFromWorkflow() {
  if (workflowNodes.value.length === 0) {
    ElMessage.warning('请先添加工作流节点（start/inciting/rising/climax/resolution）或点击「插入工作流模板」')
    return
  }
  generatedText.value = ''
  genForm.chapterId = chapters.value[0]?.id || ''
  genForm.model = settings.settings?.defaultModel || availableModels.value[0]?.model || ''
  genDialogVisible.value = true
}

// 构建发送给 AI 的工作流提示词
function buildWorkflowPrompt(): string {
  const proj = project.value
  const parts: string[] = []
  parts.push(`你是一位资深小说创作者。请根据以下故事工作流，生成一个完整的章节内容。`)
  parts.push('')
  parts.push(`小说标题：${proj?.title || '未命名'}`)
  if (proj?.description) {
    parts.push(`小说简介：${proj.description}`)
  }
  parts.push(`目标字数：约 ${genForm.targetWords} 字`)
  parts.push('')
  parts.push('## 故事工作流（按以下顺序串联生成内容）')
  parts.push('')
  workflowNodes.value.forEach((n, idx) => {
    parts.push(`### 节点 ${idx + 1} · ${TYPE_LABELS[n.type]}：${n.title || '未命名'}`)
    if (n.aiPrompt) {
      parts.push(`要求：${n.aiPrompt}`)
    }
    if (n.content) {
      parts.push(`参考内容：${n.content}`)
    }
    parts.push('')
  })
  parts.push('## 输出要求')
  parts.push('- 严格按工作流节点顺序推进剧情，每个节点的内容自然衔接下一节点')
  parts.push('- 直接输出小说正文，不要输出任何说明、注释或标题')
  parts.push('- 保持文风统一，符合中文小说阅读习惯')
  parts.push('- 控制节奏，确保每个工作流节点的戏份饱满')
  return parts.join('\n')
}

// 调用 AI 流式生成
async function doGenerate() {
  if (!genForm.model) {
    ElMessage.warning('请选择生成模型')
    return
  }
  if (workflowNodes.value.length === 0) {
    ElMessage.warning('没有工作流节点')
    return
  }
  const provider = settings.findProviderForModel(genForm.model)
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置该模型的 API Key')
    return
  }
  generating.value = true
  generatedText.value = ''
  try {
    const prompt = buildWorkflowPrompt()
    let acc = ''
    const fullText = await ai.streamChat(
      ai.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: genForm.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.75
      }),
      (chunk: string) => {
        acc += chunk
        generatedText.value = acc
      }
    )
    generatedText.value = fullText || acc
    ElMessage.success(`已生成 ${generatedText.value.length} 字`)
  } catch (e: any) {
    ElMessage.error('生成失败：' + (e?.message || e))
  } finally {
    generating.value = false
  }
}

// 把生成结果写入章节
async function writeToChapter() {
  if (!generatedText.value) {
    ElMessage.warning('还没有生成内容')
    return
  }
  if (!genForm.chapterId) {
    ElMessage.warning('请选择目标章节')
    return
  }
  const chapter = chapters.value.find(c => c.id === genForm.chapterId)
  if (!chapter) {
    ElMessage.error('章节未找到')
    return
  }
  try {
    const plainText = generatedText.value
    // 简单分段：按换行转 <p>
    const html = plainText
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('')
    const wordCount = plainText.replace(/\s+/g, '').length
    const updated = await db.Chapters.save({
      ...chapter,
      content: html,
      wordCount,
      updatedAt: Date.now()
    })
    Object.assign(chapter, updated)
    ElMessage.success(`已写入「${chapter.title}」(${wordCount} 字)`)
    genDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error('写入失败：' + e.message)
  }
}

async function copyGenerated() {
  try {
    await navigator.clipboard.writeText(generatedText.value)
    ElMessage.success('已复制全文')
  } catch {
    ElMessage.warning('复制失败，请手动选择文本复制')
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
/* 连线模式下仍可拖动方块，只是多了红点用于连线 */
.node.connect-mode {
  cursor: move;
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

/* ===== 工作流概览条 ===== */
.workflow-overview {
  padding: 12px 16px;
  margin-bottom: 16px;
}
.workflow-overview-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 10px;
}
.workflow-steps {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.workflow-step {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--panel);
  border: 2px solid;
  border-radius: var(--radius);
  font-size: 13px;
}
.workflow-step .step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  font-size: 11px;
  font-weight: 600;
}
.workflow-step .step-title {
  color: var(--text);
  font-weight: 500;
}
.step-arrow {
  color: var(--text-3);
}

/* ===== 节点 header（顺序号 + 类型标签） ===== */
.node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.node-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--primary);
  color: white;
  font-size: 11px;
  font-weight: 600;
}
.node.is-workflow {
  border-width: 3px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.node-ai-prompt {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 4px;
  padding: 4px 6px;
  background: rgba(99, 102, 241, 0.08);
  border-left: 2px solid var(--primary);
  border-radius: 3px;
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.4;
  word-break: break-all;
}
.node-ai-prompt .el-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--primary);
}

/* ===== AI 生成对话框 ===== */
.gen-preview {
  width: 100%;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px;
  background: var(--panel-2);
}
.gen-preview-item {
  display: flex;
  gap: 8px;
  padding: 8px 6px;
  border-bottom: 1px dashed var(--border);
}
.gen-preview-item:last-child {
  border-bottom: none;
}
.gen-preview-num {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gen-preview-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text);
}
.gen-preview-prompt {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
  line-height: 1.4;
}
</style>
