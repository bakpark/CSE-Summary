# kpap 공통 규격

검토용 v0.4. API와 타입은 개발 제안이다. 작성 기준은 [문서 원칙](AGENTS.md)을 따른다.

## 책임

| 구성요소 | 책임 |
|---|---|
| SDK | 고객 서비스 실행·설정 적용·호출·계측 |
| Plugin | 리소스 탐색·SDK 적용·로컬 실행·평가 |
| Playground | 설정·호출·온라인/오프라인 평가·분석 |
| kpap | 권한·설정·실행·평가 관리 |
| Langfuse v3 | 상세 관측·사용량·비용·연계 점수 |

## 실행과 설정

- run_id는 업무 실행을 식별한다. A2A task/context와 trace는 별도로 연결한다.
- 업무 재실행은 새 run_id를 만든다. 기존 결과 재평가는 새 evaluation_id를 만든다.
- 설정은 공통값과 node_id별 모델·프롬프트·도구·지식 변경값으로 구성한다.
- 스냅샷은 코드·노드 정의 버전과 노드별 실제 적용값을 고정한다.
- 노드별 값이 없으면 공통값을 상속한다. 지원하지 않는 노드·필드는 거절한다.
- 적용 순서는 기본값 → 프로필 → 허용된 요청 변경 → 검증 → 불변 스냅샷이다.
- 객체는 필드별 병합한다. 배열은 전체 교체한다. phase와 version은 동시에 지정하지 않는다.
- phase는 실제 버전으로 해석한다. 실행 중 설정은 바꾸지 않는다.
- 런타임은 적용한 snapshot_id·코드 버전을 보고한다.
- 서버는 binding의 호출 주체·run·대상·만료를 검증한다.
- 미지원·권한 없음·적용 실패는 실행 전에 반환한다.
- 비밀값은 스냅샷에 넣지 않는다.

## 상태

| 대상 | 상태 |
|---|---|
| 업무 실행 | queued, running, waiting_input, succeeded, failed, cancelled |
| 관측 수집 | pending, partial, complete, unavailable |
| 평가 | pending, running, succeeded, failed, skipped, cancelled |

취소 접수는 취소 완료와 다르다. 원격 결과를 모르면 remote_state=unknown을 기록한다. 스트림 종료만으로 성공을 판단하지 않는다.

오류는 code·message·retryable·run_id·request_id·field_errors를 제공한다.

## 관측과 평가

node_id는 등록 노드를 식별한다. invocation_id는 해당 노드의 한 번의 수행을 식별한다. 관측은 run·node·invocation에 연결한다.

logical_call_id는 한 호출을 식별한다. attempt_id는 재시도를 식별한다. 중복 보고를 한 번만 집계한다.

평가는 대상·평가기 버전·척도·상태·점수·판정·근거를 기록한다. 실행 실패·평가 실패·제외를 0점과 구분한다. 비교는 같은 입력·평가 기준의 유효 쌍만 사용한다.

## API와 저장

kpap 기본 경로 제안은 /api/v1이다. 목록은 cursor·limit을 사용한다. 생성은 멱등키, 변경은 ETag·If-Match를 사용한다. 시각은 UTC로 저장하고 사용자 시간대로 표시한다.

데이터별 원본 저장소는 하나로 정한다. SDK는 관측을 송신한다. kpap 서버가 Langfuse를 조회한다. 상세는 [연동 명세](08-langfuse-v3-integration.md)를 따른다.

## 그래프 조회·A2A 확장

SDK 호스트의 그래프 응답과 A2A 노드별 변경값은 [그래프·A2A 규약](../agentic%20platform/kpap-graph-minimal-contract.md)을 따른다. 공통값·프로필 해석 후 wire 변경값은 최상위 키 단위로 교체한다. knowledge 객체와 tools 배열은 전체 교체한다. 요청별 스냅샷·run 바인딩·실제 적용 확인 원칙은 유지한다.
