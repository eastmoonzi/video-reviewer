import { selectTask } from './task.js';
import { state, getTasks, getTaskIndex, getWorkspaceKey } from './state.js';

export function saveToLocalStorage() {
    const wsId = state.currentWorkspaceId;
    if (!wsId) return;
    localStorage.setItem(getWorkspaceKey(wsId, 'segment-tasks'), JSON.stringify(state.segmentTasks));
    localStorage.setItem(getWorkspaceKey(wsId, 'segment-index'), state.segmentTaskIndex);
    localStorage.setItem(getWorkspaceKey(wsId, 'profile-tasks'), JSON.stringify(state.profileTasks));
    localStorage.setItem(getWorkspaceKey(wsId, 'profile-index'), state.profileTaskIndex);
    localStorage.setItem(getWorkspaceKey(wsId, 'audiovisual-tasks'), JSON.stringify(state.audiovisualTasks));
    localStorage.setItem(getWorkspaceKey(wsId, 'audiovisual-index'), state.audiovisualTaskIndex);
}

export function loadFromLocalStorage() {
    const wsId = state.currentWorkspaceId;
    if (!wsId) return;
    try {
        const segmentTasks = localStorage.getItem(getWorkspaceKey(wsId, 'segment-tasks'));
        const segmentIndex = localStorage.getItem(getWorkspaceKey(wsId, 'segment-index'));
        if (segmentTasks) {
            state.segmentTasks = JSON.parse(segmentTasks);
        }
        if (segmentIndex !== null) {
            state.segmentTaskIndex = parseInt(segmentIndex);
        }

        const profileTasks = localStorage.getItem(getWorkspaceKey(wsId, 'profile-tasks'));
        const profileIndex = localStorage.getItem(getWorkspaceKey(wsId, 'profile-index'));
        if (profileTasks) {
            state.profileTasks = JSON.parse(profileTasks);
        }
        if (profileIndex !== null) {
            state.profileTaskIndex = parseInt(profileIndex);
        }

        const audiovisualTasks = localStorage.getItem(getWorkspaceKey(wsId, 'audiovisual-tasks'));
        const audiovisualIndex = localStorage.getItem(getWorkspaceKey(wsId, 'audiovisual-index'));
        if (audiovisualTasks) {
            state.audiovisualTasks = JSON.parse(audiovisualTasks);
        }
        if (audiovisualIndex !== null) {
            state.audiovisualTaskIndex = parseInt(audiovisualIndex);
        }

        setTimeout(() => {
            const currentTasks = getTasks();
            const currentIndex = getTaskIndex();
            if (currentIndex >= 0 && currentIndex < currentTasks.length) {
                selectTask(currentIndex);
            }
        }, 150);
    } catch (e) {
        console.error('加载本地存储失败:', e);
    }
}
