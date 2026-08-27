# Digitalman MCP Server

stdio MCP 服务，为标准插件提供三个最小工具：打开并创建临时会话、读取已结束会话、删除指定会话。服务器通过 Launcher 的权限为 `0600` 的运行元数据连接控制面和 Session Bridge，不读取活动会话，不记录正文。

开发时可运行 `node packages/mcp-server/src/cli.js`，每行输入和输出一条 JSON-RPC 消息。

当前 `.mcp.json` 为本机 marketplace 验收配置，使用仓库内 MCP 入口的绝对路径。公开分发前必须增加自包含构建产物并移除该机器路径。
