# Agent Builder의 플랫폼 가치와 대안

> 정리일: 2026-10-01 · 제품 방향에 대한 설계 고찰 / 사용자 검증·사업성 검증 전
>
> Flowise 종료가 보여 준 low-code workflow의 한계를 출발점으로, 범용 시각적 Agent Builder가 여전히 플랫폼 핵심이어야 하는지와 더 적합한 제작·운영 경험을 검토한다.

## 1. 결론

**빈 캔버스에서 노드를 연결해 범용 에이전트를 만드는 Builder 자체는 플랫폼의 핵심 가치가 되기 어렵다.** 간단한 에이전트는 자연어가 더 빠르고, 복잡한 에이전트는 코드·SDK·IDE·coding agent가 더 정확하고 유지보수하기 쉽다. 범용 workflow canvas는 이 두 방식 사이에서 상대적으로 좁은 문제만 해결한다.

그러나 Agent Builder를 폐기할 것이 아니라 역할을 바꿔야 한다. 플랫폼이 제공할 핵심 제품은 제작 캔버스가 아니라 다음을 묶는 **Agent Studio 또는 Agent Control Plane**이다.

- 자연어·템플릿·설정 폼·코드로 만든 에이전트의 공통 등록
- 모델·도구·지식·Credential·권한 연결
- 시험·평가·승인·버전·배포
- 실행 trace·품질·비용·오류 관측
- 실행 중지·권한 철회·감사와 운영 정책

시각적 UI는 주 작성 수단보다 **구조 확인, 실행 추적, 디버깅, 승인, 제한적 수정**에 사용한다. 캔버스는 원본 정의가 아니라 공통 `AgentSpec`과 실행 기록을 보여 주는 projection으로 둔다.

## 2. Flowise 종료가 시사하는 것

Flowise는 모델의 추론 능력이 높아지고 개발자가 coding agent로 복잡한 작업을 처리하면서, 고정적인 low-code workflow 방식이 복잡도에 빠르게 한계를 보인다는 판단 아래 운영을 종료했다. 2026-07-29 기능 개발을 중단하고, 2026-08-13 저장소를 보관했으며, 2026-08-31 공식 지원을 종료했다. [1][f1]

하나의 제품 종료만으로 전체 시장의 결론을 단정할 수는 없다. 다만 다음 구조적 문제를 보여 주는 신호로 볼 수 있다.

1. 자연어가 간단한 구성을 흡수한다.
2. coding agent가 코드 작성의 진입 비용을 낮춘다.
3. 복잡한 graph는 결국 코드가 제공하는 추상화·테스트·리뷰·재사용이 필요하다.
4. 시각적 노드는 커질수록 로직을 숨기고, diff·merge·refactoring·회귀 시험을 어렵게 한다.
5. 비개발자가 복잡한 에이전트를 안전하게 만드는 문제는 UI보다 업무 의미·권한·예외 처리의 문제다.

Flowise의 Apache 2.0 범위 코드는 계속 fork할 수 있지만, 공식 유지보수와 신규 보안 보고 접수는 종료되었다. 따라서 소스가 남아 있다는 사실과 장기 제품 기반으로 적합하다는 판단은 구분해야 한다. [1][f1] [2][f2]

## 3. 자연어와 코드 사이에서 캔버스가 좁아지는 이유

| 문제의 성격 | 적합한 제작 방식 | 캔버스의 역할 |
|---|---|---|
| 단순한 개인·팀 Agent | 자연어로 목적·지침·도구·지식을 설명 | 생성 결과 확인 |
| 반복되는 표준 업무 | 검증된 템플릿과 설정 폼 | 관계·상태 요약 |
| 제한된 결정형 절차 | 소수의 의미가 고정된 workflow node | 직접 편집 가능 |
| 복잡한 분기·상태·예외·병렬 처리 | 코드, SDK, Git, coding agent | topology·trace 조회 |
| 고위험 업무 | 코드 또는 승인된 템플릿 + 정책·승인 | 검토·승인·감사 |

