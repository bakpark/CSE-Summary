# Agentic Work Platform

> Claude Desktop, MCP, Skill을 이미 활용하는 조직에서 별도의 에이전트 빌더·런타임 플랫폼이 제공할 수 있는 가치와 구체적인 제품·아키텍처 방향을 정리한다.
>
> 정리일: 2026-09-23. 시장·제품 기능은 작성 시점의 공식 문서를 기준으로 하며, 플랫폼 구조와 우선순위는 사내 검토를 위한 제안이다.

## 문서 안내

| 문서 | 읽을 내용 |
|---|---|
| [검토 맥락](./agent-builder-platform-context.md) | 현재 회사 환경, 에이전트의 잠정 정의, 기존 논의의 결론과 미해결 질문 |
| [플랫폼 가치 제안](./agent-builder-platform-proposal.md) | 일반화 가능한 생산성 블로커, Claude 생태계 위에 추가 계층이 필요한 이유, 대표 사례와 추진안 |
| [비전 및 런타임 설계](./agentic-work-platform-vision.md) | Agent-first·Workflow-backed 원칙, 용어 체계, 추가 도구, Work Definition·Case 중심의 런타임 아키텍처 |
| [6주 로드맵](./six-week-roadmap.md) | 전사 주간보고 취합 파일럿을 중심으로 한 P0~P2 기능 요구사항, Agent Stage Runner·Tool Gateway·Plugin·라이프사이클 개발 순서 |

## 핵심 결론

단순한 자연어 에이전트 제작·공유·예약 실행은 Claude 생태계와 중복된다. 플랫폼은 Claude Desktop을 대체하는 또 하나의 범용 에이전트가 아니라, Claude가 MCP로 호출하는 **업무 실행·통제 계층**으로 포지셔닝한다.

제품의 기본 원칙은 **Agent-first, Workflow-backed**다. 에이전트는 비정형 정보의 조사와 판단을 담당하고, 워크플로우와 런타임은 상태, 장기 대기, 권한, 승인, 실패 복구, 완료 검증을 담당한다.

반복 가능한 개인 업무의 원형은 **업무 플레이북**, 내부 배포 단위는 **업무 실행 정의(Work Definition)**, 사용자에게 보이는 단위는 **업무 에이전트**, 실제 실행 단위는 장기 상태를 가진 **업무 건(Case)**으로 구분한다.

> 개인의 일하는 방식을, 회사가 운영할 수 있는 AI 업무로.

[AI 에이전트 목차로 돌아가기](../README.md)
