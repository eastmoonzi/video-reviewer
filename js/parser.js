import { selectTask, updateUI } from './task.js';
import { state, getTasks, getTaskIndex } from './state.js';
import { saveToLocalStorage } from './storage.js';

export function importTasks() {
    // 清空已选文件列表
    state._pendingFiles = [];
    renderPendingFileList();
    document.getElementById('import-file').value = '';
    document.getElementById('import-modal').classList.remove('hidden');
    document.getElementById('import-modal').classList.add('flex');
}

export function closeImportModal() {
    state._pendingFiles = [];
    document.getElementById('import-modal').classList.add('hidden');
    document.getElementById('import-modal').classList.remove('flex');
}

// 文件选择回调：累积添加文件
export function onImportFileChange(input) {
    if (!state._pendingFiles) state._pendingFiles = [];
    const newFiles = Array.from(input.files);
    newFiles.forEach(f => {
        // 去重：同名文件不重复添加
        if (!state._pendingFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
            state._pendingFiles.push(f);
        }
    });
    // 清空 input 以便下次选同一文件也能触发 change
    input.value = '';
    renderPendingFileList();
}
window.onImportFileChange = onImportFileChange;

// 渲染已选文件列表
export function renderPendingFileList() {
    const container = document.getElementById('import-file-list');
    if (!container) return;
    const files = state._pendingFiles || [];
    if (files.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = files.map((f, i) => {
        const isJsonl = f.name.endsWith('.jsonl');
        const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls');
        const icon = isJsonl ? 'mdi-code-braces' : isExcel ? 'mdi-file-excel-outline' : 'mdi-file-outline';
        const sizeKB = (f.size / 1024).toFixed(1);
        return `<div class="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded text-sm">
            <span class="flex items-center gap-1.5 text-gray-700 truncate">
                <span class="mdi ${icon} text-gray-400"></span>
                ${f.name}
                <span class="text-gray-400 text-xs">${sizeKB}KB</span>
            </span>
            <button onclick="removePendingFile(${i})" class="text-gray-400 hover:text-red-500 ml-2">
                <span class="mdi mdi-close text-sm"></span>
            </button>
        </div>`;
    }).join('');
}
window.renderPendingFileList = renderPendingFileList;

// 移除已选文件
export function removePendingFile(index) {
    if (state._pendingFiles) {
        state._pendingFiles.splice(index, 1);
        renderPendingFileList();
    }
}
window.removePendingFile = removePendingFile;

export function confirmImport() {
    const files = state._pendingFiles || [];

    if (files.length === 0) {
        alert('请先选择文件');
        return;
    }

    // 检查文件类型一致性
    const jsonlFiles = files.filter(f => f.name.endsWith('.jsonl'));
    const excelFiles = files.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    const otherFiles = files.filter(f => !f.name.endsWith('.jsonl') && !f.name.endsWith('.xlsx') && !f.name.endsWith('.xls'));

    if (otherFiles.length > 0) {
        alert('请选择 Excel (.xlsx/.xls) 或 JSONL (.jsonl) 格式文件');
        return;
    }

    if (jsonlFiles.length > 0 && excelFiles.length > 0) {
        alert('不支持同时导入 Excel 和 JSONL 文件，请分开导入');
        return;
    }

    if (excelFiles.length > 1) {
        alert('Excel 文件只能选择一个');
        return;
    }

    // 单个 Excel 文件导入
    if (excelFiles.length === 1) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = parseExcel(e.target.result);
                processImportData(data);
            } catch (err) {
                alert('文件解析失败: ' + err.message);
                console.error('解析错误:', err);
            }
        };
        reader.readAsArrayBuffer(excelFiles[0]);
        return;
    }

    // 一个或多个 JSONL 文件导入
    importMultipleJsonl(jsonlFiles);
}

// 导入多个 JSONL 文件，按视频URL/nid合并为多模型对比
export function importMultipleJsonl(files) {
    let loadedCount = 0;
    // 每个文件解析结果: { modelName, tasks[] }
    const fileResults = new Array(files.length);

    files.forEach((file, fileIndex) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // 模型名：优先从 JSONL 行内 model_name 字段取，否则用文件名（去后缀）
                const defaultModelName = file.name.replace(/\.jsonl$/i, '');
                const tasks = parseJsonl(e.target.result);
                fileResults[fileIndex] = { defaultModelName, tasks };
            } catch (err) {
                console.error(`文件 ${file.name} 解析失败:`, err);
                fileResults[fileIndex] = { defaultModelName: file.name, tasks: [] };
            }

            loadedCount++;
            if (loadedCount === files.length) {
                // 所有文件加载完毕，执行合并
                try {
                    const merged = mergeJsonlTasks(fileResults);
                    processImportData(merged);
                } catch (err) {
                    alert('合并失败: ' + err.message);
                    console.error('合并错误:', err);
                }
            }
        };
        reader.readAsText(file, 'UTF-8');
    });
}

// ============================================
// JSONL 文件解析
// ============================================
export function parseJsonl(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const tasks = [];
    
    lines.forEach((line, lineIndex) => {
        try {
            // 尝试解析单行 JSON，带容错处理
            let jsonStr = line.trim();
            if (!jsonStr) return;

            const obj = JSON.parse(jsonStr);
            
            // 跳过没有视频的行（兼容 videos 数组和 video_url 字符串）
            if (!(obj.videos && obj.videos.length) && !obj.video_url) {
                console.warn(`第 ${lineIndex + 1} 行：缺少视频URL，跳过`);
                return;
            }
            
            // 转换为标准任务格式
            const task = convertJsonlToTask(obj, lineIndex);
            if (task) {
                tasks.push(task);
            }
        } catch (err) {
            console.warn(`第 ${lineIndex + 1} 行解析失败:`, err.message);
        }
    });
    
    console.log(`JSONL 解析完成，共 ${tasks.length} 个有效任务`);
    return tasks;
}


