# Agentic Work Platform 6주 로드맵

문서 상태: 협업용 2차 초안
작성 기준일: 2026-09-23
대상 기간: 착수일부터 6주

> 이 문서는 6주 안에 범용 플랫폼 전체를 완성하는 계획이 아니다. **CCAB로 비개발자가 에이전트를 만들고, Agent Stage Runner에서 코드를 실행·검증한 뒤, 전사 주간보고 취합 에이전트를 실제로 운영하는 수직 슬라이스**를 완성하는 계획이다.

## 1. 배경과 Agentic Work Platform의 정의·비전

### 1.1 현재 상황

회사는 Claude Desktop과 Claude Code를 범용 AI 업무 인터페이스로 사용한다. Jira, Confluence, Agit, Slack, Google Workspace 등 기존 업무 솔루션은 MCP로 연결할 수 있다.

에이전트 제작에는 이미 **CCAB**라는 Claude Code Plugin이 존재한다. CCAB는 Tool Gateway에 등록된 대고객 API와 연동 도구를 이용해 에이전트를 만드는 Skill 기반 워크플로우다.

Tool Gateway도 이미 존재한다. API Spec을 계약으로 등록하고 실제 API를 연동하면, 에이전트가 사용할 수 있는 MCP Proxy 표면을 제공한다.

사내에는 이외에도 다음 업무 자동화·에이전트 제작 환경이 존재한다.

- **n8n**: 여러 시스템의 Trigger와 Action을 연결하고, 정해진 흐름을 시각적으로 자동화하는 Workflow 플랫폼이다. AI Agent, MCP, Human-in-the-loop 같은 기능도 활용할 수 있다.
- **Lobby**: 사내 지식과 MCP를 이용해 간단한 에이전트를 만들 수 있는 웹 기반 Builder다. 빠르게 만들고 사용할 수 있지만 웹 환경과 제공된 구성 범위 안에서 동작한다.

따라서 Agentic Work Platform의 필요성을 “사내에 에이전트 Builder가 없기 때문”이라고 설명할 수 없다. 핵심 질문은 **기존 도구로 해결되지 않는 어떤 구간을 추가 플랫폼이 담당하는가**다.

### 1.2 기존 도구와 역할 경계

| 구분 | 가장 적합한 업무 | 강점 | 이번 플랫폼이 보완할 지점 |
|---|---|---|---|
| **Lobby** | 지식 조회, 단순 질의응답, 제공된 MCP를 사용하는 간단한 에이전트 | 웹에서 빠르게 구성·사용 | 임의 코드·의존성·테스트가 필요한 에이전트의 Build·검증·Release |
| **n8n** | 이벤트와 시스템을 정해진 순서로 연결하는 업무 자동화 | Trigger·Action·분기·연동·운영 가시성 | CCAB가 생성한 코드형 에이전트 프로젝트의 격리 실행과 공통 라이프사이클 |
| **CCAB** | 자연어와 Skill Workflow를 이용한 코드형 에이전트 생성 | 복잡한 로직과 확장 가능한 Agent Project 생성 | 비개발자가 사용할 원격 실행환경, 평가, Release, 운영 연결 |
| **Agentic Work Platform** | 코드·도구·평가가 필요한 에이전트를 조직 자산으로 완성·운영 | Build·Validation·Lifecycle·Runtime 표준화 | Lobby·n8n을 대체하지 않고 복잡한 에이전트의 공통 기반 제공 |

업무 유형에 따른 기본 선택 원칙은 다음과 같다.

```text
지식 조회·간단한 MCP Agent                  → Lobby
정해진 Trigger·분기·시스템 Action           → n8n
코드·의존성·반복 평가가 필요한 Agent        → CCAB + Agent Stage Runner
정기 실행·외부 Event 연결                    → n8n이 배포된 Agent를 호출할 수 있음
공통 Tool·Release·권한·평가                  → Agentic Work Platform
```

Agentic Work Platform은 세 번째 범용 Builder를 추가하는 것이 아니다. Lobby와 n8n으로 해결되는 업무는 기존 도구를 계속 사용한다. 새 플랫폼은 **CCAB의 높은 표현력과 조직 운영에 필요한 통제 사이의 공백**을 담당한다.

### 1.3 기존 환경에 남은 공백

