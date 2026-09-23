# Agentic Platform — Work Agent 런타임 설계

작성 기준일: 2026-09-23
문서 상태: 논의를 위한 1차 비전·아키텍처 초안

## 비전

> **개인이 반복하는 업무 방식을 자연어와 실제 사례로 정의하면, 회사가 신뢰하고 운영할 수 있는 AI 업무 실행체로 전환한다.**

우리의 목표는 에이전트를 많이 만드는 것이 아니다. 사람이 여러 도구를 오가며 반복하던 업무를 **호출 가능하고, 상태를 가지며, 사람과 협업하고, 완료 여부를 증명하는 실행 단위**로 만드는 것이다.

Claude Desktop은 사용자가 일을 요청하고 결과를 받는 기본 인터페이스다. 플랫폼은 Claude가 MCP로 호출할 수 있는 사내 업무 실행 계층이며, 동일 업무를 이벤트·API·메신저에서도 실행할 수 있게 한다.

## 제품 원칙

1. **Agent-first, Workflow-backed**: 에이전트를 중심에 두되, 실행 안정성은 워크플로우와 런타임이 보장한다.
2. **판단과 통제를 분리한다**: 모델은 다음 행동을 판단하고, 런타임은 허용 여부와 실행 방식을 결정한다.
3. **대화가 아니라 업무 건을 관리한다**: 세션보다 오래 지속되는 Case와 그 상태가 플랫폼의 기본 단위다.
4. **생성보다 검증이 우선이다**: 자연어로 쉽게 만드는 것보다 실제 사례에서 믿을 수 있는지가 중요하다.
5. **모든 실행은 설명·중단·재개할 수 있어야 한다**.
6. **부작용이 있는 행동은 계획, 승인, 실행, 검증을 분리한다**.
7. **모델과 채널은 교체 가능하고, 업무 정의와 이력은 회사 자산으로 남는다**.

## 에이전트만으로 AI 업무 실행 플랫폼을 만들 수 있는가?

결론은 **제품 중심 개념으로는 가능하지만, 기술 구조로는 불가능하거나 바람직하지 않다**이다.

에이전트는 다음과 같은 판단에 강하다.

- 모호한 요청의 의도 파악
- 비정형 정보의 분류·요약·대조
- 상황에 따른 다음 조사 선택
- 예외 원인의 가설 수립
- 사람에게 물어볼 내용 결정
- 여러 도구 중 적절한 도구 선택

반면 아래 책임을 에이전트의 추론에 맡기면 운영 안정성이 떨어진다.

- 정해진 시각과 이벤트에 정확히 시작하기
- 수일 동안 상태와 타이머 유지하기
- 동일 요청의 중복 실행 방지하기
- 실패한 단계만 안전하게 재시도하기
- 승인 전 쓰기 작업을 차단하기
- 권한과 금액 한도를 강제하기
- 실행 비용과 반복 횟수를 제한하기
- 담당자가 바뀌어도 이어서 처리하기
- 모든 실행 근거와 결과를 감사 가능하게 남기기

따라서 플랫폼의 구조는 다음과 같아야 한다.

> **에이전트는 판단 엔진이고, 워크플로우는 진행 규칙이며, 런타임은 업무의 생명주기를 책임진다.**

모든 단계를 ReAct 루프에 넣는 `Agent-only` 구조가 아니라, 명시적인 업무 상태 사이에 필요한 만큼의 에이전트 판단 노드를 배치한다.

```text
결정론적 단계 ──▶ 에이전트 판단 ──▶ 사람 확인 ──▶ 결정론적 실행 ──▶ 결과 검증
      │                  │               │                 │
  입력 검사          조사·분류       승인·수정        시스템 반영
```

대외적으로는 AI 업무 실행 플랫폼이라고 부를 수 있지만, 내부 아키텍처 원칙은 **Hybrid Orchestration**이 적절하다.

## 반복 가능한 개인 업무를 무엇이라고 부를 것인가?

### 권장 용어 체계

| 용어 | 의미 | 사용 위치 |
|---|---|---|
| **업무 플레이북** | 개인이 알고 있는 절차, 판단 기준, 예외 대응을 정리한 지식 | 업무 발굴·설계 단계 |
| **업무 실행 정의** | 목적, 입력·출력, 상태, 도구, 정책, 평가 기준을 담은 버전 관리 대상 | 내부 아키텍처·API |
| **업무 에이전트** | 사용자가 특정 업무를 맡기고 실행하는 제품상의 단위 | 사용자 UI·카탈로그 |
| **업무 건(Case)** | 업무 에이전트가 한 번 실행되는 실제 대상과 상태 | 런타임·운영 화면 |
| **실행(Run)** | Case 안에서 발생하는 개별 시도 또는 재개 구간 | 추적·디버깅 |

