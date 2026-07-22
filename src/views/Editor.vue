<template>
  <div class="editor-root" v-if="project && chapter">
    <!-- 顶部通栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <button class="tb-icon-btn" @click="goBack" title="返回">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <button class="tb-icon-btn" :disabled="!prevChapter" @click="prevChapter && goChapter(prevChapter)" title="上一章">
          <el-icon><Back /></el-icon>
        </button>
        <button class="tb-icon-btn" :disabled="!nextChapter" @click="nextChapter && goChapter(nextChapter)" title="下一章">
          <el-icon><Right /></el-icon>
        </button>
        <button class="tb-icon-btn" @click="searchVisible = !searchVisible" title="搜索">
          <el-icon><Search /></el-icon>
        </button>
        <span class="word-count-pill">字数: {{ wordCount }}</span>
      </div>

      <div class="topbar-center">
        <button class="tb-fn-btn" :class="{ 'tb-fn-active': askMode === 'auto' }" @click="setAskMode('auto')" title="AI 仅在卡壳时提问">
          <el-icon><ChatLineSquare /></el-icon><span>智能提问</span>
        </button>
        <button class="tb-fn-btn" :class="{ 'tb-fn-active': askMode === 'always' }" @click="setAskMode('always')" title="每段都让 AI 提问">
          <el-icon><QuestionFilled /></el-icon><span>每段提问</span>
        </button>
        <button class="tb-fn-btn" :class="{ 'tb-fn-active': askMode === 'never' }" @click="setAskMode('never')" title="从不提问，直接续写">
          <el-icon><Promotion /></el-icon><span>不提问</span>
        </button>
        <span class="tb-sep"></span>
        <button class="tb-fn-btn" @click="runTopAction('depolish')">
          <el-icon><Brush /></el-icon><span>AI消痕</span>
        </button>
        <button class="tb-fn-btn tb-fn-danger" @click="runTopAction('typo')">
          <el-icon><Warning /></el-icon><span>错AI检查</span>
        </button>
        <button class="tb-fn-btn" @click="runTopAction('format')">
          <el-icon><Grid /></el-icon><span>智能排版</span>
        </button>
        <button class="tb-fn-btn" @click="runTopAction('time Machine')">
          <el-icon><Timer /></el-icon><span>时光机</span>
        </button>
      </div>

      <div class="topbar-right">
        <el-select v-model="chatSessionId" size="small" placeholder="对话 ▽" style="width: 130px">
          <el-option label="默认对话" value="default" />
        </el-select>
        <button class="tb-icon-btn" @click="newConversation" title="新建对话">
          <el-icon><Plus /></el-icon>
        </button>
        <button class="tb-icon-btn" @click="historyVisible = !historyVisible" title="历史记录">
          <el-icon><Clock /></el-icon>
        </button>
      </div>
    </header>

    <!-- 搜索条 -->
    <div v-if="searchVisible" class="search-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="在当前章节中搜索..."
        size="small"
        clearable
        @input="doSearch"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <span class="text-faint text-xs">{{ searchMatches }} 个结果</span>
    </div>

    <!-- 主体三栏 -->
    <div class="main-area">
      <!-- 左侧栏 -->
      <aside class="left-panel" :class="{ collapsed: leftCollapsed }">
        <!-- 文档树 -->
        <div class="tree-section">
          <div class="tree-header">
            <span class="tree-title">文档目录</span>
            <el-button text size="small" :icon="Plus" @click="newChapterAfter" title="新建章节" />
          </div>
          <div class="tree-body">
            <!-- 项目根 -->
            <div class="tree-node root-node">
              <div class="tree-row root-row">
                <el-icon class="tree-icon"><Folder /></el-icon>
                <span class="tree-label">{{ project.title || '未命名' }}</span>
              </div>
              <!-- 主要内容 -->
              <div class="tree-children">
                <div class="tree-node">
                  <div class="tree-row" @click="toggleMainContent">
                    <el-icon class="tree-toggle">
                      <ArrowDown v-if="mainContentExpanded" /><ArrowRight v-else />
                    </el-icon>
                    <el-icon class="tree-icon"><Folder /></el-icon>
                    <span class="tree-label">主要内容</span>
                  </div>
                  <div v-if="mainContentExpanded" class="tree-children">
                    <div
                      v-for="c in projectStore.chapters"
                      :key="c.id"
                      class="tree-row leaf-row"
                      :class="{ active: c.id === chapter?.id }"
                      @click="goChapter(c)"
                    >
                      <el-icon class="tree-icon"><Document /></el-icon>
                      <span class="tree-label">第{{ c.order }}章 · {{ c.title }}</span>
                    </div>
                  </div>
                </div>
                <!-- 快捷入口 -->
                <div class="tree-row leaf-row" @click="$router.push({ name: 'lore' })">
                  <el-icon class="tree-icon"><Collection /></el-icon>
                  <span class="tree-label">设定</span>
                </div>
                <div class="tree-row leaf-row" @click="$router.push({ name: 'lore' })">
                  <el-icon class="tree-icon"><Files /></el-icon>
                  <span class="tree-label">知识库</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI 分析 -->
        <div class="ai-analysis-section">
          <div class="section-title">AI 分析</div>
          <div class="analysis-list">
            <button class="analysis-item" @click="runAnalysis('plot')">
              <el-icon><DataAnalysis /></el-icon><span>剧情分析</span>
            </button>
            <button class="analysis-item" @click="runAnalysis('holes')">
              <el-icon><Warning /></el-icon><span>漏洞分析</span>
            </button>
          </div>
          <div class="analysis-actions">
            <el-button size="small" :icon="Upload" @click="uploadAttachment">上传文件</el-button>
            <el-button size="small" :icon="Download" @click="exportCurrent">导出</el-button>
          </div>
          <!-- 保存作品按钮（位于上传文件/导出下方） -->
          <button class="save-work-btn" :class="{ saving: saveStatus === 'saving' }" @click="save()">
            <el-icon v-if="saveStatus === 'saving'"><Loading /></el-icon>
            <span>{{ saveStatus === 'saving' ? '保存中...' : '保存作品' }}</span>
          </button>
        </div>
      </aside>

      <!-- 收起按钮 -->
      <button class="collapse-left" @click="leftCollapsed = !leftCollapsed" :title="leftCollapsed ? '展开' : '收起'">
        <el-icon><DArrowLeft v-if="!leftCollapsed" /><DArrowRight v-else /></el-icon>
      </button>

      <!-- 中间编辑区 -->
      <main class="editor-main">
        <!-- 章节标题区 -->
        <div class="chapter-head">
          <div class="chapter-title-row">
            <h1 class="chapter-title" contenteditable="true" @blur="onTitleBlur" v-text="chapter.title"></h1>
            <div class="chapter-actions">
              <button class="chap-icon" @click="copyChapterText" title="复制文本"><el-icon><DocumentCopy /></el-icon></button>
              <button class="chap-icon" @click="speakChapter" title="朗读"><el-icon><Microphone /></el-icon></button>
              <button class="chap-icon" @click="highlightSel" title="高亮标记"><el-icon><Star /></el-icon></button>
              <button class="chap-icon" @click="clearChapter" title="清空内容"><el-icon><Delete /></el-icon></button>
              <button class="chap-icon" @click="copyChapterText" title="一键复制"><el-icon><CopyDocument /></el-icon></button>
            </div>
          </div>

          <!-- 章节概要卡片 -->
          <div class="summary-card" v-show="!headCollapsed">
            <div class="summary-left">
              <el-icon><Document /></el-icon>
              <span>章节概要</span>
            </div>
            <div class="summary-right">
              <el-button text size="small" :icon="MagicStick" :loading="generating" @click="generateSummary">总结当前章节</el-button>
              <el-button text size="small" @click="batchSummary">批量生成概要 &gt;</el-button>
            </div>
            <div class="summary-content" v-if="chapter.summary">{{ chapter.summary }}</div>
            <div class="summary-content text-faint" v-else>暂无概要，可点击"总结当前章节"由 AI 自动生成</div>
          </div>
        </div>

        <!-- 收起箭头：点击收起章节标题/概要区，给编辑区让出更多空间 -->
        <button
          class="collapse-head-btn"
          :class="{ collapsed: headCollapsed }"
          :title="headCollapsed ? '展开章节概要' : '收起章节概要'"
          @click="headCollapsed = !headCollapsed"
        >
          <el-icon><ArrowDown v-if="!headCollapsed" /><ArrowRight v-else /></el-icon>
        </button>

        <!-- 编辑区 -->
        <div class="write-area" :style="{ fontFamily: editorFont }">
          <div class="editor-toolbar" v-if="editor">
            <button class="tb-btn" @click="editor.chain().focus().undo().run()" title="撤销"><el-icon><RefreshLeft /></el-icon></button>
            <button class="tb-btn" @click="editor.chain().focus().redo().run()" title="重做"><el-icon><RefreshRight /></el-icon></button>
            <span class="tb-sep"></span>
            <button class="tb-btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()"><b>B</b></button>
            <button class="tb-btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()"><i>I</i></button>
            <button class="tb-btn" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()"><s>S</s></button>
            <span class="tb-sep"></span>
            <button class="tb-btn" :class="{ active: editor.isActive('paragraph') }" @click="editor.chain().focus().setParagraph().run()">正文</button>
            <button class="tb-btn" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
            <button class="tb-btn" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
            <span class="tb-sep"></span>
            <button class="tb-btn" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()" title="引用"><el-icon><ChatLineRound /></el-icon></button>
            <button class="tb-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" title="列表"><el-icon><List /></el-icon></button>
          </div>
          <div class="write-scroll">
            <editor-content :editor="editor" class="tiptap-content" v-if="editor" />
          </div>
        </div>

        <!-- 底部状态 -->
        <div class="editor-footer">
          <el-tag size="small" effect="plain">{{ chapter.status }}</el-tag>
          <span class="text-faint text-xs">字数 {{ wordCount }}</span>
          <span class="save-status" :class="saveStatusClass">{{ saveStatusText }}</span>
        </div>
      </main>

      <!-- 右侧 AI 对话面板 -->
      <aside class="right-panel">
        <!-- 对话显示区 -->
        <div class="chat-display">
          <div v-if="chatMessages.length === 0" class="chat-empty">
            <div class="chat-bubble-icon">
              <el-icon><ChatDotRound /></el-icon>
            </div>
            <p class="chat-empty-title">对话区域</p>
            <p class="chat-empty-tip">输入任何你对小说的疑问，比如"剧情走向如何调整"，"文章建议"。</p>
            <p class="chat-empty-tip">提示：输入 <code class="hint-code">/</code> 可触发技能，输入 <code class="hint-code">@</code> 可关联章节内容</p>
            <button class="canvas-link-btn" :class="{ 'canvas-linked': canvasLinked }" @click="linkCanvas">
              <el-icon><Connection /></el-icon>
              <span>{{ canvasLinked ? '已链接故事画布' : '链接故事画布' }}</span>
            </button>
          </div>
          <div v-else class="chat-list">
            <div
              v-for="(msg, i) in chatMessages"
              :key="i"
              class="chat-msg"
              :class="msg.role"
            >
              <div class="chat-msg-role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
              <!-- AI 提问卡片（ABCD 选项） -->
              <div v-if="msg.role === 'assistant' && msg.options && msg.options.length" class="chat-options-card">
                <div class="chat-msg-content">{{ msg.content }}</div>
                <div class="options-list">
                  <button
                    v-for="(opt, oi) in msg.options"
                    :key="oi"
                    class="option-btn"
                    :class="{ selected: msg.selectedOption === oi, custom: opt.isCustom }"
                    @click="answerQuestion(msg, oi)"
                  >
                    <span class="option-letter">{{ String.fromCharCode(65 + oi) }}</span>
                    <span class="option-text">{{ opt.text }}</span>
                  </button>
                </div>
                <div v-if="msg.selectedOption !== undefined" class="option-selected-hint">
                  已选择 {{ String.fromCharCode(65 + msg.selectedOption) }}，继续生成中...
                </div>
              </div>
              <!-- AI 普通输出：圆角长方形卡片 -->
              <div v-else-if="msg.role === 'assistant' && msg.content" class="ai-output-card">
                <!-- 顶部右上角操作按钮 -->
                <div class="ai-output-top">
                  <div class="ai-output-actions top-actions">
                    <button class="ai-act-btn" title="替换正文" @click="replaceOutput(msg.content)">
                      <el-icon><Switch /></el-icon>
                    </button>
                    <button class="ai-act-btn" title="追加到正文" @click="appendOutput(msg.content)">
                      <el-icon><DocumentAdd /></el-icon>
                    </button>
                  </div>
                </div>
                <!-- 内容区 -->
                <div class="ai-output-content" v-html="renderMessage(msg.content)"></div>
                <!-- 底部图标按钮（无文字） -->
                <div class="ai-output-actions bottom-actions">
                  <button class="ai-act-btn" title="重新生成" @click="regenerateMsg(i)" :disabled="generating">
                    <el-icon><Refresh /></el-icon>
                  </button>
                  <button class="ai-act-btn" title="删除" @click="deleteMsg(i)">
                    <el-icon><Delete /></el-icon>
                  </button>
                  <button class="ai-act-btn" title="复制" @click="copyText(msg.content)">
                    <el-icon><DocumentCopy /></el-icon>
                  </button>
                </div>
              </div>
              <!-- 用户消息 -->
              <div v-else class="chat-msg-content" v-html="renderMessage(msg.content)"></div>
            </div>
            <div v-if="generating" class="chat-msg assistant">
              <div class="chat-msg-role">AI</div>
              <div class="ai-output-card streaming-card">
                <div class="ai-output-content streaming">{{ aiStreamingText }}<span class="cursor">▌</span></div>
                <div class="ai-output-actions bottom-actions">
                  <button class="ai-act-btn danger" title="停止生成" @click="stopGenerate">
                    <el-icon><VideoPause /></el-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 关联片段 -->
        <div class="link-section">
          <div class="link-row">
            <el-button text size="small" :icon="Link" @click="linkCurrentChapter">@关联内容</el-button>
            <el-button text size="small" :icon="Upload" @click="uploadAttachment">添加文件</el-button>
            <span class="text-faint text-xs">总计:{{ linkedWordsCount }}字 ({{ linkedItems.length }}个片段)</span>
          </div>
          <div class="linked-tags" v-if="linkedItems.length">
            <el-tag
              v-for="(item, i) in linkedItems"
              :key="i"
              size="small"
              closable
              @close="linkedItems.splice(i, 1)"
            >{{ item.label }}</el-tag>
          </div>
        </div>

        <!-- 指令输入区 -->
        <div class="input-area">
          <!-- 已选技能 chip -->
          <div v-if="pendingSkill" class="skill-chip-row">
            <el-tag
              type="primary"
              size="small"
              closable
              @close="clearPendingSkill"
            >
              <el-icon style="vertical-align: -2px; margin-right: 2px"><MagicStick /></el-icon>
              {{ pendingSkill.name }}
            </el-tag>
            <span class="text-faint text-xs">技能已选中，输入补充说明后发送（或直接发送）</span>
          </div>
          <div class="chat-input-wrap">
            <textarea
              ref="inputRef"
              v-model="userInput"
              class="chat-input"
              placeholder="请输入指令，输入 @ 关联地点/设定/章节，输入 / 触发技能"
              rows="4"
              @input="onInput"
              @keydown="onKeydown"
            ></textarea>
            <!-- 显眼的“发送需求”按钮（textarea 右下角浮动） -->
            <button
              class="send-demand-btn"
              :class="{ disabled: !canSend || generating }"
              :disabled="!canSend || generating"
              @click="sendChat"
              :title="generating ? 'AI 正在生成…' : '点击发送需求（Enter）'"
            >
              <el-icon v-if="generating" class="loading-icon"><Loading /></el-icon>
              <el-icon v-else><Promotion /></el-icon>
              <span>{{ generating ? '生成中' : '发送需求' }}</span>
            </button>
          </div>

          <!-- 技能弹出菜单 -->
          <div v-if="slashMenuVisible" class="slash-menu">
            <div class="slash-menu-header">
              <span>技能列表</span>
              <span class="text-faint text-xs">{{ filteredSkills.length }} 个</span>
            </div>
            <div class="slash-menu-list">
              <button
                v-for="s in filteredSkills"
                :key="s.id"
                class="slash-menu-item"
                @click="pickSkill(s)"
              >
                <el-icon class="slash-icon"><MagicStick /></el-icon>
                <div class="slash-item-body">
                  <div class="slash-item-name">{{ s.name }}</div>
                  <div class="slash-item-desc text-faint text-xs">{{ s.description || s.category }}</div>
                </div>
              </button>
              <div v-if="filteredSkills.length === 0" class="slash-empty text-faint text-xs">
                没有匹配的技能
              </div>
            </div>
          </div>

          <!-- @ 关联弹出菜单（轻量内嵌下拉，仅展示前 8 项，点击更多打开多选小窗） -->
          <div v-if="atMenuVisible" class="slash-menu at-menu">
            <div class="slash-menu-header">
              <span>关联内容（@）</span>
              <span class="text-faint text-xs">{{ atMatches.length }} 项</span>
            </div>
            <div class="slash-menu-list">
              <button
                v-for="(m, i) in atMatches.slice(0, 8)"
                :key="i"
                class="slash-menu-item"
                @click="pickAtMatch(m)"
              >
                <el-icon class="slash-icon"><component :is="m.icon" /></el-icon>
                <div class="slash-item-body">
                  <div class="slash-item-name">{{ m.label }} <span class="text-faint text-xs">[{{ m.type }}]</span></div>
                  <div class="slash-item-desc text-faint text-xs">{{ m.preview }}</div>
                </div>
              </button>
              <button class="slash-menu-item more-item" @click="openAtPicker">
                <el-icon class="slash-icon"><More /></el-icon>
                <div class="slash-item-body">
                  <div class="slash-item-name">多选关联…</div>
                  <div class="slash-item-desc text-faint text-xs">打开多选小窗，可勾选多个文件批量关联</div>
                </div>
              </button>
              <div v-if="atMatches.length === 0" class="slash-empty text-faint text-xs">
                没有匹配项
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作行 -->
        <div class="input-bottom">
          <div class="input-bottom-left">
            <el-select
              v-model="selectedPromptId"
              placeholder="选择提示词 ▽"
              size="small"
              style="width: 140px"
              filterable
              clearable
              placement="top"
              popper-class="editor-input-popper"
            >
              <el-option-group label="内置">
                <el-option v-for="p in builtinPrompts" :key="p.id" :label="p.title" :value="p.id" />
              </el-option-group>
              <el-option-group label="项目">
                <el-option v-for="p in projectPrompts" :key="p.id" :label="p.title" :value="p.id" />
              </el-option-group>
            </el-select>
            <el-select
              v-model="aiModel"
              placeholder="进阶模型"
              size="small"
              style="width: 140px"
              placement="top"
              popper-class="editor-input-popper"
            >
              <el-option v-for="m in models" :key="m.model" :label="m.model" :value="m.model" />
            </el-select>
          </div>
          <div class="input-bottom-right">
            <span class="text-faint text-xs screenshot-hint">截图 Alt+D</span>
            <span class="text-faint text-xs">{{ userInput.length }} 字</span>
          </div>
        </div>
      </aside>
    </div>

    <!-- 顶部功能 - 时光机抽屉 -->
    <el-drawer v-model="historyVisible" title="历史记录" direction="rtl" size="380px">
      <div class="history-list">
        <div v-for="h in chatHistoryList" :key="h.id" class="history-item">
          <div class="history-title">{{ h.title }}</div>
          <div class="history-time text-faint text-xs">{{ formatTime(h.time) }}</div>
        </div>
        <div v-if="chatHistoryList.length === 0" class="text-faint text-sm" style="padding: 20px; text-align: center">
          暂无历史记录
        </div>
      </div>
    </el-drawer>

    <!-- @ 多选关联小窗（非全覆盖，居中浮层） -->
    <el-dialog
      v-model="atPickerVisible"
      title="选择要关联的内容"
      width="560px"
      class="at-picker-dialog"
      :close-on-click-modal="true"
      append-to-body
    >
      <div class="at-picker">
        <!-- 搜索框 -->
        <el-input
          v-model="atPickerKeyword"
          placeholder="搜索章节 / 设定 / 地点…"
          :prefix-icon="Search"
          clearable
          size="default"
          style="margin-bottom: 12px"
        />
        <!-- 已选计数 -->
        <div class="at-picker-summary text-faint text-xs">
          已选 <b style="color: var(--primary)">{{ atPickerSelected.size }}</b> 项
          <span v-if="atPickerKeyword"> · 关键词：「{{ atPickerKeyword }}」</span>
        </div>
        <!-- 分组列表 -->
        <div class="at-picker-groups">
          <div v-for="g in atPickerGrouped" :key="g.type" class="at-picker-group">
            <div class="at-group-header" @click="toggleGroup(g.type)">
              <el-icon class="at-group-toggle">
                <ArrowDown v-if="atPickerCollapsed[g.type] === false" />
                <ArrowRight v-else />
              </el-icon>
              <span class="at-group-name">{{ g.type }}</span>
              <span class="at-group-count text-faint text-xs">{{ g.items.length }} 项</span>
            </div>
            <div v-if="atPickerCollapsed[g.type] === false" class="at-group-body">
              <label
                v-for="m in g.items"
                :key="m.type + '|' + m.label"
                class="at-item"
                :class="{ checked: atPickerSelected.has(m.type + '|' + m.label) }"
              >
                <input
                  type="checkbox"
                  class="at-item-check"
                  :checked="atPickerSelected.has(m.type + '|' + m.label)"
                  @change="toggleAtPickerItem(m)"
                />
                <el-icon class="at-item-icon"><component :is="m.icon" /></el-icon>
                <div class="at-item-body">
                  <div class="at-item-name">{{ m.label }}</div>
                  <div class="at-item-preview text-faint text-xs">{{ m.preview }}</div>
                </div>
              </label>
              <div v-if="g.items.length === 0" class="at-group-empty text-faint text-xs">无匹配项</div>
            </div>
          </div>
          <div v-if="atPickerGrouped.length === 0" class="at-picker-empty text-faint">
            没有可关联的内容，先去创建章节 / 设定 / 地点吧
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="atPickerVisible = false">取消</el-button>
        <el-button @click="selectAllInPicker">全选</el-button>
        <el-button @click="clearPickerSelection">清空</el-button>
        <el-button type="primary" @click="confirmAtPicker">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, ArrowRight, ArrowDown, ArrowRight as Right, Back, Search, Plus,
  Document, Checked, Brush, Warning, Grid, Timer, Clock, Folder, Collection,
  User, Files, DataAnalysis, Connection, Upload, Download, Loading,
  DocumentCopy, DocumentAdd, Microphone, Delete, CopyDocument, MagicStick,
  RefreshLeft, RefreshRight, Refresh, Switch,
  ChatLineRound, List, ChatDotRound, Link, Promotion,
  Star, DArrowLeft, DArrowRight, QuestionFilled, ChatLineSquare,
  Location as LocationIcon, Reading, VideoPause, More
} from '@element-plus/icons-vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import * as db from '@/services/db'
import * as aiSvc from '@/services/ai'
import { Skills as SkillsDB } from '@/services/db'
import type { Chapter, Prompt, Skill, CanvasNode } from '@/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const settings = useSettingsStore()
const project = computed(() => projectStore.current)