현재 남은 핵심 공백은 다음과 같다.

- CCAB가 생성한 에이전트 코드를 비개발자가 안전하게 실행·검증할 공통 환경이 없다.
- 모든 비개발자에게 GitHub 계정, 로컬 개발환경, 저장소 권한을 제공하기 어렵다.
- 에이전트 생성 과정의 코드, 의존성, 시험 결과, Release 후보를 플랫폼이 일관되게 관리하지 않는다.
- Draft부터 검증, 배포, 활성화, 중지, 폐기까지 이어지는 에이전트 라이프사이클이 없다.
- 한 번 만든 에이전트를 실제 반복 업무에서 검증하고 운영 품질을 측정하는 기준이 부족하다.
- Lobby의 구성 범위를 넘어선 에이전트와 n8n Workflow 안에 넣기 어려운 코드형 에이전트를 위한 공통 승격 경로가 없다.
- Lobby·n8n·CCAB에서 만들어진 실행 자산을 동일한 Tool·평가·Release 기준으로 관리하기 어렵다.

### 1.4 플랫폼 정의

> **Agentic Work Platform은 조직의 일하는 방식을 에이전트로 담아내고, 사용자가 어떤 채널에 있든 안전하게 호출하고 실행할 수 있도록 제공하는 AI 업무 실행 기반이다.**

에이전트는 사용자에게 보이는 표면이다. 그 안에는 단순한 Prompt가 아니라 업무의 목표, 절차, 판단 기준, 사용할 도구, 사람의 승인 조건과 결과 형식이 담긴다. 에이전트를 만든다는 것은 하나의 챗봇이 아니라 **반복 가능한 Workflow와 일하는 방식을 실행 가능한 형태로 만드는 것**이다.

동일한 에이전트를 특정 웹 화면에 가두지 않고 Claude Desktop, Web, Slack 등 사용자가 실제로 일하는 환경에 공급한다. 초기에는 Claude Desktop을 첫 번째 채널로 삼고 이후 다른 채널로 확장한다.

어떤 채널에서 호출되더라도 사용자와 에이전트의 신원, 허용된 도구와 데이터 범위, 실행 한도, 사람의 승인 조건을 동일하게 적용한다. 이를 통해 에이전트의 사용 채널을 넓히면서도 회사 시스템에 대한 권한은 안전하게 관리한다.

### 1.5 비전

> **개인의 일하는 방식을, 회사가 운영할 수 있는 AI 업무로.**

6주 동안은 CCAB로 만든 에이전트를 안전하게 실행·검증하고, 라이프사이클과 Tool 권한을 적용해 Claude Desktop에서 사용할 수 있게 한다. 이후 동일한 에이전트를 Web과 Slack으로 확장해 **사용자가 플랫폼을 찾아가는 것이 아니라 에이전트가 사용자가 일하는 채널로 찾아가는 환경**을 지향한다.

### 1.6 6주 검증 가설

1. 비개발자가 GitHub 계정이나 로컬 개발환경 없이 CCAB로 에이전트를 만들 수 있다.
2. CCAB가 생성한 코드를 Agent Stage Runner에서 실행하고 오류를 다시 CCAB에 전달해 수정할 수 있다.
3. Tool Gateway에 등록된 Agit·Jira 도구만 사용하도록 실행 환경을 제한할 수 있다.
4. 검증된 에이전트만 Release로 등록하고 파일럿 실행에 사용할 수 있다.
5. 주간보고 취합 업무에서 Agit의 기존 보고와 Jira 업무 이력을 근거로 전사 보고서 초안을 만들 수 있다.
6. 빌드 과정, 시험 결과, Release, 실제 실행 결과를 하나의 라이프사이클로 추적할 수 있다.
7. 같은 파일럿을 n8n·Lobby 관점에서도 검토해 추가 플랫폼이 필요한 복잡도와 경계를 설명할 수 있다.

## 2. 기능 요구사항

### 2.1 우선순위

| 우선순위 | 의미 |
|---|---|
| **P0** | 6주 파일럿의 에이전트 생성·검증·배포·실행에 반드시 필요 |
| **P1** | 수동 우회가 가능하지만 안정성과 재사용성을 높이는 기능 |
| **P2** | 플랫폼 확장 단계의 기능. 6주 동안 구조적 확장 가능성만 보존 |

