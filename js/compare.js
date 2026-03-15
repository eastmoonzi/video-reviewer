import { switchReviewMode, renderProfileContent, renderProfileSection, renderAudiovisualContent, renderAVSection, renderAVListItem, highlightSegmentStars } from './modes.js';
import { sortTasksByNid } from './export.js';
import { getCurrentTask, selectTask, renderOutputGroupSwitcher, updateUI, setSegmentRatingForGroup, setSegmentNoteForGroup, skipTask, submitReview } from './task.js';
import { switchTab } from './tabs.js';
import { escapeHTML } from './render.js';
import { state, getTaskIndex, setTaskIndex, elements } from './state.js';
import { linkifyTime, seekToTime, jumpToInputTime, formatTime, formatTimeLink } from './video.js';
import { saveToLocalStorage } from './storage.js';

// 暴露全局函数
window.switchReviewMode = switchReviewMode;

// 打分板收起/展开
export function toggleRatingDock() {
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
export function toggleSidebar() {
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

export function toggleComparisonMode() {
    if (state.comparisonMode) {
        exitComparisonMode();
    } else {
        enterComparisonMode();
    }
}

export function enterComparisonMode() {
    const task = getCurrentTask();
    if (!task) return;
    const groupCount = task.model_outputs?.length || 0;
    if (groupCount < 2) {
        alert('至少需要2个模型输出才能使用对比模式');
        return;
    }

    state.comparisonMode = true;
    state.comparisonGroups = Array.from({ length: groupCount }, (_, i) => i);
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

export function buildComparisonView(container, task) {
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

    // 多栏容器（可横向滚动）
    const cols = document.createElement('div');
    cols.className = 'flex-1 flex gap-3 p-3 overflow-x-auto no-scrollbar';
    cols.id = 'comparison-columns';

    for (let ci = 0; ci < state.comparisonGroups.length; ci++) {
        const col = document.createElement('div');
        col.className = 'comparison-column min-w-[320px]';
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
            renderComparisonDockSegment(task);
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
    renderComparisonDockSegment(task);
}

export function switchComparisonTab(tabName) {
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
    renderComparisonDockSegment(task);
}
window.switchComparisonTab = switchComparisonTab;

function renderComparisonDockSegment(task) {
    const dock = document.getElementById('segment-rating-dock');
    const compDock = document.getElementById('comparison-segment-dock');
    if (!dock || !compDock) return;

    if (!state.comparisonMode || state.reviewMode !== 'segment') {
        compDock.classList.add('hidden');
        compDock.innerHTML = '';
        dock.classList.remove('hidden');
        return;
    }

    dock.classList.add('hidden');
    compDock.classList.remove('hidden');

    const tab = state.comparisonTab || 'text';
    const dims = tab === 'visual' ? ['visual'] : tab === 'keyframe' ? ['keyframe'] : ['time', 'text'];
    const labelMap = { time: '时间', text: '文本', visual: '视觉', keyframe: '关键帧' };

    compDock.innerHTML = '';

    const shell = document.createElement('div');
    shell.className = 'flex items-center gap-6';

    const wrap = document.createElement('div');
    wrap.className = 'flex gap-3 overflow-x-auto no-scrollbar pb-1 w-full items-stretch';

    const groupCount = task.model_outputs?.length || 0;
    for (let gi = 0; gi < groupCount; gi++) {
        const card = document.createElement('div');
        card.className = 'rounded-2xl border border-gray-200 bg-white/95 shadow-md p-2.5 flex flex-col gap-1.5';
        card.style.flex = '1 0 300px';
        card.style.maxWidth = '380px';
        card.style.overflowY = 'auto';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-2';
        header.innerHTML = `<span class="text-xs font-semibold text-gray-700">${escapeHTML(task.model_names?.[gi] || '模型' + (gi + 1))}</span>`;
        card.appendChild(header);

        dims.forEach(dim => {
            const row = document.createElement('div');
            row.className = 'flex flex-col gap-1';
            row.innerHTML = `<div class="flex items-center justify-between"><span class="text-xs font-semibold text-gray-700">${labelMap[dim] || dim}</span></div>`;

            const groupEl = document.createElement('div');
            groupEl.className = 'rating-group flex gap-1';
            groupEl.dataset.dimension = dim;
            groupEl.dataset.mode = 'segment';
            groupEl.dataset.groupIndex = gi;

            for (let v = 1; v <= 3; v++) {
                const star = document.createElement('span');
                star.className = 'rating-star mdi mdi-star text-xl cursor-pointer';
                star.dataset.value = v;
                star.addEventListener('click', () => {
                    setSegmentRatingForGroup(gi, dim, v);
                    highlightSegmentStars(groupEl, v);
                });
                groupEl.appendChild(star);
            }

            const review = task.reviews?.[gi];
            const currentVal = review?.ratings?.[dim] || 0;
            if (currentVal > 0) highlightSegmentStars(groupEl, currentVal);

            const note = document.createElement('textarea');
            note.rows = 2;
            note.placeholder = '备注';
            note.className = 'soft-input text-sm px-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-gray-300 resize-none';
            note.style.height = '46px';
            note.style.paddingTop = '12px';
            note.style.paddingBottom = '12px';
            note.style.lineHeight = '20px';
            note.value = task.reviews?.[gi]?.notes?.[dim] || '';
            note.addEventListener('input', (e) => {
                setSegmentNoteForGroup(gi, dim, e.target.value);
            });

            const bar = document.createElement('div');
            bar.className = 'flex items-center justify-between gap-2';
            bar.appendChild(groupEl);
            bar.appendChild(document.createElement('div'));

            row.appendChild(bar);
            row.appendChild(note);
            card.appendChild(row);
        });

        wrap.appendChild(card);
    }

    shell.appendChild(wrap);

    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-3 pl-5 border-l-2 border-gray-300 flex-shrink-0';
    actions.innerHTML = `
        <button class="comp-skip px-5 py-2.5 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-black/5 rounded-xl transition-colors">跳过</button>
        <button class="comp-submit px-6 py-2.5 bg-black text-white text-base font-bold rounded-xl hover:bg-gray-800 transition-colors flex items-center gap-2 active:scale-95">
            <span>提交</span><span class="mdi mdi-arrow-right text-lg"></span>
        </button>`;
    shell.appendChild(actions);

    compDock.appendChild(shell);

    // Align height with normal dock
    const baseDock = document.getElementById('segment-rating-dock');
    if (baseDock) {
        const h = baseDock.offsetHeight;
        if (h > 0) {
            compDock.style.minHeight = h + 'px';
            compDock.style.maxHeight = h + 'px';
            shell.style.maxHeight = h + 'px';
            wrap.style.maxHeight = h + 'px';
        }
    }

    const skipBtn = actions.querySelector('.comp-skip');
    const submitBtn = actions.querySelector('.comp-submit');
    if (skipBtn) skipBtn.addEventListener('click', () => skipTask());
    if (submitBtn) submitBtn.addEventListener('click', () => submitReview());
}

export function renderComparisonColumn(bodyEl, task, groupIndex) {
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
export function generateSegmentTextHTML(segments) {
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
export function generateSegmentVisualHTML(segments) {
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
export function generateSegmentKeyframeHTML(segments) {
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
export function generateProfileHTML(profileData) {
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
export function generateAudiovisualHTML(avData, autoEval) {
    if (!avData) return '';
    const sections = [];
    const ev = autoEval || null;

    function getEval(obj) {
        if (!obj) return null;
        const d = Array.isArray(obj) ? obj[0] : obj;
        if (!d || (d['得分'] == null && d['理由'] == null)) return null;
        return { score: d['得分'] ?? null, reason: d['理由'] || '', timeScore: d['time得分'] ?? null, timeReason: d['time理由'] || '' };
    }

    if (avData.audiovisual_integration?.detail_quality) {
        const dq = avData.audiovisual_integration.detail_quality;
        sections.push(renderAVSection('总体质量', 'mdi-tune-variant', dq.level, dq.desc, false, getEval(ev?.audiovisual_integration?.detail_quality)));
    }

    const vpe = avData.vision_quality?.visual_processing_elements;
    if (vpe && vpe.length > 0) {
        const items = vpe.map(el => {
            const timeStr = Array.isArray(el.time) ? `${formatTimeLink(el.time[0])}→${formatTimeLink(el.time[1])}` : '';
            return `<b>${escapeHTML(el.tag || '-')}</b>：${linkifyTime(escapeHTML(el.desc || ''))}` +
                (el.position ? ` <span class="text-gray-400">[${escapeHTML(el.position)}]</span>` : '') +
                (timeStr ? ` <span class="text-gray-400 font-mono text-[11px]">${timeStr}</span>` : '');
        }).join('<br>');
        sections.push(renderAVSection('加工元素', 'mdi-image-filter-center-focus', null, items, true, getEval(ev?.vision_quality?.visual_processing_elements)));
    }

    const comp = avData.vision_quality?.composition;
    if (comp && comp.length > 0) {
        const items = comp.map(el => {
            const timeStr = Array.isArray(el.time) ? `${formatTimeLink(el.time[0])}→${formatTimeLink(el.time[1])}` : '';
            return `<b>${escapeHTML(el.tag || el.desc || '-')}</b>` +
                (el.desc && el.tag ? `：${linkifyTime(escapeHTML(el.desc))}` : '') +
                (timeStr ? ` <span class="text-gray-400 font-mono text-[11px]">${timeStr}</span>` : '');
        }).join('<br>');
        sections.push(renderAVSection('构图', 'mdi-grid', null, items, true, getEval(ev?.vision_quality?.composition)));
    }

    const man = avData.content_subject?.man_negative_content;
    if (man && man.length > 0) {
        sections.push(renderAVSection('人物', 'mdi-account', null, man.map(el => renderAVListItem(el)).join('<br>'), true, getEval(ev?.content_subject?.man_negative_content)));
    }

    const creature = avData.content_subject?.creature_negative_content;
    if (creature && creature.length > 0) {
        sections.push(renderAVSection('生物', 'mdi-paw', null, creature.map(el => renderAVListItem(el)).join('<br>'), true, getEval(ev?.content_subject?.creature_negative_content)));
    }

    const qi = avData.information?.questionable_info;
    if (qi) {
        sections.push(renderAVSection('真实性存疑', 'mdi-alert-circle', qi.has_issue ? '是' : '否', qi.desc !== '无' ? qi.desc : null, false, getEval(ev?.information?.questionable_info)));
    }

    const vi = avData.intent?.vulgar_intent;
    if (vi) {
        sections.push(renderAVSection('低俗意图', 'mdi-eye-off', vi.has_intent ? '是' : '否', vi.desc !== '无' ? vi.desc : null, false, getEval(ev?.intent?.vulgar_intent)));
    }

    return sections.join('');
}

// 刷新对比视图（切换任务时调用）
export function refreshComparisonView() {
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
}

export function exitComparisonMode() {
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
            const dock = document.getElementById('segment-rating-dock');
            const compDock = document.getElementById('comparison-segment-dock');
            if (dock) dock.classList.remove('hidden');
            if (compDock) { compDock.classList.add('hidden'); compDock.innerHTML = ''; }
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
