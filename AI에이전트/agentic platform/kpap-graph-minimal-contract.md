# KPAP 그래프 조회·A2A 동적 설정 규약

검토용 계약 v1.0 / 2026-10-17. A2A 1.0 JSON-RPC를 기준으로 한다. 운영 SDK 구현 완료를 뜻하지 않는다.

LangGraph를 감싼 SDK는 NodeSpec·GraphSpec을 보존한다. 에이전트 하나는 그래프 하나를 제공한다. Playground는 조회한 그래프를 표시하고 허용된 노드 설정을 변경한다.

## 범위와 책임

| 주체 | 책임 |
|---|---|
| SDK 호스트 서비스 | Agent Card·그래프 조회·A2A endpoint 제공 |
| SDK | 그래프 메타데이터 보존, 요청 검증, 실행별 설정 적용, 실제 적용값 보고 |
| kpap 서버 | 등록 주소 검증, 프로젝트·환경 권한, 자원 해석, 호출, 스냅샷·실행 관리 |
| Playground | 그래프 표시, 공개 설정 편집, 요청·결과·관측 연결 |

노드 연결 편집·노드 단독 실행·변경본 저장은 이 규약의 범위 밖이다. 그래프 표시는 실행 순서나 분기 조건을 재구현하지 않는다.

## 엔드포인트

| 제공자 | endpoint | 응답·처리 |
|---|---|---|
| SDK 호스트 | `GET /.well-known/agent-card.json` | A2A Agent Card·확장 선언 |
| SDK 호스트 | `GET /agents/{agentId}/graph` | 아래 GraphSpec. A2A 표준 API가 아닌 KPAP 조회 API |
| SDK 호스트 | Agent Card의 JSONRPC URL | `SendMessage`. 선언한 경우 `SendStreamingMessage` 지원 |
| kpap 서버 | `GET /api/v1/agents/{id}/graph` | 등록 endpoint를 권한 검사 후 조회. GraphSpec을 전달 |

Playground는 kpap 서버를 통해 조회·호출한다. 브라우저에 서비스 비밀키를 제공하지 않는다. 서버는 등록된 origin과 허용 경로만 사용한다. 임의 URL·redirect를 따라 내부망에 접근하지 않는다.

그래프 API는 인증·프로젝트·환경 권한을 검사한다. 응답은 JSON이며 비밀값·비공개 프롬프트를 포함하지 않는다. 공개할 수 없는 설정은 config·configSchema·editable에서 함께 제외한다. 응답에 ETag를 제공하고 If-None-Match를 지원한다. 캐시는 호출 주체·프로젝트·환경·그래프 버전별로 격리한다.

HTTP 오류는 400(요청 오류), 401(인증), 403(권한), 404(에이전트 없음), 503(조회 불가)로 구분한다. 오류 본문은 `{ "code": "...", "message": "...", "requestId": "..." }`다. 조회 실패를 빈 그래프로 표시하지 않는다.

## Agent Card 확장 선언

`capabilities.extensions`에 다음 항목을 추가한다. 아래는 전체 Agent Card가 아닌 발췌다. [전체 데모 Card](../kpap/prototype-node-workspace/dist/fixtures/agent-card.json)를 참고한다.

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

URI와 params의 의미는 KPAP 자체 계약이다. URI는 식별자이며 다운로드 주소가 아니다. 운영 적용 전 조직의 확장 식별자로 확정한다. 비호환 변경은 새 URI를 사용한다.

기본 실행은 확장 없이 허용한다. 설정 변경 호출은 Card의 지원 선언을 확인하고 `A2A-Extensions: urn:kpap:graph-config:1`과 `A2A-Version: 1.0`을 전송한다. 지원되지 않는 확장을 자동 제거하여 실행하지 않는다. 본문에 kpap 설정이 있는데 활성화 헤더가 없으면 거부한다.

## GraphSpec

```json
{
  "schemaVersion": "1.0",
  "agentId": "support-agent",
  "version": "v2",
  "nodes": [
    {"id": "input", "type": "input"},
    {
      "id": "answer", "name": "답변 생성", "type": "llm",
      "config": {"prompt": "간결하게 답변하세요.", "model": "balanced"},
      "editable": ["prompt", "model"],
      "configSchema": {
        "type": "object", "additionalProperties": false,
        "required": ["prompt", "model"],
        "properties": {
          "prompt": {"type": "string", "minLength": 1, "maxLength": 8000},
          "model": {"type": "string", "enum": ["balanced", "fast", "reasoning"]}
        }
      }
    },
    {"id": "output", "type": "output"}
  ],
  "edges": [{"source": "input", "target": "answer"}, {"source": "answer", "target": "output"}]
}
```