### 2.2 컴포넌트 구조

```text
비개발자
   │ 자연어로 업무 설명·수정
   ▼
CCAB: Claude Code Plugin
   │ Agent Project 생성·수정·검증 요청
   ▼
Agent Lifecycle API ────────────── Agent Registry
   │                                  │
   │ Build / Validate Job             │ Definition / Release / Deployment
   ▼                                  │
Agent Stage Runner                    │
Ephemeral Workspace · Code Run · Test │
   │                                  │
   ├──────── Tool Gateway ────────────┤
   │          MCP Proxy               │
   │          Agit · Jira             │
   ▼                                  ▼
Build Log · Test Result · Artifact   Pilot Agent Runtime
                                      │
                                      ▼
                              주간보고 수집·초안·게시
```

`Agent Stage Runner`와 실제 배포된 에이전트를 반복 실행하는 `Pilot Agent Runtime`은 책임이 다르다. 6주에는 공통 기술을 재사용할 수 있지만 논리적으로 분리한다.

- **Agent Stage Runner**: 빌드 중인 코드를 안전하게 실행·검증하고 Release 후보를 만든다.
- **Pilot Agent Runtime**: 검증된 Release를 사용해 주간보고 업무를 실행한다.

### 2.3 Tool Gateway

#### 현재 상태

- API Spec을 계약으로 등록한다.
- 실제 API 연동 설정을 가진다.
- 등록 API를 MCP Tool로 Proxy 호출할 수 있는 표면을 제공한다.

#### P0

- CCAB와 Agent Stage Runner가 등록 도구의 이름, 설명, 입력 Schema를 조회할 수 있다.
- 주간보고 파일럿에 필요한 Agit 조회·게시 API와 Jira 조회 API를 등록한다.
- Stage Runner의 시험 호출과 Pilot Runtime의 운영 호출을 환경·자격증명으로 구분한다.
- Tool 호출에 Agent Build·Release·Run 식별자를 전달하고 기본 감사 로그를 남긴다.
- 입력 Schema 검증, Timeout, 오류 형식 표준화를 적용한다.
- 쓰기 도구인 Agit 게시에는 중복 요청을 식별할 수 있는 Key 또는 결과 조회 방법을 둔다.
- 원본 자격증명은 CCAB가 생성한 코드와 모델 Context에 노출하지 않는다.

#### P1

- 도구별 읽기·쓰기·위험 등급과 사용 가능 환경을 관리한다.
- Agent Release별 Tool Allowlist를 적용한다.
- Rate Limit, Retry, Circuit Breaker와 Tool 상태 지표를 제공한다.
- Agit 게시 전 사람 검토·승인 정보를 확인한다.

#### P2

- 사용자·조직·자원 범위 기반 세부 권한 정책
- 단기 Capability Token과 Agent Workload Identity
- Tool Spec 버전 변경의 Agent 영향도 검사
- 브라우저·Computer Use와 비 API 도구의 격리 실행

### 2.4 Agent Stage Runner

#### 정의

> **Agent Stage Runner는 CCAB가 생성·수정한 에이전트 프로젝트를 플랫폼이 관리하는 격리 환경에서 실행하고 검증하는 원격 런타임 호스트다.**

여기서 `Stage`는 업무 Workflow의 개별 단계를 의미하지 않는다. 에이전트가 정식 Release가 되기 전의 **Staging·Build·Validation 단계**를 의미한다.

사용자가 GitHub 계정이나 로컬 개발환경을 갖지 않아도 다음 과정을 수행하게 하는 것이 목적이다.

```text
CCAB가 Agent Project 생성
  → 원격 Workspace 생성
  → 코드·설정 업로드
  → 의존성 설치
  → 정적 검증
  → 에이전트 실행
  → Tool 계약 시험
  → 평가 Case 실행
  → Log·오류를 CCAB에 반환
  → CCAB가 수정 후 재검증
  → 통과한 Artifact를 Release 후보로 제출
```

#### P0

