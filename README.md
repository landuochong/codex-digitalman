# Codex Digitalman

Codex Digitalman 是一个本地优先的 Codex 真人数字人陪伴集成。用户可以直接在 Codex 主工作区切换真人角色、设置人物属性和音色，并以连续语音方式交流；结束后还可以让 Codex 把本次聊天整理成 Markdown 小记。

> 当前状态：标准插件、会话桥、Launcher、可选侧栏入口和 Codex 主工作区内嵌真人面板已经实现。内嵌入口带精确版本守卫、kill switch 和动作白名单；真人回答由本地 TTS 与 DINet 生成同步口型视频。

## 产品边界

MVP 包含：

- Codex 中的标准插件入口，以及可选的左侧快捷入口。
- Codex 主工作区内的真人数字人面板，以及独立窗口兼容层。
- 露米、小桃两位真人角色切换。
- 姓名、关系、说话风格、背景设定和音色设置。
- 连续语音识别、语音回复和 DINet 口型同步。
- 本地临时聊天会话与显式结束动作。
- 用户主动请求后，将最近一次已结束会话整理为 Markdown 预览。
- 原始会话的查询和删除。

MVP 暂不包含：

- 写入 Obsidian 或其他知识库。
- 后台自动总结、自动归档或自动上传。
- 持久保存音频、视频或摄像头数据。
- 把 Codex UI 注入方式当作稳定的官方扩展接口。

## 目录

```text
codex-digitalman/
├── apps/
│   ├── launcher/             # 启动/聚焦 Codex 与数字人窗口
│   └── digitalman-window/    # 独立窗口适配层
├── packages/
│   ├── codex-entry/          # 可选的 Codex 左侧入口注入器
│   ├── session-bridge/       # 本地会话 API 与未来 MCP 服务
│   └── shared/               # 公共类型、协议和错误码
├── plugins/codex-digitalman/
│   ├── .codex-plugin/plugin.json
│   └── skills/companion-chat/
└── docs/                     # 产品、架构、接口和安全设计
```

现有数字人项目 `/Users/Admin/whb/AI/digitalman/` 是数字人能力来源，不属于本仓库。本阶段不修改它；后续通过明确的启动命令和会话适配接口连接。

## 核心流程

1. 用户从插件、固定任务或可选左侧入口打开“露米休息室”。
2. Launcher 启动仅监听环回地址的本地服务，Codex 内嵌面板加载真人资源。
3. 用户选择角色和人物属性，点击一次麦克风开始连续通话。
4. 用户点击“结束聊天”，会话变为 `ended`。
5. 用户在 Codex 中说“整理刚才的聊天”。
6. Skill 读取最近一次已结束会话，生成笔记预览；不写入外部知识库。

## 文档导航

- [MVP 与验收标准](docs/MVP.md)
- [技术架构](docs/ARCHITECTURE.md)
- [Codex 入口设计](docs/ENTRY_INTEGRATION.md)
- [会话协议](docs/SESSION_CONTRACT.md)
- [安全与隐私](docs/SECURITY.md)
- [开发顺序](docs/DEVELOPMENT.md)

Codex 插件的标准组成以 [OpenAI 官方插件打包文档](https://developers.openai.com/plugins/build/plugins) 为准。自定义左侧按钮属于单独的桌面增强层，不是插件清单所承诺的能力。

## 当前里程碑

当前已完成 `session-bridge`、Launcher、数字人最终文本适配、stdio MCP、标准插件安装闭环和可选的 Codex 内嵌入口。内嵌面板不使用 iframe 或 DOM 中的外部页面，支持真人切换、人物属性、连续语音、TTS 和 DINet 口型同步。当前兼容的 Codex Desktop 精确版本由启动参数和允许列表共同控制。

## 许可证

代码按 [Apache License 2.0](LICENSE) 发布。真人素材、模型和语音资源可能适用各自的第三方许可，使用和再分发前请分别确认其授权范围。
