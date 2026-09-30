# Agent Builder 오픈소스 평가와 선택 이식 전략

> 확인일: 2026-10-01 · 공식 저장소 기반 정적 검토 / 코드 이식·통합·보안 실측 전
>
> 이 문서의 목적은 완제품을 선정하는 것이 아니라, 사내 플랫폼이 소유할 Agent Builder에 재사용할 편집기 기반과 이식 경계를 정하는 것이다. 별도 표시가 없는 평가는 요구사항에 대한 설계 판단이다.

## 1. 판단 요약

이번 과제는 **오픈소스 Builder를 사내에 그대로 설치하는 일**이 아니다. 필요한 것은 캔버스·노드·속성 패널·검증·변수 선택·실행 상태 표시 같은 편집 경험이며, 저장·Registry·Credential·권한·실행·배포는 기존 플랫폼 체계를 그대로 사용한다.

첫 PoC는 **Flowise `@flowiseai/agentflow`의 선택 이식 가능성 검증**으로 시작한다. 완제품 프런트엔드에서 편집기를 분리하는 대신 이미 embeddable React component 형태로 나뉘어 있어 가장 짧은 경로로 핵심 가설을 확인할 수 있기 때문이다. 다만 공식 저장소는 2026-08-13부터 보관 상태이며, 패키지 메타데이터는 `0.0.0-dev.14`, README의 상태 표시는 아직 `0.0.0-dev.13`이다. 따라서 다음 조건을 붙인다. [1][f1] [2][f2] [3][f3]

- npm 패키지를 계속 따라가는 운영 의존성으로 바로 채택하지 않는다.
- 검토한 commit을 고정하고, 필요한 코드를 fork 또는 vendor하여 내부 소유 경계를 만든다.
- Flowise 서버 없이 편집·직렬화·복원이 가능한지를 PoC의 첫 통과 조건으로 삼는다.
- 통과하지 못하면 Sim Studio의 편집기 구조와 Langflow의 성숙한 캔버스를 같은 계약으로 비교한다.

Sim Studio는 현대적인 콘솔 UX와 디자인 시스템 적용 방식을 참고할 2순위 후보이고, Langflow는 기능 성숙도와 대체 구현 경로를 확인할 3순위 후보이다. **Flowise를 코드 기반, Sim Studio를 UX 참고안으로 조합하되 어느 제품의 저장 형식이나 런타임도 플랫폼 표준으로 채택하지 않는 것**이 기본 제안이다.

## 2. 선택 기준

일반적인 제품 도입 평가와 우선순위가 다르다. 이미 플랫폼에 있는 기능은 점수를 높이지 않고, UI를 떼어내 내부 계약에 연결하는 비용을 중심으로 본다.

| 평가 기준 | 중요도 | 확인할 질문 |
|---|---:|---|
| 편집기 독립성 | 최상 | 제품 백엔드·인증·DB 없이 캔버스가 동작하는가? |
| React 코드와 확장성 | 최상 | 노드·패널·검증·상태 표현을 내부 컴포넌트로 교체할 수 있는가? |
| 플랫폼 계약 연결성 | 최상 | Model·Tool·Credential 옵션을 외부 provider로 공급하고 저장 이벤트를 가로챌 수 있는가? |
| 라이선스·출처 추적 | 최상 | 수정·배포가 가능한가? 고지와 제3자 의존성을 추적할 수 있는가? |
| 디자인 시스템 교체성 | 높음 | 전역 스타일 충돌 없이 토큰·공통 UI를 단계적으로 바꿀 수 있는가? |
| 편집 기능 완성도 | 높음 | 연결 검증, 변수 참조, undo/redo, 복사, 읽기 전용, 오류 표시를 제공하는가? |
| 유지보수 상태 | 높음 | upstream 활동, 버전 안정성, 보안 수정 경로가 명확한가? |
| 자체 Runtime·RAG·DB | 낮음 | 기존 플랫폼이 제공하므로 중복 구현은 오히려 제거 비용인가? |

## 3. 후보 비교

