# Agent Runtime Platform

## 대고객 Agent 서빙을 위한 아키텍처 · 기술 명세

| 항목 | 내용 |
|---|---|
| 버전 | v1.0 |
| 문서 상태 | 의사결정 제안 |
| 원본 문서 기준일 | 2026-09-09 |
| 검증 상태 | 내부 현황·성능·비용 실측 전 |

> **구성형 Agent와 도메인별 Graph를 하나의 실행·권한·품질 체계로 서빙한다.**
>
> 공통화 대상은 단일 Graph가 아니라 **실행 표준**이며, 고객 앱·웹은 플랫폼 API를 호출한다.

### 목차

| 상위 보고 | 기술 검토 |
|---|---|
| 1. 제안 요약 | 4. Runtime: 범용성과 다중 Graph |
| 2. 벤치마크와 도입 전략 | 5. 핵심 Contract와 고객 서빙 API |
| 3. 목표 아키텍처와 책임 경계 | 6. HITL·권한·장애 복구 |
| 7. MVP·OKR·출시 기준 | 8. 근거 및 최종 확인 항목 |

---

## 1. 제안 요약

### 1.1 왜 필요한가

현재 병목에 대한 **검증 가설**은 다음과 같다.

| 예상되는 문제 | 플랫폼에서 바꿀 것 | 기대 결과 |
|---|---|---|
| Agent별 상태·승인·도구 연동 중복 | 공통 Runtime과 등록 Tool 재사용 | 신규 업무 개발·검증 시간 단축 |
| 프로세스 장애·승인 대기로 작업 단절 | 영속 Run·체크포인트·복구 | 중단 이후 이어서 처리 |
| 업무별 권한·배포·품질 기준 불일치 | Gateway 통제·평가 후 버전 배포 | 대외 적용의 안전성과 운영 일관성 |

위 문제는 내부 실태를 확인한 사실이 아니라 제안 가설이다. 착수 시 파일럿 팀의 개발 이력·장애·연동 공수를 확인한다.

### 1.2 확정할 방향과 조건부 결정

| 구분 | 권고안 |
|---|---|
| **플랫폼 정의** | 고객 상호작용·작업 진행·품질 검증을 서빙하는 독립 백엔드. 업무 원장과 확정 규칙은 도메인 서비스가 소유한다. |
| **핵심 구성** | Playground / Agent Runtime Plane / Tool Gateway. 고객 화면과 기존 RAG는 별도 시스템으로 유지한다. |
| **실행 기술** | LangGraph 기반을 우선한다. Agent Server의 라이선스·망·복구 적합성을 검증한 뒤 실제 채택을 결정한다. |
| **MVP 범위** | 조회·설명·고객 확인·업무 접수·인계. Shell, 코드 실행 도구, 파일 작업공간, 신규 지식 저장소는 제외한다. |

### 1.3 의사결정 요청

**공통 서빙 플랫폼과 파일럿 업무 1개를 추진하고, 제품 적합성 검증 후 운영 런타임 1개만 선택한다.**

플랫폼팀은 실행·권한·배포를, 도메인팀은 업무 API·정답 기준·출시 승인을 담당한다.

---

## 2. 벤치마크와 도입 전략

**Agent Server는 실행 상태와 다중 Graph 서빙을, AgentCore는 실행 환경·배포·권한의 분리를 벤치마킹한다.** 아래는 원본 문서의 기능 비교이며 성능 순위가 아니다.

### 2.1 제품 비교

| 대상 | 구조·구현 자유도 | 우리 적용 방향 |
|---|---|---|
| **LangChain Agent Server** | 한 애플리케이션에 복수 Graph 등록. 같은 Graph에 서로 다른 Assistant 설정을 연결. 영속 상태·작업 큐·스트리밍 제공. [1][s1] [2][s2] [3][s3] | 다중 Graph + 구성형 Agent 모델과 API/Worker 분리. **운영 후보 1순위**로 적합성 검증. |
| **AWS AgentCore Runtime** | 자체 코드·프레임워크를 호스팅. 버전·Endpoint와 실행 환경 격리 제공. 여러 Graph의 선택은 애플리케이션에서 구현. [5][s5] [6][s6] | 동일 Graph를 배포해 비교할 **호스팅 대안**. Identity·Gateway·Policy 분리 차용. |
| **AWS AgentCore Harness** | 서비스가 Agent Loop를 제공하는 설정형 방식. 원본에서 참조한 공식 비교표상 임의 Graph/Workflow 패턴과 프레임워크 교체는 미지원. [5][s5] | 구성 경험을 참고하되, **커스텀 Graph가 필요한 MVP 공통 엔진에서는 제외**. |

