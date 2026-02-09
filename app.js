// ============================================
// 视频审查工作台 - 主应用逻辑
// ============================================

// 全局状态
const state = {
    tasks: [],              // 任务列表
    currentTaskIndex: -1,   // 当前任务索引
    currentOutputGroup: 0,  // 当前数据组索引
    currentTab: 'text',     // 当前标签页（text 或 visual）
    ratings: {              // 当前评分（1-3分）
        time: 0,
        text: 0,
        visual: 0,
        keyframe: 0
    },
    notes: {                // 每个维度的备注
        time: '',
        text: '',
        visual: '',
        keyframe: ''
    }
};

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
    console.log('初始化完成');
});

// 强制清除所有数据（用于调试）
function forceReset() {
    localStorage.removeItem('video-review-tasks');
    localStorage.removeItem('video-review-current');
    localStorage.removeItem('sidebar-collapsed');
    state.tasks = [];
    state.currentTaskIndex = -1;
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

    // 评分星星事件
    document.querySelectorAll('.rating-group').forEach(group => {
        const dimension = group.dataset.dimension;
        group.querySelectorAll('.rating-star').forEach(star => {
            star.addEventListener('click', () => setRating(dimension, parseInt(star.dataset.value)));
            star.addEventListener('mouseenter', () => highlightStars(group, parseInt(star.dataset.value)));
            star.addEventListener('mouseleave', () => highlightStars(group, state.ratings[dimension]));
        });
    });

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

    // 渲染为一整段蓝色进度条
    elements.timelineSegments.innerHTML = `
        <div class="absolute h-full w-full bg-blue-400 opacity-40 rounded"></div>
    `;

    // 只显示每个分段的开始点作为分界（相邻分段只显示一个点）
    // 加上最后一个分段的结束点
    const boundaryTimes = new Set();
    segments.forEach((seg, i) => {
        boundaryTimes.add(seg.start);
        // 只有最后一个分段才添加结束点
        if (i === segments.length - 1) {
            boundaryTimes.add(seg.end);
        }
    });

    // 转换为数组并排序
    const sortedTimes = [...boundaryTimes].sort((a, b) => a - b);
    
    elements.timelineMarkers.innerHTML = sortedTimes.map(time => {
        const pos = (time / duration) * 100;
        return `<div class="absolute w-3 h-3 bg-red-500 rounded-full transform -translate-x-1/2 cursor-pointer hover:scale-125 transition-transform"
                    style="left: ${pos}%;"
                    onclick="seekToTime(${time})"
                    title="分段点: ${formatTime(time)}">
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
        btn.classList.remove('tab-active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('tab-active');
        }
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

// 渲染文本理解（显示每个片段的 text 字段）
function renderTextUnderstanding(segments) {
    const container = document.getElementById('text-content');
    if (segments.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">暂无文本数据</div>';
        return;
    }

    container.innerHTML = segments.map((seg, i) => `
        <div class="p-3 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100 transition-colors"
             onclick="seekToTime(${seg.start})">
            <div class="flex justify-between items-center mb-2">
                <span class="font-medium text-blue-600">片段 ${i + 1}</span>
                <span class="text-xs text-gray-500">
                    <span class="mdi mdi-clock-outline"></span>
                    ${formatTime(seg.start)} - ${formatTime(seg.end)}
                </span>
            </div>
            <p class="text-sm text-gray-700 leading-relaxed">${seg.description || seg.text || '无文本'}</p>
        </div>
    `).join('');
}

// 渲染视觉理解（只显示 vis 分段文字描述）
function renderVisualUnderstanding(segments) {
    const container = document.getElementById('visual-content');
    if (segments.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">暂无视觉数据</div>';
        return;
    }

    container.innerHTML = segments.map((seg, i) => `
        <div class="p-3 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100 transition-colors"
             onclick="seekToTime(${seg.start})">
            <div class="flex justify-between items-center mb-2">
                <span class="font-medium text-green-600">片段 ${i + 1}</span>
                <span class="text-xs text-gray-500">
                    <span class="mdi mdi-clock-outline"></span>
                    ${formatTime(seg.start)} - ${formatTime(seg.end)}
                </span>
            </div>
            <p class="text-sm text-gray-700 leading-relaxed">${seg.visual || '无视觉描述'}</p>
        </div>
    `).join('');
}

// 渲染关键帧列表（按时间点击跳转）
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
        <div class="flex items-start gap-3 p-3 bg-gray-50 rounded border cursor-pointer hover:bg-blue-50 transition-colors"
             onclick="seekToTime(${kf.time})">
            <span class="px-2 py-1 bg-blue-500 text-white text-xs rounded whitespace-nowrap">
                <span class="mdi mdi-clock"></span> ${formatTime(kf.time)}
            </span>
            <div class="flex-1">
                <span class="text-sm text-gray-700">${kf.label || kf.desc || '关键帧'}</span>
                <span class="text-xs text-gray-400 ml-2">(片段${kf.segmentIndex})</span>
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
    document.querySelectorAll('.rating-group').forEach(group => {
        highlightStars(group, 0);
    });
    // 清空所有备注输入
    ['time', 'text', 'visual', 'keyframe'].forEach(dim => {
        const noteInput = document.getElementById(`note-${dim}`);
        if (noteInput) noteInput.value = '';
    });
}

// ============================================
// 任务管理
// ============================================
function getCurrentTask() {
    return state.tasks[state.currentTaskIndex];
}

function selectTask(index) {
    if (index < 0 || index >= state.tasks.length) return;
    
    state.currentTaskIndex = index;
    state.currentOutputGroup = 0; // 默认选择第一组数据
    const task = state.tasks[index];

    // 更新UI
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('review-workspace').classList.remove('hidden');
    
    const groupCount = task.model_outputs?.length || 1;
    document.getElementById('current-task-label').textContent = `任务 ${index + 1}/${state.tasks.length}` + 
        (groupCount > 1 ? ` (${groupCount}组数据)` : '');

    // 加载视频 - 添加详细调试
    console.log('============ 加载视频 ============');
    console.log('任务数据:', task);
    console.log('任务video_url字段:', task.video_url);
    console.log('任务video_url长度:', task.video_url?.length);
    elements.videoPlayer.src = task.video_url;
    console.log('设置后video.src:', elements.videoPlayer.src);
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
    switchTab(state.currentTab);
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
    switchTab(state.currentTab);
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
    const startIndex = state.currentTaskIndex;
    let nextIndex = (startIndex + 1) % state.tasks.length;
    
    while (nextIndex !== startIndex) {
        if (!state.tasks[nextIndex].review?.completed) {
            selectTask(nextIndex);
            return;
        }
        nextIndex = (nextIndex + 1) % state.tasks.length;
    }

    // 所有任务都完成了
    if (state.tasks[startIndex].review?.completed) {
        alert('🎉 所有任务已完成！');
    }
}

function renderTaskList() {
    if (state.tasks.length === 0) {
        elements.taskList.innerHTML = `
            <div class="p-8 text-center text-gray-400">
                <span class="mdi mdi-inbox-outline text-4xl"></span>
                <p class="mt-2">暂无任务</p>
                <p class="text-sm">点击"导入"添加任务</p>
            </div>`;
        return;
    }

    elements.taskList.innerHTML = state.tasks.map((task, index) => {
        const isComplete = task.review?.completed;
        const isActive = index === state.currentTaskIndex;
        const avgRating = task.review ? 
            (Object.values(task.review.ratings).reduce((a, b) => a + b, 0) / 4).toFixed(1) : '-';
        const maxRating = 3; // 最大评分为3

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
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.review?.completed).length;
    const percent = total > 0 ? (completed / total) * 100 : 0;

    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = `${completed}/${total}`;
    elements.completedCount.textContent = completed;
    elements.pendingCount.textContent = total - completed;
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
            if (parsed && parsed.segments && parsed.segments.length > 0) {
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

// 标准化模型输出格式，只关注 segment_detail 中的 time/text/vis/key_frame 四个维度
function normalizeModelOutput(data) {
    const output = {};
    
    // 情况1：直接是数组（segment_detail内容）
    if (Array.isArray(data)) {
        output.segments = convertSegmentArray(data);
        return output;
    }
    
    // 情况2：有 segment_detail 字段
    if (data.segment_detail && Array.isArray(data.segment_detail)) {
        output.segments = convertSegmentArray(data.segment_detail);
        return output;
    }
    
    // 情况3：已经是标准格式
    if (data.segments) {
        output.segments = data.segments;
        return output;
    }
    
    // 忽略 global_profile，不再处理
    
    // 如果没有 segments，直接返回原数据
    if (!output.segments) {
        return data;
    }
    
    return output;
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
        } else if (task.model_output && !task.model_outputs) {
            // 兼容旧格式
            task.model_outputs = [task.model_output];
            task.reviews = [null];
        }
        return task;
    });

    if (validTasks.length === 0) {
        alert('没有有效的任务数据');
        return;
    }

    // 添加到任务列表
    state.tasks = [...state.tasks, ...validTasks];
    saveToLocalStorage();
    updateUI();
    closeImportModal();

    // 如果之前没有选中任务，自动选中第一个
    if (state.currentTaskIndex < 0 && state.tasks.length > 0) {
        selectTask(0);
    }

    alert(`成功导入 ${validTasks.length} 个任务`);
}

// 清空所有任务
function clearAllTasks() {
    if (state.tasks.length === 0) {
        alert('任务列表已为空');
        return;
    }
    
    if (!confirm('确定要清空所有任务吗？此操作不可恢复！')) {
        return;
    }
    
    // 重置状态
    state.tasks = [];
    state.currentTaskIndex = -1;
    resetRatings();
    
    // 清除本地存储
    localStorage.removeItem('video-review-tasks');
    localStorage.removeItem('video-review-current');
    
    // 更新UI
    updateUI();
    
    // 隐藏工作区，显示空状态
    document.getElementById('review-workspace').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('current-task-label').textContent = '未选择任务';
    
    // 清空视频
    elements.videoPlayer.src = '';
    
    alert('任务列表已清空');
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
    localStorage.setItem('video-review-tasks', JSON.stringify(state.tasks));
    localStorage.setItem('video-review-current', state.currentTaskIndex);
}

function loadFromLocalStorage() {
    try {
        const tasks = localStorage.getItem('video-review-tasks');
        const current = localStorage.getItem('video-review-current');
        
        if (tasks) {
            state.tasks = JSON.parse(tasks);
        }
        if (current !== null && state.tasks.length > 0) {
            state.currentTaskIndex = parseInt(current);
            if (state.currentTaskIndex >= 0) {
                setTimeout(() => selectTask(state.currentTaskIndex), 100);
            }
        }
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