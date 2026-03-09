// ============================================
// 视频审查工作台 - 主应用逻辑
// ============================================

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
    }
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

    // 刷新 UI
    renderWorkspaceSwitcher();
    restoreReviewMode();
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

function seekToTime(seconds) {
    elements.videoPlayer.currentTime = seconds;
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

function renderTabContent(tabName) {
    const task = getCurrentTask();
    if (!task) return;

    const output = task.model_output || {};
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
            <p class="text-[15px] text-gray-700 leading-relaxed">${seg.description || seg.text || '无文本'}</p>
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
            <p class="text-[15px] text-gray-700 leading-relaxed">${seg.visual || '无视觉描述'}</p>
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
        if (dockInput) dockInput.value = '';
        const noteInput = document.getElementById(`note-${dim}`);
        if (noteInput) noteInput.value = '';
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
    if (videoUrl.startsWith('http://')) {
        videoUrl = videoUrl.replace('http://', 'https://');
        console.log('视频URL已从HTTP转换为HTTPS');
    }
    elements.videoPlayer.src = videoUrl;
    elements.videoPlayer.load();

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
    if (state.reviewMode === 'segment') {
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
    
    if (groupCount === 0) {
        // 没有数据，隐藏切换器
        switcher.classList.add('hidden');
        return;
    }
    
    // 显示切换器
    switcher.classList.remove('hidden');
    
    // 渲染按钮 - 使用模型名称
    buttonsContainer.innerHTML = task.model_outputs.map((_, i) => {
        const reviewsArr = state.reviewMode === 'segment' ? task.reviews
            : state.reviewMode === 'audiovisual' ? task.audiovisualReviews
            : task.profileReviews;
        const review = reviewsArr?.[i];
        const isComplete = review?.completed;
        const isActive = i === state.currentOutputGroup;
        const modelName = task.model_names?.[i] || `模型${i + 1}`;
        
        return `
            <button onclick="switchOutputGroup(${i})" 
                    class="px-3 py-1 text-sm rounded ${isActive ? 'bg-blue-500 text-white' : 'bg-white border hover:bg-gray-100'}"
                    title="${modelName}">
                ${isComplete ? '<span class="mdi mdi-check text-green-500"></span>' : ''}
                ${modelName}
            </button>
        `;
    }).join('');
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

        return `
            <div class="task-item p-3 border-b cursor-pointer ${isActive ? 'active' : ''}"
                 onclick="selectTask(${index})">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <span class="mdi ${isComplete ? 'mdi-check-circle text-green-500' : 'mdi-circle-outline text-gray-300'} mr-2"></span>
                        <span class="text-sm font-medium truncate max-w-[150px] instant-tip" data-tip="${escapeHTML(displayName)}">${escapeHTML(displayName)}</span>
                    </div>
                    ${isComplete ? `<span class="text-xs text-yellow-500"><span class="mdi mdi-star"></span> ${avgRating}</span>` : ''}
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
            
            // 修复可能的 JSON 格式问题
            jsonStr = fixMissingCommas(jsonStr);
            
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

// 从 cot（chain-of-thought）字段提取结构化数据，作为 response 为空时的 fallback
function extractResponseFromCot(cot) {
    if (!cot || typeof cot !== 'string') return null;
    const text = cot.trim();
    if (!text) return null;

    // 先尝试从 cot 中提取 JSON 代码块或 <json_output> 标签
    const jsonBlocks = text.match(/```(?:json)?\s*\n([\s\S]*?)```/g);
    const jsonOutputTags = text.match(/<json_output>\s*([\s\S]*?)\s*<(?:\/json_output|json_output)>/g);
    const allBlocks = [];
    if (jsonBlocks) {
        for (const block of jsonBlocks) {
            allBlocks.push(block.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim());
        }
    }
    if (jsonOutputTags) {
        for (const tag of jsonOutputTags) {
            allBlocks.push(tag.replace(/<\/?json_output>/g, '').trim());
        }
    }
    for (const content of allBlocks) {
        try { return JSON.parse(content); } catch (_) {}
        try { return JSON.parse(pythonDictToJson(content)); } catch (_) {}
        try { return JSON.parse(tryFixTruncatedArray(content)); } catch (_) {}
    }

    // 解析 Markdown 步骤格式，提取分段信息
    // 支持两种格式：
    //   格式A（步骤式）：步骤1分段，步骤2文案，步骤3画面，步骤4关键帧
    //   格式B（分段列表式）：每段包含时间、文案、画面、关键帧
    const segments = [];

    // 格式B：按分段编号列表式（"1. **标题**：[start, end]" 或 "- 分段1：[0, 28]"）
    // 每个分段下方包含文案、画面、关键帧子项
    const segBlocks = text.split(/\n(?=\d+[\.\、）)]\s*\*{0,2})/);
    let foundListFormat = false;

    for (const block of segBlocks) {
        // 匹配分段头：数字. **标题**：[start, end] 或 数字. 标题 [start, end]
        const headerMatch = block.match(/^\d+[\.\、）)]\s*\*{0,2}([^*\n]*?)\*{0,2}\s*[:：]?\s*\[(\d+\.?\d*)\s*[,，]\s*(\d+\.?\d*)\]/);
        if (!headerMatch) continue;
        foundListFormat = true;

        const start = parseFloat(headerMatch[2]);
        const end = parseFloat(headerMatch[3]);

        // 提取文案（"文案："或"- 文案："后的内容）
        const textMatch = block.match(/(?:文案|文字|text)\s*[:：]\s*([\s\S]*?)(?=\n\s*[-*]?\s*(?:画面|视觉|visual|关键帧|key_frame|$))/i);
        const segText = textMatch ? textMatch[1].replace(/\n/g, ' ').trim().replace(/^[""]|[""]$/g, '') : '';

        // 提取画面描述（"画面描述："或"- 画面："后的内容）
        const visMatch = block.match(/(?:画面描述?|视觉描述?|visual|vis)\s*[:：]\s*([\s\S]*?)(?=\n\s*[-*]?\s*(?:关键帧|key_frame|$)|\n\n)/i);
        const segVis = visMatch ? visMatch[1].replace(/\n/g, ' ').trim() : '';

        // 提取关键帧
        const keyframes = [];
        const kfRegex = /(?:关键帧\d*|时间[点：:]?\s*)\s*[:：]?\s*(\d+\.?\d*)\s*秒?\s*[,，：:]\s*([\s\S]*?)(?=\n\s*(?:\d+[\.\、]|关键帧|时间点|\*|$)|\n\n|$)/gi;
        let kfMatch;
        while ((kfMatch = kfRegex.exec(block)) !== null) {
            keyframes.push({
                time: parseFloat(kfMatch[1]),
                label: kfMatch[2].replace(/\n/g, ' ').trim(),
                reason: ''
            });
        }

        segments.push({
            start, end,
            label: `片段 ${segments.length + 1}`,
            description: segText,
            visual: segVis,
            keyframes
        });
    }

    if (foundListFormat && segments.length > 0) {
        console.log(`从 cot 字段提取到 ${segments.length} 个分段（列表格式）`);
        return { _from_cot: true, segment_detail: segments.map(s => ({
            time: [s.start, s.end],
            text: s.description,
            vis: s.visual,
            key_frame: s.keyframes.map(kf => ({ time: kf.time, desc: kf.label }))
        }))};
    }

    // 格式A：步骤式，从各步骤中分别提取时间、文案、画面、关键帧
    // 步骤1/分段：提取时间范围
    const step1Match = text.match(/(?:步骤\s*1|分段|step\s*1)[\s\S]*?(?=###\s*步骤\s*2|###\s*(?:生成)?文案|$)/i);
    if (step1Match) {
        const timeRanges = [];
        const rangeRegex = /\[(\d+\.?\d*)\s*[,，]\s*(\d+\.?\d*)\]/g;
        let rm;
        while ((rm = rangeRegex.exec(step1Match[0])) !== null) {
            timeRanges.push([parseFloat(rm[1]), parseFloat(rm[2])]);
        }

        if (timeRanges.length > 0) {
            // 为每个分段初始化
            timeRanges.forEach((tr, i) => {
                segments.push({
                    start: tr[0], end: tr[1],
                    label: `片段 ${i + 1}`,
                    description: '', visual: '', keyframes: []
                });
            });

            // 步骤2/文案
            const step2Match = text.match(/(?:步骤\s*2|生成文案|step\s*2)[\s\S]*?(?=###\s*步骤\s*3|###\s*(?:生成)?画面|$)/i);
            if (step2Match) {
                const captions = step2Match[0].match(/(?:[""])([\s\S]*?)(?:[""])/g);
                if (captions) {
                    captions.forEach((c, i) => {
                        if (i < segments.length) {
                            segments[i].description = c.replace(/^[""]|[""]$/g, '').trim();
                        }
                    });
                } else {
                    // 只有一段且没有引号包裹：取整段文字
                    if (segments.length === 1) {
                        const lines = step2Match[0].split('\n').filter(l => l.trim() && !l.match(/^#+|^步骤/));
                        segments[0].description = lines.join(' ').trim().replace(/^[""]|[""]$/g, '');
                    }
                }
            }

            // 步骤3/画面
            const step3Match = text.match(/(?:步骤\s*3|生成画面|画面描述|step\s*3)[\s\S]*?(?=###\s*步骤\s*4|###\s*(?:抽取)?关键帧|$)/i);
            if (step3Match) {
                // 按段落拆分
                const visBlocks = step3Match[0].split(/\n(?=\d+[-\.\、）)]|\n)/);
                let visIdx = 0;
                for (const vb of visBlocks) {
                    const stripped = vb.replace(/^\d+[-\.\、）)]\s*/, '').replace(/^#+.*\n/, '').trim();
                    if (stripped && visIdx < segments.length) {
                        // 检查是否带时间范围开头
                        const timePrefix = stripped.match(/^(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*秒?\s*[,，：:]\s*/);
                        if (timePrefix) {
                            segments[visIdx].visual = stripped.slice(timePrefix[0].length).trim();
                        } else if (stripped.length > 20) {
                            segments[visIdx].visual = stripped;
                        }
                        visIdx++;
                    }
                }
                // 如果没拆到，但只有一段，取全部
                if (visIdx === 0 && segments.length === 1) {
                    const lines = step3Match[0].split('\n').filter(l => l.trim() && !l.match(/^#+|^步骤/));
                    segments[0].visual = lines.join(' ').trim();
                }
            }

            // 步骤4/关键帧
            const step4Match = text.match(/(?:步骤\s*4|抽取关键帧|关键帧|step\s*4)[\s\S]*?(?=###\s*步骤\s*5|###\s*结果|$)/i);
            if (step4Match) {
                const kfRegex2 = /(?:\d+[\.\、）)])?\s*(?:\*{2})?(?:时间[点：:]?\s*)?(\d+\.?\d*)\s*秒?\s*(?:\*{2})?(?:[,，：:])\s*([\s\S]*?)(?=\n\s*\d+[\.\、）)]|\n\s*\*{2}|$)/g;
                let km;
                while ((km = kfRegex2.exec(step4Match[0])) !== null) {
                    const kfTime = parseFloat(km[1]);
                    const kfDesc = km[2].replace(/\n/g, ' ').trim();
                    // 分配给最近的分段
                    for (let i = segments.length - 1; i >= 0; i--) {
                        if (kfTime >= segments[i].start) {
                            segments[i].keyframes.push({ time: kfTime, label: kfDesc, reason: '' });
                            break;
                        }
                    }
                }
            }

            if (segments.length > 0) {
                console.log(`从 cot 字段提取到 ${segments.length} 个分段（步骤格式）`);
                return { _from_cot: true, segment_detail: segments.map(s => ({
                    time: [s.start, s.end],
                    text: s.description,
                    vis: s.visual,
                    key_frame: s.keyframes.map(kf => ({ time: kf.time, desc: kf.label }))
                }))};
            }
        }
    }

    return null;
}

// 将 JSONL 对象转换为任务格式
function convertJsonlToTask(obj, index) {
    const rawId = obj.data_id || obj.nid || `task-${index + 1}`;
    const title = obj.title || obj.video_title || obj.name || '';
    const task = {
        id: title || rawId,
        rawId: rawId,
        video_url: (obj.videos && obj.videos[0]) || obj.video_url || ''
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
    if (typeof response === 'string') {
        let respStr = response.trim();
        if (!respStr) {
            response = null;
        } else {
            // 检测多代码块格式：```json ... ``` ```json ... ```
            let cleaned = respStr.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?json_output>/g, '').trim();
            const codeBlocks = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)```/g);
            if (codeBlocks && codeBlocks.length >= 2) {
                // 多代码块：分别解析，合并结果
                let merged = null;
                for (const block of codeBlocks) {
                    const content = block.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
                    let parsed = null;
                    try { parsed = JSON.parse(content); } catch (_) {}
                    if (!parsed) { try { parsed = JSON.parse(tryFixTruncatedArray(content)); } catch (_) {} }
                    if (!parsed) continue;
                    if (!merged) {
                        merged = Array.isArray(parsed) ? { segment_detail: parsed } : parsed;
                    } else {
                        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                            Object.assign(merged, parsed);
                        }
                    }
                }
                if (merged) { response = merged; }
                else { response = null; }
            } else {
                // 单块/无代码块：走原有逻辑
                respStr = extractJsonFromText(respStr);
                try {
                    response = JSON.parse(respStr);
                } catch (e) {
                    // 尝试剥离 Python 风格的 segment_output/segment_detail 外层包裹
                    const wrapperMatch = respStr.match(/^{['"](segment_output|segment_detail)['"]\s*:\s*/);
                    if (wrapperMatch) {
                        let inner = respStr.slice(wrapperMatch[0].length);
                        let depth = 0, inStr = false, strChar = '', esc = false, valueEnd = -1;
                        for (let ci = 0; ci < inner.length; ci++) {
                            const ch = inner[ci];
                            if (esc) { esc = false; continue; }
                            if (inStr) {
                                if (ch === '\\') { esc = true; continue; }
                                if (ch === strChar) { inStr = false; }
                                continue;
                            }
                            if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
                            if (ch === '[' || ch === '{') depth++;
                            else if (ch === ']' || ch === '}') {
                                depth--;
                                if (depth === 0) { valueEnd = ci; break; }
                            }
                        }
                        if (valueEnd !== -1) {
                            const valueStr = inner.substring(0, valueEnd + 1);
                            try {
                                const innerData = JSON.parse(valueStr);
                                response = { [wrapperMatch[1]]: innerData };
                            } catch (_) {
                                try {
                                    const innerData = JSON.parse(pythonDictToJson(valueStr));
                                    response = { [wrapperMatch[1]]: innerData };
                                } catch (_2) {
                                    response = null;
                                }
                            }
                        }
                    }
                    if (!response) {
                        let converted = pythonDictToJson(respStr);
                        try {
                            response = JSON.parse(converted);
                        } catch (e2) {
                            try {
                                response = JSON.parse(tryFixTruncatedArray(converted));
                            } catch (e3) {
                                console.warn(`第 ${index + 1} 行 response 字符串解析失败:`, e.message);
                                response = null;
                            }
                        }
                    }
                }
            }
        }
    }
    
    // response 为空时，尝试从 cot 字段提取数据
    if (!response && obj.cot) {
        response = extractResponseFromCot(obj.cot);
    }

    // response 可能是 null、数组或单个对象
    if (!response) {
        // 没有分段数据，仍然可以导入（只有视频）
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
            if (entries.length > 0 && /^\d/.test(entries[0][0])) {
                segmentData = entries.map(([k, v]) => {
                    // 解析 '0-29' 或 '0-29s' 为 time
                    const timeMatch = k.match(/^(\d+)\s*[-–]\s*(\d+)/);
                    const seg = typeof v === 'object' ? { ...v } : { text: String(v) };
                    if (timeMatch && !seg.time) {
                        seg.time = [parseFloat(timeMatch[1]), parseFloat(timeMatch[2])];
                    }
                    // 若段内无 key_frame，从顶层 key_frame 按时间匹配分配
                    if (!seg.key_frame && topKeyFrames.length > 0 && seg.time) {
                        const segStart = seg.time[0], segEnd = seg.time[1];
                        const matched = topKeyFrames.filter(kf => {
                            const t = typeof kf === 'string' ? parseFloat(kf) : (kf.time || 0);
                            return t >= segStart && t <= segEnd;
                        });
                        if (matched.length > 0) seg.key_frame = matched;
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

// 通用截断 JSON/数组修复：找到最后一个完整的 },] 或 } 闭合
function tryFixTruncatedArray(jsonStr) {
    // 找到第一个 [ 或 { 的位置，确定顶层结构
    const firstBracket = jsonStr.search(/[\[{]/);
    if (firstBracket === -1) throw new Error('无法修复：无 JSON 结构');

    // 逐字符扫描，找最后一个顶层括号完全匹配的位置
    let inString = false, escape = false;
    let stack = [];
    let lastCompleteTop = -1; // 最后一个使顶层闭合的位置
    let lastCompleteObj = -1; // 最后一个 braceCount==0 的 } 位置

    for (let i = firstBracket; i < jsonStr.length; i++) {
        const c = jsonStr[i];
        if (escape) { escape = false; continue; }
        if (c === '\\' && inString) { escape = true; continue; }
        if (c === '"' && !escape) { inString = !inString; continue; }
        if (inString) continue;

        if (c === '[' || c === '{') {
            stack.push(c);
        } else if (c === ']' || c === '}') {
            stack.pop();
            if (stack.length === 0) lastCompleteTop = i;
            if (c === '}' && stack.filter(s => s === '{').length === 0) lastCompleteObj = i;
        }
    }

    // 情况1：找到完整闭合位置，截取到那里
    if (lastCompleteTop !== -1) {
        return jsonStr.substring(firstBracket, lastCompleteTop + 1);
    }

    // 情况2：截断了，尝试找最后一个完整的对象，然后闭合所有括号
    if (lastCompleteObj !== -1) {
        let truncated = jsonStr.substring(firstBracket, lastCompleteObj + 1);
        // 去掉尾部逗号
        truncated = truncated.replace(/,\s*$/, '');
        // 统计未闭合的括号
        stack = [];
        inString = false; escape = false;
        for (let i = 0; i < truncated.length; i++) {
            const c = truncated[i];
            if (escape) { escape = false; continue; }
            if (c === '\\' && inString) { escape = true; continue; }
            if (c === '"' && !escape) { inString = !inString; continue; }
            if (inString) continue;
            if (c === '[' || c === '{') stack.push(c);
            else if (c === ']' || c === '}') stack.pop();
        }
        // 闭合剩余括号
        const closers = stack.reverse().map(s => s === '[' ? ']' : '}').join('');
        return truncated + closers;
    }

    throw new Error('无法修复：找不到完整的 JSON 元素');
}

// 尝试修复被截断的JSON（Excel单元格字符限制导致）
function tryFixTruncatedJson(jsonStr) {
    // 策略：只保留 segment_detail 数组，忽略 global_profile
    // 因为我们只关心 segment_detail 中的数据
    
    // 查找 segment_detail 数组的结束位置
    const segmentDetailMatch = jsonStr.match(/"segment_detail"\s*:\s*\[/);
    if (!segmentDetailMatch) {
        // 没有找到 segment_detail，无法修复
        throw new Error('无法修复：未找到 segment_detail');
    }
    
    const startIndex = segmentDetailMatch.index + segmentDetailMatch[0].length;
    
    // 尝试找到 segment_detail 数组的完整结束
    let bracketCount = 1;
    let inString = false;
    let escape = false;
    let arrayEndIndex = -1;
    
    for (let i = startIndex; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        
        if (escape) {
            escape = false;
            continue;
        }
        
        if (char === '\\' && inString) {
            escape = true;
            continue;
        }
        
        if (char === '"' && !escape) {
            inString = !inString;
            continue;
        }
        
        if (!inString) {
            if (char === '[') {
                bracketCount++;
            } else if (char === ']') {
                bracketCount--;
                if (bracketCount === 0) {
                    arrayEndIndex = i;
                    break;
                }
            }
        }
    }
    
    if (arrayEndIndex !== -1) {
        // segment_detail 数组是完整的，只取这部分
        const segmentDetailContent = jsonStr.substring(startIndex, arrayEndIndex);
        return `{"segment_detail":[${segmentDetailContent}]}`;
    }
    
    // segment_detail 数组不完整，尝试找到最后一个完整的对象
    // 从后往前找最后一个完整的 } 或 }]
    let lastCompleteIndex = -1;
    bracketCount = 0;
    let braceCount = 0;
    inString = false;
    escape = false;
    
    for (let i = startIndex; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        
        if (escape) {
            escape = false;
            continue;
        }
        
        if (char === '\\' && inString) {
            escape = true;
            continue;
        }
        
        if (char === '"' && !escape) {
            inString = !inString;
            continue;
        }
        
        if (!inString) {
            if (char === '[') bracketCount++;
            else if (char === ']') bracketCount--;
            else if (char === '{') braceCount++;
            else if (char === '}') {
                braceCount--;
                // 当所有打开的花括号都关闭时，记录位置
                if (braceCount === 0 && bracketCount >= 0) {
                    lastCompleteIndex = i;
                }
            }
        }
    }
    
    if (lastCompleteIndex !== -1) {
        // 找到最后一个完整对象的位置
        const segmentDetailContent = jsonStr.substring(startIndex, lastCompleteIndex + 1);
        // 检查是否需要去掉末尾的逗号
        const trimmed = segmentDetailContent.replace(/,\s*$/, '');
        return `{"segment_detail":[${trimmed}]}`;
    }
    
    throw new Error('无法修复：无法找到完整的 segment_detail 内容');
}

// 修复字符串内容中未转义的双引号（如中文文本中用作书名号的引号）
function fixUnescapedQuotesInContent(jsonStr) {
    // 问题：中文文本中经常用英文双引号作为书名号，如 "通过"提出认知目标""
    // 这会导致JSON解析失败，因为解析器认为字符串在第一个"处结束了
    
    // 策略：检测在中文字符之间的双引号，将其转义
    // 中文字符范围：\u4e00-\u9fff (CJK统一汉字)
    
    let result = '';
    let i = 0;
    
    while (i < jsonStr.length) {
        const char = jsonStr[i];
        
        if (char === '"') {
            // 检查这个引号是否在中文内容中
            // 条件：前面是中文字符，且这不是键名开始或值结束的位置
            const prevChar = i > 0 ? jsonStr[i - 1] : '';
            const nextChar = i < jsonStr.length - 1 ? jsonStr[i + 1] : '';
            
            // 检测中文字符
            const isChinese = (c) => /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(c);
            const isStructural = (c) => /[{}\[\]:,\s]/.test(c);
            
            // 如果前一个字符是中文，且后一个字符也是中文或中文标点，
            // 那么这个引号很可能是内容中的书名号
            if (isChinese(prevChar) && (isChinese(nextChar) || /[，。、；：！？]/.test(nextChar))) {
                result += '\\"';
            }
            // 如果前一个字符是中文，后一个不是结构性字符（如逗号、冒号、括号）
            // 也可能是书名号的开始
            else if (isChinese(prevChar) && !isStructural(nextChar) && nextChar !== '"') {
                result += '\\"';
            }
            // 如果后一个字符是中文，前一个不是结构性字符
            // 可能是书名号的结束
            else if (isChinese(nextChar) && !isStructural(prevChar) && prevChar !== '\\') {
                // 检查前面是否已经有转义符
                if (result.length > 0 && result[result.length - 1] !== '\\') {
                    result += '\\"';
                } else {
                    result += char;
                }
            }
            // 新增：处理连续书名号的情况，如 "爸爸""爷爷"
            // 前一个是引号，后一个是中文，说明这是连续书名号的开始
            else if (prevChar === '"' && isChinese(nextChar)) {
                result += '\\"';
            }
            // 前一个是中文，后一个是引号，说明这是连续书名号的结束
            else if (isChinese(prevChar) && nextChar === '"') {
                result += '\\"';
            }
            else {
                result += char;
            }
        } else {
            result += char;
        }
        i++;
    }
    
    return result;
}

// 修复缺少逗号的非标准JSON（如 "key": "value"\n"key2": "value2"）
function fixMissingCommas(jsonStr) {
    let result = jsonStr;
    
    // 先修复中文标点符号
    // 中文冒号 -> 英文冒号（只在键后面，即 "key"：的形式）
    result = result.replace(/"：/g, '":');
    
    // 修复字符串内容中未转义的双引号
    result = fixUnescapedQuotesInContent(result);
    
    // 模式1: "value"\n"key" -> "value",\n"key"
    result = result.replace(/(")\s*\n\s*(")/g, '$1,\n$2');
    
    // 模式2: }\n"key" -> },\n"key"
    result = result.replace(/(})\s*\n\s*(")/g, '$1,\n$2');
    
    // 模式3: ]\n"key" -> ],\n"key"
    result = result.replace(/(])\s*\n\s*(")/g, '$1,\n$2');
    
    // 模式4: "value" "key" (同一行，缺少逗号)
    result = result.replace(/(")\s+(")/g, '$1, $2');
    
    // 模式5: } "key" (同一行)
    result = result.replace(/(})\s+(")/g, '$1, $2');
    
    // 模式6: ] "key" (同一行)
    result = result.replace(/(])\s+(")/g, '$1, $2');
    
    return result;
}

// 修复多余的闭合括号（如 "summary": "..."\n}\n"intent_type"）
function fixExtraBraces(jsonStr) {
    // 检测并修复 }\n"key": 模式中多余的 }
    // 这种情况是：在字符串值后面错误地添加了 }
    let result = jsonStr;
    
    // 查找 "...",\n}\n"key": 这种模式，去掉多余的 }
    // 但要保留正确的 },\n"key": 模式
    
    // 通过遍历来精确处理
    let output = '';
    let i = 0;
    let braceStack = 0;
    let bracketStack = 0;
    let inString = false;
    let escape = false;
    
    while (i < result.length) {
        const char = result[i];
        
        if (escape) {
            output += char;
            escape = false;
            i++;
            continue;
        }
        
        if (char === '\\' && inString) {
            output += char;
            escape = true;
            i++;
            continue;
        }
        
        if (char === '"') {
            inString = !inString;
            output += char;
            i++;
            continue;
        }
        
        if (!inString) {
            if (char === '{') {
                braceStack++;
                output += char;
            } else if (char === '}') {
                braceStack--;
                // 检查是否是多余的 }
                // 情况1：braceStack < 0，明显多余
                // 情况2：braceStack == 0（顶层对象刚关闭），但后面还有 "key": 模式，说明对象提前关闭了
                if (braceStack <= 0) {
                    // 检查后面是否还有 "key": 的模式（跳过空白和可能的逗号）
                    const remaining = result.substring(i + 1).trim();
                    // 匹配 "key" 或 ,"key" 模式（表示后面还有JSON内容）
                    if (remaining.match(/^,?\s*"[^"]+"\s*:/)) {
                        // 后面还有键值对，说明这个 } 是多余的
                        braceStack = braceStack < 0 ? 0 : 1; // 恢复到正确的层级
                        i++;
                        continue;
                    }
                }
                output += char;
            } else if (char === '[') {
                bracketStack++;
                output += char;
            } else if (char === ']') {
                bracketStack--;
                output += char;
            } else {
                output += char;
            }
        } else {
            output += char;
        }
        i++;
    }
    
    return output;
}

// 清理JSON字符串中的控制字符和特殊字符
function cleanJsonControlChars(jsonStr) {
    // 方法1: 先尝试简单清理 - 移除JSON结构之外的换行和空白，保留字符串值内容
    // 把多行JSON压缩成单行，同时保护字符串值中的内容
    
    let result = '';
    let inString = false;
    let escape = false;
    
    for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        const code = jsonStr.charCodeAt(i);
        
        // 处理转义状态
        if (escape) {
            result += char;
            escape = false;
            continue;
        }
        
        // 检测转义字符
        if (char === '\\' && inString) {
            escape = true;
            result += char;
            continue;
        }
        
        // 检测字符串边界
        if (char === '"') {
            inString = !inString;
            result += char;
            continue;
        }
        
        // 处理字符
        if (inString) {
            // 在字符串内部：清理控制字符
            if (code < 32) {
                if (char === '\n') {
                    result += '\\n';
                } else if (char === '\r') {
                    // 跳过回车符（通常和换行符一起出现）
                    continue;
                } else if (char === '\t') {
                    result += '\\t';
                } else {
                    // 其他控制字符直接跳过
                    continue;
                }
            } else if (code === 0x2028 || code === 0x2029 || code === 0x0085) {
                // Unicode换行符
                result += '\\n';
            } else if (code >= 0x7F && code <= 0x9F) {
                // C1控制字符，跳过
                continue;
            } else {
                result += char;
            }
        } else {
            // 不在字符串内部：结构性字符
            if (char === '\n' || char === '\r') {
                // 结构性换行，可以用空格替代或直接跳过
                // 跳过，因为JSON结构不需要换行
                continue;
            } else if (char === '\t' || char === ' ') {
                // 缩进空白，可以跳过或保留一个空格
                // 如果上一个字符已经是空格，跳过
                if (result.length > 0 && result[result.length - 1] === ' ') {
                    continue;
                }
                result += ' ';
            } else if (code < 32) {
                // 其他控制字符，跳过
                continue;
            } else {
                result += char;
            }
        }
    }
    
    return result;
}

// 清理JSON末尾的非JSON内容（如Python字典格式的内容）
function cleanJsonTrailingContent(jsonStr) {
    // 如果以数组开头，找到数组结束位置
    if (jsonStr.trim().startsWith('[')) {
        let bracketCount = 0;
        let inString = false;
        let escape = false;
        
        for (let i = 0; i < jsonStr.length; i++) {
            const char = jsonStr[i];
            
            if (escape) {
                escape = false;
                continue;
            }
            
            if (char === '\\' && inString) {
                escape = true;
                continue;
            }
            
            if (char === '"' && !escape) {
                inString = !inString;
                continue;
            }
            
            if (!inString) {
                if (char === '[') bracketCount++;
                else if (char === ']') {
                    bracketCount--;
                    if (bracketCount === 0) {
                        // 找到数组结束位置，截取
                        return jsonStr.substring(0, i + 1);
                    }
                }
            }
        }
    }
    
    // 如果以对象开头，找到对象结束位置
    if (jsonStr.trim().startsWith('{')) {
        let braceCount = 0;
        let inString = false;
        let escape = false;
        
        for (let i = 0; i < jsonStr.length; i++) {
            const char = jsonStr[i];
            
            if (escape) {
                escape = false;
                continue;
            }
            
            if (char === '\\' && inString) {
                escape = true;
                continue;
            }
            
            if (char === '"' && !escape) {
                inString = !inString;
                continue;
            }
            
            if (!inString) {
                if (char === '{') braceCount++;
                else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        // 找到对象结束位置，截取
                        return jsonStr.substring(0, i + 1);
                    }
                }
            }
        }
    }
    
    return jsonStr;
}

// 解析单个JSON单元格
// 将 Python dict repr 字符串转换为合法 JSON 字符串
// 逐字符解析，正确处理三种引号模式：
//  1. 'key': 'value'              — 普通单引号
//  2. 'desc': \"value with 'x'\"    — 转义双引号包含撇号
//  3. 'desc': "value with \"x\" quotes" — 双引号字符串包含中文书名号等
function pythonDictToJson(s) {
    s = s.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
    const result = [];
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === "'") {
            // 单引号字符串：收集到匹配的闭合单引号
            result.push('"');
            i++;
            while (i < s.length) {
                const c2 = s[i];
                if (c2 === "'") { result.push('"'); i++; break; }
                else if (c2 === '\\' && i + 1 < s.length) {
                    const nc = s[i + 1];
                    if (nc === "'")       { result.push("'"); i += 2; }      // \' → '
                    else if (nc === '"')  { result.push('\\"'); i += 2; }     // \" → \"
                    else if (nc === '\\') { result.push('\\\\'); i += 2; }    // \\ → \\
                    else { result.push(c2, nc); i += 2; }
                }
                else if (c2 === '"') { result.push('\\"'); i++; }            // 裸双引号 → 转义
                else { result.push(c2); i++; }
            }
        } else if (c === '"') {
            // 双引号字符串：收集到匹配的闭合双引号
            result.push('"');
            i++;
            while (i < s.length) {
                const c2 = s[i];
                if (c2 === '"') { result.push('"'); i++; break; }
                else if (c2 === '\\' && i + 1 < s.length) { result.push(c2, s[i + 1]); i += 2; }
                else { result.push(c2); i++; }
            }
        } else {
            result.push(c);
            i++;
        }
    }
    return result.join('');
}

// 从模型输出文本中提取 JSON/dict 内容（剥离思考链、XML 标签、markdown 代码块）
function extractJsonFromText(s) {
    // 移除 <think>...</think>
    s = s.replace(/<think>[\s\S]*?<\/think>/g, '');
    // 移除 <json_output> 标签
    s = s.replace(/<\/?json_output>/g, '');
    // 处理 <json> 或 <json 标签包裹的内容
    // 格式变体：<json>{...}</json>  |  <json>\n```json{...}```\n</json>  |  <json{...}</json>  |  <json{...}
    // 先尝试提取 <json>...</json> 或 <json...</json> 块中的内容
    const jsonTagMatch = s.match(/<json\s*>?\s*([\s\S]*?)\s*<\/json>/i);
    if (jsonTagMatch) {
        s = jsonTagMatch[1];
    } else {
        // 没有闭合的 </json>，移除开头的 <json> 或 <json（无 >）
        s = s.replace(/^<json\s*>?\s*/i, '');
        s = s.replace(/\s*<\/json>\s*$/i, '');
    }
    s = s.trim();
    // 移除 markdown 代码块
    s = s.replace(/^```(?:json)?\s*\n?/, '');
    s = s.replace(/\n?```\s*$/, '');
    return s.trim();
}

function parseJsonCell(cellValue, taskIndex, colIndex) {
    if (!cellValue) return null;

    // 如果已经是对象，直接使用
    if (typeof cellValue === 'object' && cellValue !== null) {
        return normalizeModelOutput(cellValue);
    }

    // 尝试解析JSON字符串
    try {
        let jsonStr = cellValue.toString();

        // 清理可能的BOM字符
        jsonStr = jsonStr.replace(/^\uFEFF/, '');

        // 检测多代码块格式：```json ... ``` ```json ... ```（含 segment + profile）
        let cleaned = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?json_output>/g, '').replace(/<\/?json\s*>/g, '').trim();
        const codeBlocks = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)```/g);
        if (codeBlocks && codeBlocks.length >= 2) {
            let merged = null;
            for (const block of codeBlocks) {
                const content = block.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
                let parsed = null;
                try { parsed = JSON.parse(content); } catch (_) {}
                if (!parsed) { try { parsed = JSON.parse(tryFixTruncatedArray(content)); } catch (_) {} }
                if (!parsed) continue;
                if (!merged) {
                    merged = Array.isArray(parsed) ? { segment_detail: parsed } : parsed;
                } else {
                    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                        Object.assign(merged, parsed);
                    }
                }
            }
            if (merged) return normalizeModelOutput(merged);
        }

        // 提取 JSON/dict 内容（剥离 <think>、<json_output>、markdown 代码块等）
        jsonStr = extractJsonFromText(jsonStr);

        // 如果为空，返回null
        if (!jsonStr) return null;

        // 如果字符串被双引号包裹（Excel常见行为），去掉外层引号
        if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
            jsonStr = jsonStr.slice(1, -1);
            jsonStr = jsonStr.replace(/""/g, '"');
        }

        // 如果字符串以单引号包裹，去掉单引号
        if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) {
            jsonStr = jsonStr.slice(1, -1);
        }

        // 先尝试直接解析标准 JSON
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch (e1) {
            // 尝试剥离 segment_output/segment_detail 外层包裹（Python 风格混合引号）
            const wrapperMatch = jsonStr.match(/^{['"](segment_output|segment_detail)['"]\s*:\s*/);
            if (wrapperMatch) {
                let inner = jsonStr.slice(wrapperMatch[0].length);
                let depth = 0, inStr = false, strChar = '', esc = false, valueEnd = -1;
                for (let ci = 0; ci < inner.length; ci++) {
                    const ch = inner[ci];
                    if (esc) { esc = false; continue; }
                    if (inStr) { if (ch === '\\') { esc = true; continue; } if (ch === strChar) { inStr = false; } continue; }
                    if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
                    if (ch === '[' || ch === '{') depth++;
                    else if (ch === ']' || ch === '}') { depth--; if (depth === 0) { valueEnd = ci; break; } }
                }
                if (valueEnd !== -1) {
                    const valueStr = inner.substring(0, valueEnd + 1);
                    try { parsed = { [wrapperMatch[1]]: JSON.parse(valueStr) }; }
                    catch (_) { try { parsed = { [wrapperMatch[1]]: JSON.parse(pythonDictToJson(valueStr)) }; } catch (_2) {} }
                }
            }
            if (!parsed) {
            // 尝试修复常见 JSON 格式问题后再解析
            let fixedStr = fixMissingCommas(jsonStr);
            fixedStr = fixExtraBraces(fixedStr);
            fixedStr = cleanJsonControlChars(fixedStr);
            fixedStr = cleanJsonTrailingContent(fixedStr);
            try {
                parsed = JSON.parse(fixedStr);
            } catch (e2) {
                // 尝试 Python dict → JSON 转换（逐字符解析，处理所有引号模式）
                try {
                    parsed = JSON.parse(pythonDictToJson(jsonStr));
                } catch (e3) {
                    // 最后尝试修复截断的 JSON
                    console.warn(`任务 ${taskIndex + 1} 第${colIndex}列 多次解析失败，尝试修复截断...`);
                    const fixedJson = tryFixTruncatedJson(jsonStr);
                    parsed = JSON.parse(fixedJson);
                }
            }
            }
        }
        return normalizeModelOutput(parsed);
    } catch (e) {
        console.warn(`任务 ${taskIndex + 1} 第${colIndex}列 JSON解析失败:`, e.message);
        return null;
    }
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

    // 第一行为表头，智能检测各列含义
    const headerRow = rows[0];

    // 检测是否有 nid 列（第一列表头含 nid/id/编号）
    const firstHeader = headerRow[0]?.toString().trim().toLowerCase() || '';
    const nidKeywords = ['nid', 'data_id', '编号'];
    const hasNidCol = nidKeywords.some(kw => firstHeader === kw || firstHeader.includes(kw));
    const urlCol = hasNidCol ? 1 : 0; // 视频链接列
    console.log('NID列检测:', hasNidCol ? `第1列为NID列 ("${headerRow[0]}")` : '无NID列');

    // 检测标题列（紧跟 URL 列之后）
    const titleKeywords = ['标题', '视频标题', 'title', '名称', '视频名称'];
    const titleCheckCol = urlCol + 1;
    const titleCheckHeader = headerRow[titleCheckCol]?.toString().trim().toLowerCase() || '';
    const hasTitleCol = titleKeywords.some(kw => titleCheckHeader.includes(kw.toLowerCase()));
    const dataStartCol = hasTitleCol ? titleCheckCol + 1 : titleCheckCol; // 模型输出数据起始列
    console.log('标题列检测:', hasTitleCol ? `第${titleCheckCol + 1}列为标题列 ("${headerRow[titleCheckCol]}")` : '无标题列');

    const modelNames = [];
    // 检测是否有自动评估列（表头含"评估"/"eval"关键词）
    const evalKeywords = ['评估', '自动评估', 'eval', 'evaluation', '评测'];
    let evalColIndex = -1; // 评估数据列号（0-based in row array）
    for (let col = dataStartCol; col < headerRow.length; col++) {
        const h = headerRow[col]?.toString().trim().toLowerCase() || '';
        if (evalKeywords.some(kw => h.includes(kw.toLowerCase()))) {
            evalColIndex = col;
            console.log(`自动评估列检测: 第${col + 1}列 ("${headerRow[col]}")`);
        } else {
            modelNames.push(headerRow[col]?.toString().trim() || `模型${col}`);
        }
    }
    console.log('模型名称列表:', modelNames);
    
    // 数据从第二行开始
    const dataRows = rows.slice(1);
    const startRowIndex = 2; // Excel行号从1开始，数据从第2行开始
    
    return dataRows.map((row, i) => {
        // 提取 nid（用于排序和合并），处理科学计数法大数字
        let nid = hasNidCol && row[0] ? String(row[0]).trim() : '';
        if (nid && /^[\d.]+e\+?\d+$/i.test(nid)) {
            // 科学计数法转整数字符串
            try { nid = BigInt(Math.round(Number(nid))).toString(); } catch (_) {}
        }
        // 提取标题
        const titleColIdx = urlCol + 1;
        const title = hasTitleCol && row[titleColIdx] ? String(row[titleColIdx]).trim() : '';
        const obj = { id: title || nid || `task-${i + 1}`, rawId: nid || `task-${i + 1}` };
        const excelRowNum = startRowIndex + i;
        // URL 列地址（A 或 B）
        const urlColLetter = String.fromCharCode(65 + urlCol); // 0->A, 1->B
        const cellAddress = `${urlColLetter}${excelRowNum}`;
        const cell = worksheet[cellAddress];

        // 获取URL：优先从超链接Target获取，否则用单元格值
        let videoUrl = '';

        if (cell) {
            // 方法1：检查单元格的超链接对象
            if (cell.l && cell.l.Target) {
                videoUrl = cell.l.Target;
                console.log(`任务 ${i + 1} 从超链接获取URL`);
            }
            // 方法2：从单元格值获取（可能本身就是URL文本）
            else if (cell.v) {
                videoUrl = String(cell.v).trim();
                console.log(`任务 ${i + 1} 从cell.v获取URL`);
            }
            else if (cell.w) {
                videoUrl = String(cell.w).trim();
                console.log(`任务 ${i + 1} 从cell.w获取URL`);
            }
        }

        // 方法3：从rows数组获取（备用）
        if (!videoUrl && row[urlCol]) {
            videoUrl = String(row[urlCol]).trim();
            console.log(`任务 ${i + 1} 从row[${urlCol}]获取URL`);
        }
        
        obj.video_url = videoUrl;
        console.log(`任务 ${i + 1}: URL=${videoUrl.substring(0, 80)}...`);
        
        // 从数据起始列开始解析模型输出JSON数据
        obj.model_outputs = [];
        obj.model_names = [];
        let modelNameIdx = 0;

        for (let col = dataStartCol; col < row.length; col++) {
            if (col === evalColIndex) continue; // 跳过评估列
            const parsed = parseJsonCell(row[col], i, col + 1);
            // 支持分段语义详情(segments)或全篇语义画像(profile)数据
            if (parsed && ((parsed.segments && parsed.segments.length > 0) || parsed.profile || parsed.audiovisual)) {
                obj.model_outputs.push(parsed);
                obj.model_names.push(modelNames[modelNameIdx] || `模型${col}`);
            }
            modelNameIdx++;
        }

        // 解析自动评估列
        if (evalColIndex >= 0 && row[evalColIndex]) {
            try {
                const evalStr = extractJsonFromText(String(row[evalColIndex]));
                obj.autoEval = JSON.parse(evalStr);
            } catch (e) {
                try {
                    obj.autoEval = JSON.parse(pythonDictToJson(String(row[evalColIndex])));
                } catch (e2) {
                    console.warn(`任务 ${i + 1} 自动评估数据解析失败:`, e2.message);
                }
            }
        }
        
        // 兼容旧格式：model_output 指向第一组数据
        obj.model_output = obj.model_outputs[0] || {};
        
        // 初始化每组数据的评分
        obj.reviews = obj.model_outputs.map(() => null);
        obj.profileReviews = obj.model_outputs.map(() => null);
        obj.audiovisualReviews = obj.model_outputs.map(() => null);
        
        console.log(`任务 ${i + 1}: URL=${obj.video_url}, 数据组数=${obj.model_outputs.length}`);
        
        return obj;
    }).filter(task => task.video_url); // 过滤掉没有URL的行
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
    
    // 情况2：有 segment_detail 字段
    if (data.segment_detail && Array.isArray(data.segment_detail)) {
        output.segments = convertSegmentArray(data.segment_detail);
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
        return task;
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
    const profileData = task.model_outputs?.[state.currentOutputGroup]?.profile || 
                        task.model_output?.profile || 
                        null;
    
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

    const avData = task.model_outputs?.[state.currentOutputGroup]?.audiovisual
        || task.model_output?.audiovisual
        || null;

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
    if (avData.audiovisual_integration?.detail_quality) {
        const dq = avData.audiovisual_integration.detail_quality;
        sections.push(renderAVSection('总体质量', 'mdi-tune-variant', dq.level, dq.desc, false,
            getEval(ev?.audiovisual_integration?.detail_quality)));
    } else {
        sections.push(renderAVSection('总体质量', 'mdi-tune-variant', '无', null, false,
            getEval(ev?.audiovisual_integration?.detail_quality)));
    }

    // 2. 加工元素
    const vpe = avData.vision_quality?.visual_processing_elements;
    if (vpe && vpe.length > 0) {
        const items = vpe.map(el => {
            const timeStr = Array.isArray(el.time) ? `${formatTime(el.time[0])}→${formatTime(el.time[1])}` : '';
            return `<b>${escapeHTML(el.tag || '-')}</b>：${escapeHTML(el.desc || '')}` +
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
            const timeStr = Array.isArray(el.time) ? `${formatTime(el.time[0])}→${formatTime(el.time[1])}` : '';
            return `<b>${escapeHTML(el.tag || el.desc || '-')}</b>` +
                (el.desc && el.tag ? `：${escapeHTML(el.desc)}` : '') +
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
            ${content ? `<div class="text-[15px] text-gray-700 leading-relaxed">${isHtml ? content : escapeHTML(content)}</div>` : ''}
            ${evalHtml}
        </div>
    `;
}

function renderAVListItem(el) {
    const parts = [];
    if (el.tag) parts.push(`<b>${escapeHTML(el.tag)}</b>`);
    if (el.desc) parts.push(escapeHTML(el.desc));
    if (el.position) parts.push(`<span class="text-gray-400">[${escapeHTML(el.position)}]</span>`);
    if (Array.isArray(el.time)) {
        parts.push(`<span class="text-gray-400 font-mono text-[11px]">${formatTime(el.time[0])}→${formatTime(el.time[1])}</span>`);
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
        const noteInput = document.getElementById(`note-${dim.key}`);
        if (noteInput) noteInput.value = '';
    });
}

function setAudiovisualRating(dimension, value) {
    state.audiovisualRatings[dimension] = value;
    document.querySelectorAll(`.rating-group[data-dimension="${dimension}"][data-mode="audiovisual"]`).forEach(group => {
        highlightProfileStars(group, value);
    });
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
        if (dockInput) dockInput.value = '';
        const noteInput = document.getElementById(`note-${dim.key}`);
        if (noteInput) noteInput.value = '';
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
                if (dockInput) dockInput.value = state.notes[dim] || '';
                const noteInput = document.getElementById(`note-${dim}`);
                if (noteInput) noteInput.value = state.notes[dim] || '';
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
                if (dockInput) dockInput.value = state.audiovisualNotes[dim.key] || '';
                const noteInput = document.getElementById(`note-${dim.key}`);
                if (noteInput) noteInput.value = state.audiovisualNotes[dim.key] || '';
            });
        } else {
            // 无人工评审，尝试从自动评估预填
            resetAudiovisualRatings();
            const ev = task.autoEval;
            if (ev) {
                const evalMap = {
                    overall_quality:          ev.audiovisual_integration?.detail_quality,
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
                        if (dockInput) dockInput.value = reason;
                        const noteInput = document.getElementById(`note-${dim.key}`);
                        if (noteInput) noteInput.value = reason;
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
                if (dockInput) dockInput.value = state.profileNotes[dim.key] || '';
                const noteInput = document.getElementById(`note-${dim.key}`);
                if (noteInput) noteInput.value = state.profileNotes[dim.key] || '';
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
    if (data.vision_quality || data.audiovisual_integration || data.content_subject) {
        output.audiovisual = data;
    }

    // 如果没有任何有效数据，返回原数据
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