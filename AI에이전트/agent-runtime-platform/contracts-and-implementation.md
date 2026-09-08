# 부록 A. 핵심 계약 스키마

> **범위:** 기존 v1.0 본문의 구현 부록. Shell·코드 실행 도구·파일 작업공간은 제외하며, 기존 RAG를 재사용한다.
>
> **권고:** LangGraph 기반 공통 실행 루프와 승인된 커스텀 Graph를 동일한 계약으로 수용한다. Agent Server는 조건부 서빙 후보, Deep Agents는 선택형 확장으로 둔다.
>
> **상태:** 설계 제안 · 공식 문서 확인 2026-09-09. 아래 타입은 자체 플랫폼 계약이며 제품의 원시 API가 아니다. 제품 간 통합·성능·장애 복구 시험은 아직 수행하지 않았다.

## A.1. 계약의 정본과 공통 규칙

검토용 타입은 TypeScript로 표기한다. 실제 서버 계약은 **Pydantic v2 → JSON Schema/OpenAPI → 클라이언트 타입** 순서로 생성하여 이중 관리를 피한다. Pydantic은 JSON Schema 생성과 엄격한 타입 검증을 지원한다. [A1][a1] [A2][a2]

| 규칙 | 적용 방식 |
|---|---|
| 버전 | `schema_version`을 사용하고 파괴적 변경은 새 계약 버전으로 제공한다. 알 수 없는 명령·결정은 실행하지 않는다. |
| 식별자 | 서버가 발급한다. `run_id`는 업무 실행, `attempt_id`는 실행 시도, `action_id`는 논리적 업무 작업이다. 재시도 시 Action ID는 유지한다. |
| 인증 | 고객·테넌트·권한은 인증된 세션과 서비스 위임에서 도출한다. 본문 필드는 권한 증명이 아니다. |
| 검증 | 명령과 도구 인자는 허용 필드·크기·타입을 검증한다. 정책·필드 간 관계는 별도 서버 검증을 적용한다. |
| 시간·수치 | 시간은 UTC RFC 3339, revision·호출 제한은 유효 범위의 정수다. 금액을 다룰 때는 통화와 정수 최소단위 또는 정규화 십진 문자열을 사용한다. |
| 민감정보 | 체크포인트·로그·이벤트를 구분해 보관한다. 고객 화면에는 최소 정보만 투영하고 자격증명은 넣지 않는다. |

```typescript
// 아래 선언을 이어 붙이면 검토용 wire 타입을 구성한다.
type Id = string;
type Ref = string;       // Registry 식별자. 임의 URL·파일 경로가 아니다.
type UtcTime = string;   // 서버에서 UTC RFC 3339 형식을 검사한다.
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
interface Contract { schema_version: "1"; }
```

**주의:** TypeScript 타입 확인은 입력 검증·권한 검증을 대신하지 않는다. 아래 스키마는 필수 구조를 정의하며, 문자열 길이·배열 한도·자원 소유권 등은 서버에서 추가 검증한다.

## A.2. AgentSpec · Release — 무엇을 배포하는가

```typescript
interface AgentSpec extends Contract {
  agent_id: Id;
  spec_version: string;
  mode: "CONFIGURED" | "CUSTOM_GRAPH";
  graph_package_ref: Ref;
  task_profile_ref: Ref;     // 목표·담당/제외 범위·완료/인계 기준
  model_profile_ref: Ref;
  prompt_ref: Ref;
  skill_refs: Ref[];         // 버전 고정된 지침. 파일 접근 권한이 아님
  tool_refs: Ref[];
  resource_scope_ref: Ref;
  limits: {
    max_model_calls: number;
    max_tool_calls: number;
    active_timeout_ms: number;
    max_wait_ms: number;
  };
}

interface Release extends Contract {
  release_id: Id;
  agent_spec_ref: Ref;
  graph_package_ref: Ref;
  tool_contract_refs: Ref[];
  response_schema_ref: Ref;
  eval_suite_ref: Ref;
}
```

`GraphPackage`에는 `graph_id`, 코드·컨테이너 digest, 의존성 lockfile, 상태 스키마 버전을 담는다. Release의 참조는 **불변 버전**이어야 하며 `latest`처럼 변경 가능한 별칭을 저장하지 않는다.