### 2.2 차용할 설계와 주의할 경계

| 차용할 설계 | 주의할 경계 |
|---|---|
| Graph 코드 ↔ Agent 설정 ↔ 배포 버전 분리 | Assistant 설정 버전만으로 코드·의존성까지 고정되지는 않는다. [2][s2] [3][s3] |
| API와 실행 Worker 분리, 영속 상태 기반 복구 | 한 배포의 여러 Graph는 강한 격리 단위가 아니다. 신뢰·성능·배포 주기가 다르면 분리한다. [2][s2] |
| 호출 인증과 외부 업무 접근 권한 분리 | 실행 환경 격리만으로 고객과 Session 소유 관계가 검증되지는 않는다. [7][s7] |
| 에이전트 코드 밖에서 정책 집행 | Gateway를 거치지 않는 경로까지 자동 통제되는 것은 아니다. 네트워크·자격증명 제한을 함께 적용한다. [8][s8] |

### 2.3 실서비스에서 확인되는 방향

| 사례 | 도입 방식 | 설계 시사점 |
|---|---|---|
| **Lyft** | 구성형 Agent와 직접 개발한 전문 Agent를 함께 운영. [11][s11] | 두 개발 방식을 공통 실행·관측 체계로 수용한다. |
| **Nubank** | 카드 배송의 고정 처리 순서를 복합 Tool로 이전. [12][s12] | 모델의 판단과 결정적인 업무 실행을 분리한다. |

사례는 해당 기업·공급사가 공개한 설명이다. 외부 성과 수치를 우리 OKR의 근거값으로 전용하지 않는다.

### 2.4 도입 결정 순서

| 구분 | 결정 방향 |
|---|---|
| **기본 후보** | Agent Server를 내부 실행 서버로 채택하고 자체 Serving API·승인·Gateway를 결합한다. |
| **조건 미충족 시** | OSS LangGraph + 자체 Runtime Adapter로 전환하되, 큐·실행 제어의 구현 비용을 재산정한다. |
| **AWS 대안** | AgentCore Runtime에 동일 업무 Graph를 배포해 비용·망·복구 적합성을 비교한다. |

**운영 엔진을 동시에 두 개 만들지는 않는다.** Agent Server는 OSS LangGraph와 별도 제품이므로 라이선스·외부 통신·망분리 환경 지원 조건을 계약과 배포 방식별로 확인한다. [4][s4]

---

## 3. 목표 아키텍처와 책임 경계

**관리 화면이 멈춰도 고객 서빙은 계속되어야 한다.** 관리·평가 작업과 고객 실행을 분리하되, 플랫폼의 제품 구성은 세 컴포넌트로 유지한다.

### 3.1 전체 구조

```text
Playground                                  고객 앱·웹 / 서비스 BFF
구성 · 테스트 · 평가 · 배포 · 운영           인증된 요청 · 고객 확인 · 결과 표시
    │ 관리 API                                  │ Serving API / SSE
    ▼                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Runtime Plane                         │
│                                                                 │
│  관리 영역                       서빙 영역                       │
│  Agent Registry · 평가 세트      인증·입력 검증 · Session / Run   │
│  Release · Deployment · 롤백     API / Worker · Context          │
│                                  Checkpoint · HITL · 실행 제어   │
│  검증된 Release를 지정 ────────▶ 고정된 Release로 고객 요청 실행  │
│                                  고객 응답 · 결과 · 이벤트       │
└────────────────────────────────────────┬────────────────────────┘
                                         │ 업무 Tool 요청
                                         ▼
                               Tool Gateway
                 Registry · 인가 · Resource Scope · 승인 재검증
                 실행 원장 · 자격증명 중개 · 감사
                            │                       │
                            ▼                       ▼
                         기존 RAG               도메인 서비스
                       정책·문서 검색           현재 고객 상태
                       원문 조회·ACL            업무 규칙·데이터 변경
                                                결과 조회·상담 접수
```

