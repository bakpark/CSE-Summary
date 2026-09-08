# Agent Runtime Platform

> 서로 다른 Agent를 같은 실행·권한·품질·배포 기준으로 대고객 서비스에 제공하기 위한 설계안.
>
> 정리일: 2026-09-09. 본문 v1.0과 구현 부록 v1.1을 보존하고, 동적 프로필·수용 규모·제어권에 대한 제품 비교를 보완했다. 설계·OKR·시험 계획은 제안이며 운영 검증 결과가 아니다.

## 문서 안내

| 문서 | 읽을 내용 |
|---|---|
| [아키텍처·기술 명세](./architecture-and-tech-spec.md) | 제안 배경, 세 컴포넌트의 책임, 다중 Graph, Contract, HITL·복구, MVP·OKR |
| [제품 비교 보완](./runtime-profile-product-comparison.md) | 실행 중 프로필 추가, 수백·수천 프로필 수용, Agent Server·AgentCore의 제어권 차이 |
| [계약 스키마·구현 부록](./contracts-and-implementation.md) | TypeScript 계약, 공통 Graph 노드, 프레임워크·라이브러리, 구현 검증 기준 |

본문의 제품 비교와 함께 **제품 비교 보완**을 읽는다. 프로필 설정의 추가와 실행 코드 배포, 등록 프로필 수와 동시 Run 수, 실행 중지와 업무 권한 철회를 구분한다.

## 핵심 결정

공통화 대상은 하나의 만능 Graph가 아니라 실행 표준이다. 구성형 Agent를 기본 경로로, 검토된 커스텀 Graph를 확장 경로로 제공한다. Agent Server는 조건부 서빙 후보이며 AgentCore Runtime은 호스팅 대안이다.

Playground는 구성·평가·운영, Runtime Plane은 고객 서빙·실행 상태, Tool Gateway는 실제 업무 접근 통제를 담당한다. 업무 규칙과 원장은 도메인 서비스에 둔다.

MVP에서는 Shell·코드 실행 도구·파일 작업공간·별도 지식 저장소를 제외한다. 기존 RAG를 재사용하고, 중단·재개·승인·고객 격리·업무 결과 검증에 집중한다.

## 관련 고찰

| 기존 문서 | 연결되는 질문 |
|---|---|
| [ReAct 엔진과 Deep Agents 하네스](../react-engine-and-harness.md) | 공통 실행 루프와 Harness를 어떻게 구분하는가? |
| [Request-scoped 프로필과 분산 런타임](../distributed-request-scoped-runtime.md) | 프로필·Context·세션·실행 버전을 어떻게 분리하는가? |
| [Deep Agents 구현 가이드](../deepagents-request-profile-implementation.md) | 프레임워크 기능과 직접 구현할 정책의 경계는 무엇인가? |

[AI 에이전트 목차로 돌아가기](../README.md)
