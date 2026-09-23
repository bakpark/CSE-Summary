# AI 에이전트

> ReAct 실행 루프, 에이전트 하네스, 분산 런타임을 구분하고 범용 에이전트 플랫폼의 설계 선택지를 정리한다.
>
> 문서 확인일: 2026-09-09. Deep Agents는 LangChain의 Python `deepagents` SDK를 뜻한다. 공식 문서로 확인한 기능과 이 문서의 설계 제안을 구분한다. 코드 블록은 별도 표시가 없는 한 설명용 골격이며, SDK 버전을 고정한 통합·부하·장애 테스트를 수행한 구현물이 아니다.

## 문서 구성

| 문서 | 다루는 질문 |
| --- | --- |
| [ReAct 엔진과 Deep Agents 하네스](./react-engine-and-harness.md) | 코딩 에이전트는 ReAct 기반인가? 범용 엔진으로 채택할 때의 장단점은 무엇인가? 직접 구현 및 다른 SDK와 어떻게 비교하는가? |
| [Request-scoped 프로필과 분산 런타임](./distributed-request-scoped-runtime.md) | 이미 실행 중인 여러 워커가 서로 다른 프로필의 요청을 어떻게 처리하는가? 세션 격리, 동시성, 재시도, 중단·재개와 배포는 어떻게 설계하는가? |
| [Deep Agents 구현 가이드](./deepagents-request-profile-implementation.md) | Runtime Context와 미들웨어로 모델·프롬프트·도구를 어떻게 연결하는가? 동적 설정의 한계와 검증 항목은 무엇인가? |
| [Agent Runtime Platform 아키텍처·테크스펙](./agent-runtime-platform/README.md) | 대고객 서빙을 위한 Runtime·Playground·Tool Gateway, 제품 벤치마크, 동적 프로필·수용 규모·제어권, 계약·구현 방향과 MVP를 어떻게 정의하는가? |
| [Agentic Platform 비전](./agentic%20platform/README.md) | 사내용 Work Agent와 대고객 Service Agent를 여러 채널에 안전하게 공급하는 공통 플랫폼의 정의, 6주 파일럿과 런타임을 어떻게 설계하는가? |

## 설계 결론

이 문서가 제안하는 기본 모델은 다음과 같다.

```text
공통 런타임 워커
  + 버전이 있는 소수의 실행 템플릿
  + 요청을 접수할 때 확정하는 AgentProfile
  + 실행별 Runtime Context
  + 외부 상태 저장소와 실행 조정 계층
  + 권한을 검증하는 도구 실행 경계
```

프로필마다 서버를 띄울 필요는 없다. 그렇다고 모든 요청을 하나의 변경 가능한 전역 에이전트 객체에 덮어써서 처리하는 것도 아니다. 공유하는 실행 정의와 실행별 데이터를 분리한다.

**프로필 선택은 request-scoped, 진행 중인 작업의 설정은 execution-scoped, 대화 상태는 thread-scoped로 관리한다.** 세션 전체에서 프로필 버전을 고정할지는 서비스 정책으로 결정하되, 이미 중단된 작업의 재개 과정에서는 임의로 최신 버전으로 바꾸지 않는다.

범용성을 모든 업무의 동일한 루프로 정의하지 않는다. 자율적인 탐색은 ReAct에 맡기고, 업무 권한·필수 절차·외부 상태 변경은 코드와 도메인 시스템이 보장하도록 설계한다.

## 읽을 때 유의할 점

`thread_id`에 의한 상태 구분은 인증·인가나 분산 락이 아니다. 모델에 도구를 보여주지 않는 것과 실행 권한 검증도 별개다. 체크포인트 저장과 외부 API의 멱등 실행 역시 각각 설계해야 한다.

Deep Agents SDK, LangGraph 라이브러리, Agent Server 및 관리형 배포 서비스는 제공하는 범위가 다르다. 서버 제품의 실행 큐·동시성 관리 기능을 SDK 자체의 기능으로 간주하지 않는다. 세부 근거와 공식 자료 링크는 각 문서에 포함했다.