모델 추론은 **Runtime → 승인된 Model Gateway** 경로를 사용한다. 이는 업무 Tool Gateway 경로와 별도이며, 원본 업무 자격증명을 모델·Graph에 제공하지 않는다.

### 3.2 컴포넌트별 소유권

| 컴포넌트 | 직접 책임지는 것 | 책임지지 않는 것 |
|---|---|---|
| **Playground** | 구성·평가·배포·관찰·승인 UI | 실행 상태의 원본, 업무 인가 |
| **Runtime Plane** | Agent 기능·Run·승인 원장·고객 응답·실행 복구·버전·평가·배포 | 원장 데이터와 확정적 업무 규칙 |
| **Tool Gateway** | 호출 주체·권한·정책·승인 검증·실행·중복 방지·감사 | LLM 판단, 고객 문제 해결 여부의 독자 판정 |

### 3.3 기반 기술 및 배포

| 영역 | 후보 기술 |
|---|---|
| Playground | Next.js |
| 고객 Serving API | FastAPI |
| 실행 엔진·서버 | LangGraph / Agent Server |
| 영속 저장 | PostgreSQL |
| 실시간 전달·신호 | Redis |
| 관측 | OpenTelemetry |

PostgreSQL은 플랫폼·승인·업무 실행 기록을 보존한다. **Agent Server의 내부 테이블은 직접 수정하지 않는다.** Redis는 실시간 전달·신호용이며 원본 저장소로 삼지 않는다. [2][s2]

고객 API와 Worker는 별도로 확장한다. 업무별 트래픽·신뢰 경계가 다르면 Graph 패키지와 Worker 배포를 분리하되 고객 API 계약은 유지한다. 장기 지식은 기존 RAG를 사용하고, 실행 상태만 체크포인트에 보존한다.

---

## 4. Runtime: 범용성과 다중 Graph

> **기본 경로는 구성형 Agent, 확장 경로는 승인된 커스텀 Graph다.**
>
> 단일 플랫폼은 여러 배포를 관리할 수 있다. “한 서버에 등록 가능”과 “동일 서버 배치 의무”는 다르다.

### 4.1 실행·배포 단위

| 단위 | 정의 및 필수 정보 |
|---|---|
| **GraphPackage** | 실행 코드 묶음. `graph_id`, 코드·이미지 digest, 의존성, `state_schema_version`. |
| **AgentSpec** | 업무 목표·담당/제외 범위·Prompt·Model·Skill 지침·Tool/Resource Scope·완료/인계 기준. |
| **Release / Deployment** | Release는 GraphPackage·AgentSpec·Tool 계약·응답 스키마·평가 기준의 고정 묶음. Deployment는 검증된 Release를 가리킨다. |
| **Session** | 고객의 대화·작업 Context. `tenant / actor / Agent / 내부 thread_id`의 소유 관계를 서버에서 관리한다. |
| **Run / Attempt** | Run은 고객의 한 작업. 실행·재개·재시도 Attempt는 여러 개일 수 있으며, 제품의 `run_id`와 매핑한다. |
| **Interaction / Action** | Interaction은 확인·승인·인계 요청. Action은 특정 대상에 대한 논리적 Tool 작업으로 재시도에도 동일 ID를 유지한다. |

### 4.2 다중 Graph 등록

Agent Server의 `langgraph.json` 구성 예시:

```json
{
  "dependencies": ["."],
  "graphs": {
    "general": "./agents/general.py:graph",
    "support": "./agents/support.py:graph",
    "payment_flow": "./agents/payment.py:graph"
  }
}
```

서로 다른 Graph를 등록하고 Graph 또는 Assistant를 선택해 실행한다. 같은 Graph에 여러 Assistant 설정을 둘 수 있다. [1][s1] [3][s3]

### 4.3 수용 조건