범용 canvas는 단순한 문제에는 과하고 복잡한 문제에는 부족하다. 특히 node가 많아지면 다음 문제가 발생한다.

- 연결선이 실행 의미인지 사용 가능 관계인지 불명확해진다.
- 재시도·보상·멱등성·timeout·부분 실패가 속성 패널 안에 숨는다.
- 여러 node에 반복되는 정책을 추상화하기 어렵다.
- 변경 이유와 의미를 코드 review 수준으로 비교하기 어렵다.
- 시각적 정의와 코드의 양방향 변환에서 어느 쪽이 원본인지 모호해진다.

따라서 “모든 에이전트를 graph로 작성한다”는 목표보다 **문제 복잡도와 사용자 역할에 따라 제작 채널을 나누고 하나의 플랫폼 계약으로 수렴시키는 것**이 적합하다.

## 4. 결정형 Workflow는 여전히 필요하다

Workflow형 접근이 모두 사라지는 것은 아니다. 모델에 맡겨서는 안 되는 업무 절차는 오히려 명시적으로 남겨야 한다.

```text
입력
 → 정책 검증
 → Agent 판단
 → 사람 승인
 → 업무 시스템 변경
 → 결과 검증·감사 기록
```

가치가 있는 대상은 에이전트의 세부 추론 과정을 node로 풀어내는 일이 아니라, **에이전트를 둘러싼 결정적 업무 절차와 안전 경계**다.

- 반드시 거쳐야 하는 승인
- 외부 상태 변경 전 권한 재검증
- SLA·timeout·retry·보상
- 규제·감사를 위한 단계 기록
- 사람이 인계받는 조건
- 서로 다른 Agent·시스템 사이의 장기 실행 조정

이 영역에서는 자유로운 low-code canvas보다 플랫폼이 실행 의미를 보장하는 제한된 node와 검증된 템플릿이 낫다. 복잡도가 지원 범위를 넘으면 코드형 workflow로 전환한다.

## 5. 플랫폼 가치의 중심

플랫폼의 지속적인 가치는 화면이 아니라 **공통 계약과 lifecycle**에서 나온다.

| 계층 | 플랫폼이 제공할 가치 | 전략적 중요도 |
|---|---|---:|
| Authoring Channel | 자연어, 템플릿, 폼, 제한적 graph, SDK·CLI | 선택 가능해야 하지만 교체 가능 |
| Agent Definition | versioned `AgentSpec`, 정책, resource reference | 최상 |
| Control Plane | Registry, 평가, 승인, release, 권한, 감사 | 최상 |
| Runtime Plane | 실행 격리, 상태, 중단·재개, Tool Gateway | 최상 |
| Experience | Playground, trace, debugger, 운영 dashboard | 높음 |

Authoring UI 하나를 플랫폼의 중심에 놓으면 UI 기술과 사용자 유행이 바뀔 때 전체 자산이 흔들린다. 반대로 `AgentSpec`과 lifecycle을 중심에 두면 같은 Agent를 자연어로 만들고, 폼에서 수정하고, 코드에서 확장하고, 콘솔에서 검토할 수 있다.

## 6. 권장 제품 모델: Agent Studio

```text
자연어 Composer ─────┐
Template / Form ─────┼──→ Draft AgentSpec ──→ 검증·평가 ──→ 승인·Release
Code / SDK / Git ────┤          │                         │
기존 Agent Import ───┘          │                         ▼
                                ├── 구조·정책 Viewer   Agent Runtime
                                └── Playground·Trace       │
                                                         Tool Gateway
```

### 공통 AgentSpec

공통 정의에는 다음 정도를 포함한다.

- 목적·지침·출력 계약
- 실행 template 또는 code package 참조
- model·tool·knowledge의 ID와 version
- 필요한 Credential 유형과 scope
- 예산·반복·시간 제한
- 승인·사람 인계·업무 정책
- 평가 suite와 release 조건

