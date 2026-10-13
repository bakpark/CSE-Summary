# kpap 상세 기획

검토용 v0.3 / 수정일: 2026-10-13.

목표는 외부 에이전트의 설정·실행·관측·평가를 연결하는 것이다. 기존 플랫폼 기능을 재사용한다. API·타입은 개발 제안이다.

## 작성 원칙

최대한 간결하게 쓴다. ASD-STE100을 기준으로 한다. 한국어는 적용 가능한 명료성 원칙을 따르고 영문은 어휘·문장 규칙도 적용한다. 상세 규칙은 [AGENTS.md](AGENTS.md)에 있다.

## 주요 문서

| 문서 | 내용 |
|---|---|
| [노드 작업공간 프로토타입](prototype-node-workspace/README.md) | 핵심 화면의 노드 설정·수행·평가·이력 |
| [프로토타입](prototype/README.md) | 모의 데이터로 설정·실행·평가 흐름 체험 |
| [SDK](01-sdk-spec.md) | 고객 서비스 실행·설정·호출·계측 |
| [Plugin](02-plugin-spec.md) | 리소스 탐색·SDK 적용·로컬 평가 |
| [시나리오와 액션별 화면](10-user-scenarios-and-screens.md) | 실행·이력·평가·추적 액션과 화면 상태 |
| [노드 작업공간 UX](09-node-workspace-ux.md) | 한 화면의 노드 설정·수행·평가·이력 |
| [Playground](07-playground-product-spec.md) | 설정·호출·온라인/오프라인 평가 UX |
| [Langfuse v3](08-langfuse-v3-integration.md) | 관측·점수·화면 API 연동 |
| [공통 규격](00-common-contracts.md) | 책임·식별자·설정·상태·저장 |
| [호출 규칙](03-playground-call-tracing.md) | 진행·취소·재연결·관측 지연 |
| [오프라인 규칙](04-playground-evaluation-analysis.md) | 고정 조건·비교·집계 |
| [온라인 규칙](05-online-evaluation.md) | 정책·표본·비용·비동기 평가 |
| [체크리스트](06-planning-checklist.md) | 미확정 사항·검증 |

## 개발 순서

공통 계약 확정 → 대표 SDK 실행 → Playground 호출·관측 → 오프라인 평가·Plugin → 온라인 평가.

플랫폼 호스팅·전체 코드 자동 계측·자동 최적화·자동 운영 승격은 별도 범위다.
