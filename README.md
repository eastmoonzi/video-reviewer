# 视频审查工作台

一站式视频模型输出审查平台，支持对模型生成内容进行可视化审查和打分标注。

## 功能特性

- **视频播放器**：支持倍速播放、精确跳转、区间循环
- **时间轴联动**：点击模型输出的时间段，视频自动跳转到对应位置
- **四维度审查**：
  - 时间段切分
  - 文本理解
  - 视觉理解  
  - 关键帧提取
- **快捷打分**：支持 1-5 星评分，快捷键操作
- **任务管理**：导入/导出、进度追踪
- **本地存储**：自动保存审查进度

## 快速开始

### 方式一：直接打开
双击 `index.html` 在浏览器中打开即可使用。

### 方式二：本地服务器（推荐）
```bash
# 使用 Python
python3 -m http.server 8080

# 或使用 Node.js
npx serve .
```
然后访问 http://localhost:8080

## 使用说明

### 导入任务
1. 点击左侧"导入"按钮
2. 选择 JSON 或 CSV 文件，或手动输入
3. 参考 `sample-data.json` 了解数据格式

### 审查流程
1. 从左侧任务列表选择任务
2. 观看视频，查看右侧模型输出
3. 点击时间段或关键帧可跳转到视频对应位置
4. 对四个维度分别打分（1-5星）
5. 添加备注（可选）
6. 点击"提交并下一条"

### 快捷键
| 按键 | 功能 |
|------|------|
| Space | 播放/暂停 |
| ← | 后退5秒 |
| → | 前进5秒 |
| 1-5 | 快速打分 |
| Tab | 切换维度标签 |
| Enter | 提交并下一条 |

### 数据格式

```json
[
  {
    "id": "task-001",
    "video_url": "https://example.com/video.mp4",
    "model_output": {
      "segments": [
        { "start": 0, "end": 10, "label": "片段1", "description": "描述" }
      ],
      "text_understanding": { ... },
      "visual_understanding": { ... },
      "keyframes": [
        { "time": 5, "label": "关键帧1", "thumbnail": "url" }
      ]
    }
  }
]
```

## 导出结果

点击"导出"按钮，下载包含所有审查结果的 JSON 文件：

```json
[
  {
    "id": "task-001",
    "video_url": "...",
    "review": {
      "ratings": {
        "segments": 4,
        "text": 5,
        "visual": 3,
        "keyframes": 4
      },
      "notes": "备注内容",
      "completed": true,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  }
]
```

## 演示数据

在浏览器控制台执行以下命令加载演示数据：
```javascript
loadDemoData()
```

## 技术栈

- 纯静态前端，无需后端
- Tailwind CSS（CDN）
- Material Design Icons
- LocalStorage 持久化