# Langfuse v3·v4 검토 의견 — 사내 플랫폼 API 백엔드 관점

> 확인일: 2026-10-12  
> 상태: 기술 검토·설계 제안. 운영 업그레이드 승인이나 성능 검증 결과가 아니다.  
> 검토 시나리오: 온프렘 Langfuse v3를 관측·평가 데이터 백엔드로 재사용하고, 자체 플랫폼에서 오프라인 평가·온라인 평가·에이전트 트레이싱 화면을 제공한다.  
> 한계: 실제 설치된 `v3.x.y`, SDK, Helm chart, 인프라 버전, 데이터 규모 및 라이선스·설정은 확인하지 않았다. 아래의 제품 사실은 공식 문서에, 선택·우선순위는 이 문서의 의견에 해당한다.

## 1. 결론부터

**평가·트레이싱을 시작하기 위해 v4가 반드시 필요한 것은 아니다. v3에서도 기본 수집·조회·평가 결과 저장을 활용할 수 있다.** 다만 세부 기능과 호환 SDK는 설치된 마이너 버전에 따라 확인해야 한다. [S2]

**권고안은 ‘v3로 짧은 기능 검증은 가능하지만, 새로 만드는 플랫폼의 장기 연동 대상은 v4로 잡는다’이다.** 가장 큰 이유는 새로운 조회 API에 맞춰 재개발할 일을 줄이고, v3의 보안 지원 종료에 대비하기 위해서다. 조회 성능과 검색·알림은 실제 요구에 따라 추가되는 이유다.

| 판단 질문 | 검토 의견 |
| --- | --- |
| 오프라인·온라인 평가와 트레이싱 때문에 지금 당장 v4가 필수인가? | 아니다. 기본 기능 검증과 외부 평가 결과 저장은 v3에서도 시작할 수 있다. |
| 자체 콘솔과 API 연동을 새로 본격 개발한다면? | v4를 목표로 설계하는 편을 권한다. v3 전용 계약에 깊이 결합하지 않는다. |
| 운영 서버를 즉시 교체해도 되는가? | 별도 판단이다. 배포 방식, SDK·API 의존성, 데이터 이전과 복구 계획을 먼저 검증한다. |
| 기존 v3가 충분히 빠르고 연동이 많은 경우는? | v3를 단기 유지하면서 어댑터 분리와 단계적 전환을 준비할 수 있다. |

Langfuse v4는 2026-08-17 정식 출시됐다. 온프렘에는 강제 전환일이 없으며, Cloud의 2026-11-16 전환 일정이 온프렘의 자동 중단일을 의미하지는 않는다. [S1]

## 2. 업그레이드를 권하는 네 가지 이유

### 2.1. 지금 만든 API 연동을 나중에 다시 고치는 일을 줄인다 — 가장 중요

v4의 기본 데이터 모델에서는 v3의 Trace·Observation·Session·Metrics·Dataset Run 조회 경로가 새 API로 교체된다. 단순히 서버 주소나 버전 숫자만 바꾸는 작업이 아니다. [S3]

자체 플랫폼에서 실행 목록·상세·대시보드를 새로 만든다면, v3 응답 구조에 맞춰 구현한 조회·페이지네이션·데이터 조합을 나중에 다시 고칠 수 있다. 따라서 **신규 개발일수록 처음부터 v4용 어댑터를 만드는 편이 유리하다**는 판단이다. 기존 v3 연동이 많다면 일괄 교체보다 어댑터 분리가 현실적이다.

### 2.2. v3 보안 패치 지원 종료에 대비한다 — 장기 운영의 핵심

공식 호환성 표는 v3 보안 패치 지원을 **2027-01-31까지**로 안내한다. 그날 설치된 서버가 멈춘다는 뜻도, 다음 날 즉시 취약해진다는 뜻도 아니다. 다만 그 이후에도 계속 운영할 플랫폼이라면 지원 정책을 고려한 전환 계획이 필요하다. [S2]

이 문서의 의견은 지원 종료일 직전에 처음 검증하기보다, 그 전에 목표 버전·이전 방식·복구 절차를 확정하는 것이다.

### 2.3. 데이터가 많아질 때 조회·집계 병목을 줄인다 — 규모에 따라 중요

