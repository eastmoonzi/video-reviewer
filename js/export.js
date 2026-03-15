import { state, getTasks, AUDIOVISUAL_DIMENSIONS, setTaskIndex } from './state.js';

export function exportResults() {
    const tasks = getTasks();
    if (tasks.length === 0) {
        alert('暂无可导出的数据');
        return;
    }

    if (state.reviewMode === 'segment') {
        exportSegmentResults();
    } else if (state.reviewMode === 'audiovisual') {
        exportAudiovisualResults();
    } else {
        exportProfileResults();
    }
}

export function exportSegmentResults() {
    // 分段语义详情导出逻辑
    const tasks = getTasks();
    const exportData = [];

    tasks.forEach(task => {
        const groupCount = task.model_outputs?.length || 1;

        if (groupCount > 1 && task.reviews) {
            task.reviews.forEach((review, groupIndex) => {
                if (task.model_outputs?.[groupIndex]?._parseError) return; // 跳过解析失败条目
                const ratings = review?.ratings || {};
                const notes = review?.notes || {};
                const modelName = task.model_names?.[groupIndex] || `模型${groupIndex + 1}`;
                
                exportData.push({
                    '任务ID': task.id || '',
                    '视频URL': task.video_url || '',
                    '模型名称': modelName,
                    '状态': review?.completed ? '已完成' : '未完成',
                    '时间段切分评分': ratings.time || 0,
                    '时间段切分备注': notes.time || '',
                    '文本理解评分': ratings.text || 0,
                    '文本理解备注': notes.text || '',
                    '视觉理解评分': ratings.visual || 0,
                    '视觉理解备注': notes.visual || '',
                    '关键帧评分': ratings.keyframe || 0,
                    '关键帧备注': notes.keyframe || '',
                    '完成时间': review?.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
                });
            });
        } else {
            const review = task.reviews?.[0] || task.review || {};
            const ratings = review.ratings || {};
            const notes = review.notes || {};
            const modelName = task.model_names?.[0] || '-';
            
            exportData.push({
                '任务ID': task.id || '',
                '视频URL': task.video_url || '',
                '模型名称': modelName,
                '状态': review.completed ? '已完成' : '未完成',
                '时间段切分评分': ratings.time || 0,
                '时间段切分备注': notes.time || '',
                '文本理解评分': ratings.text || 0,
                '文本理解备注': notes.text || '',
                '视觉理解评分': ratings.visual || 0,
                '视觉理解备注': notes.visual || '',
                '关键帧评分': ratings.keyframe || 0,
                '关键帧备注': notes.keyframe || '',
                '完成时间': review.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
            });
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
        { wch: 10 }, { wch: 50 }, { wch: 15 }, { wch: 8 },
        { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
        { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 20 }
    ];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '分段语义详情');
    XLSX.writeFile(workbook, `分段语义详情-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportProfileResults() {
    // 全篇语义画像导出逻辑
    const tasks = getTasks();
    const exportData = [];
    
    tasks.forEach(task => {
        const groupCount = task.model_outputs?.length || 1;
        
        if (groupCount > 1 && task.profileReviews) {
            task.profileReviews.forEach((review, groupIndex) => {
                if (task.model_outputs?.[groupIndex]?._parseError) return; // 跳过解析失败条目
                const ratings = review?.ratings || {};
                const notes = review?.notes || {};
                const modelName = task.model_names?.[groupIndex] || `模型${groupIndex + 1}`;
                
                exportData.push({
                    '任务ID': task.id || '',
                    '视频URL': task.video_url || '',
                    '模型名称': modelName,
                    '状态': review?.completed ? '已完成' : '未完成',
                    '叙事类型评分': ratings.narrative_type >= 0 ? ratings.narrative_type : '',
                    '叙事类型备注': notes.narrative_type || '',
                    '画面类型评分': ratings.visual_type >= 0 ? ratings.visual_type : '',
                    '画面类型备注': notes.visual_type || '',
                    '内容总结评分': ratings.summary >= 0 ? ratings.summary : '',
                    '内容总结备注': notes.summary || '',
                    '创作意图评分': ratings.intent_type >= 0 ? ratings.intent_type : '',
                    '创作意图备注': notes.intent_type || '',
                    '主题一致性评分': ratings.topic_consistency >= 0 ? ratings.topic_consistency : '',
                    '主题一致性备注': notes.topic_consistency || '',
                    '核心观点评分': ratings.core_claim >= 0 ? ratings.core_claim : '',
                    '核心观点备注': notes.core_claim || '',
                    '情感类型评分': ratings.emotion_type >= 0 ? ratings.emotion_type : '',
                    '情感类型备注': notes.emotion_type || '',
                    '完成时间': review?.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
                });
            });
        } else {
            const review = task.profileReviews?.[0] || {};
            const ratings = review.ratings || {};
            const notes = review.notes || {};
            const modelName = task.model_names?.[0] || '-';
            
            exportData.push({
                '任务ID': task.id || '',
                '视频URL': task.video_url || '',
                '模型名称': modelName,
                '状态': review.completed ? '已完成' : '未完成',
                '叙事类型评分': ratings.narrative_type >= 0 ? ratings.narrative_type : '',
                '叙事类型备注': notes.narrative_type || '',
                '画面类型评分': ratings.visual_type >= 0 ? ratings.visual_type : '',
                '画面类型备注': notes.visual_type || '',
                '内容总结评分': ratings.summary >= 0 ? ratings.summary : '',
                '内容总结备注': notes.summary || '',
                '创作意图评分': ratings.intent_type >= 0 ? ratings.intent_type : '',
                '创作意图备注': notes.intent_type || '',
                '主题一致性评分': ratings.topic_consistency >= 0 ? ratings.topic_consistency : '',
                '主题一致性备注': notes.topic_consistency || '',
                '核心观点评分': ratings.core_claim >= 0 ? ratings.core_claim : '',
                '核心观点备注': notes.core_claim || '',
                '情感类型评分': ratings.emotion_type >= 0 ? ratings.emotion_type : '',
                '情感类型备注': notes.emotion_type || '',
                '完成时间': review.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : ''
            });
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
        { wch: 10 }, { wch: 50 }, { wch: 15 }, { wch: 8 },
        { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
        { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
        { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
        { wch: 12 }, { wch: 20 }, { wch: 20 }
    ];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '全篇语义画像');
    XLSX.writeFile(workbook, `全篇语义画像-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportAudiovisualResults() {
    const tasks = getTasks();
    const exportData = [];

    const buildRow = (task, review, modelName) => {
        const ratings = review?.ratings || {};
        const notes = review?.notes || {};
        const row = {
            '任务ID': task.id || '',
            '视频URL': task.video_url || '',
            '模型名称': modelName,
            '状态': review?.completed ? '已完成' : '未完成'
        };
        AUDIOVISUAL_DIMENSIONS.forEach(dim => {
            row[`${dim.label}评分`] = ratings[dim.key] >= 0 ? ratings[dim.key] : '';
            row[`${dim.label}备注`] = notes[dim.key] || '';
        });
        row['完成时间'] = review?.timestamp ? new Date(review.timestamp).toLocaleString('zh-CN') : '';
        return row;
    };

    tasks.forEach(task => {
        const groupCount = task.model_outputs?.length || 1;

        if (groupCount > 1 && task.audiovisualReviews) {
            task.audiovisualReviews.forEach((review, groupIndex) => {
                if (task.model_outputs?.[groupIndex]?._parseError) return; // 跳过解析失败条目
                const modelName = task.model_names?.[groupIndex] || `模型${groupIndex + 1}`;
                exportData.push(buildRow(task, review, modelName));
            });
        } else {
            const review = task.audiovisualReviews?.[0] || {};
            const modelName = task.model_names?.[0] || '-';
            exportData.push(buildRow(task, review, modelName));
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    // 4 基础列 + 15*2 评分/备注列 + 1 完成时间 = 35 列
    const cols = [
        { wch: 10 }, { wch: 50 }, { wch: 15 }, { wch: 8 }
    ];
    AUDIOVISUAL_DIMENSIONS.forEach(() => {
        cols.push({ wch: 12 }, { wch: 20 });
    });
    cols.push({ wch: 20 });
    worksheet['!cols'] = cols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '基础音画质量');
    XLSX.writeFile(workbook, `基础音画质量-${new Date().toISOString().slice(0, 10)}.xlsx`);
}


// ============================================
// 按 nid/id 排序
// ============================================
export function sortTasksByNid() {
    const tasks = getTasks();
    if (tasks.length === 0) return;

    // 提取数字部分用于排序，支持纯数字或 "task-1" 等格式
    const extractNum = (id) => {
        if (!id) return Infinity;
        const match = String(id).match(/(\d+)/);
        return match ? parseInt(match[1], 10) : Infinity;
    };

    tasks.sort((a, b) => extractNum(a.rawId || a.id) - extractNum(b.rawId || b.id));

    // 重置选中索引到第一个未完成的任务
    const isComplete = (t) => state.reviewMode === 'segment' ? t.review?.completed
        : state.reviewMode === 'audiovisual' ? t.audiovisualReview?.completed
        : t.profileReview?.completed;
    const firstIncomplete = tasks.findIndex(t => !isComplete(t));
    setTaskIndex(firstIncomplete >= 0 ? firstIncomplete : 0);

    // saveToLocalStorage();
    // updateUI();
    // selectTask(getTaskIndex());
}
