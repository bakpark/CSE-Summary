# KPAP 그래프 조회·동적 실행 최소 규약

검토용 최소 규약 초안. LangGraph를 감싼 SDK의 NodeSpec·GraphSpec을 사용한다. 에이전트 하나는 그래프 하나를 제공한다.

목적은 그래프 조회 → 시각화 → 노드 선택 → 프롬프트·모델 수정 → 전체 실행이다. graphId·slotId·해시·BindingSet은 도입하지 않는다. 노드 단독 실행과 변경본 저장은 이후에 정의한다.

## ID와 버전

| 항목 | 예시 | 규칙 |
|---|---|---|
| 에이전트 ID | `support-agent` | 에이전트를 구분한다. API 경로에 사용한다. |
| 노드 ID | `input`, `answer`, `output` | 그래프 전체에서 유일하다. 경로 표기는 사용하지 않는다. |
| 그래프 버전 | `v1` | 그래프 정의나 기본 설정이 바뀌면 변경한다. |

같은 논리 노드의 ID는 유지한다. group 안의 노드도 그래프 전체에서 ID가 중복되지 않아야 한다.

## 그래프 조회

```http
GET /agents/support-agent/graph
```

응답 예제는 다음과 같다. 이 예제는 input → answer → output으로 실행한다.

```json
{
  "version": "v1",
  "nodes": [
    {
      "id": "input",
      "type": "input"
    },
    {
      "id": "answer",
      "type": "llm",
      "config": {
        "prompt": "질문에 간결하게 답변하세요.",
        "model": "chat-default"
      },
      "editable": ["prompt", "model"]
    },
    {
      "id": "output",
      "type": "output"
    }
  ],
  "edges": [
    {
      "source": "input",
      "target": "answer"
    },
    {
      "source": "answer",
      "target": "output"
    }
  ]
}
```

| 필드 | 의미 |
|---|---|
| `version` | 실행 대상 그래프 버전 |
| `nodes[].id` | 노드 식별자 |
| `nodes[].type` | `llm`, `tool`, `react`, `output`, `input`, `group` 중 하나 |
| `nodes[].config` | 노드의 기본 설정. 없으면 빈 객체로 취급한다. |
| `nodes[].editable` | 호출 시 변경할 수 있는 config 키 목록. 없으면 변경할 수 없다. |
| `edges[].source`, `target` | 연결된 노드 ID |

prompt는 문자열이다. model은 KPAP LLM Gateway에 등록한 모델 이름이다. API 키나 임의 Provider URL을 받지 않는다.

SDK는 compile 시 노드 ID·종류·연결·공개 설정·수정 가능 키를 보존해 이 응답을 생성한다. 컴파일된 함수나 클로저에서 프롬프트·모델을 역추정하지 않는다.

## A2A 호출

Agent Card에 선언된 A2A endpoint로 요청한다. 아래는 A2A 1.0 JSON-RPC 요청에 자체 규약인 `params.metadata.kpap`을 추가한 예제다. 이 필드는 A2A 표준 필드가 아니다. KPAP 호출자는 해당 규약을 지원하는 서버를 사용해야 한다.

이번 호출에서는 answer 노드의 프롬프트와 모델만 변경한다.

```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "msg-1",
      "role": "ROLE_USER",
      "parts": [
        {
          "text": "제품 초기화 방법을 알려줘"
        }
      ]
    },
    "metadata": {
      "kpap": {
        "graphVersion": "v1",
        "overrides": [
          {
            "nodeId": "answer",
            "config": {
              "prompt": "절차를 번호 목록으로 답변하세요.",
              "model": "chat-reasoning"
            }
          }
        ]
      }
    }
  }
}
```

`id`는 RPC 응답을 연결하고, `messageId`는 A2A 메시지를 식별한다. 둘 다 노드 ID와 무관하다.

## 실행 규칙

1. KPAP metadata가 있으면 graphVersion을 필수로 받는다. 현재 버전과 다르면 실행 전에 거부한다.
2. 존재하는 노드의 editable에 선언한 설정만 변경한다. 중복 nodeId, 알 수 없는 키, 잘못된 값은 거부한다.
3. config는 키 단위로 교체한다. 지정하지 않은 키는 기본값을 사용한다. 중첩 객체의 deep merge는 하지 않는다.
4. 변경은 이번 실행에만 적용한다. 공유 compiled graph의 기본 설정을 직접 변경하지 않는다.

서버는 전체 요청을 검증한 후 노드를 실행한다. prompt는 문자열인지, model은 사용 가능한 Gateway 모델 이름인지 확인한다. SDK는 확정 설정을 실행별 컨텍스트로 전달하거나 필요한 실행 변형을 컴파일한다. 변경을 실제 적용할 수 없는 설정은 editable에 선언하지 않는다.

KPAP metadata를 생략하면 기본 설정으로 실행한다. KPAP metadata가 있지만 처리할 수 없으면 무시하지 않고 실행 전에 거부한다.

참고: [A2A 1.0 공식 규격](https://a2a-protocol.org/v1.0.0/specification/). 본 문서의 그래프 조회 API와 metadata.kpap의 의미는 KPAP 자체 제안이다.