| 유형 | 수용 조건 |
|---|---|
| **기본 Graph** | `Model → Tool Gateway → Observation` 루프를 LangGraph로 구현한다. 프롬프트·도구 구성은 AgentSpec에서 주입하며 파일시스템 도구는 넣지 않는다. |
| **구성형 Agent** | 이미 등록된 Tool과 공통 루프를 사용한다. 필요한 업무 Capability가 없으면 설정만으로 출시할 수 없으며 도메인 API 개발이 필요하다. |
| **커스텀 Graph** | 코드 검토·계약 테스트를 통과한 내부 팀 코드만 배포한다. 임의 코드 업로드·Shell 도구·직접 업무 API 접근은 허용하지 않는다. |

### 4.4 동시성·호환성 규칙

**MVP는 Session당 미종료 업무 Run 1개만 허용한다.** 승인 대기·`PAUSED`도 포함하며, 추가 작업 요청은 `409`로 거절한다. Interaction 응답은 기존 Run으로 전달한다. Agent Server의 Thread당 실행 제한만으로 이 정책을 대신하지 않는다. [2][s2] [13][s13]

Run과 기본 Session은 Release에 고정한다. 새 Graph·상태 스키마로 전환하려면 새 Session 또는 검증된 마이그레이션을 사용한다. 대기 Run이 남아 있으면 구버전 실행 경로를 유지한다. 정책 철회·긴급 차단은 최신 상태로 재검증한다.

다른 SDK를 한 노드로 래핑해도 그 내부 단계의 복구가 자동 보장되지는 않는다. 복구 경계와 부작용 처리는 별도 검증 대상이다. [1][s1] [9][s9]

---

## 5. 핵심 Contract와 고객 서빙 API

아래는 **자체 플랫폼 v1 계약안**이다. 제품의 원시 Graph 상태·interrupt payload는 외부에 노출하지 않고 Adapter에서 변환한다.

### 5.1 핵심 Contract

| Contract | 최소 정보와 보장 |
|---|---|
| **Release** | `release_id`, `graph_ref`, `spec_version`, `tool_schema_versions`, `response_schema_version`, `eval_suite_version`. 생성 후 불변. |
| **RunCommand / Run** | `command_id`, `session_id`, `run_id`, `expected_revision`, `input`. 요청 수락과 작업 완료를 분리하며 고객 입력으로 actor·권한을 변경할 수 없다. |
| **HumanInteraction** | `interaction_id`, `kind`, `action_id`, `binding_hash`, `audience`, `allowed_decisions`, `revision`, `expires_at`. 승인된 대상만 재개. |
| **ActionRequest / Decision** | `run_id`, `release_id`, `action_id`, `tool_ref`, `arguments`, `resource_ref`, `verified_actor_ref`, `idempotency_key`, `control_epoch`. Decision은 `ALLOW / REQUIRE_APPROVAL / DENY`와 `reason_code`, `policy_version`을 반환. |
| **ActionResult** | `action_id`, `status`, `operation_id`, `evidence_ref`, `error_code`. 상태는 `ACCEPTED / SUCCEEDED / FAILED / UNKNOWN`. 접수와 처리 완료를 구분. |
| **RunEvent / CustomerResponse** | `schema_version`, `event_id`, `session_id`, `session_seq`, `run_id`, `occurred_at`, `type`, `payload`. 내부 이벤트와 고객 응답은 별도 스키마. |
| **TaskOutcome** | `ANSWERED / SUBMITTED / RESOLVED / HANDED_OFF / UNKNOWN / FAILED`. 실제 업무 근거로 판정하고 Run 종료와 구분. |

### 5.2 외부 API

```http
POST /v1/sessions
POST /v1/sessions/{session_id}/runs
GET  /v1/runs/{run_id}
POST /v1/runs/{run_id}/controls
POST /v1/interactions/{interaction_id}/responses
GET  /v1/sessions/{session_id}/events
GET  /v1/sessions/{session_id}/snapshot
```

생성·제어는 `Idempotency-Key`와 revision을 사용한다. 비동기 제어는 `202`로 수락하되 실제 상태는 Event/Snapshot으로 확인한다. 충돌은 `409`, 과부하는 `429`와 재시도 정보를 반환한다.

`controls`는 `pause / resume / cancel / block`이며, **block은 운영 권한 전용**이다.

### 5.3 스트리밍과 고객 응답