- Build Job 생성·조회·취소 API
- Job별 격리된 임시 Workspace와 실행 환경
- 표준 Agent Project Template과 허용된 Runtime·의존성
- CCAB에서 코드·설정·테스트 입력을 전달하는 계약
- 의존성 설치, 정적 검사, Unit Test, Agent 실행 명령
- Tool Gateway의 개발·시험 MCP 연결 주입
- CPU, Memory, 실행 시간, 네트워크, 출력 크기 제한
- Secret을 Workspace 파일이나 Build Log에 남기지 않음
- stdout, stderr, 구조화된 Build Step 결과 반환
- Build Log와 Test Result를 CCAB가 읽을 수 있는 형태로 제공
- 성공한 Source Snapshot, Dependency Lock, Artifact Digest 저장
- 동일 입력 Build의 추적 가능한 Build ID와 재실행
- Workspace 만료와 정리

#### P1

- 실패 로그를 구조화해 CCAB의 자동 수정 루프에 전달
- 과거 평가 Case의 병렬 실행
- Build Cache와 의존성 Cache
- Artifact·Report 다운로드
- Webhook 또는 Stream 방식의 실시간 진행 상태
- 개발자가 문제를 재현할 수 있는 제한된 Debug Session

#### P2

- 여러 언어·Framework Runtime
- 장시간 성능·부하 시험
- 보안 취약점·라이선스·Dependency 검사
- 여러 Agent와 Sub-agent 통합 시험
- Build Farm Autoscaling과 조직별 실행 Quota

### 2.5 CCAB Claude Code Plugin

#### 현재 상태

CCAB는 이미 등록·연동된 대고객용 API를 이용해 에이전트를 생성하는 Skill Workflow를 제공한다.

#### 6주 개발 방향

CCAB의 생성 경험을 새로 만드는 대신, 기존 Workflow에 **원격 Workspace, 실행·검증, 라이프사이클 등록**을 연결한다.

#### P0

- Tool Gateway에서 사용 가능한 Tool 탐색과 선택
- 표준 Agent Project Template 기반 코드·설정 생성
- Agent Lifecycle API를 통한 Draft Agent 생성
- Agent Stage Runner Workspace와 Build Job 생성
- 생성 코드를 Runner로 전송하고 Build·Test 실행
- 실행 Log와 오류를 사용자에게 설명
- 수정된 코드를 같은 Draft Version에서 재검증
- 평가 Case 입력과 기대 결과 등록
- 검증 통과 후 Release 후보 제출
- Agent·Build·Release 상태 조회
- 사용자가 GitHub 계정이나 직접 저장소 접근 없이 전체 과정을 완료

#### P1

- 실패 원인에 따른 자동 수정 제안과 재실행
- 이전 Build와 코드·설정·평가 결과 Diff
- Tool 추가 시 필요한 권한과 영향 설명
- 운영 Run 결과를 새로운 평가 Case로 가져오기

#### P2

- 시각적 Workflow·Graph 편집
- 여러 Agent 조합과 Template 추천
- 조직 Agent Catalog에서 Fork·재사용

### 2.6 에이전트 라이프사이클

에이전트의 Source·Build·Release·Deployment를 구분한다.

```text
DRAFT
  → BUILDING
  → VALIDATING
  → READY
  → ACTIVE
  → PAUSED
  → RETIRED

BUILDING / VALIDATING 실패 → DRAFT로 복귀해 수정
READY 이후 변경 → 기존 Release 수정이 아니라 새 Draft Version 생성
```

#### P0

- Agent Definition, Draft Version, Build, Evaluation, Release, Deployment 모델
- Owner, 목적, 입력·출력, Tool Allowlist, 실행 한도 등록
- 상태 전이와 전이 가능 권한 검증
- Build와 Validation 통과 전 READY·ACTIVE 전환 차단
- Release에 Source Snapshot, Artifact Digest, Dependency Lock, Tool Spec Version, 평가 결과 고정
- ACTIVE Release 하나를 Pilot Runtime 실행에 사용
- Release 변경 이력과 생성·검증·활성화 주체 감사 기록
- 이전 Release로 수동 Rollback
- PAUSED Agent의 신규 실행 차단
- GitHub 계정 대신 플랫폼 관리 저장소 또는 Artifact Store에 Source Version 보존

#### P1

- Release 활성화 승인 Workflow
- 변경 Diff와 Tool 계약 영향도 표시
- 일부 사용자·Run만 신규 Release를 사용하는 Canary
- 운영 품질 기준 미달 시 자동 실행 제한

#### P2