반복 가능한 개인 업무 그 자체를 기술적으로 “에이전트”라고 정의하면 애매해진다. 정해진 순서만 실행하는 업무도 있고, 아직 실행되지 않은 지식일 수도 있기 때문이다.

따라서 다음처럼 구분한다.

> **업무 플레이북이 플랫폼에서 실행 가능한 형태로 배포되면 ‘업무 에이전트’가 된다.**

제품 언어로서 업무 에이전트는 다음을 패키징한 실행 가능한 업무 단위다.

- 완수할 목적
- 받아야 할 입력과 내놓을 결과
- 사용할 지식과 도구
- 정상 절차와 판단 가능한 범위
- 사람에게 물어보거나 승인을 받을 조건
- 권한과 비용 한도
- 완료·실패·중단 조건
- 품질을 확인할 평가 사례

이 정의는 내부에 결정론적 워크플로우가 포함되어도 문제없다. 다만 기술 문서에서는 동적 판단을 하는 Agent와 고정 Workflow를 구분한다.

### 대안 명칭

- **AI 업무 실행체**: 가장 정확하지만 다소 기술적이다.
- **AI 업무 프로세스**: 이해하기 쉽지만 에이전트 차별성이 약하다.
- **Digital Worker**: 역할 중심으로 설명하기 좋지만 사람 대체 이미지를 줄 수 있다.
- **Work Agent / 업무 에이전트**: 제품 언어로 가장 무난하다.

권장안은 사용자에게는 **업무 에이전트**, 내부 모델에는 **업무 실행 정의(Work Definition)**를 사용하는 것이다.

## 현재 MCP 도구 구성과 추가로 필요한 능력

현재 준비된 Jira, Confluence, Agit, Slack, Google Workspace MCP는 협업, 문서, 커뮤니케이션의 넓은 표면을 이미 제공한다. 하지만 이들은 주로 에이전트의 **손**에 해당한다. 플랫폼에는 실행을 시작하고 기억하고 통제하는 **신경계**가 추가로 필요하다.

### 1. 업무 시스템 도구

실제 처리 업무까지 확장하려면 회사의 시스템 구성에 따라 다음 연결이 필요하다.

| 우선순위 | 도구 범주 | 필요한 이유 |
|---|---|---|
| 높음 | 사내 인증·조직도·권한 시스템 | 요청자, 담당자, 승인권자, 직무분리 판단 |
| 높음 | 데이터 웨어하우스·SQL 조회 | 문서가 아닌 사실 데이터 조회와 완료 검증 |
| 높음 | ERP·회계·구매 시스템 | 비용·정산·발주 예외의 실제 처리 |
| 높음 | HRIS | 입·퇴사, 인사변경, 조직 관련 업무 처리 |
| 중간 | CRM·고객지원 시스템 | 영업·고객 업무의 접수부터 완료까지 연결 |
| 중간 | IAM·보안 시스템 | 계정·접근권한·보안 알림의 폐루프 처리 |
| 선택 | Git·CI/CD·클라우드 운영 도구 | 개발·운영 업무를 대상에 포함할 경우 |

모든 시스템을 한꺼번에 연결할 필요는 없다. 첫 파일럿 업무의 **최종 쓰기 시스템**과 **완료 검증 시스템**을 우선 연결한다.

### 2. 범용 실행 도구

업무 시스템 MCP만으로는 처리하기 어려운 비정형 작업을 위한 공통 도구다.

- 문서 파싱, OCR, 표·첨부파일 추출
- 사내 통합 검색과 권한 인식 검색
- 안전한 코드 실행·데이터 변환 샌드박스
- 브라우저·컴퓨터 사용 도구: API가 없는 시스템에 한해 제한적으로 사용
- 구조화된 문서·보고서·스프레드시트 생성
- 이메일·Slack·Agit 승인 카드와 정보 요청 UI

브라우저 자동화는 변동성과 보안 위험이 높으므로 MCP/API가 없는 경우의 최후 수단으로 둔다.

### 3. 런타임 자체 도구

이 영역이 기존 SaaS MCP보다 더 중요하다.

