import { getCurrentTask } from './task.js';
import { renderTabContent, escapeHTML } from './render.js';
import { state, getTaskIndex } from './state.js';
import { repairSingleOutput } from './api.js';

export function switchTab(tabName) {
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

// JSON 解析失败时的回退 UI
export function renderParseErrorFallback(containerId) {
    const task = getCurrentTask();
    const taskIndex = getTaskIndex();
    const groupIndex = state.currentOutputGroup;
    const output = task?.model_outputs?.[groupIndex] || task?.model_output;
    if (!output?._parseError) return false;
    const container = document.getElementById(containerId);
    if (!container) return false;
    container.innerHTML = `
        <div class="p-4 rounded-2xl border border-amber-200 bg-amber-50">
            <div class="flex items-center gap-2 mb-3">
                <span class="mdi mdi-alert text-amber-500 text-lg"></span>
                <span class="text-sm font-semibold text-amber-800">JSON 解析失败，原始内容：</span>
            </div>
            <pre class="text-xs text-gray-700 bg-white border border-amber-100 rounded-xl p-3 overflow-auto max-h-60 whitespace-pre-wrap break-all">${escapeHTML(output.raw || '')}</pre>
            <button id="repair-single-btn-${taskIndex}-${groupIndex}"
                    onclick="repairSingleOutput(${taskIndex}, ${groupIndex})"
                    class="mt-3 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1">
                <span class="mdi mdi-wrench"></span> 修复此条
            </button>
        </div>`;
    return true;
}

// ─── LLM 修复 ────────────────────────────────────────────────────────────────
