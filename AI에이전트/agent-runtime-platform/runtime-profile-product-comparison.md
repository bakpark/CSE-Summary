# 제품 비교 보완: 동적 AgentProfile · 대규모 수용 · 제어권

> 확인일: 2026-09-09 · 공식 문서 기반 기능 검토 / 성능·통합 실측 전
>
> [아키텍처 본문](./architecture-and-tech-spec.md)의 제품 비교를 보완한다. 아래의 **가능**은 기능 또는 구현 경로가 있다는 뜻이며, 특정 동시 처리량을 보장한다는 뜻이 아니다.

## 1. 판단 요약

여기서 AgentProfile은 본문의 **AgentSpec**에 대응한다. 이미 배포된 실행 로직을 바탕으로 모델·프롬프트·도구·자원 범위·제한을 묶은 설정이다. 새로운 Python 코드나 임의 Graph를 실행 중 업로드하는 것과는 다르다.

| 비교 기준 | LangChain Agent Server | AWS AgentCore Runtime | AWS AgentCore Harness |
|---|---|---|---|
| **재배포 없는 프로필 추가** | **기본 지원.** 배포된 Graph에 Assistant를 API로 생성·변경. [1][r1] | **직접 구현하면 가능.** 실행 코드가 자체 Registry에서 프로필을 조회·주입. [4][r4] | **지원.** Harness 생성·변경 API와 호출별 모델·프롬프트·도구 override 제공. [5][r5] [6][r6] |
| **프로필별 별도 서버가 필요한가** | 아니오. 여러 Assistant가 같은 Graph를 공유. [1][r1] | 필수 아님. 여러 프로필을 읽는 공통 애플리케이션으로 구현 가능. [4][r4] | 필수 아님. 기존 Harness에 호출별 설정을 적용 가능. 별도 Harness 생성은 리소스 프로비저닝을 수반. [5][r5] [6][r6] |
| **수백·수천 프로필 수용** | 구조적으로 적합. 설정 저장과 활성 Run 실행을 분리. 해당 규모의 성능·프로필 상한은 도입 환경에서 검증. [1][r1] [3][r3] | 자체 Registry의 논리적 프로필을 다중화 가능. AWS Runtime 리소스 수·활성 세션 쿼터와 구분. [4][r4] [7][r7] | 호출별 설정으로 다중화 가능. 프로필마다 Harness를 만드는 경우 Runtime 기반 리소스 쿼터와 생성 비용을 확인. [5][r5] [7][r7] |
| **실행 흐름·세밀한 제어** | 직접 작성한 Graph와 interrupt/resume, Run 취소 API를 결합. [3][r3] [8][r8] [9][r9] | 루프·상태·HITL은 자체 코드/프레임워크로 구현. 세션 중지는 실행 환경 제어. [4][r4] [10][r10] | 도구·반복·시간·토큰 제한과 외부 처리 도구를 지원. 임의 Graph와 사용자 정의 Hooks는 미지원. [4][r4] [11][r11] [12][r12] |

**결론:** 동적 프로필만 필요하다면 세 후보 모두 구현 경로가 있다. **커스텀 Graph와 중단·재개·권한 통제를 공통 계약으로 소유하려면 Agent Server 또는 LangGraph를 배포한 AgentCore Runtime이 더 적합하다.** 이는 요구사항에 대한 설계 판단이며 성능 순위가 아니다.

## 2. 동적 프로필과 동적 코드 배포를 구분한다

### Agent Server

하나의 Graph를 먼저 배포한 뒤 API로 Assistant를 추가한다. Assistant는 설정 레코드이므로 프로필을 추가할 때마다 Graph 코드를 다시 배포하지 않는다. 그래프 노드는 정의된 context/config를 읽어 실제 모델·프롬프트·도구 선택에 반영해야 한다. [1][r1] [2][r2]

```text
배포 시: general_graph 코드와 허용된 Adapter 설치
운영 중: Profile A / B / C 등록·검증·활성화
실행 시: 검증된 Profile 버전 → Run Context → 동일 Graph 실행
```