`Deployment`는 검증된 Release를 가리키는 운영 포인터다. 신규 요청은 현재 배포를 따르고, 진행 중인 Run은 기존 Release에 고정한다. 단, 권한 철회·긴급 차단은 최신 정책으로 재검증한다. 모델 서비스 자체가 변경될 수 있으므로 버전 고정이 동일 답변의 재현을 보장하지는 않는다.

## A.3. Run · Command — 무엇을 실행하고 제어하는가

```typescript
type RunStatus =
  | "QUEUED" | "RUNNING" | "WAITING" | "PAUSED"
  | "CANCELLING" | "CANCELLED" | "BLOCKED" | "COMPLETED" | "FAILED";

type OutcomeCode =
  | "ANSWERED" | "SUBMITTED" | "RESOLVED"
  | "HANDED_OFF" | "UNKNOWN" | "FAILED";

interface TaskOutcome {
  code: OutcomeCode;
  evidence_refs: Ref[];
  reason_code: string;
}

interface StartRunCommand extends Contract {
  command_id: Id;
  session_id: Id;
  expected_revision: number; // Session revision
  input: { text: string };
}

interface RunControlCommand extends Contract {
  command_id: Id;
  run_id: Id;
  expected_revision: number; // Run revision
  operation: "pause" | "resume" | "cancel" | "block";
}

interface RunSnapshot extends Contract {
  run_id: Id;
  session_id: Id;
  release_id: Id;
  revision: number;
  status: RunStatus;
  wait_reason_codes: string[];
  pending_interaction_ids: Id[];
  task_outcome: TaskOutcome | null;
}
```

Session의 고객·테넌트·Release·내부 Thread 매핑은 서버가 소유한다. 고객에게 Graph 경로, 내부 체크포인트 ID, 임의 Resume Payload를 받지 않는다.

**명령 중복은 멱등성 검사 후 기존 결과를 반환하고, 새로운 명령의 revision 충돌은 `409`로 거절한다.** `202`는 명령 수락이지 실행 완료가 아니다. `block`은 운영 권한 전용이다.

MVP는 Session당 미종료 Run 하나를 허용한다. 승인 대기·일시정지도 포함하며, 재개·재시도는 새로운 업무 Run이 아니라 기존 Run의 새 Attempt로 기록한다. 호출·시간 예산은 Run 단위로 누적하고 새 Attempt가 생성됐다고 초기화하지 않는다.

## A.4. ToolDefinition · Action — 무엇을 어떤 권한으로 수행하는가

### 등록 도구의 최소 메타데이터

| 필드 | 형식 / 의미 |
|---|---|
| `tool_ref` | 이름 + 불변 계약 버전 |
| `input_schema_ref`, `output_schema_ref` | 실행 전후 검증할 스키마 |
| `capability`, `resource_types` | 필요한 업무 능력과 자원 종류 |
| `mutates`, `risk_class` | 변경 작업 여부와 위험 분류 |
| `credential_profile_ref` | Gateway가 사용할 자격증명 정책 참조 |
| `idempotency_support` | `PROVIDER_KEY / NONE`. Gateway 기록만으로 외부 API의 멱등성을 보장하지 않음 |
| `result_lookup_tool_ref` | 처리 결과 확인 API. 없으면 `null` |
| `timeout_ms`, `max_result_bytes` | 실행·출력 제한 |

LLM에는 이름·설명·입력 스키마만 제공한다. 실제 자격증명과 정책 집행 정보는 Gateway 내부에 둔다.

### 실행 요청 · 정책 결정 · 처리 결과

```typescript
interface ActionBinding {
  action_id: Id;
  run_id: Id;
  tenant_id: Id;
  environment: string;
  actor_ref: Ref;
  release_id: Id;
  tool_ref: Ref;
  resource_refs: Ref[];
  arguments: { [k: string]: Json };
  preconditions: { [k: string]: Json }; // 자원 버전 등 업무 전제조건
}

interface ActionRequest extends Contract {
  binding: ActionBinding;
  binding_hash: string;
  idempotency_key: string;
  control_epoch: number;
  interaction_refs: Id[];
}

type ActionDecision = Contract & {
  decision_id: Id;
  policy_version: string;
  reason_code: string;
} & (
  | { decision: "ALLOW" }
  | { decision: "DENY" }
  | { decision: "REQUIRE_APPROVAL"; approval_requirement_refs: Ref[] }
);

interface ActionResult extends Contract {
  action_id: Id;
  status: "ACCEPTED" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  operation_id: string | null;
  evidence_refs: Ref[];
  output: Json;
  error_code: string | null;
}
```

