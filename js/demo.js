import { processImportData } from './parser.js';

export function loadDemoData() {
    const demoTasks = [
        {
            id: "demo-001",
            video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
            model_output: {
                segments: [
                    { start: 0, end: 3, label: "开场", description: "大象出现" },
                    { start: 3, end: 7, label: "主体", description: "兔子和小鸟互动" },
                    { start: 7, end: 10, label: "结尾", description: "场景结束" }
                ],
                text_understanding: {
                    summary: "这是一个卡通动画短片",
                    entities: ["大象", "兔子", "小鸟"],
                    sentiment: "positive",
                    themes: ["友谊", "自然"]
                },
                visual_understanding: {
                    scene_type: "户外自然场景",
                    objects_detected: ["大象", "兔子", "蝴蝶", "树木", "草地"],
                    color_palette: ["绿色", "蓝色", "棕色"],
                    motion_intensity: "medium"
                },
                keyframes: [
                    { time: 1, label: "大象特写" },
                    { time: 5, label: "兔子出场" },
                    { time: 9, label: "结束画面" }
                ]
            }
        },
        {
            id: "demo-002", 
            video_url: "https://www.w3schools.com/html/movie.mp4",
            model_output: {
                segments: [
                    { start: 0, end: 6, label: "完整片段", description: "Bear介绍" }
                ],
                text_understanding: {
                    summary: "Big Buck Bunny 片段",
                    entities: ["Bear"],
                    sentiment: "neutral"
                },
                visual_understanding: {
                    scene_type: "动画场景",
                    objects_detected: ["熊"],
                    color_palette: ["棕色", "绿色"]
                },
                keyframes: [
                    { time: 3, label: "主画面" }
                ]
            }
        }
    ];

    processImportData(demoTasks);
}

// 在控制台暴露demo函数方便测试
window.loadDemoData = loadDemoData;

