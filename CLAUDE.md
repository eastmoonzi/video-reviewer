# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指引。

## 项目概述

视频审查工作台 — 纯前端视频模型输出审查工具，无后端，浏览器直接运行。通过 GitHub Pages 部署：https://eastmoonzi.github.io/video-reviewer/

## 本地运行

浏览器直接打开 `index.html` 即可（双击或 `open index.html`）。无构建步骤、无开发服务器、无包管理器。

## 架构

整个应用只有两个文件：
- **`index.html`** — HTML 结构 + 内联 CSS（通过 CDN 引入 Tailwind CSS、MDI 图标）
- **`app.js`** — 全部应用逻辑（约 5600 行，单文件，无模块化）

CDN 外部依赖（无本地安装）：Tailwind CSS、SheetJS (xlsx)、SortableJS、Material Design Icons。

### 核心架构模式

- **全局 `state` 对象**（app.js 第 8 行）：单一可变状态对象，保存所有应用状态（工作区、任务、评分、备注、当前索引、UI 模式）
- **localStorage 持久化**：所有数据通过 `saveToLocalStorage()` / `loadFromLocalStorage()` 存取，无后端 API
- **三种审核模式**：`segment`（分段语义详情，1-3 分）、`profile`（全篇语义画像，0-2 分）、`audiovisual`（基础音画质量，0-2 分），通过 `switchReviewMode(mode)` 切换
- **多工作区**：每个工作区数据完全隔离，由 `createWorkspace()`、`switchWorkspace()`、`deleteWorkspace()` 管理
- **对比模式**：多模型输出并排对比，通过 `toggleComparisonMode()` 切换
- **导入流程**：Excel 通过 SheetJS（`parseExcel()`）、JSONL 通过 `parseJsonl()` 导入，含大量 JSON 容错修复（`repairTruncatedJson()`、`pythonDictToJson()`、`quickParseJson()`）
- **LLM 修复**：JSON 解析失败的条目可调用 LLM API 自动修复（支持 DeepSeek、OpenAI 兼容接口）

### app.js 主要代码分区

文件按注释分隔符组织：
- 工作区管理（~第 242 行）
- 视频播放控制（~第 467 行）
- 时间轴渲染（~第 653 行）
- 标签页/内容渲染（~第 690 行）
- 评分系统（~第 1282 行）
- 任务导航与选择（~第 1321 行）
- 导入/导出（~第 1915 行）
- JSON/Excel 解析（~第 2097 行）
- localStorage 持久化（~第 3457 行）
- 审核模式切换（~第 3710 行）
- 全篇语义画像 & 基础音画质量渲染（~第 3814 行）
- 评分监听器（~第 4207 行）
- 列布局与 UI（~第 4951 行）
- 对比模式（~第 5094 行）

## 语言约定

UI 界面和注释使用中文（zh-CN），变量名和函数名使用英文。