- 개발·검증·운영 환경 분리
- 조직 Agent Catalog와 Template Marketplace
- Git 저장소가 필요한 개발자를 위한 선택적 Repository 연동

### 2.7 Pilot Agent Runtime

6주 파일럿에는 READY·ACTIVE Release를 실제 업무로 실행할 최소 런타임이 필요하다. Agent Stage Runner를 운영 런타임으로 그대로 사용하지 않는다.

#### P0

- ACTIVE Release를 고정해 Run 시작
- 수동 실행과 주 1회 Schedule
- Run 상태, Log, 결과 저장
- Tool Gateway를 통한 Agit·Jira 호출
- 제한된 재시도와 Run 취소
- 최종 게시 전 사람 검토
- 게시 결과 재조회 또는 결과 ID 저장
- 실패 시 운영자가 원인과 재실행 가능 여부 확인

#### P1

- 중단 지점 Checkpoint와 부분 재개
- 검토 요청·승인 후 자동 재개
- SLA, Reminder, Escalation

#### P2

- 이벤트 Trigger와 여러 업무 에이전트 실행
- 장기 Case, Human Task, 보상 Workflow
- 전용 Durable Workflow Engine

### 2.8 관측·평가·Artifact

#### P0

- Agent, Draft, Build, Release, Run을 연결하는 식별자 체계
- Build Log, Test Result, Evaluation Result, Source Snapshot, Release Artifact 저장
- 운영 Run의 Model·Tool 호출과 오류 기록
- 과거 주간보고를 사용한 평가 Dataset
- 필수 Section, Source Coverage, Evidence Link, 형식 검증
- Release별 평가 결과 비교

#### P1

- Token·모델·Tool 비용과 실행 시간 Dashboard
- 담당자의 수정 유형과 품질 Feedback
- 운영 실패 사례를 평가 Dataset으로 전환

#### P2

- 운영 중 Online Evaluation과 품질 Alert
- Agent·조직별 비용 Quota와 Chargeback

## 3. 파일럿 에이전트: 전사 주간보고 취합

### 3.1 현재 업무

- 조직별 주간보고는 주로 Agit에 작성된다.
- 실제 업무 진행 이력과 세부 맥락은 Jira Issue와 변경 이력에서 확인할 수 있다.
- 담당자는 Agit 보고 내용을 모으고, Jira를 통해 근거와 진행 상황을 보완해 전사 보고서로 취합한다.

### 3.2 기존 도구 대비 파일럿의 검증 목적

주간보고 취합 자체는 n8n Workflow나 Lobby Agent로 일부 구현할 수 있다. 따라서 단순히 보고서 한 개를 생성하는 것은 Agentic Work Platform의 필요성을 증명하지 못한다.

파일럿은 다음 차이를 함께 검증해야 한다.

- Lobby에서 구성 가능한 단순 지식·MCP Agent 범위를 어디서 넘어서는가?
- n8n의 고정 Workflow로 충분한 단계와 코드형 Agent가 필요한 단계를 어떻게 구분하는가?
- CCAB가 생성한 Agent Project를 비개발자가 직접 Build·수정·평가할 수 있는가?
- 같은 Agent Release를 n8n Schedule이나 다른 채널에서도 호출할 수 있는가?
- Build·평가·Release·운영 Run을 연결함으로써 어떤 추가 운영 가치가 생기는가?

권장 구성은 n8n과 경쟁하는 것이 아니라 역할을 나누는 것이다.

```text
n8n: 매주 Trigger 및 실행 요청
  → Agentic Work Platform: 검증된 주간보고 Agent Release 실행
      → Tool Gateway: Agit·Jira 호출
  ← 구조화된 보고서와 Evidence 반환
n8n 또는 담당자: 검토·게시 후속 절차
```

6주 안에 n8n·Lobby만으로도 동일한 품질·수정 가능성·라이프사이클을 더 낮은 비용으로 충족한다면, 새 플랫폼의 범위를 줄이거나 중단하는 판단 근거로 사용한다.

### 3.3 P0 처리 흐름

