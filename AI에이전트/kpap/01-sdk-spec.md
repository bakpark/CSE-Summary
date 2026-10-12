# kpap SDK 요구사항과 명세

검토용 v0.3. 대상은 Python·Java 대고객 서비스 개발자다. [공통 규격](00-common-contracts.md)을 적용한다.

## 범위

SDK는 서비스 실행 연동만 제공한다. 리소스 탐색·관리 조회·데이터셋·평가 관리 기능은 [Plugin](02-plugin-spec.md)에 둔다.

실행용 설정·프롬프트 로딩과 task 완료 확인은 내부 처리로 유지한다. 기존 고객 API에 A2A 도입을 강제하지 않는다.

## 요구사항

| ID | 요구사항 | 완료 기준 |
|---|---|---|
| SDK01 | 서비스 인증·연결 | 프로젝트·환경·자격증명 격리 |
| SDK02 | 요청별 실행 문맥 | 병렬 요청의 설정·trace 혼입 없음 |
| SDK03 | 설정 바인딩 | 실제 snapshot·코드 버전 기록 |
| SDK04 | 프롬프트 적용 | 변수 검증 후 로컬 렌더링 |
| SDK05 | 모델 호출·스트림 | 응답·오류·사용량 연결 |
| SDK06 | 도구 메서드 호출 | 입력 검증·호출/시도 집계 |
| SDK07 | RAG 검색 | 검색 설정·출처 연결 |
| SDK08 | 에이전트 호출 | 즉시 응답·task·추가 입력·취소 처리 |
| SDK09 | 선택적 A2A 노출 | 선언한 capability만 제공 |
| SDK10 | 계측·상태 보고 | 업무 결과와 관측 송신 분리 |
| SDK11 | 실패 처리 | 제한시간·취소·멱등성 유지 |
| SDK12 | 선택적 고객 피드백 | 해당 run에 제출 |

## 공개 인터페이스

Python은 동기·비동기 클라이언트를 제공한다. Java 네트워크 호출은 CompletionStage를 반환한다. 렌더링과 scope 결과 지정은 로컬 동작이다.

| 기능 | Python | Java |
|---|---|---|
| 실행 시작 | runtime.start(request) | runtime().start(request) |
| scope 실행 | runtime.scope(request) | runtime().withRun(request, handler) |
| 결과 지정 | ctx.set_output(output) | ctx.setOutput(output) |
| 직접 종료 | ctx.complete(output), ctx.fail(error) | ctx.complete(output), ctx.fail(error) |
| 모델 | models.generate(bound_model, messages) | models().generate(boundModel, messages) |
| 모델 스트림 | models.stream(bound_model, messages) | models().stream(boundModel, messages) |
| 프롬프트 | prompts.render(bound_prompt, variables) | prompts().render(boundPrompt, variables) |
| 도구 | tools.call(bound_tool, arguments) | tools().call(boundTool, arguments) |
| RAG | rag.search(bound_knowledge, query) | rag().search(boundKnowledge, query) |
| 에이전트 | agents.invoke(agent_id, request) | agents().invoke(agentId, request) |
| 에이전트 스트림 | agents.stream(agent_id, request) | agents().stream(agentId, request) |
| 진행 제어 | execution.wait(), send_input(), cancel() | execution.awaitResult(), sendInput(), cancel() |
| 피드백 | feedback.submit(run_id, feedback) | feedback().submit(runId, feedback) |
| 종료 | flush(), close() | flush(), close() |

RunContext는 run_id, snapshot_id, 실제 코드 버전, 바인딩 자원, deadline, trace 문맥을 가진다. ctx.model/prompt/tool/knowledge는 확정 자원 핸들을 반환한다. 자원을 검색하지 않는다.

응답은 업무 출력·상태·오류·사용량·자원 버전·호출 ID를 제공한다. 없는 사용량·비용은 unknown으로 기록한다.

## 실행 계약

1. 서버가 입력·설정·권한을 검증한다.
2. SDK가 확정 설정을 적용하고 확인을 보고한다.
3. 핸들러가 같은 문맥으로 모델·도구·RAG를 호출한다.
4. SDK가 업무 결과와 관측을 각각 보고한다.

기존 runtime_binding이 있으면 같은 run에 참여한다. 고객 입력의 임의 설정을 직접 적용하지 않는다. scope는 정상·오류 종료를 한 번만 보고한다.

## 전송과 예외

| 목적 | 제안 API |
|---|---|
| 실행 시작·설정 공급 | POST /runtime/runs |
| 바인딩 검증 | POST /runtime/bindings/verify |
| 적용·상태·결과 보고 | POST /runtime/runs/{id}/events |
| 에이전트 실행 | POST /agents/{id}/runs |
| 모델·도구·검색 | 기존 Gateway·도구·RAG API |
| 피드백 | POST /runs/{id}/feedback |

설정 로딩 실패는 기본적으로 실행을 막는다. 대체 설정은 사전에 허용한 불변 스냅샷만 사용하고 적용 사실을 기록한다.

관측 송신 실패는 성공한 고객 응답을 바꾸지 않는다. 버퍼·재시도·종료 대기에 상한을 둔다. 부작용 도구는 멱등성 계약 없이 자동 재시도하지 않는다. 스트림 단절은 자동 재생성을 하지 않는다.

## 완료 조건

두 SDK가 같은 설정·오류·추적 계약을 제공해야 한다. 서비스 배포는 Plugin·관리 클라이언트·평가 worker에 의존하지 않아야 한다. 언어 버전·프레임워크 어댑터·송신 한도는 구현 전에 확정한다.
