# 视频审查工作台 — 数据层加固设计

**日期**：2026-03-24
**状态**：设计完成，待实施
**目标文件**：`Cerberus.html`（单文件应用，HTML + JS 合一）

## 背景

视频审查工作台目前供团队内数人使用，审核视频模型的结构化输出。目标是提升工具可靠性后支撑更大团队使用。

### 本次解决的痛点

1. **原始文本存储不稳定** — `_raw` 的拼装逻辑散落在 `convertJsonlToTask` 的多个出口，每个出口拼装方式不同，遇到新场景就打补丁，历史上多次出现原文不完整的问题。
2. **离线用户无法感知更新** — 用户下载 HTML 到本地使用，无法得知工具有新版本发布。

### 不在本次范围内

- 统一数据模型 / 合并 task 列表（三种审核模式完全独立，无交叉需求）
- 导入解析管道重构（自动检测逻辑可靠，无需改变分发方式）
- LLM 修复自动化（原文存对后手动修复够用）
- localStorage 版本化
- 部署困境 / 数据协作

---

## 改进 1：原始文本完整保存

### 现状

`convertJsonlToTask`（Cerberus.html 第 3379 行）中，原文保存逻辑分散在四个出口：

| 出口 | 位置 | 存储方式 | 问题 |
|------|------|----------|------|
| 解析失败 | ~3427-3440 | `errorOutput.raw = fullRaw` | 用 `.raw` |
| 真正为空 | ~3442-3447 | 不存原文 | 无 `_raw` |
| audiovisual | ~3462-3463 | `avOutput._raw = rawResponseStr + cot拼接` | 用 `._raw`，逐步拼接 |
| segment | ~3587-3588 | `output._raw = rawResponseStr + cot拼接` | 用 `._raw`，逐步拼接 |

此外，Excel 导入路径 `parseJsonCell`（第 3880-3897 行）也有类似的 `_raw` / `.raw` 赋值。

问题：
- 字段名不统一：解析失败用 `.raw`，成功用 `._raw`
- 拼装逻辑不统一：每个出口独立维护
- `rawResponseStr` 仅在 response 为字符串时赋值，从 `messages` 提取的内容可能丢失

### 方案

**抽取统一的原文提取函数 `extractRawText(obj)`，在解析之前调用。原文仍存在每个 output 对象上（因为多模型对比时每个 output 有独立原文），但提取逻辑集中到一处。**

提取规则：
1. 有 `response` 字段（字符串形式）→ 加入 rawParts
2. 有 `cot` 字段 → 加入 rawParts
3. 两个都有 → 都保留
4. 都没有 → 从 `messages` 中找 assistant 回复文本，或从可用文本中提取 `<json_output>` 标签内容（复用现有 `quickParseJson` 中的标签提取逻辑）

```javascript
function extractRawText(obj) {
    const rawParts = [];

    // 1. response 原文
    let responseStr = obj.response;
    if (responseStr === undefined && Array.isArray(obj.messages)) {
        const assistant = obj.messages.find(m => m.role === 'assistant');
        if (assistant) {
            responseStr = typeof assistant.content === 'string'
                ? assistant.content
                : assistant.content?.find(c => c.type === 'text')?.text;
        }
    }
    if (typeof responseStr === 'string' && responseStr.trim()) {
        rawParts.push(responseStr.trim());
    }

    // 2. cot 原文
    if (obj.cot) {
        rawParts.push(typeof obj.cot === 'string' ? obj.cot : JSON.stringify(obj.cot));
    }

    return rawParts.length > 0 ? rawParts.join('\n\n---\n\n') : '';
}
```

### 变更清单

**JSONL 导入路径 (`convertJsonlToTask`)**：

1. **新增** `extractRawText(obj)` 函数
2. **修改** `convertJsonlToTask` 开头：调用 `const rawText = extractRawText(obj)`
3. **修改** 解析失败出口（~3435）：`errorOutput.raw` → `errorOutput._raw = rawText`
4. **修改** 真正为空出口（~3443）：补上 `output._raw = rawText`（即使为空也保持一致）
5. **删除** audiovisual 出口的拼装（~3462-3463），改为 `avOutput._raw = rawText`
6. **删除** segment 出口的拼装（~3587-3588），改为 `output._raw = rawText`

**Excel 导入路径 (`parseJsonCell`，第 3880-3897 行)**：
7. **修改** 错误路径（第 3896 行）：`{ _parseError: true, raw: str }` → `{ _parseError: true, _raw: str }`
8. 成功路径（第 3890 行）已使用 `._raw`，无需改动

**统一字段名**：全部使用 `._raw`，不再使用 `.raw`

**原文消费者清单（需更新读取方式）**：

| 消费者 | 行号 | 当前读取方式 | 改为 |
|--------|------|-------------|------|
| 内联错误展示 | 1967 | `output.raw` | `output._raw` |
| `repairSingleOutput` | 2109 | `output.raw \|\| output._raw \|\| JSON.stringify(output)` | `output._raw \|\| JSON.stringify(output)` |
| `repairAllErrors` | 2141 | `output.raw` | `output._raw` |
| `renderRawContent` | 2313-2314 | `output.raw`（错误）/ `output._raw`（正常） | 统一 `output._raw` |
| 对比模式错误展示 | 6588 | `output.raw` | `output._raw` |

**向后兼容**：用户 localStorage 中可能存在旧数据使用 `.raw` 字段。在 `loadFromLocalStorage` 函数末尾（`setTimeout` 之前）增加迁移逻辑：遍历所有 task 的 model_outputs，如有 `.raw` 无 `._raw` 则复制过去并删除 `.raw`。

**已知限制**：当 `obj.response` 已经是解析后的对象（非字符串）时，`extractRawText` 无法提取其原文。这与当前行为一致——此时原始数据中没有字符串形式的 response 可保存。

---

## 改进 2：版本更新提示

### 方案

**1. 仓库新增 `version.json`**：

```json
{
    "version": "2026-03-24a",
    "download_url": "https://raw.githubusercontent.com/eastmoonzi/video-reviewer/main/Cerberus.html"
}
```

**2. HTML 内嵌版本号**：复用现有 `build` 字段（第 1183 行，当前值 `2026-03-10a`），提取为常量：

```javascript
const APP_VERSION = '2026-03-24a';
```

**3. 启动时检查更新**：

- 页面 `DOMContentLoaded` 后异步 fetch `https://raw.githubusercontent.com/eastmoonzi/video-reviewer/main/version.json`
- 版本比较：字符串直接比较（`remoteVersion !== APP_VERSION`），不做语义化版本解析
- fetch 失败或超时（3s）静默忽略
- 版本不一致时在页面顶部（工作区标签栏上方）插入提示条

**4. 提示条 UI**：

```
[更新图标] 有新版本可用 (v2026-03-24a)    [下载更新] [×关闭]
```

- 蓝色背景，不遮挡内容，可通过 × 关闭
- 关闭后本次会话不再提示（不持久化到 localStorage，下次打开仍会提示）

**5. 下载更新**：

- 点击"下载更新" → fetch `download_url` 获取最新 HTML 内容
- 通过 `new Blob([html], {type:'text/html'})` + `URL.createObjectURL` + `<a download="Cerberus.html">` 触发浏览器下载
- 用户手动保存覆盖本地文件，刷新页面完成更新

---

## 开发约束

- 所有改动在 `Cerberus.html` 上进行
- 无构建步骤，无外部依赖新增
- UI 文案使用中文，变量名使用英文
- 在 `new1` 分支上开发