```text
보고 기간과 대상 조직 확정
  → Agit에서 조직별 주간보고 수집
  → 작성자·조직·기간·원문 Link 정규화
  → 보고 내용에서 Jira Issue Key 추출
  → Jira에서 상태·변경·담당·주요 Comment 조회
  → Agit 보고와 Jira 이력 대조
  → 누락·중복·상충·근거 부족 항목 표시
  → 조직별 핵심 진행·완료·이슈·다음 계획 요약
  → 원문 Agit·Jira Evidence Link 연결
  → 전사 주간보고 초안 생성
  → 담당자 검토
  → Agit에 최종 게시
  → 게시 결과 ID 저장 후 완료
```

### 3.4 P0 제한

- 대상 Agit Group·게시판과 Jira Project를 사전에 지정한다.
- 모든 Agit·Jira 데이터를 자유 검색하지 않고 등록된 Scope만 사용한다.
- Jira에서 확인되지 않는 서술은 삭제하지 않고 “근거 확인 필요”로 표시한다.
- 성과 평가와 우선순위 판단은 하지 않는다.
- 최종 Agit 게시 전 사람 검토를 필수로 한다.
- 자동 독촉과 개별 조직에 대한 수정 요청은 P1 이후로 둔다.

### 3.5 파일럿 완료 기준

- 비개발자가 CCAB에서 주간보고 에이전트 Draft를 만들고 Runner에서 검증한다.
- 사용자는 GitHub 계정이나 로컬 Runtime 없이 Build·Test 결과를 확인한다.
- 과거 주차 입력으로 Agit 보고와 Jira 이력이 연결된 초안을 생성한다.
- 각 핵심 항목에서 Agit 또는 Jira 원문 근거를 확인할 수 있다.
- 등록되지 않은 Tool과 Resource Scope 접근은 실패한다.
- 검증을 통과한 Release만 파일럿 Runtime에서 실행한다.
- 같은 Run을 재시도해도 Agit 게시물이 중복 생성되지 않는다.
- 최소 한 번의 실제 운영 리허설과 담당자 검토를 완료한다.
- n8n·Lobby로 구현할 수 있는 범위와 Agentic Work Platform이 추가로 제공한 범위를 비교한다.

## 4. 기대효과

### 4.1 사용자 가치

- GitHub 계정과 개발환경 없이 자연어로 에이전트를 만들고 시험할 수 있다.
- 실행 오류를 Plugin 안에서 확인하고 수정·재검증할 수 있다.
- Agit 보고 수집과 Jira 근거 확인에 쓰는 반복 시간을 줄인다.
- 생성된 주간보고를 원문 근거와 함께 검토할 수 있다.

### 4.2 조직 가치

- 개인이 만든 에이전트를 Source·Build·평가·Release가 연결된 조직 자산으로 관리한다.
- 검증되지 않은 코드가 운영 Tool과 자격증명을 직접 사용하지 못하게 한다.
- 에이전트마다 개발환경과 Tool 연결을 새로 만드는 비용을 줄인다.
- 두 번째 에이전트는 CCAB, Stage Runner, Tool Gateway, Lifecycle을 재사용한다.
- Lobby는 간단한 Agent, n8n은 Workflow, CCAB는 코드형 Agent라는 도구 선택 기준을 마련해 중복 구축을 줄인다.

### 4.3 측정 지표

| 구분 | 지표 |
|---|---|
| Builder | Draft 생성부터 검증 통과까지 걸린 시간, Build 재시도 횟수 |
| 접근성 | GitHub·로컬 개발환경 없이 완료한 사용자 비율 |
| Runner | Build 성공률, 평균 대기·실행 시간, Workspace 정리 실패 |
| 품질 | Agit Source Coverage, Jira Evidence Coverage, 담당자 수정 유형 |
| 운영 | 완료 Run 비율, 중복 게시, 실패 복구 시간 |
| 효율 | 기존 수작업 대비 Human Touch Time, 완료 보고서당 비용 |

목표값은 1주차 Baseline과 과거 보고서 Replay 결과를 확인한 뒤 확정한다.

## 5. 최우선순위 로드맵: 6주

### 1주차 — 계약과 파일럿 범위 확정

- 기존 CCAB Workflow와 Plugin 확장 지점 분석
- Tool Gateway의 현재 API·MCP 계약과 인증 방식 확인
- Agit 대상 Group·게시판, Jira Project, 보고 형식 확정
- 과거 주간보고와 연결된 Jira Issue로 평가 Dataset 구성
- 현재 n8n·Lobby로 구현 가능한 범위와 제약을 동일 업무 기준으로 확인
- Agent Project Template과 Build 명령 확정
- Agent Definition, Build Job, Release, Deployment API 계약 확정
- Stage Runner의 Sandbox·Network·Secret 보안 기준 확정