v3는 분리된 Trace와 Observation 데이터를 조회할 때 조인과 업데이트 중복 제거가 필요했다. v4는 공통 속성을 Observation에 담는 모델로 전환해 조회 시 해야 하는 일을 줄인다. [S5]

공식 발표는 큰 프로젝트에서 목록 초기 조회와 장기간 대시보드 성능이 개선됐다고 설명한다. 이는 공급자가 제시한 결과이지, 모든 환경에서 같은 배수의 개선을 보장하는 수치는 아니다. [S1]

따라서 여러 서비스가 데이터를 쌓거나 긴 기간의 통계를 자주 조회할수록 전환 가치가 커진다고 판단한다. 지금도 목표 응답 시간을 만족한다면 성능만으로 즉시 업그레이드를 정당화하지 않는다.

### 2.4. 검색·운영 알림을 재사용한다 — 선택적 이유

v4는 본문 검색, 새 필터 검색창, 지표 임계치 기반 알림 등을 제공한다. [S1][S10] 본문 검색은 Observations API v2에서도 지원되며, 토큰 기반 검색이라는 제약이 있다. [S7]

그러나 **Langfuse의 UI 개선이 자체 플랫폼 화면으로 자동 이전되지는 않는다.** API로 가져올 수 있는 데이터와 직접 구현할 화면을 구분해야 한다. 원문을 저장하지 않거나 알림을 자체 구현한다면 이 이유의 우선순위는 낮다.

## 3. v3·v4 기능 비교

| 영역 | v3 | v4 | 자체 플랫폼 관점의 판단 |
| --- | --- | --- | --- |
| 기본 트레이싱·평가 결과 저장 | 활용 가능 | 활용 가능 | 기능을 시작하는 것 자체는 업그레이드 사유가 아니다. |
| 조회 계약 | 기존 Trace·Observation 등 API | Observations API v2, Metrics API v2 등 | 신규 개발 시 가장 큰 설계 차이다. |
| 관측 데이터 모델 | Trace·Observation 분리 | Observation 중심 | 대규모 필터링·집계의 구조적 개선이다. |
| 단계 단위 평가 | 공식 표상 v3.153.0 이상 지원 | 지원 | ‘단계 평가가 필요하니 무조건 v4’라고 설명하지 않는다. |
| 내장 알림 | 공식 표상 미지원 | 지원 | 기존 알림 체계와 재사용 범위를 비교한다. |
| 보안 지원 | 2027-01-31까지 | 지원 중 | 장기 운영을 위한 전환 계획의 근거다. |

지원 범위는 공식 호환성 표, 조회 계약은 API 이전 가이드, 데이터 모델은 기술 설명을 기준으로 한다. 표의 ‘v3 지원’은 모든 초기 v3 배포가 동일한 기능을 갖췄다는 의미가 아니다. [S2][S3][S5]

평가기·평가 규칙 관리용 안정화 API는 2026-08-27 발표됐으며 `/api/public/v2/evaluators`, `/api/public/v2/evaluation-rules`를 제공한다. 자체 콘솔에서 평가 설정을 관리하기에 유용하지만, **정확한 온프렘 지원 릴리스를 확인하지 않은 상태에서 모든 v4의 기본 제공 기능이나 v4만의 차이로 단정하지 않는다.** [S8]

## 4. API 백엔드로 사용할 때 실제 변경되는 부분

아래는 전체 API 명세가 아니라 업그레이드 영향도가 큰 경로만 추린 것이다. v4는 기본 모드인 `events_only`를 기준으로 한다. 이전 중 `legacy`·`dual` 모드에서는 기존 경로를 유지할 수 있다. [S6]

| 용도 | v3의 대표 경로 | v4의 대표 경로·방식 |
| --- | --- | --- |
| 요청 목록·상세 | `GET /api/public/traces`, `GET /api/public/traces/{id}` | `GET /api/public/v2/observations`에서 논리적 Root 또는 `traceId` 조건 사용 |
| 실행 단계 조회 | `GET /api/public/observations`, `GET /api/public/observations/{id}` | `GET /api/public/v2/observations`에서 조건 조회 |
| 특정 세션의 실행 내역 | `GET /api/public/sessions/{id}` | Observations API v2에서 `sessionId` 조건 사용 |
| 지연·비용·토큰 집계 | `GET /api/public/metrics`, `GET /api/public/metrics/daily` | `GET /api/public/v2/metrics` |
| 점수 조회 | 기존 Scores API | `GET /api/public/v3/scores` |
| 실험 결과 조회 | Dataset Runs·Dataset Run Items | `GET /api/public/experiments`, `GET /api/public/experiment-items` |

