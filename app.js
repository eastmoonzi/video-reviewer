// ============================================
// 视频审查工作台 - 主应用逻辑
// build: 2026-03-10a
// ============================================
console.log('%c[app.js] 脚本已加载 ' + new Date().toLocaleTimeString(), 'color:green;font-weight:bold');

// 全局状态
const state = {
    // 工作区
    currentWorkspaceId: null,
    workspaces: [],
    // 分段语义详情任务
    segmentTasks: [],
    segmentTaskIndex: -1,
    // 全篇语义画像任务
    profileTasks: [],
    profileTaskIndex: -1,
    // 当前模式
    currentOutputGroup: 0,  // 当前数据组索引
    currentTab: 'text',     // 当前标签页（text 或 visual）
    reviewMode: 'segment',  // 审核模式：segment / profile / audiovisual
    // 分段语义详情评分（1-3分）
    ratings: {
        time: 0,
        text: 0,
        visual: 0,
        keyframe: 0
    },
    notes: {
        time: '',
        text: '',
        visual: '',
        keyframe: ''
    },
    // 全篇语义画像评分（0-2分）
    profileRatings: {
        narrative_type: -1,      // 叙事类型
        visual_type: -1,         // 画面类型
        summary: -1,             // 内容总结
        intent_type: -1,         // 创作意图
        topic_consistency: -1,   // 主题一致性
        core_claim: -1,          // 核心观点
        emotion_type: -1         // 情感类型
    },
    profileNotes: {
        narrative_type: '',
        visual_type: '',
        summary: '',
        intent_type: '',
        topic_consistency: '',
        core_claim: '',
        emotion_type: ''
    },
    // 基础音画质量任务
    audiovisualTasks: [],
    audiovisualTaskIndex: -1,
    // 基础音画质量评分（0-2分）
    audiovisualRatings: {
        overall_quality: -1,
        processing_elements: -1,
        processing_elements_time: -1,
        composition: -1,
        composition_time: -1,
        person: -1,
        person_time: -1,
        creature: -1,
        creature_time: -1,
        info_attributes: -1,
        questionable_info: -1,
        geographic_info: -1,
        timeliness_info: -1,
        vulgar_intent: -1,
        promotional_intent: -1,
        immoral_values: -1
    },
    audiovisualNotes: {
        overall_quality: '',
        processing_elements: '',
        processing_elements_time: '',
        composition: '',
        composition_time: '',
        person: '',
        person_time: '',
        creature: '',
        creature_time: '',
        info_attributes: '',
        questionable_info: '',
        geographic_info: '',
        timeliness_info: '',
        vulgar_intent: '',
        promotional_intent: '',
        immoral_values: ''
    },
    // 对比模式
    comparisonMode: false,
    comparisonGroups: [0, 1],
    taskSearch: ''
};

// 获取当前模式的任务列表
function getTasks() {
    if (state.reviewMode === 'segment') return state.segmentTasks;
    if (state.reviewMode === 'audiovisual') return state.audiovisualTasks;
    return state.profileTasks;
}

// 获取当前模式的任务索引
function getTaskIndex() {
    if (state.reviewMode === 'segment') return state.segmentTaskIndex;
    if (state.reviewMode === 'audiovisual') return state.audiovisualTaskIndex;
    return state.profileTaskIndex;
}

// 设置当前模式的任务索引
function setTaskIndex(index) {
    if (state.reviewMode === 'segment') {
        state.segmentTaskIndex = index;
    } else if (state.reviewMode === 'audiovisual') {
        state.audiovisualTaskIndex = index;
    } else {
        state.profileTaskIndex = index;
    }
}

// 全篇语义画像维度配置
const PROFILE_DIMENSIONS = [
    { key: 'narrative_type', label: '叙事类型' },
    { key: 'visual_type', label: '画面类型' },
    { key: 'summary', label: '内容总结' },
    { key: 'intent_type', label: '创作意图' },
    { key: 'topic_consistency', label: '主题一致性' },
    { key: 'core_claim', label: '核心观点' },
    { key: 'emotion_type', label: '情感类型' }
];

// 基础音画质量维度配置
const AUDIOVISUAL_DIMENSIONS = [
    { key: 'overall_quality', label: '总体质量', shortLabel: '总体' },
    // 画面质量
    { key: 'processing_elements', label: '加工元素', shortLabel: '加工' },
    { key: 'processing_elements_time', label: '加工元素时间', shortLabel: '加工时间' },
    { key: 'composition', label: '构图', shortLabel: '构图' },
    { key: 'composition_time', label: '构图时间', shortLabel: '构图时间' },
    // 内容主体
    { key: 'person', label: '人物', shortLabel: '人物' },
    { key: 'person_time', label: '人物时间', shortLabel: '人物时间' },
    { key: 'creature', label: '生物', shortLabel: '生物' },
    { key: 'creature_time', label: '生物时间', shortLabel: '生物时间' },
    // 信息
    { key: 'info_attributes', label: '信息属性', shortLabel: '信息' },
    { key: 'questionable_info', label: '真实性存疑', shortLabel: '真实性' },
    { key: 'geographic_info', label: '地理位置', shortLabel: '地理' },
    { key: 'timeliness_info', label: '时效性', shortLabel: '时效' },
    // 意图与价值
    { key: 'vulgar_intent', label: '低俗意图', shortLabel: '低俗' },
    { key: 'promotional_intent', label: '营销引流', shortLabel: '营销' },
    { key: 'immoral_values', label: '违背道德', shortLabel: '道德' }
];

// DOM 元素缓存
const elements = {
    videoPlayer: null,
    taskList: null,
    progressBar: null,
    progressText: null,
    completedCount: null,
    pendingCount: null,
    timeDisplay: null,
    timelineProgress: null,
    timelineSegments: null,
    timelineMarkers: null
};

// ============================================
// 初始化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('初始化开始...');
    initElements();
    console.log('视频播放器元素:', elements.videoPlayer);
    initEventListeners();
    migrateToWorkspaces();
    loadFromLocalStorage();
    renderWorkspaceSwitcher();
    updateUI();
    restoreSidebarState();
    restoreRatingPanelState();
    restoreReviewMode();
    loadLLMSettings();

    // 备注输入实时保存（防抖 500ms）
    let _noteSaveTimer = null;
    document.addEventListener('input', function(e) {
        const el = e.target;
        if (el.tagName !== 'TEXTAREA') return;
        if (!el.id || (!el.id.startsWith('note-') && !el.id.startsWith('dock-note-'))) return;
        clearTimeout(_noteSaveTimer);
        _noteSaveTimer = setTimeout(() => {
            saveReviewForCurrentGroup();
            saveToLocalStorage();
        }, 500);
    });

    console.log('初始化完成');
});

// 强制清除所有数据（用于调试）
function forceReset() {
    // 清理所有工作区相关的 localStorage
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('ws:') || key === 'ws-registry' || key === 'ws-active') {
            localStorage.removeItem(key);
        }
    });
    // 清理旧格式键
    localStorage.removeItem('video-review-segment-tasks');
    localStorage.removeItem('video-review-segment-index');
    localStorage.removeItem('video-review-profile-tasks');
    localStorage.removeItem('video-review-profile-index');
    localStorage.removeItem('sidebar-collapsed');
    localStorage.removeItem('review-mode');
    state.segmentTasks = [];
    state.segmentTaskIndex = -1;
    state.profileTasks = [];
    state.profileTaskIndex = -1;
    state.audiovisualTasks = [];
    state.audiovisualTaskIndex = -1;
    state.workspaces = [];
    state.currentWorkspaceId = null;
    location.reload();
}
window.forceReset = forceReset;

// ============================================
// 工作区管理
// ============================================
function getWorkspaceKey(wsId, suffix) {
    return `ws:${wsId}:${suffix}`;
}

function saveWorkspaceRegistry() {
    localStorage.setItem('ws-registry', JSON.stringify(state.workspaces));
    localStorage.setItem('ws-active', state.currentWorkspaceId);
}

function loadWorkspaceRegistry() {
    const raw = localStorage.getItem('ws-registry');
    state.workspaces = raw ? JSON.parse(raw) : [];
    state.currentWorkspaceId = localStorage.getItem('ws-active');
}

function migrateToWorkspaces() {
    if (localStorage.getItem('ws-registry')) {
        loadWorkspaceRegistry();
        return;
    }
    // 首次迁移：将旧数据移入默认工作区
    const defaultId = 'ws_default';
    state.workspaces = [{ id: defaultId, name: '默认工作区', createdAt: Date.now() }];
    state.currentWorkspaceId = defaultId;

    const migrations = [
        ['video-review-segment-tasks', 'segment-tasks'],
        ['video-review-segment-index', 'segment-index'],
        ['video-review-profile-tasks', 'profile-tasks'],
        ['video-review-profile-index', 'profile-index'],
        ['review-mode', 'review-mode']
    ];
    migrations.forEach(([oldKey, suffix]) => {
        const value = localStorage.getItem(oldKey);
        if (value !== null) {
            localStorage.setItem(getWorkspaceKey(defaultId, suffix), value);
            localStorage.removeItem(oldKey);
        }
    });
    saveWorkspaceRegistry();
}

function createWorkspace(name) {
    if (!name) {
        name = prompt('输入工作区名称:', '新工作区');
        if (!name || !name.trim()) return;
        name = name.trim();
    }
    const id = 'ws_' + Date.now();
    state.workspaces.push({ id, name, createdAt: Date.now() });
    saveWorkspaceRegistry();
    switchWorkspace(id);
}

function switchWorkspace(wsId) {
    // 保存当前工作区数据
    if (state.currentWorkspaceId) {
        saveToLocalStorage();
    }
    // 重置内存状态
    state.segmentTasks = [];
    state.segmentTaskIndex = -1;
    state.profileTasks = [];
    state.profileTaskIndex = -1;
    state.audiovisualTasks = [];
    state.audiovisualTaskIndex = -1;
    state.currentOutputGroup = 0;
    resetRatings();
    resetProfileRatings();
    resetAudiovisualRatings();

    // 切换
    state.currentWorkspaceId = wsId;
    saveWorkspaceRegistry();

    // 加载新工作区数据
    loadFromLocalStorage();

    // 刷新 UI（保持当前审核模式不变）
    renderWorkspaceSwitcher();
    switchReviewMode(state.reviewMode);
    updateUI();
}

function deleteWorkspace(wsId) {
    if (state.workspaces.length <= 1) {
        alert('至少保留一个工作区');
        return;
    }
    const ws = state.workspaces.find(w => w.id === wsId);
    if (!confirm(`确定删除工作区「${ws.name}」？所有审查数据将丢失！`)) return;

    ['segment-tasks', 'segment-index', 'profile-tasks', 'profile-index', 'audiovisual-tasks', 'audiovisual-index', 'review-mode'].forEach(suffix => {
        localStorage.removeItem(getWorkspaceKey(wsId, suffix));
    });
    state.workspaces = state.workspaces.filter(w => w.id !== wsId);
    saveWorkspaceRegistry();

    if (state.currentWorkspaceId === wsId) {
        switchWorkspace(state.workspaces[0].id);
    } else {
        renderWorkspaceSwitcher();
    }
}

function renderWorkspaceSwitcher() {
    const select = document.getElementById('workspace-select');
    if (!select) return;
    select.innerHTML = state.workspaces.map(ws =>
        `<option value="${ws.id}" ${ws.id === state.currentWorkspaceId ? 'selected' : ''}>${ws.name}</option>`
    ).join('');
}

function showWorkspaceMenu() {
    const ws = state.workspaces.find(w => w.id === state.currentWorkspaceId);
    if (!ws) return;
    const action = prompt(
        `工作区「${ws.name}」\n\n输入新名称可重命名，或输入 delete 删除：`,
        ws.name
    );
    if (action === null) return;
    if (action.toLowerCase() === 'delete') {
        deleteWorkspace(ws.id);
    } else if (action.trim()) {
        ws.name = action.trim();
        saveWorkspaceRegistry();
        renderWorkspaceSwitcher();
    }
}

window.createWorkspace = createWorkspace;
window.switchWorkspace = switchWorkspace;
window.showWorkspaceMenu = showWorkspaceMenu;

function initElements() {
    elements.videoPlayer = document.getElementById('video-player');
    elements.taskList = document.getElementById('task-list');
    elements.progressBar = document.getElementById('progress-bar');
    elements.progressText = document.getElementById('progress-text');
    elements.completedCount = document.getElementById('completed-count');
    elements.pendingCount = document.getElementById('pending-count');
    elements.timeDisplay = document.getElementById('time-display');
    elements.timelineProgress = document.getElementById('timeline-progress');
    elements.timelineSegments = document.getElementById('timeline-segments');
    elements.timelineMarkers = document.getElementById('timeline-markers');
}

function initEventListeners() {
    // 视频播放器事件
    if (elements.videoPlayer) {
        elements.videoPlayer.addEventListener('timeupdate', updateTimeDisplay);
        elements.videoPlayer.addEventListener('loadedmetadata', onVideoLoaded);
        elements.videoPlayer.addEventListener('play', () => {
            document.getElementById('play-btn-icon').className = 'mdi mdi-pause';
        });
        elements.videoPlayer.addEventListener('pause', () => {
            document.getElementById('play-btn-icon').className = 'mdi mdi-play';
        });
        elements.videoPlayer.addEventListener('error', (e) => {
            console.error('视频加载错误:', e);
            console.error('视频URL:', elements.videoPlayer.src);
            // 显示用户友好的错误提示
            const task = getCurrentTask();
            if (task) {
                const errorMsg = `视频加载失败，可能原因：
1. 视频链接已过期或签名失效
2. 跨域(CORS)限制
3. 网络连接问题

请检查视频URL是否有效: ${task.video_url?.substring(0, 80)}...`;
                console.warn(errorMsg);
            }
        });
    } else {
        console.error('视频播放器元素未找到!');
    }

    // 评分星星事件 - 支持两种模式
    initRatingListeners();

    // 导入类型切换
    document.querySelectorAll('input[name="import-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isManual = e.target.value === 'manual';
            document.getElementById('import-file-section').classList.toggle('hidden', isManual);
            document.getElementById('import-manual-section').classList.toggle('hidden', !isManual);
        });
    });

    // 键盘快捷键
    document.addEventListener('keydown', handleKeyboard);

    // 进度条悬停时间提示
    const timeline = document.getElementById('timeline');
    if (timeline) {
        const tooltip = document.createElement('div');
        tooltip.className = 'timeline-tooltip';
        tooltip.style.display = 'none';
        timeline.style.position = 'relative';
        timeline.appendChild(tooltip);

        timeline.addEventListener('mousemove', (e) => {
            const dur = elements.videoPlayer?.duration;
            if (!dur) return;
            const rect = timeline.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const time = percent * dur;
            tooltip.textContent = formatTime(time);
            tooltip.style.display = 'block';
            // 居中在鼠标位置上方，不超出进度条边界
            const tipW = tooltip.offsetWidth;
            let left = e.clientX - rect.left - tipW / 2;
            left = Math.max(0, Math.min(left, rect.width - tipW));
            tooltip.style.left = left + 'px';
        });

        timeline.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }
}

// ============================================
// 视频控制
// ============================================
function togglePlay() {
    if (elements.videoPlayer.paused) {
        elements.videoPlayer.play();
    } else {
        elements.videoPlayer.pause();
    }
}

function seekRelative(seconds) {
    elements.videoPlayer.currentTime += seconds;
}

