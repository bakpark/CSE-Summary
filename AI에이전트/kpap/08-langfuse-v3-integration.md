# kpap Langfuse v3 연동 명세

대상은 self-hosted 서버 v3다. SDK는 관측을 송신한다. kpap 서버가 조회하고 Plugin·Playground에 제공한다.

실제 배포 릴리스·OpenAPI는 미확인이다. 아래는 연동 후보 계약이다. 필드·필터·지원 기능은 배포 서버에서 검증한다.

## 데이터 책임

| 데이터 | 원본 |
|---|---|
| 설정·실행 상태·정책·분모 | kpap |
| 상세 관측·사용량·비용 | Langfuse |
| 데이터셋·고정 입력·평가 결과 | 기존 평가 저장소 또는 kpap. 객체별 하나로 확정 |
| kpap 평가의 LF score | 원본 결과의 투영 |
| Langfuse 생성 score | 외부 평가 출처 |

## API

Langfuse 기본 경로는 /api/public이다.

| 목적 | endpoint 계열 |
|---|---|
| trace | GET /traces, /traces/{id} |
| 관측 | GET /observations, /observations/{id} |
| 대화 | GET /sessions, /sessions/{id} |
| 점수 조회 | GET /scores 또는 /v2/scores 및 상세 |
| 점수 투영 | POST /scores |
| 집계 | GET /metrics |
| 기존 실험 | GET /datasets/{name}/runs 및 /runs/{runName} |
| 실험 항목 | GET·POST /dataset-run-items |

기존 계열은 [공식 API 목록](https://langfuse.com/faq/all/deprecated-api-migration)에 명시되어 있다. self-hosted v3에 최신 observation·metrics v2를 기본 적용하지 않는다. [호환성 표](https://langfuse.com/self-hosting/upgrade/versioning)

## 연결 규칙

- run_id·snapshot·코드 버전·출처를 관측에 연결한다.
- trace_id·observation_id는 run과 별도로 매핑한다.
- 공유 trace에서는 해당 run의 관측 범위를 제한한다.
- 업무 trace와 judge trace를 분리한다.
- score_id와 원본 evaluation_id를 연결한다.
- 점수 재전송은 안정적인 투영 키로 중복을 방지한다.
- 평가 실패·제외를 숫자 점수로 투영하지 않는다.
- 기존 LF dataset run은 필요한 경우에만 연결한다.
- 변경 가능한 데이터 항목만 참조하여 재현성을 주장하지 않는다.
- 정책·평가기 생성과 실행은 kpap 평가 기능이 담당한다.

## 화면 계약

| kpap 데이터 | 주요 필드 |
|---|---|
| 관측 요약 | run·trace·수집 상태·시간·알려진 사용량/비용 |
| 관측 구간 | id·부모·종류·시간·오류·호출/시도 ID |
| 관측 상세 | 입력·출력·마스킹·자원·검색 출처 |
| 평가 | 원본·출처·버전·상태·점수·근거·업무/judge trace |
| 집계 | 조건·기간·단위·분모·미상 수·갱신 시각 |

이 필드는 kpap 응답 계약이다. Langfuse 원본 필드로 가정하지 않는다. 없는 값은 미상으로 표시한다.

브라우저는 Langfuse 비밀키를 받지 않는다. 서버는 프로젝트 매핑·권한·마스킹·페이지·캐시를 처리한다. 상세 원문은 선택 시 조회한다.

업무 결과는 kpap·A2A 이벤트로 표시한다. 관측 지연·조회 실패는 결과를 숨기지 않는다. 404는 수집 전·삭제·매핑 오류를 대조한다. 조회 오류를 빈 데이터로 처리하지 않는다.

정책 대상·표본·실패 분모는 kpap에서 집계한다. Langfuse는 지원하는 비용·사용량·점수 집계에 사용한다.

## 완료 기준

Python·Java 실행, 업무/judge trace, score 연결을 배포 v3에서 확인한다. 지연·중복·삭제·권한·페이지·필터를 검증한다. 화면은 Langfuse 버전별 원본 응답에 직접 의존하지 않아야 한다.