**ActionBinding은 사람이 승인한 실제 작업 내용이다.** 입력 스키마 검증, 기본값 적용, 대상 자원 식별을 마친 정규화 값에 대해 해시를 계산한다. 해시 알고리즘·직렬화 규칙도 버전 관리한다. 해시는 변경 감지용이지 권한 증명이 아니다.

Gateway는 인증된 서비스 위임·Run 원장과 요청의 actor·tenant를 대조하고, 저장된 ActionBinding과 해시를 검증한다. `ALLOW`는 당시의 정책 판단이며 영구 실행권이 아니다. 실행 직전에 현재 권한·제어 세대·승인 상태를 다시 확인한다.

같은 Action ID·같은 내용은 재시도로 취급하고, **같은 ID·다른 내용은 충돌**이다. 같은 인자로 사용자가 새 작업을 요청한 경우는 새로운 Action이다. 따라서 인자 해시만으로 Action ID를 만들지 않는다.

`ACCEPTED`는 업무 시스템의 접수, `SUCCEEDED`는 해당 도구 계약이 정의한 완료다. 상담 티켓 생성 도구가 성공해도 고객 문제의 `RESOLVED`와 같지 않다. `FAILED`라고 해서 변경이 전혀 없었다고 가정하지 않으며, 재시도 안전성은 결과 조회와 도구별 정책으로 판정한다.

## A.5. HumanInteraction — 누가 무엇을 결정해야 하는가

```typescript
type HumanKind =
  | "USER_INPUT" | "CUSTOMER_CONFIRMATION"
  | "STAFF_APPROVAL" | "HANDOFF";

interface HumanInteraction extends Contract {
  interaction_id: Id;
  run_id: Id;
  kind: HumanKind;
  audience_ref: Ref;             // 응답 가능한 고객·직원 역할·상담 큐
  action_id: Id | null;
  binding_hash: string | null;
  public_summary: string;
  allowed_decisions: ("APPROVE" | "REJECT")[];
  response_schema_ref: Ref | null;
  revision: number;
  expires_at: UtcTime;
  status: "PENDING" | "RESOLVED" | "EXPIRED" | "SUPERSEDED";
}

type InteractionResponse = Contract & {
  command_id: Id;
  interaction_id: Id;
  expected_revision: number;
} & (
  | { kind: "DECISION"; decision: "APPROVE" | "REJECT"; reason?: string }
  | { kind: "INPUT"; data: { [k: string]: Json } }
  | { kind: "HANDOFF_ACK"; case_ref: Ref }
);
```

고객 확인·직원 승인에는 `action_id`와 `binding_hash`가 필수다. 정보 요청·일반 인계에는 없을 수 있다. `kind`별 응답 스키마와 허용 응답자를 검사하며, 결정자 신원과 결정 시각은 서버가 별도 원장에 기록한다.

승인 응답에는 실행할 도구나 새로운 인자를 넣지 않는다. 수정이 필요하면 기존 요청을 `SUPERSEDED`로 전환하고 **새 Action·새 확인 요청**을 만든다. MVP에서는 승인 화면의 인자 직접 편집을 제공하지 않는다.

고객 확인과 직원 승인이 모두 필요한 작업은 Interaction을 각각 생성한다. 하나가 승인됐다고 다른 대기 조건이 해제되지는 않는다. 상담 인계의 ACK는 상담 시스템의 접수 확인이며 문제 해결 판정이 아니다.

## A.6. RunEvent · CustomerResponse — 무엇을 고객에게 보여주는가

```typescript
interface EventEnvelope<T> extends Contract {
  event_id: Id;
  session_id: Id;
  session_seq: number;
  run_id: Id;
  occurred_at: UtcTime;
  payload: T;
}

type CustomerPayload =
  | { type: "answer"; text: string; evidence_refs: Ref[] }
  | { type: "interaction"; interaction_id: Id; summary: string }
  | { type: "progress"; code: string; message: string }
  | { type: "result"; outcome: TaskOutcome; message: string }
  | { type: "handoff"; case_ref: Ref; message: string }
  | { type: "error"; code: string; message: string };

type CustomerResponse = EventEnvelope<CustomerPayload>;
```