| 후보 | 공식 코드에서 확인한 구조 | 라이선스 범위 | 선택 이식 적합도 | 주요 장점 | 주요 위험과 판단 |
|---|---|---|---:|---|---|
| **Flowise Agentflow** | React + ReactFlow + MUI 기반의 별도 embeddable package. 초기 데이터·변경·저장 callback, validation/export, async option, variable picker, 실행 상태, read-only, custom rendering 제공 [2][f2] | package는 Apache-2.0. 루트 저장소의 enterprise 경로·명시 파일은 별도 조건이므로 전이 파일 확인 필요 [3][f3] [8][f4] | **높음** | 편집기 단위의 출발점이 이미 존재하여 PoC가 가장 직접적 | 저장소 보관 상태, dev API, Flowise API endpoint 전제, 자체 theme token이 남아 있음. **조건부 1순위 PoC** |
| **Sim Studio** | Next.js App Router, ReactFlow, Zustand, shadcn, Tailwind 기반의 전체 애플리케이션 [4][s1] | Apache-2.0 [5][s2] | 중상 | 현대적인 노드·도구 선택·레이아웃·실행 UX와 사내 디자인 시스템 참고에 유리 | workflow persistence, auth, realtime 등 제품 계층에서 편집기를 분리해야 함. **UX 참고 및 2순위 코드 스파이크** |
| **Langflow** | React 19 + TypeScript + Vite, Zustand, `@xyflow/react` 프런트엔드와 Python/FastAPI 실행 계층 [6][l1] | MIT [7][l2] | 중간 | 성숙한 캔버스·컴포넌트 생태계와 허용적인 라이선스 | 노드 정의·Python 컴포넌트 갱신·실행 API 결합을 직접 끊어야 함. **대체안과 기능 벤치마크** |

별점이나 GitHub star 수처럼 변동이 크고 이식 비용을 직접 설명하지 못하는 수치는 의사결정 근거에서 제외한다. 최종 선택은 정적 코드 인상이 아니라 동일한 샘플 정의와 완료 기준으로 수행한 PoC 결과로 결정한다.

## 4. 목표 아키텍처와 소유권 경계

```text
기존 AI Platform Console
  ├─ 인증·프로젝트·권한·메뉴·Design System
  └─ Agent Builder
       ├─ Editor Core
       │    ├─ Canvas / Node / Edge
       │    ├─ Property Panel / Variable Picker
       │    ├─ Client Validation / Undo·Redo
       │    └─ Execution Visualization
       └─ Platform Adapter
            ├─ Agent Definition & Draft/Revision
            ├─ Agent·Model·Tool·Knowledge Registry
            ├─ Credential Reference & Approval
            └─ Validation·Test Run·Event Stream
                         │
                         ▼
                  기존 Agent Runtime
```

### Editor Core가 소유하는 것

- 화면의 노드·연결·선택·viewport와 편집 명령
- 속성 폼, 즉시 입력 검증, 오류 위치 표시
- 변경·저장 요청·검증 요청·시험 실행 요청 callback
- 실행 이벤트를 노드 상태로 표현하는 기능
- 사내 디자인 시스템으로 교체 가능한 렌더링 경계

Editor Core는 인증 토큰을 보관하거나, 플랫폼 저장 API를 직접 결정하거나, 도구를 직접 실행하지 않는다. 같은 편집기를 초안 편집·읽기 전용 검토·실행 이력 조회 화면에 재사용할 수 있어야 한다.

### Platform Adapter가 소유하는 것

- 플랫폼 정의와 편집기 내부 모델 사이의 변환
- Agent·Model·Tool·Knowledge catalog 조회
- 초안·revision·버전·게시 절차와 충돌 감지
- 서버 검증, 시험 실행, 취소, 이벤트 재접속
- Credential 참조와 사용자·서비스 계정 승인 정책 연결

Adapter는 별도 플랫폼이 아니다. 기존 API를 조합하는 프런트엔드 모듈을 우선 사용하고, 서버 측 검증이나 여러 API의 원자적 처리가 필요할 때만 기존 백엔드 계약을 보완한다. **Flowise 호환 서버나 두 번째 Agent Registry를 새로 만들지 않는다.**

## 5. 저장 모델은 OSS 그래프 형식과 분리한다

영구 원본은 기존 플랫폼의 Agent 정의다. Flowise·Sim·Langflow JSON을 그대로 원본으로 삼으면 UI 교체가 실행 정의 마이그레이션이 되고, upstream 노드 모델이 플랫폼 계약을 역으로 결정한다.

| 구분 | 예시 | 관리 원칙 |
|---|---|---|
| **실행 정의** | 지침, 모델 참조, 허용 도구, 지식, 출력 형식, 실행 제한, 승인 정책 | 기존 Registry의 versioned definition을 유일한 원본으로 사용 |
| **편집 메타데이터** | 노드 위치, viewport, 접힘, 메모, 표시 그룹 | 실행 의미와 분리하여 부가정보로 저장 |
| **실행 기록** | run·node·invocation 상태, 입력·출력 요약, 오류·승인 | Runtime 원장과 관측 체계에 저장하고 편집 문서에 섞지 않음 |

노드 이동처럼 실행 의미가 없는 변경과 모델·도구 변경처럼 실행 의미가 있는 변경을 구분한다. 시험 실행은 항상 고정된 definition revision과 hash를 참조하고, 화면은 `runId / definitionRevision / nodeId / invocationId / sequence`를 이용해 반복 도구 호출과 마지막 노드 상태를 구분한다.

