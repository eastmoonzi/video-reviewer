export function toggleSidebar() {
    const sidebar = document.getElementById('task-sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    
    sidebar.classList.toggle('collapsed');
    toggleBtn.classList.toggle('collapsed');
    
    // 保存状态到本地存储
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed);
}

// 初始化时恢复侧边栏状态
export function restoreSidebarState() {
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed) {
        document.getElementById('task-sidebar').classList.add('collapsed');
        document.getElementById('sidebar-toggle').classList.add('collapsed');
    }
}

// ============================================
// 评分面板折叠 (Floating Sheet Logic)
// ============================================
export function toggleRatingPanel() {
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
export function restoreRatingPanelState() {
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
// 帮助
// ============================================
export function showHelp() {
    document.getElementById('help-modal').classList.remove('hidden');
    document.getElementById('help-modal').classList.add('flex');
}

export function closeHelpModal() {
    document.getElementById('help-modal').classList.add('hidden');
    document.getElementById('help-modal').classList.remove('flex');
}

import { closeImportModal } from './parser.js';
export function showFormatHelp() {
    closeImportModal();
    showHelp();
}