// 将 JSONL 对象转换为任务格式
export function convertJsonlToTask(obj, index) {
    const rawId = obj.data_id || obj.nid || `task-${index + 1}`;
    const title = obj.title || obj.video_title || obj.name || '';
    const task = {
        id: title || rawId,
        rawId: rawId,
        video_url: ((obj.videos && obj.videos[0]) || obj.video_url || '').replace(/^http:\/\//i, 'https://')
    };

    // 处理 response 字段
    let response = obj.response;

    // 兼容 messages 格式（OpenAI chat 格式）：从 assistant 消息中提取 response
    if (response === undefined && Array.isArray(obj.messages)) {
        const assistantMsg = obj.messages.find(m => m.role === 'assistant');
        if (assistantMsg) {
            // content 可能是字符串或数组
            if (typeof assistantMsg.content === 'string') {
                response = assistantMsg.content;
            } else if (Array.isArray(assistantMsg.content)) {
                const textPart = assistantMsg.content.find(c => c.type === 'text');
                if (textPart) response = textPart.text;
            }
        }
    }

    // response 可能是字符串（如被 <json_output> 标签包裹），需要先解析
    let rawResponseStr = null;  // 记录原始字符串，解析失败时用于 _parseError
    if (typeof response === 'string') {
        const respStr = response.trim();
        if (!respStr) {
            response = null;
        } else {
            rawResponseStr = respStr;
            response = quickParseJson(respStr);
        }
    }

    // response 为空时，尝试从 cot 字段提取（简化版：仅解析代码块/XML 标签内的 JSON）
    if (!response && obj.cot) {
        response = extractJsonFromCot(obj.cot);
    }

    // response 可能是 null、数组或单个对象
    if (!response) {
        // 收集所有可能包含 JSON 的原始内容（cot + response）
        const rawParts = [];
        if (obj.cot) rawParts.push(typeof obj.cot === 'string' ? obj.cot : JSON.stringify(obj.cot));
        if (rawResponseStr) rawParts.push(rawResponseStr);
        const fullRaw = rawParts.join('\n\n---\n\n');

        if (fullRaw.trim()) {
            // 有原始内容但解析失败 → _parseError，供 LLM 修复
            const errorOutput = { _parseError: true, raw: fullRaw.slice(0, 8000) };
            task.model_output = errorOutput;
            task.model_outputs = [errorOutput];
            task.model_names = [obj.model_name || '默认'];
            task.reviews = [null];
            return task;
        }
        // 真正什么都没有 → 空任务（只有视频）
        task.model_output = { segments: [] };
        task.model_outputs = [{ segments: [] }];
        task.model_names = [obj.model_name || '默认'];
        task.reviews = [null];
        return task;
    }

    // 检测是否为基础音画质量格式
    if (response.vision_quality || response.audiovisual_integration || response.content_subject) {
        const avOutput = { audiovisual: response };
        task.model_output = avOutput;
        task.model_outputs = [avOutput];
        task.model_names = [obj.model_name || '默认'];
        task.reviews = [null];
        return task;
    }

    // 解包 array-wrapped 格式：[{"segment_detail": [...]}] → {"segment_detail": [...]}
    if (Array.isArray(response) && response.length === 1 && typeof response[0] === 'object' && !Array.isArray(response[0]) && (response[0].segment_detail || response[0].segment_output)) {
        response = response[0];
    }

    // 解包 segment_output / segment_detail 包裹格式
    let segmentData = response;
    let profileData = null;
    if (response.segment_output !== undefined) {
        segmentData = response.segment_output;
    } else if (response.segment_detail !== undefined) {
        segmentData = response.segment_detail;
    }

    // 检测是否同时包含画像数据（多代码块合并的情况）
    if (typeof response === 'object' && !Array.isArray(response)) {
        if (response.narrative_type || response.visual_type || response.summary || response.global_profile) {
            profileData = response;
        }
    }

    // 处理 time-range dict 格式：{'0-29': {text, vis}, '29-49': {...}, ...}
    // 或单段 dict 格式：{time: [...], text: '...', vis: '...'}
    if (segmentData && typeof segmentData === 'object' && !Array.isArray(segmentData)) {
        if (segmentData.time !== undefined || segmentData.text !== undefined || segmentData.vis !== undefined) {
            // 单段 dict，直接包装成数组
            segmentData = [segmentData];
        } else {
            // time-range dict: keys 是 '0-29'、'29-49' 等
            // 只取以数字开头的 key（时间范围段），忽略 key_frame/summary 等字段
            const entries = Object.entries(segmentData).filter(([k]) =>
                /^\d/.test(k)
            );
            // 提取顶层 key_frame（可能存在于 segment_output 同级）
            const topKeyFrames = Array.isArray(segmentData.key_frame) ? segmentData.key_frame : [];
            // 判断 topKeyFrames 是否为纯描述字符串（无时间信息）
            const topKfHasTime = topKeyFrames.some(kf => {
                if (typeof kf === 'string') return !isNaN(parseFloat(kf));
                return kf && (kf.time !== undefined);
            });
            if (entries.length > 0 && /^\d/.test(entries[0][0])) {
                segmentData = entries.map(([k, v], mapIdx) => {
                    // 解析 '0-29' 或 '0-29s' 为 time
                    const timeMatch = k.match(/^(\d+)\s*[-–]\s*(\d+)/);
                    const seg = typeof v === 'object' ? { ...v } : { text: String(v) };
                    if (timeMatch && !seg.time) {
                        seg.time = [parseFloat(timeMatch[1]), parseFloat(timeMatch[2])];
                    }
                    // 若段内无 key_frame，从顶层 key_frame 分配
                    if (!seg.key_frame && topKeyFrames.length > 0) {
                        if (topKfHasTime && seg.time) {
                            // 有时间戳：按时间范围匹配
                            const segStart = seg.time[0], segEnd = seg.time[1];
                            const matched = topKeyFrames.filter(kf => {
                                const t = typeof kf === 'string' ? parseFloat(kf) : (kf.time || 0);
                                return t >= segStart && t <= segEnd;
                            });
                            if (matched.length > 0) seg.key_frame = matched;
                        } else if (!topKfHasTime && mapIdx === 0) {
                            // 纯描述字符串：无法按时间分配，全部挂到第一段
                            seg.key_frame = topKeyFrames;
                        }
                    }
                    return seg;
                });
            } else {
                // 无法识别的 dict 格式，当空处理
                segmentData = [];
            }
        }
    }

    // 统一处理为数组
    const responseArray = Array.isArray(segmentData) ? segmentData : [segmentData];
    
    // 转换分段数据
    const segments = responseArray.map((seg, segIdx) => {
        // 时间字段：可能是 [start, end] 数组或 {start, end} 对象
        let start = 0, end = 0;
        if (Array.isArray(seg.time)) {
            start = seg.time[0] || 0;
            end = seg.time[1] || 0;
        } else if (seg.time && typeof seg.time === 'object') {
            start = seg.time.start || 0;
            end = seg.time.end || 0;
        } else if (seg.start !== undefined) {
            start = seg.start;
            end = seg.end || 0;
        }
        
        // 处理关键帧，兼容 reason / 选取理由 字段，以及纯字符串数组
        let keyframes = [];
        if (seg.key_frame && Array.isArray(seg.key_frame)) {
            keyframes = seg.key_frame.map(kf => {
                if (typeof kf === 'string') {
                    return { time: 0, label: kf.replace(/[\n\r]+/g, ' ').trim(), reason: '' };
                }
                return {
                    time: kf.time || 0,
                    label: (kf.desc || kf.label || '').replace(/[\n\r]+/g, ' ').trim(),
                    reason: kf.reason || kf['选取理由'] || ''
                };
            });
        }
        
        return {
            start: start,
            end: end,
            label: `片段 ${segIdx + 1}`,
            description: seg.text || '',
            visual: seg.vis || '',
            keyframes: keyframes
        };
    });

    const output = { segments };
    // 如果同时包含画像数据（多代码块合并），一并存入
    if (profileData) {
        const gp = profileData.global_profile || profileData;
        output.profile = {
            narrative_type: gp.narrative_type,
            visual_type: gp.visual_type,
            summary: gp.summary,
            intent_type: gp.intent_type,
            topic_consistency: gp.topic_consistency,
            core_claim: gp.core_claim,
            emotion_type: gp.emotion_type || gp.emotional_tone
        };
    }
    task.model_output = output;
    task.model_outputs = [output];
    task.model_names = [obj.model_name || '默认'];
    task.reviews = [null];

    return task;
}

// 合并多个文件的 JSONL 任务，按 video_url / nid 分组，每个文件视为一个模型
export function mergeJsonlTasks(fileResults) {
    // 只有一个文件时，检查文件内是否有不同 model_name
    if (fileResults.length === 1) {
        const { defaultModelName, tasks } = fileResults[0];
        // 单文件也要用文件名替换 '默认'
        tasks.forEach(task => {
            if (task.model_names?.[0] === '默认') {
                task.model_names = [defaultModelName];
            }
        });
        // 检查是否有 model_name 字段且存在多个不同值
        const modelNames = [...new Set(tasks.map(t => t.model_names?.[0]).filter(Boolean))];
        if (modelNames.length <= 1) {
            // 单模型，直接返回
            return tasks;
        }
        // 单文件多模型：按 video_url / id 合并
        return mergeTasksByKey(tasks);
    }

    // 多文件：给每个任务打上文件级模型名（如果行内没有 model_name）
    const allTasks = [];
    fileResults.forEach(({ defaultModelName, tasks }) => {
        tasks.forEach(task => {
            // 如果 model_names 是 ['默认']，替换为文件名
            if (task.model_names?.[0] === '默认') {
                task.model_names = [defaultModelName];
            }
            allTasks.push(task);
        });
    });

    return mergeTasksByKey(allTasks);
}

// 按 video_url / id 合并同一视频的多个模型输出
export function stripUrlQuery(url) {
    if (!url) return url;
    try {
        const u = new URL(url);
        return u.origin + u.pathname;
    } catch {
        // 非标准 URL，尝试简单截断 ? 之前
        const idx = url.indexOf('?');
        return idx > 0 ? url.substring(0, idx) : url;
    }
}

export function mergeTasksByKey(tasks) {
    const map = new Map(); // key -> merged task

    tasks.forEach(task => {
        // 优先用 video_url（去掉query参数）作为 key，否则用 rawId/id
        const key = stripUrlQuery(task.video_url) || task.rawId || task.id;

        if (map.has(key)) {
            const existing = map.get(key);
            // 追加 model_outputs 和 model_names
            const outputs = task.model_outputs || [];
            const names = task.model_names || [];
            outputs.forEach((output, i) => {
                existing.model_outputs.push(output);
                existing.model_names.push(names[i] || '未知模型');
                existing.reviews.push(null);
                existing.profileReviews.push(null);
                existing.audiovisualReviews.push(null);
            });
        } else {
            map.set(key, {
                id: task.id,
                rawId: task.rawId,
                video_url: task.video_url,
                model_output: task.model_output,
                model_outputs: [...(task.model_outputs || [])],
                model_names: [...(task.model_names || [])],
                reviews: [...(task.reviews || [null])],
                profileReviews: [...(task.profileReviews || [null])],
                audiovisualReviews: [...(task.audiovisualReviews || [null])]
            });
        }
    });

    const merged = Array.from(map.values());
    // 更新 model_output 指向第一组
    merged.forEach(task => {
        task.model_output = task.model_outputs[0] || {};
    });

    console.log(`合并完成：${tasks.length} 条记录 → ${merged.length} 个视频，模型数分布:`,
        merged.map(t => `${t.id}(${t.model_names.length}组)`).join(', '));

    return merged;
}
// 从模型输出文本中剥离包装标签并解析 JSON（最小集容错版）
// 只处理合法 JSON 的包装格式，本身写法有问题（Python dict 等）一律返回 null
/**
 * 将 Python dict 字符串的单引号转为双引号（状态机实现，正确处理转义和嵌套）
 */
/**
 * 修复被截断的 JSON：扫描结构，补全未闭合的字符串、数组、对象
 */
export function repairTruncatedJson(s) {
    const stack = []; // 记录未闭合的 [ 和 {
    let inString = false, escape = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (escape) { escape = false; continue; }
        if (c === '\\' && inString) { escape = true; continue; }
        if (c === '"' && !inString) { inString = true; continue; }
        if (c === '"' && inString) { inString = false; continue; }
        if (inString) continue;
        if (c === '{') stack.push('}');
        else if (c === '[') stack.push(']');
        else if (c === '}' || c === ']') stack.pop();
    }
    // 如果在字符串中间被截断，先闭合字符串
    let suffix = '';
    if (inString) suffix += '"';
    // 逆序闭合所有未闭合的括号
    suffix += stack.reverse().join('');
    if (!suffix) return null; // 没有需要修复的

    // 去掉截断点之前的尾部逗号（如 [1,2, 截断）
    const trimmed = s.replace(/,\s*$/, '');

    // 依次尝试多种补全策略
    const candidates = [
        trimmed + suffix,           // 去掉尾部逗号 + 闭合
        s + suffix,                 // 原文 + 闭合
        trimmed + 'null' + suffix,  // 去掉逗号 + null + 闭合（截断在冒号后）
        s + 'null' + suffix,        // 原文 + null + 闭合
    ];
    for (const candidate of candidates) {
        try {
            JSON.parse(candidate);
            return candidate;
        } catch (_) {}
    }
    return null;
}

