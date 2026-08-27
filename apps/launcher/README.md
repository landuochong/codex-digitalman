# Launcher

负责启动或聚焦独立数字人窗口，并承接可选 Codex 入口发出的受限主机动作。

首版接口：`open`、`focus`、`status`、`quit`。必须单实例运行，使用固定动作白名单，不接受任意 Shell 命令。Session Bridge 初期可以由该进程托管。

实现前先确认 `/Users/Admin/whb/AI/digitalman/` 的启动命令、窗口技术栈和健康检查方式。

## 当前实现

已确认现有数字人由 Node.js `server.mjs` 提供，默认监听 `3000`，健康检查为 `GET /api/health`。Launcher 使用固定参数直接启动该入口，不经过 Shell；只接受 `open`、`focus`、`status`、`quit` 四个动作。

Launcher 同时托管 Session Bridge，并把随机端口和短期令牌通过环境变量 `CODEX_DIGITALMAN_BRIDGE_URL`、`CODEX_DIGITALMAN_BRIDGE_TOKEN` 传给数字人子进程。运行元数据写入用户 Application Support 目录，目录与文件权限分别为 `0700`、`0600`，不进入源码目录或 Git。

```bash
npm run start:launcher
npm run digitalman:open
npm run digitalman:status
npm run digitalman:quit
```

默认使用 Google Chrome 的 `--app` 模式创建独立窗口，并以 `anime` 配置打开。可以通过 `DIGITALMAN_PORT`、`DIGITALMAN_PROFILE` 和 `DIGITALMAN_BROWSER_APP` 调整；浏览器仅允许 Google Chrome、Chromium 或 Microsoft Edge，防止把配置变成任意命令入口。
