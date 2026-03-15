import { resetRatings } from './scoring.js';
import { exportResults } from './export.js';
import { getCurrentTask, selectTask, saveReviewForCurrentGroup, loadReviewForCurrentGroup, updateUI } from './task.js';
import { switchTab, renderParseErrorFallback } from './tabs.js';
import { escapeHTML } from './render.js';
import { state, getTasks, getTaskIndex, PROFILE_DIMENSIONS, AUDIOVISUAL_DIMENSIONS, elements, getWorkspaceKey } from './state.js';
import { exitComparisonMode } from './compare.js';
import { linkifyTime, formatTimeLink } from './video.js';
import { saveToLocalStorage } from './storage.js';

export function switchReviewMode(mode) {
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

export function restoreReviewMode() {
    let savedMode = 'segment';
    if (state.currentWorkspaceId) {
        savedMode = localStorage.getItem(getWorkspaceKey(state.currentWorkspaceId, 'review-mode')) || 'segment';
    }
    switchReviewMode(savedMode);
}

// 渲染全篇语义画像内容
export function renderProfileContent() {
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
        renderParseErrorFallback('profile-content');
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
}

// Ive Style: Unified Gray Profile Section - No colorful backgrounds
export function renderProfileSection(title, icon, color, tag, content) {
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
export function renderAudiovisualContent() {
    const container = document.getElementById('audiovisual-content');
    const task = getCurrentTask();

    if (!task || !container) {
        if (container) container.innerHTML = '<div class="text-gray-400 text-center py-8">请先选择任务</div>';
        return;
    }

    const currentOutput = task.model_outputs?.[state.currentOutputGroup] || task.model_output;
    if (currentOutput?._parseError) {
        renderParseErrorFallback('audiovisual-content');
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
}

export function renderAVSection(title, icon, tag, content, isHtml, evalInfo) {
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

export function renderAVListItem(el) {
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
export function toggleNotePanel() {
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
export function initRatingListeners() {
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

export function setSegmentRating(dimension, value) {
    state.ratings[dimension] = value;
    // 同步更新所有相关的 rating-group（包括 dock 面板和旧面板）
    document.querySelectorAll(`.rating-group[data-dimension="${dimension}"][data-mode="segment"]`).forEach(group => {
        highlightSegmentStars(group, value);
    });
    saveToLocalStorage();
}

export function highlightSegmentStars(group, value) {
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

export function setProfileRating(dimension, value) {
    state.profileRatings[dimension] = value;
    saveToLocalStorage();
}

export function highlightProfileStars(group, value) {
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

export function resetProfileRatings() {
    PROFILE_DIMENSIONS.forEach(dim => {
        state.profileRatings[dim.key] = -1;
        state.profileNotes[dim.key] = '';
        const noteInput = document.getElementById(`note-${dim.key}`);
        if (noteInput) { noteInput.value = ''; }
        const dockInput = document.getElementById(`dock-note-${dim.key}`);
        if (dockInput) { dockInput.value = ''; }
    });
}

export function setAudiovisualRating(dimension, value) {
    state.audiovisualRatings[dimension] = value;
    saveToLocalStorage();
}

export function resetAudiovisualRatings() {
    AUDIOVISUAL_DIMENSIONS.forEach(dim => {
        state.audiovisualRatings[dim.key] = -1;
        state.audiovisualNotes[dim.key] = '';
        const noteInput = document.getElementById(`note-${dim.key}`);
        if (noteInput) { noteInput.value = ''; }
        const dockInput = document.getElementById(`dock-note-${dim.key}`);
        if (dockInput) { dockInput.value = ''; }
    });
}

import { EventBus } from './eventbus.js';
EventBus.addEventListener('state_changed', (e) => {
    const { path, property, value } = e.detail;
    if (path.startsWith('profileRatings.')) {
        document.querySelectorAll(`.rating-group[data-dimension="${property}"][data-mode="profile"]`).forEach(group => {
            highlightProfileStars(group, value);
        });
    } else if (path.startsWith('audiovisualRatings.')) {
        document.querySelectorAll(`.rating-group[data-dimension="${property}"][data-mode="audiovisual"]`).forEach(group => {
            highlightProfileStars(group, value);
        });
    }
});

// end of modes.js