경로 대응은 공식 API 이전 가이드를 기준으로 한다. **특정 세션의 Observation을 조회하는 것과 기존 세션 목록 API의 응답을 그대로 대체하는 것은 다르다.** 필요한 목록·집계 형태는 별도로 설계한다. [S3]

점수 기록은 `POST /api/public/scores`를 계속 사용할 수 있다. 서버 버전, SDK 버전, URL에 포함된 API 버전은 서로 다른 체계이므로, ‘서버 v4이니 모든 경로가 `/v4`’라고 해석하면 안 된다. [S2]

### 연동 설계 의견

플랫폼의 `ExecutionSummary`, `ExecutionDetail`, `EvaluationResult` 같은 응답 계약은 Langfuse의 원본 응답과 분리하고, v3·v4 차이를 백엔드 어댑터에서 처리한다. 브라우저가 Langfuse 프로젝트 키를 직접 보유하지 않도록 한다.

Observations API v2는 필요한 필드를 선택하는 `fields`와 Cursor 페이지네이션을 사용한다. 목록에서는 최소 필드만, 상세에서는 필요한 내용을 추가 조회하는 방식이 적합하다. 개별 조회를 위해 존재하지 않는 `/api/public/v2/observations/{id}` 경로를 가정하지 않는다. [S4][S3]

또한 공식 Public API와 달리 내부 DB 스키마·프론트엔드 내부 API는 동일한 버전 호환성 보호 대상이 아니다. 자체 플랫폼이 이들에 직접 결합하지 않는 것을 권한다. [S2]

## 5. 화면에서 기대할 수 있는 이점과 직접 만들어야 할 것

| 화면 | 기대할 수 있는 개선 | 자체 플랫폼이 해야 할 일 |
| --- | --- | --- |
| 실행 탐색·상세 | 단계 데이터 조회와 필터링 개선 | 실행 트리·타임라인·오류 표시·서비스 권한 |
| 품질·비용 대시보드 | 새 집계 API 기반 조회 | 지표 정의, 분모, 배포 버전 비교, 화면 구성 |
| 본문 검색 | 입력·출력·메타데이터 검색 | 반입 가능한 데이터 결정, 한국어 검색 검증 |
| 운영 알림 | 임계치 감시와 외부 알림 연계 | 자체 콘솔에서의 설정 관리 범위·알림 전달 경로 검증 |
| 평가 설정 | 안정화 API로 평가기·규칙 관리 | 승인 흐름, 버전 정책, 테스트·적용 화면 |

제품 기능 근거는 데이터 모델·Public API·본문 검색·알림·평가기 API 문서를 따른다. 오른쪽 열은 이 문서의 구현 제안이다. [S5][S4][S7][S10][S8]

알림 기능이 있다는 사실만으로 자체 콘솔에서 필요한 모든 Alert CRUD가 공개 API로 지원된다고 가정하지 않는다. 목표 릴리스의 명세를 확인하기 전에는 해당 구현 비용이 없어졌다고 계산하지 않는다.

## 6. 업그레이드만으로 해결되지 않는 것

**실제 서비스 실행과 평가 작업 관리.** 이 시나리오에서는 서비스 호출, 작업 상태, 취소·재시도, 동시성·예산 제한을 플랫폼 실행기에 두는 것을 권한다. Langfuse에 결과를 저장하는 일과 사내 실행 권한을 가진 작업을 수행하는 일은 분리한다.

**전체 에이전트 경로 평가.** Observation 평가기는 매칭된 Observation의 데이터를 보며, 같은 Trace의 자식·형제 단계를 자동으로 합쳐 읽지 않는다. Root에 필요한 맥락을 기록하거나 외부에서 전체 경로를 모아 평가하는 설계가 필요하다. [S9]

**응답 전 차단과 HITL.** 운영 트래픽에 대한 평가가 곧 동기식 차단을 뜻하지 않는다. 내장 Observation 평가는 비동기 처리이므로, 실행 중 승인·도구 차단은 Runtime·Tool Gateway의 별도 책임으로 둔다. [S9]