const currentChapterId = ref(route.params.chapterId as string)
const chapter = ref<Chapter | null>(null)

// ===== 顶部 / 左侧 =====
const leftCollapsed = ref(false)
const mainContentExpanded = ref(true)
const searchVisible = ref(false)
// 章节概要卡片是否收起（点击小箭头切换）
const headCollapsed = ref(false)
const searchKeyword = ref('')
const searchMatches = ref(0)
const chatSessionId = ref('default')
const historyVisible = ref(false)

const chatHistoryList = ref<Array<{ id: string; title: string; time: number }>>([])

function goBack() {
  router.push({ name: 'chapters' })
}

function goToCanvas() {
  if (project.value) {
    router.push({ name: 'canvas', params: { id: project.value.id } })
  }
}

// 链接故事画布：启用后 AI 续写会按工作流节点顺序生成情节
const canvasLinked = ref(false)
const canvasWorkflow = ref<CanvasNode[]>([])

async function linkCanvas() {
  if (!project.value) return
  if (canvasLinked.value) {
    // 已链接，点击为取消链接
    canvasLinked.value = false
    canvasWorkflow.value = []
    ElMessage.info('已取消链接故事画布')
    return
  }
  // 加载画布工作流节点
  try {
    const all = await db.Canvas.list(project.value.id)
    if (!all || all.length === 0) {
      ElMessage.warning('故事画布为空，请先到故事画布添加节点')
      return
    }
    // 优先用工作流节点（start/inciting/rising/climax/resolution），按工作流顺序排序
    const workflowTypes = ['start', 'inciting', 'rising', 'climax', 'resolution']
    const workflow = all
      .filter(n => (workflowTypes as string[]).includes(n.type))
      .sort((a, b) => {
        const ai2 = workflowTypes.indexOf(a.type)
        const bi2 = workflowTypes.indexOf(b.type)
        if (ai2 !== bi2) return ai2 - bi2
        return (a.order || 0) - (b.order || 0)
      })
    let finalWorkflow: CanvasNode[]
    if (workflow.length > 0) {
      // 有工作流节点：用工作流节点
      finalWorkflow = workflow
    } else {
      // 没有工作流节点：回退到普通节点（scene/plot/character/theme/note），按 order 排序
      finalWorkflow = all
        .filter(n => ['scene', 'plot', 'character', 'theme', 'note'].includes(n.type))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
      if (finalWorkflow.length === 0) {
        // 最后兜底：所有节点都算上
        finalWorkflow = all.slice().sort((a, b) => (a.order || 0) - (b.order || 0))
      }
    }
    if (finalWorkflow.length === 0) {
      ElMessage.warning('故事画布无可用节点')
      return
    }
    canvasWorkflow.value = finalWorkflow
    canvasLinked.value = true
    ElMessage.success(`已链接故事画布，共 ${finalWorkflow.length} 个节点，AI 续写将按此顺序推进情节`)
  } catch (e: any) {
    ElMessage.error('加载画布失败：' + (e?.message || e))
  }
}

