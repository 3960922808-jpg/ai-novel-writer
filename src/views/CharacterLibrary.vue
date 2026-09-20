<template>
  <div class="page character-page" v-if="project">
    <div class="page-header character-header">
      <div>
        <div class="header-kicker">STORY CAST</div>
        <h1 class="page-title">角色库</h1>
        <p class="text-muted text-sm">把身份、目标、关系和当前状态整理成 AI 真正能引用的人物档案</p>
      </div>
      <div class="header-actions">
        <el-button round :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
        <el-button round :icon="Plus" @click="openCreate">新建角色</el-button>
        <el-button round type="primary" :icon="Check" :loading="saving" @click="save">保存角色库</el-button>
      </div>
    </div>

    <section class="cast-overview">
      <div class="cast-stat"><strong>{{ characters.length }}</strong><span>角色总数</span></div>
      <div class="cast-stat"><strong>{{ activeCount }}</strong><span>活跃角色</span></div>
      <div class="cast-stat"><strong>{{ camps.length }}</strong><span>阵营数量</span></div>
      <div class="cast-stat"><strong>{{ relationshipCount }}</strong><span>已记录关系</span></div>
    </section>

    <div class="character-toolbar">
      <el-input v-model="keyword" clearable :prefix-icon="Search" placeholder="搜索姓名、身份、阵营或目标…" class="search-input" />
      <el-select v-model="campFilter" clearable placeholder="全部阵营" class="filter-select">
        <el-option v-for="camp in camps" :key="camp" :label="camp" :value="camp" />
      </el-select>
      <el-segmented v-model="viewMode" :options="viewOptions" @change="changeView" />
    </div>

    <template v-if="viewMode === 'cards'">
      <div v-if="filteredCharacters.length" class="character-grid">
        <article v-for="person in filteredCharacters" :key="person.id" class="character-card" @click="openEdit(person)">
          <div class="card-top">
            <div class="avatar" :style="avatarStyle(person.name)">{{ person.name.slice(0, 1) || '?' }}</div>
            <div class="identity"><h2>{{ person.name || '未命名角色' }}</h2><p>{{ person.role || '身份待补充' }}</p></div>
            <el-dropdown trigger="click" @click.stop>
              <button class="more-button"><el-icon><MoreFilled /></el-icon></button>
              <template #dropdown><el-dropdown-menu>
                <el-dropdown-item @click="openEdit(person)">编辑角色</el-dropdown-item>
                <el-dropdown-item @click="duplicateCharacter(person)">复制角色</el-dropdown-item>
                <el-dropdown-item divided @click="removeCharacter(person)">删除角色</el-dropdown-item>
              </el-dropdown-menu></template>
            </el-dropdown>
          </div>
          <div class="card-tags">
            <span v-if="person.camp" class="pill camp-pill">{{ person.camp }}</span>
            <span class="pill" :class="statusClass(person.status)">{{ person.status || '状态未知' }}</span>
            <span v-if="person.location" class="pill"><el-icon><Location /></el-icon>{{ person.location }}</span>
          </div>
          <div class="goal-block"><span>当前目标</span><p>{{ person.goal || '还没有填写这个角色此刻最想完成的事。' }}</p></div>
          <div class="character-meta">
            <span><b>性格</b>{{ person.personality || '待补充' }}</span>
            <span><b>关系</b>{{ person.relationships || '待补充' }}</span>
          </div>
          <div class="card-index">{{ String(characters.indexOf(person) + 1).padStart(2, '0') }}</div>
        </article>
      </div>
      <div v-else class="empty-cast">
        <div class="empty-avatar">+</div>
        <h2>{{ characters.length ? '没有匹配的角色' : '故事还缺少第一位角色' }}</h2>
        <p>{{ characters.length ? '换个关键词或清除阵营筛选试试。' : '先建立主角档案，AI 写作时会自动读取这里的资料。' }}</p>
        <el-button v-if="!characters.length" round type="primary" :icon="Plus" @click="openCreate">创建第一个角色</el-button>
      </div>
      <section v-if="legacyNotes.trim()" class="legacy-notes">
        <div><strong>附加人物资料</strong><span>旧文本中未归入单个角色的内容会完整保留</span></div>
        <el-input v-model="legacyNotes" type="textarea" :rows="5" placeholder="群体设定、关系总览或其他补充资料" />
      </section>
    </template>

    <section v-else class="raw-editor">
      <div class="raw-editor-head"><div><strong>Markdown 原文</strong><span>适合批量粘贴、整体调整，也会被 AI 直接读取</span></div><el-button round @click="formatRaw">整理格式</el-button></div>
      <el-input v-model="rawContent" type="textarea" :rows="28" placeholder="使用“## 角色名”建立人物档案" />
    </section>

    <el-drawer v-model="drawerVisible" :title="editingIndex < 0 ? '创建角色' : '编辑角色'" size="520px" append-to-body class="character-drawer">
      <div class="drawer-profile">
        <div class="avatar large" :style="avatarStyle(draft.name)">{{ draft.name.slice(0, 1) || '?' }}</div>
        <div><strong>{{ draft.name || '新角色' }}</strong><span>{{ draft.role || '补全资料，让人物行动更一致' }}</span></div>
      </div>
      <el-form label-position="top" class="character-form">
        <div class="form-grid">
          <el-form-item label="姓名" required><el-input v-model="draft.name" placeholder="角色姓名" /></el-form-item>
          <el-form-item label="身份"><el-input v-model="draft.role" placeholder="主角、导师、反派…" /></el-form-item>
          <el-form-item label="阵营"><el-input v-model="draft.camp" placeholder="所属组织或立场" /></el-form-item>
          <el-form-item label="当前位置"><el-input v-model="draft.location" placeholder="角色当前所在地点" /></el-form-item>
          <el-form-item label="当前状态"><el-select v-model="draft.status" allow-create filterable style="width:100%"><el-option v-for="item in statusOptions" :key="item" :label="item" :value="item" /></el-select></el-form-item>
          <el-form-item label="性格关键词"><el-input v-model="draft.personality" placeholder="冷静、敏锐、护短" /></el-form-item>
        </div>
        <el-form-item label="当前目标"><el-input v-model="draft.goal" type="textarea" :rows="3" placeholder="这个角色此刻想得到什么？失败会失去什么？" /></el-form-item>
        <el-form-item label="人物关系"><el-input v-model="draft.relationships" type="textarea" :rows="3" placeholder="与其他角色的关系、态度及最近变化" /></el-form-item>
        <el-form-item label="秘密与底牌"><el-input v-model="draft.secret" type="textarea" :rows="3" placeholder="尚未公开的秘密、能力限制或隐藏动机" /></el-form-item>
        <el-form-item label="补充资料"><el-input v-model="draft.notes" type="textarea" :rows="4" placeholder="外貌、习惯、语言特征、人物弧光等" /></el-form-item>
      </el-form>
      <template #footer><el-button round @click="drawerVisible = false">取消</el-button><el-button round type="primary" @click="commitDraft">保存到角色库</el-button></template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ArrowLeft, Check, Location, MoreFilled, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { Truths } from '@/services/db'
