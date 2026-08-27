# Shared Contracts

存放跨 Launcher、数字人窗口、Session Bridge 和 MCP 服务共享的协议版本、类型、错误码与测试样例。

该目录不承载业务流程。任何公开字段变更先更新 `../../docs/SESSION_CONTRACT.md`，再同步实现和契约测试。

当前 JavaScript 契约从 `src/index.js` 导出，包括协议版本、允许的状态/角色/来源、错误码和默认保留参数。