| 필드 | 규칙 |
|---|---|
| schemaVersion | 전송 규격 버전. 현재 `1.0` |
| agentId·version | 에이전트 ID와 불변 그래프 버전. 구조·기본값·수정 가능 범위·관련 코드가 바뀌면 새 버전 |
| nodes[].id | 전체 그래프에서 고유. 같은 논리 노드는 유지. 삭제 ID 재사용 금지 |
| nodes[].type | `input`, `output`, `llm`, `tool`, `rag`, `react`, `group`, `custom` |
| nodes[].parentId | 선택적 group 참조. 그룹 순환은 금지. 중첩 구조의 표시용 |
| nodes[].config | 공개 기본값. 생략 시 빈 객체 |
| nodes[].configSchema | 설정 타입·범위. 설정이 있으면 필수 |
| nodes[].editable | 호출 시 변경 가능한 최상위 설정 키. 생략 시 읽기 전용 |
| edges[].source·target | 존재하는 노드 ID |
| edges[].kind | `normal`(기본), `conditional`, `loop`, `parallel` |
| edges[].label | 분기·반복 등의 설명. 실행 코드나 조건식으로 해석하지 않음 |

표시용 그래프는 DAG로 제한하지 않는다. 조건 분기의 가능한 연결을 선언하고 실제 선택은 런타임에 맡긴다. 동적 대상을 확정할 수 없으면 `custom` 노드로 표시한다. 존재하지 않는 연결을 추정하지 않는다. group과 자식 모두 전역 고유 ID를 사용한다.

이번 프로토타입은 최대 100개 노드·300개 연결·256 KiB 가져오기를 지원한다. 그룹은 소속 라벨로 표시한다. 접기·펼치기와 대형 그래프 레이아웃은 후속 범위다.

## 네 종류의 설정

| 키 | 타입 | 의미 |
|---|---|---|
| prompt | 문자열 | 이번 실행에 적용할 본문. 1–8,000자. 실행 전 변수 검증 |
| model | 문자열 ID | 승인된 Gateway 모델. Provider URL·API 키 금지 |
| tools | 고유한 문자열 ID 배열 | 허용 도구 집합. `[]`는 모두 해제. 임의 URL·코드 금지 |
| knowledge | 객체 | `{resourceId, version, topK}`. 단일 지식 자원과 고정 버전·검색 수 |

모델·도구 ID의 실제 revision과 권한은 실행 시작에 서버가 해석하여 스냅샷에 기록한다. knowledge.version은 명시적 고정 버전이다. 여러 지식 자원이 필요하면 노드를 분리한다. 프롬프트 참조·phase·도구 옵션·검색 필터는 후속 계약이며 임의 키로 받지 않는다.

configSchema는 JSON Schema의 제한된 부분집합이다. 지원 키는 `type`, `properties`, `required`, `additionalProperties:false`, `items`, `enum`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `uniqueItems`, `title`, `description`이다. `$ref`, 조합 스키마와 미지원 키는 거부한다. UI와 서버는 같은 지원 범위를 사용한다.

스키마의 enum은 편집 후보를 제한한다. 실제 접근 권한을 대신하지 않는다. 기본값을 포함한 모든 실제 자원은 실행 시 재검사한다. 사용자가 전달한 그래프·스키마로 서버 권한이나 허용 범위를 바꾸지 않는다. 서버는 자신이 보관한 그래프 버전을 검증 기준으로 사용한다.

## A2A 요청

```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "msg-1", "role": "ROLE_USER",
      "parts": [{"text": "반품 배송비는 얼마인가요?"}]
    },
    "metadata": {
      "kpap": {
        "contractVersion": "1.0", "graphVersion": "v2",
        "overrides": [{
          "nodeId": "answer",
          "config": {
            "prompt": "정책 근거를 함께 설명하세요.",
            "model": "reasoning",
            "tools": ["ticket-search"],
            "knowledge": {"resourceId": "returns-policy", "version": "v1", "topK": 8}
          }
        }]
      }
    }
  }
}
```

이 예제는 네 설정을 모두 공개한 [전체 예제 그래프](../kpap/prototype-node-workspace/dist/fixtures/support-agent.graph.json)에 대한 요청이다.

metadata는 A2A의 확장 지점이다. `kpap` 키와 내부 의미는 자체 계약이다. RPC id·messageId·nodeId·run_id·taskId는 서로 대체하지 않는다.

## 검증·적용 순서

1. 호출 주체·프로젝트·환경·확장 지원과 활성화를 검사한다.
2. contractVersion·graphVersion을 서버의 정의와 대조한다. 불일치는 실행 전에 거부한다.
3. 존재하는 nodeId, 중복 없는 overrides, editable, 값의 타입·범위를 검사한다.
4. 기본값 위에 변경한 최상위 키를 교체한다. 객체·배열 전체를 교체한다. deep merge하지 않는다.
5. 기본값을 포함한 실제 자원의 권한·호환성·버전을 검증한다.
6. 실제 적용 설정을 불변 스냅샷으로 만들고 SDK 실행별 문맥에 바인딩한다.
7. SDK가 적용 확인을 보고한 뒤 업무를 실행한다.