import type { TruthFile } from '@/types'

interface CharacterRecord { id: string; name: string; role: string; camp: string; location: string; status: string; goal: string; personality: string; relationships: string; secret: string; notes: string }
const projectStore = useProjectStore()
const project = computed(() => projectStore.current)
const saving = ref(false)
const file = ref<TruthFile | null>(null)
const characters = ref<CharacterRecord[]>([])
const legacyNotes = ref('')
const rawContent = ref('')
const keyword = ref('')
const campFilter = ref('')
const viewMode = ref<'cards' | 'raw'>('cards')
const viewOptions = [{ label: '人物卡片', value: 'cards' }, { label: 'Markdown', value: 'raw' }]
const drawerVisible = ref(false)
const editingIndex = ref(-1)
const statusOptions = ['活跃', '失踪', '受伤', '被困', '离队', '死亡', '未知']
function emptyCharacter(): CharacterRecord { return { id: crypto.randomUUID(), name: '', role: '', camp: '', location: '', status: '活跃', goal: '', personality: '', relationships: '', secret: '', notes: '' } }
const draft = reactive<CharacterRecord>(emptyCharacter())
const camps = computed(() => [...new Set(characters.value.map(item => item.camp.trim()).filter(Boolean))].sort())
const activeCount = computed(() => characters.value.filter(item => !['死亡', '失踪', '离队'].includes(item.status)).length)
const relationshipCount = computed(() => characters.value.filter(item => item.relationships.trim()).length)
const filteredCharacters = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return characters.value.filter(item => (!campFilter.value || item.camp === campFilter.value) && (!query || [item.name, item.role, item.camp, item.location, item.goal, item.personality, item.relationships].some(value => value.toLowerCase().includes(query))))
})
onMounted(load)
async function load() { if (!project.value) return; const files = await Truths.list(project.value.id); file.value = files.find(f => f.key === 'character_matrix') || null; rawContent.value = file.value?.content || ''; parseContent(rawContent.value) }