내부 RunEvent에는 Model·Tool·복구·정책 이벤트를 기록하고, 고객 응답은 **별도 허용 목록으로 변환**한다. 원시 Graph State나 도구 출력을 그대로 내보내지 않는다. 고객에게 반환하는 Evidence/Case 참조도 소유권 검증을 거친다.

공개 스트림의 `session_seq`는 공개 이벤트 커밋 순서로 발급하며 내부 로그 순번과 분리한다. 재전달은 `event_id`로 제거하고, 보존 기간이 지난 cursor는 Snapshot으로 복구한다. 일련번호를 트랜잭션 전에 발급한 순서를 커밋 순서라고 가정하지 않는다.

**토큰 delta는 잠정 출력이다.** 승인 안내·업무 완료 문구는 검증된 구조화 결과에서 생성한다. 고객에게 검증된 문장만 제공해야 하는 업무는 해당 최종 출력을 버퍼링하며, 이미 전송한 토큰을 나중 검증으로 회수할 수 있다고 가정하지 않는다.

---

# 부록 B. 에이전트 엔진 구현 방향

## B.1. 기본 선택 — 얇은 LangGraph 공통 루프

**v1은 LangGraph `StateGraph` 위에 플랫폼 공통 노드를 조립하는 방식을 권고한다.** 모델·메시지·도구 스키마는 LangChain 구성요소를 활용하고, 체크포인트·중단·재개를 새로 만들지 않는다.

LangChain의 `create_agent()`도 모델·도구·미들웨어를 구성하는 경로다. 빠른 구성형 Agent에는 사용할 수 있지만, 본 MVP에서는 Action 생성·승인·실행·복구 경계를 검토하기 쉽도록 명시적인 노드 구조를 우선한다. [A3][a3] [A4][a4]

| 구현 방식 | 적용 위치 | 판단 |
|---|---|---|
| `StateGraph` + 공통 노드 | 기본 범용 루프, 커스텀 업무 Graph | **v1 우선** |
| `create_agent()` + 공통 미들웨어 | 동일 계약을 만족하는 간단한 구성형 Agent | 선택 가능. 모든 도구 실행에 동일 게이트를 적용 |
| `create_deep_agent()` | 계획·위임·Context 관리가 더 필요한 업무 | **후속 선택형 확장** |

Deep Agents는 파일시스템·서브에이전트 등의 기능을 결합한 Harness다. 현재 문서는 파일 도구를 숨길 수 있지만 FilesystemMiddleware 자체는 필수 구성이라고 설명한다. 현재 MVP에서 불필요한 기능을 제거해 쓰기보다, 필요한 공통 실행 기능부터 구성하는 편을 권한다. [A5][a5]

## B.2. 공통 Graph의 처리 흐름

```text
check_control → compose_context → model
                                  │
                   ┌──────────────┴─────────────┐
                   │ 최종 응답 후보             │ Tool 요청
                   ▼                            ▼
             validate_outcome             prepare_action
                   │                            │
                   ▼                            ▼
                publish                  gateway_preflight
                   │                     /      │      \
                  END                  DENY   APPROVAL  ALLOW
                                        │       │       │
                                        │   await_human │
                                        │       │       │
                                        │       └──┬────┘
                                        │          ▼
                                        │    check_control
                                        │          ▼
                                        │     gateway_execute
                                        │          ▼
                                        └────→ observe → check_control
```

`gateway_execute`는 사전 판단과 무관하게 최신 권한·승인·제어 상태를 다시 검증한다. 결과가 `ACCEPTED / UNKNOWN`이면 확정 결과 조회 또는 인계 경로로 전환한다. 이를 곧바로 성공으로 요약하거나 무조건 재호출하지 않는다.

