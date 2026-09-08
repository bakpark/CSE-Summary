# Request-scoped 프로필과 분산 에이전트 런타임

[AI 에이전트 목차](./README.md) · [엔진과 하네스 비교](./react-engine-and-harness.md)

> 확인일: 2026-09-09. 이미 실행 중인 여러 워커가 서로 다른 에이전트 프로필의 요청을 처리하는 환경을 가정한다. 아래 구성요소와 프로토콜은 설계 제안이며, Deep Agents SDK에 모두 내장된 기능을 나열한 것이 아니다.

## 1. 핵심 결정: 실행 정의를 공유하고 프로필은 요청에서 확정한다

```text
                       Profile / Tool Registry
                         immutable revisions
                                  |
Client → API / Auth → Execution admission + durable queue
                                  |
                     +------------+------------+
                     |            |            |
                  Worker A     Worker B     Worker C
                     |            |            |
                     +------------+------------+
                                  |
                   External checkpoint / Run metadata
                   Policy / Tool Gateway / Event storage
                   Memory store / Sandbox service
```

워커는 장수하는 프로세스다. 각 워커에는 공통 실행 정의와 서버 측 서비스 클라이언트를 두고, 프로필·사용자·세션·실행별 데이터는 호출 컨텍스트로 전달한다.

```text
Worker A의 공통 실행 정의
  ├─ Run 1: support 프로필 + tenant-1 + thread-X
  ├─ Run 2: research 프로필 + tenant-2 + thread-Y
  └─ Run 3: coding 프로필 + tenant-1 + thread-Z
```

LangChain의 Runtime Context는 호출 시 설정과 의존 정보를 전달하는 수단이며 미들웨어와 도구에서 접근할 수 있다. 이를 요청별 프로필 적용의 연결 지점으로 활용한다. [1]

**Request-scoped 프로필은 요청마다 모든 객체를 새로 만드는 전략이 아니다. 또한 분산 시스템이라는 이유만으로 프로필별 컴파일 캐시보다 항상 우월한 것도 아니다.** 프로필을 언제 결정하는지와 실행 그래프를 언제 생성하는지는 독립적인 설계 축이다.

| 전략 | 구조 | 장점 | 부담 |
| --- | --- | --- | --- |
| 프로필 버전별 컴파일 캐시 | 프로필별 실행 정의를 지연 생성·재사용 | 구조가 다른 에이전트를 표현하기 쉽다. | 캐시 크기, cold start, 무효화 정책 |
| 매 호출 실행 정의 생성 | 요청을 해석한 뒤 그래프 생성 | 생성 시점 설정을 적용하기 쉽다. | 반복 초기화 비용을 측정해야 한다. |
| 공유 템플릿 + 요청별 컨텍스트 | 소수 실행 정의에 프로필 주입 | 구성 중심의 에이전트 추가와 운영 계약 통일 | 미들웨어·정책 계층을 제대로 설계해야 한다. |

이 문서는 세 번째를 기본으로 제안한다. 다만 상태 스키마나 실행 구조가 근본적으로 다르면 별도 템플릿 또는 그래프를 허용한다. 새 프로필 등록만으로 출시할 수 있는 범위는 **이미 배포된 템플릿과 승인된 도구 계약으로 표현 가능한 기능**까지다. 새로운 Python 코드나 미들웨어를 DB에 넣었다고 안전하게 실행할 수 있는 것은 아니다.

## 2. HTTP 요청, 논리 실행, 시도, 세션을 분리한다

| 식별자 | 의미 | 수명 |
| --- | --- | --- |
| `request_id` | HTTP/API 요청 한 건 | 접수·응답 또는 스트리밍 연결 |
| `run_id` | 하나의 논리적 작업 | 완료·실패·취소까지, 승인 대기 포함 |
| `attempt_id` | 워커가 작업을 수행하는 시도 | 장애 후 재시도하면 새 값 |
| `session_id` | 제품 관점의 대화·작업 세션 | 여러 사용자 입력과 실행을 포함 |
| `thread_id` | 그래프 상태를 저장하는 단위 | 해당 상태 계보 유지 기간 |
| `profile_revision` | 확정된 에이전트 구성 | 진행 중인 run 동안 고정 |