- 이벤트·Webhook 수신기
- 스케줄러와 타이머
- Queue와 동시 실행 제어
- Case·Checkpoint 저장소
- Artifact 저장소
- 사용자·에이전트 Identity Broker
- Secret·OAuth Token Broker
- Policy Engine
- 사람 작업·승인 서비스
- 알림과 에스컬레이션 서비스
- 실행 Trace·Log·Metric 수집
- 비용·토큰·도구 호출 Budget 제어
- 테스트 데이터셋과 평가 실행기

MCP는 도구 호출 인터페이스이지 장기 실행, 이벤트 처리, 트랜잭션, 승인, 정책, 관측성을 자동으로 제공하지 않는다. 따라서 모든 것을 MCP 서버로만 표현하기보다, 런타임 서비스가 MCP 도구 호출 전후를 통제하도록 한다.

## 에이전트 런타임의 구체 설계

### 1. 핵심 도메인 모델

#### Work Definition

빌더가 생성하고 배포하는 불변 버전의 업무 정의다.

```yaml
id: expense-exception-agent
version: 12
owner: finance-ops
goal: 비용 증빙 예외를 확인하고 처리한다
input_schema: ExpenseCase
output_schema: ResolutionResult
triggers:
  - manual
  - event: expense.flagged
state_schema: ExpenseCaseState
flow:
  - validate_input
  - gather_evidence
  - agent_investigation
  - policy_decision
  - human_approval_if_needed
  - apply_resolution
  - verify_result
tools:
  allow: [jira.read, gdrive.read, erp.expense.read, erp.expense.update]
policies:
  - approval_required_if_amount_over: 1000000
  - never_modify_vendor_bank_account: true
budgets:
  max_agent_turns: 12
  max_cost: 5.00
  timeout: 7d
tests:
  dataset: expense-exception-v4
```

#### Case

하나의 실제 업무 건이다. Case는 대화 세션과 독립적으로 존재하며 다음을 가진다.

- 요청자, 소유 팀, 현재 담당자
- Work Definition ID와 고정 버전
- 입력과 누적된 업무 상태
- 현재 단계와 대기 이유
- 타이머와 SLA
- 승인·결정·도구 호출 이력
- 생성된 산출물
- 최종 완료·실패 근거

#### Run과 Step

- Run은 Case가 시작되거나 재개된 한 번의 실행 구간이다.
- Step은 재시도와 체크포인트의 최소 단위다.
- 각 Step에는 입력, 출력, 사용 모델, 도구 호출, 비용, 지연, 정책 판단을 기록한다.

### 2. 런타임 구성요소

```text
                         ┌──────────────────────┐
Claude / Slack / API ──▶ │ Invocation Gateway   │
업무 시스템 Event ─────▶ │ Auth · Rate · Schema │
                         └──────────┬───────────┘
                                    ▼
                         ┌──────────────────────┐
                         │ Durable Orchestrator │
                         │ State · Timer · Retry│
                         └──────┬─────┬─────┬───┘
                                │     │     │
                   ┌────────────┘     │     └────────────┐
                   ▼                  ▼                  ▼
            Agent Executor      Human Task       Deterministic Worker
          Model · Sandbox      Approval · Input      API · Transform
                   │                  │                  │
                   └────────────┬─────┴──────────────────┘
                                ▼
                       Tool & Policy Gateway
                   MCP · Token · Scope · Side Effect
                                │
             Jira · Confluence · Slack · Google · ERP · HRIS

Control Plane
Registry · Version · Ownership · Evaluation · Trace · Cost · Audit
```

#### Invocation Gateway

- Claude Desktop용 MCP 인터페이스와 일반 API를 함께 제공한다.
- `list_work_agents`, `start_case`, `get_case`, `provide_input`, `approve`, `cancel`을 기본 명령으로 제공한다.
- 입력 스키마 검증, 인증, 호출 제한, 중복 요청 키를 처리한다.

#### Durable Orchestrator

- 명시적인 상태 전이, 체크포인트, 타이머, 이벤트 대기, 재시도를 담당한다.
- 프로세스가 재배포되거나 서버가 재시작되어도 Case를 이어간다.
- 에이전트의 생각 루프를 장기 실행 엔진으로 사용하지 않는다.
- 초기 MVP는 LangGraph + 영속 Checkpointer + Worker Queue로 시작할 수 있다.
- 수일 이상의 타이머, 많은 외부 이벤트, 강한 전달 보장이 핵심이 되면 Durable Workflow Engine을 외부 오케스트레이터로 두고 LangGraph를 판단용 하위 실행기로 사용한다.

#### Agent Executor

