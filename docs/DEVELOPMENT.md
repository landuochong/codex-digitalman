# 开发顺序

## 阶段 1：会话最小闭环

- 在 `packages/shared` 固化会话类型和错误码。
- 在 `packages/session-bridge` 实现内存存储、HTTP API、TTL 和契约测试。
- 使用模拟文本轮次验证创建、结束、读取、删除流程。

完成定义：无需数字人 UI，也能通过测试跑通一次完整会话。

## 阶段 2：独立窗口适配

- 在 `apps/launcher` 实现单实例、启动、聚焦、退出和健康检查。
- 在 `apps/digitalman-window` 对接 `/Users/Admin/whb/AI/digitalman/` 的实际启动方式。
- 只提交最终文本到 Session Bridge。

完成定义：从命令行打开窗口，聊天结束后能从 Bridge 读取会话。

## 阶段 3：标准插件

- [x] 实现 stdio MCP 服务和三个最小工具。
- [x] 生成 `.mcp.json`，再把 `mcpServers` 加入插件清单。
- [x] 用 Skill 生成 Markdown 预览并处理空会话、活动会话和删除后的会话。
- [x] 创建本地 marketplace 仅用于安装测试。

完成定义：不依赖 UI 注入，也能在 Codex 中打开窗口并整理最近会话。

## 阶段 4：左侧快捷入口

- [x] 在 `packages/codex-entry` 实现版本守卫、按钮注入和主机绑定。
- [x] 只允许 `open-digitalman` 与 `focus-digitalman` 动作。
- [x] 验证并淘汰被 CSP/guest 策略阻止的 iframe/webview 方案。
- [x] 实现 Codex 主工作区直接 DOM 渲染面板与受限文字聊天桥，不自动打开独立窗口。
- [ ] 为已验证 Codex 版本补充入口失效、重复注入和重绘录制回归测试；在此之前支持版本列表保持为空。

完成定义：支持的 Codex 版本显示快捷入口，不支持的版本自动降级。

## 阶段 5：后续能力

按需评估 Obsidian 写入、主题页和双向关联、长期记忆、跨设备同步以及更多角色。每项能力单独设计权限与数据保留策略。