`run_id`는 이 문서의 플랫폼 계약이다. 특정 SDK의 run ID 또는 LangSmith trace ID와 반드시 같을 필요는 없다. 필요하면 별도 매핑한다.

HTTP 연결이 끊겨도 논리 실행은 계속될 수 있다. 반대로 사용자가 응답을 보지 못해 같은 요청을 재전송했다고 새 실행을 생성해서는 안 되는 경우가 있다. 접수 단계의 idempotency key로 같은 논리 요청을 식별하도록 제안한다.

```text
사용자 입력 접수 → Run R1 / Attempt A1
                     |
                  승인 대기
                     |
승인 API 호출   → Run R1 / Attempt A2 → 완료

다음 독립 입력  → Run R2 / Attempt A1
```

따라서 다음 원칙을 구분한다.

**요청 접수 시 프로필을 선택한다. 실행 중과 재개 시에는 확정된 설정을 사용한다. 재시도 시도마다 현재 권한과 단기 자격증명은 다시 확인한다.**

## 3. 프로필 버전 고정 정책

세션 전체에 같은 프로필 버전을 묶는 것은 안전한 기본값이지만, request-scoped 구조의 필수 조건은 아니다.

| 정책 | 의미 | 사용할 조건 |
| --- | --- | --- |
| 세션 버전 고정 | 같은 세션의 후속 run도 같은 revision | 장기 업무, 승인, 상태 의미가 민감한 서비스 |
| 완료된 turn 사이의 변경 허용 | 새 run에서 최신 revision 선택 | 상태 호환성 검사와 변경 이력이 존재함 |
| 프로필 변경 시 새 thread | 제품 대화는 유지하되 실행 상태 분리 | 다른 업무 에이전트로 전환하는 서비스 |

기본적으로 진행 중인 run의 revision은 바꾸지 않는다. 상태 스키마, 도구 의미, 중단 위치가 달라지면 같은 체크포인트를 그대로 재개하는 것이 안전하지 않을 수 있기 때문이다.

동일한 채팅 화면에서 여러 에이전트를 사용해야 한다면 제품의 대화 이력과 에이전트별 thread를 분리할 수 있다. 서로 다른 그래프의 체크포인트를 무작정 공유하는 대신, 전달할 대화 내용과 산출물을 명시적으로 변환한다.

프로필을 고정하더라도 보안 정책은 동결하지 않는다. 사용자의 권한 철회나 도구의 긴급 차단은 다음 실행 시점에 반영되어야 한다. 이는 행동의 재현성과 현재의 실행 허가를 분리하는 설계다.

## 4. 재개를 위한 Run Manifest

체크포인터는 thread의 그래프 상태를 보존하고, Store는 thread를 넘는 데이터를 다룬다. 둘의 역할은 다르다. [2]

이와 별개로 다음과 같은 실행 명세를 영속화하도록 제안한다. 값은 형식을 설명하는 가상의 예다.

```yaml
run_id: run-001
session_id: session-001
thread_id: server-issued-thread-001
subject_ref: authenticated-subject-001
profile:
  id: support
  revision: profile-rev-17
engine:
  template: deep-standard
  revision: template-rev-3
  runtime_build: build-20260909
  state_schema_revision: state-rev-2
resolved:
  model_config_ref: model-config-rev-6
  toolset_snapshot_ref: toolset-rev-42
  prompt_ref: prompt-rev-17
  skill_snapshot_ref: skills-rev-8
limits:
  deadline_at: '2026-09-09T01:00:00Z'
  budget_ref: budget-001
sandbox_ref: null
```

재시도와 resume는 이 명세로 Runtime Context를 재구성한다. Python 객체, DB 연결, 모델 클라이언트, 열린 MCP 연결이 다른 워커로 이동한다고 가정하지 않는다. Runtime Context 전체가 체크포인트에서 자동 복원된다는 전제도 두지 않는다.

