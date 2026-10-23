# Playground 관측 프로토타입

검토용 / 2026-10-23. Langfuse v3.122.1의 관측 화면과 공개 API를 기준으로 만든 독립 실행형 UI 시안이다.

## 실행

[dist/index.html](dist/index.html)을 내려받아 브라우저로 연다. 설치와 빌드는 필요 없다. GitHub 파일 화면은 HTML을 실행하지 않는다.

또는 이 폴더에서 다음 명령을 실행하고 http://localhost:8000 을 연다.

```sh
python3 -m http.server 8000 --directory dist
```

## 범위

- 관측만 포함한다. 실행·평가 탭은 기존 화면 맥락을 표시하는 비활성 항목이다.
- Traces 목록, 상세 미리보기, 호출 트리·타임라인, 입력·출력·메타데이터·점수, Sessions를 제공한다.
- 모든 데이터는 가상 데이터다. 실제 API 호출, 인증, 서버 저장은 구현하지 않았다.
- 기존 [노드 작업공간](../prototype-node-workspace/README.md) 및 [프로토타입](../prototype/README.md)을 대체하지 않는다.

## API 제약

- 북마크 변경과 미구현 metadata 조건은 제외했다.
- 자유검색, Level·지연시간 조건, 내보내기는 **조회한 페이지**에만 적용한다.
- 세션 목록은 ID·생성 시각·환경을 표시한다. 상세 합계는 불러온 trace 기준이다.
- 호출 트리·타임라인은 공개 Trace 응답의 observations로 구성할 수 있다.
- 전체 집계·전체 내보내기는 별도 Metrics API 조합 또는 전체 페이지 조회가 필요하다.
- Log View는 관측 이벤트의 시간순 보기다. 서버 원문 로그가 아니다.
- 실제 설치 버전의 OpenAPI와 페이지네이션을 검증해야 한다. v3.122.1 소스 검토는 배포 환경의 동작 보장이 아니다.

## 플로우 연계 제안

상세의 **플로우**는 조건부 연결 데모다. 실행 당시 그래프 스냅샷과 안정적인 노드 식별자가 필요하다.

- trace 실행 문맥의 graphVersion·runId로 그래프 버전을 선택한다.
- observation의 nodeId로 설계 노드와 호출을 1:N 연결한다.
- 노드 선택은 관련 호출을 표시한다. 호출 선택은 대응 노드를 강조한다.
- 매핑 없는 호출은 숨기지 않는다. 기록 없는 노드를 미실행으로 단정하지 않는다.
- 관측 수·오류 수만 표시한다. 중첩·병렬 호출 시간을 단순 합산하지 않는다.
- 표시명으로 연결하거나 span 트리에서 설계 그래프를 복원하지 않는다.

이 필드는 논리 계약 예시다. 기존 [관측 구현 스펙](../12-playground-observability-tech-spec.md)과 SDK 어댑터에서 실제 필드명을 확정한다. 전체 그래프를 observation마다 저장하지 않는다. 플랫폼 백엔드는 권한·에이전트 범위·마스킹을 확인하고 Langfuse를 조회한다. 프로젝트 비밀키를 브라우저에 넣지 않는다.

## 검증 상태

- JavaScript 문법 검사 및 mock-DOM smoke 검사 통과.
- 실제 브라우저 렌더링·모바일 시각 QA는 미완료.
- 실제 Langfuse API 및 SDK 통합 검증은 미완료.

## 근거

- [v3.122.1 Traces 공개 API](https://github.com/langfuse/langfuse/blob/v3.122.1/web/src/features/public-api/server/traces.ts)
- [v3.122.1 Trace 화면](https://github.com/langfuse/langfuse/blob/v3.122.1/web/src/components/trace/index.tsx)
- [v3.122.1 Observation 화면](https://github.com/langfuse/langfuse/blob/v3.122.1/web/src/components/trace/ObservationPreview.tsx)
- [v3.122.1 Sessions 화면](https://github.com/langfuse/langfuse/blob/v3.122.1/web/src/components/session/index.tsx)
- [v3.122.1 Metrics 공개 API](https://github.com/langfuse/langfuse/blob/v3.122.1/web/src/pages/api/public/metrics/index.ts)
