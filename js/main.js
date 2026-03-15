import { initRatingListeners } from './modes.js';
import { getCurrentTask } from './task.js';
import { updateUI } from './task.js';
import { handleKeyboard } from './shortcuts.js';
import { elements, loadWorkspaceRegistry, migrateToWorkspaces, renderWorkspaceSwitcher, switchWorkspace } from './state.js';
import { updateTimeDisplay, onVideoLoaded, formatTime } from './video.js';
import { loadFromLocalStorage } from './storage.js';
import { restoreSidebarState, restoreRatingPanelState } from './panels.js';
import { restoreReviewMode } from './modes.js';
import { loadLLMSettings } from './api.js';
import './events.js'; // Ensure event handlers map correctly

export function initElements() {
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

export function initEventListeners() {
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
// 应用初始化（唯一入口）
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('初始化开始...');
    initElements();
    console.log('视频播放器元素:', elements.videoPlayer);
    initEventListeners();
    migrateToWorkspaces();
    loadFromLocalStorage();
    loadWorkspaceRegistry();
    renderWorkspaceSwitcher();

    const wsSelect = document.getElementById('workspace-select');
    if (wsSelect && wsSelect.value) {
        switchWorkspace(wsSelect.value);
    } else {
        updateUI();
    }

    restoreSidebarState();
    restoreRatingPanelState();
    restoreReviewMode();
    loadLLMSettings();
    console.log('初始化完成');
});