자격증명 원문은 명세·프롬프트·체크포인트에 넣지 않는다. `credential_ref` 같은 참조가 필요하면 별도 권한 경계에 보관하고, 실행 시 유효기간이 짧은 자격증명을 발급받는다. 컨텍스트와 trace에도 민감정보가 남을 수 있으므로 직렬화·로깅·보존 정책을 설정한다.

모델 ID가 공급자의 이동 가능한 alias라면 모델 이름을 저장해도 완전한 재현성이 생기지 않는다. 가능한 모델 revision, 제공자, 생성 파라미터, 도구 스키마, 실제 사용량을 기록하고, 재실행 결과가 동일하다고 보장하지 않는다.

## 5. 체크포인터는 분산 실행 조정자가 아니다

서로 다른 thread의 동시 호출과 같은 thread에 대한 동시 호출을 구분한다. 사용자 A와 B의 이력이 다르게 저장된다고 해서 동일 세션에 들어온 두 요청의 처리 순서가 자동으로 결정되는 것은 아니다.

Agent Server에는 double-texting 정책이 있으며 공식 문서는 이를 LangGraph 오픈소스 프레임워크 자체의 기능과 구분한다. SDK만으로 서버를 구현한다면 이 정책에 대응하는 실행 조정 계층을 설계해야 한다. [3]

이 문서에서는 상태 변경이 있는 thread에 **단일 활성 writer**를 기본으로 제안한다.

```text
동일 thread에 Run R1 실행 중
  + Run R2 도착
       → enqueue 또는 reject
       → interrupt/supersede는 별도 업무 의미가 정의된 경우만
```

승인 대기에서는 워커 자원과 단기 lease를 해제할 수 있다. 다만 해당 thread가 어떤 논리 실행을 기다리는지는 유지하고, 승인 입력이 새 독립 run으로 잘못 처리되지 않도록 한다.

### Lease와 fencing

프로세스 로컬 `asyncio.Lock`은 다른 워커를 막지 못한다. TTL이 있는 분산 락만으로도 충분하지 않을 수 있다. 이전 워커가 잠깐 멈춘 동안 lease가 만료되어 새 워커가 실행을 시작한 뒤, 이전 워커가 다시 깨어날 수 있기 때문이다.

제안하는 계약은 다음과 같다.

```text
claim(run) → owner + lease expiry + 증가하는 epoch

상태 확정 / 중요 이벤트 기록 / 외부 변경 요청
  → 현재 owner와 epoch 검증
  → 만료된 실행자의 변경 거부
```

**Fencing token을 config에 넣는 것만으로는 효과가 없다.** 체크포인트를 확정하는 경로와 변경 작업을 받는 서비스가 조건을 실제로 검사해야 한다. 기본 checkpointer가 플랫폼의 epoch 검증을 수행한다고 가정하지 않는다.

기존 라이브러리와 이 계약을 직접 결합할 수 없다면 단일 writer 조정 서비스, 조건부 쓰기를 적용하는 저장 어댑터, 또는 관리형 실행 서버의 명시적 보장 중 하나를 검토한다. 이전 writer의 권한을 확실히 끊지 못한 상태에서 단순 lease 만료만 보고 같은 thread를 재실행하는 설계는 피한다.

## 6. 접수·큐·장애 복구

권장 접수 순서는 다음과 같다.

```text
인증·세션 접근 확인
  → 요청 중복 검사
  → 프로필·템플릿 호환성 확인
  → Run Manifest와 실행 상태 저장
  → 영속 큐에 전달
  → run_id 반환
```

실행 DB 기록과 메시지 발행 사이의 유실을 방지하려면 같은 DB 트랜잭션의 outbox 레코드와 별도 발행기를 사용하는 방식을 고려한다. 메시지는 중복 전달될 수 있다고 가정하고 consumer의 claim과 상태 전이를 멱등하게 만든다. 이는 구현 제안이며 특정 큐의 exactly-once 기능을 가정하지 않는다.