- 제한된 목적과 도구를 가진 에이전트 노드를 실행한다.
- 노드마다 모델, 시스템 지침, 최대 Turn, 도구 Allowlist, 비용을 지정한다.
- 코드 실행이나 파일 작업은 Case별 격리 샌드박스에서 수행한다.
- 원문 전체보다 필요한 상태와 Artifact 참조만 전달해 컨텍스트를 통제한다.
- 에이전트 결과는 자유 텍스트가 아니라 구조화된 판단과 근거로 반환한다.

#### Tool & Policy Gateway

- 에이전트가 MCP 서버를 직접 호출하지 않고 Gateway를 거치게 한다.
- 사용자 위임 권한과 에이전트 고유 권한을 구분한다.
- 도구 호출 전에 정책, 데이터 범위, 승인 상태, 예산을 검사한다.
- 쓰기 작업에는 Idempotency Key를 부여하고 결과를 Side-effect Ledger에 남긴다.
- 고위험 작업은 `Plan → Approve → Execute → Verify` 단계로 분리한다.
- Token과 Secret은 실행 시점에 짧은 수명으로 발급하고 모델 컨텍스트에 노출하지 않는다.

#### Human Task Service

- 승인뿐 아니라 정보 요청, 결과 수정, 담당자 이관을 지원한다.
- Slack·Agit·Claude Desktop 등 사용자가 있는 채널로 요청을 보낸다.
- 승인 대상, 근거, 예상 부작용을 함께 보여준다.
- 기한, 대리 승인자, Reminder, Escalation을 관리한다.
- 답변이 오면 Case Event로 전달해 정확한 지점부터 재개한다.

#### State & Artifact Store

- 관계형 저장소에는 Case 상태, 단계, 정책·승인 이력을 저장한다.
- 객체 저장소에는 원문 문서, 생성 파일, 대용량 도구 결과를 저장한다.
- 모델 컨텍스트는 저장된 전체 이력이 아니라 현재 단계에 필요한 View로 다시 구성한다.
- 장기 기억은 자유로운 메모리가 아니라 출처·권한·유효기간이 있는 업무 사실로 관리한다.

#### Observability & Evaluation

- Case 성공률과 Step별 오류·지연·비용을 추적한다.
- 모델 입력·출력, 도구 호출, 정책 판단, 승인 이력을 하나의 Trace로 연결한다.
- 실제 실패 Case를 회귀 테스트 데이터셋으로 승격한다.
- 새 버전은 구조 검증, 정책 검사, 사례 평가를 통과해야 배포할 수 있다.
- 운영 중 품질 저하가 감지되면 자동 실행 비율을 낮추거나 승인 모드로 전환한다.

### 3. 실행 상태 모델

모든 업무 에이전트는 최소한 다음 공통 상태를 사용한다.

```text
RECEIVED
   ↓
VALIDATING ──실패──▶ NEEDS_INPUT
   ↓                    │
RUNNING ◀───────────────┘
   ├──▶ WAITING_EVENT
   ├──▶ WAITING_HUMAN
   ├──▶ RETRY_SCHEDULED
   ├──▶ ESCALATED
   ├──▶ FAILED
   ↓
VERIFYING ──불일치──▶ RUNNING 또는 ESCALATED
   ↓
COMPLETED
```

업무별 세부 상태는 이 공통 상태 아래에 둔다. “모델이 답변을 생성했다”는 완료가 아니다. 정의된 시스템 상태가 실제로 반영됐거나 승인된 산출물이 생성됐음을 검증해야 `COMPLETED`가 된다.

### 4. 오류와 부작용 처리

| 오류 유형 | 처리 방식 |
|---|---|
| 일시적 네트워크·Rate Limit | 지수 Backoff 후 자동 재시도 |
| 도구 입력·파싱 오류 | 제한된 횟수 안에서 에이전트가 수정 |
| 필수 정보 부족 | `WAITING_HUMAN`으로 전환해 정보 요청 |
| 정책·권한 위반 | 실행 차단 후 감사 이벤트 기록 |
| 쓰기 결과 불일치 | 재조회·검증 후 보상 작업 또는 사람 이관 |
| 모델 반복·비용 초과 | Circuit Breaker로 중단하고 사람 이관 |
| 예상하지 못한 오류 | Case 상태 보존 후 운영 Queue로 전달 |

외부 시스템 쓰기는 정확히 한 번을 가정하지 않는다. 중복 호출에 안전하도록 Idempotency Key, 실행 전후 상태 비교, Side-effect Ledger, 가능한 경우 보상 작업을 사용한다.

