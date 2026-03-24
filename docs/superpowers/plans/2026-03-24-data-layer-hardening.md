# 数据层加固 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一原始文本保存逻辑并添加版本更新提示功能

**Architecture:** 在 `Cerberus.html` 中新增 `extractRawText()` 函数统一原文提取，替换分散在 4 个出口的拼装逻辑；统一字段名为 `._raw`；新增版本检查和下载更新功能。

**Tech Stack:** 纯前端 JavaScript，无构建工具，Tailwind CSS（CDN）

**Spec:** `docs/superpowers/specs/2026-03-24-data-layer-hardening-design.md`

**注意：** 所有行号均指编辑前的原始文件。每个 Task 的修改会导致后续行号偏移，实施时请按代码内容定位，不要依赖行号。已在 `new1` 分支上开发。

---

### Task 1: 新增 `extractRawText` 函数

**Files:**
- Modify: `Cerberus.html:3379` — 在 `convertJsonlToTask` 函数之前插入新函数

- [ ] **Step 1: 在 `convertJsonlToTask` 之前插入 `extractRawText` 函数**

在 Cerberus.html 第 3378 行（`convertJsonlToTask` 前一行）之前插入：

```javascript
// 统一提取原始文本，在解析之前调用
function extractRawText(obj) {
    const rawParts = [];

    // 1. response 原文（可能来自 obj.response 或 obj.messages）
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

- [ ] **Step 2: 在 `convertJsonlToTask` 中调用 `extractRawText` 并存入 rawText**

在 Cerberus.html `convertJsonlToTask` 函数内，`const task = { ... }` 赋值之后（第 3389 行之后），插入一行：

```javascript
    const rawText = extractRawText(obj);
