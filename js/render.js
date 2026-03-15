import { getCurrentTask } from './task.js';
import { renderParseErrorFallback } from './tabs.js';
import { linkifyTime, seekToTime, formatTime } from './video.js';

export function renderTabContent(tabName) {
    const task = getCurrentTask();
    if (!task) return;

    const output = task.model_output || {};
    if (output._parseError) {
        const containers = { text: 'text-content', visual: 'visual-content', keyframe: 'keyframe-content' };
        renderParseErrorFallback(containers[tabName] || 'text-content');
        Object.values(containers).filter(id => id !== containers[tabName])
            .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
        return;
    }
    const segments = output.segments || [];

    switch (tabName) {
        case 'text':
            renderTextUnderstanding(segments);
            break;
        case 'visual':
            renderVisualUnderstanding(segments);
            break;
        case 'keyframe':
            renderKeyframeList(segments);
            break;
    }
}

// 渲染文本理解（显示每个片段的 text 字段）- Ive Style: Unified Gray
export function renderTextUnderstanding(segments) {
    const container = document.getElementById('text-content');
    if (segments.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">暂无文本数据</div>';
        return;
    }

    container.innerHTML = segments.map((seg, i) => `
        <div class="p-4 rounded-2xl bg-black/[0.03] cursor-pointer hover:bg-black/[0.06] transition-all duration-200 active:scale-[0.99]"
             onclick="seekToTime(${seg.start})">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-semibold text-gray-800 tracking-wide">${i + 1}</span>
                <span class="text-[11px] text-gray-400 font-medium font-mono">
                    ${formatTime(seg.start)} → ${formatTime(seg.end)}
                </span>
            </div>
            <p class="text-[15px] text-gray-700 leading-relaxed">${(seg.description || seg.text || '') || '无文本'}</p>
        </div>
    `).join('');
}

// 渲染视觉理解（只显示 vis 分段文字描述）- Ive Style: Unified Gray
export function renderVisualUnderstanding(segments) {
    const container = document.getElementById('visual-content');
    if (segments.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">暂无视觉数据</div>';
        return;
    }

    container.innerHTML = segments.map((seg, i) => `
        <div class="p-4 rounded-2xl bg-black/[0.03] cursor-pointer hover:bg-black/[0.06] transition-all duration-200 active:scale-[0.99]"
             onclick="seekToTime(${seg.start})">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-semibold text-gray-800 tracking-wide">${i + 1}</span>
                <span class="text-[11px] text-gray-400 font-medium font-mono">
                    ${formatTime(seg.start)} → ${formatTime(seg.end)}
                </span>
            </div>
            <p class="text-[15px] text-gray-700 leading-relaxed">${linkifyTime(seg.visual || '') || '无视觉描述'}</p>
        </div>
    `).join('');
}

// 渲染关键帧列表（按时间点击跳转）- Ive Style: Unified Gray
export function renderKeyframeList(segments) {
    const container = document.getElementById('keyframe-content');
    
    // 从所有片段中提取关键帧
    const allKeyframes = [];
    segments.forEach((seg, segIdx) => {
        if (seg.keyframes && Array.isArray(seg.keyframes)) {
            seg.keyframes.forEach(kf => {
                allKeyframes.push({
                    ...kf,
                    segmentIndex: segIdx + 1
                });
            });
        }
    });

    if (allKeyframes.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">暂无关键帧数据</div>';
        return;
    }

    // 按时间排序
    allKeyframes.sort((a, b) => a.time - b.time);

    container.innerHTML = allKeyframes.map(kf => `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-black/[0.03] cursor-pointer hover:bg-black/[0.06] transition-all duration-200 active:scale-[0.99]"
             onclick="seekToTime(${kf.time})">
            <span class="px-2.5 py-1 bg-black text-white text-[11px] font-medium rounded-full whitespace-nowrap font-mono">
                ${formatTime(kf.time)}
            </span>
            <div class="flex-1">
                <span class="text-[14px] text-gray-700">${kf.label || kf.desc || '关键帧'}</span>
                <span class="text-[11px] text-gray-400 ml-2">§${kf.segmentIndex}</span>
            </div>
        </div>
    `).join('');
}

export function renderSegments(segments) {
    const container = document.getElementById('segments-content');
    if (segments.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">暂无时间段数据</div>';
        return;
    }

    const colors = ['bg-blue-100 border-blue-300', 'bg-green-100 border-green-300', 
                    'bg-yellow-100 border-yellow-300', 'bg-red-100 border-red-300',
                    'bg-purple-100 border-purple-300', 'bg-pink-100 border-pink-300'];

    container.innerHTML = segments.map((seg, i) => `
        <div class="p-3 rounded border ${colors[i % colors.length]} cursor-pointer hover:shadow transition-shadow"
             onclick="seekToTime(${seg.start})">
            <div class="flex justify-between items-center mb-1">
                <span class="font-medium">${seg.label || '片段 ' + (i + 1)}</span>
                <span class="text-sm text-gray-500">
                    <span class="mdi mdi-clock-outline"></span>
                    ${formatTime(seg.start)} - ${formatTime(seg.end)}
                </span>
            </div>
            ${seg.description ? `<p class="text-sm text-gray-600">${seg.description}</p>` : ''}
        </div>
    `).join('');
}

export function renderJSON(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = jsonToHTML(data);
}

export function jsonToHTML(obj, indent = 0) {
    if (obj === null) return '<span class="json-null">null</span>';
    if (typeof obj === 'boolean') return `<span class="json-boolean">${obj}</span>`;
    if (typeof obj === 'number') return `<span class="json-number">${obj}</span>`;
    if (typeof obj === 'string') return `<span class="json-string">"${escapeHTML(obj)}"</span>`;

    const pad = '  '.repeat(indent);
    const padInner = '  '.repeat(indent + 1);

    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        const items = obj.map(item => padInner + jsonToHTML(item, indent + 1)).join(',\n');
        return `[\n${items}\n${pad}]`;
    }

    if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(key => 
            `${padInner}<span class="json-key">"${escapeHTML(key)}"</span>: ${jsonToHTML(obj[key], indent + 1)}`
        ).join(',\n');
        return `{\n${items}\n${pad}}`;
    }

    return String(obj);
}

export function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderKeyframes(keyframes) {
    const container = document.getElementById('keyframes-content');
    if (keyframes.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8 col-span-3">暂无关键帧数据</div>';
        return;
    }

    container.innerHTML = keyframes.map(kf => `
        <div class="keyframe-thumb bg-gray-200 rounded overflow-hidden" onclick="seekToTime(${kf.time})">
            ${kf.thumbnail 
                ? `<img src="${kf.thumbnail}" class="w-full h-24 object-cover" alt="关键帧">`
                : `<div class="w-full h-24 flex items-center justify-center text-gray-400">
                       <span class="mdi mdi-image-off text-2xl"></span>
                   </div>`
            }
            <div class="p-2 text-xs text-center">
                <span class="mdi mdi-clock-outline"></span> ${formatTime(kf.time)}
                ${kf.label ? `<div class="text-gray-500 truncate">${kf.label}</div>` : ''}
            </div>
        </div>
    `).join('');
}

// ============================================
