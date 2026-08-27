# Digitalman Window Adapter

该目录承载现有数字人项目与 Codex 集成层之间的适配代码，不复制模型和角色素材。

适配器应提供：启动、聚焦、开始会话、提交最终文本轮次、显式结束会话、健康检查。原始音视频保持在数字人进程内，不发送到 Session Bridge。

当前适配层包含两个模块：`runtime.js` 负责启动/检查现有数字人服务并打开独立浏览器 App 窗口；`bridge-client.js` 只向 Session Bridge 提交规范化的最终文本轮次。适配层不会读取或传输音频、视频和摄像头帧。