// 构建画布工作流的上下文提示词（供 sendChat 使用）
function buildCanvasContext(): string {
  if (!canvasLinked.value || canvasWorkflow.value.length === 0) return ''
  const parts: string[] = []
  parts.push('【故事画布工作流】')
  const typeLabel: Record<string, string> = {
    start: '起点', inciting: '触发事件', rising: '发展', climax: '高潮', resolution: '结局',
    scene: '场景', plot: '情节', character: '人物', theme: '主题', note: '备注'
  }
  // 全部节点都列出，让 AI 看到完整工作流
  canvasWorkflow.value.forEach((n, idx) => {
    const label = typeLabel[n.type] || n.type
    parts.push(`${idx + 1}. [${label}] ${n.title || ''}：${n.aiPrompt || n.content || '（无具体提示）'}`)
  })
  // 根据当前章节 order 定位"当前应推进的节点"
  const curOrder = chapter.value?.order || 1
  const curIdx = Math.min(Math.max(0, curOrder - 1), canvasWorkflow.value.length - 1)
  const curNode = canvasWorkflow.value[curIdx]
  if (curNode) {
    const curLabel = typeLabel[curNode.type] || curNode.type
    parts.push('')
    parts.push(`【当前任务】现在是第 ${curOrder} 章，对应工作流第 ${curIdx + 1} 个节点「[${curLabel}] ${curNode.title || ''}」。`)
    parts.push(`本章节必须严格围绕此节点推进：${curNode.aiPrompt || curNode.content || '按节点标题展开'}`)
    parts.push('请直接输出本章正文内容，不要写"以下是续写"等说明文字。')
  } else {
    parts.push('请严格按上述画布节点顺序推进当前章节的情节发展。')
  }
  return parts.join('\n')
}

function toggleMainContent() {
  mainContentExpanded.value = !mainContentExpanded.value
}

function newConversation() {
  chatMessages.value = []
  ElMessage.success('已新建对话')
}

// ===== 编辑器 =====
const editorFont = computed(() => settings.settings?.editorFont || '思源宋体, serif')
const models = computed(() => settings.availableModels())
const aiModel = ref('')

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: '开始你的故事...' }),
    CharacterCount.configure({ limit: null })
  ],
  autofocus: 'end',
  // 手动保存模式：不再 onUpdate 触发自动保存
  onUpdate: () => {}
})

const wordCount = computed(() => editor.value?.storage.characterCount.characters() || 0)

// 保存（手动触发）
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const isLoading = ref(false) // 加载章节时禁止保存
const saveStatusText = computed(() => ({ idle: '', saving: '保存中...', saved: '已保存' }[saveStatus.value]))
const saveStatusClass = computed(() => ({ idle: '', saving: 'saving', saved: 'saved' }[saveStatus.value]))

async function save(opts: { silent?: boolean } = {}) {
  if (!editor.value || !chapter.value || isLoading.value) return
  saveStatus.value = 'saving'
  try {
    chapter.value.content = editor.value.getHTML()
    chapter.value.wordCount = wordCount.value
    chapter.value.updatedAt = Date.now()
    await db.Chapters.save(chapter.value)
    const idx = projectStore.chapters.findIndex(c => c.id === chapter.value!.id)
    if (idx >= 0) projectStore.chapters[idx] = { ...chapter.value }
    saveStatus.value = 'saved'
    setTimeout(() => { saveStatus.value = 'idle' }, 1500)
    if (!opts.silent) ElMessage.success('已保存')
  } catch (e: any) {
    saveStatus.value = 'idle'
    if (!opts.silent) {
      ElMessage.error('保存失败：' + e.message)
    } else {
      console.warn('[Editor] 保存失败（静默）:', e.message)
    }
  }
}

function onTitleBlur(e: Event) {
  const newTitle = (e.target as HTMLElement).innerText.trim()
  if (chapter.value && newTitle && newTitle !== chapter.value.title) {
    chapter.value.title = newTitle
    save()
  }
}

// ===== 章节切换 =====
const prevChapter = computed(() => {
  if (!chapter.value) return null
  const idx = projectStore.chapters.findIndex(c => c.id === chapter.value!.id)
  return idx > 0 ? projectStore.chapters[idx - 1] : null
})
const nextChapter = computed(() => {
  if (!chapter.value) return null
  const idx = projectStore.chapters.findIndex(c => c.id === chapter.value!.id)
  return idx >= 0 && idx < projectStore.chapters.length - 1 ? projectStore.chapters[idx + 1] : null
})

function goChapter(c: Chapter) {
  router.push({ name: 'editor', params: { chapterId: c.id } })
}

async function newChapterAfter() {
  if (!chapter.value || !project.value) return
  await save()
  const order = chapter.value.order + 1
  for (const c of projectStore.chapters) {
    if (c.order >= order) { c.order++; await db.Chapters.save(c) }
  }
  const c = await db.Chapters.save({
    projectId: project.value.id,
    title: `第${order}章`,
    content: '', contentType: 'html', summary: '',
    status: '草稿', order, wordCount: 0, notes: '',
    createdAt: 0, updatedAt: 0
  } as any)
  await projectStore.reloadChapters()
  goChapter(c)
}

