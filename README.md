# Node-RED Message File Logger

[简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

This is a Node-RED runtime plugin. It does not register any new node types.

It uses Node-RED Messaging Hooks to log:

- `input`: a message about to be received by a node
- `output`: a message sent by a node
- `complete`: a node completed processing a message
- `error`: a node completed with an error
- `status`: a node status update, such as connection or warning state

The plugin also indexes `flows.json` so each event can include:

- `flowLabel`: the tab name for the flow id
- `node.config`: a compact node configuration summary

Each log line is JSON text. Files rotate hourly and the plugin keeps at most 72 hourly files by default.

## Files

Default directory:

```text
<Node-RED userDir>/message-logs
```

Default filename pattern:

```text
node-red-messages-YYYY-MM-DD-HH.log
```

Example line:

```json
{"ts":"2026-06-30T01:23:45.678Z","event":"input","node":{"id":"abc","type":"function","name":"Normalize","flow":"tab1","flowLabel":"Kitchen","config":{"name":"Normalize","outputs":1,"funcLines":3,"funcPreview":"msg.payload = ..."}},"msgid":"123","message":{"payload":"hello"}}
```

## Install

Install from npm or from a local tarball/folder:

```bash
cd ~/.node-red
npm install node-red-contrib-message-file-logger
```

Restart Node-RED after installation.

For the Home Assistant community Node-RED add-on, the Node-RED user directory is usually the add-on's `/config`, not Home Assistant Core's `/config`.

## Configure

In `settings.js`:

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

Environment variables override the matching settings:

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

## Notes

- Logging every node input/output can create large files on busy flows.
- Values with keys such as `token`, `password`, `authorization`, and `cookie` are redacted by default.
- Node configuration is summarized with a safe field allowlist. Function/template bodies are truncated previews.
- `complete` with no matching `output` often points to nodes that consumed, filtered, or failed to emit a message.
- `status` events help diagnose connection and entity lookup issues that may not appear as message output.
- Buffers are logged as byte length plus a small base64 preview.
- Circular objects are represented as `[circular]`.