### 5. 에이전트 권한 모델

한 종류의 인증으로 모든 업무를 처리하지 않는다.

- **On-behalf-of-user**: 사용자가 가진 권한 안에서 조회·실행한다.
- **Workload identity**: 조직이 승인한 백그라운드 업무를 에이전트 자체 ID로 수행한다.
- **Delegated approval**: 사용자에게 권한이 있어도 특정 행동에는 별도 승인 증거가 필요하다.
- **Ephemeral capability**: 한 Case와 한 도구·행동에만 유효한 단기 권한을 발급한다.

정책은 “Slack 쓰기 허용” 수준을 넘어 `누가`, `어떤 업무 건에서`, `어떤 데이터에`, `어떤 금액·범위까지`, `누구의 승인 후` 실행할 수 있는지를 판단해야 한다.

## Builder가 생성해야 하는 것

자연어 빌더의 출력은 프롬프트가 아니라 **배포 가능한 Work Definition 패키지**다.

- 입력·출력 Schema
- 상태와 전이
- 결정론적 Step과 Agent Step
- 도구별 최소 권한
- 사람 개입 조건
- Retry·Timeout·Escalation·Compensation
- 완료 검증기
- 예산과 실행 한도
- 대표 성공·실패·경계 테스트
- Owner와 운영 Runbook

빌더는 사용자에게 다음 질문을 순차적으로 던져야 한다.

1. 어떤 사건이나 요청으로 업무가 시작되는가?
2. 완료됐다는 것을 어느 시스템에서 확인할 수 있는가?
3. 항상 같은 절차와 상황별 판단을 구분하면 무엇인가?
4. 실패하거나 정보가 없을 때 누구에게 무엇을 물어보는가?
5. 어떤 행동은 반드시 사람의 승인이 필요한가?
6. 과거의 성공·실패 사례를 제공할 수 있는가?

그래프 편집기는 이 정의를 검토·수정하는 고급 화면이며, 주된 생성 경험은 자연어 인터뷰와 사례 기반 시뮬레이션이다.

## MVP 범위

### 포함

- 1~2개의 예외 처리 템플릿
- Claude Desktop용 MCP 호출 인터페이스
- 수동·Webhook·스케줄 Trigger
- Case 상태와 체크포인트
- 결정론적 Step + 제한된 Agent Step
- Slack 또는 Agit 기반 정보 요청·승인
- Tool Gateway와 읽기·쓰기 권한 구분
- 재시도, 타임아웃, 중단·재개
- 실행 Trace와 운영 화면
- 과거 사례 기반 배포 전 평가

### 제외

- 빈 화면에서 임의의 멀티에이전트 조직 설계
- 에이전트끼리 자유롭게 새 에이전트를 생성하는 구조
- 범용 장기 기억
- 모든 사내 시스템의 선제적 연결
- 승인 없는 고위험 쓰기
- 브라우저 자동화를 기본 실행 방식으로 사용

## 성공 조건

첫 파일럿에서 다음을 입증해야 한다.

1. 동일 Work Definition을 여러 사용자가 재사용한다.
2. 한 세션을 넘어 대기·재개되는 Case가 안정적으로 완료된다.
3. 사람의 실제 처리 시간이 기존 대비 감소한다.
4. 실패한 실행을 처음부터 다시 하지 않고 안전하게 복구한다.
5. 어떤 판단과 행동이 왜 이루어졌는지 운영자가 재구성할 수 있다.
6. 같은 런타임 패턴을 두 번째 부서 업무에 재사용할 수 있다.

## 최종 포지셔닝

> **Work Agent 영역은 개인의 업무 플레이북을 조직이 운영할 수 있는 업무 에이전트로 전환하고, 에이전트·워크플로우·사람·도구가 하나의 업무 건을 끝까지 완수하도록 실행과 통제를 제공한다.**

짧게 표현하면:

> **개인의 일하는 방식을, 회사가 운영할 수 있는 AI 업무로.**

## 참고 자료

- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic: Scaling Managed Agents](https://www.anthropic.com/engineering/managed-agents)
- [LangGraph: 상태·체크포인트·사람 개입 설계](https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph)
- [LangSmith: Agent Server 데이터 계층](https://docs.langchain.com/langsmith/data-plane)
- [LangSmith: 오프라인·온라인 평가](https://docs.langchain.com/langsmith/evaluation-types)
- [AWS: AgentCore Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html)
- [AWS: AgentCore Gateway 정책·권한·관측성](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-http-runtime.html)
