import { selectTask, updateUI } from './task.js';
import { getTasks, getTaskIndex } from './state.js';
import { quickParseJson, normalizeModelOutput } from './parser.js';
import { saveToLocalStorage } from './storage.js';

export const LLM_REPAIR_PROMPT = '将以下内容输出为标准 json 格式，不要任何其他输出。\n\n';

export async function callLLMRepair(text) {
    const useDefault = localStorage.getItem('llm-use-default') !== '';
    const baseUrl = useDefault ? 'https://api.deepseek.com'              : (localStorage.getItem('llm-base-url') || '');
    const apiKey  = useDefault ? 'sk-ffc1051e1e864ccfa8979445c45ca6e5'   : (localStorage.getItem('llm-api-key')  || '');
    const model   = useDefault ? 'deepseek-chat'                         : (localStorage.getItem('llm-model')    || 'deepseek-chat');

    if (!baseUrl || !apiKey) {
        throw new Error('请先在设置中配置 LLM API Key 和 Base URL');
    }

    const isAnthropic = baseUrl.includes('anthropic');
    const truncated = text.slice(0, 8000);

    const messages = [
        { role: 'user', content: LLM_REPAIR_PROMPT + truncated }
    ];

    const normalizedBase = baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '');

    const endpoint = isAnthropic
        ? normalizedBase + '/v1/messages'
        : normalizedBase + '/v1/chat/completions';
    const headers = isAnthropic
        ? { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

    const requestBody = { model, max_tokens: 8192, messages };
    if (!isAnthropic) requestBody.response_format = { type: 'json_object' };

    console.log('[LLM Repair] 请求:', endpoint, '模型:', model, '输入字符数:', truncated.length);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60秒超时

    let resp;
    try {
        resp = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
    } catch (fetchErr) {
        clearTimeout(timeout);
        if (fetchErr.name === 'AbortError') {
            throw new Error('请求超时（60秒），请检查 API 地址和网络');
        }
        throw new Error('网络请求失败: ' + fetchErr.message);
    }
    clearTimeout(timeout);

    console.log('[LLM Repair] 响应状态:', resp.status);

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const body = await resp.json();
    let reply = isAnthropic
        ? body?.content?.[0]?.text
        : body?.choices?.[0]?.message?.content;

    if (!reply) throw new Error('API 返回内容为空');

    console.log('[LLM Repair] 回复长度:', reply.length, '前200字符:', reply.slice(0, 200));

    // 用 quickParseJson 解析（自动处理代码块、XML标签、Python dict 等非标准格式）
    const parsed = quickParseJson(reply);
    if (parsed !== null && parsed !== undefined) {
        console.log('[LLM Repair] 解析成功');
        return parsed;
    }

    const preview = reply.slice(0, 150).replace(/\n/g, ' ');
    throw new Error('LLM 返回无法解析为 JSON: ' + preview + '...');
}

