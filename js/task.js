import { highlightStars, resetRatings } from './scoring.js';
import { renderProfileContent, renderAudiovisualContent, resetProfileRatings, resetAudiovisualRatings, highlightSegmentStars, highlightProfileStars } from './modes.js';
import { switchTab } from './tabs.js';
import { escapeHTML } from './render.js';
import { state, getTasks, getTaskIndex, setTaskIndex, elements, PROFILE_DIMENSIONS, AUDIOVISUAL_DIMENSIONS } from './state.js';
import { toggleComparisonMode, refreshComparisonView } from './compare.js';
import { renderTimeline } from './video.js';
import { updateParseErrorBanner } from './api.js';
import { saveToLocalStorage } from './storage.js';

export function getCurrentTask() {
    const tasks = getTasks();
    const index = getTaskIndex();
    return tasks[index];
}

export function selectTask(index) {
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
export function renderOutputGroupSwitcher(task) {
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
export function openModelManager() {
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

export function closeModelManager() {
    if (window._modelManagerSortable) {
        window._modelManagerSortable.destroy();
        delete window._modelManagerSortable;
    }
    document.getElementById('model-manager-overlay')?.remove();
    delete window._modelManagerRenderList;
    delete window._modelManagerOrder;
}

export function saveModelManager() {
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
export function switchOutputGroup(groupIndex) {
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
export function updateModelOutput() {
    const task = getCurrentTask();
    if (!task) return;
    
    if (task.model_outputs && task.model_outputs.length > 0) {
        task.model_output = task.model_outputs[state.currentOutputGroup] || {};
    }
}

// 在对比模式下为指定组设置分段评分
export function setSegmentRatingForGroup(groupIndex, dimension, value) {
    const task = getCurrentTask();
    if (!task || groupIndex < 0 || groupIndex >= (task.model_outputs?.length || 0)) return;

    if (!task.reviews) {
        task.reviews = task.model_outputs?.map(() => null) || [null];
    }

    const baseRatings = { time: 0, text: 0, visual: 0, keyframe: 0 };
    const baseNotes = { time: '', text: '', visual: '', keyframe: '' };
    if (!task.reviews[groupIndex]) {
        task.reviews[groupIndex] = { mode: 'segment', ratings: { ...baseRatings }, notes: { ...baseNotes }, completed: false };
    }

    task.reviews[groupIndex].ratings[dimension] = value;
    task.reviews[groupIndex].timestamp = new Date().toISOString();
    task.reviews[groupIndex].completed = Object.values(task.reviews[groupIndex].ratings).some(r => r > 0);

    // 更新 state.ratings 以便共享 dock 显示当前组
    const prevGroup = state.currentOutputGroup;
    const prevRatings = { ...state.ratings };
    const prevNotes = { ...state.notes };
    state.currentOutputGroup = groupIndex;
    state.ratings = { ...task.reviews[groupIndex].ratings };
    state.notes = { ...task.reviews[groupIndex].notes };
    saveToLocalStorage();
    updateUI();
    state.currentOutputGroup = prevGroup;
    state.ratings = prevRatings;
    state.notes = prevNotes;
}

// 设置指定模型在分段模式下的备注
export function setSegmentNoteForGroup(groupIndex, dimension, note) {
    const task = getCurrentTask();
    if (!task || groupIndex < 0 || groupIndex >= (task.model_outputs?.length || 0)) return;

    if (!task.reviews) {
        task.reviews = task.model_outputs?.map(() => null) || [null];
    }

    const baseRatings = { time: 0, text: 0, visual: 0, keyframe: 0 };
    const baseNotes = { time: '', text: '', visual: '', keyframe: '' };
    if (!task.reviews[groupIndex]) {
        task.reviews[groupIndex] = { mode: 'segment', ratings: { ...baseRatings }, notes: { ...baseNotes }, completed: false };
    }

    const prevGroup = state.currentOutputGroup;
    const prevRatings = { ...state.ratings };
    const prevNotes = { ...state.notes };

    task.reviews[groupIndex].notes[dimension] = note ?? '';

    state.currentOutputGroup = groupIndex;
    state.ratings = { ...task.reviews[groupIndex].ratings };
    state.notes = { ...task.reviews[groupIndex].notes };
    saveToLocalStorage();
    updateUI();
    state.currentOutputGroup = prevGroup;
    state.ratings = prevRatings;
    state.notes = prevNotes;
}

// 在对比模式下切换当前评分目标的数据组
export function setRatingTarget(groupIndex) {
    const task = getCurrentTask();
    if (!task || groupIndex < 0 || groupIndex >= (task.model_outputs?.length || 0)) return;
    state.currentOutputGroup = groupIndex;
    updateModelOutput();
    loadReviewForCurrentGroup();
}

// 保存当前数据组的评分（支持三种审查模式）
export function saveReviewForCurrentGroup() {
    const task = getCurrentTask();
    if (!task) return;
    
    if (state.reviewMode === 'segment') {
        // 收集分段语义详情的备注（优先从 dock 面板读取）
        ['time', 'text', 'visual', 'keyframe'].forEach(dim => {
            const dockInput = document.getElementById(`dock-note-${dim}`);
            const noteInput = document.getElementById(`note-${dim}`);
            const val = dockInput ? dockInput.value : noteInput ? noteInput.value : '';
            state.notes[dim] = val ?? '';
        });
        
        if (!task.reviews) {
            task.reviews = task.model_outputs?.map(() => null) || [null];
        }
        
        task.reviews[state.currentOutputGroup] = {
            mode: 'segment',
            ratings: { ...state.ratings },
            notes: { ...state.notes },
            completed: Object.values(state.ratings).some(r => r > 0),
            timestamp: new Date().toISOString()
        };
    } else if (state.reviewMode === 'audiovisual') {
        AUDIOVISUAL_DIMENSIONS.forEach(dim => {
            const dockInput = document.getElementById(`dock-note-${dim.key}`);
            const noteInput = document.getElementById(`note-${dim.key}`);
            const val = dockInput ? dockInput.value : noteInput ? noteInput.value : '';
            state.audiovisualNotes[dim.key] = val ?? '';
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
        PROFILE_DIMENSIONS.forEach(dim => {
            const dockInput = document.getElementById(`dock-note-${dim.key}`);
            const noteInput = document.getElementById(`note-${dim.key}`);
            const val = dockInput ? dockInput.value : noteInput ? noteInput.value : '';
            state.profileNotes[dim.key] = val ?? '';
        });
        
        if (!task.profileReviews) {
            task.profileReviews = task.model_outputs?.map(() => null) || [null];
        }
        
        task.profileReviews[state.currentOutputGroup] = {
            mode: 'profile',
            ratings: { ...state.profileRatings },
            notes: { ...state.profileNotes },
            completed: Object.values(state.profileRatings).some(r => r >= 0),
            timestamp: new Date().toISOString()
        };
    }
}

// 加载当前数据组的评分（支持三种审查模式）
export function loadReviewForCurrentGroup() {
    const task = getCurrentTask();
    if (!task) return;
    
    if (state.reviewMode === 'segment') {
        const review = task.reviews?.[state.currentOutputGroup];
        
        if (review) {
            state.ratings = { ...review.ratings };
            state.notes = { ...review.notes };
            Object.keys(state.ratings).forEach(dim => {
                document.querySelectorAll(`.rating-group[data-dimension="${dim}"][data-mode="segment"]`).forEach(group => {
                    highlightSegmentStars(group, state.ratings[dim]);
                });
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
                document.querySelectorAll(`.rating-group[data-dimension="${dim.key}"][data-mode="profile"]`).forEach(group => {
                    highlightProfileStars(group, state.profileRatings[dim.key]);
                });
                const dockInput = document.getElementById(`dock-note-${dim.key}`);
                if (dockInput) { dockInput.value = state.profileNotes[dim.key] || ''; }
                const noteInput = document.getElementById(`note-${dim.key}`);
                if (noteInput) { noteInput.value = state.profileNotes[dim.key] || ''; }
            });
        } else {
            resetProfileRatings();
        }
    }
}

export function submitReview() {
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

export function skipTask() {
    goToNextIncomplete();
}

export function goToNextIncomplete() {
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

export function renderTaskList() {
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

export function updateProgress() {
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

export function updateUI() {
    renderTaskList();
    updateProgress();
    updateParseErrorBanner();
}

// ============================================
export function clearAllTasks() {
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

// Expose functions for inline event handlers rendered in HTML
window.selectTask = selectTask;
window.switchOutputGroup = switchOutputGroup;
window.openModelManager = openModelManager;
window.saveModelManager = saveModelManager;
window.closeModelManager = closeModelManager;
window.setRatingTarget = setRatingTarget;
window.setSegmentRatingForGroup = setSegmentRatingForGroup;
window.setSegmentNoteForGroup = setSegmentNoteForGroup;
window.skipTask = skipTask;
window.submitReview = submitReview;
