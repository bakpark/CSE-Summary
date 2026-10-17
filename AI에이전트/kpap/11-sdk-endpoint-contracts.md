# SDK 호스트 endpoint 계약

검토용 v1.0 / 2026-10-17. SDK 구현팀과 Playground 구현팀의 인터페이스 합의를 위한 문서다. 실제 HTTP 호스트 구현 완료를 뜻하지 않는다.

## 1. 제공 범위

SDK를 탑재한 서비스가 아래 endpoint를 제공한다. SDK 코어는 HTTP 프레임워크와 분리한다. 호스트 어댑터가 인증·요청 변환·응답 직렬화를 담당한다.

| 목적 | SDK 호스트 endpoint | 계약 |
|---|---|---|
| 서비스 발견 | `GET /.well-known/agent-card.json` | A2A Agent Card |
| 플로우차트 조회 | `GET /agents/{agentId}/graph` | KPAP GraphSpec 1.0 |
| 에이전트 실행 | `POST {Agent Card의 JSONRPC URL}` | A2A 1.0 JSON-RPC + KPAP 확장 |

이 문서의 `/a2a`는 실행 URL의 예시다. 호출자는 경로를 고정하지 않고 Agent Card의 `supportedInterfaces`에서 `protocolBinding=JSONRPC`, `protocolVersion=1.0`인 URL을 선택한다. 에이전트별 실행 URL은 등록된 agentId에 매핑한다. 다중 에이전트 호스트는 에이전트별 Card URL을 등록한다.

Playground 브라우저는 kpap 서버를 호출한다. kpap 서버가 SDK 호스트에 접속한다. 플랫폼의 `/api/v1/agents/{id}/runs`와 SDK 호스트의 A2A endpoint는 서로 다른 API다.

공통 식별자·실행 상태는 [공통 규격](00-common-contracts.md)을 따른다. 설정 타입·병합·검증의 원본은 [그래프·A2A 규약](../agentic%20platform/kpap-graph-minimal-contract.md)이다. 이 문서는 endpoint별 전송과 처리 순서를 정의한다.

## 2. 발견·인증 계약

Agent Card는 다음 두 값을 제공한다.

- `supportedInterfaces`: 실행 URL, `JSONRPC` 바인딩, A2A `1.0`.
- `capabilities.extensions`: `urn:kpap:graph-config:1`과 그래프 조회 URL.

확장 선언은 다음과 같다. 전체 Card는 [예제](prototype-node-workspace/dist/fixtures/agent-card.json)를 따른다.

```json
{
  "uri": "urn:kpap:graph-config:1",
  "description": "KPAP 그래프 조회 및 노드별 실행 설정",
  "required": false,
  "params": {
    "graphUrl": "https://agent.example.com/agents/support-agent/graph",
    "schemaVersion": "1.0",
    "metadataKey": "kpap"
  }
}
```

`graphUrl`·`schemaVersion`·`metadataKey`는 KPAP 확장 필드다. URI는 규약 식별자이며 조회 주소가 아니다. 운영용 URI는 조직 합의 후 확정한다.

호스트의 인증 방식은 Card의 securitySchemes·securityRequirements와 배포 설정으로 결정한다. 아래 예제의 Bearer는 예시다. 클라이언트가 전달한 프로젝트·환경 문자열만으로 권한을 부여하지 않는다. 서버는 인증 주체와 등록 정보를 대조한다. 조회와 실행 모두 자원 접근 권한을 검사한다.

## 3. 플로우차트 조회 endpoint

### 요청

```http
GET /agents/support-agent/graph HTTP/1.1
Host: agent.example.com
Authorization: Bearer <service-token>
Accept: application/json
If-None-Match: "support-agent-v2-view-a"
```

| 항목 | 필수 | 규칙 |
|---|---|---|
| agentId | 예 | 등록된 에이전트 ID. 실행 endpoint와 같은 에이전트 |
| 인증 | 예 | 배포에서 정한 서비스 인증 |
| If-None-Match | 아니오 | 이전 응답의 ETag. 최초 조회에는 생략 |
| query·body | 없음 | 최신 공개 그래프를 조회. 과거 실행 그래프는 플랫폼 실행 이력에서 조회 |

### 정상 응답

```http
HTTP/1.1 200 OK
Content-Type: application/json
ETag: "support-agent-v2-view-a"
Cache-Control: private, no-cache
```