공통값·프로필 해석은 kpap이 먼저 완료한다. 이 wire 규약의 config 객체 교체는 공통 프로필의 필드 병합과 다른 단계다. SDK는 수신한 overrides를 한 번만 적용한다. 플랫폼 run에 참여할 때 기존 runtime_binding을 재사용하고 중복 run을 만들지 않는다.

공유 compiled graph·모델 객체·전역 설정을 직접 변경하지 않는다. 변경본은 이번 실행에만 유효하다. 추가 입력은 같은 task·run·snapshot을 유지하며 설정 변경을 거부한다. 다른 설정은 새 실행으로 요청한다.

## 적용 확인·오류·관측

SDK는 kpap에 run_id·snapshot_id·graphVersion·코드 버전·노드별 실제 적용값을 보고한다. A2A 응답의 Task 또는 Message metadata.kpap에는 `{contractVersion, graphVersion, runId, snapshotId, applied:true}`를 연결하는 안을 사용한다. 적용 확인 전에는 applied를 true로 보내지 않는다. 이 metadata도 자체 계약이다. 전체 원문은 권한 있는 실행 상세 API에서 조회한다.

관측은 `run_id → node_id → invocation_id → observation_id`로 연결한다. 반복 수행은 같은 node_id와 서로 다른 invocation_id를 사용한다. 그래프 구조와 실제 수행 경로를 분리한다. 수집 지연·미계측·분기 생략을 구분한다.

| 오류 | 처리 |
|---|---|
| GRAPH_VERSION_MISMATCH | 그래프 재조회. 초안 자동 적용·자동 실행 금지 |
| INVALID_NODE·UNKNOWN_FIELD·INVALID_VALUE | fieldErrors에 노드·필드·원인 표시 |
| UNSUPPORTED_SCHEMA·UNSUPPORTED_EXTENSION | 지원 버전 확인. 설정 무시 금지 |
| EXTENSION_REQUIRED | 확장 헤더 확인 |
| RESOURCE_FORBIDDEN | 권한 있는 자원으로 변경 |
| CONFIG_APPLY_FAILED | 업무 시작 금지. 실패 상태 기록 |

유효한 JSON-RPC 요청의 KPAP 설정 검증 오류는 `error.code=-32602`와 `error.data={code,fieldErrors,requestId}`로 전달하는 안이다. A2A 표준 버전·확장 협상 오류는 표준 매핑을 따른다. 인증 오류는 HTTP 계층에서 처리한다. 업무 시작 후 실패는 task 상태로 처리한다. 실제 호스트 어댑터에서 이 매핑을 검증해야 한다.

## LangGraph SDK 어댑터

- SDK 노드 등록 시 NodeSpec과 실행 callable을 함께 보관한다.
- compile 시 연결·분기·그룹과 공개 설정을 GraphSpec으로 보존한다.
- 기존 LangGraph 구조 introspection은 노드·연결 확인에만 사용한다. 클로저에서 모델·프롬프트·도구·지식을 추정하지 않는다.
- SDK를 거치지 않은 노드는 등록 어댑터로 명세를 보완하거나 읽기 전용 custom 노드로 표시한다.
- node_id와 실제 런타임 노드의 매핑을 검증한다. 노드 함수는 실행별 문맥의 확정 설정을 읽는다.
- 그래프 구조가 설정에 의존하면 요청별 실행 변형을 만들거나 해당 설정을 editable에서 제외한다.
- Python·LangGraph 지원 버전과 실제 HTTP 서버 어댑터는 구현 전에 확정한다.

## 프로토타입과 완료 기준

[노드 작업공간](../kpap/prototype-node-workspace/README.md)은 동일한 contract.js를 기존 실행과 SDK 연동 화면에서 사용한다. 예제 JSON 조회·가져오기, 데이터 기반 그래프 표시, 스키마 기반 편집, A2A 요청 생성, 모의 적용값 확인, 오류 시나리오를 제공한다.

이 코드는 브라우저 계약 데모다. LangGraph 실행기·A2A HTTP 서버·인증 서버·실제 자원 호출은 구현하지 않았다. JSON 가져오기는 조회 응답을 검토하는 기능이며 원격 서비스 등록을 뜻하지 않는다.

완료 검증은 네 설정의 전달·적용, 버전 충돌, 읽기 전용 필드, 중복 노드, 잘못된 연결, 권한 거부, 확장 활성화, 요청 간 격리를 포함한다. 실제 SDK 완료는 배포 호스트와 Playground 간 왕복 검증으로 별도 판정한다.

근거: [A2A 1.0 규격](https://a2a-protocol.org/v1.0.0/specification/), [공통 규격](../kpap/00-common-contracts.md), [SDK 명세](../kpap/01-sdk-spec.md).
