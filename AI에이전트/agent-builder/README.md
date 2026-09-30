# Agent Builder

> 오픈소스의 시각적 편집 경험을 선택적으로 내재화하고, 에이전트 정의·권한·실행·배포는 기존 플랫폼이 소유하는 Agent Builder 설계안.
>
> 정리일: 2026-10-01. 공식 저장소를 정적으로 검토한 제안이며, 코드 이식·통합·보안 시험을 완료한 결과가 아니다.

## 문서 안내

| 문서 | 읽을 내용 |
|---|---|
| [오픈소스 Builder 평가와 선택 이식 전략](./opensource-builder-evaluation.md) | Langflow·Flowise Agentflow·Sim Studio 비교, OSS 선택 기준, UI 이식 경계, 기존 Registry·Credential·Runtime 재사용 원칙, 조건부 Flowise 우선 PoC |

## 핵심 결정

Agent Builder를 별도 플랫폼이나 두 번째 실행 원장으로 만들지 않는다. 캔버스·노드·속성 패널·검증·실행 상태 표현은 독립적인 편집기 모듈로 구성하고, 에이전트 정의와 편집 메타데이터는 기존 플랫폼 저장·버전 체계에 보관한다.

Flowise의 `@flowiseai/agentflow`를 첫 추출 PoC 대상으로 삼되 특정 커밋에 고정한다. 해당 저장소가 보관 상태이고 패키지가 dev 단계이므로 지속 업데이트되는 운영 의존성으로 바로 채택하지 않는다. Sim Studio는 UX와 디자인 구조의 주요 참고안, Langflow는 성숙한 기능과 대체 구현 경로의 비교 기준으로 사용한다.

## 관련 문서

| 기존 문서 | 연결되는 질문 |
|---|---|
| [Agent Runtime Platform](../agent-runtime-platform/README.md) | Builder가 저장한 정의를 어떤 실행·권한·배포 기준으로 제공하는가? |
| [Request-scoped 프로필과 분산 런타임](../distributed-request-scoped-runtime.md) | 편집한 프로필·실행 Context·세션 상태를 어떻게 분리하는가? |
| [Agentic Platform 비전](../agentic%20platform/README.md) | Builder를 기존 제작 채널·사내 콘솔·서비스 채널과 어떻게 공존시키는가? |

[AI 에이전트 목차로 돌아가기](../README.md)
