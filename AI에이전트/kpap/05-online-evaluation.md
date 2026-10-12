# kpap 온라인 평가 규칙

운영 응답 완료 후 비동기 평가한다. 화면은 [Playground 기획](07-playground-product-spec.md)을 따른다.

## 요구사항

| 기능 | 규칙 |
|---|---|
| 평가 | 코드 검사·LLM judge·피드백 출처 분리 |
| 정책 | 대상·평가기·입력 범위·표본·예산·제한시간을 버전 관리 |
| 선택 | run 기반 안정적인 표본. 오류 추가 수집 집단 분리 |
| 실행 | 완료 이벤트 → 조건 확인 → 작업 → 결과 |
| 중복 | run·대상·정책·평가기 버전으로 제거 |
| 지연 | 필수 데이터만 기다리고 제한시간 후 제외 |
| 실패 | 일시 오류만 제한 재시도. 운영 응답 유지 |
| 비용 | 신규 배정 전 예약. 평가 비용 별도 |
| 재평가 | 새 evaluation_id. 기존 run·결과 보존 |
| 환류 | 문제 사례를 검토한 뒤 데이터셋에 반영 |

정답 없는 실행에 exact match를 적용하지 않는다. judge 출력 규격 오류는 평가 실패다. 점수·피드백을 정답으로 자동 확정하지 않는다.

응답 차단·자동 승격·롤백·온라인 A/B 배정은 별도 범위다.

## 지표

| 지표 | 정의 |
|---|---|
| 커버리지 | 유효 평가 실행 수 / 대상 운영 실행 수 |
| 표본 완료율 | 유효 평가 실행 수 / 선택 실행 수 |
| 통과율 | 통과 수 / 유효 판정 수 |
| 실패율 | 실패 작업 수 / 생성 작업 수 |
| 평가 지연 | 업무 완료부터 평가 완료까지 |
| 비용 | 알려진 평가 비용·미상 건수 |

평가기별 지표를 분리한다. 분모는 운영 run 기록을 사용한다. 기록이 불완전하면 관측된 실행의 지표로 표시한다.

## API

기본 경로는 /api/v1이다.

| 계약 | API |
|---|---|
| 정책 생성·조회 | POST·GET /online-evaluation-policies, GET /online-evaluation-policies/{id} |
| 정책 버전 | POST /online-evaluation-policies/{id}/versions |
| 시험·활성화·중지 | POST /online-evaluation-policies/{id}/previews, /activate, /pause |
| 결과·집계 | GET /online-evaluations, /online-evaluations/{id}, /online-evaluation-metrics |
| 피드백 | POST /runs/{id}/feedback |
| 재평가 | POST /online-evaluations/{id}/reevaluations |
| 사례 후보 | POST /dataset-candidates |

완료 기준은 응답과 평가 분리, 중복 방지, 정책·근거·trace 연결, 예산 준수다. 기본 표본·한도·루브릭은 운영량 확인 후 확정한다.