async function loadChapter(id: string) {
  try {
    isLoading.value = true
    if (!project.value) return
    // 并行加载所有数据，避免串行 IPC 往返造成卡顿
    const [c, all, sk] = await Promise.all([
      db.Chapters.list(project.value.id),
      db.Prompts.list(project.value.id),
      SkillsDB.list(project.value.id)
    ])
    projectStore.chapters = c.sort((a, b) => a.order - b.order)
    builtinPrompts.value = all.filter(p => p.isBuiltIn)
    projectPrompts.value = all.filter(p => !p.isBuiltIn)
    skills.value = sk

    const target = projectStore.chapters.find(x => x.id === id)
    if (!target) {
      ElMessage.error('章节不存在')
      return
    }
    chapter.value = target
    currentChapterId.value = id
    if (editor.value) {
      // false 表示不触发 onUpdate
      editor.value.commands.setContent(target.content || '', false)
    }
    // 用 requestAnimationFrame 让浏览器先绘制，再做聚焦等非关键操作
    requestAnimationFrame(() => {
      isLoading.value = false
      if (editor.value) {
        editor.value.commands.focus('end')
      }
    })
  } catch (e: any) {
    isLoading.value = false
    ElMessage.error('加载章节失败：' + e.message)
  }
}

// ===== 上下文 =====
function buildContext(): string {
  if (!chapter.value || !project.value) return ''
  const prevChapters = projectStore.chapters
    .filter(c => c.order < chapter.value!.order)
    .sort((a, b) => a.order - b.order)
  const recentSummaries = prevChapters.slice(-3).map(c => `第${c.order}章《${c.title}》：${c.summary || '（无摘要）'}`).join('\n')
  const currentText = editor.value?.getText() || ''
  const tail = currentText.slice(-1500)
  const lore = projectStore.lore.slice(0, 8).map(l => `${l.category}/${l.title}：${l.content?.slice(0, 60) || ''}`).join('；')
  return `【作品信息】\n类型：${project.value.genre}\n标题：${project.value.title}\n简介：${project.value.description}\n\n【前情摘要】\n${recentSummaries}\n\n【设定】${lore}\n\n【当前章节】\n第${chapter.value.order}章《${chapter.value.title}》\n${tail}`
}

// ===== AI 对话面板 =====
interface EditorChatMessage {
  role: 'user' | 'assistant'
  content: string
  options?: Array<{ text: string; isCustom?: boolean }>
  selectedOption?: number
  isQuestion?: boolean
}
const chatMessages = ref<EditorChatMessage[]>([])
const userInput = ref('')
const aiStreamingText = ref('')
const generating = ref(false)
const stopFlag = ref(false)
// 当前流式会话的 IPC channel，用于停止时通知主进程 abort fetch
let currentStreamChan: string | null = null
const builtinPrompts = ref<Prompt[]>([])
const projectPrompts = ref<Prompt[]>([])
const selectedPromptId = ref('')
const skills = ref<Skill[]>([])

// 提问模式：auto=卡壳时问 / always=每次都问 / never=从不问
const askMode = ref<'auto' | 'always' | 'never'>(
  settings.settings?.askMode || 'auto'
)

function setAskMode(mode: 'auto' | 'always' | 'never') {
  askMode.value = mode
  // 持久化到全局设置
  try {
    settings.update({ askMode: mode })
  } catch (e) {
    console.warn('[Editor] 保存 askMode 失败:', e)
  }
  const tip = mode === 'auto' ? '智能提问：AI 仅在卡壳时提问' :
              mode === 'always' ? '每段提问：每段都让 AI 提问' :
              '不提问：AI 直接续写'
  ElMessage.success(tip)
}

// 关联片段
const linkedItems = ref<Array<{ label: string; content: string }>>([])
const linkedWordsCount = computed(() => linkedItems.value.reduce((s, i) => s + i.content.length, 0))

function linkCurrentChapter() {
  if (!chapter.value) return
  const text = editor.value?.getText() || ''
  linkedItems.value.push({
    label: `第${chapter.value.order}章`,
    content: text
  })
  ElMessage.success('已关联当前章节')
}

async function uploadAttachment() {
  try {
    const filePath = await window.api.file.selectNovel()
    if (!filePath) return
    ElMessage.info('正在读取文件...')
    const text = await window.api.file.readNovelText(filePath)
    if (!text || !text.trim()) {
      ElMessage.warning('文件内容为空')
      return
    }
    // 截断过长内容，避免撑爆上下文
    const truncated = text.length > 8000 ? text.slice(0, 8000) + '\n...(内容过长已截断)' : text
    const fileName = filePath.split(/[\\/]/).pop() || '附件'
    linkedItems.value.push({
      label: fileName,
      content: truncated
    })
    ElMessage.success(`已添加文件：${fileName}（${text.length} 字）`)
  } catch (e: any) {
    ElMessage.error('添加文件失败：' + (e?.message || ''))
  }
}

function exportCurrent() {
  if (!chapter.value) return
  router.push({ name: 'export' })
}

// / 触发技能菜单
const slashMenuVisible = ref(false)
const slashKeyword = ref('')

// @ 关联菜单
interface AtMatch {
  type: string       // 地点/设定/章节
  label: string      // 显示名
  preview: string    // 描述前 60 字
  content: string    // 完整内容（关联时塞入）
  icon: any          // Element Plus 图标
}
const atMenuVisible = ref(false)
const atMatches = ref<AtMatch[]>([])

const filteredSkills = computed(() => {
  if (!slashKeyword.value) return skills.value
  const kw = slashKeyword.value.toLowerCase()
  return skills.value.filter(s =>
    s.name.toLowerCase().includes(kw) ||
    (s.description || '').toLowerCase().includes(kw) ||
    (s.tags || []).some(t => t.toLowerCase().includes(kw))
  )
})

/**
 * 解析输入框中的 @ 关键词，匹配项目内地点/设定/章节
 * 触发条件：光标前最近一个 @ 后没有空格，且 @ 后字符长度 > 0
 */
function detectAtKeyword(text: string, caret: number): string {
  // 从光标向前找 @
  const before = text.slice(0, caret)
  const atIdx = before.lastIndexOf('@')
  if (atIdx < 0) return ''
  // @ 必须紧跟非空格内容
  const after = before.slice(atIdx + 1)
  if (after.includes(' ') || after.includes('\n')) return ''
  return after
}

/** 收集所有可关联项，按关键词过滤 */
function buildAtMatches(keyword: string): AtMatch[] {
  if (!project.value) return []
  const kw = keyword.toLowerCase()
  const matches: AtMatch[] = []
  const filter = (s: string) => !kw || s.toLowerCase().includes(kw)

  // 地点
  for (const l of projectStore.locations) {
    if (!filter(l.name)) continue
    matches.push({
      type: '地点',
      label: l.name,
      preview: `${l.type} · ${(l.description || '无描述').slice(0, 50)}`,
      content: `【地点：${l.name}】\n类型：${l.type}\n描述：${l.description || '无'}\n特征：${l.features || '无'}\n文化：${l.culture || '无'}`,
      icon: LocationIcon
    })
  }
  // 设定
  for (const l of projectStore.lore) {
    if (!filter(l.title)) continue
    matches.push({
      type: '设定',
      label: l.title,
      preview: `${l.category} · ${(l.content || '无内容').slice(0, 50)}`,
      content: `【设定：${l.title}】\n分类：${l.category}\n内容：${l.content || '无'}`,
      icon: Collection
    })
  }
  // 章节
  for (const c of projectStore.chapters) {
    if (!filter(c.title)) continue
    matches.push({
      type: '章节',
      label: `第${c.order}章 ${c.title}`,
      preview: `${c.status} · ${(c.summary || c.content || '').replace(/<[^>]+>/g, '').slice(0, 50)}`,
      content: `【第${c.order}章《${c.title}》】\n${(c.content || '').replace(/<[^>]+>/g, '\n').slice(0, 3000)}`,
      icon: Document
    })
  }
  return matches.slice(0, 20)
}

function pickAtMatch(m: AtMatch) {
  if (!inputRef.value) return
  // 把输入框中的 "@xxx" 替换为 "@label "，并把内容塞进 linkedItems
  const text = userInput.value
  const caret = inputRef.value.selectionStart ?? text.length
  const before = text.slice(0, caret)
  const atIdx = before.lastIndexOf('@')
  if (atIdx < 0) return
  const after = text.slice(caret)
  const newText = before.slice(0, atIdx) + `@${m.label} ` + after
  userInput.value = newText
  // 塞入关联内容
  linkedItems.value.push({ label: m.label, content: m.content })
  atMenuVisible.value = false
  ElMessage.success(`已关联${m.type}：${m.label}`)
  nextTick(() => inputRef.value?.focus())
}

// ===== @ 多选关联小窗 =====
const atPickerVisible = ref(false)
const atPickerKeyword = ref('')
// 用 Set 存放 key（type|label），避免重复
const atPickerSelected = ref<Set<string>>(new Set())
// 待选条目（与 atMatches 同源，但不过滤关键词时返回全部）
const atPickerAllItems = ref<AtMatch[]>([])
// 分组折叠状态：false=展开, true=折叠
const atPickerCollapsed = ref<Record<string, boolean>>({
  '章节': false,
  '设定': false,
  '地点': false
})

/** 打开多选小窗：加载所有可关联项，初始已选 = 当前 linkedItems */
function openAtPicker() {
  atPickerAllItems.value = buildAllAtMatches()
  atPickerKeyword.value = ''
  atPickerSelected.value = new Set(
    linkedItems.value.map(it => {
      // 通过 label 反查 type（粗略匹配）
      const found = atPickerAllItems.value.find(m => m.label === it.label)
      return found ? `${found.type}|${found.label}` : `已关联|${it.label}`
    })
  )
  // 默认展开所有分组
  const types = new Set(atPickerAllItems.value.map(m => m.type))
  for (const t of types) atPickerCollapsed.value[t] = false
  atMenuVisible.value = false
  atPickerVisible.value = true
}

/** 收集所有可关联项（不限制数量，用于多选小窗） */
function buildAllAtMatches(): AtMatch[] {
  return buildAtMatches('')
}

