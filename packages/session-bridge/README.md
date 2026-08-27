# Session Bridge

本地会话服务，负责会话状态、最终文本轮次、短期存储、查询、删除和 TTL。默认仅监听环回地址或 Unix Domain Socket。

首版先实现 HTTP 契约和测试；协议稳定后再包装为插件内的 stdio MCP 服务。完整对象和端点见 `../../docs/SESSION_CONTRACT.md`。

## 本地运行

需要 Node.js 20 或更高版本，无第三方依赖：

```bash
npm run start:bridge
```

服务固定监听 `127.0.0.1`。未设置 `DIGITALMAN_BRIDGE_PORT` 时使用随机端口；未设置 `DIGITALMAN_BRIDGE_TOKEN` 时生成随机令牌。启动时向标准输出打印一次包含端口和令牌的 JSON，供未来 Launcher 安全接管。开发日志不得再次输出令牌或消息正文。

从仓库根目录运行 `npm test` 可执行内存存储与 HTTP 契约测试。