**HTTP 명령 + SSE**로 구성한다. 주요 상태·최종 메시지·승인 이벤트는 커밋 후 발행하고, **중복 전달 가능·순서 복원 가능**을 계약으로 한다. 세션별 커밋 순서의 sequence를 사용하며 `event_id`로 중복 제거한다.

토큰 delta는 임시 출력이다. 재접속 시 완료 메시지·승인·Run 상태는 복원하고, 만료된 cursor는 Snapshot으로 복구한다.

원시 추론·민감 인자·내부 로그는 고객에게 노출하지 않는다. 고객 응답은 다음으로 제한한다.

```text
답변 / 정보 요청 / 확인 / 진행 / 결과 / 인계 / 오류
```

Agent Server도 마지막 이벤트 ID 기반 Thread 스트림 재개를 지원한다. 보존 기간과 우리 고객 응답 계약의 일치 여부는 도입 시험에서 확인한다. [10][s10]

---

## 6. HITL·권한·장애 복구

### 6.1 승인과 실행 순서

```text
요청 준비
  → Gateway 정책 판단
  → 대기 기록·체크포인트
  → 사람 결정
  → 새 Attempt
  → 권한·승인·대상 재검증
  → 업무 실행
  → 실제 결과 확인
```

승인 대상은 **tenant·환경·자원·도구 버전·정규화 인자·Release·업무 전제조건**에 묶는다. 서버가 생성한 `action_id`와 `binding_hash`를 사용하고, 수정·만료·중복 응답을 검증해 거절한다. 동시성 충돌은 revision으로 검사한다.

**고객 동의는 직원 권한이나 업무 인가를 대신하지 않는다.**

### 6.2 실행 통제

| 통제 | v1 동작 |
|---|---|
| **HITL** | `USER_INPUT / CUSTOMER_CONFIRMATION / STAFF_APPROVAL / HANDOFF`를 구분한다. 대기 중 Worker 점유 없이 영속 기록으로 복원한다. |
| **Pause / Resume** | 새 Tool 착수 전 등 안전 경계에서 `PAUSED`로 전환한다. 미완료 승인·인계 등 모든 대기 조건이 해소돼야 재개한다. `CANCELLED`·`BLOCKED`는 직접 재개하지 않는다. |
| **Cancel / Block** | 취소·차단 접수 시 신규 Action 허가를 철회한다. 이미 외부에 전달된 요청은 취소를 보장하지 않고 결과 확인을 계속한다. |
| **부작용·재시도** | 멱등성 키로 중복을 방지하고 결과 조회로 상태를 확인한다. 미처리가 확증되지 않은 비멱등 Tool은 자동 재시도하지 않고 `UNKNOWN`으로 인계한다. |

### 6.3 권한 경계

인증된 고객·서비스 위임 관계에서 actor를 도출한다. Request 본문의 `user_id`는 신뢰하지 않는다.

```text
실행 권한 = 사용자 권한 ∩ Agent Scope ∩ 현재 정책
```

실행 직전에 권한을 검사하며, RAG 문서 접근 권한도 검색·원문 조회 각각에 적용한다. [7][s7] [8][s8]

Worker에는 원본 업무 자격증명을 주지 않고 Gateway에서 최소 권한으로 사용한다. 모델·승인된 플랫폼 경로 외의 업무 시스템 연결은 차단한다. Tool 설명과 RAG 본문은 비신뢰 입력으로 취급하며 정책을 변경할 수 없다.

### 6.4 저장·복구의 책임 분리

| 영속 원본 | 복구 규칙 |
|---|---|
| **Runtime 내부 실행·Checkpoint** | Agent Server 채택 시 내부 스케줄러·큐를 사용한다. 플랫폼은 제품의 Attempt와 Run을 매핑하며 경쟁 스케줄러를 만들지 않는다. |
| **플랫폼 Run·Interaction·Command Outbox** | 승인 결정과 재개 명령을 한 트랜잭션으로 기록한다. 중단 체크포인트만 존재하는 경우 조정 작업으로 Interaction을 복원한다. |
| **Gateway Action·Audit** | 안정적인 `action_id`로 중복을 판별한다. 실행 전 감사 기록이 불가하면 변경 작업을 거절한다. 최종 결과는 외부 업무 원장과 대조한다. |