```text
QUEUED → RUNNING → SUCCEEDED
                  ├─ WAITING_INPUT / WAITING_APPROVAL → RUNNING
                  ├─ RETRYABLE_FAILURE → QUEUED
                  ├─ FAILED
                  └─ CANCELLED
```

실제 구현에서는 상태 전이마다 기대 이전 상태와 epoch를 검사한다. `WAITING_*`를 성공 완료로 표시하지 않고, 취소 요청과 취소 확정을 필요에 따라 구분한다.

워커가 죽었을 때 새 워커는 run의 명세와 마지막으로 확정된 상태를 읽는다. 중단된 함수의 임의 위치에서 그대로 이어지는 것이 아니라, 프레임워크의 재개 의미에 따라 일부 노드나 동작이 다시 수행될 수 있다는 점을 고려해야 한다. 특히 LangGraph interrupt는 노드 재실행을 고려해 부수효과를 배치하도록 안내한다. [4]

## 7. 외부 작업의 멱등성

```text
도구가 주문 취소 API 호출
  → 도메인 시스템에서는 취소 성공
  → 응답 또는 체크포인트 저장 전 워커 장애
```

이 상황은 대화 상태 저장만으로 해결되지 않는다. 멱등 API는 동일한 요청의 재시도를 중복 작업과 구분하는 계약이 필요하며, AWS Builders' Library도 호출자 요청 식별자와 의도 구분을 설명한다. [7]

다음과 같은 operation 원장을 제안한다.

| 필드 | 용도 |
| --- | --- |
| `operation_id` | 재시도·재개에도 유지하는 변경 작업 식별자 |
| `run_id`, `tool_call_id` | 원래 실행과의 연결 |
| `arguments_hash` | 같은 키에 다른 인자가 들어오는 것을 거부 |
| `status` | pending, succeeded, failed, unknown |
| `external_reference` | 외부 시스템에서 실제 처리 상태 조회 |

operation ID는 변경 작업을 시작하기 전에 영속화한다. 재시도마다 새로운 UUID를 발급하거나 `attempt_id`를 멱등키에 넣어 같은 작업이 다른 키가 되도록 하지 않는다.

`tool_call_id`만으로 업무 중복을 완전히 막을 수도 없다. 모델을 다시 호출하면 같은 업무 의도의 새 도구 호출 ID가 생길 수 있다. 중요한 변경 작업은 도메인의 업무 키와 사용자 확인에 기반한 중복 검증을 함께 둔다.

외부 API가 멱등성을 지원하지 않는다면 상태 조회·조정, 업무별 중복 차단, 보상 작업을 검토한다. 성공 여부를 알 수 없는 타임아웃에 무조건 재시도하지 않는다. 에이전트 플랫폼 전체에 exactly-once를 보장한다고 표현하는 대신, 전달·상태 확정·도메인 변경 각각의 보장 범위를 명시한다.

## 8. 세션과 저장소 격리

`thread_id`는 서버에서 발급하고 세션·사용자·tenant와 매핑한다. 클라이언트가 전달한 thread ID를 그대로 믿어 체크포인트를 읽거나 resume하지 않는다. 대화 조회, 이벤트 구독, 승인 API에도 동일한 접근 검사가 필요하다.

| 데이터 | 권장 범위 | 추가 고려 |
| --- | --- | --- |
| 그래프 상태 | 서버가 소유권을 확인한 thread | 동일 thread의 단일 writer |
| 실행 메타데이터 | tenant + run | 상태 전이와 감사 |
| 임시 파일·대형 도구 결과 | thread 또는 run | 보존 기간, 체크포인트 크기 |
| 장기 메모리 | tenant + 사용자 + 프로필 + 메모리 스키마 | 다른 thread의 동시 갱신 |
| 샌드박스 | 세션 또는 run의 명시적 binding | 수명, 재연결, 네트워크·자격증명 |

