import { submitReview } from './task.js';
import { switchTab } from './tabs.js';
import { state } from './state.js';
import { togglePlay, seekRelative } from './video.js';

// 键盘快捷键
// ============================================
export function handleKeyboard(e) {
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
    }
}
