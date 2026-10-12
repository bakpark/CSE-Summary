# kpap Plugin 요구사항과 API

검토용 v0.3. Plugin은 [SDK](01-sdk-spec.md)를 사용하는 개발자를 지원한다. 고객 서비스 배포 의존성에서 제외한다.

## 구성

Skill은 사용 절차를 안내한다. MCP는 플랫폼 자원을 조회한다. 개발 CLI는 로컬 실행·평가 worker·파일 검증을 담당한다. 관리 클라이언트와 worker는 SDK에서 분리한다.

## 요구사항

| ID | 기능 | 결과 |
|---|---|---|
| PLG01 | 프로젝트 연결 | 프로젝트·환경·인증 설정 |
| PLG02 | SDK 설치·적용 | 호환 설치 방법·핸들러 변경안 |
| PLG03 | 리소스 탐색 | 모델·프롬프트·도구·지식·에이전트·평가기 후보 |
| PLG04 | 상세 확인 | 실제 버전·변수·입출력·능력·권한 |
| PLG05 | 연결·코드 진단 | 오류·미계측 후보·수정안 |
| PLG06 | 로컬 실행 | 결과·실제 설정·trace 링크 |
| PLG07 | 등록 지원 | 엔드포인트·슬롯·capability 등록안 |
| PLG08 | 데이터셋 관리 | 항목 검증·새 불변 버전 |
| PLG09 | 로컬 평가 | 고정 조건·worker·진행·결과 |
| PLG10 | 비교·분석 | 회귀·개선·근거·Playground 링크 |
| PLG11 | 선택적 정적 분석 | 로컬 진단·선택적 요약 전송 |

검색은 소수 후보를 먼저 보여준다. 선택 후 상세를 읽는다. 실제 조회한 ID로 SDK 설정·코드를 구성한다. 정적 분석은 실제 실행 사실로 단정하지 않는다.

## 개발 흐름

연결 → SDK 설치 → 리소스 선택 → 핸들러 적용 → 로컬 실행 → 고정 데이터셋 평가 → Playground 비교.

명령 제안은 /kpap:setup, resources, doctor, run, dataset, eval, compare다. 프로젝트 파일은 자원 참조·핸들러 진입점만 저장한다. 자격증명은 사용자 환경에 둔다.

## 필요 API

기본 경로는 /api/v1이다. 모든 요청은 프로젝트·환경·권한을 검증한다.

| API | 입력 → 결과 |
|---|---|
| GET /capabilities, /me, /projects | 인증 → 호환 기능·권한·프로젝트 |
| GET /catalog/{kind} | q·능력·cursor → 후보·실제 버전 |
| GET /catalog/{kind}/{id} | 버전 또는 phase → 스키마·변수·허용 옵션 |
| POST /agents, PATCH /agents/{id} | 엔드포인트·슬롯·능력 → 등록 버전 |
| GET /config-profiles | 에이전트·환경 → 프로필·버전 |
| POST /config-resolutions | 선택·변경값 → snapshot·검증 결과 |
| POST /runtime/runs | 입력·설정·코드 버전 → run·binding |
| GET /runs/{id}, /runs/{id}/observations | run → 결과·관측 |
| GET /datasets, /datasets/{id}/versions | 필터 → 목록·고정 버전 |
| GET /datasets/{id}/versions/{version}/items | cursor → 항목·평가 전용 정답 |
| POST /datasets/{id}/imports/validate | 항목 → validation_id·행별 오류 |
| POST /datasets/{id}/versions | validation_id·If-Match → 불변 버전 |
| GET /evaluators | 목적·정답 요구 → 버전·척도 |
| POST /experiments | 고정 조건·실행 모드 → 실험 |
| GET /experiments/{id}, /experiments/{id}/results | 필터 → 진행·항목·평가 |
| POST /experiments/{id}/cancel | 이유 → 취소 접수 |
| POST /experiments/{id}/leases | worker·capacity → lease·항목·binding |
| POST /leases/{id}/heartbeat, /leases/{id}/results | 갱신 또는 결과 → 접수 상태 |
| POST /experiment-comparisons | 기준·후보 → 유효 쌍·차이 |
| GET /experiment-comparisons/{id} | 필터·cursor → 비교 상세 |

kind는 models, prompts, tools, knowledge, agents, evaluators다. catalog는 기존 자원을 연결하는 어댑터다.

검색 응답은 items·next_cursor를 반환한다. 항목은 id·설명·버전·능력·허용 동작을 포함한다.

실험 조건은 코드·데이터셋·설정·평가기 버전과 반복·병렬도를 고정한다. lease는 run·item·시도·만료·binding을 포함한다. 결과는 실제 적용 버전·업무 상태·출력 또는 오류·trace 참조를 제출한다.

## 예외와 완료 조건

정답은 핸들러에 전달하지 않는다. 중복 제출은 제거한다. 만료 lease·버전 충돌은 거절한다. 제출 접수와 평가 완료를 구분한다.

로컬 중단은 신규 배정을 멈춘다. 재접속은 같은 실험을 이어간다. 오류에는 수정·재인증·재접속 등 다음 행동을 제공한다.

Plugin에서 만든 실행·실험은 Playground에서 같은 ID로 열려야 한다. 권한 없는 자원·원문·비밀값을 노출하지 않아야 한다.
