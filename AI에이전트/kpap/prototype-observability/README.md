# Playground pilot v21

검토용 / 2026-10-24. 기존 관측 시안을 실행·평가·관측을 연결하는 브라우저 프로토타입으로 갱신했다. 경로는 기존 링크를 보존하기 위해 유지한다.

원본 소스 기준: `f10b37f162a4cba9d0b84db42e7f1d7ddb144865`. `dist/`와 `tests/`는 이 버전과 동일하다.

## 실행

이 폴더에서 정적 서버를 실행하고 http://localhost:8000 을 연다. 설치와 빌드는 필요 없다.

```sh
python3 -m http.server 8000 --directory dist
```

## 화면과 범위

- 실행: 저장된 기준·후보 설정과 변경 상태를 구분한다.
- 평가: 데이터셋·평가 정의·후보를 선택하고 고정된 한 사례를 비교한다. 결과는 당시 스냅샷을 보존한다.
- 관측: 플랫폼의 최소 실행 기록에서 상세 trace를 지연 조회한다. 호출·입출력·설계 플로우를 연결한다.
- 기록 재생: 현재 조회한 관측의 기록 시각을 재생한다. 라이브 실행이나 출력 스트리밍이 아니다.
- 반복 호출은 정확한 observation·attempt 식별자로 선택한다. 평가 근거에서 관측을 열고 원래 결과로 돌아갈 수 있다.

모든 runtime·Judge·데이터셋·Langfuse 응답은 메모리의 고정 mock이다. 프롬프트나 rubric의 의미를 해석하지 않는다. 실제 에이전트에 설정을 적용하거나 운영 데이터셋에 저장하지 않는다. 새로고침하면 상태가 초기화된다. 인증 정보와 외부 API 호출은 포함하지 않는다.

## v21 변경

- 관측의 트리·타임라인·로그·필터·점수·메타데이터 탐색을 보강했다.
- 중립 회색과 단일 강조색으로 팔레트를 통합했다. 장식용 왼쪽 색상 막대는 제거했다.
- 색상은 `dist/palette.css`에서만 정의한다. 상세 규칙은 [DESIGN.md](DESIGN.md)를 따른다.
- 실행·평가·근거 탐색·기록 재생 기능은 유지한다.

## 연동 전제

- [관측 구현 스펙](../12-playground-observability-tech-spec.md)과 [Langfuse v3 연동](../08-langfuse-v3-integration.md)은 구현 제안이다. 이 시안은 실제 배포 검증이 아니다.
- 실행 목록은 플랫폼 기록이다. trace는 공개 self-hosted v3 REST 형태의 mock 어댑터로 조회한다. native trace 상세 응답에 없는 cursor를 플랫폼 정규화 계약과 혼동하지 않는다.
- A2A 업무 상태와 관측 조회 상태를 분리한다. available은 전체 수집 완료가 아니다. not_found는 수집 전·삭제를 구분하지 않는다. 403·503은 별도 상태다.
- 설계 연결에는 실행 당시 스냅샷·graphVersion과 안정적인 nodeId·invocationId가 필요하다. `metadata.kpap`는 mock의 제안 namespace다.
- span 부모 관계는 호출 계층이다. 설계 간선이나 실행 전이를 추론하지 않는다. 재생 간선은 명시적인 predecessorInvocationIds와 일치하는 설계 간선이 있을 때만 표시한다.
- 매핑 없는 호출과 불완전한 시각은 그대로 표시한다. 관측 수를 실행 횟수로 세거나 중첩 비용·시간을 합산하지 않는다.
- 실제 manager 화면·권한·endpoint는 연결하지 않았다. API 키는 향후 플랫폼 백엔드에서 관리해야 한다.

## 파일

| 파일 | 역할 |
|---|---|
| `dist/index.html` | 진입 화면 |
| `dist/pilot.js`, `pilot.css`, `reference-theme.css` | 화면·탐색·스타일 |
| `dist/pilot-model.js` | 상태 전이·불변 결과 |
| `dist/mock-api.js` | 고정 응답·결과 시나리오 |
| `dist/trace-adapter.js` | v3 형태 응답 정규화 |
| `dist/trace-replay.js` | 기록 시각 재생 |
| `dist/trace-views.js`, `trace-inspection.js`, `trace-inspection.css` | 관측 상세 탐색 |
| `dist/component-system.css`, `palette.css` | 공통 컴포넌트·색상 토큰 |
| `tests/` | 모델·어댑터·탐색·재생 회귀 검사 |

## 검증

Node.js v24.22.1에서 아래 검사를 실행했다. JavaScript 문법 및 79개 테스트가 통과했다.

```sh
for f in dist/*.js; do node --check "$f" || exit; done
node --test tests/*.test.cjs
```

검사는 mock DOM과 가상 시계를 포함한다. 실제 브라우저 렌더링·접근성·프레임률이나 운영 보안을 보장하지 않는다. 실제 Langfuse·SDK·A2A·Judge 통합 검증은 별도로 수행해야 한다. 이 커밋에는 배포 설정, 화면 캡처, 원본 사진, 인증 정보를 포함하지 않는다.
