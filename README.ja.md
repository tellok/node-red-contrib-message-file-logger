# Node-RED Message File Logger

[简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

## 目的

このプラグインは Node-RED フローの挙動を診断するためのものです。ノード単位のメッセージ移動、処理完了、エラー、ステータス変更、簡潔なノード設定コンテキストを、1 時間ごとにローテーションされる JSONL ファイルへ記録します。これにより、各所に debug ノードを追加しなくても、発生後のフロー不具合を追跡できます。

これは Node-RED の runtime plugin です。新しいノードタイプは登録せず、エディタのパレットにも表示されません。

Node-RED Messaging Hooks を使って次のイベントを記録します。

- `input`: ノードが受け取る直前のメッセージ
- `output`: ノードが送信したメッセージ
- `complete`: ノードがメッセージ処理を完了したイベント
- `error`: ノードがエラー付きで処理を完了したイベント
- `status`: 接続状態や警告などのノードステータス更新

また `flows.json` をインデックス化し、ログに次の情報を追加できます。

- `flowLabel`: flow/tab の名前
- `node.config`: ノード設定の要約
- `destination.node`: 下流ノードの要約

ログは 1 行 1 JSON のテキスト形式です。ファイルは 1 時間ごとにローテーションされ、デフォルトで最大 72 ファイルを保持します。

## ログファイル

デフォルトのディレクトリ:

```text
<Node-RED userDir>/message-logs
```

デフォルトのファイル名:

```text
node-red-messages-YYYY-MM-DD-HH.log
```

例:

```json
{"ts":"2026-06-30T01:23:45.678Z","event":"input","node":{"id":"abc","type":"function","name":"Normalize","flow":"tab1","flowLabel":"Kitchen","config":{"name":"Normalize","outputs":1,"funcLines":3,"funcPreview":"msg.payload = ..."}},"msgid":"123","message":{"payload":"hello"}}
```

## インストール

```bash
cd ~/.node-red
npm install node-red-contrib-message-file-logger
```

インストール後、Node-RED を再起動してください。

Home Assistant community Node-RED add-on を使っている場合、Node-RED のユーザーディレクトリは通常 add-on 内の `/config` であり、Home Assistant Core の `/config` ではありません。

## 設定

`settings.js` に設定します。

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

環境変数は対応する設定を上書きします。

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

## 注意

- すべてのノード入出力を記録すると、特に高頻度のフローではログが大きくなります。
- `token`、`password`、`authorization`、`cookie` などのキーはデフォルトでマスクされます。
- ノード設定は安全なフィールドの要約として記録されます。Function/Template の本文は短いプレビューに切り詰められます。
- `complete` があるのに対応する `output` がない場合、ノードがメッセージを消費、フィルタ、`null` 返却、または失敗した可能性があります。
- `status` イベントは接続失敗、エンティティ未検出、ノード内部の warning などの診断に役立ちます。
- Buffer はバイト数と短い base64 プレビューとして記録されます。
- 循環参照は `[circular]` として記録されます。