**종료 조건**

- CCAB에서 Runner까지의 Sequence와 API가 리뷰됐다.
- 하나의 과거 주차에 대해 Agit·Jira 입력과 기대 보고서가 준비됐다.
- P0 Runtime, 언어, Framework, 의존성 정책이 확정됐다.
- n8n·Lobby 대비 비교할 성공 기준이 합의됐다.

### 2주차 — Agent Stage Runner 최소 실행 환경

- Build Job 생성·조회·취소 API
- Job별 임시 Workspace와 격리 실행
- Agent Template 실행, 의존성 설치, Test 명령
- CPU·Memory·Timeout·Network 제한
- Build Log·Step Result·Artifact 저장
- Tool Gateway 개발 MCP 연결
- Workspace 만료·정리
- 주간보고 Agent의 Agit 읽기 Spike

**종료 조건**

- 샘플 Agent Project를 원격에서 Build·Test할 수 있다.
- Tool Gateway 외부로 임의의 업무 API를 호출할 수 없다.
- 실패 원인과 Log를 API로 조회할 수 있다.

### 3주차 — CCAB와 Runner 연결

- CCAB의 Draft Agent·Workspace 생성
- 생성 코드와 설정을 Runner로 전송
- Build·Test 시작과 진행 상태 표시
- 실패 Log를 사용자에게 설명하고 수정 후 재실행
- Tool Gateway Tool 탐색과 Agent Tool Allowlist 생성
- 주간보고 Agent의 Agit 수집과 공통 입력 Schema 구현
- Jira Issue Key 추출과 Jira 조회 Spike

**종료 조건**

- 비개발자가 GitHub·로컬 환경 없이 CCAB에서 샘플 Agent를 생성·실행한다.
- 코드 수정 후 동일 Draft의 새 Build 결과를 확인한다.
- Agit 원문과 Jira 이력을 테스트 환경에서 조회한다.

### 4주차 — 에이전트 라이프사이클과 Release

- Definition, Draft Version, Build, Evaluation, Release, Deployment Registry
- Draft부터 Active까지 상태 전이와 권한
- Source Snapshot, Dependency Lock, Artifact Digest 저장
- CCAB의 평가 Case 등록과 Runner 검증 실행
- 검증 통과 전 Release·Active 차단
- ACTIVE Release를 사용하는 Pilot Runtime 최소 경로
- 주간보고 정규화·대조·요약·Evidence 연결

**종료 조건**

- CCAB에서 만든 Draft가 Build·Evaluation을 거쳐 ACTIVE Release가 된다.
- Release에서 Source·Tool Spec·평가 결과를 재구성할 수 있다.
- 과거 주차의 주간보고 초안을 생성한다.

### 5주차 — 주간보고 End-to-End와 운영 안전성

- Agit 다중 보고 수집과 Jira 근거 보완
- 누락·중복·상충·근거 부족 검증
- 최종 보고서 Template과 검토용 초안
- 사람 검토 후 Agit 게시
- 게시 중복 방지와 결과 ID 저장
- Tool Timeout, 인증 실패, 모델 오류, Build 실패 시험
- Release Rollback과 Agent Pause 시험
- 비용·시간·품질 지표 수집

**종료 조건**

- 과거 여러 주차를 End-to-End로 Replay한다.
- 장애가 발생해도 Build·Run·Release 상태를 추적할 수 있다.
- 같은 Run을 재시도해도 Agit 게시물이 중복 생성되지 않는다.

### 6주차 — 실제 운영 리허설과 투자 판단

- 주간보고 담당자가 CCAB에서 Agent 상태와 Release를 확인
- 실제 또는 운영과 동일한 Agit·Jira 데이터로 실행
- 담당자 검토·수정·Agit 게시
- 수작업 대비 시간, 수정량, 실패, 비용 측정
- CCAB·Runner 사용성 회고
- P0 미완료, 보안 이슈, 운영 부채 정리
- 두 번째 에이전트 후보에 공통 컴포넌트 재사용성 검토
- n8n·Lobby 대안과 개발·운영 비용, 품질, 확장성 비교
- Go / Iterate / Stop 의사결정 자료 작성