```json
{
  "schemaVersion": "1.0",
  "agentId": "support-agent",
  "version": "v2",
  "nodes": [
    {"id": "input", "name": "입력", "type": "input"},
    {
      "id": "answer", "name": "답변 생성", "type": "llm",
      "config": {
        "prompt": "정책 근거로 답변하세요.",
        "model": "balanced",
        "tools": ["ticket-search"],
        "knowledge": {"resourceId": "customer-guide", "version": "v1", "topK": 5}
      },
      "editable": ["prompt", "model", "tools", "knowledge"],
      "configSchema": {
        "type": "object", "additionalProperties": false,
        "required": ["prompt", "model", "tools", "knowledge"],
        "properties": {
          "prompt": {"type": "string", "minLength": 1, "maxLength": 8000},
          "model": {"type": "string", "enum": ["balanced", "reasoning"]},
          "tools": {"type": "array", "uniqueItems": true, "maxItems": 10,
            "items": {"type": "string", "enum": ["ticket-search", "order-status"]}},
          "knowledge": {
            "type": "object", "additionalProperties": false,
            "required": ["resourceId", "version", "topK"],
            "properties": {
              "resourceId": {"type": "string", "enum": ["customer-guide", "returns-policy"]},
              "version": {"type": "string", "enum": ["v1"]},
              "topK": {"type": "integer", "minimum": 1, "maximum": 20}
            }
          }
        }
      }
    },
    {"id": "output", "name": "출력", "type": "output"}
  ],
  "edges": [
    {"source": "input", "target": "answer", "kind": "normal"},
    {"source": "answer", "target": "output", "kind": "normal"}
  ]
}
```

| 응답 필드 | Playground 처리 |
|---|---|
| schemaVersion | 지원 규격 확인. 미지원이면 표시·실행 중지 |
| agentId·version | 현재 편집 대상과 실행 요청의 graphVersion에 연결 |
| nodes[].id·name·type | 안정적인 노드 키·제목·종류 표시 |
| nodes[].config | 기본값 표시. 비밀값은 포함하지 않음 |
| nodes[].configSchema | 편집 컨트롤과 값 검증 구성 |
| nodes[].editable | 편집 가능한 최상위 키. 나머지는 읽기 전용 |
| nodes[].parentId | 선택적 그룹 소속. 동일 그래프의 group을 참조 |
| edges[].source·target | 연결선 표시. 양쪽 노드가 존재해야 함 |
| edges[].kind·label | 일반·조건·반복·병렬 연결과 설명 표시 |

노드 종류는 `input/output/llm/tool/rag/react/group/custom`이다. 연결 종류는 `normal/conditional/loop/parallel`이다. 전체 종류·스키마 부분집합·제약은 공통 규약을 따른다.

그래프 조회는 에이전트 실행이나 LLM 호출을 발생시키지 않는다. SDK는 등록·compile 시 보존한 GraphSpec을 반환한다. 임의 Python 코드·클로저에서 공개 설정을 추정하지 않는다. 조건 분기의 연결은 가능한 경로를 나타낸다. 실제 수행 경로는 관측으로 표시한다.

### 캐시·오류

ETag가 일치하면 `304 Not Modified`를 반환하고 본문을 생략한다. ETag는 권한에 따라 달라지는 표현도 구분한다. 캐시는 호출 주체·프로젝트·환경·agentId별로 격리한다. 그래프 version은 실행 호환성 확인에 사용하며 ETag와 대체하지 않는다.

| HTTP | code | 의미·호출자 처리 |
|---|---|---|
| 400 | INVALID_REQUEST | 경로·요청 수정 |
| 401 | UNAUTHENTICATED | 인증 갱신 |
| 403 | FORBIDDEN | 조회 권한 확인 |
| 404 | AGENT_NOT_FOUND | 등록 대상 확인 |
| 503 | GRAPH_UNAVAILABLE | 조회 장애 표시. 기존 화면을 최신으로 간주하지 않음 |

```json
{"code":"GRAPH_UNAVAILABLE","message":"그래프를 조회할 수 없습니다.","requestId":"req-graph-1"}
```

## 4. A2A 실행 endpoint

### 요청

```http
POST /a2a HTTP/1.1
Host: agent.example.com
Authorization: Bearer <service-token>
Content-Type: application/json
A2A-Version: 1.0
A2A-Extensions: urn:kpap:graph-config:1
```