Run 상태는 다음과 같이 관리한다.

```text
QUEUED / RUNNING / WAITING / PAUSED / CANCELLING
BLOCKED / COMPLETED / FAILED / CANCELLED
```

`WAITING` 사유와 `TaskOutcome`은 별도 필드다. 차단·취소와 경합하는 늦은 Worker는 제어 세대인 `control_epoch`와 실행 허가를 Gateway에서 재검증한다.

LangGraph 재개 시 interrupt가 발생한 노드의 앞부분이 다시 실행될 수 있다. **체크포인트는 외부 API와 원자적 트랜잭션을 제공하지 않으며, 외부 부작용의 exactly-once를 약속하지 않는다.** [9][s9]

---

## 7. MVP·OKR·출시 기준

### 7.1 MVP 업무

> **결제 상태 조회·설명 → 고객 확인 → 상담 접수 → 접수 ID 확인**

환불·송금·임의 데이터 변경은 제외한다. **접수 성공과 고객 문제 해결은 따로 측정한다.**

### 7.2 구현 단계

| 단계 | 완료 기준 |
|---|---|
| **0. 실행 제품 선정** | 동일 Graph·모델·Tool로 비교한다. 라이선스·망·데이터 반출·동시 실행 한도·운영 비용을 확인하고 후보 1개를 선택한다. |
| **1. 안전한 업무 1개** | 인증·RAG·업무 API·HITL·중단/재개·고객 응답·결과 확인을 End-to-End로 통과한다. 권한·감사는 처음부터 포함한다. |
| **2. 범용성 검증** | 공통 Graph의 설정형 Agent와 별도 Graph를 함께 등록한다. 같은 Serving API·Gateway·평가 계약으로 실행한다. |
| **3. 제한 출시** | 합의한 동시 Run·입력 길이로 부하 시험을 수행한다. 도메인팀의 정상·예외 정답 세트를 통과하고, 롤백·상담 인계 훈련 후 제한된 고객군에 적용한다. |

### 7.3 OKR 제안

**아래 수치는 목표 제안이며 현재 성과가 아니다.**

| Objective | KR / 측정 정의 | 책임 |
|---|---|---|
| **개발 생산성** | 기존 Tool로 구성 가능한 파일럿 업무 **3개 이상**에서, 요구·접근권한 확정부터 검증 배포까지의 Lead Time 중앙값을 기존 대비 **50% 단축**한다. 신규 도메인 API 공수는 별도 표시한다. | 플랫폼 + 도메인 |
| **복구·운영 신뢰성** | 체크포인트·결과 확인이 가능한 Run의 Worker 장애 주입 **1,000회 이상**에서 **60초 내 정상 재개 99% 이상**을 달성한다. `UNKNOWN` 인계는 성공에 포함하지 않는다. | 플랫폼 |
| **대고객 서비스 가치** | 동일 업무 완료율이 기존 채널보다 낮아지지 않는 조건에서, 검증된 접수 **1건당 총처리 비용을 20% 절감**한다. 재문의·불만·인계율 악화 여부를 함께 검사한다. | 플랫폼 + 도메인 |

업무 난이도·유입 구성·표본 수를 맞춰 비교한다. Baseline 측정 후 목표와 허용 가능한 품질 차이의 범위를 확정한다. 비용은 모델·Tool·재시도·상담원을 포함한다. **장애 주입 결과는 운영 확률 보장이 아니다.**

### 7.4 출시 게이트

OKR과 별도로 다음을 필수 조건으로 적용한다.

| 시험 | 통과 기준 |
|---|---|
| **권한·승인 공격 시험** | 다른 고객 Session 조회, Scope 초과, 승인 인자 변경, 승인 만료·재사용의 실행 성공 **0건**. 필수 케이스 전부 통과. |
| **장애·재접속·배포 시험** | 중복 변경·승인 유실·변경 Action 감사 누락 **0건**. 구버전 대기 Run 복원, `UNKNOWN` 결과 인계, SSE 재접속 검증. |
| **고객 서빙 성능** | 초기 검증 목표: 명령 수락 **p95 ≤ 500ms**, pause 안전 경계 도달 후 반영 **p95 ≤ 1s**. 실제 첫 답변·업무 완료 지연은 모델·도구·대기시간을 분리해 측정. |

