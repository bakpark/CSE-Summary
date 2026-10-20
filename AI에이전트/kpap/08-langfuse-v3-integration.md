# Playground · Langfuse 연동

## 설계 원칙

Playground가 kpap 서버를 통해 모든 A2A 호출을 시작한다. 플랫폼은 호출 사실과 실행 상태를 알고 있으며, 상세 실행 이력은 SDK가 Langfuse에 기록한다. Playground는 필요할 때 kpap 서버를 통해 조회한다.

**플랫폼에는 실행 목록과 상세 조회에 필요한 최소 정보만 저장한다.** 프롬프트·응답·노드별 로그·사용량·비용을 플랫폼 DB에 중복 저장하지 않는다.

## 역할

| 구성 요소 | 책임 |
|---|---|
| Playground · kpap | A2A 호출, 최소 실행 기록, 이력 조회와 화면 표시 |
| SDK 호스트 | 에이전트 실행, 상태·결과 응답, 노드·모델·도구 계측 |
| Langfuse | 상세 입력·출력·관측·사용량·비용 저장과 조회 |

실시간 응답·실행 상태는 A2A로 받고, 상세 트레이스는 Langfuse에서 조회한다. Langfuse 조회 실패가 A2A 실행 결과를 바꾸지 않는다.

## 플랫폼 최소 저장 정보

기존 프로젝트·에이전트·세션 정보를 참조하며, 실행별 중복 저장은 피한다.

| 항목 | 용도 |
|---|---|
| runId · sessionId · agentId | 실행 목록과 세션 연결 |
| traceId | 호출 전에 생성한 Langfuse 상세 조회 ID |
| status · createdAt · startedAt · endedAt | 실행 상태와 목록 표시. 상태는 A2A 응답·이벤트로 갱신 |
| taskId · contextId | A2A Task가 반환된 경우에만 저장 |
| snapshotId | 기존 설정 스냅샷 참조. 그래프·코드 버전과 실제 적용 설정은 스냅샷에서 관리 |

Langfuse 접속 정보와 프로젝트 매핑은 플랫폼 설정에서 관리한다. 과거 매핑을 고정할 수 없을 때만 실행에 telemetryTargetId를 저장한다. 상세 관측과 조회 오류는 필요할 때 조회하며, 별도 관측 상태 저장은 기본 요구사항으로 두지 않는다.

## SDK 연결 계약

- 실행 접수 단계에서 runId와 traceId를 연결한다. 최종 응답이 유실되어도 연결할 수 있도록 한다. 선할당과 runtime binding 제안은 [구현 스펙](12-playground-observability-tech-spec.md)을 따른다.
- 기본 단위는 실행당 trace 하나, 세션당 여러 trace다. 동일 실행의 추가 입력은 기존 run을 유지한다.
- 각 노드 관측에 runId · nodeId · invocationId를 기록한다. 재시도는 attemptId로 구분한다.
- 실제 적용 설정은 snapshotId로 연결한다. 요청별 설정을 격리한다.

## 화면과 한계

| 화면 | 데이터 출처 |
|---|---|
| 실행 목록·현재 상태 | 플랫폼 최소 실행 기록 |
| 실시간 응답 | A2A 응답·스트림 |
| 입력·출력·노드별 상세·사용량·비용 | Langfuse |
| 플로우차트와 실행 표시 | GraphSpec + nodeId로 연결한 관측 |

Langfuse는 비동기로 수집하므로 실행 직후 상세가 없을 수 있다. 이때 “트레이스 아직 조회되지 않음”을 표시하고 다시 조회한다. 조회 오류는 별도로 표시한다.

계측한 동작만 볼 수 있다. 관측이 없는 노드를 즉시 미실행으로 판단하지 않는다. 정확한 분기·반복 경로가 필요하면 SDK가 해당 실행 정보도 기록한다.

취소·추가 입력·재개는 SDK 호스트가 처리한다. Langfuse는 런타임 상태나 체크포인트를 대체하지 않는다. Langfuse 데이터 삭제 시 해당 상세 이력도 조회할 수 없다.

## 연동 범위와 검증

현재 대상은 self-hosted Langfuse v3다. 실제 배포 릴리스·OpenAPI는 확인이 필요하다. 기본 조회 후보는 `/api/public/traces/{id}`, `/api/public/observations`, `/api/public/sessions/{id}`이며, 배포 버전에서 응답·페이지 처리를 검증한다. 최신 v2 조회 API를 v3에 그대로 적용하지 않는다.

브라우저에 Langfuse 비밀키를 전달하지 않는다. kpap 서버가 기존 프로젝트 권한을 확인하고 조회한다.

통합 검증은 세 가지에 집중한다.

1. 동시 호출의 설정·run·trace가 섞이지 않는가.
2. 반복·병렬·재시도 관측이 그래프 노드와 연결되는가.
3. 관측 지연·장애 중에도 A2A 결과와 실행 목록을 표시하는가.

평가 정책·실행은 기존 평가 계약을 따른다. 업무 trace와 평가 trace는 구분하고 evaluationId와 score를 연결한다.

참고: [분산 트레이싱](https://langfuse.com/docs/observability/features/trace-ids-and-distributed-tracing) · [v3 비동기 수집](https://langfuse.com/self-hosting/upgrade/upgrade-guides/upgrade-v2-to-v3) · [서버·SDK 호환성](https://langfuse.com/self-hosting/upgrade/versioning)

참고 아키텍처·SDK 필수 계약·버전 호환·저장 필드·조회 API는 [구현 스펙](12-playground-observability-tech-spec.md)에 정의한다.