**고객 원문 보호.** 원문 적재를 제한하는 정책이라면 데이터셋·도구 결과·오류·평가 사유에도 같은 기준을 적용한다. 보호된 환경에서 평가하고 허용된 점수·분류·참조 ID만 저장하는 방식을 권한다. 이 경우 원문 검색이나 내장 Judge의 활용 범위는 줄어든다.

**사용자 코드의 안전한 실행.** 공식 온프렘 코드 평가 문서는 운영용 `aws-lambda`와 신뢰된 코드용 `insecure-local`을 구분한다. 후자는 Worker 안에서 실행되며 비신뢰 코드를 위한 샌드박스가 아니다. 순수 온프렘 공용 코드 평가에는 별도 격리 실행 환경 검토가 필요하다. [S11]

## 7. 즉시 전환 여부를 결정할 선행 조건

다음 항목을 실제 배포 시점의 목표 릴리스·chart 기준으로 재확인한다.

| 확인 항목 | 공식 가이드 내용·판단 기준 |
| --- | --- |
| 인프라 최소 버전 | ClickHouse 25.12, PostgreSQL 15, Redis 7.0. 권장 버전은 각각 26.4, 16, 7.2이다. [S6] |
| Helm 내장 ClickHouse | `clickhouse.deploy: true`인 chart v1 배포는 Langfuse 서버 v4 전환 전에 chart v1→v2 업그레이드가 필요하다. 외부 ClickHouse를 사용하는 배포와 구분한다. [S13] |
| 과거 데이터 | 전체 백필은 현재 데이터 규모의 약 3배 수준 디스크 용량을 계획한다. 보존 정책에 따라 이중 기록 후 보존 기간이 경과하는 방식도 검토한다. [S6] |
| 기존 의존성 | 구형 SDK, 레거시 조회 API, Trace 기반 평가기, 레거시 Export를 식별한다. [S2][S3][S12] |

**Helm chart 버전과 Langfuse 서버 버전은 별개다.** 내장 ClickHouse를 쓰는 chart v1 배포라면 서버 이미지 태그만 바꾸지 않고, 공식 chart 이전 절차를 먼저 검증한다. ‘모든 Helm 배포는 v4 업그레이드가 불가능하다’고 일반화하지 않는다. [S13]

v4에서 실시간 가시성을 확보하기 위한 SDK 기준은 Python 4.7.0 이상, JS/TS 5.4.0 이상이다. 직접 OpenTelemetry 연동은 `x-langfuse-ingestion-version: 4`와 속성 전파 설정을 점검한다. 이 기준보다 낮은 일부 SDK도 수집은 가능하지만 지연이 발생할 수 있으므로, ‘수집 지원 여부’와 ‘실시간 조회 가능 여부’를 구분한다. [S2]

## 8. 권장 진행 순서와 완료 기준

다음은 전환 계획의 제안이며, 운영 명령서는 아니다.

1. **현황 확인:** 서버·SDK·인프라·chart 버전, 데이터 규모·보존 기간과 기존 연동을 기록한다.
2. **복구 준비:** 백업과 복구를 검증하고, 기존 마이그레이션 상태를 확인한다.
3. **호환 환경 검증:** 스테이징에 목표 조합을 준비하고 변경 범위를 나눈다.
4. **연동 이전:** 수집, 조회 어댑터, 평가·실험, Export를 새 모델에 맞춘다.
5. **데이터 검증:** 승인된 사례로 목록·상세·점수 연결·필터 결과·평가 커버리지·수집 지연을 대조한다. 조회 성능도 실측한다.
6. **전환 판단:** 과거 데이터 처리와 의존성 검증 후 기본 모드로 전환한다. 복구 범위를 확인하기 전에 레거시 데이터를 정리하지 않는다.

공식 가이드는 **최신 v3의 모든 백그라운드 마이그레이션 완료와 PostgreSQL·ClickHouse 백업**을 서버 업그레이드 선행 조건으로 둔다. v4 스키마 변경에는 기존 테이블 제거가 포함되므로 미완료 상태에서 진행하지 않는다. [S6]

`legacy`·`dual`은 이전용 모드이지 영구 운영 방안이 아니다. `events_only` 전환 후에는 기존 조회 API와 Trace 기반 평가기가 동작하지 않는다. 롤백은 단순 이미지 교체가 아니라 스키마 복구 또는 백업 복원을 검토해야 한다. [S6]

### 승인 전 체크리스트 — 제안

