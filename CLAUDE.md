# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指引。

## 项目概述

视频审查工作台 — 纯前端视频模型输出审查工具，无后端，浏览器直接运行。通过 GitHub Pages 部署：https://eastmoonzi.github.io/video-reviewer/

## 本地运行

浏览器直接打开 `Cerberus.html` 即可（双击或 `open Cerberus.html`）。无构建步骤、无开发服务器、无包管理器。`index.html` 仅做跳转用。

## 架构

整个应用是单个文件：
- **`Cerberus.html`** — HTML 结构 + 内联 CSS + 全部应用逻辑（约 7570 行）
- **`version.json`** — 版本号 + 下载地址，用于检测更新
- **`index.html`** — 仅重定向到 Cerberus.html（GitHub Pages 入口）

CDN 外部依赖（无本地安装）：Tailwind CSS、SheetJS (xlsx)、SortableJS、Material Design Icons。

### 核心架构模式

- **全局 `state` 对象**（~第 1262 行）：单一可变状态对象，三种模式各有独立的 tasks / taskIndex / workspaces / ratings / notes 字段，通过 `reviewMode`（`'segment'` / `'profile'` / `'audiovisual'`）区分当前模式
- **持久化**：大数据用 IndexedDB（`idb` 对象，~第 1216 行）存储工作区内容，轻量状态用 `saveToLocalStorage()` / `loadFromLocalStorage()`（~第 5266 行）
- **三种审核模式**：`segment`（分段语义详情，1-3 分）、`profile`（全篇语义画像，0-2 分）、`audiovisual`（基础音画质量，0-2 分），通过 `switchReviewMode(mode)` 切换
- **多工作区**：三种模式各有独立工作区集合，由 `createWorkspace()`、`switchWorkspace()`、`deleteWorkspace()` 管理
- **对比模式**：多模型输出并排对比，通过 `toggleComparisonMode()` 切换
- **导入流程**：Excel 通过 SheetJS（`parseExcel()`）、JSONL 通过 `parseJsonl()` → `convertJsonlToTask()` 导入；多文件按 `video_url` 自动合并模型输出
- **JSON 容错**：`quickParseJson()` 包含多级修复（代码块剥离、XML 标签、尾逗号、`}{` 补逗号、Python dict 语法等）
- **格式自动识别**：`normalizeModelOutput()` 根据字段名判断数据类型；**注意**：该函数在 ~第 4855 行定义后，在 ~第 6634 行被覆写为增强版本，实际生效的是覆写版
- **LLM 修复**：JSON 解析失败的条目可调用 LLM API 自动修复（支持 DeepSeek、OpenAI 兼容接口）

### 格式识别逻辑（`normalizeModelOutput`）

- 含 `segment_detail` / `segment_output` → 分段语义详情（仅提取分段，忽略同级 `global_profile`）
- 含 `global_profile` / `narrative_type` 等（且无分段字段）→ 全篇语义画像
- 含 `vision_quality` / `audiovisual_integration` / `visual_integration` → 基础音画质量

### Cerberus.html 主要代码分区

| 起始行 | 内容 |
|--------|------|
| ~1206 | 脚本入口、`APP_VERSION`、IndexedDB (`idb`) |
| ~1262 | 全局 `state` 对象定义 |
| ~1754 | `DOMContentLoaded` 初始化 |
| ~2103 | 视频播放控制（`togglePlay`、`renderTimeline`） |
| ~2326 | 标签页/内容渲染（`switchTab`） |
| ~2709 | 更新检测（`checkForUpdate`） |
| ~3019 | 评分系统（`setRating`） |
| ~3652 | 导入/导出（`importTasks`） |
| ~3835 | JSON/JSONL 解析（`parseJsonl`、`convertJsonlToTask`、`quickParseJson`） |
| ~4591 | Excel 解析（`parseExcel`） |
| ~4855 | `normalizeModelOutput`（原始版，被 ~6634 行覆写） |
| ~5266 | localStorage 持久化 |
| ~5536 | 审核模式切换（`switchReviewMode`） |
| ~5759 | 全篇语义画像 & 基础音画质量渲染 |
| ~6050 | 评分监听器（`initRatingListeners`） |
| ~6634 | `normalizeModelOutput` 覆写（实际生效版） |
| ~6734 | 工具函数（排序、导出等） |

## 版本更新

发版时需同步修改两处：
1. `Cerberus.html` 中 `const APP_VERSION = 'YYYY-MMDDx';`（~第 1209 行）
2. `version.json` 中 `"version": "YYYY-MMDDx"`

## 语言约定

UI 界面和注释使用中文（zh-CN），变量名和函数名使用英文。