### 7.5 MVP 제외 및 출시 전 합의

| 구분 | 내용 |
|---|---|
| **MVP 제외** | Shell·코드 실행 도구·Sandbox, 파일 기반 지식/문서관리, Agent Workspace, 장기 Memory, 시각적 Workflow Builder, 복잡한 Multi-Agent |
| **출시 전 합의** | 서비스 SLO·부하, 데이터 보존/삭제·백업 RPO/RTO, 당직·사고 대응·도메인 출시 책임자 |

---

## 8. 근거 및 최종 확인 항목

아래는 **원본 문서에 수록된 참고 자료**다. 설계·목표치·MVP는 본 문서의 제안이며, 도입·성능·보안 실증 결과가 아니다.

### 8.1 참고 자료

| 번호 | 자료 | 참고 내용 |
|---|---|---|
| 1 | [LangChain — Application structure][s1] | 다중 Graph 등록, 임의 노드 코드, 배포 구조 |
| 2 | [LangChain — Agent Server][s2] | API/Worker, 실행 큐, 체크포인트, PostgreSQL·Redis 역할 |
| 3 | [LangChain — Assistants][s3] | Graph와 설정 분리, Assistant 버전과 호출 대상 |
| 4 | [LangChain — Self-host standalone servers][s4] | 자체 배포, 라이선스, 외부 통신 및 운영 조건 |
| 5 | [AWS — AgentCore harness vs. Runtime][s5] | 코드형 Runtime과 관리형 Harness의 자유도 차이 |
| 6 | [AWS — AgentCore Runtime: microVMs][s6] | 버전·Endpoint, microVM 세션, 메모리 영속성의 경계 |
| 7 | [AWS — Security best practices for Runtime][s7] | 세션-고객 매핑, 최소 권한과 공유 책임 |
| 8 | [AWS — Policy in AgentCore][s8] | Gateway에서 코드 외부의 결정적 정책 집행 |
| 9 | [LangGraph — Interrupts][s9] | 체크포인트 기반 중단·재개와 노드 재실행 주의 |
| 10 | [LangChain — Streaming API][s10] | Thread 스트리밍과 마지막 이벤트 ID 기반 재접속 |
| 11 | [Lyft / LangChain — Self-Serve AI Agent Platform][s11] | 구성형·전문 Agent 병행, 평가·모니터링 사례 |
| 12 | [Nubank — Building AI agents for 131 million customers][s12] | 2026-03-23. 고정 업무 순서를 복합 Tool로 분리 |
| 13 | [LangChain — Double texting][s13] | 실행 중 추가 입력에 대한 큐·거절·중단 정책 |

### 8.2 실제 채택 전 확인

제품별 기능 버전·지원 리전·쿼터·가격·계약·망분리 환경 지원·외부 전송 범위를 확정한다. **공식 기능 지원과 사내 환경의 동작 보장은 구분**하며, 동일 Graph 기반 적합성 시험 결과로 최종 결정한다.

> **최종 방향은 “하나의 만능 Agent”가 아니라, 서로 다른 Agent를 같은 실행·권한·품질·배포 기준으로 대고객 서비스에 제공하는 것이다.**

[s1]: https://docs.langchain.com/langsmith/application-structure
[s2]: https://docs.langchain.com/langsmith/agent-server
[s3]: https://docs.langchain.com/langsmith/assistants
[s4]: https://docs.langchain.com/langsmith/deploy-standalone-server
[s5]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-vs-runtime.html
[s6]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-how-it-works.html
[s7]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-security-best-practices.html
[s8]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html
[s9]: https://docs.langchain.com/oss/python/langgraph/interrupts
[s10]: https://docs.langchain.com/langsmith/streaming
[s11]: https://www.langchain.com/blog/lyft-built-a-self-serve-ai-agent-platform-for-customer-support-with-langgraph-and-langsmith
[s12]: https://building.nubank.com/building-ai-agents-for-131-million-customers/
[s13]: https://docs.langchain.com/langsmith/double-texting