서버는 시작할 때 로드한 compiled graph를 재사용하거나, 실행 시 Factory를 호출할 수 있다. **프로필이 늘었다고 매번 전체 Graph를 재생성할 필요는 없다.** [3][r3]

Factory가 필요하다면 실행뿐 아니라 상태 조회·스키마 조회 시의 동작도 맞춰야 한다. 같은 실행 정의에 대해 topology와 상태 스키마의 일관성을 유지한다. 새로운 노드 구현·의존성·임의 코드는 일반적으로 새 GraphPackage 배포 대상이다. [13][r13]

### AgentCore Runtime

Runtime은 AgentProfile Registry를 자동 제공하는 제품이 아니라 에이전트 코드를 호스팅하는 실행 환경이다. 공통 애플리케이션이 프로필 ID로 DB/API를 조회하고 실행 Context에 주입하도록 구현한다. 이미 설치된 엔진·Adapter가 처리할 수 있는 설정 변화라면 프로필 추가에 코드 재배포가 필요하지 않다. 이 부분은 제품의 내장 Registry 기능이 아니라 **자체 구현안**이다. [4][r4]

### AgentCore Harness

설정형이라고 정적 구성만 가능한 것은 아니다. 호출 시 모델·프롬프트·도구·제한 등을 override할 수 있으며, 기본 Harness 설정을 바꾸지 않고 해당 호출에만 적용한다. [5][r5]

새 Harness 리소스는 생성 API 호출 후 `READY`를 기다려야 한다. **새 설정을 기존 Harness의 호출에 주입하는 것**과 **Harness 리소스를 새로 생성하는 것**을 구분한다. [6][r6]

고객에게 임의 override 권한을 직접 주는 것은 권고하지 않는다. 플랫폼이 인증된 요청에서 프로필을 선택하고, 검증된 설정만 제품 호출로 변환한다.

## 3. 수천 프로필과 수천 동시 실행은 별개의 문제다

| 차원 | 의미 | 주요 검증 대상 |
|---|---|---|
| 등록 프로필 수 | 저장된 AgentSpec과 버전 수 | Registry 조회·색인·버전 관리·캐시 |
| 배포 Graph/Runtime 수 | 독립 실행 코드·리소스 수 | 이미지·의존성·프로비저닝·배포 쿼터 |
| 활성 Run·세션 수 | 동시에 실행 환경을 사용하는 작업 수 | Worker·CPU·메모리·체크포인트·세션 쿼터 |
| 모델·Tool 처리량 | 실제 추론과 외부 업무 호출량 | 모델 RPM/TPM·업무 API 한도·응답 지연 |

예를 들어 **프로필 10,000개를 등록하고 활성 Run 100개를 처리하는 것**과 **프로필 하나로 Run 10,000개를 동시에 실행하는 것**은 전혀 다른 용량 요구다. 이 수치는 설명용이며 성능 측정 결과가 아니다.

Agent Server는 Assistant 등의 원본을 PostgreSQL에 저장하고, API와 실행 Worker를 분리해 확장하는 모드를 제공한다. 문서의 `N_JOBS_PER_WORKER` 기본값 10은 Worker의 동시 Run 설정이지 프로필 수 제한이 아니다. [3][r3]

### AWS 쿼터를 해석할 때

2026-09-09 확인한 공식 문서의 기본값 예시는 다음과 같다. 별도 표기가 없으면 계정·리전 범위이며, 실제 적용값과 증설 가능 여부는 Service Quotas에서 확인한다. [7][r7]

| 항목 | 공식 기본값 | 해석 |
|---|---|---|
| Total agents | 1,000, 조정 가능 | 자체 DB의 AgentProfile 레코드 수를 뜻하지 않음 |
| Active session workloads | 미국 버지니아 북부·오리건 5,000, 기타 리전 2,500, 조정 가능 | 등록 프로필 수가 아니라 활성 실행 환경 측면의 한도 |
| InvokeAgentRuntime | agent·계정 기준 200 TPS, 조정 가능 | 업무 완료 처리량이나 LLM 처리량 보장이 아님 |

