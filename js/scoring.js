import { highlightSegmentStars } from './modes.js';
import { state } from './state.js';
import { saveToLocalStorage } from './storage.js';

export function setRating(dimension, value) {
    state.ratings[dimension] = value;
    saveToLocalStorage();
}

export function highlightStars(group, value) {
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

export function resetRatings() {
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

import { EventBus } from './eventbus.js';

EventBus.addEventListener('state_changed', (e) => {
    const { path, value } = e.detail;
    if (path.startsWith('ratings.')) {
        const dimension = path.split('.')[1];
        // 自动同步主面板与 Dock 面板的多套 UI
        document.querySelectorAll(`.rating-group[data-dimension="${dimension}"][data-mode="segment"]`).forEach(group => {
            highlightStars(group, value);
        });
    }
});