/** 按关键词过滤 + 按类型分组 */
const atPickerGrouped = computed(() => {
  const kw = atPickerKeyword.value.trim().toLowerCase()
  const filtered = kw
    ? atPickerAllItems.value.filter(m =>
        m.label.toLowerCase().includes(kw) ||
        m.type.toLowerCase().includes(kw) ||
        (m.preview || '').toLowerCase().includes(kw)
      )
    : atPickerAllItems.value
  // 分组
  const groups: Record<string, AtMatch[]> = {}
  for (const m of filtered) {
    if (!groups[m.type]) groups[m.type] = []
    groups[m.type].push(m)
  }
  // 固定顺序：章节 → 设定 → 地点 → 其它
  const order = ['章节', '设定', '地点']
  const types = Object.keys(groups).sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b)
    if (ia >= 0 && ib >= 0) return ia - ib
    if (ia >= 0) return -1
    if (ib >= 0) return 1
    return a.localeCompare(b)
  })
  return types.map(t => ({ type: t, items: groups[t] }))
})

/** 切换分组折叠 */
function toggleGroup(type: string) {
  atPickerCollapsed.value[type] = atPickerCollapsed.value[type] === false ? true : false
}

/** 勾选/取消勾选某项 */
function toggleAtPickerItem(m: AtMatch) {
  const key = `${m.type}|${m.label}`
  const s = new Set(atPickerSelected.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  atPickerSelected.value = s
}

/** 全选（当前过滤后的） */
function selectAllInPicker() {
  const s = new Set(atPickerSelected.value)
  for (const g of atPickerGrouped.value) {
    for (const m of g.items) s.add(`${m.type}|${m.label}`)
  }
  atPickerSelected.value = s
}

/** 清空选择 */
function clearPickerSelection() {
  atPickerSelected.value = new Set()
}

/** 确认：把已选项写入 linkedItems，并清理输入框里的 @xxx 文本 */
function confirmAtPicker() {
  // 找出所有被选中的 AtMatch
  const selectedMatches: AtMatch[] = []
  for (const m of atPickerAllItems.value) {
    if (atPickerSelected.value.has(`${m.type}|${m.label}`)) {
      selectedMatches.push(m)
    }
  }
  // 找出已存在但本次未选中的（需要移除）
  const newLabels = new Set(selectedMatches.map(m => m.label))
  // 保留：① 不在 atPickerAllItems 中的（用户外部添加的），② 在新选中的
  linkedItems.value = linkedItems.value.filter(it => {
    // 在 picker 列表中但未选中 → 移除
    const inPicker = atPickerAllItems.value.some(m => m.label === it.label)
    if (inPicker && !newLabels.has(it.label)) return false
    return true
  })
  // 追加新选中的（避免重复）
  const existing = new Set(linkedItems.value.map(it => it.label))
  for (const m of selectedMatches) {
    if (!existing.has(m.label)) {
      linkedItems.value.push({ label: m.label, content: m.content })
    }
  }
  // 清理输入框中残留的 @xxx 片段
  userInput.value = userInput.value.replace(/@[^\s@]*\s?/g, '').trim()
  atPickerVisible.value = false
  ElMessage.success(`已关联 ${selectedMatches.length} 项`)
  nextTick(() => inputRef.value?.focus())
}

function onInput(e: Event) {
  const ta = e.target as HTMLTextAreaElement
  const v = ta.value
  const caret = ta.selectionStart ?? v.length
  // 检测 / 触发（仅在行首或开头）
  if (v.startsWith('/')) {
    slashMenuVisible.value = true
    slashKeyword.value = v.slice(1)
  } else {
    slashMenuVisible.value = false
    slashKeyword.value = ''
  }
  // 检测 @ 触发
  const atKw = detectAtKeyword(v, caret)
  if (atKw !== null && atKw.length >= 0 && v.includes('@')) {
    // @ 后允许 0 个字符也可弹菜单
    atMenuVisible.value = true
    atMatches.value = buildAtMatches(atKw)
  } else {
    atMenuVisible.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  // @ 菜单打开时，Enter 选择第一个匹配项
  if (atMenuVisible.value && atMatches.value.length > 0) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      pickAtMatch(atMatches.value[0])
      return
    } else if (e.key === 'Escape') {
      atMenuVisible.value = false
      return
    }
  }
  // Enter 发送，Shift+Enter 换行
  if (e.key === 'Enter' && !e.shiftKey && !slashMenuVisible.value && !atMenuVisible.value) {
    e.preventDefault()
    sendChat()
  } else if (e.key === 'Escape' && slashMenuVisible.value) {
    slashMenuVisible.value = false
  }
}

function pickSkill(s: Skill) {
  // 只标记选中的技能，不把模板填入输入框
  // 变量在发送时自动用上下文填充
  pendingSkill.value = s
  slashMenuVisible.value = false
  userInput.value = '' // 清空输入框（去掉 / 输入）
  ElMessage.success(`已选择技能「${s.name}」，可直接发送或输入补充说明`)
  // 焦点回到输入框
  nextTick(() => inputRef.value?.focus())
}

function clearPendingSkill() {
  pendingSkill.value = null
}

const pendingSkill = ref<Skill | null>(null)

const canSend = computed(() => (userInput.value.trim() || selectedPromptId.value || pendingSkill.value) && !generating.value)

function getProvider() {
  const m = aiModel.value || project.value?.settings.model || ''
  return settings.findProviderForModel(m)
}

async function sendChat() {
  if (!canSend.value || !project.value) return
  const provider = getProvider()
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置 API Key')
    return
  }

  const userMsg = userInput.value.trim()
  // 如果选了技能但没输入，也算有效（直接用技能模板）
  if (!userMsg && !pendingSkill.value && !selectedPromptId.value) return

  // 显示给用户的消息：技能 chip + 补充说明
  const displayMsg = pendingSkill.value
    ? `[技能：${pendingSkill.value.name}]${userMsg ? '\n' + userMsg : ''}`
    : userMsg
  chatMessages.value.push({ role: 'user', content: displayMsg })
  userInput.value = ''
  slashMenuVisible.value = false

  // 构造 system + user
  // 根据 askMode 调整 system prompt：
  //   auto: 仅在卡壳/不确定时提问，正常情况直接续写
  //   always: 每次都给出 ABCD 选项让用户选
  //   never: 从不提问，直接续写
  const askModePrompt = askMode.value === 'always'
    ? '\n\n【交互规则】在生成内容前，先以如下格式给出 3 个候选方向让用户选择：\n===QUESTION===\n问题：xxx\nA. 选项一\nB. 选项二\nC. 选项三\nD. 自定义\n===END===\n用户选择后再继续生成。'
    : askMode.value === 'auto'
      ? '\n\n【交互规则】只在以下情况向用户提问：1) 剧情走向有多种可能且无法判断用户偏好 2) 角色动机/设定存在矛盾 3) 用户提供的信息不足。提问时使用 ===QUESTION=== ... ===END=== 格式给出 ABCD 三个选项加 D 自定义。能够确定方向时直接续写，不要每段都问。'
      : '\n\n【交互规则】直接续写，不要提问。'
  let sysContent = `你是一位资深小说家，擅长${project.value.genre}类型创作。请直接输出正文内容，不要写"以下是续写"等说明性文字，不要使用 markdown 代码块。文风自然流畅，避免AI味。${project.value.settings.styleSample ? '\n参考文风：' + project.value.settings.styleSample : ''}${askModePrompt}`
  // 链接故事画布的上下文：先缓存，稍后在 sysContent 被技能模板覆盖后再次追加，避免丢失
  const canvasCtx = buildCanvasContext()
  let userContent = userMsg

  // 自动填充变量的辅助函数
  const ctx = buildContext()
  const fullText = editor.value?.getText() || ''
  const selRange = editor.value?.state.selection
  const selText = selRange && selRange.to > selRange.from
    ? editor.value!.state.doc.textBetween(selRange.from, selRange.to, '\n')
    : ''
  // @ 关联内容：所有分支都应注入到 userContent，确保 AI 能看到
  const linkedContent = linkedItems.value.length
    ? linkedItems.value.map(i => `【${i.label}】\n${i.content}`).join('\n\n')
    : ''
  // 用户要求：@ 关联存在时，不发送章节正文，只发 @ 关联文件内容
  const hasLinked = !!linkedContent
  const fillVars = (extra: Record<string, string> = {}): Record<string, string> => ({
    // 有 @ 关联时 content 留空，避免把正文一起带过去
    content: hasLinked ? '' : (selText || fullText.slice(-2000)),
    context: hasLinked ? '' : ctx,
    genre: project.value?.genre || '',
    title: project.value?.title || '',
    setup: project.value?.description || '',
    words: '800',
    instruction: userMsg,
    count: '10',
    characters: '',
    scene: userMsg,
    emotion: '',
    imitationGuide: project.value?.settings.styleSample || '',
    searchResults: '',
    excerpt: hasLinked ? '' : fullText.slice(0, 3000),
    topic: userMsg,
    ...extra
  })

  if (pendingSkill.value) {
    // 使用技能的 system + user 模板，自动填充变量
    sysContent = pendingSkill.value.systemPrompt || sysContent
    const vars = fillVars()
    userContent = aiSvc.renderTemplate(pendingSkill.value.userPrompt, vars)
    // 如果用户有补充输入且模板中没占位符接收，追加到末尾
    if (userMsg && !pendingSkill.value.userPrompt.includes('{{')) {
      userContent = userMsg
    } else if (userMsg && pendingSkill.value.variables && !pendingSkill.value.variables.some(v => ['instruction', 'scene', 'emotion', 'topic'].includes(v))) {
      userContent += `\n\n【用户补充说明】${userMsg}`
    }
    // 注入 @ 关联内容（技能分支此前丢失，这里补齐）
    if (linkedContent) {
      userContent += `\n\n【@ 关联内容】\n${linkedContent}`
    }
    pendingSkill.value = null
  } else if (selectedPromptId.value) {
    const all = [...builtinPrompts.value, ...projectPrompts.value]
    const tpl = all.find(p => p.id === selectedPromptId.value)
    if (tpl) {
      const vars = fillVars()
      userContent = aiSvc.renderTemplate(tpl.content, vars)
    }
    // 注入 @ 关联内容（提示词分支此前丢失，这里补齐）
    if (linkedContent) {
      userContent += `\n\n【@ 关联内容】\n${linkedContent}`
    }
  } else {
    // 普通对话：
    // - 有 @ 关联时只发关联文件内容，不发正文上下文
    // - 无 @ 关联时发用户消息 + 当前上下文（含正文摘要）
    if (hasLinked) {
      userContent = `${userMsg}\n\n【@ 关联内容】\n${linkedContent}`
    } else {
      userContent = `${userMsg}\n\n【当前上下文】\n${ctx}`
    }
  }

  // 最后再把画布上下文追加到 sysContent（必须在技能分支覆盖之后，否则会被覆盖丢失）
  if (canvasCtx) {
    sysContent += '\n\n' + canvasCtx
  }

  generating.value = true
  aiStreamingText.value = ''
  stopFlag.value = false
  try {
    const full = await aiSvc.streamChat(
      aiSvc.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: aiModel.value || project.value.settings.model,
        messages: [
          { role: 'system', content: sysContent },
          ...chatMessages.value.slice(-6).map(m => ({ role: m.role as any, content: m.content })),
          { role: 'user', content: userContent }
        ],
        temperature: 0.8,
        maxTokens: 4096
      }),
      (chunk) => {
        if (stopFlag.value) return
        aiStreamingText.value += chunk
      }
    )
    if (full) {
      // 解析 AI 输出是否包含 ===QUESTION===...===END=== 提问块
      const parsed = parseQuestionBlock(full)
      if (parsed) {
        // AI 提问了，把消息改为带 options 的提问卡片
        chatMessages.value.push({
          role: 'assistant',
          content: parsed.question,
          options: parsed.options,
          isQuestion: true
        })
      } else {
        chatMessages.value.push({ role: 'assistant', content: full })
      }
    }
  } catch (e: any) {
    ElMessage.error('AI 调用失败：' + e.message)
  } finally {
    generating.value = false
    aiStreamingText.value = ''
  }
}

