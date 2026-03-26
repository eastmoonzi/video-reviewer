# 视频审查工作台

纯前端视频模型输出审查工具，支持三种评审模式、多模型对比、LLM 自动修复。无需后端，浏览器直接运行。

**在线使用** → https://eastmoonzi.github.io/video-reviewer/

## 快速开始

在线打开上方链接即可使用，或本地双击 `Cerberus.html` 打开。
<img width="1440" height="750" alt="image" src="https://github.com/user-attachments/assets/ce86dfb6-f2f6-4acb-84e2-ae3f5ac344e4" />

** llm 修复功能
使用预设的 key 即可


## 功能概览

- **三种评审模式**：分段语义详情（1-3 分）、全篇语义画像（0-2 分）、基础音画质量（0-2 分）
- **多模型对比**：同一视频可导入多个模型输出，顶部按钮一键切换
- **导入格式**：Excel（.xlsx/.xls）和 JSONL，支持多文件导入自动按视频 URL 合并
- **JSON 容错**：自动处理代码块包裹、XML 标签、Python dict 语法、截断修复
- **LLM 修复**：解析失败的条目可调用 LLM 自动修复，内置默认 API 开箱即用
- **多工作区**：数据完全隔离，独立保存任务和评分进度
- **本地持久化**：所有数据保存在 localStorage，刷新不丢失
- **导出**：一键导出 Excel，含所有维度评分和备注
- **多模型输出对比**： 将视频以小窗方式播放，模型内容并排排列，方便对比

## 导入格式

### Excel

自动检测列结构，无需固定列顺序：

| nid（可选）| 视频链接 | 标题（可选）| 模型A | 模型B | ... |
|-----------|---------|-----------|-------|-------|-----|
| 001 | https://video.mp4 | 视频标题 | {JSON} | {JSON} | ... |

### JSONL

每行一个 JSON 对象，多文件导入时按 `video_url` 自动合并：

```json
{"nid": "001", "video_url": "https://video.mp4", "model_name": "模型A", "response": { ... }}
```

### 格式自动识别

- 含 `segment_detail` / `segment_output` → 分段语义详情
- 含 `global_profile` / `narrative_type` → 全篇语义画像
- 含 `vision_quality` / `audiovisual_integration` → 基础音画质量

## LLM 修复

导入时 JSON 解析失败的条目，可通过 LLM 自动修复为标准 JSON。

- **默认 API**：内置 DeepSeek API，勾选「使用默认 API」即可直接使用
- **自定义 API**：取消勾选后填写 Base URL、API Key、模型名称
- **单条修复**：点击解析失败卡片上的「修复此条」按钮
- **批量修复**：点击侧边栏「全部修复」，后台并发处理不阻塞操作

支持 DeepSeek、OpenAI、Anthropic 及任何 OpenAI 兼容接口。


## 对比模式
当前任务存在多个模型的输出时，可以选择以对比模式进行审查（多于两个模型时可以点击标题切换当前模型）：
<img width="1440" height="779" alt="image" src="https://github.com/user-attachments/assets/065dab68-49d8-4e34-b625-e47ca9aff774" />



## 快捷键

| 按键 | 功能 |
|------|------|
| Space | 播放 / 暂停 |
| ← / → | 后退 / 前进 5 秒 |
| Enter | 提交并下一条 |
| Tab | 切换标签页 |
| 1 / 2 / 3 | 快速评分 |

## 命令行预处理

适合导入前批量修复，需 `pip install openpyxl`：

```bash
# Excel
export LLM_API_KEY=sk-...
python3 repair_excel.py input.xlsx output.xlsx

# JSONL
python3 repair_jsonl.py input.jsonl output.jsonl --fields response
```