| 노드 | 구현 책임 |
|---|---|
| `check_control` | pause/cancel/block, 실행 제한, 현재 제어 세대 검사 |
| `compose_context` | 검증된 AgentSpec, 대화, RAG·Tool 결과로 제한된 Context 구성 |
| `model` | 최종 응답 후보 또는 도구 요청 생성. 권한·업무 완료의 최종 판정은 하지 않음 |
| `prepare_action` | Tool 입력 정규화, 안정적인 Action ID 배정, Binding 고정·영속화 |
| `gateway_preflight` | Gateway에 정책 판단 요청. 등록되지 않은 도구·자원은 거절 |
| `await_human` | 이미 생성된 Interaction에 대해 `interrupt()` 호출. 재개 응답은 결정 원장에서 확인 |
| `gateway_execute` | 실행 직전 재검증 후 Gateway를 통해서만 외부 작업 수행 |
| `observe / validate_outcome` | 결과·근거 정리, 업무 결과 판정, 안전한 고객 응답 생성 |

**MVP는 한 Run의 Action을 순차 실행한다.** 모델이 여러 tool call을 만들면 원래 호출 ID·순서를 보존하고 각 결과를 빠짐없이 대응시킨다. 병렬 도구·서브에이전트는 별도 검증 후 확장한다.

## B.3. 재개·장애 복구의 구현 원칙

LangGraph는 interrupt가 발생한 노드를 재개할 때 해당 노드의 앞부분을 다시 실행할 수 있다. 따라서 승인 전후의 업무 부작용을 별도 노드로 나누고, 외부 호출은 안정적인 Action ID로 보호한다. [A4][a4]

| 경계 | 구현 원칙 |
|---|---|
| ID·준비 단계 | `await_human` 안에서 매번 ID를 생성하지 않는다. 이전 단계에서 저장한 ID를 사용한다. 준비 단계 자체의 재실행도 저장된 model message ID + tool call ID 등에 연결한 안정적인 키로 중복 방지한다. |
| 체크포인트 ↔ Interaction | 어느 쪽이 먼저 저장돼도 조정 작업이 누락을 복원한다. 실제 interrupt 연결이 확인되기 전에는 외부 결정을 실행에 적용하지 않는다. |
| 승인 ↔ 재개 명령 | 결정 원장과 Outbox를 한 DB 트랜잭션에 저장한다. 동일 Command가 재전달돼도 새 업무 Run을 만들지 않는다. |
| 재개 명령 ↔ 실행 서버 | 플랫폼 Command와 vendor Run/Attempt를 매핑한다. 호출 응답이 유실되면 vendor 상태를 대조한다. 불명확한 재개 요청을 새 vendor Run으로 무조건 재발행하지 않는다. |
| 외부 실행 ↔ 결과 저장 | Gateway 원장과 외부 operation ID를 대조한다. 결과 미확정이면 `UNKNOWN`; 미처리가 확인되지 않은 비멱등 작업은 자동 재시도하지 않는다. |
| pause ↔ 승인 | pause 요청과 미완료 승인 조건을 별도로 유지한다. 사람이 승인해도 일시정지가 자동 해제되지 않는다. |
| cancel/block ↔ 실행 | Gateway의 신규 실행 허가를 철회한다. 외부 전송이 이미 끝난 요청의 취소는 보장하지 않으며 결과를 확인한다. |

`control_epoch`는 상태 변경 시 증가하는 **제어 세대**다. Gateway가 최신 값과 원자적으로 실행 허가를 검사해야 의미가 있다. 오래된 Worker의 숫자만 전달받아 신뢰해서는 안 된다. 실행 허가와 차단의 선후관계를 원장에 기록하며 이미 외부로 전달한 작업을 되돌리는 장치로 취급하지 않는다.

정책 거절·승인 거절은 도구 Observation으로 반환할 수 있지만, 변경 작업의 승인 거절은 동일 Run에서 의미상 같은 작업을 다시 요구하지 않도록 제한한다. 전역 취소·차단은 모델이 다른 도구로 우회할 수 없는 실행 제어다.

## B.4. Agent Server 채택 여부에 따른 책임

Agent Server는 자체 큐·실행 Worker·영속 상태를 제공하고, 배포 시 체크포인터를 주입한다. 따라서 채택하는 경우 Graph 코드에서 운영 체크포인터를 별도로 구성하지 않는다. [A6][a6]