```

- [ ] **Step 3: Commit**

```bash
git add Cerberus.html
git commit -m "feat: 新增 extractRawText 统一原文提取函数"
```

---

### Task 2: 替换 4 个出口的 `_raw` 拼装逻辑

**Files:**
- Modify: `Cerberus.html:3435` — 解析失败出口
- Modify: `Cerberus.html:3443` — 空任务出口
- Modify: `Cerberus.html:3461-3463` — audiovisual 出口
- Modify: `Cerberus.html:3586-3588` — segment 出口

- [ ] **Step 1: 修改解析失败出口（~第 3427-3440 行）**

将第 3427-3435 行的原文拼装逻辑替换。

原代码：
```javascript
        // response 在前、cot 在后，全部保留不截断，供显示和 LLM 修复
        const rawParts = [];
        if (rawResponseStr) rawParts.push(rawResponseStr);
        if (obj.cot) rawParts.push(typeof obj.cot === 'string' ? obj.cot : JSON.stringify(obj.cot));
        const fullRaw = rawParts.join('\n\n---\n\n');

        if (fullRaw.trim()) {
            // 有原始内容但解析失败 → _parseError，供 LLM 修复
            const errorOutput = { _parseError: true, raw: fullRaw };
```

替换为：
```javascript
        if (rawText.trim()) {
            // 有原始内容但解析失败 → _parseError，供 LLM 修复
            const errorOutput = { _parseError: true, _raw: rawText };
```

- [ ] **Step 2: 修改空任务出口（~第 3442-3447 行）**

在第 3443 行 `task.model_output = { segments: [] };` 改为：

```javascript
        task.model_output = { segments: [], _raw: rawText };
        task.model_outputs = [{ segments: [], _raw: rawText }];
```

（替换原来的两行 `task.model_output = { segments: [] }; task.model_outputs = [{ segments: [] }];`）

- [ ] **Step 3: 修改 audiovisual 出口（~第 3461-3463 行）**

将：
```javascript
        const avOutput = { audiovisual: response };
        if (rawResponseStr) avOutput._raw = rawResponseStr;
        if (obj.cot) avOutput._raw = (avOutput._raw || '') + '\n\n--- COT ---\n\n' + obj.cot;
```

替换为：
```javascript
        const avOutput = { audiovisual: response, _raw: rawText };
```

- [ ] **Step 4: 修改 segment 出口（~第 3586-3588 行）**

将：
```javascript
    const output = { segments };
    if (rawResponseStr) output._raw = rawResponseStr;
    if (obj.cot) output._raw = (output._raw || '') + '\n\n--- COT ---\n\n' + obj.cot;
```

替换为：
```javascript
    const output = { segments, _raw: rawText };
```

- [ ] **Step 5: 删除 `rawResponseStr` 变量（已成为死代码）**

`rawResponseStr` 原来用于两个目的：(1) 记录原始字符串供后续 `_raw` 拼装，(2) 赋值本身。现在 `_raw` 拼装已移至 `extractRawText`，而 `quickParseJson(respStr)` 使用的是局部变量 `respStr`，不是 `rawResponseStr`。因此 `rawResponseStr` 已无任何读取方，是死代码。

将第 3409 行 `let rawResponseStr = null;` 和第 3415 行 `rawResponseStr = respStr;` 两行删除。

- [ ] **Step 6: Commit**

```bash
git add Cerberus.html
git commit -m "refactor: 统一 4 个出口的原文存储逻辑，使用 extractRawText"
```

---

### Task 3: 统一 `_raw` 字段名——更新所有消费者

**Files:**
- Modify: `Cerberus.html:1967` — 内联错误展示
- Modify: `Cerberus.html:2109` — repairSingleOutput
- Modify: `Cerberus.html:2141` — repairAllErrors
- Modify: `Cerberus.html:2313` — renderRawContent
- Modify: `Cerberus.html:3896` — parseJsonCell 错误路径
- Modify: `Cerberus.html:6588` — 对比模式错误展示

- [ ] **Step 1: 修改内联错误展示（第 1967 行）**

将：
```javascript
${escapeHTML(output.raw || '')}
```
改为：
```javascript
${escapeHTML(output._raw || '')}
```

- [ ] **Step 2: 修改 `repairSingleOutput`（第 2109 行）**

将：
```javascript
        const rawText = output.raw || output._raw || JSON.stringify(output);
```
改为：
```javascript
        const rawText = output._raw || JSON.stringify(output);
```

- [ ] **Step 3: 修改 `repairAllErrors`（第 2141 行）**

将：
```javascript
            if (output?._parseError) toRepair.push({ ti, gi, raw: output.raw });
```
改为：
```javascript
            if (output?._parseError) toRepair.push({ ti, gi, raw: output._raw });
```

- [ ] **Step 4: 修改 `renderRawContent`（第 2312-2314 行）**

将：
```javascript
    const isError = !!output._parseError;
    const rawStr = isError
        ? (output.raw || '')
        : (output._raw || JSON.stringify(output, null, 2));
```
改为：
```javascript
    const isError = !!output._parseError;
    const rawStr = output._raw || (isError ? '' : JSON.stringify(output, null, 2));
```

- [ ] **Step 5: 修改 `parseJsonCell` 错误路径（第 3896 行）**

将：
```javascript
    return { _parseError: true, raw: str };
```
改为：
```javascript
    return { _parseError: true, _raw: str };
```

- [ ] **Step 6: 修改对比模式错误展示（第 6588 行）**

将：
```javascript
${escapeHTML(output.raw || '')}
```
改为：
```javascript
${escapeHTML(output._raw || '')}
```

- [ ] **Step 7: Commit**

```bash
git add Cerberus.html
git commit -m "refactor: 统一原文字段名为 ._raw，更新所有消费者"
```

---

### Task 4: 向后兼容迁移

**Files:**
- Modify: `Cerberus.html:4741` — loadFromLocalStorage 函数内，setTimeout 之前

- [ ] **Step 1: 在 `loadFromLocalStorage` 中添加迁移逻辑**

在第 4741 行（`if (av) state.audiovisualTasks = av;`）之后、第 4743 行（`setTimeout`）之前插入：

```javascript
        // 迁移旧数据：.raw → ._raw
        [state.segmentTasks, state.profileTasks, state.audiovisualTasks].forEach(tasks => {
            tasks?.forEach(task => {
                task.model_outputs?.forEach(o => {
                    if (o && o.raw !== undefined && o._raw === undefined) {
                        o._raw = o.raw;
                        delete o.raw;
                    }
                });
            });
        });
```

- [ ] **Step 2: Commit**

```bash
git add Cerberus.html
git commit -m "feat: 添加 .raw → ._raw 向后兼容迁移"
```

---

### Task 5: 版本更新提示——版本常量和 `version.json`

**Files:**
- Create: `version.json`（仓库根目录）
- Modify: `Cerberus.html:1183` — build 注释行附近添加版本常量

- [ ] **Step 1: 创建 `version.json`**

在仓库根目录创建 `version.json`：

```json
{
    "version": "2026-03-24a",
    "download_url": "https://raw.githubusercontent.com/eastmoonzi/video-reviewer/main/Cerberus.html"
}
```

- [ ] **Step 2: 在 `Cerberus.html` 中添加版本常量**

在第 1183 行 `// build: 2026-03-10a` 之后插入：

```javascript
const APP_VERSION = '2026-03-24a';
```

- [ ] **Step 3: Commit**

```bash
git add version.json Cerberus.html
git commit -m "feat: 添加版本号常量和 version.json"
```

---

### Task 6: 版本更新提示——检查更新和下载逻辑

**Files:**
- Modify: `Cerberus.html` — DOMContentLoaded 处理器末尾（~第 1440 行）添加检查更新调用
- Modify: `Cerberus.html` — 在 `loadLLMSettings` 函数附近添加 `checkForUpdate` 和 `downloadUpdate` 函数

- [ ] **Step 1: 添加 `checkForUpdate` 和 `downloadUpdate` 函数**

在 `window.toggleDefaultLLM = toggleDefaultLLM;`（第 2277 行）之后、`function renderTabContent`（第 2279 行）之前插入：

```javascript
// ============================================
// 版本更新检查
// ============================================
async function checkForUpdate() {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(
            'https://raw.githubusercontent.com/eastmoonzi/video-reviewer/main/version.json',
            { signal: controller.signal, cache: 'no-store' }
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.version && data.version !== APP_VERSION) {
            showUpdateBanner(data.version, data.download_url);
        }
    } catch (e) {
        // 网络失败静默忽略
    }
}

function showUpdateBanner(version, downloadUrl) {
    if (document.getElementById('update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'fixed top-0 left-0 right-0 z-[9999] bg-blue-500 text-white text-sm px-4 py-2 flex items-center justify-center gap-3';
    banner.innerHTML = `
        <span class="mdi mdi-update text-lg"></span>
        <span>有新版本可用 (v${version})</span>
        <button onclick="downloadUpdate('${downloadUrl}')"
                class="px-3 py-0.5 bg-white text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-50 transition-colors">
            下载更新
        </button>
        <button onclick="this.parentElement.remove()"
                class="ml-2 text-white/70 hover:text-white transition-colors">
            <span class="mdi mdi-close"></span>
        </button>
    `;
    document.body.prepend(banner);
}
window.showUpdateBanner = showUpdateBanner;

async function downloadUpdate(url) {
    const btn = document.querySelector('#update-banner button');
    if (btn) {
        btn.textContent = '下载中...';
        btn.disabled = true;
    }
    try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error('下载失败');
        const html = await resp.text();
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Cerberus.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        if (btn) btn.textContent = '已下载，请覆盖保存后刷新';
    } catch (e) {
        if (btn) {
            btn.textContent = '下载失败，请重试';
            btn.disabled = false;
        }
    }
}
window.downloadUpdate = downloadUpdate;
```

- [ ] **Step 2: 在 DOMContentLoaded 末尾调用 `checkForUpdate`**

在 Cerberus.html 第 1440 行 `console.log('初始化完成');` 之前插入：

```javascript
    // 异步检查版本更新
    checkForUpdate();
```

- [ ] **Step 3: Commit**

```bash
git add Cerberus.html
git commit -m "feat: 添加版本更新检查和下载功能"
```

---

### Task 7: 手动验证

- [ ] **Step 1: 在浏览器中打开 `Cerberus.html`**

```bash
open Cerberus.html
```

- [ ] **Step 2: 验证原文保存**

1. 导入一个 JSONL 文件（任意模式）
2. 在浏览器控制台检查：`getTasks()[0].model_outputs[0]._raw` 是否包含完整的 response + cot 原文
3. 确认 `.raw` 字段不存在：`getTasks()[0].model_outputs[0].raw === undefined`
4. 对于解析失败的条目，确认原文展示正常显示

- [ ] **Step 3: 验证版本更新提示**

1. 修改 `APP_VERSION` 为一个旧值（如 `'2026-01-01a'`）
2. 刷新页面，确认顶部出现蓝色更新提示条
3. 点击"下载更新"，确认触发下载
4. 点击 × 关闭，确认提示条消失
5. 恢复 `APP_VERSION` 为正确值

- [ ] **Step 4: 验证向后兼容**

1. 在控制台手动构造旧格式数据：某个 output 有 `.raw` 无 `._raw`
2. 存入 IndexedDB，刷新页面
3. 确认迁移后 output 有 `._raw` 无 `.raw`

- [ ] **Step 5: Final commit（如有修复）**

```bash
git add Cerberus.html
git commit -m "fix: 验证后修复"
```