export async function repairSingleOutput(taskIndex, groupIndex) {
    const tasks = getTasks();
    const task = tasks[taskIndex];
    if (!task) return;
    const output = task.model_outputs?.[groupIndex];
    if (!output?._parseError) return;

    const btn = document.getElementById(`repair-single-btn-${taskIndex}-${groupIndex}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="mdi mdi-autorenew animate-spin"></span> 修复中... 60s';
        btn.classList.add('opacity-60', 'cursor-wait');
    }

    // 按钮倒计时
    let countdown = 60;
    const countdownTimer = setInterval(() => {
        countdown--;
        if (btn) {
            if (countdown > 0) {
                btn.innerHTML = `<span class="mdi mdi-autorenew animate-spin"></span> 修复中... ${countdown}s`;
            } else {
                btn.innerHTML = '<span class="mdi mdi-autorenew animate-spin"></span> 等待响应...';
                clearInterval(countdownTimer);
            }
        } else {
            clearInterval(countdownTimer);
        }
    }, 1000);

    try {
        const repaired = await callLLMRepair(output.raw);
        clearInterval(countdownTimer);
        if (repaired === null || repaired === undefined) {
            throw new Error('LLM 无法识别该 JSON');
        }
        task.model_outputs[groupIndex] = normalizeModelOutput(repaired);
        saveToLocalStorage();
        updateUI();
        // 重新渲染内容面板（updateUI 只刷新侧边栏，不刷新主面板）
        selectTask(getTaskIndex());
    } catch (e) {
        clearInterval(countdownTimer);
        console.error('[LLM Repair] 修复失败:', e);
        // 不用 alert（会阻塞 UI），直接在按钮上显示错误
        const btnNow = document.getElementById(`repair-single-btn-${taskIndex}-${groupIndex}`) || btn;
        if (btnNow) {
            btnNow.disabled = false;
            btnNow.innerHTML = '<span class="mdi mdi-alert text-red-500"></span> 修复失败';
            btnNow.classList.remove('opacity-60', 'cursor-wait');
            setTimeout(() => {
                btnNow.innerHTML = '<span class="mdi mdi-wrench"></span> 修复此条';
            }, 3000);
        }
    }
}

export async function repairAllErrors() {
    const tasks = getTasks();
    const toRepair = [];
    tasks.forEach((task, ti) => {
        task.model_outputs?.forEach((output, gi) => {
            if (output?._parseError) toRepair.push({ ti, gi, raw: output.raw });
        });
    });

    if (toRepair.length === 0) return;

    // 直接在侧边栏 banner 上显示进度，不弹模态框
    const banner = document.getElementById('parse-error-banner');
    const bannerBtn = banner?.querySelector('button');
    if (bannerBtn) {
        bannerBtn.disabled = true;
        bannerBtn.textContent = '修复中 0/' + toRepair.length;
    }

    let fixedCount = 0, failedCount = 0, doneCount = 0;

    const CONCURRENCY = 3;
    let cursor = 0;

    async function runNext() {
        while (cursor < toRepair.length) {
            const idx = cursor++;
            const { ti, gi, raw } = toRepair[idx];
            try {
                const repaired = await callLLMRepair(raw);
                if (repaired !== null && repaired !== undefined) {
                    tasks[ti].model_outputs[gi] = normalizeModelOutput(repaired);
                    fixedCount++;
                } else {
                    failedCount++;
                }
            } catch (e) {
                console.error(`[LLM Repair] 任务${ti}组${gi}修复失败:`, e.message);
                failedCount++;
            }
            doneCount++;
            // 实时更新 banner 进度
            if (bannerBtn) bannerBtn.textContent = `修复中 ${doneCount}/${toRepair.length}`;
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, toRepair.length); i++) {
        workers.push(runNext());
    }
    await Promise.all(workers);

    saveToLocalStorage();
    updateUI();
    // 如果当前任务的数据被修复了，刷新内容面板
    selectTask(getTaskIndex());

    // 恢复 banner 按钮
    if (bannerBtn) {
        bannerBtn.disabled = false;
        bannerBtn.textContent = '全部修复';
    }

    console.log(`[LLM Repair] 批量修复完成：成功 ${fixedCount}，失败 ${failedCount}`);
}

export function closeRepairModal() {
    const modal = document.getElementById('repair-progress-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

export function updateParseErrorBanner() {
    const tasks = getTasks();
    let count = 0;
    tasks.forEach(task => {
        task.model_outputs?.forEach(o => { if (o?._parseError) count++; });
    });
    const banner = document.getElementById('parse-error-banner');
    const countEl = document.getElementById('parse-error-count');
    if (!banner || !countEl) return;
    if (count > 0) {
        countEl.textContent = count;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

// ─── LLM 设置 ─────────────────────────────────────────────────────────────────

export function showSettings() {
    loadLLMSettings();
    document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('settings-modal').classList.add('flex');
}

export function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('settings-modal').classList.remove('flex');
}

export function saveLLMSettings() {
    const useDefault = document.getElementById('llm-use-default').checked;
    localStorage.setItem('llm-use-default', useDefault ? '1' : '');
    if (!useDefault) {
        localStorage.setItem('llm-base-url', document.getElementById('llm-base-url').value.trim());
        localStorage.setItem('llm-api-key',  document.getElementById('llm-api-key').value.trim());
        localStorage.setItem('llm-model',    document.getElementById('llm-model').value.trim());
    }
    closeSettingsModal();
}

export function loadLLMSettings() {
    const useDefault = localStorage.getItem('llm-use-default') !== '';
    const checkbox = document.getElementById('llm-use-default');
    if (checkbox) checkbox.checked = useDefault;

    const baseUrlEl = document.getElementById('llm-base-url');
    const apiKeyEl  = document.getElementById('llm-api-key');
    const modelEl   = document.getElementById('llm-model');
    if (baseUrlEl) baseUrlEl.value = localStorage.getItem('llm-base-url') || '';
    if (apiKeyEl)  apiKeyEl.value  = localStorage.getItem('llm-api-key')  || '';
    if (modelEl)   modelEl.value   = localStorage.getItem('llm-model')    || '';

    toggleDefaultLLM(useDefault);
}

export function toggleDefaultLLM(checked) {
    const fields = ['llm-base-url', 'llm-api-key', 'llm-model'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = checked;
        if (checked) {
            el.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        } else {
            el.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        }
    });
}
window.toggleDefaultLLM = toggleDefaultLLM;