| 구분 | Agent Server 채택 | OSS LangGraph 직접 호스팅 |
|---|---|---|
| Graph 배포 | `langgraph.json`에 공통·커스텀 Graph 등록 | 자체 Registry·Loader 구성 |
| 실행 큐·Worker 소유권 | 서버 기능 사용 | 자체 구현·검증 필요 |
| 체크포인터 | 서버가 제공·주입 | `AsyncPostgresSaver` 등 직접 구성 |
| 고객 Serving API | 플랫폼이 제공하고 서버 API는 내부화 | 동일 |
| 승인·업무 Run·Action 원장 | 플랫폼이 소유 | 동일 |
| 추가 Outbox | 플랫폼 명령 전달·복구용. 두 번째 Agent 스케줄러가 아님 | 업무 명령과 실행 스케줄링 경계를 직접 정의 |

다중 Graph를 같은 애플리케이션에 등록할 수 있지만 물리적 격리가 생기는 것은 아니다. 다른 신뢰 수준·트래픽·배포 주기의 Graph는 배포를 나누고 동일 Serving API로 연결한다. [A6][a6] [A7][a7]

**MVP는 하나의 호스팅 방식을 선택한다.** 런타임 Adapter의 외부 계약만 유지하고 여러 엔진을 동시에 완성하지 않는다.

## B.5. 모듈 구성과 커스텀 Graph 수용 조건

```text
contracts/             스키마 · 생성된 JSON Schema/OpenAPI
serving/               고객 API · 인증 · 공개 이벤트·Snapshot
control/               Run · Interaction · Outbox · 복구 조정
runtime/
  graphs/              general · 도메인 Graph
  nodes/               제어 · 모델 · 승인 · 결과 검증
  adapters/            Agent Server 또는 OSS 실행 연결
  context/             RAG 결과 · 메시지 · 사용량 제한
gateway/               별도 서비스: Registry · 정책 · 실행 원장
quality/               시나리오 · 회귀 평가 · 출시 게이트
```

커스텀 Graph는 모델·도구 호출·HITL·고객 이벤트용 플랫폼 SDK를 사용하고, 등록된 모델 및 Gateway 경로만 접근하도록 한다. 임의 코드 업로드는 받지 않는다. 내부 코드도 네트워크·자격증명 제한과 계약 테스트를 통과해야 한다.

**보안 경계는 Python 래퍼가 아니라 실행 환경과 Gateway의 집행 지점이다.** SDK 준수 여부만으로 직접 네트워크 접근이 차단됐다고 판단하지 않는다.

---

# 부록 C. 활용 프레임워크·라이브러리 제안

## C.1. MVP 권장 구성

| 영역 | 선택안 | 활용 범위 / 주의사항 |
|---|---|---|
| 실행 Graph | **`langgraph`** | 상태·분기·interrupt/resume. 안전 경계를 공통 노드로 제공. [A4][a4] |
| 모델·도구 추상화 | **`langchain-core`**, 필요 시 `langchain` | 공통 메시지·도구·모델 Adapter. `create_agent()`는 선택 경로. [A3][a3] |
| 실행 서버 | **Agent Server + `langgraph-sdk`** | 다중 Graph·Run·상태·서버 HITL. 계약·망 조건을 확인한 후 채택. [A6][a6] [A8][a8] |
| API·계약 | **FastAPI + Pydantic v2** | 요청 검증·OpenAPI·계약 생성. 인증·인가·업무 정책은 별도 구현. [A1][a1] [A9][a9] |
| 플랫폼 DB | **SQLAlchemy 2.x + psycopg 3** | Run·Interaction·Action·Outbox 트랜잭션. Agent Server 내부 테이블은 직접 수정하지 않음. [A10][a10] [A11][a11] |
| 체크포인트 | **`langgraph-checkpoint-postgres`** | OSS 직접 호스팅일 때 사용. Agent Server 채택 시 자체 주입을 중복 구성하지 않음. [A12][a12] |
| HTTP 도구 연결 | **HTTPX** | Gateway의 비동기 API Adapter. Timeout·connection pool·결과 크기를 제한. [A13][a13] |
| MCP 연결 | **공식 Python MCP SDK (`mcp`)** | Gateway 내부에서 검증된 원격 MCP 서버 연결. 직접 연결 우회 경로를 만들지 않음. [A14][a14] |
| 관측 | **OpenTelemetry Python** | Run→Model→Tool→외부 요청 추적. 민감정보 제거·샘플링 정책을 별도 설정. [A15][a15] |
| 테스트 | **pytest + Hypothesis** | 정상/예외 시나리오와 상태 전이·중복·순서 변형 시험. [A16][a16] [A17][a17] |