초기 범위에서 연결선의 의미는 두 가지를 혼합하지 않는다.

- Agent와 Tool·Knowledge 연결: 해당 자원을 사용할 수 있다는 **구성 관계**
- Condition·Workflow 노드 연결: 플랫폼이 정의한 순서와 데이터 전달이라는 **실행 관계**

1차 공개는 공용 엔진의 Agent profile 편집에 집중한다. 임의 Python·JavaScript 실행, 임의 LangGraph 코드의 양방향 변환, 무제한 반복·병렬 그래프는 제외한다.

## 6. 기존 플랫폼 기능 재사용 원칙

| OSS 편집 기능 | 연결할 플랫폼 기능 | 지켜야 할 경계 |
|---|---|---|
| Model option loading | Model Registry | 화면에 노출 가능한 모델만 반환하고 실행 시 서버에서 다시 검증 |
| Tool palette·설정 | Tool Registry | 도구 ID·version·설정 schema를 제공하고 실제 호출 권한은 Gateway에서 재검증 |
| Knowledge node | 기존 Knowledge/RAG catalog | 저장소를 복제하지 않고 승인된 resource reference만 정의에 기록 |
| Credential selector | Credential Store | secret 값을 그래프·브라우저·공유 정의에 넣지 않고 opaque reference만 저장 |
| Flow save/export | Agent Registry의 draft·revision | 기준 revision으로 동시 수정 충돌을 감지하고 게시·배포와 분리 |
| Validation | client validation + server validation | 화면 검증은 편의 기능이고 권한·정책·실행 가능성은 서버가 판정 |
| Run status | 기존 Runtime·event stream | 정의 revision을 고정하고 실행 취소와 화면 구독 종료를 구분 |
| Read-only mode | 플랫폼 RBAC·release viewer | UI 비활성화만 믿지 않고 쓰기 API에서도 권한을 검증 |

Credential은 제작자의 PAT를 공유 에이전트에 묶지 않는다. 정의에는 필요한 연결 유형과 scope만 기록하고, 실행 시 사용자 동의·최신 권한·서비스 계정 정책을 확인한 뒤 Runtime에 주입한다. **캔버스에서 선을 연결했다는 사실은 권한 위임이 아니다.**

## 7. UI 선택 이식 범위

### 우선 살릴 기능

- canvas pan·zoom·fit view, node·edge 추가·삭제·연결
- node palette, 검색, drag-and-drop, property panel
- schema 기반 field, async option, 조건부 field, variable picker
- 연결·필수값 검증과 node·field 단위 오류 표시
- 변경 감지, 직렬화·복원, undo/redo, 복사·붙여넣기
- read-only, 실행 중·완료·오류·중단 상태 표시
- custom renderer와 host action 영역

### 제거하거나 플랫폼 구현으로 바꿀 기능

- OSS 제품의 로그인·조직·workspace·billing·marketplace
- OSS 저장 API·DB schema·배포·scheduler·runtime
- API key 직접 입력과 브라우저 secret 보관
- 임의 코드·임의 HTTP 요청처럼 플랫폼 정책을 우회하는 node
- 외부 telemetry·update check·CDN·font 요청
- 제품 전역 navigation, toast, modal, theme처럼 콘솔과 중복되는 shell

가져온 코드는 원본 commit·파일 경로·라이선스 고지·내부 수정 이유를 기록한다. upstream 전체 병합은 목표로 삼지 않고, 필요한 보안 수정과 편집기 개선만 선별 반영한다. Flowise의 루트 라이선스는 일부 enterprise 경로와 명시적으로 제한된 파일을 상업 라이선스로 구분하므로, `packages/agentflow`와 실제 전이 의존 파일의 적용 라이선스를 파일 단위로 다시 확인한다. [3][f3] [8][f4]

## 8. 조건부 Flowise 우선 PoC

PoC는 예쁜 데모가 아니라 **선택 이식의 경계와 소유 비용을 증명하는 시험**이다.

| 단계 | 작업 | 통과 기준 |
|---|---|---|
| **0. 기준선 고정** | Flowise commit·Agentflow package·license·제3자 의존성 기록 | 재현 가능한 source snapshot과 NOTICE/SBOM 초안 확보 |
| **1. 백엔드 없는 편집기** | 고정 catalog와 sample definition으로 canvas·panel 실행 | Flowise 서버·로그인·DB 없이 편집·검증·직렬화·복원 가능 |
| **2. Adapter 교체** | Model·Tool·Credential option과 저장 callback을 mock platform provider에 연결 | 제품 API endpoint를 요구하지 않고 같은 샘플을 round-trip |
| **3. 사내 UI 경계** | theme·node·panel·action을 사내 component로 교체 | 전역 CSS 충돌이 없고 host shell 안에서 lazy loading 가능 |
| **4. 실행 표현** | 고정 revision 시험 실행과 event mapping 연결 | 반복 호출·오류·취소·재접속 상태를 node와 이력에 정확히 표시 |
| **5. 유지보수 판단** | 변경량·fork 범위·테스트·취약점 대응 책임 산정 | 내부 팀이 소유 가능한 범위인지 ADR로 채택·기각 결정 |