Harness 호출도 기반 Runtime의 쿼터를 적용받는다. 따라서 **프로필 1개 = Runtime/Harness 리소스 1개**를 기본 전제로 삼지 않는다. 실행 역할·네트워크·배포 경계가 같으면 다중화를 검토하고, 신뢰 경계가 다르면 분리한다. [7][r7]

## 4. 제어권은 네 층으로 평가한다

| 제어권 | 의미 | 플랫폼에서 필요한 보완 |
|---|---|---|
| **실행 흐름** | 노드·분기·검증 순서를 바꾸는 권한 | GraphPackage 코드·배포·계약 테스트 |
| **Run 생명주기** | 중단·재개·취소·차단·사람 인계 | 상태 원장, 안전 경계, 미완료 조건, 복구 매핑 |
| **업무 행동** | 특정 고객·자원·인자에 대한 실행 허가 | Gateway 인가, 승인 Binding, 최신 정책, 결과 검증 |
| **프로필 운영** | 등록·활성화·비활성화·버전·예산 관리 | Registry 권한, 출시 게이트, Profile별 제한·감사 |

위 표는 제품에 관계없이 적용할 **플랫폼 설계 기준**이다.

Agent Server의 Run 취소는 `interrupt` 방식이면 체크포인트를 남기고, `rollback` 방식이면 해당 Run과 체크포인트를 삭제한다. 이는 업무 API의 변경을 되돌리는 기능이 아니다. 승인용 Graph interrupt와 실행 취소 API도 같은 동작으로 취급하지 않는다. [8][r8] [9][r9]

AgentCore Runtime의 `StopRuntimeSession`은 실행 환경을 종료하며 다음 호출 때 다시 실행 환경이 생길 수 있다. **메모리의 코드 위치를 보존한 업무 Pause/Resume이 아니고, 영구적인 접근 차단도 아니다.** 업무 체크포인트와 호출 권한은 별도로 관리한다. [10][r10]

Harness는 inline function으로 도구 요청을 호출 측에 반환할 수 있다. 미완료 inline function 턴은 세션에 저장하지 않으므로 승인 대상·도구 요청·결정은 플랫폼에 영속화해야 한다. 내부 루프의 임의 Hooks와 Graph 패턴은 제공되지 않아, 모든 노드 경계에 직접 제어를 삽입하는 자유도는 낮다. [4][r4] [11][r11]

**도구를 숨기는 것과 실행 권한을 차단하는 것도 다르다.** Harness의 `allowedTools`는 LLM 도구 선택을 제한하지만 별도 `InvokeAgentRuntimeCommand` API를 막지 않는다. Shell 제외 정책에는 해당 IAM 권한 미부여도 필요하다. Gateway 정책 또한 Gateway를 거치는 요청에 적용되므로 우회 연결을 네트워크·자격증명으로 막는다. [11][r11] [14][r14]

## 5. 우리 플랫폼에 권고하는 구현

```text
Agent Registry
  └─ AgentSpec / Profile Version / Release / 활성 상태
                    │
          인증·소유권·출시 상태 검증
                    ▼
Serving API → 실행별 불변 Context → 공통 Graph 또는 승인된 Graph
                                     │
                              공통 Worker Pool
                                     │
                      Tool Gateway: 실행 직전 재검증
```

### 기본 원칙

프로필은 Registry의 데이터로 관리하고, Graph는 버전이 있는 실행 템플릿으로 관리한다. Run은 선택한 Release에 고정한다. 공통 Graph 객체의 프롬프트·도구·자격증명을 요청마다 덮어쓰지 않는다.

캐시는 불변 설정·도구 스키마처럼 공유 가능한 항목만 대상으로 삼고 크기를 제한한다. 고객별 상태·권한·자격증명을 공용 캐시에 섞지 않는다. 프로필이 늘어도 전용 프로세스·연결 풀·MCP 세션을 모두 상주시킬 필요가 없는 구조로 만든다.

### Agent Server 연결 방식

| 방식 | 장점 | 주의사항 |
|---|---|---|
| **프로필 Release별 Assistant 생성** | 제품의 설정 조회·버전·관측 기능 활용 | 자체 Registry와 Assistant 동기화 및 불변 Release 매핑 필요 |
| **공통 Assistant + Run별 Profile 참조 주입** | 자체 Registry를 유일한 설정 원본으로 유지 | 프로필 해석·검증·모니터링을 플랫폼이 구현 |

