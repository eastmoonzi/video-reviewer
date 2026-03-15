import { resetRatings } from './scoring.js';
import { switchReviewMode, restoreReviewMode, resetProfileRatings, resetAudiovisualRatings } from './modes.js';
import { updateUI } from './task.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';

import { EventBus } from './eventbus.js';
export { EventBus };

const rawState = {
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
    comparisonGroups: [0, 1]
};

function createReactiveProxy(obj, pathPrefix = '') {
    return new Proxy(obj, {
        set(target, property, value) {
            const oldValue = target[property];
            target[property] = value;
            if (oldValue !== value) {
                const fullPath = pathPrefix ? `${pathPrefix}.${property}` : property;
                EventBus.dispatchEvent(new CustomEvent('state_changed', {
                    detail: { path: fullPath, property, value, oldValue }
                }));
            }
            return true;
        },
        get(target, property) {
            const val = target[property];
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                return createReactiveProxy(val, pathPrefix ? `${pathPrefix}.${property}` : property);
            }
            return val;
        }
    });
}

export const state = createReactiveProxy(rawState);

// 获取当前模式的任务列表
export function getTasks() {
    if (state.reviewMode === 'segment') return state.segmentTasks;
    if (state.reviewMode === 'audiovisual') return state.audiovisualTasks;
    return state.profileTasks;
}

// 获取当前模式的任务索引
export function getTaskIndex() {
    if (state.reviewMode === 'segment') return state.segmentTaskIndex;
    if (state.reviewMode === 'audiovisual') return state.audiovisualTaskIndex;
    return state.profileTaskIndex;
}

// 设置当前模式的任务索引
export function setTaskIndex(index) {
    if (state.reviewMode === 'segment') {
        state.segmentTaskIndex = index;
    } else if (state.reviewMode === 'audiovisual') {
        state.audiovisualTaskIndex = index;
    } else {
        state.profileTaskIndex = index;
    }
}

// 全篇语义画像维度配置
export const PROFILE_DIMENSIONS = [
    { key: 'narrative_type', label: '叙事类型' },
    { key: 'visual_type', label: '画面类型' },
    { key: 'summary', label: '内容总结' },
    { key: 'intent_type', label: '创作意图' },
    { key: 'topic_consistency', label: '主题一致性' },
    { key: 'core_claim', label: '核心观点' },
    { key: 'emotion_type', label: '情感类型' }
];

// 基础音画质量维度配置
export const AUDIOVISUAL_DIMENSIONS = [
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
export const elements = {
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


// 强制清除所有数据（用于调试）
export function forceReset() {
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
export function getWorkspaceKey(wsId, suffix) {
    return `ws:${wsId}:${suffix}`;
}

export function saveWorkspaceRegistry() {
    localStorage.setItem('ws-registry', JSON.stringify(state.workspaces));
    localStorage.setItem('ws-active', state.currentWorkspaceId);
}

export function loadWorkspaceRegistry() {
    const raw = localStorage.getItem('ws-registry');
    state.workspaces = raw ? JSON.parse(raw) : [];
    state.currentWorkspaceId = localStorage.getItem('ws-active');
}

export function migrateToWorkspaces() {
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

export function createWorkspace(name) {
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

export function switchWorkspace(wsId) {
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

    // 刷新 UI 并恢复该工作区的模式偏好
    renderWorkspaceSwitcher();
    restoreReviewMode();
    updateUI();
}

export function deleteWorkspace(wsId) {
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

export function renderWorkspaceSwitcher() {
    const select = document.getElementById('workspace-select');
    if (!select) return;
    select.innerHTML = state.workspaces.map(ws =>
        `<option value="${ws.id}" ${ws.id === state.currentWorkspaceId ? 'selected' : ''}>${ws.name}</option>`
    ).join('');
}

export function showWorkspaceMenu() {
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