```json
{
  "jsonrpc": "2.0",
  "id": "rpc-1",
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "msg-1",
      "role": "ROLE_USER",
      "parts": [{"text": "반품 배송비는 얼마인가요?"}]
    },
    "metadata": {
      "kpap": {
        "contractVersion": "1.0",
        "graphVersion": "v2",
        "overrides": [{
          "nodeId": "answer",
          "config": {
            "prompt": "반품 정책의 근거를 함께 설명하세요.",
            "model": "reasoning",
            "tools": [],
            "knowledge": {"resourceId": "returns-policy", "version": "v1", "topK": 8}
          }
        }]
      }
    }
  }
}
```

| 필드 | 규칙 |
|---|---|
| id | RPC 요청·응답 연결 ID. 실행 멱등키가 아님 |
| message.messageId | 메시지 식별자. run_id·nodeId와 별개 |
| message.parts | A2A 업무 입력. 초기 Playground는 text 입력 사용 |
| metadata.kpap | 설정 변경용 자체 확장. 생략하면 기본 설정 사용 |
| contractVersion | 확장 사용 시 필수. `1.0` |
| graphVersion | 확장 사용 시 필수. 조회한 그래프 version과 일치 |
| overrides | 확장 사용 시 필수 배열. `[]`는 기본값 실행 |
| overrides[].nodeId | 기존 노드 ID. 한 요청에서 중복 금지 |
| overrides[].config | editable에 선언한 키만 포함. 미지정 키는 기본값 유지 |

prompt·model은 문자열이다. tools는 고유한 도구 ID 배열이며 `[]`는 모두 해제한다. knowledge는 resourceId·version·topK 전체를 전달한다. knowledge의 부분 병합이나 null 초기화는 지원하지 않는다. 자격증명·Provider URL·실행 코드를 설정으로 받지 않는다.

### 호스트 처리 순서

1. 호스트가 인증·에이전트·A2A 버전·확장 활성화를 확인한다.
2. SDK가 서버의 GraphSpec으로 그래프 버전·nodeId·editable·값을 검증한다.
3. 서버가 기본값을 포함한 자원의 권한·호환성·실제 버전을 확정한다.
4. SDK가 노드별 확정 설정을 요청별 RunContext에 고정한다.
5. SDK가 snapshot과 실제 적용값을 기록한다.
6. SDK가 해당 문맥으로 에이전트를 실행한다.
7. 호스트가 업무 결과와 실행 식별자를 응답한다.

검증 실패 시 노드를 실행하지 않는다. 공유 compiled graph의 설정을 변경하지 않는다. 추가 입력은 기존 task의 설정을 유지한다. 관측 송신 실패는 성공한 업무 응답을 실패로 바꾸지 않는다.

플랫폼이 run을 선할당한 경로는 기존 runtime_binding을 검증하여 같은 run에 참여한다. 그 내부 binding의 전송 방식은 별도 계약이다. 본문의 runId·snapshotId를 호출자가 임의로 지정하도록 확장하지 않는다. 선할당 경로를 출시하려면 binding 전달·중복 run 방지를 별도로 확정해야 한다.

### 즉시 완료 응답

```json
{
  "jsonrpc": "2.0", "id": "rpc-1",
  "result": {
    "message": {
      "messageId": "msg-result-1", "role": "ROLE_AGENT",
      "parts": [{"text": "반품 배송비는 반품 사유에 따라 달라집니다."}],
      "metadata": {
        "kpap": {
          "contractVersion": "1.0", "graphVersion": "v2",
          "runId": "run-1", "snapshotId": "snapshot-1", "applied": true
        }
      }
    }
  }
}
```

A2A 1.0의 SendMessage 결과는 `result.message` 또는 `result.task` 중 하나다. 응답의 metadata.kpap은 자체 계약이다. `applied:true`는 설정 적용 확인을 뜻한다. 업무 성공 여부는 응답 형태·task 상태로 판단한다. 전체 적용 설정은 권한 있는 플랫폼 실행 상세에서 조회한다.

### Task 응답과 후속 호출

```json
{
  "jsonrpc": "2.0", "id": "rpc-1",
  "result": {
    "task": {
      "id": "task-1", "contextId": "context-1",
      "status": {"state": "TASK_STATE_WORKING"},
      "metadata": {
        "kpap": {
          "contractVersion": "1.0", "graphVersion": "v2",
          "runId": "run-1", "snapshotId": "snapshot-1", "applied": true
        }
      }
    }
  }
}
```

Task를 반환하는 호스트는 상태 조회를 제공한다. 후속 메서드도 같은 JSONRPC URL로 호출한다. params와 응답은 A2A 1.0 표준 타입을 사용한다.

