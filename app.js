// ============================================
// 视频审查工作台 - 主应用逻辑
// ============================================

// 全局状态
const state = {
    // 分段语义详情任务
    segmentTasks: [],
    segmentTaskIndex: -1,
    // 全篇语义画像任务
    profileTasks: [],
    profileTaskIndex: -1,
    // 当前模式
    currentOutputGroup: 0,  // 当前数据组索引
    currentTab: 'text',     // 当前标签页（text 或 visual）
    reviewMode: 'segment',  // 审核模式：segment（分段语义详情）或 profile（全篇语义画像）
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
    }
};

// 获取当前模式的任务列表
function getTasks() {
    return state.reviewMode === 'segment' ? state.segmentTasks : state.profileTasks;
}

// 获取当前模式的任务索引
function getTaskIndex() {
    return state.reviewMode === 'segment' ? state.segmentTaskIndex : state.profileTaskIndex;
}

// 设置当前模式的任务索引
function setTaskIndex(index) {
    if (state.reviewMode === 'segment') {
        state.segmentTaskIndex = index;
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
    loadFromLocalStorage();
    updateUI();
    restoreSidebarState();
    restoreRatingPanelState();
    restoreReviewMode();
    console.log('初始化完成');
});

// 强制清除所有数据（用于调试）
function forceReset() {
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
    location.reload();
}
window.forceReset = forceReset;

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

    // 严格只显示每个分段的开始时间作为分界点
    const boundaryTimes = new Set();
    segments.forEach((seg) => {
        boundaryTimes.add(seg.start);
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
    
    const groupCount = task.model_outputs?.length || 1;
    const taskLabel = document.getElementById('current-task-label');
    if (taskLabel) {
        taskLabel.textContent = `任务 ${index + 1}/${tasks.length}` + 
            (groupCount > 1 ? ` (${groupCount}组数据)` : '');
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
        // 只有一组或没有数据，隐藏切换器
        switcher.classList.add('hidden');
        return;
    }
    
    // 显示切换器
    switcher.classList.remove('hidden');
    
    // 渲染按钮 - 使用模型名称
    buttonsContainer.innerHTML = task.model_outputs.map((_, i) => {
        const review = task.reviews?.[i];
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

// 保存当前数据组的评分
function saveReviewForCurrentGroup() {
    const task = getCurrentTask();
    if (!task) return;
    
    // 收集每个维度的备注
    ['time', 'text', 'visual', 'keyframe'].forEach(dim => {
        const noteInput = document.getElementById(`note-${dim}`);
        if (noteInput) state.notes[dim] = noteInput.value;
    });
    
    // 确保 reviews 数组存在
    if (!task.reviews) {
        task.reviews = task.model_outputs?.map(() => null) || [null];
    }
    
    // 保存到当前组
    task.reviews[state.currentOutputGroup] = {
        ratings: { ...state.ratings },
        notes: { ...state.notes },
        completed: Object.values(state.ratings).some(r => r > 0), // 只要有评分就标记为已完成
        timestamp: new Date().toISOString()
    };
}

// 加载当前数据组的评分
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
    
    // 检查是否有多组数据
    const groupCount = task.model_outputs?.length || 1;
    
    if (groupCount > 1) {
        // 检查是否还有未完成的数据组
        const nextIncompleteGroup = task.reviews?.findIndex((r, i) => i > state.currentOutputGroup && !r?.completed);
        
        if (nextIncompleteGroup !== -1) {
            // 跳转到下一个未完成的数据组
            switchOutputGroup(nextIncompleteGroup);
            return;
        }
        
        // 检查当前任务所有组是否都完成了
        const allGroupsComplete = task.reviews?.every(r => r?.completed);
        if (allGroupsComplete) {
            // 标记任务整体完成
            task.review = {
                completed: true,
                timestamp: new Date().toISOString()
            };
        }
    } else {
        // 单组数据，直接标记完成
        task.review = {
            ratings: { ...state.ratings },
            notes: { ...state.notes },
            completed: true,
            timestamp: new Date().toISOString()
        };
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
    
    let nextIndex = (startIndex + 1) % tasks.length;
    
    while (nextIndex !== startIndex) {
        // 检查当前模式对应的完成状态
        const isComplete = state.reviewMode === 'segment' 
            ? tasks[nextIndex].review?.completed 
            : tasks[nextIndex].profileReview?.completed;
        if (!isComplete) {
            selectTask(nextIndex);
            return;
        }
        nextIndex = (nextIndex + 1) % tasks.length;
    }

    // 所有任务都完成了
    const currentComplete = state.reviewMode === 'segment'
        ? tasks[startIndex]?.review?.completed
        : tasks[startIndex]?.profileReview?.completed;
    if (currentComplete) {
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
        const isComplete = state.reviewMode === 'segment' 
            ? task.review?.completed 
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
        }

        return `
            <div class="task-item p-3 border-b cursor-pointer ${isActive ? 'active' : ''}" 
                 onclick="selectTask(${index})">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <span class="mdi ${isComplete ? 'mdi-check-circle text-green-500' : 'mdi-circle-outline text-gray-300'} mr-2"></span>
                        <span class="text-sm font-medium truncate max-w-[150px]">${task.id || '任务 ' + (index + 1)}</span>
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
        return state.reviewMode === 'segment' 
            ? t.review?.completed 
            : t.profileReview?.completed;
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
    document.getElementById('import-modal').classList.remove('hidden');
    document.getElementById('import-modal').classList.add('flex');
}

function closeImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
    document.getElementById('import-modal').classList.remove('flex');
}

function confirmImport() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择 Excel 文件');
        return;
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('请选择 Excel 格式文件（.xlsx 或 .xls）');
        return;
    }
    
    // Excel文件使用ArrayBuffer读取
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = parseExcel(e.target.result);
            processImportData(data);
        } catch (err) {
            alert('Excel 解析失败: ' + err.message);
            console.error('Excel解析错误:', err);
        }
    };
    reader.readAsArrayBuffer(file);
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
        
        // 去掉首尾空白
        jsonStr = jsonStr.trim();
        
        // 如果为空，返回null
        if (!jsonStr) return null;
        
        // 去掉 markdown 代码块包裹（如 ```json ... ``` 或 ``` ... ```）
        if (jsonStr.startsWith('```')) {
            // 去掉开头的 ```json 或 ```
            jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '');
            // 去掉结尾的 ```
            jsonStr = jsonStr.replace(/\n?```\s*$/, '');
            jsonStr = jsonStr.trim();
        }
        
        // 如果字符串被双引号包裹（Excel常见行为），去掉外层引号
        if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
            jsonStr = jsonStr.slice(1, -1);
            // 去掉外层引号后，内部的转义双引号 "" 需要还原为单个引号 "
            jsonStr = jsonStr.replace(/""/g, '"');
        }
        
        // 如果字符串以单引号包裹，去掉单引号
        if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) {
            jsonStr = jsonStr.slice(1, -1);
        }
        
        // 先修复缺少逗号的非标准JSON（需要在清理控制字符之前，因为依赖换行符检测）
        jsonStr = fixMissingCommas(jsonStr);
        
        // 修复多余的闭合括号
        jsonStr = fixExtraBraces(jsonStr);
        
        // 清理JSON字符串中的控制字符
        jsonStr = cleanJsonControlChars(jsonStr);
        
        // 清理末尾可能存在的非JSON内容（如Python字典格式）
        jsonStr = cleanJsonTrailingContent(jsonStr);
        
        // 尝试解析，如果失败则尝试修复截断的JSON
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch (parseError) {
            console.warn(`任务 ${taskIndex + 1} 第${colIndex}列 首次解析失败，尝试修复...`);
            const fixedJson = tryFixTruncatedJson(jsonStr);
            parsed = JSON.parse(fixedJson);
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
    
    // 第一行为表头，从第二列开始是模型名称
    const headerRow = rows[0];
    const modelNames = [];
    for (let col = 1; col < headerRow.length; col++) {
        const name = headerRow[col]?.toString().trim() || `模型${col}`;
        modelNames.push(name);
    }
    console.log('模型名称列表:', modelNames);
    
    // 数据从第二行开始
    const dataRows = rows.slice(1);
    const startRowIndex = 2; // Excel行号从1开始，数据从第2行开始
    
    return dataRows.map((row, i) => {
        const obj = { id: `task-${i + 1}` };
        const excelRowNum = startRowIndex + i;
        const cellAddress = `A${excelRowNum}`;
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
        if (!videoUrl && row[0]) {
            videoUrl = String(row[0]).trim();
            console.log(`任务 ${i + 1} 从row[0]获取URL`);
        }
        
        obj.video_url = videoUrl;
        console.log(`任务 ${i + 1}: URL=${videoUrl.substring(0, 80)}...`);
        
        // 第二列及之后的列都是模型输出JSON数据
        // 存储为数组 model_outputs，同时记录模型名称
        obj.model_outputs = [];
        obj.model_names = [];
        
        for (let col = 1; col < row.length; col++) {
            const parsed = parseJsonCell(row[col], i, col + 1);
            // 支持分段语义详情(segments)或全篇语义画像(profile)数据
            if (parsed && ((parsed.segments && parsed.segments.length > 0) || parsed.profile)) {
                obj.model_outputs.push(parsed);
                obj.model_names.push(modelNames[col - 1] || `模型${col}`);
            }
        }
        
        // 兼容旧格式：model_output 指向第一组数据
        obj.model_output = obj.model_outputs[0] || {};
        
        // 初始化每组数据的评分
        obj.reviews = obj.model_outputs.map(() => null);
        
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
    
    // 如果解析出了任何有效数据，返回 output；否则返回原数据
    if (output.segments || output.profile) {
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
        } else if (task.model_output && !task.model_outputs) {
            // 兼容旧格式
            task.model_outputs = [task.model_output];
            task.reviews = [null];
            task.profileReviews = [null];
        }
        return task;
    });

    if (validTasks.length === 0) {
        alert('没有有效的任务数据');
        return;
    }

    // 根据当前模式添加到对应的任务列表
    if (state.reviewMode === 'segment') {
        state.segmentTasks = [...state.segmentTasks, ...validTasks];
    } else {
        state.profileTasks = [...state.profileTasks, ...validTasks];
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

    alert(`成功导入 ${validTasks.length} 个任务到「${state.reviewMode === 'segment' ? '分段语义详情' : '全篇语义画像'}」`);
}

// 清空当前模式的任务
function clearAllTasks() {
    const tasks = getTasks();
    const modeName = state.reviewMode === 'segment' ? '分段语义详情' : '全篇语义画像';
    
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
    if (taskLabelClear) taskLabelClear.textContent = '未选择任务';
    
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
    // 分别保存两种模式的任务列表
    localStorage.setItem('video-review-segment-tasks', JSON.stringify(state.segmentTasks));
    localStorage.setItem('video-review-segment-index', state.segmentTaskIndex);
    localStorage.setItem('video-review-profile-tasks', JSON.stringify(state.profileTasks));
    localStorage.setItem('video-review-profile-index', state.profileTaskIndex);
}

function loadFromLocalStorage() {
    try {
        // 加载分段语义详情任务
        const segmentTasks = localStorage.getItem('video-review-segment-tasks');
        const segmentIndex = localStorage.getItem('video-review-segment-index');
        if (segmentTasks) {
            state.segmentTasks = JSON.parse(segmentTasks);
        }
        if (segmentIndex !== null) {
            state.segmentTaskIndex = parseInt(segmentIndex);
        }
        
        // 加载全篇语义画像任务
        const profileTasks = localStorage.getItem('video-review-profile-tasks');
        const profileIndex = localStorage.getItem('video-review-profile-index');
        if (profileTasks) {
            state.profileTasks = JSON.parse(profileTasks);
        }
        if (profileIndex !== null) {
            state.profileTaskIndex = parseInt(profileIndex);
        }
        
        // 延迟选择任务（等待模式恢复后）
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
    if (mode !== 'segment' && mode !== 'profile') return;
    
    state.reviewMode = mode;
    localStorage.setItem('review-mode', mode);
    
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
    const segmentRating = document.getElementById('segment-rating-panel');
    const profileRating = document.getElementById('profile-rating-panel');
    const segmentDock = document.getElementById('segment-rating-dock');
    const profileDock = document.getElementById('profile-rating-dock');
    
    if (mode === 'segment') {
        segmentContent?.classList.remove('hidden');
        profileContent?.classList.add('hidden');
        segmentRating?.classList.remove('hidden');
        profileRating?.classList.add('hidden');
        segmentDock?.classList.remove('hidden');
        profileDock?.classList.add('hidden');
    } else {
        segmentContent?.classList.add('hidden');
        profileContent?.classList.remove('hidden');
        segmentRating?.classList.add('hidden');
        profileRating?.classList.remove('hidden');
        segmentDock?.classList.add('hidden');
        profileDock?.classList.remove('hidden');
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
        if (taskLabelMode) taskLabelMode.textContent = '未选择任务';
        elements.videoPlayer.src = '';
    } else if (index >= 0 && index < tasks.length) {
        // 有任务且已选中，恢复选中状态
        selectTask(index);
        if (mode === 'segment') {
            switchTab(state.currentTab);
        } else {
            renderProfileContent();
        }
    } else {
        // 有任务但未选中，选中第一个
        selectTask(0);
        if (mode === 'segment') {
            switchTab(state.currentTab);
        } else {
            renderProfileContent();
        }
    }
}

function restoreReviewMode() {
    const savedMode = localStorage.getItem('review-mode') || 'segment';
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
// 备注面板切换
// ============================================
function toggleNotePanel() {
    const notePanel = document.getElementById('note-panel');
    const segmentNotePanel = document.getElementById('segment-note-panel');
    const profileNotePanel = document.getElementById('profile-note-panel');
    const toggleIcon = document.getElementById('note-toggle-icon');
    
    if (notePanel) {
        const isHidden = notePanel.classList.contains('hidden');
        notePanel.classList.toggle('hidden');
        
        // 根据当前模式切换显示对应的备注面板
        if (state.reviewMode === 'segment') {
            segmentNotePanel?.classList.remove('hidden');
            profileNotePanel?.classList.add('hidden');
        } else {
            segmentNotePanel?.classList.add('hidden');
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

// 修改 normalizeModelOutput 以支持全篇语义画像数据
const originalNormalizeModelOutput = normalizeModelOutput;
normalizeModelOutput = function(data) {
    const output = {};
    
    // 处理分段语义详情
    if (Array.isArray(data)) {
        output.segments = convertSegmentArray(data);
        return output;
    }
    
    if (data.segment_detail && Array.isArray(data.segment_detail)) {
        output.segments = convertSegmentArray(data.segment_detail);
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
    
    // 如果没有任何有效数据，返回原数据
    if (!output.segments && !output.profile) {
        return data;
    }
    
    return output;
};

// 暴露全局函数
window.switchReviewMode = switchReviewMode;