Deep Agents의 `StateBackend`는 agent state를 사용하고 `StoreBackend`는 Store를 통한 cross-thread 저장을 제공한다. `StoreBackend` namespace는 Runtime Context를 이용해 분리할 수 있다. 이 기능은 논리적 저장 범위 분리이며, 저장소 접근 권한과 운영 정책도 별도로 필요하다. [5]

사용자별 namespace를 나눠도 같은 사용자의 여러 thread가 메모리를 동시에 갱신할 수 있다. 필요한 데이터에는 CAS·ETag, 버전 기반 병합 또는 갱신 이벤트를 적용한다. 중요한 지식의 원본을 마지막 writer가 덮어쓰는 단일 문자열로만 관리하지 않는다.

로컬 디스크나 메모리 저장소를 세션의 유일한 원장으로 두면 워커 교체에 제약이 생긴다. 공유 저장소가 필요하더라도 모든 파일을 모든 tenant가 읽을 수 있는 하나의 작업 폴더에 넣는 방식은 피한다.

## 9. 도구 정책과 샌드박스

```text
노출할 수 있는 후보 도구
  = 프로필 capability ∩ tenant 정책 ∩ 사용자 권한 ∩ 실행 제한

실제 실행 허가
  = 위 조건 재확인 + 자원 소유권 + 승인 + 현재 정책 + 업무 상태
```

위 식은 개념 표현이다. 실제 인가는 단순 도구명 집합의 교집합을 넘어 인자와 대상 자원에 대한 조건을 검사해야 한다.

도구 스키마와 실행 바인딩은 같은 snapshot을 사용한다. 모델에게는 v1 스키마를 보여주고 실행 시에는 최신 v2 도구를 조회하는 식의 불일치를 피한다. 도구 레지스트리는 승인된 코드 또는 원격 서비스의 참조를 저장하며, 일반 사용자 요청의 임의 URL·Python import·셸 명령을 서버 권한으로 실행하지 않는다.

서브에이전트는 별도 컨텍스트를 갖더라도 별도 보안 영역이라고 볼 수 없다. 자식의 capability는 부모 실행의 허용 범위를 넘지 않도록 하고, identity·run·budget·workspace를 명시적으로 전파한다.

파일 도구의 경로 권한과 셸 프로세스의 접근 권한은 다르다. Deep Agents의 파일 permission은 샌드박스 명령 실행까지 통제하는 장치가 아니므로, 컨테이너·VM의 파일 시스템과 네트워크·프로세스 권한이 별도로 필요하다. [6]

외부 샌드박스를 사용한다면 `sandbox_ref`와 소유권을 저장해 다른 워커가 연결할 수 있도록 설계한다. 샌드박스 TTL이 만료됐을 때 복구·재생성·실패 중 어떤 동작을 할지는 provider와 업무에 맞춰 정의한다. 로컬 프로세스나 열린 셸이 체크포인트와 함께 복원된다고 가정하지 않는다.

## 10. 캐시, 배포, 예산, 이벤트

### 캐시는 최적화일 뿐 원장이 아니다

프로필은 `(tenant, profile_id, revision)` 또는 검증된 content hash로 캐시한다. `profile_id`만 키로 쓰고 최신 설정을 변경 가능한 전역 객체에 덮어쓰지 않는다. 모델 클라이언트의 default headers와 자격증명을 요청마다 바꾸는 것도 피한다.

도구 목록·MCP 연결·검색 결과 캐시에도 권한 범위를 반영한다. 같은 도구 이름이라도 tenant마다 서로 다른 외부 계정에 연결될 수 있다. 모든 워커가 같은 최신 캐시를 가졌다고 가정하는 대신 실행이 요구하는 revision을 읽는다.

### Rolling deployment

프로필 revision만 같다고 재개 호환성이 확보되는 것은 아니다. 실행 템플릿, runtime build, state schema, 도구 스키마와 대기 중인 interrupt의 의미까지 확인한다. 구 버전 실행을 처리할 워커를 유지하거나, 검증된 마이그레이션·drain 정책을 사용한다.

다른 엔진으로 전환할 때도 API 표면을 유지하는 것과 기존 체크포인트를 이전하는 것은 별개의 작업이다.

