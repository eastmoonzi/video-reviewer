// eventbus.js - 全局事件总线（无依赖，避免循环引用 TDZ）
export const EventBus = new EventTarget();
