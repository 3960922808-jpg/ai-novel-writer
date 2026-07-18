<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <div>
        <h1 class="page-title">导出《{{ project?.title || '未命名' }}》</h1>
        <p class="text-muted text-sm">将小说导出为不同格式，方便阅读、分享与发布</p>
      </div>
      <el-button :icon="ArrowLeft" @click="$router.push({ name: 'dashboard' })">返回</el-button>
    </div>

    <div class="grid grid-3">
      <div v-for="fmt in formats" :key="fmt.key" class="export-card card">
        <div class="fmt-icon" :style="{ background: fmt.color }">
          <el-icon :size="26"><component :is="fmt.icon" /></el-icon>
        </div>
        <div class="fmt-body">
          <div class="fmt-name">{{ fmt.name }}</div>
          <div class="fmt-desc text-muted text-sm">{{ fmt.desc }}</div>
          <el-button
            type="primary"
            :icon="Download"
            :loading="exporting === fmt.key"
            @click="doExport(fmt.key)"
          >
            导出 {{ fmt.ext }}
          </el-button>
        </div>
      </div>
    </div>

    <div class="card tip-card">
      <el-icon :size="18" class="tip-icon"><InfoFilled /></el-icon>
      <div>
        <div class="tip-title">导出说明</div>
        <div class="text-muted text-sm">
          导出内容包含所有已完成章节，按章节顺序排列。导出文件将保存到默认下载目录，您也可以在弹出的对话框中选择保存位置。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, ArrowLeft, Document, Files, InfoFilled } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/project'

type ExportKey = 'md' | 'html' | 'epub' | 'docx' | 'pdf'

const projectStore = useProjectStore()
const route = useRoute()
const project = computed(() => projectStore.current)

onMounted(async () => {
  if (!project.value) {
    const id = route.params.id as string
    if (id) await projectStore.loadProject(id)
  }
})

const loading = ref(false)
const exporting = ref<ExportKey | null>(null)

const formats = [
  {
    key: 'md' as ExportKey,
    name: 'Markdown',
    ext: '.md',
    desc: '通用纯文本格式，便于版本管理与转换',
    color: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    icon: Document
  },
  {
    key: 'html' as ExportKey,
    name: 'HTML',
    ext: '.html',
    desc: '网页格式，可直接在浏览器中查看',
    color: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    icon: Files
  },
  {
    key: 'epub' as ExportKey,
    name: 'EPUB',
    ext: '.epub',
    desc: '电子书格式，适配 Kindle 等阅读器',
    color: 'linear-gradient(135deg, #10b981, #06b6d4)',
    icon: Files
  },
  {
    key: 'docx' as ExportKey,
    name: 'DOCX',
    ext: '.docx',
    desc: 'Word 文档格式，便于编辑与排版',
    color: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    icon: Document
  },
  {
    key: 'pdf' as ExportKey,
    name: 'PDF',
    ext: '.pdf',
    desc: '打印格式，跨平台显示一致',
    color: 'linear-gradient(135deg, #ec4899, #ef4444)',
    icon: Files
  }
]

async function doExport(key: ExportKey) {
  if (!project.value) {
    ElMessage.warning('请先选择项目')
    return
  }
  exporting.value = key
  try {
    const pid = project.value.id
    let path: string | null = null
    if (key === 'md') path = await window.api.export.toMarkdown(pid)
    else if (key === 'html') path = await window.api.export.toHTML(pid)
    else if (key === 'epub') path = await window.api.export.toEPUB(pid)
    else if (key === 'docx') path = await window.api.export.toDOCX(pid)
    else if (key === 'pdf') path = await window.api.export.toPDF(pid)

    if (path) {
      ElMessage.success(`导出成功，已保存到：${path}`)
    } else {
      ElMessage.info('已取消')
    }
  } catch (e: any) {
    ElMessage.error('导出失败：' + (e?.message || '未知错误'))
  } finally {
    exporting.value = null
  }
}
</script>

<style scoped>
.export-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  transition: transform 0.15s, box-shadow 0.15s;
}
.export-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}
.fmt-icon {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.fmt-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.fmt-name {
  font-size: 16px;
  font-weight: 600;
}
.fmt-desc {
  line-height: 1.5;
  min-height: 36px;
}
.tip-card {
  margin-top: 20px;
  padding: 16px 20px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.tip-icon {
  color: var(--primary);
  flex-shrink: 0;
  margin-top: 2px;
}
.tip-title {
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
