# Flowise Natural Language Agent Builder

Flowise `@flowiseai/agentflow` 캔버스를 중심으로 만든 실행 가능한 프로토타입이다. 캔버스는 항상 화면에 유지되며, 사용자는 Flowise 노드 편집 패널과 자연어 ReAct 편집을 함께 사용할 수 있다.

## 제공 기능

- 자연어로 새 플로우 초안 생성
- 기존 플로우의 자연어 수정
- OpenAI Responses API 함수 호출을 반복하는 ReAct 편집 루프
- Builder 작업 모델과 Flowise LLM 노드 모델의 독립 선택
- 입력·출력 JSON Schema와 JavaScript 코드를 갖는 Function 노드
- 선택한 Function 노드의 자연어 기반 코드·계약 수정
- 브라우저 로컬 저장, JSON 가져오기·내보내기
- 라이트·다크 테마와 모바일 단일 열 배치

스크립트는 이 Builder 서버에서 실행하지 않는다. 문법과 금지 패턴을 검사하고 정의만 저장한다. 실제 실행 환경에서는 sandbox, 시간·메모리 제한, 허용 API, 비밀정보 주입 정책을 별도로 적용해야 한다.

## 실행

Node.js 20 이상이 필요하다.

```bash
npm install
cp .env.example .env
```

`.env`에 API 키를 설정한다.

```text
OPENAI_API_KEY=...
OPENAI_MODELS=gpt-6.1-sol,gpt-6-astra,gpt-6-luna
```

개발 서버를 실행한다.

```bash
npm run dev
```

- 웹: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

## 검증

```bash
npm test
npm run build
```

## 구성

```text
src/
  App.tsx                 전체 작업 화면과 Flowise 캔버스
  components/RunTrace.tsx ReAct 도구 실행 기록
  lib/initialFlow.ts      입력·출력 계약이 있는 예제 플로우
server/
  reactEngine.ts          Responses API ReAct 루프
  graphTools.ts           제한된 그래프 변경 도구와 검증
  catalog.ts              Flowise 패널에 공급하는 노드 schema
  index.ts                Builder API와 Flowise adapter endpoint
tests/
  graphTools.test.ts      노드·연결·모델·스크립트 검증
```

## 설계 메모

ReAct 엔진은 내부 추론을 노출하지 않는다. UI에는 모델이 호출한 그래프 도구와 검증 결과만 표시한다. 각 함수 도구는 엄격한 JSON Schema를 사용하고, 서버가 그래프 변경을 적용한 뒤 결과를 모델에 반환한다.

Flowise Agentflow는 uncontrolled component이므로 자연어 변경 결과를 적용할 때 캔버스를 새 revision으로 다시 마운트한다. 직접 편집 중에는 `onFlowChange`로 최신 그래프를 유지한다.

Flowise 원본 서버를 함께 설치하지 않는다. 같은 Express 서버에서 node catalog와 model option에 필요한 최소 adapter endpoint만 제공한다. 장기 구현에서는 이 endpoint를 플랫폼의 Model·Tool·Credential Registry adapter로 교체한다.

## 공식 참고

- [Flowise Agentflow package](https://github.com/FlowiseAI/Flowise/tree/main/packages/agentflow)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI model catalog](https://developers.openai.com/api/docs/models)