function stopGenerate() {
  // 设置 stopFlag 后，streamChat 的 onChunk 回调会立刻 return，不再累加 aiStreamingText
  // 主进程的 fetch 流会继续（前端无法真正 abort），但 UI 不再更新，效果等同于停止
  stopFlag.value = true
  generating.value = false
  aiStreamingText.value = ''
}

// ===== AI 提问解析与回答 =====

/**
 * 解析 AI 输出中的提问块：
 *   ===QUESTION===
 *   问题：xxx
 *   A. 选项一
 *   B. 选项二
 *   C. 选项三
 *   D. 自定义
 *   ===END===
 * 返回 { question, options } 或 null
 */
function parseQuestionBlock(text: string): { question: string; options: Array<{ text: string; isCustom?: boolean }> } | null {
  const m = text.match(/=+\s*QUESTION\s*=+([\s\S]*?)=+\s*END\s*=+/i)
  if (!m) return null
  const block = m[1].trim()
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  // 第一行通常是"问题：xxx"，但也可能直接是问题
  let question = ''
  const options: Array<{ text: string; isCustom?: boolean }> = []
  for (const line of lines) {
    const qm = line.match(/^问[题题]?\s*[:：]\s*(.+)$/)
    if (qm && !question) {
      question = qm[1].trim()
      continue
    }
    const om = line.match(/^([A-D])[\.、:：]\s*(.+)$/)
    if (om) {
      const letter = om[1]
      const content = om[2].trim()
      options.push({
        text: content,
        isCustom: /自定义|其他|自己|custom/i.test(content) && letter === 'D'
      })
    } else if (!question && !options.length) {
      // 既不是问题行也不是选项行，作为问题的一部分
      question = line
    }
  }
  if (!question && options.length === 0) return null
  // 如果没解析到选项，但整个块就一行，那把它当问题，无选项
  if (options.length === 0) return null
  return { question, options }
}

/**
 * 用户点击选项后：把选择作为新一轮 user 消息发回 AI，让它继续生成
 */
async function answerQuestion(msg: EditorChatMessage, idx: number) {
  if (msg.selectedOption !== undefined) return  // 已选择过
  msg.selectedOption = idx
  const opt = msg.options?.[idx]
  if (!opt) return
  const answer = opt.isCustom
    ? `我选 D（自定义），请让我自己输入：`
    : `我选 ${String.fromCharCode(65 + idx)}：${opt.text}\n请按这个方向继续创作。`
  // 自定义选项弹输入框
  if (opt.isCustom) {
    const custom = window.prompt('请输入你的自定义答案：', '')
    if (custom === null) {
      // 用户取消，撤销选择
      msg.selectedOption = undefined
      return
    }
    msg.options![idx].text = `自定义：${custom}`
    chatMessages.value.push({ role: 'user', content: `我选 D（自定义）：${custom}\n请按这个方向继续创作。` })
  } else {
    chatMessages.value.push({ role: 'user', content: answer })
  }
  // 触发续写
  await continueAfterAnswer()
}

/**
 * AI 提问被回答后，自动续写（不显示用户输入框内容，直接用最后一条 user 消息）
 */
async function continueAfterAnswer() {
  if (!project.value) return
  const provider = getProvider()
  if (!provider?.apiKey) {
    ElMessage.warning('请先在设置中配置 API Key')
    return
  }
  const askModePrompt = askMode.value === 'always'
    ? '\n\n【交互规则】继续按 ===QUESTION=== ... ===END=== 格式，每生成一段都给出 ABCD 选项让用户选择。'
    : askMode.value === 'auto'
      ? '\n\n【交互规则】只在卡壳时提问，正常情况直接续写。'
      : '\n\n【交互规则】直接续写，不要提问。'
  const sysContent = `你是一位资深小说家，擅长${project.value.genre}类型创作。文风自然流畅，避免AI味。${project.value.settings.styleSample ? '\n参考文风：' + project.value.settings.styleSample : ''}${askModePrompt}`
  const ctx = buildContext()
  const recent = chatMessages.value
    .filter(m => !m.isQuestion || m.selectedOption !== undefined)
    .slice(-6)
    .map(m => {
      if (m.isQuestion && m.selectedOption !== undefined && m.options) {
        const opt = m.options[m.selectedOption]
        return { role: 'assistant' as const, content: `[提问]${m.content}\n[用户选择]${String.fromCharCode(65 + m.selectedOption)}. ${opt.text}` }
      }
      return { role: m.role as 'user' | 'assistant', content: m.content }
    })
  // 取最后一条 user 消息
  const lastUser = chatMessages.value.filter(m => m.role === 'user').slice(-1)[0]
  if (!lastUser) return
  const userContent = `${lastUser.content}\n\n【当前上下文】\n${ctx}`

  generating.value = true
  aiStreamingText.value = ''
  stopFlag.value = false
  try {
    const full = await aiSvc.streamChat(
      aiSvc.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: aiModel.value || project.value.settings.model,
        messages: [
          { role: 'system', content: sysContent },
          ...recent,
          { role: 'user', content: userContent }
        ],
        temperature: 0.8,
        maxTokens: 4096
      }),
      (chunk) => {
        if (stopFlag.value) return
        aiStreamingText.value += chunk
      }
    )
    if (full) {
      const parsed = parseQuestionBlock(full)
      if (parsed) {
        chatMessages.value.push({
          role: 'assistant',
          content: parsed.question,
          options: parsed.options,
          isQuestion: true
        })
      } else {
        chatMessages.value.push({ role: 'assistant', content: full })
      }
    }
  } catch (e: any) {
    ElMessage.error('AI 调用失败：' + e.message)
  } finally {
    generating.value = false
    aiStreamingText.value = ''
  }
}

/**
 * 用户主动点击"让 AI 提问"按钮，强制让 AI 给出 ABCD 选项
 */
async function askAiToQuestion(msg: EditorChatMessage) {
  if (!project.value) return
  const provider = getProvider()
  if (!provider?.apiKey) {
    ElMessage.warning('请先配置 API Key')
    return
  }
  const ctx = buildContext()
  const sysContent = `你是一位资深小说家。用户希望你在当前剧情节点给出 ABCD 四个走向选项让用户选择。严格按以下格式输出，不要其他文字：\n===QUESTION===\n问题：<基于当前剧情提出一个关键走向问题>\nA. <选项一>\nB. <选项二>\nC. <选项三>\nD. 自定义\n===END===`
  const userContent = `【当前上下文】\n${ctx}\n\n上一段 AI 输出：\n${msg.content?.slice(-500) || '（无）'}\n\n请给出 ABCD 选项。`
  // 先 push 一条提示
  chatMessages.value.push({ role: 'user', content: '[让 AI 提问] 请基于当前剧情给出 ABCD 选项' })
  generating.value = true
  aiStreamingText.value = ''
  stopFlag.value = false
  try {
    const full = await aiSvc.streamChat(
      aiSvc.buildRequest({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: aiModel.value || project.value.settings.model,
        messages: [
          { role: 'system', content: sysContent },
          { role: 'user', content: userContent }
        ],
        temperature: 0.7,
        maxTokens: 800
      }),
      (chunk) => {
        if (stopFlag.value) return
        aiStreamingText.value += chunk
      }
    )
    if (full) {
      const parsed = parseQuestionBlock(full)
      if (parsed) {
        chatMessages.value.push({
          role: 'assistant',
          content: parsed.question,
          options: parsed.options,
          isQuestion: true
        })
      } else {
        // 没解析出来，把原文当普通消息
        chatMessages.value.push({ role: 'assistant', content: full })
      }
    }
  } catch (e: any) {
    ElMessage.error('AI 调用失败：' + e.message)
  } finally {
    generating.value = false
    aiStreamingText.value = ''
  }
}

/**
 * 渲染消息内容：把纯文本转为带换行的 HTML（用于 v-html）
 */
function renderMessage(text: string): string {
  if (!text) return ''
  return escapeHtml(text).replace(/\n/g, '<br>')
}

function copyText(text: string) {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}

function appendOutput(text: string) {
  if (!editor.value || !text) return
  editor.value.commands.focus('end')
  const paras = text.split(/\n+/).filter(p => p.trim())
  for (const p of paras) {
    editor.value.commands.insertContent(`<p>${escapeHtml(p)}</p>`)
  }
  ElMessage.success('已追加到正文')
}

/** 替换正文：清空编辑器当前内容，用 AI 输出替换 */
function replaceOutput(text: string) {
  if (!editor.value || !text) return
  // 先清空，再插入新内容
  editor.value.commands.clearContent()
  const paras = text.split(/\n+/).filter(p => p.trim())
  for (const p of paras) {
    editor.value.commands.insertContent(`<p>${escapeHtml(p)}</p>`)
  }
  ElMessage.success('已替换正文')
}

/** 删除某条消息 */
function deleteMsg(index: number) {
  if (index < 0 || index >= chatMessages.value.length) return
  chatMessages.value.splice(index, 1)
}