둘 다 가능한 구성안이다. Assistant 설정과 Run별 override 경로를 사용할 수 있지만, 플랫폼의 운영 API에서는 승인된 Release 참조만 받도록 제한한다. **프로필 수만으로 두 방식의 성능 우열을 단정하지 말고**, 1,000~10,000개 프로필로 측정해 선택한다. [1][r1] [15][r15]

### 프로필 비활성화와 긴급 차단

`DISABLE_PROFILE`은 신규 Run 생성을 금지하는 운영 정책으로 정의한다. 이미 실행 중인 작업까지 멈추려면 별도의 `BLOCK_ACTIVE_RUNS` 정책으로 신규 Action 허가를 철회하고 Worker 중단을 요청한다.

대기 Run을 재개할 때도 최신 차단 정책을 확인한다. 이 구분 없이 Assistant 삭제나 실행 환경 종료만으로 전체 제어권을 확보했다고 판단하지 않는다. 외부 전송이 끝난 작업은 결과 조회와 필요한 보상 업무로 처리한다.

## 6. 추가 벤치마크 시나리오

다음은 **시험 계획**이며 아직 통과한 결과가 아니다.

| 시험 | 구성 | 확인할 결과 |
|---|---|---|
| 무중단 프로필 추가 | Runtime을 재기동하지 않고 프로필 등록·검증·활성화 | 새 프로필 사용 가능, 기존 Run 설정 불변 |
| 프로필 규모 | 100 / 1,000 / 10,000개 프로필, 활성 Run 수 고정 | 조회 p95, 첫 사용 지연, 메모리·캐시·DB 부하 |
| 동시 실행 | 프로필 수 고정, 동시 Run을 단계적으로 증가 | 대기열·첫 응답·완료 지연·모델/Tool 제한·비용 |
| 공정성·격리 | 일부 프로필만 대량 요청, 서로 다른 권한·Tool 집합 혼합 | 다른 프로필의 과도한 지연·권한·Context 혼입 없음 |
| 제어 경쟁 | 승인·pause·cancel·block·권한 철회 동시 요청 | 차단 이후 신규 Action 허가 없음, 이미 착수한 결과 추적 |
| 대기·배포 | 승인 대기 중 프로필 v2 배포, v1 작업 재개 | 기존 Release 복원, 최신 권한 재검증, 신규 입력과 분리 |

기능 적합성의 우선순위는 **Agent Server → 자체 LangGraph를 배포한 AgentCore Runtime → 관리형 Harness의 제한된 적용 가능성**으로 둔다. 비용·망·보안·운영 적합성 결과에 따라 최종 선택한다. 후보를 모두 운영 엔진으로 구현하지 않는다.

---

## 공식 근거

[1][r1] Assistants · [2][r2] Manage assistants · [3][r3] Agent Server · [4][r4] AgentCore harness vs. Runtime · [5][r5] Harness models and instructions · [6][r6] Harness get started · [7][r7] AgentCore quotas · [8][r8] Server HITL · [9][r9] Cancel run · [10][r10] Runtime sessions · [11][r11] Harness tools · [12][r12] Harness cost controls · [13][r13] Rebuild graph · [14][r14] AgentCore Policy · [15][r15] Runs

[r1]: https://docs.langchain.com/langsmith/assistants
[r2]: https://docs.langchain.com/langsmith/configuration-cloud
[r3]: https://docs.langchain.com/langsmith/agent-server
[r4]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-vs-runtime.html
[r5]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-models.html
[r6]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-get-started.html
[r7]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/bedrock-agentcore-limits.html
[r8]: https://docs.langchain.com/langsmith/add-human-in-the-loop
[r9]: https://docs.langchain.com/langsmith/cancel-run
[r10]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-sessions.html
[r11]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-tools.html
[r12]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-operations.html
[r13]: https://docs.langchain.com/langsmith/graph-rebuild
[r14]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html
[r15]: https://docs.langchain.com/langsmith/runs
