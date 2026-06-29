# Node-RED Message File Logger

[简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

這是一個 Node-RED runtime plugin，不會註冊任何新的節點類型，也不會出現在左側節點面板。

它透過 Node-RED Messaging Hooks 記錄：

- `input`：節點即將收到的訊息
- `output`：節點送出的訊息
- `complete`：節點完成處理訊息
- `error`：節點處理訊息時發生錯誤
- `status`：節點狀態變化，例如連線狀態、警告或錯誤狀態

外掛也會索引 `flows.json`，因此日誌可以包含：

- `flowLabel`：flow/tab 名稱
- `node.config`：節點設定摘要
- `destination.node`：下游節點摘要

每行日誌都是一筆 JSON 文字。檔案按小時輪替，預設最多保留 72 個小時檔案。

## 日誌檔案

預設目錄：

```text
<Node-RED userDir>/message-logs
```

預設檔名：

```text
node-red-messages-YYYY-MM-DD-HH.log
```

範例：

```json
{"ts":"2026-06-30T01:23:45.678Z","event":"input","node":{"id":"abc","type":"function","name":"Normalize","flow":"tab1","flowLabel":"Kitchen","config":{"name":"Normalize","outputs":1,"funcLines":3,"funcPreview":"msg.payload = ..."}},"msgid":"123","message":{"payload":"hello"}}
```

## 安裝

```bash
cd ~/.node-red
npm install node-red-contrib-message-file-logger
```

安裝後請重新啟動 Node-RED。

如果你使用 Home Assistant 社群版 Node-RED add-on，Node-RED 的使用者目錄通常是 add-on 內部的 `/config`，不是 Home Assistant Core 的 `/config`。

## 設定

在 `settings.js` 中設定：

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

環境變數會覆蓋對應設定：

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

## 注意事項

- 記錄每個節點的輸入和輸出會產生較大的日誌檔案，繁忙流程尤其明顯。
- 預設會遮蔽 `token`、`password`、`authorization`、`cookie` 等欄位。
- 節點設定只記錄摘要；Function 和 Template 內容只記錄截斷預覽。
- 如果有 `complete` 但沒有對應的 `output`，通常表示節點消耗了訊息、過濾了訊息、回傳了 `null`，或處理失敗。
- `status` 事件有助於定位連線失敗、找不到實體、節點內部 warning 等問題。
- Buffer 會記錄位元組數和少量 base64 預覽。
- 循環引用會記錄為 `[circular]`。
