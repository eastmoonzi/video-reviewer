import { getCurrentTask } from './task.js';
import { elements } from './state.js';

export function togglePlay() {
    if (elements.videoPlayer.paused) {
        elements.videoPlayer.play();
    } else {
        elements.videoPlayer.pause();
    }
}

export function seekRelative(seconds) {
    elements.videoPlayer.currentTime += seconds;
}

// 将文本中的时间描述转为可点击跳转的链接
export function linkifyTime(text) {
    if (!text) return '';
    // 按优先级排列：复合格式优先于简单格式
    const patterns = [
        // X分Y秒 / X分钟Y秒
        { re: /(\d+)\s*分钟?\s*(\d+)\s*秒/g, calc: (m) => parseInt(m[1]) * 60 + parseInt(m[2]) },
        // XmYs
        { re: /(\d+)\s*m\s*(\d+)\s*s/gi, calc: (m) => parseInt(m[1]) * 60 + parseInt(m[2]) },
        // MM:SS（后面可以跟空白、标点、→、HTML标签、行尾等）
        { re: /(\d{1,2}):(\d{2})(?=\s|$|[，。,.;；、）\)→\-<])/g, calc: (m) => parseInt(m[1]) * 60 + parseInt(m[2]) },
        // X-Ys / X至Ys / X 至 Y秒（范围：起始+结束双跳转）
        { re: /(\d+)\s*([-至])\s*(\d+)\s*(?:s|秒)/gi, isRange: true,
          calc: (m) => parseInt(m[1]), calcEnd: (m) => parseInt(m[3]) },
        // X分 / X分钟
        { re: /(\d+)\s*分钟?(?!\s*\d)/g, calc: (m) => parseInt(m[1]) * 60 },
        // Xm（不后跟数字/s，避免与 XmYs 冲突）
        { re: /(\d+)\s*m(?!\s*\d)(?!s)/gi, calc: (m) => parseInt(m[1]) * 60 },
        // Xs
        { re: /(\d+)\s*s/gi, calc: (m) => parseInt(m[1]) },
        // X秒
        { re: /(\d+)\s*秒/g, calc: (m) => parseInt(m[1]) },
    ];

    // 收集所有匹配及位置，避免重叠
    const matches = [];
    for (const { re, calc, isRange, calcEnd } of patterns) {
        let m;
        while ((m = re.exec(text)) !== null) {
            const start = m.index;
            const end = start + m[0].length;
            // 检查是否与已有匹配重叠
            if (!matches.some(prev => start < prev.end && end > prev.start)) {
                if (isRange && calcEnd) {
                    // 范围类型：生成包含两个 time-link 的 html
                    const startSec = calc(m);
                    const endSec = calcEnd(m);
                    // 解析原始文本，拆分为 起始数字 + 分隔符 + 结束数字+单位
                    const rangeRe = /^(\d+)(\s*[-至]\s*)(\d+\s*(?:s|秒))$/i;
                    const parts = m[0].match(rangeRe);
                    let html;
                    if (parts) {
                        html = `<span class="time-link" onclick="event.stopPropagation(); seekToTime(${startSec})">${parts[1]}</span>${parts[2]}<span class="time-link" onclick="event.stopPropagation(); seekToTime(${endSec})">${parts[3]}</span>`;
                    } else {
                        // fallback: 整体作为起始时间链接
                        html = `<span class="time-link" onclick="event.stopPropagation(); seekToTime(${startSec})">${m[0]}</span>`;
                    }
                    matches.push({ start, end, original: m[0], seconds: startSec, html });
                } else {
                    matches.push({ start, end, original: m[0], seconds: calc(m) });
                }
            }
        }
    }

    if (matches.length === 0) return text;

    // 按位置排序后拼接
    matches.sort((a, b) => a.start - b.start);
    let result = '';
    let lastIdx = 0;
    for (const m of matches) {
        result += text.slice(lastIdx, m.start);
        if (m.html) {
            result += m.html;
        } else {
            result += `<span class="time-link" onclick="event.stopPropagation(); seekToTime(${m.seconds})">${m.original}</span>`;
        }
        lastIdx = m.end;
    }
    result += text.slice(lastIdx);
    return result;
}

export function seekToTime(seconds) {
    elements.videoPlayer.currentTime = seconds;
}

