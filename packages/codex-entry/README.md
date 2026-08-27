# Codex Entry

可选的 Codex Desktop 左侧快捷入口。参考 Codex Dream Skin / QQ Skin 的 CDP 直接渲染方式，克隆原生 Plugins 行并绑定 `open-digitalman` 动作，在 Codex 主工作区构造数字人 DOM 面板。

该组件必须带版本守卫、总开关和失败回退。禁止读取 Codex 页面内容、浏览器存储或认证信息。完整设计见 `../../docs/ENTRY_INTEGRATION.md`。

## 当前实现

CDP 控制器只连接显式给出的环回调试端口，通过 `Runtime.addBinding` 接收 `open-digitalman` 或 `focus-digitalman`，再调用 Launcher 的固定动作。注入脚本只查找可见的 Plugins/插件行、克隆视觉结构并添加“露米休息室”，不读取任务正文、页面存储或认证数据；页面启动期使用 250ms 防抖重试，连续二十个稳定检查周期仍无法定位时才停止观察。控制器热重连会撤销旧 Observer 并重新注入，不会被残留标记阻断。

点击入口后，Launcher 以 `internal` 显示模式预创建会话并只启动本地数字人服务。Renderer 直接显示人物卡与麦克风主控；用户点击后通过 `MediaRecorder` 产生一次性录音，由受限 binding 交给控制器代理固定 `/api/asr/transcribe`，最终文本再进入固定 `/api/chat`，回复通过固定 `/api/speech` 合成并在页面内播放。文字输入与记录默认收起，仅作为语音故障时的备用。原始录音和回复音频不落盘。没有 iframe、webview 或自动外跳逻辑。

Codex 26.820.60940 的页面 CSP 默认拒绝环回 iframe，CDP `Page.setBypassCSP` 无效，主进程也拒绝动态 webview guest。当前实现直接构造 DOM/CSS，因此启动脚本不关闭 Web 安全策略。

该增强层默认关闭。当前本机版本 `26.820.60940` 已加入测试允许列表，并保留先前测试版本；只有一键测试脚本显式设置 kill switch 后才会注入：

```bash
CODEX_DIGITALMAN_ENTRY_ENABLED=true \
CODEX_DIGITALMAN_CODEX_VERSION=26.820.60940 \
CODEX_DIGITALMAN_CODEX_DEBUG_PORT=<专用环回端口> \
npm run start:entry
```

把 `CODEX_DIGITALMAN_ENTRY_ENABLED` 改为 `false` 或省略即为 kill switch。未知版本、找不到页面目标或连续定位失败都会回退到标准插件入口。

本机实测推荐先完全退出 Codex，再从仓库根目录运行 `./scripts/start_internal_codex.sh`。脚本会验证应用路径、精确版本、端口和 CDP 页面，然后后台启动入口控制器。`./scripts/status_internal_codex.sh` 查看状态；`./scripts/stop_internal_codex.sh` 只停止身份匹配的控制器。停止后还需退出测试用 Codex，并从 Dock 正常重开，才能关闭无认证的 CDP 端口。