### 예산

부모 모델뿐 아니라 요약·서브에이전트·도구 재시도의 비용을 같은 run에 귀속한다. 병렬 작업에는 예약 후 정산하는 중앙 예산 원장을 고려한다. 각 워커에서 사용량을 읽고 나중에 차감하기만 하면 동시에 예산을 초과할 수 있다. 사용량 보고 지연과 진행 중인 호출을 고려해 제한의 강제 수준을 명시한다.

### 스트리밍과 취소

체크포인트가 존재한다고 이전 토큰 스트림을 그대로 재생할 수 있는 것은 아니다. 스트리밍 재연결이 필요하면 run·attempt·event sequence를 포함한 이벤트 저장 계약을 설계한다. 상태 전이와 승인 이벤트는 영속화하고, 토큰 delta의 보존 여부는 별도 정책으로 둔다.

클라이언트 연결 종료와 업무 취소를 동일시하지 않는다. 명시적 취소 이후에는 새 도구 호출·자식 작업을 막되, 이미 외부에서 완료된 업무는 자동으로 되돌아간다고 보장하지 않는다.

## 11. 검증 시나리오

| 시나리오 | 확인할 불변식 |
| --- | --- |
| 한 워커에서 서로 다른 tenant·프로필 동시 실행 | 프롬프트·도구·파일·자격증명이 섞이지 않는다. |
| 같은 thread에 여러 요청 | 정의한 enqueue/reject 정책을 따르고 이력을 잃지 않는다. |
| 접수 후 응답 유실·클라이언트 재전송 | 같은 요청이 불필요한 새 run을 만들지 않는다. |
| 외부 변경 성공 직후 워커 종료 | 같은 업무 변경이 중복 수행되지 않는다. |
| lease 만료 후 이전 워커 복귀 | 오래된 writer의 상태·외부 변경이 거부된다. |
| 승인 대기 중 다른 워커로 재개 | 프로필·도구 스키마·승인 대상은 유지되고 현재 권한은 재검사한다. |
| 도구 호출 전 사용자 권한 철회 | snapshot을 보유했어도 실행을 거부한다. |
| 프로필·런타임 rolling deployment | 호환되지 않는 실행을 임의의 새 코드로 재개하지 않는다. |
| 여러 자식 작업과 재시도 | 전체 예산·동시성 제한에 포함된다. |
| 샌드박스 만료·장기 메모리 동시 갱신 | 정해진 복구·충돌 처리 정책을 따른다. |

부하 실험에서는 프로필 수, 동시 run 수, 평균·p95 실행시간, 체크포인트 크기, registry/cache 비용을 나눠 측정한다. 프로필이 몇 개까지 가능하다는 수치를 실행 환경과 측정 없이 단정하지 않는다.

## 결론

Request-scoped 프로필은 구성 중심의 에이전트를 같은 분산 런타임에 수용하기 좋은 전략이다. 다만 성립 조건은 전역 객체 변경이 아니라 **불변 실행 설정, 외부 상태, 명시적 실행 소유권, 현재 권한 검증, 멱등한 외부 작업**이다.

Deep Agents에는 실행 루프와 하네스 기능을 맡기고, 플랫폼은 이 실행 계약을 소유하도록 제안한다.

[다음: Deep Agents 구현 가이드](./deepagents-request-profile-implementation.md)

## 참고 자료

1. [Runtime — LangChain](https://docs.langchain.com/oss/python/langchain/runtime)
2. [Persistence — LangGraph](https://docs.langchain.com/oss/python/langgraph/persistence), [Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
3. [Double texting — Agent Server](https://docs.langchain.com/langsmith/double-texting)
4. [Interrupts — LangGraph](https://docs.langchain.com/oss/python/langgraph/interrupts)
5. [Backends — Deep Agents](https://docs.langchain.com/oss/python/deepagents/backends)
6. [Permissions — Deep Agents](https://docs.langchain.com/oss/python/deepagents/permissions)
7. [Making retries safe with idempotent APIs — AWS Builders' Library](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