- [ ] 목표 `v4.x.y`, SDK, 인프라·chart 조합이 고정됐는가?
- [ ] 지원되지 않는 SDK·API·평가기·Export 의존성이 해소됐는가?
- [ ] 신규 수집과 필요한 과거 데이터가 조회되며 점수 연결이 유지되는가?
- [ ] 요청 수와 Observation 수, 실행 오류와 평가 오류를 구분했는가?
- [ ] 목록·상세·통계의 목표 응답 시간과 수집 지연 기준을 충족하는가?
- [ ] 원문·권한·평가 실행 격리 정책을 충족하는가?
- [ ] 복구 절차와 전환 후 검증 책임자가 정해졌는가?

## 9. 최종 검토 의견

**v4를 ‘평가 기능을 켜기 위한 필수 업그레이드’로 설명하지 않는다. ‘새 플랫폼의 조회 계약과 장기 운영 기반을 정하는 선택’으로 설명한다.**

신규 콘솔·API 개발이 본격화되기 전이라면 v4 목표 설계의 우선순위가 높다. 반대로 단기 기능 검증이거나 배포 선행 조건을 충족하지 못했다면 v3를 유지하면서 전환 준비를 진행할 수 있다. 성능 개선 폭은 실측하고, 검색·알림은 실제로 재사용할 때만 이점으로 평가한다.

이 문서는 운영 변경 승인이 아니라 **기술 검토 의견**이다. 설치 버전·배포 방식·데이터 규모가 확인되면 전환 시점과 실행 계획을 구체화한다.

## 참고 자료

모두 Langfuse 공식 자료이며 확인일은 2026-10-12이다. 변경될 수 있는 호환성·지원 일정·배포 제약은 실행 시 다시 확인한다.

- [S1: Langfuse v4 정식 출시 — 2026-08-17](https://langfuse.com/changelog/2026-08-17-langfuse-v4)
- [S2: Self-hosted Versions & Compatibility](https://langfuse.com/self-hosting/upgrade/versioning)
- [S3: Deprecated API Migration](https://langfuse.com/faq/all/deprecated-api-migration)
- [S4: Public API](https://langfuse.com/docs/api-and-data-platform/features/public-api)
- [S5: Simplifying Langfuse for Scale](https://langfuse.com/blog/2026-03-10-simplify-langfuse-for-scale)
- [S6: Migrate Langfuse v3 to v4 — Self-hosted](https://langfuse.com/self-hosting/upgrade/upgrade-guides/upgrade-v3-to-v4)
- [S7: Full-Text Search](https://langfuse.com/docs/observability/features/full-text-search)
- [S8: Stable Evaluator API — 2026-08-27](https://langfuse.com/changelog/2026-08-27-stable-evaluator-api)
- [S9: LLM-as-a-Judge](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge)
- [S10: Monitors and Alerts](https://langfuse.com/changelog/2026-06-19-monitors)
- [S11: Code Evaluators — Self-hosted](https://langfuse.com/self-hosting/configuration/code-evaluators)
- [S12: Upgrade to Observation-Level Evaluators](https://langfuse.com/faq/all/llm-as-a-judge-migration)
- [S13: Upgrading a Self-Hosted Deployment — Helm chart 버전 구분](https://langfuse.com/self-hosting/upgrade)

[상위 문서: AI 에이전트](../README.md)

[S1]: https://langfuse.com/changelog/2026-08-17-langfuse-v4
[S2]: https://langfuse.com/self-hosting/upgrade/versioning
[S3]: https://langfuse.com/faq/all/deprecated-api-migration
[S4]: https://langfuse.com/docs/api-and-data-platform/features/public-api
[S5]: https://langfuse.com/blog/2026-03-10-simplify-langfuse-for-scale
[S6]: https://langfuse.com/self-hosting/upgrade/upgrade-guides/upgrade-v3-to-v4
[S7]: https://langfuse.com/docs/observability/features/full-text-search
[S8]: https://langfuse.com/changelog/2026-08-27-stable-evaluator-api
[S9]: https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge
[S10]: https://langfuse.com/changelog/2026-06-19-monitors
[S11]: https://langfuse.com/self-hosting/configuration/code-evaluators
[S12]: https://langfuse.com/faq/all/llm-as-a-judge-migration
[S13]: https://langfuse.com/self-hosting/upgrade