secret, 실행 중 상태, canvas 위치는 실행 정의에 넣지 않는다. 자연어 Composer와 UI는 이 정의를 생성·수정하는 채널일 뿐 원본 형식을 각자의 내부 JSON으로 바꾸지 않는다.

### 자연어 Composer

사용자가 목적과 제약을 설명하면 구조화된 초안을 생성한다. 자연어 결과를 곧바로 배포하지 않고, 플랫폼 catalog에 존재하는 model·tool·knowledge만 참조하도록 compile하고 schema·권한·정책을 검증한다.

자연어는 다음에 적합하다.

- 첫 초안 만들기
- 기존 Agent의 설정 변경 제안
- 템플릿 검색과 추천
- 평가 시나리오 생성
- 실행 실패 원인 설명

### Template과 설정 폼

비개발자는 빈 canvas보다 업무별 template에서 시작한다. template이 실행 구조와 안전 경계를 고정하고, 사용자는 자주 바뀌는 값만 설정한다.

- 사내 문서 검색
- 고객 문의 분류·답변
- 승인 후 업무 실행
- 데이터 분석·리포트 생성
- 개발·운영 지원

폼은 모델·도구·지식·scope·승인자·출력 형식처럼 의미가 분명한 항목을 제공한다. 고급 설정은 점진적으로 노출하고 플랫폼 정책을 벗어나는 값은 입력할 수 없게 한다.

### Code-first SDK와 Git

복잡한 Agent는 code package와 manifest로 관리한다.

```text
agent code
  + agent manifest
  + tool contracts
  + evaluation cases
  + deployment policy
```

coding agent는 이 코드를 작성·수정·시험하는 데 사용하고, 플랫폼은 CI를 통해 schema·보안·평가·등록·배포를 수행한다. 콘솔은 임의 코드를 손실 없이 graph로 되돌리려 하지 않고 topology·노출된 설정·실행 기록만 보여 준다.

### Visual Inspector와 Debugger

시각화는 다음 질문에 답해야 한다.

- 이 Agent가 어떤 모델·도구·지식·권한을 사용하는가?
- 이번 실행에서 실제로 어떤 도구를 왜 호출했는가?
- 어느 단계에서 오류·재시도·승인 대기가 발생했는가?
- 실행한 definition과 현재 편집 중인 definition이 같은가?
- 누가 어떤 변경을 승인하고 배포했는가?

그래프는 작성 화면보다 조회·운영 화면에서 더 큰 가치를 낼 수 있다. 정적 구성은 graph에, 반복 호출과 시간 순서는 trace timeline에 표현한다.

## 7. 대안 비교

| 제품 방향 | 장점 | 한계 | 권고 |
|---|---|---|---|
| 범용 Visual Builder | 데모와 초기 탐색이 직관적 | 자연어와 코드 사이에서 효율이 낮고 유지보수 부담이 큼 | 플랫폼 중심으로 삼지 않음 |
| 자연어 전용 Builder | 진입 장벽이 낮음 | 결과의 모호성, 재현성·권한·검증 문제 | `AgentSpec` compiler와 검증을 전제로 사용 |
| Template·Form Builder | 안전하고 반복 업무에 적합 | 새로운 실행 구조 표현에는 제한 | 비개발자 기본 경로로 권장 |
| Code-first SDK·Git | 복잡성·시험·review·재사용에 강함 | 비개발자 접근성이 낮음 | 복잡한 Agent의 기본 경로로 권장 |
| 제한적 Workflow Builder | 승인·정책·업무 절차를 명시하기 좋음 | 범용 graph로 확장하면 같은 문제가 재발 | 의미가 고정된 node만 제공 |
| Agent Studio / Control Plane | 모든 제작 채널을 공통 lifecycle로 관리 | 기반 계약과 운영 기능 투자가 필요 | 플랫폼의 핵심 제품으로 권장 |

## 8. 플랫폼을 만들 가치가 있는 조건

다음 조건이 많을수록 Agent Studio의 가치가 크다.

