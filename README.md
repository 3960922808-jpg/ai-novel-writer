# TrmWrite 2

本地优先的人工智能长篇小说创作工作台，面向网文、类型小说与系列故事写作。项目基于原有 `ai-novel-writer` 重构，并借鉴墨枢的长篇叙事工程理念独立实现。

## 主要能力

- 沉浸式章节编辑：自动保存、版本快照、续写、重写、润色、扩写和摘要。
- 小说工程管理：章节、角色、地点、世界观、时间线、故事画布和写作目标。
- 长篇一致性：当前状态、人物矩阵、伏笔、支线、情绪弧和章节摘要等真相文件。
- Obsidian 记忆系统：将章节与知识库导出为 Markdown，并将 Obsidian 中修改的长期记忆导回应用。
- 多模型接入：兼容采用 OpenAI 接口格式的服务，可配置多个服务商和模型。
- 创作辅助：提示词库、技能库、文风蒸馏、拆书分析和多模型交叉评审。
- 本地数据：创作数据存放在本机，不依赖云端账户；人工智能调用需要用户自行配置接口。
- 多格式导出：Markdown、HTML、EPUB、DOCX 和 PDF。

## Obsidian 同步

1. 在项目侧栏进入“Obsidian 记忆”。
2. 选择现有 Obsidian 仓库目录。
3. 点击“双向同步”。应用会在仓库中创建 `TrmWrite/项目名-项目编号/`。
4. 可在 Obsidian 的“记忆”目录编辑真相文件，之后再次双向同步导回应用。

同步目录包含项目主页、章节、记忆、设定、地点和时间线。文件使用稳定元数据关联应用记录，文件写入采用临时文件替换方式，降低同步中断导致损坏的风险。

## 本地开发

需要 Node.js 20 或更高版本。

```bash
npm ci
npm run dev
```

类型检查与生产构建：

```bash
npm run typecheck
npm run build
```

## Windows 打包

```bash
npm run build:win
```

构建结果位于 `release/`：

- `TrmWrite-Setup-2.0.0.exe`：安装版。
- `TrmWrite-2.0.0-x64.zip`：免安装压缩版。

推送形如 `v2.0.0` 的标签后，GitHub 工作流会自动构建并把两种文件上传到对应版本页面。

## 数据与安全

- 接口密钥仅保存在本机应用数据中，不应写入源码或提交到仓库。
- Windows 默认数据位置为 `%APPDATA%/ainovelwriter/ainovelwriter/db.json`。
- 在覆盖安装、迁移电脑或大规模同步前，建议备份该文件和 Obsidian 仓库。

## 技术栈

Electron、Vue 3、TypeScript、Vite、Pinia、Element Plus、Tiptap 和 lowdb。

## 许可证

MIT