/** 重新生成：找到对应的用户消息，把它重新塞回输入框并触发发送，同时删除当前 AI 消息 */
async function regenerateMsg(index: number) {
  if (generating.value) return
  if (index < 0 || index >= chatMessages.value.length) return
  // 向前找最近的 user 消息
  let userIdx = -1
  for (let i = index - 1; i >= 0; i--) {
    if (chatMessages.value[i].role === 'user') {
      userIdx = i
      break
    }
  }
  if (userIdx < 0) {
    ElMessage.warning('未找到对应的用户指令，无法重新生成')
    return
  }
  const userMsg = chatMessages.value[userIdx]
  // 提取原始指令文本（去掉技能前缀）
  let rawInput = userMsg.content || ''
  const skillMatch = rawInput.match(/^\[技能：[^\]]+\]\s*\n?([\s\S]*)$/)
  if (skillMatch) rawInput = skillMatch[1]
  // 删除从 user 消息到当前 AI 消息之间的所有消息
  chatMessages.value.splice(userIdx, index - userIdx + 1)
  // 重新填入输入框触发发送
  userInput.value = rawInput
  await nextTick()
  sendChat()
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ===== 顶部功能 =====
function runTopAction(action: string) {
  if (action === 'time Machine') {
    historyVisible.value = true
    return
  }
  // 把功能映射到内置提示词或技能（已移除 AI 拆书和 AI 审稿，独立到拆书板块）
  const actionMap: Record<string, string> = {
    depolish: '润色',
    typo: '校对',
    format: '排版'
  }
  const skill = skills.value.find(s => s.category === actionMap[action] || s.name.includes(actionMap[action]))
  if (skill) {
    pendingSkill.value = skill
    userInput.value = action === 'typo' ? '请检查文本中的错别字与 AI 痕迹' : ''
    sendChat()
  } else {
    // 回退到内置提示词
    const all = [...builtinPrompts.value, ...projectPrompts.value]
    const promptCat: Record<string, string> = { depolish: '润色', typo: '评审', format: '润色' }
    const tpl = all.find(p => p.category === promptCat[action])
    if (tpl) {
      selectedPromptId.value = tpl.id
      userInput.value = action === 'typo' ? '请检查文本中的错别字与 AI 痕迹' : ''
      sendChat()
    } else {
      ElMessage.info(`「${action}」功能待配置对应技能或提示词`)
    }
  }
}

// ===== AI 分析 =====
function runAnalysis(type: 'plot' | 'holes') {
  const map: Record<string, string> = {
    plot: '请对当前章节做剧情分析：总结主要事件、情节推进、冲突点、悬念设置，并给出节奏评价',
    holes: '请检查当前章节是否存在逻辑漏洞、设定矛盾、伏笔断裂、时间线错误、信息泄露'
  }
  userInput.value = map[type]
  sendChat()
}

// ===== 摘要生成 =====
async function generateSummary() {
  if (!chapter.value || !project.value) return
  const provider = getProvider()
  if (!provider?.apiKey) {
    ElMessage.warning('请先配置 API Key')
    return
  }
  generating.value = true
  try {
    const fullText = editor.value?.getText() || ''
    const sys = { role: 'system' as const, content: '你是文学编辑，请为章节生成 200 字以内的摘要，提炼主要事件、人物行动与情节进展。' }
    const user = { role: 'user' as const, content: fullText }
    const result = await aiSvc.streamChat(
      aiSvc.buildRequest({
        baseUrl: provider.baseUrl, apiKey: provider.apiKey,
        model: aiModel.value || project.value.settings.model,
        messages: [sys, user], temperature: 0.5, maxTokens: 600
      }),
      () => {}
    )
    if (result && chapter.value) {
      chapter.value.summary = result.trim()
      await db.Chapters.save(chapter.value)
      ElMessage.success('概要已生成')
    }
  } catch (e: any) {
    ElMessage.error('生成失败：' + e.message)
  } finally {
    generating.value = false
  }
}

function batchSummary() {
  ElMessage.info('批量生成概要：已切换到章节列表，可逐章点击生成')
  router.push({ name: 'chapters' })
}

// ===== 编辑区操作 =====
function copyChapterText() {
  const text = editor.value?.getText() || ''
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}

function speakChapter() {
  const text = editor.value?.getText() || ''
  if (!text) {
    ElMessage.warning('章节为空')
    return
  }
  if ('speechSynthesis' in window) {
    // 取消之前的朗读，避免多次点击叠加多个 utterance 同时播放
    speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    speechSynthesis.speak(utter)
    ElMessage.success('开始朗读')
  } else {
    ElMessage.warning('浏览器不支持朗读')
  }
}

function highlightSel() {
  if (!editor.value) return
  // 简单实现：把选中内容加粗 + 标黄（通过 mark）
  editor.value.chain().focus().toggleBold().run()
  ElMessage.success('已标记')
}

function clearChapter() {
  if (!editor.value || !chapter.value) return
  if (!confirm('确定清空当前章节内容？此操作不可撤销')) return
  editor.value.commands.clearContent()
  ElMessage.success('已清空')
}

function doSearch() {
  // 简单搜索实现
  if (!searchKeyword.value || !editor.value) {
    searchMatches.value = 0
    return
  }
  const text = editor.value.getText()
  const matches = text.split(searchKeyword.value).length - 1
  searchMatches.value = matches
}