| 메서드 | 제공 조건 | 플랫폼 처리 |
|---|---|---|
| SendMessage | 필수 | 즉시 응답 또는 task 수신 |
| GetTask | task 반환 시 필수 | task 상태·결과 조회 |
| CancelTask | 취소 제공 범위에 포함한 경우 | 접수와 실제 취소 완료 구분 |
| SendStreamingMessage | Card에 streaming=true를 선언한 경우 | 표준 SSE 응답 처리 |
| SubscribeToTask | task 구독을 지원하는 경우 | 기존 task 재구독. 새 실행 생성 금지 |

`TASK_STATE_INPUT_REQUIRED`의 추가 입력은 message.taskId·contextId로 기존 task를 지정한다. 새 messageId를 사용하고 metadata.kpap 변경값은 생략한다. 초기 확장 활성화 헤더는 유지한다. 호스트는 저장한 스냅샷을 재사용한다. 설정 변경 요청은 거부한다.

스트림 종료를 성공으로 판단하지 않는다. 단절 후에는 GetTask 또는 지원되는 구독으로 상태를 확인한다. taskId를 받기 전에 응답이 유실되면 결과 불명으로 표시한다. RPC id·messageId만 믿고 자동 재실행하지 않는다. 재전송 멱등성의 보존 기간·조회 계약은 운영 호스트에서 별도로 확정한다.

### 오류 응답

유효한 JSON-RPC 요청의 KPAP 설정 검증 오류는 다음 형식을 사용한다. HTTP 인증 실패는 401/403으로 처리한다. A2A 표준 오류는 표준 코드 매핑을 유지한다.

```json
{
  "jsonrpc": "2.0", "id": "rpc-1",
  "error": {
    "code": -32602,
    "message": "KPAP 설정 검증 실패",
    "data": {
      "code": "GRAPH_VERSION_MISMATCH",
      "requestId": "req-1",
      "fieldErrors": [{
        "path": "params.metadata.kpap.graphVersion",
        "message": "현재 그래프 버전을 다시 조회하세요."
      }]
    }
  }
}
```

| 오류 구분 | 처리 |
|---|---|
| GRAPH_VERSION_MISMATCH | 재조회 후 사용자 검토. 자동 재실행 금지 |
| INVALID_NODE·UNKNOWN_FIELD·INVALID_VALUE | 해당 노드·필드 오류 표시 |
| RESOURCE_FORBIDDEN | 자원 권한 확인. 기본값으로 조용히 대체하지 않음 |
| 확장·프로토콜 미지원 | A2A 표준 오류와 자체 상세 코드 구분 |
| 적용 중 내부 장애 | 요청값 오류와 구분. 실행 전 내부 오류로 반환하고 업무 시작 금지 |
| 업무 시작 후 실패 | task 실패 상태와 run 기록에 연결 |

## 5. SDK와 Playground 완료 기준

| 검증 | 합격 조건 |
|---|---|
| 발견 | Card에서 실행 URL과 graphUrl을 확인 |
| 그래프 | 조회한 nodes·edges로 화면 표시. 고정 노드명을 전제하지 않음 |
| 편집 | configSchema와 editable에 따라 네 설정을 편집 |
| 실행 | 편집값이 A2A overrides와 실제 노드 실행에 동일하게 반영 |
| 버전 | 조회 후 배포 변경 시 실행 전에 충돌 반환 |
| 격리 | 동시 요청의 설정·스냅샷·관측이 섞이지 않음 |
| 상태 | 업무 상태·관측 수집·설정 적용 확인을 구분 |
| 반복·추가 입력 | node_id와 invocation_id를 구분하고 task의 스냅샷 유지 |
| 오류 | 권한·입력·조회 장애·결과 불명을 서로 구분 |

현재 [프로토타입](prototype-node-workspace/README.md)은 그래프 표시·설정 검증·A2A 요청 생성·모의 적용만 구현했다. Card 인증·실제 HTTP/SSE·LangGraph 실행·task 저장·runtime_binding은 호스트 구현과 통합 검증이 필요하다.

## 6. 참조

- [A2A 1.0 공식 규격](https://a2a-protocol.org/v1.0.0/specification/): 발견·JSON-RPC·SendMessage 응답·task·스트리밍.
- [그래프·A2A 공통 규약](../agentic%20platform/kpap-graph-minimal-contract.md): KPAP 자체 설정·스키마·검증 원본.
- [SDK 요구사항](01-sdk-spec.md): 서비스 내부 SDK 인터페이스.
- [전체 그래프 예제](prototype-node-workspace/dist/fixtures/support-agent.graph.json): 분기 및 네 설정.