SSE는 FastAPI의 HTTP 응답 계층에서 구현하되, 핵심은 연결 라이브러리보다 **영속 이벤트·재접속·권한 검증**이다. Redis가 필요하면 신호·실시간 전달용으로 사용하고 업무 원본은 PostgreSQL에 둔다.

### MCP 적용 시 결정

MVP는 등록된 **원격 HTTP MCP 서버만** 허용하고, 모델·사용자가 전달한 임의 URL이나 로컬 `stdio` 프로세스를 실행하지 않는다. 도구 목록 변경도 자동 신뢰하지 않고 버전·스키마 검증 후 반영한다.

현재 LangChain 문서는 `langchain.mcp.MCPAdapter`를 제공하지만 해당 namespace는 **beta**로 표시한다. 따라서 자체 Tool Provider Adapter 뒤에 두거나, Gateway에서는 공식 MCP SDK를 직접 사용하는 편을 권한다. MCP 지원이 사용자 권한·승인·중복 처리를 대신하는 것은 아니다. [A18][a18]

## C.2. 선택형·후속 후보

| 후보 | 도입할 때 | 현재 판단 |
|---|---|---|
| **Deep Agents** | 계획·위임·확장된 Context 관리가 실제 업무에 필요 | 필수 의존성 아님. 동일 Gateway·승인·응답 계약을 만족할 때만 추가. [A5][a5] |
| **AWS AgentCore Runtime** | AWS 관리형 호스팅·실행 환경을 선택할 경우 | LangGraph 자체를 대체하는 엔진이라기보다 호스팅 대안. [A19][a19] |
| **OPA** | 정책 수·운영 조직이 늘어 코드와 정책을 독립 배포해야 할 때 | MVP는 테스트 가능한 Python 결정 규칙으로 시작. [A20][a20] |
| **Temporal** | 여러 서비스의 장기 이벤트·타이머·보상 작업까지 조정할 때 | 승인 대기만을 위해 도입하지 않음. 외부 업무 조정과 Agent 내부 복구의 소유권을 분리. [A21][a21] |
| **LangSmith Evaluation** | 평가 데이터셋·운영 Trace 연계가 필요하고 보안·계약 조건 충족 | 선택형 평가 도구. 도메인 정답·출시 기준은 플랫폼이 소유. [A22][a22] |

정확한 패키지 버전은 통합 테스트를 통과한 조합으로 고정한다. 업데이트 때마다 **Graph 복구·승인 Payload·Tool Schema·고객 응답·모델 Tool Calling** 회귀 시험을 수행한다. 이 문서는 특정 패키지 조합의 실행 호환성을 검증한 결과가 아니다.

## C.3. 공통 기능과 직접 구현할 기능

| 재사용 | 플랫폼이 직접 소유 |
|---|---|
| Graph 실행·체크포인트·interrupt/resume | AgentSpec·Release·고객 Session 소유권 |
| Agent Server의 큐·Worker·원시 스트림 | 고객 Serving API·Run/Attempt 매핑·공개 이벤트 |
| 모델·HTTP·MCP 프로토콜 Adapter | Action Binding·승인 원장·Gateway 정책·중복 처리 |
| 검증·관측·테스트 라이브러리 | 업무 결과 판정·인계·배포 게이트·회귀 평가 기준 |

> **프레임워크는 실행 메커니즘을 제공하고, 플랫폼은 실행 계약과 업무 통제권을 소유한다.**

---

# 부록 D. 구현 검증 기준

| 검증 | 필수 확인 |
|---|---|
| 스키마·명령 | 알 수 없는 명령, 잘못된 타입, 동일 키·다른 본문, 오래된 revision을 안전하게 거절 |
| 고객 격리 | 다른 고객의 Run 조회·이벤트 구독·승인·재개 차단 |
| 승인 | 인자 변경·만료·재사용·권한 철회 차단. 고객 확인과 직원 승인을 독립 검사 |
| 복구 | 승인 대기 중 Worker 교체, 실행 서버 응답 유실, 외부 API 성공 직후 장애 처리 |
| 실행 통제 | pause 상태의 승인, cancel/block과 도구 착수의 경쟁, 늦은 Worker의 신규 실행 차단 |
| 결과 | 접수와 완료 구분, 미확정 결과에서 무조건 재시도 금지, 상담 인계 근거 보존 |
| 배포 | 새 Release 배포 후 구버전 대기 Run을 복구하고 강제 마이그레이션하지 않음 |
| UI·출력 | SSE 재접속·중복 제거, 민감정보 미노출, 검증되지 않은 완료 문구 미전송 |

