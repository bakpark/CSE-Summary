# Agent Builder

> 오픈소스의 시각적 편집 경험을 선택적으로 내재화하고, 에이전트 정의·권한·실행·배포는 기존 플랫폼이 소유하는 Agent Builder 설계안.
>
> 정리일: 2026-10-01. 공식 저장소를 정적으로 검토한 제안이며, 코드 이식·통합·보안 시험을 완료한 결과가 아니다.

## 문서 안내

| 문서 | 읽을 내용 |
|---|---|
| [Agent Builder의 플랫폼 가치와 대안](./agent-builder-platform-value-and-alternatives.md) | 범용 workflow canvas가 자연어와 코드 사이에서 갖는 한계, Agent Studio·공통 AgentSpec·템플릿·code-first SDK·시각적 inspector 중심의 대안 |
| [오픈소스 Builder 평가와 선택 이식 전략](./opensource-builder-evaluation.md) | Langflow·Flowise Agentflow·Sim Studio 비교, OSS 선택 기준, UI 이식 경계, 기존 Registry·Credential·Runtime 재사용 원칙, 캔버스 수요 확인 후 수행할 기술 스파이크 |
| [Flowise 자연어 Agent Builder 프로토타입](./prototype/README.md) | 항상 열려 있는 Flowise 캔버스, 자연어 초안·수정, ReAct 그래프 편집, 모델 선택, 입출력 계약 기반 Function 노드를 어떻게 실행하는가? |

## 핵심 결정

플랫폼의 중심을 범용 Visual Agent Builder가 아니라 **Agent Studio와 공통 AgentSpec lifecycle**로 둔다. 자연어·템플릿·설정 폼·코드가 같은 정의와 Registry로 수렴하게 하고, 캔버스는 구조 확인·실행 추적·디버깅·제한적 workflow 편집에 우선 사용한다.

범용 캔버스의 사용자 가치가 확인되기 전에는 Flowise 포팅을 선행하지 않는다. 필요할 경우 `@flowiseai/agentflow`는 특정 commit을 고정한 추출 실험 대상으로만 사용한다. 해당 저장소가 보관 상태이고 패키지가 dev 단계이므로 지속 업데이트되는 운영 의존성으로 채택하지 않는다. Sim Studio와 Langflow 역시 공통 정의·평가·운영 기능을 대신하지 않는 UI 참고 후보로 한정한다.

## 관련 문서

| 기존 문서 | 연결되는 질문 |
|---|---|
| [Agent Runtime Platform](../agent-runtime-platform/README.md) | Builder가 저장한 정의를 어떤 실행·권한·배포 기준으로 제공하는가? |
| [Request-scoped 프로필과 분산 런타임](../distributed-request-scoped-runtime.md) | 편집한 프로필·실행 Context·세션 상태를 어떻게 분리하는가? |
| [Agentic Platform 비전](../agentic%20platform/README.md) | Builder를 기존 제작 채널·사내 콘솔·서비스 채널과 어떻게 공존시키는가? |

[AI 에이전트 목차로 돌아가기](../README.md)