다음 중 하나라도 크면 Flowise 기반을 기각하고 같은 Adapter 계약으로 Sim Studio와 Langflow를 비교한다.

- 편집기를 떼기 위해 Flowise 서버 API나 애플리케이션 대부분을 유지해야 한다.
- 플랫폼 정의를 손실 없이 round-trip하려면 Flowise JSON을 원본으로 삼아야 한다.
- 사내 디자인 시스템 교체가 fork의 광범위한 재작성을 요구한다.
- 보관된 upstream을 대신해 감당해야 할 보안·의존성 유지 비용이 편집기 재구현보다 크다.

Sim Studio 스파이크에서는 `apps/sim`의 canvas·block·panel 경계와 shared workflow type의 결합도를 확인한다. Langflow 스파이크에서는 Flow page·generic node·store·API controller·flow type 사이의 결합을 확인한다. 세 후보 모두 동일한 sample definition, catalog, Adapter interface, 완료 기준을 사용한다.

## 9. 보안과 운영 체크리스트

- 노드 palette 노출과 실제 실행 권한을 분리하고 Tool Gateway에서 매 호출을 재검증한다.
- secret·PAT·원문 credential을 definition, 편집 메타데이터, browser log, export 파일에 넣지 않는다.
- client validation을 신뢰 경계로 사용하지 않고 서버가 schema·정책·resource scope를 다시 검증한다.
- 임의 코드·URL·plugin 실행은 메뉴만 숨기지 말고 bundle과 API 경로에서 제거한다.
- 저장에는 기준 revision을 포함하고 다른 제작 채널과의 last-write-wins 덮어쓰기를 막는다.
- run 시작 시 definition revision·hash를 고정하고 편집 후에는 이전 시험 결과를 유효 처리하지 않는다.
- 화면 구독 해제와 서버 실행 취소를 별도 명령으로 제공한다.
- vendor code의 source commit, 수정 이력, NOTICE, SBOM, 취약점 대응 담당자를 유지한다.

## 10. 최종 제안

Agent Builder는 **플랫폼의 새 시각적 제작 채널**로 정의한다. OSS는 Editor Core의 출발점과 UX 참고자료이며, 플랫폼의 저장·관리·권한·실행 체계를 대체하지 않는다.

실행 순서는 다음과 같다.

1. Flowise `@flowiseai/agentflow`를 고정된 source snapshot으로 가져와 백엔드 없는 편집기와 Adapter 교체 가능성을 먼저 검증한다.
2. Sim Studio의 node·tool 선택·layout·run/debug UX를 참고하여 사내 디자인 시스템으로 다시 입힌다.
3. 기존 Agent·Model·Tool·Knowledge Registry, Credential Store, Runtime, version·deployment 계약만 연결한다.
4. PoC 통과 여부를 변경량·round-trip·보안·유지보수 기준으로 결정하고, 실패하면 같은 계약으로 Sim Studio와 Langflow를 비교한다.

따라서 **Flowise 우선은 운영 제품 선정이 아니라 가장 빠른 가설 검증 순서**다. 저장소 보관 상태를 감안하면 장기 채택의 전제는 fork/vendor한 코드와 테스트를 내부에서 소유할 수 있다는 판단이며, 그 책임을 수용할 수 없으면 활성 upstream을 가진 후보 또는 최소 Editor Core 재구현으로 전환한다.

---

## 공식 근거

[1][f1] Flowise repository · [2][f2] `@flowiseai/agentflow` README · [3][f3] Agentflow package metadata · [4][s1] Sim contributing guide · [5][s2] Sim license · [6][l1] Langflow repository guide · [7][l2] Langflow license · [8][f4] Flowise license

[f1]: https://github.com/FlowiseAI/Flowise
[f2]: https://github.com/FlowiseAI/Flowise/blob/main/packages/agentflow/README.md
[f3]: https://github.com/FlowiseAI/Flowise/blob/main/packages/agentflow/package.json
[f4]: https://github.com/FlowiseAI/Flowise/blob/main/LICENSE.md
[s1]: https://github.com/simstudioai/sim/blob/main/.github/CONTRIBUTING.md
[s2]: https://github.com/simstudioai/sim/blob/main/LICENSE
[l1]: https://github.com/langflow-ai/langflow/blob/main/AGENTS.md
[l2]: https://github.com/langflow-ai/langflow/blob/main/LICENSE
