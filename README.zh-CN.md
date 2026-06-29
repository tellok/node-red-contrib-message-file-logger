# Node-RED Message File Logger

[简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

## 目标

这个插件用于诊断 Node-RED 流程行为。它把节点级消息流转、处理完成、错误、状态变化和简要节点配置上下文写入按小时轮转的 JSONL 文件，方便在问题发生后追踪流程 bug，而不需要到处添加 debug 节点。

这是一个 Node-RED runtime plugin，不会注册任何新的节点类型，也不会出现在左侧节点面板里。

它通过 Node-RED Messaging Hooks 记录：

- `input`：节点即将收到的消息
- `output`：节点发出的消息
- `complete`：节点完成处理消息
- `error`：节点处理消息时发生错误
- `status`：节点状态变化，例如连接状态、警告或错误状态

插件还会索引 `flows.json`，所以日志里可以包含：

- `flowLabel`：flow/tab 的名称
- `node.config`：节点配置摘要
- `destination.node`：下游节点摘要

每行日志都是一条 JSON 文本。文件按小时轮转，默认最多保留 72 个小时文件。

## 日志文件

默认目录：

```text
<Node-RED userDir>/message-logs
```

默认文件名：

```text
node-red-messages-YYYY-MM-DD-HH.log
```

示例：

```json
{"ts":"2026-06-30T01:23:45.678Z","event":"input","node":{"id":"abc","type":"function","name":"Normalize","flow":"tab1","flowLabel":"Kitchen","config":{"name":"Normalize","outputs":1,"funcLines":3,"funcPreview":"msg.payload = ..."}},"msgid":"123","message":{"payload":"hello"}}
```

## 安装

```bash
cd ~/.node-red
npm install node-red-contrib-message-file-logger
```

安装后重启 Node-RED。

如果你使用 Home Assistant 社区版 Node-RED add-on，Node-RED 的用户目录通常是 add-on 内部的 `/config`，不是 Home Assistant Core 的 `/config`。

## 配置

在 `settings.js` 中配置：

```js
module.exports = {
  messageFileLogger: {
    enabled: true,
    directory: "/config/node-red/message-logs",
    filenamePrefix: "node-red-messages",
    maxFiles: 72,
    maxFieldChars: 20000,
    maxConfigChars: 1200,
    includeFullMessage: true,
    includeNodeConfig: true,
    includeCompleteEvents: true,
    includeStatusEvents: true,
    flowsFile: "/config/flows.json",
    flowRefreshMs: 30000,
    redactKeys: [
      "authorization",
      "cookie",
      "password",
      "token",
      "access_token",
      "refresh_token",
      "secret",
      "api_key"
    ]
  }
};
```

环境变量会覆盖对应配置：

```bash
NR_MESSAGE_LOGGER_ENABLED=true
NR_MESSAGE_LOGGER_DIR=/config/node-red/message-logs
NR_MESSAGE_LOGGER_PREFIX=node-red-messages
NR_MESSAGE_LOGGER_MAX_FILES=72
NR_MESSAGE_LOGGER_MAX_FIELD_CHARS=20000
NR_MESSAGE_LOGGER_MAX_CONFIG_CHARS=1200
NR_MESSAGE_LOGGER_FLOWS_FILE=/config/flows.json
NR_MESSAGE_LOGGER_FLOW_REFRESH_MS=30000
```

## 说明

- 记录每个节点的输入和输出会产生较大的日志文件，繁忙流程尤其明显。
- 默认会脱敏 `token`、`password`、`authorization`、`cookie` 等字段。
- 节点配置只记录摘要；Function 和 Template 的正文只记录截断预览。
- 如果有 `complete` 但没有对应 `output`，通常说明节点消费了消息、过滤了消息、返回了 `null`，或处理失败。
- `status` 事件有助于定位连接失败、实体找不到、节点内部 warning 等问题。
- Buffer 会记录字节数和少量 base64 预览。
- 循环引用会记录为 `[circular]`。
