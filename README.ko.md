# Node-RED Message File Logger

[简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

이 패키지는 Node-RED runtime plugin입니다. 새 노드 타입을 등록하지 않으며 에디터 팔레트에도 표시되지 않습니다.

Node-RED Messaging Hooks를 사용해 다음 이벤트를 기록합니다.

- `input`: 노드가 메시지를 받기 직전
- `output`: 노드가 전송한 메시지
- `complete`: 노드가 메시지 처리를 완료한 이벤트
- `error`: 노드가 오류와 함께 처리를 완료한 이벤트
- `status`: 연결 상태나 경고 같은 노드 상태 변경

또한 `flows.json`을 인덱싱해서 로그에 다음 정보를 추가할 수 있습니다.

- `flowLabel`: flow/tab 이름
- `node.config`: 노드 설정 요약
- `destination.node`: 하위 노드 요약

로그는 한 줄에 하나의 JSON 객체로 기록됩니다. 파일은 시간 단위로 회전하며 기본적으로 최대 72개 파일을 보관합니다.

## 로그 파일

기본 디렉터리:

```text
<Node-RED userDir>/message-logs
```

기본 파일 이름:

```text
node-red-messages-YYYY-MM-DD-HH.log
```

예시:

```json
{"ts":"2026-06-30T01:23:45.678Z","event":"input","node":{"id":"abc","type":"function","name":"Normalize","flow":"tab1","flowLabel":"Kitchen","config":{"name":"Normalize","outputs":1,"funcLines":3,"funcPreview":"msg.payload = ..."}},"msgid":"123","message":{"payload":"hello"}}
```

## 설치

```bash
cd ~/.node-red
npm install node-red-contrib-message-file-logger
```

설치 후 Node-RED를 다시 시작하세요.

Home Assistant community Node-RED add-on을 사용하는 경우 Node-RED 사용자 디렉터리는 보통 add-on 내부의 `/config`이며, Home Assistant Core의 `/config`와는 다릅니다.

## 설정

`settings.js`에 설정합니다.

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

환경 변수는 해당 설정을 덮어씁니다.

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

## 참고

- 모든 노드의 입력과 출력을 기록하면, 바쁜 플로우에서는 로그 파일이 커질 수 있습니다.
- `token`, `password`, `authorization`, `cookie` 같은 키는 기본적으로 마스킹됩니다.
- 노드 설정은 안전한 필드 요약으로 기록됩니다. Function/Template 본문은 짧은 미리보기로 잘립니다.
- `complete`가 있지만 대응되는 `output`이 없다면 노드가 메시지를 소비했거나, 필터링했거나, `null`을 반환했거나, 처리에 실패했을 수 있습니다.
- `status` 이벤트는 연결 실패, 엔티티 미발견, 노드 내부 warning 등을 진단하는 데 도움이 됩니다.
- Buffer는 바이트 수와 짧은 base64 미리보기로 기록됩니다.
- 순환 참조는 `[circular]`로 기록됩니다.