function formatTime(t: number) {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ===== 生命周期 =====
const inputRef = ref<HTMLTextAreaElement | null>(null)

onMounted(async () => {
  try {
    if (!project.value) {
      await projectStore.loadProject(route.params.id as string)
    }
    await loadChapter(currentChapterId.value)
    if (!aiModel.value && models.value.length > 0) {
      aiModel.value = project.value?.settings.model || settings.defaultModel() || models.value[0].model
    }
  } catch (e: any) {
    ElMessage.error('初始化失败：' + e.message)
  }
})

onBeforeUnmount(async () => {
  // 切换页面前静默保存一次，避免数据丢失
  try {
    await save({ silent: true })
  } catch (e: any) {
    console.error('[Editor] 卸载时保存失败:', e?.message || e)
  }
  // 取消朗读，避免切页面后继续播放
  if ('speechSynthesis' in window) {
    try { speechSynthesis.cancel() } catch {}
  }
  editor.value?.destroy()
})

watch(() => route.params.chapterId, async (id) => {
  if (id && id !== currentChapterId.value) {
    // 切换章节前静默保存
    await save({ silent: true })
    await loadChapter(id as string)
  }
})
</script>

<style scoped>
.editor-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

/* ===== 顶部通栏 ===== */
.topbar {
  height: 44px;
  background: #fafbfc;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  flex-shrink: 0;
  gap: 12px;
}
.topbar-left, .topbar-center, .topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.topbar-center { gap: 2px; flex: 1; justify-content: center; }
.tb-icon-btn {
  border: none;
  background: transparent;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.tb-icon-btn:hover:not(:disabled) { background: #e8eaed; color: #1a202c; }
.tb-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.word-count-pill {
  font-size: 12px;
  color: #4a5568;
  padding: 0 8px;
  border-left: 1px solid #e8eaed;
  margin-left: 4px;
}
.tb-fn-btn {
  border: none;
  background: transparent;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.tb-fn-btn:hover { background: #e8eaed; color: #1a202c; }
.tb-fn-btn .el-icon { font-size: 13px; }
.tb-fn-btn.tb-fn-active {
  background: var(--primary, #5b9bd5);
  color: #fff;
}
.tb-fn-btn.tb-fn-active:hover { background: var(--primary-dark, #3b82c4); color: #fff; }
.tb-sep {
  display: inline-block;
  width: 1px;
  height: 18px;
  background: #e2e8f0;
  margin: 0 4px;
}
html.dark .tb-sep { background: #334155; }
.tb-fn-danger { color: #e53e3e !important; font-weight: 600; }
.tb-fn-danger:hover { background: #fed7d7 !important; color: #c53030 !important; }

/* 搜索条 */
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: #fafbfc;
  border-bottom: 1px solid #ebeef5;
}
.search-bar .el-input { max-width: 320px; }

/* ===== 主体三栏 ===== */
.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* ===== 左侧栏 ===== */
.left-panel {
  width: 220px;
  background: #f7f8fa;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s;
  position: relative;
  overflow: hidden;
}
.left-panel.collapsed { width: 0; border-right: none; }
.left-panel.collapsed > * { display: none; }

.tree-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
}
.tree-title {
  font-size: 12px;
  color: #718096;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.tree-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
  font-size: 13px;
}
.tree-node { margin-bottom: 2px; }
.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: #2d3748;
}
.tree-row:hover { background: #edf2f7; }
.tree-row.active { background: #e6f0ff; color: #2563eb; font-weight: 500; }
.tree-icon { font-size: 14px; color: #a0aec0; }
.tree-toggle { font-size: 10px; color: #a0aec0; width: 12px; }
.tree-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.root-row { font-weight: 600; }
.tree-children {
  margin-left: 14px;
  border-left: 1px dashed #e2e8f0;
  padding-left: 4px;
}
.leaf-row { padding-left: 18px; }

.ai-analysis-section {
  border-top: 1px solid #ebeef5;
  padding: 10px 12px;
  background: #fafbfc;
}
.section-title {
  font-size: 12px;
  color: #718096;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.analysis-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
}
.analysis-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
  font-size: 13px;
  text-align: left;
  width: 100%;
}
.analysis-item:hover { background: #edf2f7; color: #1a202c; }
.analysis-actions {
  display: flex;
  gap: 6px;
}
.analysis-actions .el-button { flex: 1; }

.save-work-btn {
  width: 100%;
  margin-top: 10px;
  background: #1a202c;
  color: white;
  border: none;
  padding: 8px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.save-work-btn:hover { background: #2d3748; }
.save-work-btn.saving { background: #718096; }

.collapse-left {
  position: absolute;
  left: 220px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 40px;
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-left: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  color: #a0aec0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  transition: left 0.2s;
}
.left-panel.collapsed ~ .collapse-left { left: 0; }
.collapse-left:hover { background: #f7f8fa; color: #4a5568; }

/* ===== 中间编辑区 ===== */
.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  min-width: 0;
}
.chapter-head {
  padding: 18px 32px 12px;
  border-bottom: 1px solid #f1f2f5;
}
/* 收起箭头按钮：位于章节概要下方、编辑区工具栏上方 */
.collapse-head-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-3, #a0aec0);
  font-size: 12px;
  transition: background 0.15s, color 0.15s;
}
.collapse-head-btn:hover {
  background: #f7fafc;
  color: #4a5568;
}
.collapse-head-btn.collapsed {
  /* 收起状态下稍小一点 */
  height: 16px;
}
.chapter-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.chapter-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1a202c;
  flex: 1;
  outline: none;
  padding: 2px 4px;
  border-radius: 4px;
}
.chapter-title:hover { background: #f7fafc; }
.chapter-title:focus { background: #f7fafc; box-shadow: 0 0 0 2px #e6f0ff; }
.chapter-actions {
  display: flex;
  gap: 2px;
}
.chap-icon {
  border: none;
  background: transparent;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: #718096;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.chap-icon:hover { background: #edf2f7; color: #2d3748; }

.summary-card {
  background: #f0f7ff;
  border: 1px solid #d6e8ff;
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.summary-left {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
}
.summary-right {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.summary-content {
  flex-basis: 100%;
  color: #4a5568;
  font-size: 13px;
  line-height: 1.6;
  padding-top: 6px;
  border-top: 1px dashed #d6e8ff;
}

.write-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 32px;
  border-bottom: 1px solid #f1f2f5;
  flex-wrap: wrap;
}
.tb-btn {
  border: none; background: transparent;
  padding: 4px 8px; border-radius: 4px;
  cursor: pointer; color: #4a5568;
  font-size: 13px; min-width: 28px;
  display: inline-flex; align-items: center; justify-content: center;
}
.tb-btn:hover { background: #edf2f7; color: #1a202c; }
.tb-btn.active { background: #e6f0ff; color: #2563eb; }
.tb-sep { width: 1px; height: 16px; background: #e2e8f0; margin: 0 4px; }

.write-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 24px 0;
}
.tiptap-content {
  max-width: 760px;
  width: 100%;
  padding: 0 48px;
  font-size: 16px;
  line-height: 2;
  color: #1a202c;
  outline: none;
}
.tiptap-content :deep(p) { margin: 0 0 1em; }
.tiptap-content :deep(h2) { font-size: 22px; margin: 1.5em 0 0.6em; }
.tiptap-content :deep(h3) { font-size: 18px; margin: 1.2em 0 0.5em; }
.tiptap-content :deep(blockquote) {
  border-left: 3px solid #2563eb;
  padding-left: 14px; margin: 1em 0;
  color: #4a5568; font-style: italic;
}
.tiptap-content :deep(p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: #a0aec0; pointer-events: none; float: left; height: 0;
}

.editor-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 32px;
  border-top: 1px solid #f1f2f5;
  background: #fafbfc;
  font-size: 12px;
}
.save-status { margin-left: auto; }
.save-status.saving { color: #dd6b20; }
.save-status.saved { color: #38a169; }

/* ===== 右侧 AI 对话面板 ===== */
.right-panel {
  width: 340px;
  border-left: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  flex-shrink: 0;
}
.chat-display {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  height: 100%;
}
.chat-bubble-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #e6f0ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 14px;
}
.chat-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 8px;
}
.chat-empty-tip {
  font-size: 12px;
  color: #718096;
  line-height: 1.6;
  margin: 2px 0;
}
.hint-code {
  background: #f1f2f5;
  padding: 1px 6px;
  border-radius: 3px;
  font-family: monospace;
  color: #2563eb;
  font-weight: 600;
}
.billing-link {
  margin-top: 12px;
  font-size: 11px;
  color: #a0aec0;
  text-decoration: underline;
}
.canvas-link-btn {
  margin-top: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #2563eb;
  background: #f5f7fa;
  color: #606266;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}
.canvas-link-btn:hover {
  background: #e6f0ff;
  color: #2563eb;
}
/* 链接激活状态：偏蓝色高亮 */
.canvas-link-btn.canvas-linked {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
}
.canvas-link-btn.canvas-linked:hover {
  background: #1d4ed8;
}

.chat-list { display: flex; flex-direction: column; gap: 12px; }
.chat-msg {
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
}
.chat-msg.user {
  background: #e6f0ff;
  color: #2d3748;
  margin-left: 20px;
}
/* AI 消息容器本身不设背景，让内部 .ai-output-card 自己控制视觉 */
.chat-msg.assistant {
  background: transparent;
  color: #2d3748;
  margin-right: 0;
  border: none;
  padding: 4px 0;
}
.chat-msg-role {
  font-size: 11px;
  color: #718096;
  margin-bottom: 4px;
  font-weight: 600;
}
.chat-msg-content {
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-msg-content.streaming { color: #4a5568; }
.chat-msg-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
}

/* ===== AI 输出圆角长方形卡片 ===== */
.ai-output-card {
  background: linear-gradient(180deg, #f8faff 0%, #f1f5fb 100%);
  border: 1px solid #dbe5f3;
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.05);
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}
.ai-output-card:hover {
  border-color: #bcd0f5;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.1);
}
.ai-output-card.streaming-card {
  background: #fafbff;
  border-color: #c7d6f5;
}
.ai-output-top {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 20px;
}
.ai-output-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.7;
  color: #2d3748;
  padding: 4px 2px;
}
.ai-output-content.streaming { color: #4a5568; }

/* ===== AI 输出操作按钮（仅图标，无文字） ===== */
.ai-output-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.ai-output-actions.top-actions {
  gap: 2px;
}
.ai-output-actions.bottom-actions {
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
  margin-top: 2px;
}
.ai-act-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #718096;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
}
.ai-act-btn:hover:not(:disabled) {
  background: #2563eb;
  color: #fff;
}
.ai-act-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ai-act-btn.danger:hover:not(:disabled) {
  background: #ef4444;
}
.ai-act-btn .el-icon {
  font-size: 14px;
}

.cursor { animation: blink 1s infinite; color: #2563eb; }
@keyframes blink { 50% { opacity: 0; } }

.link-section {
  border-top: 1px solid #f1f2f5;
  padding: 8px 12px;
}
.link-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.linked-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.input-area {
  border-top: 1px solid #f1f2f5;
  padding: 10px 12px 6px;
  position: relative;
}
.skill-chip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.chat-input-wrap {
  position: relative;
  width: 100%;
}
.chat-input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 12px;
  /* 右下方给浮动按钮让出空间，避免文字被按钮遮挡 */
  padding-bottom: 44px;
  font-size: 14px;
  line-height: 1.65;
  resize: none;
  font-family: inherit;
  outline: none;
  background: #ffffff;
  color: #1a202c;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.chat-input:focus { border-color: #2563eb; box-shadow: 0 0 0 2px #e6f0ff; }

/* 显眼的“发送需求”按钮（textarea 右下角浮动） */
.send-demand-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
  transition: transform 0.12s, box-shadow 0.12s, background 0.12s;
  z-index: 2;
}
.send-demand-btn:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.4);
  background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%);
}
.send-demand-btn:active:not(.disabled) {
  transform: translateY(0);
}
.send-demand-btn.disabled,
.send-demand-btn:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
  box-shadow: none;
  color: #ffffff;
  opacity: 0.85;
}
.send-demand-btn .loading-icon {
  animation: rotate 1s linear infinite;
}
@keyframes rotate {
  to { transform: rotate(360deg); }
}

.slash-menu {
  position: absolute;
  bottom: 100%;
  left: 12px;
  right: 12px;
  max-height: 280px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 -4px 16px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  margin-bottom: 4px;
  z-index: 100;
}
.slash-menu-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f2f5;
  font-size: 12px;
  color: #718096;
  font-weight: 600;
}
.slash-menu-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}
.slash-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.slash-menu-item:hover { background: #f7fafc; }
.slash-icon { color: #2563eb; font-size: 16px; }
.slash-item-body { flex: 1; min-width: 0; }
.slash-item-name { font-size: 13px; color: #2d3748; font-weight: 500; }
.slash-item-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slash-empty { padding: 20px; text-align: center; }

.input-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px 10px;
  gap: 8px;
}
.input-bottom-left {
  display: flex;
  gap: 6px;
}
.input-bottom-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.screenshot-hint { color: #cbd5e0; }

/* ===== 历史抽屉 ===== */
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item {
  padding: 10px 12px;
  background: #f7fafc;
  border-radius: 6px;
  cursor: pointer;
}
.history-item:hover { background: #edf2f7; }
.history-title { font-size: 13px; color: #2d3748; font-weight: 500; }
.history-time { margin-top: 2px; }

/* ===== @ 关联菜单（复用 slash-menu 样式） ===== */
.at-menu { /* 与 .slash-menu 同位置，独立标记便于扩展 */ }
.at-menu .more-item {
  border-top: 1px dashed var(--border);
  color: var(--primary);
}
.at-menu .more-item:hover {
  background: rgba(0, 100, 250, 0.06);
}

/* ===== @ 多选关联小窗 ===== */
.at-picker-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
  max-height: 65vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.at-picker {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.at-picker-summary {
  margin-bottom: 8px;
}
.at-picker-groups {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  background: var(--bg-2, transparent);
}
.at-picker-group {
  border-bottom: 1px solid var(--border);
  padding: 4px 0;
}
.at-picker-group:last-child {
  border-bottom: none;
}
.at-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  user-select: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
}
.at-group-header:hover {
  background: var(--bg-1, rgba(0,0,0,0.03));
}
.at-group-toggle {
  font-size: 12px;
  color: var(--text-3);
}
.at-group-name {
  flex: 1;
}
.at-group-count {
  font-weight: normal;
}
.at-group-body {
  padding: 2px 4px 6px 22px;
}
.at-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.at-item:hover {
  background: var(--bg-1, rgba(0,0,0,0.04));
}
.at-item.checked {
  background: rgba(0, 122, 255, 0.08);
}
.at-item-check {
  margin-top: 3px;
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--primary, #007aff);
  flex-shrink: 0;
}
.at-item-icon {
  margin-top: 2px;
  color: var(--text-3);
  flex-shrink: 0;
}
.at-item.checked .at-item-icon {
  color: var(--primary, #007aff);
}
.at-item-body {
  flex: 1;
  min-width: 0;
}
.at-item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.at-item-preview {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.at-group-empty,
.at-picker-empty {
  padding: 12px;
  text-align: center;
}

/* ===== AI 提问选项卡片 ===== */
.chat-options-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
.options-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.option-btn {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 6px;
  background: var(--panel, #f8fafc);
  color: var(--text, #1e293b);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: all 0.15s;
  font-family: inherit;
}
.option-btn:hover:not(.selected) {
  border-color: var(--primary, #5b9bd5);
  background: var(--primary-light, #e0f2fe);
}
.option-btn.selected {
  border-color: var(--primary, #5b9bd5);
  background: var(--primary, #5b9bd5);
  color: #fff;
  cursor: default;
}
.option-btn.custom .option-letter {
  background: #f59e0b;
}
.option-btn.selected .option-letter {
  background: rgba(255,255,255,0.25);
  color: #fff;
}
.option-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-light, #e0f2fe);
  color: var(--primary, #5b9bd5);
  font-weight: 600;
  font-size: 12px;
  flex-shrink: 0;
}
.option-text {
  flex: 1;
  line-height: 1.5;
}
.option-selected-hint {
  font-size: 12px;
  color: var(--primary, #5b9bd5);
  padding: 4px 0 0;
  text-align: right;
}
</style>