const FIELD_MAP: Record<string, keyof CharacterRecord> = { '身份': 'role', '角色': 'role', '阵营': 'camp', '位置': 'location', '当前位置': 'location', '状态': 'status', '当前状态': 'status', '目标': 'goal', '当前目标': 'goal', '性格': 'personality', '性格关键词': 'personality', '关系': 'relationships', '人物关系': 'relationships', '秘密': 'secret', '秘密与底牌': 'secret', '备注': 'notes', '补充资料': 'notes' }
function parseContent(source: string) {
  const parsed: CharacterRecord[] = []; const leftovers: string[] = []; const headings = [...source.matchAll(/^##\s+(.+)$/gm)]
  if (headings.length) {
    const prefix = source.slice(0, headings[0].index).trim(); if (prefix && prefix !== '# 角色库') leftovers.push(prefix.replace(/^#\s+角色库\s*/i, '').trim())
    headings.forEach((match, index) => {
      const start = (match.index || 0) + match[0].length; const end = index + 1 < headings.length ? headings[index + 1].index! : source.length
      if (match[1].trim() === '附加人物资料') { const extra = source.slice(start, end).trim(); if (extra) leftovers.push(extra); return }
      const person = emptyCharacter(); person.name = match[1].trim(); const loose: string[] = []
      for (const line of source.slice(start, end).trim().split(/\r?\n/)) { const field = line.match(/^[-*]\s*([^：:]+)[：:]\s*(.*)$/); const key = field ? FIELD_MAP[field[1].trim()] : undefined; if (field && key) person[key] = field[2].trim(); else if (line.trim()) loose.push(line.trim()) }
      if (loose.length) person.notes = [person.notes, loose.join('\n')].filter(Boolean).join('\n'); parsed.push(person)
    })
  } else {
    for (const line of source.split(/\r?\n/)) { const simple = line.match(/^[-*]\s*([^：:]+)[：:]\s*(.+)$/); if (simple) { const person = emptyCharacter(); person.name = simple[1].trim(); person.notes = simple[2].trim(); parsed.push(person) } else if (line.trim()) leftovers.push(line.trim()) }
  }
  characters.value = parsed; legacyNotes.value = leftovers.join('\n')
}
function serializeContent(): string {
  const blocks = characters.value.map(person => { const fields = [['身份', person.role], ['阵营', person.camp], ['当前位置', person.location], ['当前状态', person.status], ['当前目标', person.goal], ['性格关键词', person.personality], ['人物关系', person.relationships], ['秘密与底牌', person.secret], ['补充资料', person.notes]].filter(([, value]) => value.trim()); return `## ${person.name.trim() || '未命名角色'}\n${fields.map(([label, value]) => `- ${label}：${value.trim()}`).join('\n')}` })
  const extra = legacyNotes.value.trim() ? `## 附加人物资料\n${legacyNotes.value.trim()}` : ''; return ['# 角色库', ...blocks, extra].filter(Boolean).join('\n\n').trim()
}
function changeView(next: string | number | boolean) { if (next === 'raw') rawContent.value = serializeContent(); else parseContent(rawContent.value) }
function openCreate() { editingIndex.value = -1; Object.assign(draft, emptyCharacter()); drawerVisible.value = true }
function openEdit(person: CharacterRecord) { editingIndex.value = characters.value.findIndex(item => item.id === person.id); Object.assign(draft, JSON.parse(JSON.stringify(person))); drawerVisible.value = true }
function commitDraft() { if (!draft.name.trim()) return void ElMessage.warning('请填写角色姓名'); const record = JSON.parse(JSON.stringify(draft)) as CharacterRecord; if (editingIndex.value >= 0) characters.value[editingIndex.value] = record; else characters.value.unshift(record); drawerVisible.value = false; ElMessage.success(editingIndex.value >= 0 ? '角色资料已更新，记得保存角色库' : '角色已加入角色库，记得保存') }
function duplicateCharacter(person: CharacterRecord) { characters.value.unshift({ ...JSON.parse(JSON.stringify(person)), id: crypto.randomUUID(), name: `${person.name}·副本` }); ElMessage.success('已复制角色') }
async function removeCharacter(person: CharacterRecord) { try { await ElMessageBox.confirm(`确定删除角色“${person.name}”吗？保存角色库后才会真正写入。`, '删除角色', { type: 'warning' }); characters.value = characters.value.filter(item => item.id !== person.id) } catch { /* 用户取消 */ } }
function formatRaw() { parseContent(rawContent.value); rawContent.value = serializeContent(); ElMessage.success('已按角色档案格式整理') }
async function save() { if (!project.value) return; saving.value = true; try { if (viewMode.value === 'raw') parseContent(rawContent.value); const content = serializeContent(); rawContent.value = content; file.value = await Truths.save({ ...(file.value || {}), projectId: project.value.id, key: 'character_matrix', title: '角色矩阵', content, updatedAt: Date.now() }); ElMessage.success(`角色库已保存，共 ${characters.value.length} 位角色`) } catch (e: any) { ElMessage.error('保存失败：' + (e?.message || e)) } finally { saving.value = false } }
function avatarStyle(name: string) { const palettes = [['#e8edf5', '#65758b'], ['#ece9f5', '#746989'], ['#e7f0ed', '#5d7d73'], ['#f3ebe6', '#8a6e5d'], ['#f1e9ec', '#8a6671'], ['#e9edf0', '#687681']]; const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0); const [background, color] = palettes[hash % palettes.length]; return { background, color } }
function statusClass(status: string) { if (status === '活跃') return 'status-active'; if (['死亡', '失踪'].includes(status)) return 'status-danger'; if (['受伤', '被困'].includes(status)) return 'status-warning'; return 'status-muted' }
</script>

<style scoped>
.character-page{overflow:auto;padding-bottom:42px}.character-header{align-items:flex-end}.header-kicker{margin-bottom:7px;color:var(--primary);font-size:10px;font-weight:800;letter-spacing:.24em}.character-header .page-title{margin-bottom:5px;font-size:30px;letter-spacing:-.04em}.character-header p{margin:0}.header-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.cast-overview{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin:20px 0 16px;overflow:hidden;border:1px solid var(--border);border-radius:20px;background:var(--border)}.cast-stat{display:flex;min-height:82px;flex-direction:column;justify-content:center;padding:14px 20px;background:var(--panel)}.cast-stat strong{color:var(--text);font-size:24px;font-weight:700;line-height:1}.cast-stat span{margin-top:8px;color:var(--text-3);font-size:11px;letter-spacing:.08em}.character-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px}.search-input{flex:1}.filter-select{width:180px}.character-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:14px}.character-card{position:relative;min-height:270px;padding:18px;overflow:hidden;border:1px solid var(--border);border-radius:22px;background:var(--panel);box-shadow:0 8px 30px rgba(30,41,59,.035);cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}.character-card:hover{border-color:color-mix(in srgb,var(--primary) 32%,var(--border));box-shadow:0 16px 38px rgba(30,41,59,.08);transform:translateY(-3px)}.card-top{display:flex;align-items:center;gap:12px}.avatar{display:grid;width:46px;height:46px;flex:0 0 46px;place-items:center;border-radius:16px;font-size:19px;font-weight:750}.avatar.large{width:58px;height:58px;flex-basis:58px;border-radius:19px;font-size:24px}.identity{flex:1;min-width:0}.identity h2{margin:0;overflow:hidden;color:var(--text);font-size:17px;text-overflow:ellipsis;white-space:nowrap}.identity p{margin:4px 0 0;overflow:hidden;color:var(--text-3);font-size:12px;text-overflow:ellipsis;white-space:nowrap}.more-button{display:grid;width:30px;height:30px;place-items:center;border:0;border-radius:999px;color:var(--text-3);background:transparent;cursor:pointer}.more-button:hover{color:var(--text);background:var(--panel-2)}.card-tags{display:flex;min-height:25px;flex-wrap:wrap;gap:6px;margin:16px 0 13px}.pill{display:inline-flex;align-items:center;gap:3px;padding:4px 8px;border-radius:999px;color:var(--text-2);background:var(--panel-2);font-size:10px}.camp-pill{color:var(--primary);background:color-mix(in srgb,var(--primary) 10%,transparent)}.status-active{color:#278267;background:rgba(39,130,103,.1)}.status-warning{color:#a56b22;background:rgba(165,107,34,.1)}.status-danger{color:#a85050;background:rgba(168,80,80,.1)}.goal-block{padding:12px 13px;border-radius:15px;background:var(--panel-2)}.goal-block span{color:var(--text-3);font-size:10px;font-weight:700;letter-spacing:.08em}.goal-block p{display:-webkit-box;margin:6px 0 0;overflow:hidden;color:var(--text-2);font-size:12px;line-height:1.55;-webkit-box-orient:vertical;-webkit-line-clamp:2}.character-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.character-meta span{overflow:hidden;color:var(--text-3);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.character-meta b{margin-right:6px;color:var(--text-2);font-weight:650}.card-index{position:absolute;right:16px;bottom:10px;color:color-mix(in srgb,var(--text-3) 28%,transparent);font-size:22px;font-weight:800;letter-spacing:-.06em}.empty-cast{display:flex;min-height:360px;align-items:center;justify-content:center;flex-direction:column;border:1px dashed var(--border);border-radius:24px;background:var(--panel);text-align:center}.empty-avatar{display:grid;width:62px;height:62px;place-items:center;border-radius:22px;color:var(--text-3);background:var(--panel-2);font-size:30px;font-weight:300}.empty-cast h2{margin:17px 0 6px;color:var(--text);font-size:17px}.empty-cast p{max-width:390px;margin:0 0 18px;color:var(--text-3);font-size:12px;line-height:1.6}.legacy-notes,.raw-editor{margin-top:16px;padding:18px;border:1px solid var(--border);border-radius:20px;background:var(--panel)}.legacy-notes>div,.raw-editor-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px}.legacy-notes strong,.raw-editor-head strong{color:var(--text);font-size:14px}.legacy-notes span,.raw-editor-head span{display:block;margin-top:4px;color:var(--text-3);font-size:11px}.drawer-profile{display:flex;align-items:center;gap:14px;padding:15px;margin-bottom:18px;border-radius:18px;background:var(--panel-2)}.drawer-profile>div:last-child{display:flex;min-width:0;flex-direction:column;gap:4px}.drawer-profile strong{color:var(--text);font-size:16px}.drawer-profile span{color:var(--text-3);font-size:11px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.character-form :deep(.el-input__wrapper),.character-form :deep(.el-textarea__inner),.raw-editor :deep(.el-textarea__inner),.legacy-notes :deep(.el-textarea__inner){border-radius:13px}@media(max-width:900px){.character-header{align-items:flex-start;flex-direction:column;gap:15px}.cast-overview{grid-template-columns:repeat(2,1fr)}.character-toolbar{align-items:stretch;flex-direction:column}.filter-select{width:100%}}@media(max-width:560px){.form-grid{grid-template-columns:1fr}}
</style>