// 将文本中的时间描述转为可点击跳转的链接
function linkifyTime(text) {
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

function seekToTime(seconds) {
    elements.videoPlayer.currentTime = seconds;
}

// 解析用户输入的时间文本，返回秒数或 NaN
function parseTimeInput(text) {
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
function jumpToInputTime(inputId) {
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

function seekToPosition(event) {
    const timeline = event.currentTarget;
    const rect = timeline.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    elements.videoPlayer.currentTime = percent * elements.videoPlayer.duration;
}

function changePlaybackRate() {
    const rate = document.getElementById('playback-rate').value;
    elements.videoPlayer.playbackRate = parseFloat(rate);
}

function updateTimeDisplay() {
    const current = formatTime(elements.videoPlayer.currentTime);
    const duration = formatTime(elements.videoPlayer.duration);
    elements.timeDisplay.textContent = `${current} / ${duration}`;
    
    const percent = (elements.videoPlayer.currentTime / elements.videoPlayer.duration) * 100;
    elements.timelineProgress.style.width = `${percent}%`;
}

function onVideoLoaded() {
    renderTimeline();
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeLink(seconds) {
    const display = formatTime(seconds);
    if (isNaN(seconds)) return display;
    const s = Math.floor(seconds);
    return `<span class="time-link" onclick="event.stopPropagation(); seekToTime(${s})">${display}</span>`;
}

// ============================================
// 时间轴渲染
// ============================================
function renderTimeline() {
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
                    style="left: ${pos}%; transform: translateX(-50%); padding: 10px;"
                    onclick="event.stopPropagation(); seekToTime(${time})"
                    title="分段点: ${formatTime(time)}">
                    <div class="w-2.5 h-2.5 bg-white border-2 border-gray-400 shadow-sm rounded-full hover:scale-150 hover:border-black transition-all"></div>
                </div>`;
    }).join('');
}

// ============================================
// 标签页切换
// ============================================
function switchTab(tabName) {
    state.currentTab = tabName;
    
    // 更新标签按钮样式
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle('tab-active', isActive);
        // 切换 Tailwind 类以配合 CSS
        btn.classList.toggle('font-semibold', isActive);
        btn.classList.toggle('text-black', isActive);
        btn.classList.toggle('border-black', isActive);
        btn.classList.toggle('font-medium', !isActive);
        btn.classList.toggle('text-gray-400', !isActive);
        btn.classList.toggle('border-transparent', !isActive);
    });

    // 切换面板显示
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    // 渲染内容
    renderTabContent(tabName);
}

// JSON 解析失败时的回退 UI
function renderParseErrorFallback(containerId) {
    const task = getCurrentTask();
    const taskIndex = getTaskIndex();
    const groupIndex = state.currentOutputGroup;
    const output = task?.model_outputs?.[groupIndex] || task?.model_output;
    if (!output?._parseError) return false;
    const container = document.getElementById(containerId);
    if (!container) return false;
    container.innerHTML = `
        <div class="p-4 rounded-2xl border border-amber-200 bg-amber-50">
            <div class="flex items-center gap-2 mb-3">
                <span class="mdi mdi-alert text-amber-500 text-lg"></span>
                <span class="text-sm font-semibold text-amber-800">JSON 解析失败，原始内容：</span>
            </div>
            <pre class="text-xs text-gray-700 bg-white border border-amber-100 rounded-xl p-3 overflow-auto max-h-60 whitespace-pre-wrap break-all">${escapeHTML(output.raw || '')}</pre>
            <button id="repair-single-btn-${taskIndex}-${groupIndex}"
                    onclick="repairSingleOutput(${taskIndex}, ${groupIndex})"
                    class="mt-3 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1">
                <span class="mdi mdi-wrench"></span> 修复此条
            </button>
        </div>`;
    return true;
}

// ─── LLM 修复 ────────────────────────────────────────────────────────────────

const LLM_REPAIR_PROMPTS = {
    segment: `将以下内容修复为合法的 JSON，严格保留所有字段名和字段值，不要增删任何字段，不要任何其他输出。
目标结构为分段语义数组，每个片段包含字段：start, end, label, description, visual, keyframes。
原始字段名也可能是：segment_detail / segment_output 包裹的数组，或 time/text/vis/key_frame 等。
只修复 JSON 格式，不改动任何字段值。\n\n`,

    profile: `将以下内容修复为合法的 JSON，严格保留所有字段名和字段值，不要增删任何字段，不要任何其他输出。
目标结构为全篇语义画像，包含以下字段（可能被 global_profile 包裹）：
narrative_type, visual_type, summary, intent_type, topic_consistency, core_claim, emotion_type（或 emotional_tone）。
只修复 JSON 格式，不改动任何字段值。\n\n`,

    audiovisual: `将以下内容修复为合法的 JSON，严格保留所有字段名和字段值，不要增删任何字段，不要任何其他输出。
目标结构为基础音画质量评估，完整字段如下：
- audiovisual_integration（或 visual_integration）: { detail_quality: { level, desc } }
- vision_quality: { visual_processing_elements: [...], composition: [...] }
- content_subject: { man_negative_content: [...], creature_negative_content: [...] }
- information: { information_attributes: [...], questionable_info: { has_issue, desc }, geographic_info: { has_info, desc }, timeliness_info: { has_info, desc } }
- intent: { vulgar_intent: { has_intent, desc }, promotional_intent: [...] }
- values: { immoral_values: { has_issue, category: [...], desc } }
只修复 JSON 格式，不改动任何字段名或字段值。\n\n`,
};

async function callLLMRepair(text, mode) {
    const useDefault = localStorage.getItem('llm-use-default') !== '';
    const baseUrl = useDefault ? 'https://api.deepseek.com'              : (localStorage.getItem('llm-base-url') || '');
    const apiKey  = useDefault ? 'sk-ffc1051e1e864ccfa8979445c45ca6e5'   : (localStorage.getItem('llm-api-key')  || '');
    const model   = useDefault ? 'deepseek-chat'                         : (localStorage.getItem('llm-model')    || 'deepseek-chat');

    if (!baseUrl || !apiKey) {
        throw new Error('请先在设置中配置 LLM API Key 和 Base URL');
    }

    const isAnthropic = baseUrl.includes('anthropic');
    const prompt = LLM_REPAIR_PROMPTS[mode] || LLM_REPAIR_PROMPTS.audiovisual;
    const truncated = text.slice(0, 8000);

    const messages = [
        { role: 'user', content: prompt + truncated }
    ];

    const normalizedBase = baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '');

    const endpoint = isAnthropic
        ? normalizedBase + '/v1/messages'
        : normalizedBase + '/v1/chat/completions';
    const headers = isAnthropic
        ? { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

    const requestBody = { model, max_tokens: 8192, messages };
    if (!isAnthropic) requestBody.response_format = { type: 'json_object' };

    console.log('[LLM Repair] 请求:', endpoint, '模型:', model, '输入字符数:', truncated.length);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60秒超时

    let resp;
    try {
        resp = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
    } catch (fetchErr) {
        clearTimeout(timeout);
        if (fetchErr.name === 'AbortError') {
            throw new Error('请求超时（60秒），请检查 API 地址和网络');
        }
        throw new Error('网络请求失败: ' + fetchErr.message);
    }
    clearTimeout(timeout);

    console.log('[LLM Repair] 响应状态:', resp.status);

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const body = await resp.json();
    let reply = isAnthropic
        ? body?.content?.[0]?.text
        : body?.choices?.[0]?.message?.content;

    if (!reply) throw new Error('API 返回内容为空');

    console.log('[LLM Repair] 回复长度:', reply.length, '前200字符:', reply.slice(0, 200));

    // 用 quickParseJson 解析（自动处理代码块、XML标签、Python dict 等非标准格式）
    const parsed = quickParseJson(reply);
    if (parsed !== null && parsed !== undefined) {
        console.log('[LLM Repair] 解析成功');
        return parsed;
    }

    const preview = reply.slice(0, 150).replace(/\n/g, ' ');
    throw new Error('LLM 返回无法解析为 JSON: ' + preview + '...');
}

async function repairSingleOutput(taskIndex, groupIndex) {
    const tasks = getTasks();
    const task = tasks[taskIndex];
    if (!task) return;
    const output = task.model_outputs?.[groupIndex];
    const btn = document.getElementById(`repair-single-btn-${taskIndex}-${groupIndex}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="mdi mdi-autorenew animate-spin"></span> 修复中... 60s';
        btn.classList.add('opacity-60', 'cursor-wait');
    }

    // 按钮倒计时
    let countdown = 60;
    const countdownTimer = setInterval(() => {
        countdown--;
        if (btn) {
            if (countdown > 0) {
                btn.innerHTML = `<span class="mdi mdi-autorenew animate-spin"></span> 修复中... ${countdown}s`;
            } else {
                btn.innerHTML = '<span class="mdi mdi-autorenew animate-spin"></span> 等待响应...';
                clearInterval(countdownTimer);
            }
        } else {
            clearInterval(countdownTimer);
        }
    }, 1000);

    try {
        const rawText = output.raw || output._raw || JSON.stringify(output);
        const repaired = await callLLMRepair(rawText, state.reviewMode);
        clearInterval(countdownTimer);
        if (repaired === null || repaired === undefined) {
            throw new Error('LLM 无法识别该 JSON');
        }
        task.model_outputs[groupIndex] = normalizeModelOutput(repaired);
        saveToLocalStorage();
        updateUI();
        // 重新渲染内容面板（updateUI 只刷新侧边栏，不刷新主面板）
        selectTask(getTaskIndex());
    } catch (e) {
        clearInterval(countdownTimer);
        console.error('[LLM Repair] 修复失败:', e);
        // 不用 alert（会阻塞 UI），直接在按钮上显示错误
        const btnNow = document.getElementById(`repair-single-btn-${taskIndex}-${groupIndex}`) || btn;
        if (btnNow) {
            btnNow.disabled = false;
            btnNow.innerHTML = '<span class="mdi mdi-alert text-red-500"></span> 修复失败';
            btnNow.classList.remove('opacity-60', 'cursor-wait');
            setTimeout(() => {
                btnNow.innerHTML = '<span class="mdi mdi-wrench"></span> 修复此条';
            }, 3000);
        }
    }
}

async function repairAllErrors() {
    const tasks = getTasks();
    const toRepair = [];
    tasks.forEach((task, ti) => {
        task.model_outputs?.forEach((output, gi) => {
            if (output?._parseError) toRepair.push({ ti, gi, raw: output.raw });
        });
    });

    if (toRepair.length === 0) return;

    // 直接在侧边栏 banner 上显示进度，不弹模态框
    const banner = document.getElementById('parse-error-banner');
    const bannerBtn = banner?.querySelector('button');
    if (bannerBtn) {
        bannerBtn.disabled = true;
        bannerBtn.textContent = '修复中 0/' + toRepair.length;
    }

    let fixedCount = 0, failedCount = 0, doneCount = 0;

    const CONCURRENCY = 3;
    let cursor = 0;

    async function runNext() {
        while (cursor < toRepair.length) {
            const idx = cursor++;
            const { ti, gi, raw } = toRepair[idx];
            try {
                const repaired = await callLLMRepair(raw, state.reviewMode);
                if (repaired !== null && repaired !== undefined) {
                    tasks[ti].model_outputs[gi] = normalizeModelOutput(repaired);
                    fixedCount++;
                } else {
                    failedCount++;
                }
            } catch (e) {
                console.error(`[LLM Repair] 任务${ti}组${gi}修复失败:`, e.message);
                failedCount++;
            }
            doneCount++;
            // 实时更新 banner 进度
            if (bannerBtn) bannerBtn.textContent = `修复中 ${doneCount}/${toRepair.length}`;
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, toRepair.length); i++) {
        workers.push(runNext());
    }
    await Promise.all(workers);

    saveToLocalStorage();
    updateUI();
    // 如果当前任务的数据被修复了，刷新内容面板
    selectTask(getTaskIndex());

    // 恢复 banner 按钮
    if (bannerBtn) {
        bannerBtn.disabled = false;
        bannerBtn.textContent = '全部修复';
    }

    console.log(`[LLM Repair] 批量修复完成：成功 ${fixedCount}，失败 ${failedCount}`);
}

function closeRepairModal() {
    const modal = document.getElementById('repair-progress-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function updateParseErrorBanner() {
    const tasks = getTasks();
    let count = 0;
    tasks.forEach(task => {
        task.model_outputs?.forEach(o => { if (o?._parseError) count++; });
    });
    const banner = document.getElementById('parse-error-banner');
    const countEl = document.getElementById('parse-error-count');
    if (!banner || !countEl) return;
    if (count > 0) {
        countEl.textContent = count;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

// ─── LLM 设置 ─────────────────────────────────────────────────────────────────

function showSettings() {
    loadLLMSettings();
    document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('settings-modal').classList.add('flex');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('settings-modal').classList.remove('flex');
}

function saveLLMSettings() {
    const useDefault = document.getElementById('llm-use-default').checked;
    localStorage.setItem('llm-use-default', useDefault ? '1' : '');
    if (!useDefault) {
        localStorage.setItem('llm-base-url', document.getElementById('llm-base-url').value.trim());
        localStorage.setItem('llm-api-key',  document.getElementById('llm-api-key').value.trim());
        localStorage.setItem('llm-model',    document.getElementById('llm-model').value.trim());
    }
    closeSettingsModal();
}

function loadLLMSettings() {
    const useDefault = localStorage.getItem('llm-use-default') !== '';
    const checkbox = document.getElementById('llm-use-default');
    if (checkbox) checkbox.checked = useDefault;

    const baseUrlEl = document.getElementById('llm-base-url');
    const apiKeyEl  = document.getElementById('llm-api-key');
    const modelEl   = document.getElementById('llm-model');
    if (baseUrlEl) baseUrlEl.value = localStorage.getItem('llm-base-url') || '';
    if (apiKeyEl)  apiKeyEl.value  = localStorage.getItem('llm-api-key')  || '';
    if (modelEl)   modelEl.value   = localStorage.getItem('llm-model')    || '';

    toggleDefaultLLM(useDefault);
}

function toggleDefaultLLM(checked) {
    const fields = ['llm-base-url', 'llm-api-key', 'llm-model'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = checked;
        if (checked) {
            el.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        } else {
            el.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        }
    });
}
window.toggleDefaultLLM = toggleDefaultLLM;

function renderTabContent(tabName) {
    const task = getCurrentTask();
    if (!task) return;

    const output = task.model_output || {};
    // 解析失败时自动跳到原文 tab
    if (output._parseError && tabName !== 'raw') {
        switchTab('raw');
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
        case 'raw':
            renderRawContent(output, 'raw-content');
            break;
    }
}

function renderRawContent(output, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isError = !!output._parseError;
    const rawStr = isError
        ? (output.raw || '')
        : (output._raw || JSON.stringify(output, null, 2));

    const wrapClass = isError
        ? 'p-4 rounded-2xl border border-amber-200 bg-amber-50'
        : 'p-4 rounded-2xl border border-gray-200 bg-gray-50';

    const header = isError
        ? `<div class="flex items-center gap-2 mb-3">
               <span class="mdi mdi-alert text-amber-500 text-lg"></span>
               <span class="text-sm font-semibold text-amber-800">JSON 解析失败，原始内容：</span>
           </div>`
        : `<div class="flex items-center gap-2 mb-3">
               <span class="mdi mdi-code-json text-gray-400 text-lg"></span>
               <span class="text-sm font-semibold text-gray-600">原始文本：</span>
           </div>`;

    const taskIndex = getTaskIndex();
    const groupIndex = state.currentOutputGroup;
    const repairBtn = `<button id="repair-single-btn-${taskIndex}-${groupIndex}"
        onclick="repairSingleOutput(${taskIndex}, ${groupIndex})"
        class="mt-3 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1">
        <span class="mdi mdi-wrench"></span> 修复此条
    </button>`;

    container.innerHTML = `
        <div class="${wrapClass}">
            ${header}
            <pre class="text-xs text-gray-700 bg-white border border-gray-100 rounded-xl p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">${escapeHTML(rawStr)}</pre>
            ${repairBtn}
        </div>`;
}
window.renderRawContent = renderRawContent;

// 渲染文本理解（显示每个片段的 text 字段）- Ive Style: Unified Gray
function renderTextUnderstanding(segments) {
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
function renderVisualUnderstanding(segments) {
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
function renderKeyframeList(segments) {
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

function renderSegments(segments) {
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

function renderJSON(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = jsonToHTML(data);
}

function jsonToHTML(obj, indent = 0) {
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

function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderKeyframes(keyframes) {
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
// 评分系统
// ============================================
function setRating(dimension, value) {
    state.ratings[dimension] = value;
    const group = document.querySelector(`.rating-group[data-dimension="${dimension}"]`);
    highlightStars(group, value);
    saveReviewForCurrentGroup();
    saveToLocalStorage();
}

function highlightStars(group, value) {
    group.querySelectorAll('.rating-star').forEach(star => {
        const starValue = parseInt(star.dataset.value);
        if (starValue <= value) {
            star.classList.remove('mdi-star-outline');
            star.classList.add('mdi-star', 'active');
        } else {
            star.classList.remove('mdi-star', 'active');
            star.classList.add('mdi-star-outline');
        }
    });
}

function resetRatings() {
    state.ratings = { time: 0, text: 0, visual: 0, keyframe: 0 };
    state.notes = { time: '', text: '', visual: '', keyframe: '' };
    document.querySelectorAll('.rating-group[data-mode="segment"]').forEach(group => {
        highlightSegmentStars(group, 0);
    });
    // 清空所有备注输入（dock 面板 + 旧面板兼容）
    ['time', 'text', 'visual', 'keyframe'].forEach(dim => {
        const dockInput = document.getElementById(`dock-note-${dim}`);
        if (dockInput) { dockInput.value = ''; }
        const noteInput = document.getElementById(`note-${dim}`);
        if (noteInput) { noteInput.value = ''; }
    });
}

// ============================================
// 任务管理
// ============================================
function getCurrentTask() {
    const tasks = getTasks();
    const index = getTaskIndex();
    return tasks[index];
}

function selectTask(index) {
    if (getTaskIndex() !== index) {
        saveReviewForCurrentGroup();   // 仅在切换到不同任务时才保存
    }
    const tasks = getTasks();
    if (index < 0 || index >= tasks.length) return;

    setTaskIndex(index);
    state.currentOutputGroup = 0; // 默认选择第一组数据
    const task = tasks[index];

    // 更新UI
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('review-workspace').classList.remove('hidden');
    
    const taskLabel = document.getElementById('current-task-label');
    if (taskLabel) {
        const labelText = task.id || task.rawId || `任务 ${index + 1}`;
        taskLabel.querySelector('div').textContent = labelText;
        taskLabel.classList.remove('hidden');
    }

    // 加载视频
    // 自动将 HTTP URL 转换为 HTTPS（避免混合内容问题）
    let videoUrl = task.video_url || '';
    videoUrl = safeUpgradeToHttps(videoUrl);

    // 移除旧 notice（切换任务时清理）
    const oldNotice = document.getElementById('intranet-video-notice');
    if (oldNotice) oldNotice.remove();

    if (videoUrl && isIntranetHttp(videoUrl) && location.protocol === 'https:') {
        // HTTPS 页面 + 内网 HTTP 视频：无法直接播放，显示提示
        elements.videoPlayer.src = '';
        elements.videoPlayer.load();

        const notice = document.createElement('div');
        notice.id = 'intranet-video-notice';
        notice.className = 'absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white text-center p-6 z-10';

        const icon = document.createElement('div');
        icon.className = 'text-4xl mb-3';
        icon.textContent = '🔒';

        const title = document.createElement('div');
        title.className = 'text-base font-semibold mb-1';
        title.textContent = '内网视频无法在此页面直接播放';

        const desc = document.createElement('div');
        desc.className = 'text-sm text-gray-400 mb-4';
        desc.textContent = '请通过以下方式在新标签页中打开';

        const btnRow = document.createElement('div');
        btnRow.className = 'flex gap-3';

        const openBtn = document.createElement('button');
        openBtn.className = 'px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors';
        openBtn.textContent = '在新标签页打开';
        openBtn.addEventListener('click', () => window.open(videoUrl, '_blank'));

        const copyBtn = document.createElement('button');
        copyBtn.className = 'px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm font-medium transition-colors';
        copyBtn.textContent = '复制链接';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(videoUrl).then(() => {
                copyBtn.textContent = '已复制!';
                setTimeout(() => copyBtn.textContent = '复制链接', 2000);
            });
        });

        btnRow.append(openBtn, copyBtn);
        notice.append(icon, title, desc, btnRow);
        elements.videoPlayer.parentElement.appendChild(notice);
    } else {
        // 本地或无冲突：直接播放
        elements.videoPlayer.src = videoUrl;
        elements.videoPlayer.load();
    }

    // 重新应用当前倍速设置（load() 会重置 playbackRate）
    const rateSelect = document.getElementById('playback-rate');
    if (rateSelect) {
        elements.videoPlayer.playbackRate = parseFloat(rateSelect.value);
    }

    // 渲染数据组切换器
    renderOutputGroupSwitcher(task);

    // 恢复评分状态
    loadReviewForCurrentGroup();

    // 更新任务列表样式
    document.querySelectorAll('.task-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });

    // 渲染内容
    updateModelOutput();

    // 根据当前模式渲染对应内容
    if (state.comparisonMode) {
        // 对比模式：刷新两列内容
        refreshComparisonView();
    } else if (state.reviewMode === 'segment') {
        switchTab(state.currentTab);
    } else if (state.reviewMode === 'audiovisual') {
        renderAudiovisualContent();
    } else {
        renderProfileContent();
    }
}

// 渲染数据组切换器
function renderOutputGroupSwitcher(task) {
    const switcher = document.getElementById('output-group-switcher');
    const buttonsContainer = document.getElementById('output-group-buttons');

    const groupCount = task.model_outputs?.length || 0;

    if (groupCount <= 1) {
        // 单模型或无数据，隐藏切换器
        switcher.classList.add('hidden');
        return;
    }

    // 多模型：显示切换器
    switcher.classList.remove('hidden');

    // 渲染按钮 - 使用模型名称
    buttonsContainer.innerHTML = task.model_outputs.map((output, i) => {
        const reviewsArr = state.reviewMode === 'segment' ? task.reviews
            : state.reviewMode === 'audiovisual' ? task.audiovisualReviews
            : task.profileReviews;
        const review = reviewsArr?.[i];
        const isComplete = review?.completed;
        const isActive = i === state.currentOutputGroup;
        const modelName = task.model_names?.[i] || `模型${i + 1}`;
        const isError = output?._parseError;

        return `
            <button onclick="switchOutputGroup(${i})"
                    class="px-3 py-1 text-sm rounded ${isActive ? 'bg-blue-500 text-white' : 'bg-white border hover:bg-gray-100'}"
                    title="${isError ? '[解析失败] ' : ''}${modelName}">
                ${isComplete ? '<span class="mdi mdi-check text-green-500"></span>' : ''}
                ${isError ? '<span class="mdi mdi-alert text-amber-400"></span>' : ''}
                ${modelName}
            </button>
        `;
    }).join('') + `
        <button onclick="openModelManager()" class="px-2 py-1 text-sm text-gray-400 hover:text-gray-600" title="管理模型">
            <span class="mdi mdi-pencil-outline"></span>
        </button>
        <button onclick="toggleComparisonMode()" class="px-2.5 py-1 text-sm rounded border border-blue-200 text-blue-500 hover:bg-blue-50 hover:border-blue-400 transition-colors flex items-center gap-1" title="对比模式">
            <span class="mdi mdi-compare"></span> 对比
        </button>`;
}

// 模型管理面板
function openModelManager() {
    const task = getCurrentTask();
    if (!task || !task.model_outputs || task.model_outputs.length <= 1) return;

    // 记录原始顺序，用于检测是否有排序变化
    const origOrder = task.model_names.map((_, i) => i);

    const renderList = (names, order) => names.map((name, i) => `
        <div class="flex items-center gap-2 model-manager-row" data-order="${order[i]}" style="cursor: grab;">
            <span class="mdi mdi-drag text-gray-300 text-lg drag-handle" style="cursor: grab;"></span>
            <span class="text-xs text-gray-300 w-4 text-center model-row-number">${i + 1}</span>
            <input type="text" value="${escapeHTML(name)}" data-idx="${i}"
                   class="model-name-input flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
    `).join('');

    const html = `
    <div id="model-manager-overlay" class="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onclick="if(event.target===this)closeModelManager()">
        <div class="bg-white rounded-2xl shadow-xl w-[380px] p-5">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-bold text-gray-800">管理模型</h3>
                <button onclick="closeModelManager()" class="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
                    <span class="mdi mdi-close text-xs"></span>
                </button>
            </div>
            <div id="model-manager-list" class="space-y-2">
                ${renderList(task.model_names, origOrder)}
            </div>
            <div class="flex justify-end gap-2 mt-4">
                <button onclick="closeModelManager()" class="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">取消</button>
                <button onclick="saveModelManager()" class="px-4 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600">确认</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    const listEl = document.getElementById('model-manager-list');
    window._modelManagerSortable = new Sortable(listEl, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'opacity-30',
        chosenClass: 'sortable-chosen',
        onEnd() {
            const rows = listEl.querySelectorAll('.model-manager-row');
            const newOrder = [];
            rows.forEach((row, i) => {
                newOrder.push(parseInt(row.dataset.order));
                row.querySelector('.model-row-number').textContent = i + 1;
            });
            window._modelManagerOrder = newOrder;
        }
    });
    window._modelManagerOrder = [...origOrder];
}

function closeModelManager() {
    if (window._modelManagerSortable) {
        window._modelManagerSortable.destroy();
        delete window._modelManagerSortable;
    }
    document.getElementById('model-manager-overlay')?.remove();
    delete window._modelManagerRenderList;
    delete window._modelManagerOrder;
}

function saveModelManager() {
    const task = getCurrentTask();
    if (!task) return;

    const list = document.getElementById('model-manager-list');
    const inputs = list.querySelectorAll('.model-name-input');
    const order = window._modelManagerOrder;
    const newNames = Array.from(inputs).map(inp => inp.value.trim());

    // 检查是否有排序变化
    const hasReorder = order.some((origIdx, i) => origIdx !== i);

    if (hasReorder) {
        // 按新顺序重排所有并行数组
        const reorder = (arr) => {
            if (!arr || !Array.isArray(arr)) return arr;
            return order.map(origIdx => arr[origIdx]);
        };
        task.model_outputs = reorder(task.model_outputs);
        task.reviews = reorder(task.reviews);
        task.profileReviews = reorder(task.profileReviews);
        task.audiovisualReviews = reorder(task.audiovisualReviews);
        task.model_output = task.model_outputs[0] || {};
        state.currentOutputGroup = 0;
    }

    // 更新名称（用重排后的新名称）
    task.model_names = newNames;

    saveToLocalStorage();
    closeModelManager();

    // 刷新 UI
    renderOutputGroupSwitcher(task);
    updateModelOutput();
    if (state.reviewMode === 'segment') {
        switchTab(state.currentTab);
    } else if (state.reviewMode === 'audiovisual') {
        renderAudiovisualContent();
    } else {
        renderProfileContent();
    }
    renderTimeline();
    updateUI();
}

// 切换数据组
function switchOutputGroup(groupIndex) {
    const task = getCurrentTask();
    if (!task || groupIndex < 0 || groupIndex >= (task.model_outputs?.length || 0)) return;
    
    // 保存当前组的评分
    saveReviewForCurrentGroup();
    
    // 切换到新组
    state.currentOutputGroup = groupIndex;
    
    // 加载新组的评分
    loadReviewForCurrentGroup();
    
    // 更新model_output指向当前组
    updateModelOutput();
    
    // 更新切换器按钮样式
    renderOutputGroupSwitcher(task);
    
    // 重新渲染内容
    renderTimeline();
    
    // 根据当前模式渲染对应内容
    if (state.reviewMode === 'segment') {
        switchTab(state.currentTab);
    } else if (state.reviewMode === 'audiovisual') {
        renderAudiovisualContent();
    } else {
        renderProfileContent();
    }
}

// 更新 model_output 指向当前选中的数据组
function updateModelOutput() {
    const task = getCurrentTask();
    if (!task) return;
    
    if (task.model_outputs && task.model_outputs.length > 0) {
        task.model_output = task.model_outputs[state.currentOutputGroup] || {};
    }
}

// 保存当前数据组的评分（基础实现，后续被各模式重写覆盖）
function saveReviewForCurrentGroup() {
    const task = getCurrentTask();
    if (!task) return;

    ['time', 'text', 'visual', 'keyframe'].forEach(dim => {
        const noteInput = document.getElementById(`note-${dim}`);
        if (noteInput) state.notes[dim] = noteInput.value;
    });

    if (!task.reviews) {
        task.reviews = task.model_outputs?.map(() => null) || [null];
    }

    task.reviews[state.currentOutputGroup] = {
        ratings: { ...state.ratings },
        notes: { ...state.notes },
        completed: Object.values(state.ratings).some(r => r > 0),
        timestamp: new Date().toISOString()
    };
}

// 加载当前数据组的评分（基础实现，后续被各模式重写覆盖）
function loadReviewForCurrentGroup() {
    const task = getCurrentTask();
    if (!task) return;

    const review = task.reviews?.[state.currentOutputGroup];

    if (review) {
        state.ratings = { ...review.ratings };
        state.notes = { ...review.notes };
        Object.keys(state.ratings).forEach(dim => {
            const group = document.querySelector(`.rating-group[data-dimension="${dim}"]`);
            if (group) highlightStars(group, state.ratings[dim]);
            const noteInput = document.getElementById(`note-${dim}`);
            if (noteInput) noteInput.value = state.notes[dim] || '';
        });
    } else {
        resetRatings();
    }
}

function submitReview() {
    const task = getCurrentTask();
    if (!task) return;

    // 保存当前数据组的评分
    saveReviewForCurrentGroup();

    // 更新切换器显示（显示已完成状态）
    renderOutputGroupSwitcher(task);

    // 根据模式确定使用哪个 reviews 数组和 review 标记
    const reviewsKey = state.reviewMode === 'segment' ? 'reviews'
        : state.reviewMode === 'audiovisual' ? 'audiovisualReviews'
        : 'profileReviews';
    const reviewKey = state.reviewMode === 'segment' ? 'review'
        : state.reviewMode === 'audiovisual' ? 'audiovisualReview'
        : 'profileReview';

    // 检查是否有多组数据
    const groupCount = task.model_outputs?.length || 1;

    if (groupCount > 1) {
        const nextIncompleteGroup = task[reviewsKey]?.findIndex((r, i) => i > state.currentOutputGroup && !r?.completed);

        if (nextIncompleteGroup !== -1) {
            switchOutputGroup(nextIncompleteGroup);
            return;
        }

        const allGroupsComplete = task[reviewsKey]?.every(r => r?.completed);
        if (allGroupsComplete) {
            task[reviewKey] = {
                completed: true,
                timestamp: new Date().toISOString()
            };
        }
    } else {
        // 单组数据，直接标记完成
        if (state.reviewMode === 'segment') {
            task.review = {
                ratings: { ...state.ratings },
                notes: { ...state.notes },
                completed: true,
                timestamp: new Date().toISOString()
            };
        } else if (state.reviewMode === 'audiovisual') {
            task.audiovisualReview = {
                ratings: { ...state.audiovisualRatings },
                notes: { ...state.audiovisualNotes },
                completed: true,
                timestamp: new Date().toISOString()
            };
        } else {
            task.profileReview = {
                ratings: { ...state.profileRatings },
                notes: { ...state.profileNotes },
                completed: true,
                timestamp: new Date().toISOString()
            };
        }
    }

    saveToLocalStorage();
    updateUI();

    // 跳转到下一个未完成的任务
    goToNextIncomplete();
}

function skipTask() {
    goToNextIncomplete();
}

function goToNextIncomplete() {
    const tasks = getTasks();
    const startIndex = getTaskIndex();
    if (tasks.length === 0) return;

    const getComplete = (t) => state.reviewMode === 'segment' ? t.review?.completed
        : state.reviewMode === 'audiovisual' ? t.audiovisualReview?.completed
        : t.profileReview?.completed;

    let nextIndex = (startIndex + 1) % tasks.length;

    while (nextIndex !== startIndex) {
        if (!getComplete(tasks[nextIndex])) {
            selectTask(nextIndex);
            return;
        }
        nextIndex = (nextIndex + 1) % tasks.length;
    }

    // 所有任务都完成了
    if (getComplete(tasks[startIndex])) {
        alert('🎉 当前模式所有任务已完成！');
    }
}

function onTaskSearch(value, clear = false) {
    const input = document.getElementById('task-search-input');
    const clearBtn = document.getElementById('task-search-clear');
    if (clear) { input.value = ''; value = ''; }
    state.taskSearch = value.trim();
    clearBtn?.classList.toggle('hidden', !state.taskSearch);

    document.querySelectorAll('.task-item.search-highlight')
        .forEach(el => el.classList.remove('search-highlight'));

    if (!state.taskSearch) return;

    const q = state.taskSearch.toLowerCase();
    const tasks = getTasks();
    const matchIndex = tasks.findIndex((task, i) =>
        String(i + 1) === q
        || (task.id || '').toLowerCase().includes(q)
        || (task.rawId || '').toLowerCase().includes(q)
    );
    if (matchIndex === -1) return;

    const items = document.querySelectorAll('.task-item');
    const el = items[matchIndex];
    if (el) {
        selectTask(matchIndex);
        el.classList.add('search-highlight');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function renderTaskList() {
    const tasks = getTasks();
    const currentIndex = getTaskIndex();
    
    if (tasks.length === 0) {
        elements.taskList.innerHTML = `
            <div class="p-8 text-center text-gray-400">
                <span class="mdi mdi-inbox-outline text-4xl"></span>
                <p class="mt-2">暂无任务</p>
                <p class="text-sm">点击"导入"添加任务</p>
            </div>`;
        return;
    }

    elements.taskList.innerHTML = tasks.map((task, index) => {
        // 根据当前模式判断完成状态
        const isComplete = state.reviewMode === 'segment' ? task.review?.completed
            : state.reviewMode === 'audiovisual' ? task.audiovisualReview?.completed
            : task.profileReview?.completed;
        const isActive = index === currentIndex;

        // 根据模式计算平均评分
        let avgRating = '-';
        if (state.reviewMode === 'segment' && task.review?.ratings) {
            avgRating = (Object.values(task.review.ratings).reduce((a, b) => a + b, 0) / 4).toFixed(1);
        } else if (state.reviewMode === 'profile' && task.profileReview?.ratings) {
            const ratings = Object.values(task.profileReview.ratings).filter(r => r >= 0);
            if (ratings.length > 0) {
                avgRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
            }
        } else if (state.reviewMode === 'audiovisual' && task.audiovisualReview?.ratings) {
            const ratings = Object.values(task.audiovisualReview.ratings).filter(r => r >= 0);
            if (ratings.length > 0) {
                avgRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
            }
        }

        const displayName = task.id || task.rawId || ('任务 ' + (index + 1));
        const hasParseError = task.model_outputs?.some(o => o?._parseError);

        return `
            <div class="task-item p-3 border-b cursor-pointer ${isActive ? 'active' : ''}"
                 onclick="selectTask(${index})">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <span class="mdi ${isComplete ? 'mdi-check-circle text-green-500' : 'mdi-circle-outline text-gray-300'} mr-2"></span>
                        <span class="text-sm font-medium truncate max-w-[150px] instant-tip" data-tip="${escapeHTML(displayName)}">${escapeHTML(displayName)}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        ${hasParseError ? `<span class="mdi mdi-alert text-amber-400 text-sm" title="部分模型输出 JSON 解析失败"></span>` : ''}
                        ${isComplete ? `<span class="text-xs text-yellow-500"><span class="mdi mdi-star"></span> ${avgRating}</span>` : ''}
                    </div>
                </div>
                <div class="text-xs text-gray-400 mt-1 truncate">${task.video_url}</div>
            </div>`;
    }).join('');
}

function updateProgress() {
    const tasks = getTasks();
    const total = tasks.length;
    // 根据当前模式判断完成状态
    const completed = tasks.filter(t => {
        if (state.reviewMode === 'segment') return t.review?.completed;
        if (state.reviewMode === 'audiovisual') return t.audiovisualReview?.completed;
        return t.profileReview?.completed;
    }).length;
    const percent = total > 0 ? (completed / total) * 100 : 0;

    if (elements.progressBar) elements.progressBar.style.width = `${percent}%`;
    if (elements.progressText) elements.progressText.textContent = `${completed}/${total}`;
    if (elements.completedCount) elements.completedCount.textContent = completed;
    if (elements.pendingCount) elements.pendingCount.textContent = total - completed;
}

function updateUI() {
    renderTaskList();
    updateProgress();
    updateParseErrorBanner();
}

// ============================================
// 导入/导出
// ============================================
function importTasks() {
    // 清空已选文件列表
    state._pendingFiles = [];
    renderPendingFileList();
    document.getElementById('import-file').value = '';
    document.getElementById('import-modal').classList.remove('hidden');
    document.getElementById('import-modal').classList.add('flex');
}

function closeImportModal() {
    state._pendingFiles = [];
    document.getElementById('import-modal').classList.add('hidden');
    document.getElementById('import-modal').classList.remove('flex');
}

// 文件选择回调：累积添加文件
function onImportFileChange(input) {
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
function renderPendingFileList() {
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
function removePendingFile(index) {
    if (state._pendingFiles) {
        state._pendingFiles.splice(index, 1);
        renderPendingFileList();
    }
}
window.removePendingFile = removePendingFile;

function confirmImport() {
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
function importMultipleJsonl(files) {
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
function parseJsonl(content) {
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


// 判断是否是内网 HTTP URL
function isIntranetHttp(url) {
    return /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|localhost)/i.test(url);
}

// 将 HTTP URL 升级为 HTTPS，但私有/内网 IP 地址跳过
function safeUpgradeToHttps(url) {
    if (!url || !url.startsWith('http://')) return url;
    if (isIntranetHttp(url)) return url;
    return url.replace(/^http:\/\//i, 'https://');
}

// 将 JSONL 对象转换为任务格式
function convertJsonlToTask(obj, index) {
    const rawId = obj.data_id || obj.nid || `task-${index + 1}`;
    const titleFromInput = (obj['input文本'] || obj.input || '')
        .match(/-\s*标题[：:]\s*(.+)/)?.[1]?.trim() || '';
    const title = obj.title || obj.video_title || obj.name || titleFromInput || '';
    const task = {
        id: title || rawId,
        rawId: rawId,
        video_url: safeUpgradeToHttps((obj.videos && obj.videos[0]) || obj.video_url || ''),
        video_duration: obj.video_duration ? parseInt(obj.video_duration) : null
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

    // 解包 {"audiovisual": {...}} 外层包装
    if (!response.vision_quality && !response.audiovisual_integration &&
        !response.visual_integration && !response.content_subject && response.audiovisual) {
        const inner = response.audiovisual;
        if (inner && (inner.vision_quality || inner.audiovisual_integration ||
                      inner.visual_integration || inner.content_subject)) {
            response = inner;
        }
    }
    // 检测是否为基础音画质量格式
    if (response.vision_quality || response.audiovisual_integration || response.visual_integration || response.content_subject) {
        const avOutput = { audiovisual: response };
        if (rawResponseStr) avOutput._raw = rawResponseStr;
        if (obj.cot) avOutput._raw = (avOutput._raw || '') + '\n\n--- COT ---\n\n' + obj.cot;
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
    if (rawResponseStr) output._raw = rawResponseStr;
    if (obj.cot) output._raw = (output._raw || '') + '\n\n--- COT ---\n\n' + obj.cot;
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
function mergeJsonlTasks(fileResults) {
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
function stripUrlQuery(url) {
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

function mergeTasksByKey(tasks) {
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
function repairTruncatedJson(s) {
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

function pythonDictToJson(s) {
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

function quickParseJson(str) {
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
function extractJsonFromCot(cot) {
    if (!cot || typeof cot !== 'string') return null;
    return quickParseJson(cot.trim());
}



function parseJsonCell(cellValue, taskIndex, colIndex) {
    if (!cellValue) return null;
    if (typeof cellValue === 'object' && cellValue !== null) return normalizeModelOutput(cellValue);

    const str = cellValue.toString().replace(/^\uFEFF/, '').trim();
    if (!str) return null;

    const parsed = quickParseJson(str);
    if (parsed !== null) {
        const result = normalizeModelOutput(parsed);
        if (str) result._raw = str;
        return result;
    }

    // 无法解析 → _parseError，交 LLM 修复
    console.warn(`任务 ${taskIndex + 1} 第${colIndex}列 JSON解析失败，需 LLM 修复`);
    return { _parseError: true, raw: str.slice(0, 8000) };
}


// 从Excel单元格提取URL（处理超链接格式）
function extractUrlFromCell(worksheet, cellAddress) {
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
function parseExcel(arrayBuffer) {
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
            || /^<(?:think|thinking|reasoning|thought|json_output|output)/i.test(firstVal);
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

        obj.video_url = safeUpgradeToHttps(videoUrl);

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
function convertSegmentArray(segmentArray) {
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
function normalizeModelOutput(data) {
    const output = {};
    
    // 处理分段语义详情
    // 情况1：直接是数组（segment_detail内容）
    if (Array.isArray(data)) {
        output.segments = convertSegmentArray(data);
        return output;
    }
    
    // 情况2：有 segment_detail 或 segment_output 字段
    if (data.segment_detail && Array.isArray(data.segment_detail)) {
        output.segments = convertSegmentArray(data.segment_detail);
    } else if (data.segment_output && Array.isArray(data.segment_output)) {
        output.segments = convertSegmentArray(data.segment_output);
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
    // 支持 audiovisual_integration 和 visual_integration 两种字段名
    if (data.vision_quality || data.audiovisual_integration || data.visual_integration || data.content_subject) {
        output.audiovisual = data;
    }

    // 如果解析出了任何有效数据，返回 output；否则返回原数据
    if (output.segments || output.profile || output.audiovisual) {
        return output;
    }

    return data;
}

function processImportData(data) {
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

// 清空当前模式的任务
function clearAllTasks() {
    const tasks = getTasks();
    const modeName = ({ segment: '分段语义详情', profile: '全篇语义画像', audiovisual: '基础音画质量' })[state.reviewMode] || state.reviewMode;

    if (tasks.length === 0) {
        alert(`「${modeName}」任务列表已为空`);
        return;
    }
    
    if (!confirm(`确定要清空「${modeName}」的所有任务吗？此操作不可恢复！`)) {
        return;
    }
    
    // 重置当前模式的状态
    if (state.reviewMode === 'segment') {
        state.segmentTasks = [];
        state.segmentTaskIndex = -1;
        resetRatings();
    } else if (state.reviewMode === 'audiovisual') {
        state.audiovisualTasks = [];
        state.audiovisualTaskIndex = -1;
        resetAudiovisualRatings();
    } else {
        state.profileTasks = [];
        state.profileTaskIndex = -1;
        resetProfileRatings();
    }
    
    saveToLocalStorage();
    
    // 更新UI
    updateUI();
    
    // 隐藏工作区，显示空状态
    document.getElementById('review-workspace').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
    const taskLabelClear = document.getElementById('current-task-label');
    if (taskLabelClear) {
        taskLabelClear.classList.add('hidden');
        const inner = taskLabelClear.querySelector('div');
        if (inner) inner.textContent = '';
    }
    
    // 清空视频
    elements.videoPlayer.src = '';
    
    alert(`「${modeName}」任务列表已清空`);
}

function exportResults() {
    if (state.tasks.length === 0) {
        alert('暂无可导出的数据');
        return;
    }

    // 构建导出数据 - 支持多组数据
    const exportData = [];
    
    state.tasks.forEach(task => {
        const groupCount = task.model_outputs?.length || 1;
        
        // 如果有多组数据，每组数据一行
        if (groupCount > 1 && task.reviews) {
            task.reviews.forEach((review, groupIndex) => {
                const ratings = review?.ratings || {};
                const notes = review?.notes || {};
                const modelName = task.model_names?.[groupIndex] || `模型${groupIndex + 1}`;
                
                exportData.push({
                    '任务ID': task.id || '',
                    '视频URL': task.video_url || '',
                    '模型名称': modelName,
                    '状态': review?.completed ? '已完成' : '未完成',
                    '时间段切分评分': ratings.time || 0,
                    '时间段切分备注': notes.time || '',
                    '文本理解评分': ratings.text || 0,
                    '文本理解备注': notes.text || '',
                    '视觉理解评分': ratings.visual || 0,
                    '视觉理解备注': notes.visual || '',
                    '关键帧评分': ratings.keyframe || 0,
                    '关键帧备注': notes.keyframe || '',
                    '完成时间': review?.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
                });
            });
        } else {
            // 单组数据或旧格式
            const review = task.reviews?.[0] || task.review || {};
            const ratings = review.ratings || {};
            const notes = review.notes || {};
            const modelName = task.model_names?.[0] || '-';
            
            exportData.push({
                '任务ID': task.id || '',
                '视频URL': task.video_url || '',
                '模型名称': modelName,
                '状态': review.completed ? '已完成' : '未完成',
                '时间段切分评分': ratings.time || 0,
                '时间段切分备注': notes.time || '',
                '文本理解评分': ratings.text || 0,
                '文本理解备注': notes.text || '',
                '视觉理解评分': ratings.visual || 0,
                '视觉理解备注': notes.visual || '',
                '关键帧评分': ratings.keyframe || 0,
                '关键帧备注': notes.keyframe || '',
                '完成时间': review.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
            });
        }
    });

    // 使用 SheetJS 创建工作簿
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // 设置列宽
    worksheet['!cols'] = [
        { wch: 10 },  // 任务ID
        { wch: 50 },  // 视频URL
        { wch: 10 },  // 数据组
        { wch: 8 },   // 状态
        { wch: 14 },  // 时间段切分评分
        { wch: 20 },  // 时间段切分备注
        { wch: 12 },  // 文本理解评分
        { wch: 20 },  // 文本理解备注
        { wch: 12 },  // 视觉理解评分
        { wch: 20 },  // 视觉理解备注
        { wch: 10 },  // 关键帧评分
        { wch: 20 },  // 关键帧备注
        { wch: 20 }   // 完成时间
    ];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '标注结果');
    
    // 导出文件
    const filename = `标注结果-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
}

// ============================================
// 本地存储
// ============================================
function saveToLocalStorage() {
    const wsId = state.currentWorkspaceId;
    if (!wsId) return;
    localStorage.setItem(getWorkspaceKey(wsId, 'segment-tasks'), JSON.stringify(state.segmentTasks));
    localStorage.setItem(getWorkspaceKey(wsId, 'segment-index'), state.segmentTaskIndex);
    localStorage.setItem(getWorkspaceKey(wsId, 'profile-tasks'), JSON.stringify(state.profileTasks));
    localStorage.setItem(getWorkspaceKey(wsId, 'profile-index'), state.profileTaskIndex);
    localStorage.setItem(getWorkspaceKey(wsId, 'audiovisual-tasks'), JSON.stringify(state.audiovisualTasks));
    localStorage.setItem(getWorkspaceKey(wsId, 'audiovisual-index'), state.audiovisualTaskIndex);
}

function loadFromLocalStorage() {
    const wsId = state.currentWorkspaceId;
    if (!wsId) return;
    try {
        const segmentTasks = localStorage.getItem(getWorkspaceKey(wsId, 'segment-tasks'));
        const segmentIndex = localStorage.getItem(getWorkspaceKey(wsId, 'segment-index'));
        if (segmentTasks) {
            state.segmentTasks = JSON.parse(segmentTasks);
        }
        if (segmentIndex !== null) {
            state.segmentTaskIndex = parseInt(segmentIndex);
        }

        const profileTasks = localStorage.getItem(getWorkspaceKey(wsId, 'profile-tasks'));
        const profileIndex = localStorage.getItem(getWorkspaceKey(wsId, 'profile-index'));
        if (profileTasks) {
            state.profileTasks = JSON.parse(profileTasks);
        }
        if (profileIndex !== null) {
            state.profileTaskIndex = parseInt(profileIndex);
        }

        const audiovisualTasks = localStorage.getItem(getWorkspaceKey(wsId, 'audiovisual-tasks'));
        const audiovisualIndex = localStorage.getItem(getWorkspaceKey(wsId, 'audiovisual-index'));
        if (audiovisualTasks) {
            state.audiovisualTasks = JSON.parse(audiovisualTasks);
        }
        if (audiovisualIndex !== null) {
            state.audiovisualTaskIndex = parseInt(audiovisualIndex);
        }

        setTimeout(() => {
            const currentTasks = getTasks();
            const currentIndex = getTaskIndex();
            if (currentIndex >= 0 && currentIndex < currentTasks.length) {
                selectTask(currentIndex);
            }
        }, 150);
    } catch (e) {
        console.error('加载本地存储失败:', e);
    }
}

// ============================================
// 帮助
// ============================================
function showHelp() {
    document.getElementById('help-modal').classList.remove('hidden');
    document.getElementById('help-modal').classList.add('flex');
}

function closeHelpModal() {
    document.getElementById('help-modal').classList.add('hidden');
    document.getElementById('help-modal').classList.remove('flex');
}

function showFormatHelp() {
    closeImportModal();
    showHelp();
}

// ============================================
// 侧边栏折叠
// ============================================
function toggleSidebar() {
    const sidebar = document.getElementById('task-sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    
    sidebar.classList.toggle('collapsed');
    toggleBtn.classList.toggle('collapsed');
    
    // 保存状态到本地存储
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed);
}

// 初始化时恢复侧边栏状态
function restoreSidebarState() {
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed) {
        document.getElementById('task-sidebar').classList.add('collapsed');
        document.getElementById('sidebar-toggle').classList.add('collapsed');
    }
}

// ============================================
// 评分面板折叠 (Floating Sheet Logic)
// ============================================
function toggleRatingPanel() {
    const section = document.getElementById('rating-section');
    const icon = document.getElementById('rating-toggle-icon');
    
    // Check if currently expanded (translated to 0)
    // The default class has translate-y-[calc(100%-80px)] which means collapsed
    // We toggle a class 'expanded' which sets translate-y-0
    
    const isExpanded = section.classList.contains('expanded');
    
    if (isExpanded) {
        // Collapse
        section.classList.remove('expanded');
        section.classList.remove('translate-y-0');
        section.classList.add('translate-y-[calc(100%-80px)]');
        
        icon.style.transform = 'rotate(0deg)'; // Arrow points up (to expand)
        localStorage.setItem('rating-panel-collapsed', 'true');
    } else {
        // Expand
        section.classList.add('expanded');
        section.classList.remove('translate-y-[calc(100%-80px)]');
        section.classList.add('translate-y-0');
        
        icon.style.transform = 'rotate(180deg)'; // Arrow points down (to collapse)
        localStorage.setItem('rating-panel-collapsed', 'false');
    }
}

// 初始化时恢复评分面板状态
function restoreRatingPanelState() {
    const isCollapsed = localStorage.getItem('rating-panel-collapsed') === 'true';
    const section = document.getElementById('rating-section');
    const icon = document.getElementById('rating-toggle-icon');
    
    if (!section) return;

    if (isCollapsed) {
        section.classList.remove('expanded');
        section.classList.remove('translate-y-0');
        section.classList.add('translate-y-[calc(100%-80px)]');
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        section.classList.add('expanded');
        section.classList.remove('translate-y-[calc(100%-80px)]');
        section.classList.add('translate-y-0');
        if (icon) icon.style.transform = 'rotate(180deg)';
    }
}

// ============================================
// 键盘快捷键
// ============================================
function handleKeyboard(e) {
    // 忽略输入框内的按键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            togglePlay();
            break;
        case 'ArrowLeft':
            seekRelative(-5);
            break;
        case 'ArrowRight':
            seekRelative(5);
            break;
        case 'Enter':
            submitReview();
            break;
        case 'Tab':
            e.preventDefault();
            const tabs = ['text', 'visual', 'keyframe'];
            const currentIndex = tabs.indexOf(state.currentTab);
            const nextIndex = (currentIndex + 1) % tabs.length;
            switchTab(tabs[nextIndex]);
            break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
            // 1-3分评分
            const rating = parseInt(e.code.replace('Digit', ''));
            setRating(state.currentTab, rating);
            break;
    }
}

// ============================================
// 示例数据（用于演示）
// ============================================
function loadDemoData() {
    const demoTasks = [
        {
            id: "demo-001",
            video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
            model_output: {
                segments: [
                    { start: 0, end: 3, label: "开场", description: "大象出现" },
                    { start: 3, end: 7, label: "主体", description: "兔子和小鸟互动" },
                    { start: 7, end: 10, label: "结尾", description: "场景结束" }
                ],
                text_understanding: {
                    summary: "这是一个卡通动画短片",
                    entities: ["大象", "兔子", "小鸟"],
                    sentiment: "positive",
                    themes: ["友谊", "自然"]
                },
                visual_understanding: {
                    scene_type: "户外自然场景",
                    objects_detected: ["大象", "兔子", "蝴蝶", "树木", "草地"],
                    color_palette: ["绿色", "蓝色", "棕色"],
                    motion_intensity: "medium"
                },
                keyframes: [
                    { time: 1, label: "大象特写" },
                    { time: 5, label: "兔子出场" },
                    { time: 9, label: "结束画面" }
                ]
            }
        },
        {
            id: "demo-002", 
            video_url: "https://www.w3schools.com/html/movie.mp4",
            model_output: {
                segments: [
                    { start: 0, end: 6, label: "完整片段", description: "Bear介绍" }
                ],
                text_understanding: {
                    summary: "Big Buck Bunny 片段",
                    entities: ["Bear"],
                    sentiment: "neutral"
                },
                visual_understanding: {
                    scene_type: "动画场景",
                    objects_detected: ["熊"],
                    color_palette: ["棕色", "绿色"]
                },
                keyframes: [
                    { time: 3, label: "主画面" }
                ]
            }
        }
    ];

    processImportData(demoTasks);
}

// 在控制台暴露demo函数方便测试
window.loadDemoData = loadDemoData;

// ============================================
// 审核模式切换（分段语义详情 / 全篇语义画像）
// ============================================
function switchReviewMode(mode) {
    if (mode !== 'segment' && mode !== 'profile' && mode !== 'audiovisual') return;

    // 退出对比模式
    if (state.comparisonMode) exitComparisonMode();

    state.reviewMode = mode;
    if (state.currentWorkspaceId) {
        localStorage.setItem(getWorkspaceKey(state.currentWorkspaceId, 'review-mode'), mode);
    }

    // 更新模式按钮样式 (iOS Segmented Control Style)
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`mode-${mode}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 切换内容和评分面板
    const segmentContent = document.getElementById('segment-mode-content');
    const profileContent = document.getElementById('profile-mode-content');
    const audiovisualContent = document.getElementById('audiovisual-mode-content');
    const segmentRating = document.getElementById('segment-rating-panel');
    const profileRating = document.getElementById('profile-rating-panel');
    const audiovisualRating = document.getElementById('audiovisual-rating-panel');
    const segmentDock = document.getElementById('segment-rating-dock');
    const profileDock = document.getElementById('profile-rating-dock');
    const audiovisualDock = document.getElementById('audiovisual-rating-dock');

    // 先全部隐藏
    [segmentContent, profileContent, audiovisualContent,
     segmentRating, profileRating, audiovisualRating,
     segmentDock, profileDock, audiovisualDock].forEach(el => el?.classList.add('hidden'));

    // 显示当前模式
    if (mode === 'segment') {
        segmentContent?.classList.remove('hidden');
        segmentRating?.classList.remove('hidden');
        segmentDock?.classList.remove('hidden');
    } else if (mode === 'profile') {
        profileContent?.classList.remove('hidden');
        profileRating?.classList.remove('hidden');
        profileDock?.classList.remove('hidden');
    } else {
        audiovisualContent?.classList.remove('hidden');
        audiovisualRating?.classList.remove('hidden');
        audiovisualDock?.classList.remove('hidden');
    }

    // 刷新任务列表和进度（切换模式后显示对应模式的任务）
    updateUI();

    // 恢复当前模式的任务选中状态
    const tasks = getTasks();
    const index = getTaskIndex();

    if (tasks.length === 0) {
        // 当前模式无任务，显示空状态
        document.getElementById('review-workspace').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        const taskLabelMode = document.getElementById('current-task-label');
        if (taskLabelMode) {
            taskLabelMode.classList.add('hidden');
            const inner = taskLabelMode.querySelector('div');
            if (inner) inner.textContent = '';
        }
        elements.videoPlayer.src = '';
    } else if (index >= 0 && index < tasks.length) {
        // 有任务且已选中，恢复选中状态
        selectTask(index);
        if (mode === 'segment') {
            switchTab(state.currentTab);
        } else if (mode === 'profile') {
            renderProfileContent();
        } else {
            renderAudiovisualContent();
        }
    } else {
        // 有任务但未选中，选中第一个
        selectTask(0);
        if (mode === 'segment') {
            switchTab(state.currentTab);
        } else if (mode === 'profile') {
            renderProfileContent();
        } else {
            renderAudiovisualContent();
        }
    }
}

function restoreReviewMode() {
    let savedMode = 'segment';
    if (state.currentWorkspaceId) {
        savedMode = localStorage.getItem(getWorkspaceKey(state.currentWorkspaceId, 'review-mode')) || 'segment';
    }
    switchReviewMode(savedMode);
}

// 渲染全篇语义画像内容
function renderProfileContent() {
    const container = document.getElementById('profile-content');
    const task = getCurrentTask();
    
    if (!task || !container) {
        if (container) {
            container.innerHTML = '<div class="text-gray-400 text-center py-8">请先选择任务</div>';
        }
        return;
    }
    
    // 获取当前数据组的 profile 数据
    const currentOutput = task.model_outputs?.[state.currentOutputGroup] || task.model_output;
    if (currentOutput?._parseError) {
        renderRawContent(currentOutput, 'profile-content');
        return;
    }
    const profileData = currentOutput?.profile || null;
    
    if (!profileData) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">暂无全篇语义画像数据</div>';
        return;
    }
    
    // 构建展示内容
    const sections = [];
    
    // 叙事类型
    if (profileData.narrative_type) {
        sections.push(renderProfileSection('叙事类型', 'mdi-book-open-variant', 'blue', 
            profileData.narrative_type.tag, profileData.narrative_type.reason));
    }
    
    // 画面类型
    if (profileData.visual_type) {
        const visualTag = typeof profileData.visual_type === 'object' 
            ? `主要: ${profileData.visual_type['主要画面类型'] || profileData.visual_type.main || '-'}, 次要: ${profileData.visual_type['次要画面类型'] || profileData.visual_type.secondary || '-'}`
            : profileData.visual_type;
        sections.push(renderProfileSection('画面类型', 'mdi-image', 'green', visualTag, null));
    }
    
    // 内容总结
    if (profileData.summary) {
        sections.push(renderProfileSection('内容总结', 'mdi-text-box', 'purple', null, profileData.summary));
    }
    
    // 创作意图
    if (profileData.intent_type) {
        sections.push(renderProfileSection('创作意图', 'mdi-target', 'orange', 
            profileData.intent_type.tag, profileData.intent_type.reason));
    }
    
    // 主题一致性
    if (profileData.topic_consistency) {
        sections.push(renderProfileSection('主题一致性', 'mdi-bullseye-arrow', 'teal', 
            profileData.topic_consistency.tag, profileData.topic_consistency.reason));
    }
    
    // 核心观点
    if (profileData.core_claim) {
        const claims = Array.isArray(profileData.core_claim) 
            ? profileData.core_claim.join('；') 
            : profileData.core_claim;
        sections.push(renderProfileSection('核心观点', 'mdi-lightbulb', 'yellow', null, claims));
    }
    
    // 情感类型
    if (profileData.emotion_type) {
        sections.push(renderProfileSection('情感类型', 'mdi-emoticon', 'pink', 
            profileData.emotion_type.tag, profileData.emotion_type.reason));
    }
    
    container.innerHTML = sections.length > 0
        ? sections.join('')
        : '<div class="text-gray-400 text-center py-8">暂无全篇语义画像数据</div>';
    container.innerHTML += `
        <details class="mt-6">
            <summary class="text-xs text-gray-400 cursor-pointer select-none hover:text-gray-600 py-1">查看原文</summary>
            <div id="profile-raw-inline" class="mt-2"></div>
        </details>`;
    renderRawContent(currentOutput, 'profile-raw-inline');
}

// Ive Style: Unified Gray Profile Section - No colorful backgrounds
function renderProfileSection(title, icon, color, tag, content) {
    return `
        <div class="p-4 rounded-2xl bg-black/[0.03] hover:bg-black/[0.05] transition-all duration-200">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <span class="mdi ${icon} text-gray-400 text-lg"></span>
                    <span class="text-xs font-semibold text-gray-800 uppercase tracking-wide">${title}</span>
                </div>
                ${tag ? `<span class="px-2.5 py-1 bg-black text-white text-[11px] font-medium rounded-full">${escapeHTML(tag)}</span>` : ''}
            </div>
            ${content ? `<p class="text-[15px] text-gray-700 leading-relaxed">${escapeHTML(content)}</p>` : ''}
        </div>
    `;
}

// ============================================
// 基础音画质量内容渲染
// ============================================
function renderAudiovisualContent() {
    const container = document.getElementById('audiovisual-content');
    const task = getCurrentTask();

    if (!task || !container) {
        if (container) container.innerHTML = '<div class="text-gray-400 text-center py-8">请先选择任务</div>';
        return;
    }

    const currentOutput = task.model_outputs?.[state.currentOutputGroup] || task.model_output;
    if (currentOutput?._parseError) {
        renderRawContent(currentOutput, 'audiovisual-content');
        return;
    }
    const avData = currentOutput?.audiovisual || null;

    if (!avData) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">暂无基础音画质量数据</div>';
        return;
    }

    const sections = [];
    const ev = task.autoEval || null; // 自动评估数据

    // 从评估数据中提取维度信息的辅助函数
    function getEval(obj) {
        if (!obj) return null;
        // 支持对象或数组中第一个元素
        const d = Array.isArray(obj) ? obj[0] : obj;
        if (!d || (d['得分'] == null && d['理由'] == null)) return null;
        return {
            score: d['得分'] ?? null,
            reason: d['理由'] || '',
            timeScore: d['time得分'] ?? null,
            timeReason: d['time理由'] || ''
        };
    }

    // 总体评估摘要
    if (ev && (ev['总体评分'] || ev['总体评价'])) {
        const summary = (ev['总体评分'] ? `<b>${escapeHTML(ev['总体评分'])}</b> ` : '') + (ev['总体评价'] ? escapeHTML(ev['总体评价']) : '');
        sections.push(`<div class="p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800 leading-relaxed">
            <span class="text-[10px] font-bold text-blue-400 uppercase mr-1">自动评估总结</span>${summary}
        </div>`);
    }

    // 1. 总体质量
    // 支持 audiovisual_integration 和 visual_integration 两种字段名
    const avIntegration = avData.audiovisual_integration || avData.visual_integration;
    if (avIntegration?.detail_quality) {
        const dq = avIntegration.detail_quality;
        sections.push(renderAVSection('总体质量', 'mdi-tune-variant', dq.level, dq.desc, false,
            getEval(ev?.audiovisual_integration?.detail_quality || ev?.visual_integration?.detail_quality)));
    } else {
        sections.push(renderAVSection('总体质量', 'mdi-tune-variant', '无', null, false,
            getEval(ev?.audiovisual_integration?.detail_quality || ev?.visual_integration?.detail_quality)));
    }

    // 2. 加工元素
    const vpe = avData.vision_quality?.visual_processing_elements;
    if (vpe && vpe.length > 0) {
        const items = vpe.map(el => {
            const timeStr = Array.isArray(el.time) ? `${formatTimeLink(el.time[0])}→${formatTimeLink(el.time[1])}` : '';
            return `<b>${escapeHTML(el.tag || '-')}</b>：${linkifyTime(escapeHTML(el.desc || ''))}` +
                (el.position ? ` <span class="text-gray-400">[${escapeHTML(el.position)}${el.area_ratio ? ', ' + escapeHTML(el.area_ratio) : ''}]</span>` : '') +
                (timeStr ? ` <span class="text-gray-400 font-mono text-[11px]">${timeStr}</span>` : '');
        }).join('<br>');
        sections.push(renderAVSection('加工元素', 'mdi-image-filter-center-focus', null, items, true,
            getEval(ev?.vision_quality?.visual_processing_elements)));
    } else {
        sections.push(renderAVSection('加工元素', 'mdi-image-filter-center-focus', '无', null, false,
            getEval(ev?.vision_quality?.visual_processing_elements)));
    }

    // 3. 构图
    const comp = avData.vision_quality?.composition;
    if (comp && comp.length > 0) {
        const items = comp.map(el => {
            const timeStr = Array.isArray(el.time) ? `${formatTimeLink(el.time[0])}→${formatTimeLink(el.time[1])}` : '';
            return `<b>${escapeHTML(el.tag || el.desc || '-')}</b>` +
                (el.desc && el.tag ? `：${linkifyTime(escapeHTML(el.desc))}` : '') +
                (timeStr ? ` <span class="text-gray-400 font-mono text-[11px]">${timeStr}</span>` : '');
        }).join('<br>');
        sections.push(renderAVSection('构图', 'mdi-grid', null, items, true,
            getEval(ev?.vision_quality?.composition)));
    } else {
        sections.push(renderAVSection('构图', 'mdi-grid', '无', null, false,
            getEval(ev?.vision_quality?.composition)));
    }

    // 4. 人物
    const man = avData.content_subject?.man_negative_content;
    if (man && man.length > 0) {
        const items = man.map(el => renderAVListItem(el)).join('<br>');
        sections.push(renderAVSection('人物', 'mdi-account', null, items, true,
            getEval(ev?.content_subject?.man_negative_content)));
    } else {
        sections.push(renderAVSection('人物', 'mdi-account', '无', null, false,
            getEval(ev?.content_subject?.man_negative_content)));
    }

    // 5. 生物
    const creature = avData.content_subject?.creature_negative_content;
    if (creature && creature.length > 0) {
        const items = creature.map(el => renderAVListItem(el)).join('<br>');
        sections.push(renderAVSection('生物', 'mdi-paw', null, items, true,
            getEval(ev?.content_subject?.creature_negative_content)));
    } else {
        sections.push(renderAVSection('生物', 'mdi-paw', '无', null, false,
            getEval(ev?.content_subject?.creature_negative_content)));
    }

    // 6. 信息属性
    const infoAttr = avData.information?.information_attributes;
    if (infoAttr && infoAttr.length > 0) {
        const items = infoAttr.map(el =>
            typeof el === 'string' ? escapeHTML(el) : renderAVListItem(el)
        ).join('<br>');
        sections.push(renderAVSection('信息属性', 'mdi-information', null, items, true,
            getEval(ev?.information?.information_attributes)));
    } else {
        sections.push(renderAVSection('信息属性', 'mdi-information', '无', null, false,
            getEval(ev?.information?.information_attributes)));
    }

    // 7. 真实性存疑
    const qi = avData.information?.questionable_info;
    if (qi) {
        sections.push(renderAVSection('真实性存疑', 'mdi-alert-circle',
            qi.has_issue ? '是' : '否', qi.desc !== '无' ? qi.desc : null, false,
            getEval(ev?.information?.questionable_info)));
    }

    // 8. 地理位置
    const geo = avData.information?.geographic_info;
    if (geo) {
        sections.push(renderAVSection('地理位置', 'mdi-map-marker',
            geo.has_info ? '有' : '无', geo.desc !== '无' ? geo.desc : null, false,
            getEval(ev?.information?.geographic_info)));
    }

    // 9. 时效性
    const tl = avData.information?.timeliness_info;
    if (tl) {
        sections.push(renderAVSection('时效性', 'mdi-clock',
            tl.has_info ? '有' : '无', tl.desc !== '无' ? tl.desc : null, false,
            getEval(ev?.information?.timeliness_info)));
    }

    // 10. 低俗意图
    const vi = avData.intent?.vulgar_intent;
    if (vi) {
        sections.push(renderAVSection('低俗/软色情意图', 'mdi-eye-off',
            vi.has_intent ? '是' : '否', vi.desc !== '无' ? vi.desc : null, false,
            getEval(ev?.intent?.vulgar_intent)));
    }

    // 11. 营销引流
    const pi = avData.intent?.promotional_intent;
    if (pi && pi.length > 0) {
        const items = pi.map(el => renderAVListItem(el)).join('<br>');
        sections.push(renderAVSection('营销与引流意图', 'mdi-bullhorn', null, items, true,
            getEval(ev?.intent?.promotional_intent)));
    } else {
        sections.push(renderAVSection('营销与引流意图', 'mdi-bullhorn', '无', null, false,
            getEval(ev?.intent?.promotional_intent)));
    }

    // 12. 违背道德
    const iv = avData.values?.immoral_values;
    if (iv) {
        const catStr = iv.category && iv.category.length > 0 ? iv.category.join('、') : '';
        sections.push(renderAVSection('违背社会道德', 'mdi-scale-balance',
            iv.has_issue ? '是' : '否',
            (catStr ? `分类：${catStr}` : '') + (iv.desc !== '无' ? (catStr ? '；' : '') + iv.desc : '') || null, false,
            getEval(ev?.values?.immoral_values)));
    }

    container.innerHTML = sections.length > 0
        ? sections.join('')
        : '<div class="text-gray-400 text-center py-8">暂无基础音画质量数据</div>';
    container.innerHTML += `
        <details class="mt-6">
            <summary class="text-xs text-gray-400 cursor-pointer select-none hover:text-gray-600 py-1">查看原文</summary>
            <div id="audiovisual-raw-inline" class="mt-2"></div>
        </details>`;
    renderRawContent(currentOutput, 'audiovisual-raw-inline');
}

function renderAVSection(title, icon, tag, content, isHtml, evalInfo) {
    // evalInfo: { score, reason, timeScore, timeReason } 自动评估数据（可选）
    let evalHtml = '';
    if (evalInfo) {
        const parts = [];
        if (evalInfo.score != null) {
            const scoreColor = evalInfo.score >= 2 ? 'text-green-600' : evalInfo.score >= 1 ? 'text-yellow-600' : 'text-red-500';
            parts.push(`<span class="font-semibold ${scoreColor}">${evalInfo.score}分</span>`);
        }
        if (evalInfo.reason) parts.push(`<span class="text-gray-500">${escapeHTML(evalInfo.reason)}</span>`);
        if (evalInfo.timeScore != null) {
            const tsColor = evalInfo.timeScore >= 2 ? 'text-green-600' : evalInfo.timeScore >= 1 ? 'text-yellow-600' : 'text-red-500';
            parts.push(`<span class="font-semibold ${tsColor}">时间${evalInfo.timeScore}分</span>`);
        }
        if (evalInfo.timeReason) parts.push(`<span class="text-gray-500">${escapeHTML(evalInfo.timeReason)}</span>`);
        if (parts.length > 0) {
            evalHtml = `<div class="mt-2 pt-2 border-t border-dashed border-gray-200 text-xs leading-relaxed space-y-0.5">
                <span class="text-[10px] font-bold text-blue-400 uppercase mr-1">自动评估</span>${parts.join(' · ')}
            </div>`;
        }
    }
    return `
        <div class="p-4 rounded-2xl bg-black/[0.03] hover:bg-black/[0.05] transition-all duration-200">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <span class="mdi ${icon} text-gray-400 text-lg"></span>
                    <span class="text-xs font-semibold text-gray-800 uppercase tracking-wide">${title}</span>
                </div>
                ${tag ? `<span class="px-2.5 py-1 bg-black text-white text-[11px] font-medium rounded-full">${escapeHTML(tag)}</span>` : ''}
            </div>
            ${content ? `<div class="text-[15px] text-gray-700 leading-relaxed">${isHtml ? linkifyTime(content) : linkifyTime(escapeHTML(content))}</div>` : ''}
            ${evalHtml}
        </div>
    `;
}

function renderAVListItem(el) {
    const parts = [];
    if (el.tag) parts.push(`<b>${escapeHTML(el.tag)}</b>`);
    if (el.desc) parts.push(linkifyTime(escapeHTML(el.desc)));
    if (el.position) parts.push(`<span class="text-gray-400">[${escapeHTML(el.position)}]</span>`);
    if (Array.isArray(el.time)) {
        parts.push(`<span class="text-gray-400 font-mono text-[11px]">${formatTimeLink(el.time[0])}→${formatTimeLink(el.time[1])}</span>`);
    }
    return parts.join(' ') || '-';
}

// ============================================
// 备注面板切换
// ============================================
function toggleNotePanel() {
    const notePanel = document.getElementById('note-panel');
    const segmentNotePanel = document.getElementById('segment-note-panel');
    const profileNotePanel = document.getElementById('profile-note-panel');
    const audiovisualNotePanel = document.getElementById('audiovisual-note-panel');
    const toggleIcon = document.getElementById('note-toggle-icon');

    if (notePanel) {
        const isHidden = notePanel.classList.contains('hidden');
        notePanel.classList.toggle('hidden');

        // 根据当前模式切换显示对应的备注面板
        [segmentNotePanel, profileNotePanel, audiovisualNotePanel].forEach(p => p?.classList.add('hidden'));
        if (state.reviewMode === 'segment') {
            segmentNotePanel?.classList.remove('hidden');
        } else if (state.reviewMode === 'audiovisual') {
            audiovisualNotePanel?.classList.remove('hidden');
        } else {
            profileNotePanel?.classList.remove('hidden');
        }
        
        // 切换图标样式
        if (toggleIcon) {
            if (isHidden) {
                toggleIcon.classList.remove('mdi-comment-outline');
                toggleIcon.classList.add('mdi-comment-check', 'text-blue-500');
            } else {
                toggleIcon.classList.remove('mdi-comment-check', 'text-blue-500');
                toggleIcon.classList.add('mdi-comment-outline');
            }
        }
        
        // 自动聚焦第一个输入框
        if (isHidden) {
            setTimeout(() => {
                const firstInput = notePanel.querySelector('input:not([type="hidden"])');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    }
}
window.toggleNotePanel = toggleNotePanel;

// ============================================
// 评分系统 - 支持两种模式
// ============================================
function initRatingListeners() {
    // 分段语义详情模式的评分（1-3分，星星样式）
    document.querySelectorAll('.rating-group[data-mode="segment"]').forEach(group => {
        const dimension = group.dataset.dimension;
        group.querySelectorAll('.rating-star').forEach(star => {
            star.addEventListener('click', () => setSegmentRating(dimension, parseInt(star.dataset.value)));
            star.addEventListener('mouseenter', () => highlightSegmentStars(group, parseInt(star.dataset.value)));
            star.addEventListener('mouseleave', () => highlightSegmentStars(group, state.ratings[dimension]));
        });
    });

    // 全篇语义画像模式的评分（0-2分，数字样式）
    document.querySelectorAll('.rating-group[data-mode="profile"]').forEach(group => {
        const dimension = group.dataset.dimension;
        group.querySelectorAll('.rating-star').forEach(star => {
            star.addEventListener('click', () => setProfileRating(dimension, parseInt(star.dataset.value)));
            star.addEventListener('mouseenter', () => highlightProfileStars(group, parseInt(star.dataset.value)));
            star.addEventListener('mouseleave', () => highlightProfileStars(group, state.profileRatings[dimension]));
        });
    });

    // 全篇画像 dock 备注区域：聚焦时临时解除 overflow-x-auto 的 Y 轴裁剪
    const profileScrollEl = document.querySelector('#profile-rating-dock .flex.flex-1');
    if (profileScrollEl) {
        profileScrollEl.querySelectorAll('textarea.av-rate-note').forEach(ta => {
            ta.addEventListener('focus', () => { profileScrollEl.style.overflow = 'visible'; });
            ta.addEventListener('blur',  () => { profileScrollEl.style.overflow = ''; });
        });
    }

    // 基础音画质量模式的评分（0-2分，数字样式，复用 highlightProfileStars）
    document.querySelectorAll('.rating-group[data-mode="audiovisual"]').forEach(group => {
        const dimension = group.dataset.dimension;
        group.querySelectorAll('.rating-star').forEach(star => {
            star.addEventListener('click', () => setAudiovisualRating(dimension, parseInt(star.dataset.value)));
            star.addEventListener('mouseenter', () => highlightProfileStars(group, parseInt(star.dataset.value)));
            star.addEventListener('mouseleave', () => highlightProfileStars(group, state.audiovisualRatings[dimension]));
        });
    });
}

function setSegmentRating(dimension, value) {
    state.ratings[dimension] = value;
    // 同步更新所有相关的 rating-group（包括 dock 面板和旧面板）
    document.querySelectorAll(`.rating-group[data-dimension="${dimension}"][data-mode="segment"]`).forEach(group => {
        highlightSegmentStars(group, value);
    });
    saveReviewForCurrentGroup();
    saveToLocalStorage();
}

function highlightSegmentStars(group, value) {
    group.querySelectorAll('.rating-star').forEach(star => {
        const starValue = parseInt(star.dataset.value);
        // 只切换 active 类来改变颜色，保持 mdi-star 图标不变
        if (starValue <= value) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function setProfileRating(dimension, value) {
    state.profileRatings[dimension] = value;
    // 同步更新所有相关的 rating-group（包括 dock 面板和旧面板）
    document.querySelectorAll(`.rating-group[data-dimension="${dimension}"][data-mode="profile"]`).forEach(group => {
        highlightProfileStars(group, value);
    });
    saveReviewForCurrentGroup();
    saveToLocalStorage();
}

function highlightProfileStars(group, value) {
    group.querySelectorAll('.rating-star').forEach(star => {
        const starValue = parseInt(star.dataset.value);
        // 数字圆圈样式
        if (starValue === value) {
            star.classList.remove('mdi-numeric-0-circle-outline', 'mdi-numeric-1-circle-outline', 'mdi-numeric-2-circle-outline');
            star.classList.add(`mdi-numeric-${starValue}-circle`, 'active');
        } else {
            star.classList.remove('mdi-numeric-0-circle', 'mdi-numeric-1-circle', 'mdi-numeric-2-circle', 'active');
            star.classList.add(`mdi-numeric-${starValue}-circle-outline`);
        }
    });
}

function resetProfileRatings() {
    state.profileRatings = {
        narrative_type: -1,
        visual_type: -1,
        summary: -1,
        intent_type: -1,
        topic_consistency: -1,
        core_claim: -1,
        emotion_type: -1
    };
    state.profileNotes = {
        narrative_type: '',
        visual_type: '',
        summary: '',
        intent_type: '',
        topic_consistency: '',
        core_claim: '',
        emotion_type: ''
    };
    
    // 重置UI
    document.querySelectorAll('.rating-group[data-mode="profile"]').forEach(group => {
        highlightProfileStars(group, -1);
    });
    
    PROFILE_DIMENSIONS.forEach(dim => {
        const dockInput = document.getElementById(`dock-note-${dim.key}`);
        if (dockInput) { dockInput.value = ''; }
        const noteInput = document.getElementById(`note-${dim.key}`);
        if (noteInput) { noteInput.value = ''; }
    });
}

function setAudiovisualRating(dimension, value) {
    state.audiovisualRatings[dimension] = value;
    document.querySelectorAll(`.rating-group[data-dimension="${dimension}"][data-mode="audiovisual"]`).forEach(group => {
        highlightProfileStars(group, value);
    });
    saveReviewForCurrentGroup();
    saveToLocalStorage();
}

function resetAudiovisualRatings() {
    AUDIOVISUAL_DIMENSIONS.forEach(dim => {
        state.audiovisualRatings[dim.key] = -1;
        state.audiovisualNotes[dim.key] = '';
    });

    document.querySelectorAll('.rating-group[data-mode="audiovisual"]').forEach(group => {
        highlightProfileStars(group, -1);
    });

    AUDIOVISUAL_DIMENSIONS.forEach(dim => {
        const dockInput = document.getElementById(`dock-note-${dim.key}`);
        if (dockInput) { dockInput.value = ''; }
        const noteInput = document.getElementById(`note-${dim.key}`);
        if (noteInput) { noteInput.value = ''; }
    });
}

// 扩展保存和加载评分功能
const originalSaveReviewForCurrentGroup = saveReviewForCurrentGroup;
saveReviewForCurrentGroup = function() {
    const task = getCurrentTask();
    if (!task) return;
    
    if (state.reviewMode === 'segment') {
        // 收集分段语义详情的备注（优先从 dock 面板读取）
        ['time', 'text', 'visual', 'keyframe'].forEach(dim => {
            const dockInput = document.getElementById(`dock-note-${dim}`);
            const noteInput = document.getElementById(`note-${dim}`);
            // 优先使用 dock 面板的值
            if (dockInput && dockInput.value) {
                state.notes[dim] = dockInput.value;
            } else if (noteInput && noteInput.value) {
                state.notes[dim] = noteInput.value;
            }
        });
        
        // 确保 reviews 数组存在
        if (!task.reviews) {
            task.reviews = task.model_outputs?.map(() => null) || [null];
        }
        
        // 保存到当前组
        task.reviews[state.currentOutputGroup] = {
            mode: 'segment',
            ratings: { ...state.ratings },
            notes: { ...state.notes },
            completed: Object.values(state.ratings).some(r => r > 0),
            timestamp: new Date().toISOString()
        };
    } else if (state.reviewMode === 'audiovisual') {
        // 收集基础音画质量的备注（优先从 dock 面板读取）
        AUDIOVISUAL_DIMENSIONS.forEach(dim => {
            const dockInput = document.getElementById(`dock-note-${dim.key}`);
            const noteInput = document.getElementById(`note-${dim.key}`);
            if (dockInput && dockInput.value) {
                state.audiovisualNotes[dim.key] = dockInput.value;
            } else if (noteInput && noteInput.value) {
                state.audiovisualNotes[dim.key] = noteInput.value;
            }
        });

        if (!task.audiovisualReviews) {
            task.audiovisualReviews = task.model_outputs?.map(() => null) || [null];
        }

        task.audiovisualReviews[state.currentOutputGroup] = {
            mode: 'audiovisual',
            ratings: { ...state.audiovisualRatings },
            notes: { ...state.audiovisualNotes },
            completed: Object.values(state.audiovisualRatings).some(r => r >= 0),
            timestamp: new Date().toISOString()
        };
    } else {
        // 收集全篇语义画像的备注（优先从 dock 面板读取）
        PROFILE_DIMENSIONS.forEach(dim => {
            const dockInput = document.getElementById(`dock-note-${dim.key}`);
            const noteInput = document.getElementById(`note-${dim.key}`);
            // 优先使用 dock 面板的值
            if (dockInput && dockInput.value) {
                state.profileNotes[dim.key] = dockInput.value;
            } else if (noteInput && noteInput.value) {
                state.profileNotes[dim.key] = noteInput.value;
            }
        });
        
        // 确保 profileReviews 数组存在
        if (!task.profileReviews) {
            task.profileReviews = task.model_outputs?.map(() => null) || [null];
        }
        
        // 保存到当前组
        task.profileReviews[state.currentOutputGroup] = {
            mode: 'profile',
            ratings: { ...state.profileRatings },
            notes: { ...state.profileNotes },
            completed: Object.values(state.profileRatings).some(r => r >= 0),
            timestamp: new Date().toISOString()
        };
    }
};

const originalLoadReviewForCurrentGroup = loadReviewForCurrentGroup;
loadReviewForCurrentGroup = function() {
    const task = getCurrentTask();
    if (!task) return;
    
    if (state.reviewMode === 'segment') {
        const review = task.reviews?.[state.currentOutputGroup];
        
        if (review) {
            state.ratings = { ...review.ratings };
            state.notes = { ...review.notes };
            Object.keys(state.ratings).forEach(dim => {
                // 更新所有评分组（包括 dock 面板和旧面板）
                document.querySelectorAll(`.rating-group[data-dimension="${dim}"][data-mode="segment"]`).forEach(group => {
                    highlightSegmentStars(group, state.ratings[dim]);
                });
                // 同时更新 dock 面板和旧面板的输入框
                const dockInput = document.getElementById(`dock-note-${dim}`);
                if (dockInput) { dockInput.value = state.notes[dim] || ''; }
                const noteInput = document.getElementById(`note-${dim}`);
                if (noteInput) { noteInput.value = state.notes[dim] || ''; }
            });
        } else {
            resetRatings();
        }
    } else if (state.reviewMode === 'audiovisual') {
        const review = task.audiovisualReviews?.[state.currentOutputGroup];

        if (review) {
            state.audiovisualRatings = { ...review.ratings };
            state.audiovisualNotes = { ...review.notes };
            AUDIOVISUAL_DIMENSIONS.forEach(dim => {
                document.querySelectorAll(`.rating-group[data-dimension="${dim.key}"][data-mode="audiovisual"]`).forEach(group => {
                    highlightProfileStars(group, state.audiovisualRatings[dim.key]);
                });
                const dockInput = document.getElementById(`dock-note-${dim.key}`);
                if (dockInput) { dockInput.value = state.audiovisualNotes[dim.key] || ''; }
                const noteInput = document.getElementById(`note-${dim.key}`);
                if (noteInput) { noteInput.value = state.audiovisualNotes[dim.key] || ''; }
            });
        } else {
            // 无人工评审，尝试从自动评估预填
            resetAudiovisualRatings();
            const ev = task.autoEval;
            if (ev) {
                const evalMap = {
                    overall_quality:          ev.audiovisual_integration?.detail_quality || ev.visual_integration?.detail_quality,
                    processing_elements:      ev.vision_quality?.visual_processing_elements,
                    processing_elements_time: ev.vision_quality?.visual_processing_elements,
                    composition:              ev.vision_quality?.composition,
                    composition_time:         ev.vision_quality?.composition,
                    person:                   ev.content_subject?.man_negative_content,
                    person_time:              ev.content_subject?.man_negative_content,
                    creature:                 ev.content_subject?.creature_negative_content,
                    creature_time:            ev.content_subject?.creature_negative_content,
                    info_attributes:          ev.information?.information_attributes,
                    questionable_info:        ev.information?.questionable_info,
                    geographic_info:          ev.information?.geographic_info,
                    timeliness_info:          ev.information?.timeliness_info,
                    vulgar_intent:            ev.intent?.vulgar_intent,
                    promotional_intent:       Array.isArray(ev.intent?.promotional_intent) ? ev.intent.promotional_intent[0] : ev.intent?.promotional_intent,
                    immoral_values:           ev.values?.immoral_values
                };
                AUDIOVISUAL_DIMENSIONS.forEach(dim => {
                    let d = evalMap[dim.key];
                    if (!d) return;
                    const isTime = dim.key.endsWith('_time');
                    const score = isTime ? (d['time得分'] ?? -1) : (d['得分'] ?? -1);
                    const reason = isTime ? (d['time理由'] || '') : (d['理由'] || '');
                    if (score >= 0) {
                        state.audiovisualRatings[dim.key] = score;
                        document.querySelectorAll(`.rating-group[data-dimension="${dim.key}"][data-mode="audiovisual"]`).forEach(group => {
                            highlightProfileStars(group, score);
                        });
                    }
                    if (reason) {
                        state.audiovisualNotes[dim.key] = reason;
                        const dockInput = document.getElementById(`dock-note-${dim.key}`);
                        if (dockInput) { dockInput.value = reason; }
                        const noteInput = document.getElementById(`note-${dim.key}`);
                        if (noteInput) { noteInput.value = reason; }
                    }
                });
            }
        }
    } else {
        const review = task.profileReviews?.[state.currentOutputGroup];
        
        if (review) {
            state.profileRatings = { ...review.ratings };
            state.profileNotes = { ...review.notes };
            PROFILE_DIMENSIONS.forEach(dim => {
                // 更新所有评分组（包括 dock 面板和旧面板）
                document.querySelectorAll(`.rating-group[data-dimension="${dim.key}"][data-mode="profile"]`).forEach(group => {
                    highlightProfileStars(group, state.profileRatings[dim.key]);
                });
                // 同时更新 dock 面板和旧面板的输入框
                const dockInput = document.getElementById(`dock-note-${dim.key}`);
                if (dockInput) { dockInput.value = state.profileNotes[dim.key] || ''; }
                const noteInput = document.getElementById(`note-${dim.key}`);
                if (noteInput) { noteInput.value = state.profileNotes[dim.key] || ''; }
            });
        } else {
            resetProfileRatings();
        }
    }
};

// 扩展导出功能，支持两种模式
const originalExportResults = exportResults;
exportResults = function() {
    const tasks = getTasks();
    if (tasks.length === 0) {
        alert('暂无可导出的数据');
        return;
    }

    // 根据当前模式选择导出格式
    if (state.reviewMode === 'segment') {
        exportSegmentResults();
    } else if (state.reviewMode === 'audiovisual') {
        exportAudiovisualResults();
    } else {
        exportProfileResults();
    }
};

function exportSegmentResults() {
    // 分段语义详情导出逻辑
    const tasks = getTasks();
    const exportData = [];

    tasks.forEach(task => {
        const groupCount = task.model_outputs?.length || 1;

        if (groupCount > 1 && task.reviews) {
            task.reviews.forEach((review, groupIndex) => {
                if (task.model_outputs?.[groupIndex]?._parseError) return; // 跳过解析失败条目
                const ratings = review?.ratings || {};
                const notes = review?.notes || {};
                const modelName = task.model_names?.[groupIndex] || `模型${groupIndex + 1}`;
                
                exportData.push({
                    '任务ID': task.id || '',
                    '视频URL': task.video_url || '',
                    '模型名称': modelName,
                    '状态': review?.completed ? '已完成' : '未完成',
                    '时间段切分评分': ratings.time || 0,
                    '时间段切分备注': notes.time || '',
                    '文本理解评分': ratings.text || 0,
                    '文本理解备注': notes.text || '',
                    '视觉理解评分': ratings.visual || 0,
                    '视觉理解备注': notes.visual || '',
                    '关键帧评分': ratings.keyframe || 0,
                    '关键帧备注': notes.keyframe || '',
                    '完成时间': review?.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
                });
            });
        } else {
            const review = task.reviews?.[0] || task.review || {};
            const ratings = review.ratings || {};
            const notes = review.notes || {};
            const modelName = task.model_names?.[0] || '-';
            
            exportData.push({
                '任务ID': task.id || '',
                '视频URL': task.video_url || '',
                '模型名称': modelName,
                '状态': review.completed ? '已完成' : '未完成',
                '时间段切分评分': ratings.time || 0,
                '时间段切分备注': notes.time || '',
                '文本理解评分': ratings.text || 0,
                '文本理解备注': notes.text || '',
                '视觉理解评分': ratings.visual || 0,
                '视觉理解备注': notes.visual || '',
                '关键帧评分': ratings.keyframe || 0,
                '关键帧备注': notes.keyframe || '',
                '完成时间': review.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
            });
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
        { wch: 10 }, { wch: 50 }, { wch: 15 }, { wch: 8 },
        { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
        { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 20 }
    ];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '分段语义详情');
    XLSX.writeFile(workbook, `分段语义详情-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportProfileResults() {
    // 全篇语义画像导出逻辑
    const tasks = getTasks();
    const exportData = [];
    
    tasks.forEach(task => {
        const groupCount = task.model_outputs?.length || 1;
        
        if (groupCount > 1 && task.profileReviews) {
            task.profileReviews.forEach((review, groupIndex) => {
                if (task.model_outputs?.[groupIndex]?._parseError) return; // 跳过解析失败条目
                const ratings = review?.ratings || {};
                const notes = review?.notes || {};
                const modelName = task.model_names?.[groupIndex] || `模型${groupIndex + 1}`;
                
                exportData.push({
                    '任务ID': task.id || '',
                    '视频URL': task.video_url || '',
                    '模型名称': modelName,
                    '状态': review?.completed ? '已完成' : '未完成',
                    '叙事类型评分': ratings.narrative_type >= 0 ? ratings.narrative_type : '',
                    '叙事类型备注': notes.narrative_type || '',
                    '画面类型评分': ratings.visual_type >= 0 ? ratings.visual_type : '',
                    '画面类型备注': notes.visual_type || '',
                    '内容总结评分': ratings.summary >= 0 ? ratings.summary : '',
                    '内容总结备注': notes.summary || '',
                    '创作意图评分': ratings.intent_type >= 0 ? ratings.intent_type : '',
                    '创作意图备注': notes.intent_type || '',
                    '主题一致性评分': ratings.topic_consistency >= 0 ? ratings.topic_consistency : '',
                    '主题一致性备注': notes.topic_consistency || '',
                    '核心观点评分': ratings.core_claim >= 0 ? ratings.core_claim : '',
                    '核心观点备注': notes.core_claim || '',
                    '情感类型评分': ratings.emotion_type >= 0 ? ratings.emotion_type : '',
                    '情感类型备注': notes.emotion_type || '',
                    '完成时间': review?.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
                });
            });
        } else {
            const review = task.profileReviews?.[0] || {};
            const ratings = review.ratings || {};
            const notes = review.notes || {};
            const modelName = task.model_names?.[0] || '-';
            
            exportData.push({
                '任务ID': task.id || '',
                '视频URL': task.video_url || '',
                '模型名称': modelName,
                '状态': review.completed ? '已完成' : '未完成',
                '叙事类型评分': ratings.narrative_type >= 0 ? ratings.narrative_type : '',
                '叙事类型备注': notes.narrative_type || '',
                '画面类型评分': ratings.visual_type >= 0 ? ratings.visual_type : '',
                '画面类型备注': notes.visual_type || '',
                '内容总结评分': ratings.summary >= 0 ? ratings.summary : '',
                '内容总结备注': notes.summary || '',
                '创作意图评分': ratings.intent_type >= 0 ? ratings.intent_type : '',
                '创作意图备注': notes.intent_type || '',
                '主题一致性评分': ratings.topic_consistency >= 0 ? ratings.topic_consistency : '',
                '主题一致性备注': notes.topic_consistency || '',
                '核心观点评分': ratings.core_claim >= 0 ? ratings.core_claim : '',
                '核心观点备注': notes.core_claim || '',
                '情感类型评分': ratings.emotion_type >= 0 ? ratings.emotion_type : '',
                '情感类型备注': notes.emotion_type || '',
                '完成时间': review.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
            });
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
        { wch: 10 }, { wch: 50 }, { wch: 15 }, { wch: 8 },
        { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
        { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
        { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
        { wch: 12 }, { wch: 20 }, { wch: 20 }
    ];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '全篇语义画像');
    XLSX.writeFile(workbook, `全篇语义画像-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportAudiovisualResults() {
    const tasks = getTasks();
    const exportData = [];

    const buildRow = (task, review, modelName) => {
        const ratings = review?.ratings || {};
        const notes = review?.notes || {};
        const row = {
            '任务ID': task.id || '',
            '视频URL': task.video_url || '',
            '模型名称': modelName,
            '状态': review?.completed ? '已完成' : '未完成'
        };
        AUDIOVISUAL_DIMENSIONS.forEach(dim => {
            row[`${dim.label}评分`] = ratings[dim.key] >= 0 ? ratings[dim.key] : '';
            row[`${dim.label}备注`] = notes[dim.key] || '';
        });
        row['完成时间'] = review?.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : '';
        return row;
    };

    tasks.forEach(task => {
        const groupCount = task.model_outputs?.length || 1;

        if (groupCount > 1 && task.audiovisualReviews) {
            task.audiovisualReviews.forEach((review, groupIndex) => {
                if (task.model_outputs?.[groupIndex]?._parseError) return; // 跳过解析失败条目
                const modelName = task.model_names?.[groupIndex] || `模型${groupIndex + 1}`;
                exportData.push(buildRow(task, review, modelName));
            });
        } else {
            const review = task.audiovisualReviews?.[0] || {};
            const modelName = task.model_names?.[0] || '-';
            exportData.push(buildRow(task, review, modelName));
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    // 4 基础列 + 15*2 评分/备注列 + 1 完成时间 = 35 列
    const cols = [
        { wch: 10 }, { wch: 50 }, { wch: 15 }, { wch: 8 }
    ];
    AUDIOVISUAL_DIMENSIONS.forEach(() => {
        cols.push({ wch: 12 }, { wch: 20 });
    });
    cols.push({ wch: 20 });
    worksheet['!cols'] = cols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '基础音画质量');
    XLSX.writeFile(workbook, `基础音画质量-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// 修改 normalizeModelOutput 以支持全篇语义画像数据
const originalNormalizeModelOutput = normalizeModelOutput;
normalizeModelOutput = function(data) {
    const output = {};

    // 处理分段语义详情
    if (Array.isArray(data)) {
        // 解包 [{segment_detail: [...]}] 格式
        if (data.length === 1 && typeof data[0] === 'object' && !Array.isArray(data[0]) && data[0].segment_detail) {
            data = data[0];
        } else {
            output.segments = convertSegmentArray(data);
            return output;
        }
    }

    if (data.segment_detail && Array.isArray(data.segment_detail)) {
        output.segments = convertSegmentArray(data.segment_detail);
    }

    // 解包 segment_output（Python dict 格式经解析后的结构）
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
    
    if (data.segments) {
        output.segments = data.segments;
    }
    
    // 处理全篇语义画像数据
    // 情况1：global_profile 嵌套格式（用户提供的格式）
    if (data.global_profile) {
        const gp = data.global_profile;
        output.profile = {
            narrative_type: gp.narrative_type,
            visual_type: gp.visual_type,
            summary: gp.summary,
            intent_type: gp.intent_type,
            topic_consistency: gp.topic_consistency,
            core_claim: gp.core_claim,
            // 兼容 emotional_tone 和 emotion_type 两种字段名
            emotion_type: gp.emotion_type || gp.emotional_tone
        };
    }
    // 情况2：顶层字段格式
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
            // 兼容 emotional_tone 和 emotion_type 两种字段名
            emotion_type: data.emotion_type || data.emotional_tone
        };
    }
    
    // 处理基础音画质量数据
    // 支持 audiovisual_integration 和 visual_integration 两种字段名
    if (data.vision_quality || data.audiovisual_integration || data.visual_integration || data.content_subject) {
        output.audiovisual = data;
    }

    // 如果没有任何有效数据，返回原数据
    if (!output.segments && !output.profile && !output.audiovisual) {
        // 尝试解包 {"audiovisual": {...}} 外层包装后重新检测
        if (data.audiovisual) {
            const inner = data.audiovisual;
            if (inner && (inner.vision_quality || inner.audiovisual_integration ||
                          inner.visual_integration || inner.content_subject)) {
                output.audiovisual = inner;
            }
        }
    }
    if (!output.segments && !output.profile && !output.audiovisual) {
        return data;
    }
    
    return output;
};

// ============================================
// 按 nid/id 排序
// ============================================
function sortTasksByNid() {
    const tasks = getTasks();
    if (tasks.length === 0) return;

    // 提取数字部分用于排序，支持纯数字或 "task-1" 等格式
    const extractNum = (id) => {
        if (!id) return Infinity;
        const match = String(id).match(/(\d+)/);
        return match ? parseInt(match[1], 10) : Infinity;
    };

    tasks.sort((a, b) => extractNum(a.rawId || a.id) - extractNum(b.rawId || b.id));

    // 重置选中索引到第一个未完成的任务
    const isComplete = (t) => state.reviewMode === 'segment' ? t.review?.completed
        : state.reviewMode === 'audiovisual' ? t.audiovisualReview?.completed
        : t.profileReview?.completed;
    const firstIncomplete = tasks.findIndex(t => !isComplete(t));
    setTaskIndex(firstIncomplete >= 0 ? firstIncomplete : 0);

    saveToLocalStorage();
    updateUI();
    selectTask(getTaskIndex());
}
window.sortTasksByNid = sortTasksByNid;

// 暴露全局函数
window.switchReviewMode = switchReviewMode;

// 打分板收起/展开
function toggleRatingDock() {
    const dock = document.getElementById('rating-dock');
    const body = document.getElementById('rating-dock-body');
    const toggle = document.getElementById('rating-dock-toggle');
    const icon = toggle.querySelector('.mdi');
    const collapsed = !body.classList.contains('hidden');
    if (collapsed) {
        // 收起
        body.classList.add('hidden');
        dock.classList.remove('w-[calc(100%-300px)]', 'max-w-6xl');
        dock.classList.add('w-auto');
        icon.classList.replace('mdi-chevron-down', 'mdi-chevron-up');
    } else {
        // 展开
        body.classList.remove('hidden');
        dock.classList.remove('w-auto');
        dock.classList.add('w-[calc(100%-300px)]', 'max-w-6xl');
        icon.classList.replace('mdi-chevron-up', 'mdi-chevron-down');
    }
}
window.toggleRatingDock = toggleRatingDock;

// 侧边栏收起/展开
function toggleSidebar() {
    const sidebar = document.getElementById('task-sidebar');
    const expandBtn = document.getElementById('sidebar-expand-btn');
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const mainEl = document.querySelector('main');
    const collapsed = sidebar.style.width !== '0px';
    if (collapsed) {
        sidebar.style.width = '0px';
        sidebar.style.padding = '0';
        sidebar.classList.add('opacity-0');
        mainEl.classList.remove('rounded-l-[40px]', 'ml-2');
        mainEl.classList.add('rounded-l-none', 'ml-0');
        expandBtn.classList.remove('hidden');
        collapseBtn.classList.add('hidden');
    } else {
        sidebar.style.width = '';
        sidebar.style.padding = '';
        sidebar.classList.remove('opacity-0');
        mainEl.classList.remove('rounded-l-none', 'ml-0');
        mainEl.classList.add('rounded-l-[40px]', 'ml-2');
        expandBtn.classList.add('hidden');
        collapseBtn.classList.remove('hidden');
    }
}
window.toggleSidebar = toggleSidebar;

// ============================================
// 对比模式
// ============================================

function toggleComparisonMode() {
    if (state.comparisonMode) {
        exitComparisonMode();
    } else {
        enterComparisonMode();
    }
}

function enterComparisonMode() {
    const task = getCurrentTask();
    if (!task) return;
    const groupCount = task.model_outputs?.length || 0;
    if (groupCount < 2) {
        alert('至少需要2个模型输出才能使用对比模式');
        return;
    }

    state.comparisonMode = true;
    state.comparisonGroups = [0, Math.min(1, groupCount - 1)];
    state.comparisonTab = state.currentTab || 'text'; // segment 模式下的当前维度

    // 尝试 PiP
    const video = elements.videoPlayer;
    if (video && document.pictureInPictureEnabled && !video.disablePictureInPicture) {
        video.requestPictureInPicture().catch(() => {});
    }

    // PiP 关闭时退出对比模式
    const onLeavePiP = () => {
        video.removeEventListener('leavepictureinpicture', onLeavePiP);
        if (state.comparisonMode) exitComparisonMode();
    };
    video.addEventListener('leavepictureinpicture', onLeavePiP);

    // 隐藏视频列
    const videoCol = document.querySelector('#review-workspace > .flex-1.flex.flex-col');
    if (videoCol) {
        videoCol.dataset.prevClass = videoCol.className;
        videoCol.classList.add('hidden');
    }

    // 扩展 inspector
    const inspector = document.querySelector('#review-workspace > .w-\\[420px\\]');
    if (inspector) {
        inspector.dataset.prevClass = inspector.className;
        inspector.className = 'flex-1 flex flex-col h-full pb-2';
    }

    // 隐藏 output-group-switcher
    const switcher = document.getElementById('output-group-switcher');
    if (switcher) switcher.classList.add('hidden');

    // 在 inspector 卡片内，隐藏原有内容，插入对比视图
    const card = inspector?.querySelector('.ive-card');
    if (card) {
        Array.from(card.children).forEach(ch => {
            ch.dataset.compHidden = ch.classList.contains('hidden') ? 'was-hidden' : '';
            ch.classList.add('hidden');
        });

        const compView = document.createElement('div');
        compView.id = 'comparison-view';
        compView.className = 'flex-1 flex flex-col overflow-hidden';
        card.appendChild(compView);

        buildComparisonView(compView, task);
    }
}

function buildComparisonView(container, task) {
    const groupCount = task.model_outputs?.length || 0;
    const mode = state.reviewMode;

    // 顶部工具栏：维度 tab（segment 模式）+ 退出按钮
    const toolbar = document.createElement('div');
    toolbar.className = 'flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-shrink-0';

    if (mode === 'segment') {
        toolbar.innerHTML = `
            <div class="flex gap-4" id="comp-tabs">
                <button onclick="switchComparisonTab('text')" class="comp-tab-btn text-sm font-semibold text-black border-b-2 border-black pb-1" data-tab="text">文本</button>
                <button onclick="switchComparisonTab('visual')" class="comp-tab-btn text-sm font-medium text-gray-400 hover:text-gray-600 border-b-2 border-transparent pb-1" data-tab="visual">视觉</button>
                <button onclick="switchComparisonTab('keyframe')" class="comp-tab-btn text-sm font-medium text-gray-400 hover:text-gray-600 border-b-2 border-transparent pb-1" data-tab="keyframe">关键帧</button>
            </div>
            <div id="comp-rating-group-btns" class="flex gap-1 ml-3"></div>
            <div class="ml-auto flex items-center gap-1.5">
                <input type="text" id="comp-time-jump-input" placeholder="跳转 1:30" class="w-[80px] text-xs py-1 px-2 rounded-lg bg-gray-100 border-none outline-none focus:bg-gray-200 font-mono transition-colors" onkeydown="if(event.key==='Enter'){jumpToInputTime('comp-time-jump-input'); event.preventDefault();}">
                <button onclick="jumpToInputTime('comp-time-jump-input')" class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition-colors" title="跳转">
                    <span class="mdi mdi-arrow-right-bold text-sm"></span>
                </button>
            </div>
            <button onclick="exitComparisonMode()" class="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors ml-2">
                <span class="mdi mdi-close mr-1"></span>退出对比
            </button>
        `;
    } else {
        toolbar.innerHTML = `
            <span class="text-sm font-bold text-gray-700">${mode === 'profile' ? '全篇画像' : '音画质量'} 对比</span>
            <div id="comp-rating-group-btns" class="flex gap-1 ml-3"></div>
            <div class="ml-auto flex items-center gap-1.5">
                <input type="text" id="comp-time-jump-input" placeholder="跳转 1:30" class="w-[80px] text-xs py-1 px-2 rounded-lg bg-gray-100 border-none outline-none focus:bg-gray-200 font-mono transition-colors" onkeydown="if(event.key==='Enter'){jumpToInputTime('comp-time-jump-input'); event.preventDefault();}">
                <button onclick="jumpToInputTime('comp-time-jump-input')" class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition-colors" title="跳转">
                    <span class="mdi mdi-arrow-right-bold text-sm"></span>
                </button>
            </div>
            <button onclick="exitComparisonMode()" class="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors ml-2">
                <span class="mdi mdi-close mr-1"></span>退出对比
            </button>
        `;
    }
    container.appendChild(toolbar);
    renderComparisonRatingGroupBtns(task);

    // 双栏容器
    const cols = document.createElement('div');
    cols.className = 'flex-1 flex gap-3 p-3 overflow-hidden';
    cols.id = 'comparison-columns';

    for (let ci = 0; ci < 2; ci++) {
        const col = document.createElement('div');
        col.className = 'comparison-column';
        col.dataset.colIndex = ci;

        // header with model selector
        const header = document.createElement('div');
        header.className = 'comp-header';
        const select = document.createElement('select');
        select.className = 'text-sm font-semibold bg-transparent border-none outline-none cursor-pointer flex-1';
        select.dataset.colIndex = ci;
        for (let gi = 0; gi < groupCount; gi++) {
            const opt = document.createElement('option');
            opt.value = gi;
            opt.textContent = task.model_names?.[gi] || `模型${gi + 1}`;
            if (gi === state.comparisonGroups[ci]) opt.selected = true;
            select.appendChild(opt);
        }
        select.addEventListener('change', (e) => {
            const colIdx = parseInt(e.target.dataset.colIndex);
            state.comparisonGroups[colIdx] = parseInt(e.target.value);
            renderComparisonColumn(col.querySelector('.comp-body'), task, state.comparisonGroups[colIdx]);
        });
        header.appendChild(select);
        col.appendChild(header);

        // body
        const body = document.createElement('div');
        body.className = 'comp-body no-scrollbar';
        col.appendChild(body);
        cols.appendChild(col);

        // render
        renderComparisonColumn(body, task, state.comparisonGroups[ci]);
    }

    container.appendChild(cols);
}

function renderComparisonRatingGroupBtns(task) {
    const container = document.getElementById('comp-rating-group-btns');
    if (!container) return;
    const names = task.model_names || [];
    container.innerHTML = names.map((name, gi) => {
        const isActive = gi === state.currentOutputGroup;
        return `<button onclick="switchComparisonRatingGroup(${gi})"
            class="px-2 py-0.5 text-xs rounded border transition-colors ${isActive
                ? 'bg-black text-white border-black'
                : 'text-gray-500 border-gray-300 hover:border-gray-500 hover:text-gray-700'}"
            title="切换评分到 ${escapeHTML(name)}">
            ${escapeHTML(name)}
        </button>`;
    }).join('');
}
window.renderComparisonRatingGroupBtns = renderComparisonRatingGroupBtns;

function switchComparisonRatingGroup(groupIndex) {
    switchOutputGroup(groupIndex);
    // switchOutputGroup unhides the output-group-switcher; re-hide it in comparison mode
    const switcher = document.getElementById('output-group-switcher');
    if (switcher) switcher.classList.add('hidden');
    const task = getCurrentTask();
    if (task) renderComparisonRatingGroupBtns(task);
}
window.switchComparisonRatingGroup = switchComparisonRatingGroup;

function switchComparisonTab(tabName) {
    state.comparisonTab = tabName;
    // 更新 tab 样式
    document.querySelectorAll('.comp-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle('font-semibold', isActive);
        btn.classList.toggle('text-black', isActive);
        btn.classList.toggle('border-black', isActive);
        btn.classList.toggle('font-medium', !isActive);
        btn.classList.toggle('text-gray-400', !isActive);
        btn.classList.toggle('border-transparent', !isActive);
    });
    // 重新渲染两列
    const task = getCurrentTask();
    if (!task) return;
    document.querySelectorAll('#comparison-columns .comp-body').forEach((body, ci) => {
        renderComparisonColumn(body, task, state.comparisonGroups[ci]);
    });
}
window.switchComparisonTab = switchComparisonTab;

function renderComparisonColumn(bodyEl, task, groupIndex) {
    const output = task.model_outputs?.[groupIndex];
    if (!output) {
        bodyEl.innerHTML = '<div class="text-gray-400 text-center py-8">无数据</div>';
        return;
    }

    if (output._parseError) {
        bodyEl.innerHTML = `
            <div class="p-4 rounded-2xl border border-amber-200 bg-amber-50">
                <div class="flex items-center gap-2 mb-2">
                    <span class="mdi mdi-alert text-amber-500"></span>
                    <span class="text-sm font-semibold text-amber-800">JSON 解析失败</span>
                </div>
                <pre class="text-xs text-gray-700 bg-white border rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap break-all">${escapeHTML(output.raw || '')}</pre>
            </div>`;
        return;
    }

    const mode = state.reviewMode;
    let html = '';

    if (mode === 'segment') {
        const segments = output.segments || [];
        const tab = state.comparisonTab || 'text';
        if (tab === 'text') {
            html = generateSegmentTextHTML(segments);
        } else if (tab === 'visual') {
            html = generateSegmentVisualHTML(segments);
        } else if (tab === 'keyframe') {
            html = generateSegmentKeyframeHTML(segments);
        }
    } else if (mode === 'profile') {
        html = generateProfileHTML(output.profile || null);
    } else if (mode === 'audiovisual') {
        html = generateAudiovisualHTML(output.audiovisual || null, task.autoEval);
    }

    bodyEl.innerHTML = `<div class="space-y-4 text-sm leading-relaxed text-gray-600">${html || '<div class="text-gray-400 text-center py-8">暂无数据</div>'}</div>`;
}

// 分段模式 - 文本
function generateSegmentTextHTML(segments) {
    if (!segments || segments.length === 0) return '';
    return segments.map((seg, i) => `
        <div class="p-3 rounded-xl bg-black/[0.03] cursor-pointer hover:bg-black/[0.06] transition-all" onclick="seekToTime(${seg.start})">
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-semibold text-gray-800">${i + 1}</span>
                <span class="text-[11px] text-gray-400 font-mono">${formatTime(seg.start)} → ${formatTime(seg.end)}</span>
            </div>
            <p class="text-sm text-gray-700">${(seg.description || seg.text || '') || '无文本'}</p>
        </div>
    `).join('');
}

// 分段模式 - 视觉
function generateSegmentVisualHTML(segments) {
    if (!segments || segments.length === 0) return '';
    const visual = segments.filter(s => s.visual);
    if (visual.length === 0) return '<div class="text-gray-400 text-center py-4">暂无视觉数据</div>';
    return visual.map((seg, i) => `
        <div class="p-3 rounded-xl bg-black/[0.03] cursor-pointer hover:bg-black/[0.06] transition-all" onclick="seekToTime(${seg.start})">
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-semibold text-gray-800">${i + 1}</span>
                <span class="text-[11px] text-gray-400 font-mono">${formatTime(seg.start)} → ${formatTime(seg.end)}</span>
            </div>
            <p class="text-sm text-gray-700">${linkifyTime(seg.visual)}</p>
        </div>
    `).join('');
}

// 分段模式 - 关键帧
function generateSegmentKeyframeHTML(segments) {
    if (!segments || segments.length === 0) return '';
    const allKf = [];
    segments.forEach((seg, si) => {
        if (seg.keyframes && Array.isArray(seg.keyframes)) {
            seg.keyframes.forEach(kf => allKf.push({ ...kf, segIdx: si + 1 }));
        }
    });
    if (allKf.length === 0) return '<div class="text-gray-400 text-center py-4">暂无关键帧数据</div>';
    allKf.sort((a, b) => a.time - b.time);
    return allKf.map(kf => `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-black/[0.03] cursor-pointer hover:bg-black/[0.06] transition-all" onclick="seekToTime(${kf.time})">
            <span class="px-2 py-0.5 bg-black text-white text-[11px] font-medium rounded-full font-mono">${formatTime(kf.time)}</span>
            <div class="flex-1">
                <span class="text-sm text-gray-700">${kf.label || kf.desc || '关键帧'}</span>
                <span class="text-[11px] text-gray-400 ml-1">§${kf.segIdx}</span>
            </div>
        </div>
    `).join('');
}

// 生成 Profile 内容 HTML
function generateProfileHTML(profileData) {
    if (!profileData) return '';
    const sections = [];

    if (profileData.narrative_type) {
        sections.push(renderProfileSection('叙事类型', 'mdi-book-open-variant', 'blue',
            profileData.narrative_type.tag, profileData.narrative_type.reason));
    }
    if (profileData.visual_type) {
        const visualTag = typeof profileData.visual_type === 'object'
            ? `主要: ${profileData.visual_type['主要画面类型'] || profileData.visual_type.main || '-'}, 次要: ${profileData.visual_type['次要画面类型'] || profileData.visual_type.secondary || '-'}`
            : profileData.visual_type;
        sections.push(renderProfileSection('画面类型', 'mdi-image', 'green', visualTag, null));
    }
    if (profileData.summary) {
        sections.push(renderProfileSection('内容总结', 'mdi-text-box', 'purple', null, profileData.summary));
    }
    if (profileData.intent_type) {
        sections.push(renderProfileSection('创作意图', 'mdi-target', 'orange',
            profileData.intent_type.tag, profileData.intent_type.reason));
    }
    if (profileData.topic_consistency) {
        sections.push(renderProfileSection('主题一致性', 'mdi-bullseye-arrow', 'teal',
            profileData.topic_consistency.tag, profileData.topic_consistency.reason));
    }
    if (profileData.core_claim) {
        const claims = Array.isArray(profileData.core_claim)
            ? profileData.core_claim.join('；')
            : profileData.core_claim;
        sections.push(renderProfileSection('核心观点', 'mdi-lightbulb', 'yellow', null, claims));
    }
    if (profileData.emotion_type) {
        sections.push(renderProfileSection('情感类型', 'mdi-emoticon', 'pink',
            profileData.emotion_type.tag, profileData.emotion_type.reason));
    }

    return sections.join('');
}

// 生成 Audiovisual 内容 HTML
function generateAudiovisualHTML(avData, autoEval) {
    if (!avData) return '';
    const sections = [];
    const ev = autoEval || null;

    function getEval(obj) {
        if (!obj) return null;
        const d = Array.isArray(obj) ? obj[0] : obj;
        if (!d || (d['得分'] == null && d['理由'] == null)) return null;
        return { score: d['得分'] ?? null, reason: d['理由'] || '', timeScore: d['time得分'] ?? null, timeReason: d['time理由'] || '' };
    }

    // 1. 总体评估摘要
    if (ev && (ev['总体评分'] || ev['总体评价'])) {
        const summary = (ev['总体评分'] ? `<b>${escapeHTML(ev['总体评分'])}</b> ` : '') + (ev['总体评价'] ? escapeHTML(ev['总体评价']) : '');
        sections.push(`<div class="p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800 leading-relaxed mb-4">
            <span class="text-[10px] font-bold text-blue-400 uppercase mr-1">自动评估总结</span>${summary}
        </div>`);
    }

    // 2. 总体质量
    const avIntegration = avData.audiovisual_integration || avData.visual_integration;
    if (avIntegration?.detail_quality) {
        const dq = avIntegration.detail_quality;
        sections.push(renderAVSection('总体质量', 'mdi-tune-variant', dq.level, dq.desc, false, getEval(ev?.audiovisual_integration?.detail_quality || ev?.visual_integration?.detail_quality)));
    } else {
        sections.push(renderAVSection('总体质量', 'mdi-tune-variant', '无', null, false, getEval(ev?.audiovisual_integration?.detail_quality || ev?.visual_integration?.detail_quality)));
    }

    // 3. 加工元素
    const vpe = avData.vision_quality?.visual_processing_elements;
    if (vpe && vpe.length > 0) {
        const items = vpe.map(el => {
            const timeStr = Array.isArray(el.time) ? `${formatTimeLink(el.time[0])}→${formatTimeLink(el.time[1])}` : '';
            return `<b>${escapeHTML(el.tag || '-')}</b>：${linkifyTime(escapeHTML(el.desc || ''))}` +
                (el.position ? ` <span class="text-gray-400">[${escapeHTML(el.position)}${el.area_ratio ? ', ' + escapeHTML(el.area_ratio) : ''}]</span>` : '') +
                (timeStr ? ` <span class="text-gray-400 font-mono text-[11px]">${timeStr}</span>` : '');
        }).join('<br>');
        sections.push(renderAVSection('加工元素', 'mdi-image-filter-center-focus', null, items, true, getEval(ev?.vision_quality?.visual_processing_elements)));
    } else {
        sections.push(renderAVSection('加工元素', 'mdi-image-filter-center-focus', '无', null, false, getEval(ev?.vision_quality?.visual_processing_elements)));
    }

    // 4. 构图
    const comp = avData.vision_quality?.composition;
    if (comp && comp.length > 0) {
        const items = comp.map(el => {
            const timeStr = Array.isArray(el.time) ? `${formatTimeLink(el.time[0])}→${formatTimeLink(el.time[1])}` : '';
            return `<b>${escapeHTML(el.tag || el.desc || '-')}</b>` +
                (el.desc && el.tag ? `：${linkifyTime(escapeHTML(el.desc))}` : '') +
                (timeStr ? ` <span class="text-gray-400 font-mono text-[11px]">${timeStr}</span>` : '');
        }).join('<br>');
        sections.push(renderAVSection('构图', 'mdi-grid', null, items, true, getEval(ev?.vision_quality?.composition)));
    } else {
        sections.push(renderAVSection('构图', 'mdi-grid', '无', null, false, getEval(ev?.vision_quality?.composition)));
    }

    // 5. 人物
    const man = avData.content_subject?.man_negative_content;
    if (man && man.length > 0) {
        sections.push(renderAVSection('人物', 'mdi-account', null, man.map(el => renderAVListItem(el)).join('<br>'), true, getEval(ev?.content_subject?.man_negative_content)));
    } else {
        sections.push(renderAVSection('人物', 'mdi-account', '无', null, false, getEval(ev?.content_subject?.man_negative_content)));
    }

    // 6. 生物
    const creature = avData.content_subject?.creature_negative_content;
    if (creature && creature.length > 0) {
        sections.push(renderAVSection('生物', 'mdi-paw', null, creature.map(el => renderAVListItem(el)).join('<br>'), true, getEval(ev?.content_subject?.creature_negative_content)));
    } else {
        sections.push(renderAVSection('生物', 'mdi-paw', '无', null, false, getEval(ev?.content_subject?.creature_negative_content)));
    }

    // 7. 信息属性
    const infoAttr = avData.information?.information_attributes;
    if (infoAttr && infoAttr.length > 0) {
        const items = infoAttr.map(el =>
            typeof el === 'string' ? escapeHTML(el) : renderAVListItem(el)
        ).join('<br>');
        sections.push(renderAVSection('信息属性', 'mdi-information', null, items, true, getEval(ev?.information?.information_attributes)));
    } else {
        sections.push(renderAVSection('信息属性', 'mdi-information', '无', null, false, getEval(ev?.information?.information_attributes)));
    }

    // 8. 真实性存疑
    const qi = avData.information?.questionable_info;
    if (qi) {
        sections.push(renderAVSection('真实性存疑', 'mdi-alert-circle', qi.has_issue ? '是' : '否', qi.desc !== '无' ? qi.desc : null, false, getEval(ev?.information?.questionable_info)));
    }

    // 9. 地理位置
    const geo = avData.information?.geographic_info;
    if (geo) {
        sections.push(renderAVSection('地理位置', 'mdi-map-marker', geo.has_info ? '有' : '无', geo.desc !== '无' ? geo.desc : null, false, getEval(ev?.information?.geographic_info)));
    }

    // 10. 时效性
    const tl = avData.information?.timeliness_info;
    if (tl) {
        sections.push(renderAVSection('时效性', 'mdi-clock', tl.has_info ? '有' : '无', tl.desc !== '无' ? tl.desc : null, false, getEval(ev?.information?.timeliness_info)));
    }

    // 11. 低俗意图
    const vi = avData.intent?.vulgar_intent;
    if (vi) {
        sections.push(renderAVSection('低俗/软色情意图', 'mdi-eye-off', vi.has_intent ? '是' : '否', vi.desc !== '无' ? vi.desc : null, false, getEval(ev?.intent?.vulgar_intent)));
    }

    // 12. 营销与引流意图
    const pi = avData.intent?.promotional_intent;
    if (pi && pi.length > 0) {
        const items = pi.map(el => renderAVListItem(el)).join('<br>');
        sections.push(renderAVSection('营销与引流意图', 'mdi-bullhorn', null, items, true, getEval(ev?.intent?.promotional_intent)));
    } else {
        sections.push(renderAVSection('营销与引流意图', 'mdi-bullhorn', '无', null, false, getEval(ev?.intent?.promotional_intent)));
    }

    // 13. 违背社会道德
    const iv = avData.values?.immoral_values;
    if (iv) {
        const catStr = iv.category && iv.category.length > 0 ? iv.category.join('、') : '';
        sections.push(renderAVSection('违背社会道德', 'mdi-scale-balance', iv.has_issue ? '是' : '否',
            (catStr ? `分类：${catStr}` : '') + (iv.desc !== '无' ? (catStr ? '；' : '') + iv.desc : '') || null, false, getEval(ev?.values?.immoral_values)));
    }

    return sections.join('');
}

// 刷新对比视图（切换任务时调用）
function refreshComparisonView() {
    const task = getCurrentTask();
    if (!task) return;
    const groupCount = task.model_outputs?.length || 0;
    if (groupCount < 2) {
        exitComparisonMode();
        return;
    }
    // clamp 选中的组索引
    state.comparisonGroups = state.comparisonGroups.map(g => Math.min(g, groupCount - 1));
    // 更新选择器选项 + 重新渲染
    document.querySelectorAll('#comparison-columns .comparison-column').forEach((col, ci) => {
        const select = col.querySelector('select');
        if (select) {
            select.innerHTML = '';
            for (let gi = 0; gi < groupCount; gi++) {
                const opt = document.createElement('option');
                opt.value = gi;
                opt.textContent = task.model_names?.[gi] || `模型${gi + 1}`;
                if (gi === state.comparisonGroups[ci]) opt.selected = true;
                select.appendChild(opt);
            }
        }
        const body = col.querySelector('.comp-body');
        if (body) renderComparisonColumn(body, task, state.comparisonGroups[ci]);
    });
    renderComparisonRatingGroupBtns(task);
}

function exitComparisonMode() {
    if (!state.comparisonMode) return;
    state.comparisonMode = false;

    // 退出 PiP
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
    }

    // 移除对比视图
    const compView = document.getElementById('comparison-view');
    if (compView) compView.remove();

    // 恢复所有带 data-prev-class 的元素
    document.querySelectorAll('[data-prev-class]').forEach(el => {
        el.className = el.dataset.prevClass;
        delete el.dataset.prevClass;
    });

    // 恢复 inspector 卡片内部内容
    document.querySelectorAll('[data-comp-hidden]').forEach(ch => {
        if (ch.dataset.compHidden !== 'was-hidden') {
            ch.classList.remove('hidden');
        }
        delete ch.dataset.compHidden;
    });

    // 重新渲染
    const task = getCurrentTask();
    if (task) {
        renderOutputGroupSwitcher(task);
        if (state.reviewMode === 'segment') {
            switchTab(state.currentTab);
        } else if (state.reviewMode === 'audiovisual') {
            renderAudiovisualContent();
        } else {
            renderProfileContent();
        }
    }
}

// 全局注册
window.toggleComparisonMode = toggleComparisonMode;
window.exitComparisonMode = exitComparisonMode;