- 여러 조직이 많은 Agent를 만들고 공유한다.
- 공통 model·tool·knowledge·Credential을 안전하게 재사용해야 한다.
- 제작자와 실행자의 권한이 다르다.
- 승인·감사·비용·품질·규제 요구가 있다.
- 같은 Agent를 여러 채널과 고객 환경에 배포한다.
- runtime·tool gateway·평가·관측을 표준화해야 한다.
- 긴급 차단, version rollback, 장기 실행 복구가 필요하다.

반대로 Agent 수가 적고 제작자가 모두 개발자이며 코드·Git·CI만으로 운영 가능한 조직이라면 별도 Builder 플랫폼의 효용은 작다. 이 경우 SDK·template repository·관측 도구를 제공하는 편이 경제적이다.

## 9. 권장 추진 순서

| 단계 | 먼저 증명할 가치 | 주요 산출물 |
|---|---|---|
| **1. 공통 정의** | 제작 채널과 무관하게 같은 Agent를 등록·실행할 수 있는가? | AgentSpec, Registry, resource reference, version·release 계약 |
| **2. 운영 lifecycle** | 안전하게 시험·평가·승인·배포·차단할 수 있는가? | Playground, evaluation, approval, audit, release gate |
| **3. 기본 제작 경험** | 비개발자가 표준 업무 Agent를 만들 수 있는가? | 자연어 Composer, 업무 template, schema 기반 form |
| **4. 개발자 경로** | 복잡한 Agent를 코드로 만들면서 같은 플랫폼을 사용할 수 있는가? | SDK, CLI, manifest, Git·CI 연동 |
| **5. 이해·운영 경험** | 구조와 실행을 빠르게 이해하고 문제를 찾을 수 있는가? | topology viewer, trace timeline, debugger |
| **6. 제한적 편집** | 실제 사용자 수요가 있는 결정형 흐름을 안전하게 편집할 수 있는가? | 승인된 node 집합과 제한적 workflow editor |

범용 canvas 포팅은 1단계가 아니다. 1~5단계에서 시각화·제한적 편집 수요가 확인된 뒤, 자체 구현과 OSS 선택 이식 비용을 비교한다.

## 10. 판단 지표

Builder의 성공을 생성한 graph 수나 node 수로 측정하지 않는다.

- 첫 초안에서 검증 가능한 AgentSpec까지 걸리는 시간
- template으로 해결되는 사용 사례 비율
- 평가를 통과하고 release된 Agent 비율
- 변경 후 회귀 평가 실패와 운영 장애율
- 승인·권한 오류가 실행 전에 차단된 비율
- trace로 문제 원인을 찾는 시간
- Agent·Tool·Knowledge의 재사용률
- 자연어·폼·코드 채널 사이의 동일 definition round-trip 성공률

이 지표가 개선되지 않는다면 시각적 Builder의 사용량이 높아도 플랫폼 가치를 만들었다고 보기 어렵다.

## 11. 최종 제안

제품의 중심을 **Visual Agent Builder**에서 **Agent Studio**로 바꾼다.

1. 자연어와 template·form을 표준 Agent의 기본 제작 경로로 제공한다.
2. 복잡한 Agent는 code-first SDK·Git·coding agent 경로로 보낸다.
3. 플랫폼은 공통 AgentSpec, Registry, Credential, 평가, 승인, release, Runtime을 소유한다.
4. 시각적 graph는 구조·권한·실행 trace를 이해하는 inspector로 먼저 제공한다.
5. 업무상 실행 의미가 명확한 범위에서만 제한적 workflow 편집을 추가한다.

따라서 플랫폼의 방어력은 캔버스 UI나 node 수가 아니라, **어떤 방식으로 만든 Agent도 안전하게 등록·검증·배포·실행·관측할 수 있는 공통 lifecycle**에서 나온다.

---

## 공식 근거

[1][f1] The Future of Flowise · [2][f2] Flowise Security notice

[f1]: https://github.com/FlowiseAI/Flowise/discussions/6727
[f2]: https://github.com/FlowiseAI/Flowise/security