위 테스트를 공통 Graph와 커스텀 Graph에 동일하게 적용한다. 유효한 타입 선언은 테스트의 시작점일 뿐, 분산 실행·권한·멱등성 보장의 증거는 아니다.

---

## 부록 참고 자료

문서 확인 기준: 2026-09-09. 제품 기능의 근거이며, 위 계약·모듈 구성·선택 우선순위는 자체 설계 제안이다.

| 번호 | 공식 자료 | 확인 내용 |
|---|---|---|
| A1 | [Pydantic · JSON Schema][a1] | 모델에서 JSON Schema 생성 |
| A2 | [Pydantic · Strict mode][a2] | 엄격한 입력 검증 |
| A3 | [LangChain · Agents][a3] | 모델·도구·미들웨어 기반 Agent 구성 |
| A4 | [LangGraph · Interrupts][a4] | 중단·재개와 노드 재실행 |
| A5 | [Deep Agents · Overview][a5] | Harness와 파일시스템 구성 |
| A6 | [LangChain · Agent Server][a6] | 큐·Worker·영속화·체크포인터 주입 |
| A7 | [LangChain · Application structure][a7] | 다중 Graph 배포 |
| A8 | [LangChain · HITL using server API][a8] | SDK를 통한 서버 중단·재개 |
| A9 | [FastAPI · Features][a9] | Pydantic·OpenAPI 기반 API |
| A10 | [SQLAlchemy · Asyncio][a10] | 비동기 DB 접근 |
| A11 | [Psycopg · Concurrent operations][a11] | 비동기 연결·동시성 |
| A12 | [LangGraph · Checkpointers][a12] | PostgreSQL 체크포인터 |
| A13 | [HTTPX · Async support][a13] | 비동기 HTTP·연결 관리 |
| A14 | [MCP · Official SDKs][a14] | 공식 Python SDK |
| A15 | [OpenTelemetry · Python][a15] | Python 관측 구성 |
| A16 | [pytest · Documentation][a16] | 테스트 프레임워크 |
| A17 | [Hypothesis · Documentation][a17] | Property-based testing |
| A18 | [LangChain · MCP][a18] | MCPAdapter와 beta 상태 |
| A19 | [AWS · Use any agent framework][a19] | AgentCore에서 LangGraph 등 사용 |
| A20 | [Open Policy Agent][a20] | 정책 판단의 분리 |
| A21 | [Temporal · Python SDK][a21] | Workflow·Activity 개발 |
| A22 | [LangSmith · Evaluation][a22] | 평가·실험 체계 |

[a1]: https://docs.pydantic.dev/latest/concepts/json_schema/
[a2]: https://docs.pydantic.dev/latest/concepts/strict_mode/
[a3]: https://docs.langchain.com/oss/python/langchain/agents
[a4]: https://docs.langchain.com/oss/python/langgraph/interrupts
[a5]: https://docs.langchain.com/oss/python/deepagents/overview
[a6]: https://docs.langchain.com/langsmith/agent-server
[a7]: https://docs.langchain.com/langsmith/application-structure
[a8]: https://docs.langchain.com/langsmith/add-human-in-the-loop
[a9]: https://fastapi.tiangolo.com/features/
[a10]: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
[a11]: https://www.psycopg.org/psycopg3/docs/advanced/async.html
[a12]: https://docs.langchain.com/oss/python/langgraph/checkpointers
[a13]: https://www.python-httpx.org/async/
[a14]: https://modelcontextprotocol.io/docs/sdk
[a15]: https://opentelemetry.io/docs/languages/python/
[a16]: https://docs.pytest.org/en/stable/
[a17]: https://hypothesis.readthedocs.io/en/latest/
[a18]: https://docs.langchain.com/oss/python/langchain/mcp
[a19]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/using-any-agent-framework.html
[a20]: https://www.openpolicyagent.org/docs
[a21]: https://docs.temporal.io/develop/python
[a22]: https://docs.langchain.com/langsmith/evaluation
