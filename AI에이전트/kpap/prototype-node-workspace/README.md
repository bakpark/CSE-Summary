# kpap 노드 작업공간 프로토타입

핵심 화면을 새로 모킹했다. 실제 API는 연결하지 않는다.

- 노드별 모델·프롬프트·지식·도구를 수정한다.
- 실행·평가는 같은 작업공간에서 전환한다.
- 이력 사이드바에서 과거 설정·결과를 본다.
- 이력 조회는 현재 초안을 보존한다.
- 노드 관측과 기준 설정·점수를 비교한다.

변경은 브라우저에 저장한다. 체험 초기화로 복구한다.

[비공개 체험 링크](https://kpap-node-workspace.justgecko33.chatgpt.site) · ChatGPT 로그인 필요.

## 로컬 실행

```sh
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist
```

브라우저에서 http://127.0.0.1:4174 을 연다.

## SDK 연동 업데이트 (2026-10-17)

상단 **SDK 연동**에서 예제 그래프를 읽거나 SDK 응답 JSON을 가져온다. 노드·연결을 데이터로 표시하고 configSchema·editable에 따라 프롬프트·모델·도구·지식을 편집한다. A2A 요청 미리보기와 모의 적용 스냅샷을 제공한다. 버전 충돌·권한 거부·확장 헤더 누락을 시험한다. 기존 실행 화면도 같은 검증 모듈을 사용한다.

- `dist/contract.js`: 전송과 분리한 그래프·설정 검증 및 A2A 요청 생성.
- `dist/fixtures/`: SDK 그래프 응답과 전체 예제 Agent Card.
- `dist/sdk.html`, `sdk.js`, `sdk.css`: SDK 연동 화면.
- `tests/*.cjs`: 계약·격리·오류 및 기존 실행·평가·JSON 가져오기 회귀 검증.

```sh
node --test tests/*.cjs
node --check dist/app.js
node --check dist/sdk.js
```

[규약](../../agentic%20platform/kpap-graph-minimal-contract.md). 응답 가져오기는 검토용이며 원격 연결이 아니다. 실제 A2A 서버·LangGraph·모델·도구·RAG는 호출하지 않는다. 그룹은 소속 라벨로 표시한다. 기존 시나리오 캡처는 업데이트 전 화면이다.