**종료 조건**

- 비개발자가 GitHub·로컬 환경 없이 생성부터 검증까지 완료한다.
- 담당자가 주간보고 결과의 실제 사용 가능성을 판정한다.
- 다음 단계에서 확장할 Runner·Lifecycle·Runtime 범위가 결정된다.
- 기존 도구로 충분한 영역과 Agentic Work Platform이 필요한 영역이 구분된다.

## 6. 작업 스트림

| 작업 스트림 | 1주 | 2주 | 3주 | 4주 | 5주 | 6주 |
|---|---|---|---|---|---|---|
| CCAB | 현황·계약 | 연동 준비 | Runner 연결 | 평가·Release | 오류 UX | 사용자 검증 |
| Stage Runner | 보안·Runtime 결정 | 최소 실행기 | CCAB 통합 | 평가 실행 | 장애 시험 | 안정화 |
| Tool Gateway | Agit·Jira 계약 | 개발 연결 | Tool 탐색 | Release 고정 | 쓰기·중복 방지 | 운영 점검 |
| Lifecycle | 모델 설계 | API 골격 | Draft·Build 연결 | P0 완성 | Rollback·Pause | 운영 기준 |
| 주간보고 Agent | 범위·Dataset | Agit Spike | Agit·Jira 연결 | 초안 생성 | E2E 게시 | 운영 리허설 |
| 평가·관측 | Dataset | Build Log | Trace | Release 평가 | 품질·비용 | 결과 분석 |

핵심 의존성은 다음과 같다.

```text
Tool Gateway의 Agit·Jira 계약
       ├──▶ CCAB Tool 선택
       ├──▶ Stage Runner 검증
       └──▶ Pilot Runtime 실행

CCAB ──▶ Stage Runner ──▶ Evaluation ──▶ Release ──▶ Pilot Runtime
                                                        │
Agit 보고 + Jira 이력 ──────────────────────────────────▶ 주간보고
```

## 7. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| Stage Runner가 임의 코드 실행 서비스가 됨 | Runtime·Dependency·Network·Resource 제한과 Workspace 격리 |
| 비개발자가 생성한 코드의 책임이 불명확함 | Owner, 평가 결과, Release 승인 주체를 라이프사이클에 기록 |
| GitHub를 없애면서 버전·재현성도 잃음 | 플랫폼 관리 Source Snapshot, Lockfile, Artifact Digest를 Release에 고정 |
| CCAB와 Runner가 강하게 결합됨 | Build Job·Log·Artifact API 계약으로 분리 |
| n8n·Lobby와 기능이 중복됨 | 업무 복잡도별 선택 원칙을 두고, 파일럿에서 기존 대안과 동일 기준으로 비교 |
| Tool Gateway의 시험 호출이 운영 데이터에 영향을 줌 | 개발·운영 자격증명과 쓰기 Tool 분리, 시험에서는 읽기 우선 |
| Agit 보고와 Jira 이력이 일치하지 않음 | 불일치를 숨기지 않고 검토 항목과 Evidence로 노출 |
| 6주 동안 기능 범위가 Runtime 전체로 팽창 | P0는 생성·검증·Release·주간보고 1개에 한정 |

## 8. 남은 의사결정

1. **Stage Runner P0 Runtime**: CCAB가 생성하는 Agent의 언어, Framework, 실행 명령은 무엇으로 고정할 것인가?
2. **Source 보존 방식**: GitHub 계정 없이 Platform-managed Git을 사용할지, Source Snapshot·Artifact Store만 사용할지 결정해야 한다.
3. **운영 실행 위치**: 검증된 Agent Release를 실행할 기존 Runtime이 있는지, 6주 동안 최소 Pilot Runtime도 신규 개발해야 하는지 확인해야 한다.
4. **Agit 게시 Scope**: 원문 수집 Group과 최종 보고서 게시 Group·Template·검토자를 확정해야 한다.
5. **Tool Gateway 환경 분리**: 개발·시험용 Agit·Jira 자격증명과 운영 자격증명을 어떻게 구분할지 결정해야 한다.

위 결정이 내려지면 주차별 담당자, 공수, API 완료 기준과 정량 목표를 확정한다.