// 解析用户输入的时间文本，返回秒数或 NaN
export function parseTimeInput(text) {
    if (!text) return NaN;
    text = text.trim();

    // X分Y秒 / X分钟Y秒
    let m = text.match(/^(\d+)\s*分钟?\s*(\d+)\s*秒?$/);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);

    // XmYs
    m = text.match(/^(\d+)\s*m\s*(\d+)\s*s?$/i);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);

    // MM:SS
    m = text.match(/^(\d{1,3}):(\d{2})$/);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);

    // X分 / X分钟
    m = text.match(/^(\d+)\s*分钟?$/);
    if (m) return parseInt(m[1]) * 60;

    // Xm
    m = text.match(/^(\d+)\s*m$/i);
    if (m) return parseInt(m[1]) * 60;

    // Xs / X秒
    m = text.match(/^(\d+)\s*(?:s|秒)$/i);
    if (m) return parseInt(m[1]);

    // 纯数字（视为秒）
    m = text.match(/^(\d+(?:\.\d+)?)$/);
    if (m) return parseFloat(m[1]);

    return NaN;
}

// 手动跳转到输入的时间
export function jumpToInputTime(inputId) {
    const input = document.getElementById(inputId || 'time-jump-input');
    if (!input) return;
    const seconds = parseTimeInput(input.value);
    if (isNaN(seconds)) {
        input.style.outline = '2px solid #ef4444';
        setTimeout(() => { input.style.outline = ''; }, 800);
        return;
    }
    const duration = elements.videoPlayer.duration || Infinity;
    const clamped = Math.max(0, Math.min(seconds, duration));
    seekToTime(clamped);
    input.value = formatTime(clamped);
    input.style.outline = '2px solid #22c55e';
    setTimeout(() => { input.style.outline = ''; }, 600);
}

// Expose time navigation helpers for inline handlers
window.seekToTime = seekToTime;
window.jumpToInputTime = jumpToInputTime;

export function seekToPosition(event) {
    const timeline = event.currentTarget;
    const rect = timeline.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    elements.videoPlayer.currentTime = percent * elements.videoPlayer.duration;
}

export function changePlaybackRate() {
    const rate = document.getElementById('playback-rate').value;
    elements.videoPlayer.playbackRate = parseFloat(rate);
}

export function updateTimeDisplay() {
    const current = formatTime(elements.videoPlayer.currentTime);
    const duration = formatTime(elements.videoPlayer.duration);
    elements.timeDisplay.textContent = `${current} / ${duration}`;
    
    const percent = (elements.videoPlayer.currentTime / elements.videoPlayer.duration) * 100;
    elements.timelineProgress.style.width = `${percent}%`;
}

export function onVideoLoaded() {
    renderTimeline();
}

export function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimeLink(seconds) {
    const display = formatTime(seconds);
    if (isNaN(seconds)) return display;
    const s = Math.floor(seconds);
    return `<span class="time-link" onclick="event.stopPropagation(); seekToTime(${s})">${display}</span>`;
}

// ============================================
// 时间轴渲染
// ============================================
export function renderTimeline() {
    const task = getCurrentTask();
    if (!task || !elements.videoPlayer.duration) return;

    const duration = elements.videoPlayer.duration;
    const segments = task.model_output?.segments || [];

    // 渲染为一整段黑色进度条 (Ive Style)
    elements.timelineSegments.innerHTML = `
        <div class="absolute h-full w-full bg-black opacity-20 rounded-full"></div>
    `;

    // 显示每个分段的开始和结束时间作为分界点（尊重原始标注）
    const boundaryTimes = new Set();
    segments.forEach((seg) => {
        boundaryTimes.add(seg.start);
        boundaryTimes.add(seg.end);
    });

    // 转换为数组并排序
    const sortedTimes = [...boundaryTimes].sort((a, b) => a - b);
    
    elements.timelineMarkers.innerHTML = sortedTimes.map(time => {
        const pos = (time / duration) * 100;
        // 极简风格的分段点 - 外层透明区域增大点击容错范围
        return `<div class="absolute cursor-pointer z-20" 
                    style="left: ${pos}%; transform: translateX(-50%); padding: 5px;"
                    onclick="event.stopPropagation(); seekToTime(${time})"
                    title="分段点: ${formatTime(time)}">
                    <div class="w-2.5 h-2.5 bg-white border-2 border-gray-400 shadow-sm rounded-full hover:scale-150 hover:border-black transition-all"></div>
                </div>`;
    }).join('');
}

// ============================================
// 标签页切换