export function pythonDictToJson(s) {
    const out = [];
    let inDouble = false, inSingle = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        const prev = i > 0 ? s[i - 1] : '';
        if (c === '"' && !inSingle && prev !== '\\') {
            inDouble = !inDouble;
            out.push(c);
        } else if (c === "'" && !inDouble && prev !== '\\') {
            if (!inSingle) {
                // 检查是否是缩写撇号（如 it's, don't）：前一个字符是字母，下一个也是字母
                if (i > 0 && i < s.length - 1 && /[a-zA-Z]/.test(s[i - 1]) && /[a-zA-Z]/.test(s[i + 1])) {
                    out.push("'"); // 保留缩写撇号
                    continue;
                }
                inSingle = true;
                out.push('"');
            } else {
                inSingle = false;
                out.push('"');
            }
        } else if (c === '"' && inSingle) {
            out.push('\\"'); // 单引号字符串内的双引号需要转义
        } else {
            out.push(c);
        }
    }
    return out.join('');
}

export function quickParseJson(str) {
    if (!str || !str.trim()) return null;
    str = str.trim();

    // 1. 剥离常见 CoT 标签（闭合的）
    str = str.replace(/<(?:think|thinking|reasoning|thought|内心独白|分析)>[\s\S]*?<\/(?:think|thinking|reasoning|thought|内心独白|分析)>/gi, '').trim();
    // 未闭合的 CoT 标签：从标签开始到第一个 JSON 对象/数组/代码块之前全部剥离
    if (/^<(?:think|thinking|reasoning|thought)/i.test(str)) {
        str = str.replace(/^<(?:think|thinking|reasoning|thought)[^>]*>[\s\S]*?(?=[\[{]|```)/i, '').trim();
    }

    // 2. 剥离最外层 XML 包装标签（<json_output>...</json_output>、<json>...</json> 等）
    str = str.replace(/^<([a-z_]+)>\s*([\s\S]*?)\s*<\/\1>$/i, '$2').trim();
    // 无闭合标签的情况：去掉开头 <json_output> / <json>
    str = str.replace(/^<json(?:_\w+)?\s*>\s*/i, '').trim();

    // 3. 剥离三重引号包装（"""...""" 或 '''...'''）
    str = str.replace(/^"{3}\s*([\s\S]*?)\s*"{3}$/, '$1').trim();
    str = str.replace(/^'{3}\s*([\s\S]*?)\s*'{3}$/, '$1').trim();

    // 4. 多代码块：分别解析后合并（用于 segment+profile 双块格式）
    const blocks = str.match(/```(?:json)?\s*\n?([\s\S]*?)```/g);
    if (blocks && blocks.length >= 2) {
        let merged = null;
        for (const block of blocks) {
            const content = block.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
            let parsed = null;
            try { parsed = JSON.parse(content); } catch (_) {
                try { parsed = JSON.parse(pythonDictToJson(content.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null'))); } catch (_2) {}
            }
            if (!parsed) continue;
            if (!merged) {
                merged = Array.isArray(parsed) ? { segment_detail: parsed } : parsed;
            } else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                Object.assign(merged, parsed);
            }
        }
        if (merged) return merged;
        return null;  // 多块但全部解析失败
    }

    // 5. 单代码块：提取内容再解析
    if (blocks && blocks.length === 1) {
        str = blocks[0].replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }

    // 6. 直接 JSON.parse
    try { return JSON.parse(str); } catch (_) {}

    // 7. Python dict 语法容错（单引号 key/value、True/False/None）
    try {
        let py = str;
        // True/False/None → true/false/null（仅替换独立单词，不影响字符串内容）
        py = py.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
        // 单引号 → 双引号：逐字符状态机转换，正确处理嵌套引号
        py = pythonDictToJson(py);
        return JSON.parse(py);
    } catch (_) {}

    // 8. 兜底：从混合文本中提取最后一个完整 JSON 对象/数组
    //    适用于 CoT 推理文本后跟 JSON 的情况
    const lastObjMatch = str.match(/(\{[\s\S]*\})\s*$/);
    if (lastObjMatch) {
        try { return JSON.parse(lastObjMatch[1]); } catch (_) {}
    }
    const lastArrMatch = str.match(/(\[[\s\S]*\])\s*$/);
    if (lastArrMatch) {
        try { return JSON.parse(lastArrMatch[1]); } catch (_) {}
    }

    return null;
}

// 从 cot 字段提取 JSON（简化版：只找代码块和 xml 标签内的 JSON，不做 Markdown 文本解析）
export function extractJsonFromCot(cot) {
    if (!cot || typeof cot !== 'string') return null;
    return quickParseJson(cot.trim());
}



export function parseJsonCell(cellValue, taskIndex, colIndex) {
    if (!cellValue) return null;
    if (typeof cellValue === 'object' && cellValue !== null) return normalizeModelOutput(cellValue);

    const str = cellValue.toString().replace(/^\uFEFF/, '').trim();
    if (!str) return null;

    const parsed = quickParseJson(str);
    if (parsed !== null) return normalizeModelOutput(parsed);

    // 无法解析 → _parseError，交 LLM 修复
    console.warn(`任务 ${taskIndex + 1} 第${colIndex}列 JSON解析失败，需 LLM 修复`);
    return { _parseError: true, raw: str.slice(0, 8000) };
}


// 从Excel单元格提取URL（处理超链接格式）
export function extractUrlFromCell(worksheet, cellAddress) {
    const cell = worksheet[cellAddress];
    if (!cell) return '';
    
    console.log(`单元格 ${cellAddress} 原始数据:`, cell);
    
    // 检查是否有超链接
    if (cell.l && cell.l.Target) {
        console.log(`单元格 ${cellAddress} 有超链接:`, cell.l.Target);
        return cell.l.Target;
    }
    
    // 检查worksheet的hyperlinks
    if (worksheet['!hyperlinks']) {
        const hyperlink = worksheet['!hyperlinks'].find(h => h.ref === cellAddress);
        if (hyperlink && hyperlink.Target) {
            console.log(`单元格 ${cellAddress} 从!hyperlinks获取:`, hyperlink.Target);
            return hyperlink.Target;
        }
    }
    
    // 如果是对象，尝试获取值
    if (typeof cell === 'object') {
        if (cell.v) return String(cell.v).trim();
        if (cell.w) return String(cell.w).trim();
    }
    
    return String(cell).trim();
}

// 解析Excel文件 (.xlsx) - 支持多列JSON数据
export function parseExcel(arrayBuffer) {
    // 读取时启用超链接解析
    const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: false });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 转换为JSON数组，header: 1 表示返回二维数组，raw: false 保持字符串格式
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

    if (rows.length === 0) {
        throw new Error('Excel 文件为空');
    }

    console.log('Excel 解析原始数据行数:', rows.length);

    // 第一行为表头，智能检测各列含义（不依赖列顺序，只看列标题）
    const headerRow = rows[0];
    const colCount = headerRow.length;

    // 定义各类型列的关键词（全部用精确匹配，避免子串误匹配）
    const nidKeywords = ['nid', 'data_id', '编号', 'id'];
    const urlKeywords = ['url', 'video_url', '链接', '视频链接', '视频地址', 'video', 'videos'];
    const titleKeywords = ['标题', 'title', 'video_title', '视频标题'];
    const evalKeywords = ['评估', '自动评估', 'eval', 'evaluation', '评测'];
    const scoreKeywords = ['_score', '评分', '得分'];  // 这三个仍用 includes（作为后缀）
    const noteKeywords  = ['_问题', '备注', '问题描述'];  // 同上
    const skipKeywords  = ['序号', 'no', 'index', 'tools', 'user_content', 'asr',
                           'think', 'video_duration', 'duration', 'images', 'image',
                           'assistant_content_raw', '标注人员', '标注者', 'annotator'];

    // 精确匹配辅助函数（nid/url/title/eval/skip 用精确匹配，score/note 用后缀匹配）
    const exactMatch = (header, keywords) => keywords.some(kw => header === kw);

    // 遍历所有列，根据标题匹配类型
    let nidCol = -1;
    let urlCol = -1;
    let titleCol = -1;
    let evalCol = -1;
    const modelCols = []; // 模型输出列
    const scoreCols = []; // 评分列
    const noteCols  = []; // 备注列
    const skipColIndices = []; // 被跳过的列索引

    for (let col = 0; col < colCount; col++) {
        const header = headerRow[col]?.toString().trim().toLowerCase() || '';

        // 跳过空列
        if (!header) continue;

        // 检测 nid 列（精确匹配）
        if (nidCol === -1 && exactMatch(header, nidKeywords)) {
            nidCol = col;
            console.log(`NID列检测: 第${col + 1}列 ("${headerRow[col]}")`);
            continue;
        }

        // 检测标题列（精确匹配，先于URL列）
        if (titleCol === -1 && exactMatch(header, titleKeywords)) {
            titleCol = col;
            console.log(`标题列检测: 第${col + 1}列 ("${headerRow[col]}")`);
            continue;
        }

        // 检测视频链接列（精确匹配）
        if (urlCol === -1 && exactMatch(header, urlKeywords)) {
            urlCol = col;
            console.log(`视频链接列检测: 第${col + 1}列 ("${headerRow[col]}")`);
            continue;
        }

        // 检测评估列（精确匹配）
        if (evalCol === -1 && exactMatch(header, evalKeywords)) {
            evalCol = col;
            console.log(`自动评估列检测: 第${col + 1}列 ("${headerRow[col]}")`);
            continue;
        }

        // 检测评分列（后缀匹配：*_score / *评分 / *得分）
        if (scoreKeywords.some(kw => header.endsWith(kw))) {
            const key = header.replace(/_score$/, '').replace(/评分$/, '').replace(/得分$/, '');
            scoreCols.push({ col, key });
            console.log(`评分列检测: 第${col + 1}列 ("${headerRow[col]}") → key: ${key}`);
            continue;
        }

        // 检测备注列（后缀匹配：*_问题 / *备注）
        if (noteKeywords.some(kw => header.endsWith(kw))) {
            const key = header.replace(/_问题$/, '').replace(/备注$/, '').replace(/问题描述$/, '');
            noteCols.push({ col, key });
            console.log(`备注列检测: 第${col + 1}列 ("${headerRow[col]}") → key: ${key}`);
            continue;
        }

        // 跳过无关列（精确匹配）
        if (exactMatch(header, skipKeywords)) {
            skipColIndices.push(col);
            console.log(`跳过列: 第${col + 1}列 ("${headerRow[col]}")`);
            continue;
        }

        // 其他列视为模型输出列
        modelCols.push({ col: col, name: headerRow[col]?.toString().trim() || `模型${col + 1}` });
    }

    // 如果没有检测到链接列，尝试从非nid非title的非数字列中找
    if (urlCol === -1) {
        for (let col = 0; col < colCount; col++) {
            if (col === nidCol || col === titleCol || col === evalCol) continue;
            const header = headerRow[col]?.toString().trim().toLowerCase() || '';
            // 跳过明显是序号的列
            if (header === '序号' || header === 'no' || header === 'index') continue;
            urlCol = col;
            console.log(`视频链接列(推断): 第${col + 1}列 ("${headerRow[col]}")`);
            break;
        }
    }

    // 数据从第二行开始
    const dataRows = rows.slice(1);

    // 确定模型列（排除已识别的特殊列、评分列、备注列）
    const specialCols = new Set([nidCol, urlCol, titleCol, evalCol,
        ...scoreCols.map(s => s.col), ...noteCols.map(n => n.col), ...skipColIndices]);
    const finalModelCols = [];
    for (let col = 0; col < colCount; col++) {
        if (specialCols.has(col)) continue;
        const header = headerRow[col]?.toString().trim() || '';
        if (!header) continue;
        // 检查第一行数据是否像 JSON 内容（含 CoT 包裹）
        const firstVal = (dataRows[0]?.[col] || '').toString().trim();
        const looksLikeJson = /^[\[{"`']/.test(firstVal) || firstVal.startsWith('```')
            || /^<(?:think|thinking|reasoning|thought)/i.test(firstVal);
        if (looksLikeJson) {
            finalModelCols.push({ col, name: header });
        }
    }
    // 如果智能检测没找到模型列，回退到所有未识别列
    if (finalModelCols.length === 0) {
        for (let col = 0; col < colCount; col++) {
            if (specialCols.has(col)) continue;
            const header = headerRow[col]?.toString().trim() || '';
            if (header) finalModelCols.push({ col, name: header });
        }
    }
    console.log('模型列:', finalModelCols.map(m => `${m.name}(第${m.col + 1}列)`));
    const startRowIndex = 2; // Excel行号从1开始，数据从第2行开始

    return dataRows.map((row, i) => {
        // 提取 nid
        let nid = (nidCol >= 0 && row[nidCol]) ? String(row[nidCol]).trim() : '';
        if (nid && /^[\d.]+e\+?\d+$/i.test(nid)) {
            try { nid = BigInt(Math.round(Number(nid))).toString(); } catch (_) {}
        }

        // 提取标题
        const title = (titleCol >= 0 && row[titleCol]) ? String(row[titleCol]).trim() : '';
        const obj = { id: title || nid || `task-${i + 1}`, rawId: nid || `task-${i + 1}` };

        // 获取视频URL
        let videoUrl = '';
        if (urlCol >= 0 && row[urlCol]) {
            const excelRowNum = startRowIndex + i;
            const urlColLetter = String.fromCharCode(65 + urlCol);
            const cellAddress = `${urlColLetter}${excelRowNum}`;
            const cell = worksheet[cellAddress];

            if (cell) {
                if (cell.l && cell.l.Target) {
                    videoUrl = cell.l.Target;
                } else if (cell.v) {
                    videoUrl = String(cell.v).trim();
                } else if (cell.w) {
                    videoUrl = String(cell.w).trim();
                }
            }
            if (!videoUrl) {
                videoUrl = String(row[urlCol]).trim();
            }
        }

        obj.video_url = videoUrl.replace(/^http:\/\//i, 'https://');

        // 解析模型输出
        obj.model_outputs = [];
        obj.model_names = [];

        for (const modelCol of finalModelCols) {
            const parsed = parseJsonCell(row[modelCol.col], i, modelCol.col + 1);
            if (!parsed) continue; // null = 空单元格，静默跳过
            obj.model_outputs.push(parsed);
            obj.model_names.push(modelCol.name);
        }

        // 解析自动评估列
        if (evalCol >= 0 && row[evalCol]) {
            const parsed = quickParseJson(String(row[evalCol]));
            if (parsed) obj.autoEval = parsed;
            else console.warn(`任务 ${i + 1} 自动评估数据解析失败`);
        }

        // 兼容旧格式
        obj.model_output = obj.model_outputs[0] || {};

        // 初始化评分
        obj.reviews = obj.model_outputs.map(() => null);
        obj.profileReviews = obj.model_outputs.map(() => null);
        obj.audiovisualReviews = obj.model_outputs.map(() => null);

        // 提取已有评分和备注（从 *_score / *_问题 列）
        if (scoreCols.length > 0 || noteCols.length > 0) {
            const importedScores = {};
            const importedNotes = {};
            scoreCols.forEach(({ col: c, key }) => {
                const val = parseInt(row[c]);
                if (!isNaN(val)) importedScores[key] = val;
            });
            noteCols.forEach(({ col: c, key }) => {
                const val = row[c]?.toString().trim();
                if (val) importedNotes[key] = val;
            });
            if (Object.keys(importedScores).length > 0 || Object.keys(importedNotes).length > 0) {
                obj.importedReview = { scores: importedScores, notes: importedNotes };
            }
        }

        console.log(`任务 ${i + 1}: URL=${obj.video_url.substring(0, 80)}..., 数据组数=${obj.model_outputs.length}`);

        return obj;
    }).filter(task => task.video_url);
}

// 将原始片段数组转换为标准格式
export function convertSegmentArray(segmentArray) {
    return segmentArray.map((seg, idx) => {
        const segment = {
            start: Array.isArray(seg.time) ? seg.time[0] : (seg.start || 0),
            end: Array.isArray(seg.time) ? seg.time[1] : (seg.end || 0),
            label: `片段 ${idx + 1}`,
            description: seg.text || '',  // text 字段
            visual: seg.vis || '',        // vis 字段
            keyframes: []                 // key_frame 字段
        };
        
        // 处理关键帧，清理desc中的换行符
        if (seg.key_frame && Array.isArray(seg.key_frame)) {
            segment.keyframes = seg.key_frame.map(kf => ({
                time: kf.time || 0,
                label: (kf.desc || kf.label || '').replace(/[\n\r]+/g, ' ').trim()
            }));
        }
        
        return segment;
    });
}

// 标准化模型输出格式，支持分段语义详情和全篇语义画像
export function normalizeModelOutput(data) {
    const output = {};
    
    // 处理分段语义详情
    // 情况0：直接是数组
    if (Array.isArray(data)) {
        // 解包 [{segment_detail: [...]}] 格式
        if (data.length === 1 && typeof data[0] === 'object' && !Array.isArray(data[0]) && data[0].segment_detail) {
            data = data[0];
        } else {
            output.segments = convertSegmentArray(data);
            return output;
        }
    }
    
    // 情况1：有 segment_detail 字段
    if (data.segment_detail && Array.isArray(data.segment_detail)) {
        output.segments = convertSegmentArray(data.segment_detail);
    }

    // 情况2：有 segment_output 字段（数组或 time-range dict）
    if (data.segment_output) {
        const so = data.segment_output;
        if (Array.isArray(so)) {
            output.segments = convertSegmentArray(so);
        } else if (typeof so === 'object') {
            // time-range dict: {'0-29': {text, vis}, ...}
            const entries = Object.entries(so).filter(([k]) => /^\d/.test(k));
            if (entries.length > 0) {
                const arr = entries.map(([k, v]) => {
                    const m = k.match(/^(\d+)\s*[-–]\s*(\d+)/);
                    const seg = typeof v === 'object' ? { ...v } : { text: String(v) };
                    if (m && !seg.time) seg.time = [parseFloat(m[1]), parseFloat(m[2])];
                    return seg;
                });
                output.segments = convertSegmentArray(arr);
            }
        }
    }
    
    // 情况3：已经是标准格式
    if (data.segments) {
        output.segments = data.segments;
    }
    
    // 处理全篇语义画像数据
    // 情况A：global_profile 嵌套格式
    if (data.global_profile) {
        const gp = data.global_profile;
        output.profile = {
            narrative_type: gp.narrative_type,
            visual_type: gp.visual_type,
            summary: gp.summary,
            intent_type: gp.intent_type,
            topic_consistency: gp.topic_consistency,
            core_claim: gp.core_claim,
            emotion_type: gp.emotion_type || gp.emotional_tone
        };
    }
    // 情况B：顶层字段格式（没有 segment_detail 和 global_profile 包裹）
    else if (data.narrative_type || data.visual_type || data.summary || 
             data.intent_type || data.topic_consistency || data.core_claim || 
             data.emotion_type || data.emotional_tone) {
        output.profile = {
            narrative_type: data.narrative_type,
            visual_type: data.visual_type,
            summary: data.summary,
            intent_type: data.intent_type,
            topic_consistency: data.topic_consistency,
            core_claim: data.core_claim,
            emotion_type: data.emotion_type || data.emotional_tone
        };
    }
    
    // 处理基础音画质量数据
    if (data.vision_quality || data.audiovisual_integration || data.content_subject) {
        output.audiovisual = data;
    }

    // 如果解析出了任何有效数据，返回 output；否则返回原数据
    if (output.segments || output.profile || output.audiovisual) {
        return output;
    }
    
    return data;
}


export function processImportData(data) {
    const tasks = Array.isArray(data) ? data : [data];
    
    // 验证数据格式并处理 model_outputs
    const validTasks = tasks.filter(task => {
        if (!task.video_url) {
            console.warn('跳过无效任务（缺少 video_url）:', task);
            return false;
        }
        return true;
    }).map(task => {
        // 如果有 model_outputs 数组，初始化 reviews 数组
        if (task.model_outputs && Array.isArray(task.model_outputs) && task.model_outputs.length > 0) {
            task.model_output = task.model_outputs[0];
            task.reviews = task.model_outputs.map(() => null);
            task.profileReviews = task.model_outputs.map(() => null);
            task.audiovisualReviews = task.model_outputs.map(() => null);
        } else if (task.model_output && !task.model_outputs) {
            // 兼容旧格式
            task.model_outputs = [task.model_output];
            task.reviews = [null];
            task.profileReviews = [null];
            task.audiovisualReviews = [null];
        }

        // 如果 Excel 中有已有评分/备注，预填到 profileReviews
        if (task.importedReview) {
            const { scores, notes } = task.importedReview;
            task.profileReviews = (task.model_outputs || [{}]).map(() => ({
                mode: 'profile',
                ratings: {
                    narrative_type: scores.narrative_type ?? -1,
                    visual_type: scores.visual_type ?? -1,
                    summary: scores.summary ?? -1,
                    intent_type: scores.intent_type ?? -1,
                    topic_consistency: scores.topic_consistency ?? -1,
                    core_claim: scores.core_claim ?? -1,
                    emotion_type: scores.emotion_type ?? -1
                },
                notes: {
                    narrative_type: notes.narrative_type || '',
                    visual_type: notes.visual_type || '',
                    summary: notes.summary || '',
                    intent_type: notes.intent_type || '',
                    topic_consistency: notes.topic_consistency || '',
                    core_claim: notes.core_claim || '',
                    emotion_type: notes.emotion_type || ''
                },
                completed: Object.values(scores).some(s => s >= 0),
                timestamp: new Date().toISOString()
            }));
            delete task.importedReview; // 用完清除
        }
        return task;
    });

    // 统计 _parseError 输出数
    let parseErrorCount = 0;
    validTasks.forEach(task => {
        task.model_outputs?.forEach(o => { if (o?._parseError) parseErrorCount++; });
    });

    if (validTasks.length === 0) {
        alert('没有有效的任务数据');
        return;
    }

    // 根据当前模式添加到对应的任务列表，按 video_url 合并同一视频的多模型输出
    const existingTasks = state.reviewMode === 'segment' ? state.segmentTasks
        : state.reviewMode === 'audiovisual' ? state.audiovisualTasks
        : state.profileTasks;
    let mergedCount = 0;

    validTasks.forEach(newTask => {
        const key = stripUrlQuery(newTask.video_url) || newTask.rawId || newTask.id;
        const existing = existingTasks.find(t => (stripUrlQuery(t.video_url) || t.rawId || t.id) === key);
        if (existing && existing.model_outputs) {
            // 合并到已有任务中
            const newOutputs = newTask.model_outputs || [];
            const newNames = newTask.model_names || [];
            const newReviews = newTask.reviews || [];
            newOutputs.forEach((output, i) => {
                existing.model_outputs.push(output);
                existing.model_names = existing.model_names || [];
                existing.model_names.push(newNames[i] || '默认');
                existing.reviews = existing.reviews || [];
                existing.reviews.push(newReviews[i] || null);
                existing.profileReviews = existing.profileReviews || [];
                existing.profileReviews.push(null);
                existing.audiovisualReviews = existing.audiovisualReviews || [];
                existing.audiovisualReviews.push(null);
            });
            mergedCount++;
        } else {
            existingTasks.push(newTask);
        }
    });

    if (state.reviewMode === 'segment') {
        state.segmentTasks = existingTasks;
    } else if (state.reviewMode === 'audiovisual') {
        state.audiovisualTasks = existingTasks;
    } else {
        state.profileTasks = existingTasks;
    }
    
    saveToLocalStorage();
    updateUI();
    closeImportModal();

    // 如果之前没有选中任务，自动选中第一个
    const currentTasks = getTasks();
    const currentIndex = getTaskIndex();
    if (currentIndex < 0 && currentTasks.length > 0) {
        selectTask(0);
    }

    const newCount = validTasks.length - mergedCount;
    const modeNames = { segment: '分段语义详情', profile: '全篇语义画像', audiovisual: '基础音画质量' };
    const modeName = modeNames[state.reviewMode] || state.reviewMode;
    let msg = `成功导入到「${modeName}」`;
    if (newCount > 0) msg += `，新增 ${newCount} 个任务`;
    if (mergedCount > 0) msg += `，合并 ${mergedCount} 个已有任务的模型输出`;
    if (parseErrorCount > 0) msg += `\n⚠️ ${parseErrorCount} 条模型输出 JSON 解析失败（已保留原始内容）`;
    alert(msg);
}

