# AI 写小说 · Windows 桌面版


## 🚀 快速开始（Windows）

### 方式一：一键脚本（推荐小白）

1. 解压本压缩包到任意目录（路径不要含中文/空格更稳）
2. 双击 **`一键安装运行.bat`**
3. 按提示选择：
   - `1` = 开发模式直接运行
   - `2` = 打包成 exe 安装包

### 方式二：手动命令

需要先装 [Node.js 18+](https://nodejs.org/zh-cn/download/)。

```bat
:: 安装依赖
npm install

:: 方式 A：开发模式（开两个终端分别跑）
npm run dev
npm run dev:electron

:: 方式 B：打包成 exe
npm run build:win
```

打包完成后，`release\` 目录里会有 **`AI写小说 Setup 1.0.0.exe`**，双击即可安装。

## 📖 使用流程

1. 启动应用 → 进入「设置」配置任一 AI 提供商的 API Key
   - 支持 OpenAI / DeepSeek / 通义千问 / OpenRouter（任选其一）
   - 国内用户推荐 DeepSeek（便宜）或通义千问（有免费额度）
2. 「我的书架」→ 新建小说（可选玄幻/都市/科幻/历史模板）
3. 章节列表 → 「AI 生成分章大纲」一键起手
4. 进入写作界面，右侧 AI 助手点「续写」即可流式创作
5. 长篇定期跑「AI 更新所有真相文件」+「AI 多模型评审」保证全书一致性
6. 完成后「导出」EPUB / DOCX / PDF

## ✨ 功能清单

- **核心创作**：Tiptap 富文本编辑器、流式 AI 续写/润色/重写/扩写/缩写/摘要
- **章节管理**：拖拽排序、状态标记、AI 大纲生成、AI 章节摘要
- **世界观**：角色库（含关系网+AI 批量生成）、地点、设定档案（按分类管理）
- **故事规划**：时间线（关联章节/角色）、故事画布（节点拖拽+SVG 连线）
- **AI 高级**：提示词库（10 个内置模板+自定义+测试）、AI 多模型交叉评审（参考 InkOS 理念）、7 个长期记忆真相文件
- **写作追踪**：每日/周/月目标、90 天热力图、连续天数
- **导出**：Markdown / HTML / EPUB / DOCX / PDF
- **主题**：浅色/深色、字体大小、编辑器字体可调
- **数据**：本地 JSON 存储，断网可用，隐私安全

## 🛠 技术栈

- Electron 31 + Vue 3.4 + TypeScript 5.5
- Vite 5 + Pinia + Vue Router + Element Plus
- Tiptap 2 富文本、lowdb 本地存储
- electron-builder 打包 NSIS 安装包

## ❓ 常见问题

**Q: 打包时报 Electron 下载失败？**
A: 网络问题。改用国内镜像：
```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm run build:win
```

**Q: AI 调用报 401？**
A: API Key 没配或填错。进「设置」→ 对应 provider → 填入 Key。

**Q: 数据存在哪？**
A: `%APPDATA%\ainovelwriter\db.json`，可备份。

**Q: 离线能用吗？**
A: 编辑/管理功能可离线，AI 功能需要联网调 API。

## 📝 许可

MIT
