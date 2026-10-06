# Agent Playground Python SDK 스펙 정의서

> 작성일: 2026-10-07. 상태: 구현 전 계약 초안 v0.2.
> 작성 기준: [ASD-STE100](https://www.asd-ste100.org/STE_faq.html)의 원칙을 한국어에 적용했다. 공식 준수를 뜻하지 않는다.
> 관련 설계: [Stage Runner](./agent-stage-runner-design.md), [Definition](./agent-definition-design.md), [Builder](./agent-builder-design.md).

Python SDK로 만든 에이전트를 Stage Runner에서 실행한다. 이후 같은 에이전트를 UI Builder로 가져온다. **SDK 실행 범위와 Builder 편집 범위는 분리한다.**

## 1. 책임과 지원 범위

| 구성 요소 | 책임 |
| --- | --- |
| SDK | 에이전트 정의, 실행 계약, 상태, 환경 연결, 실행 기록 |
| Stage Runner | 고정 패키지 로딩, 세션 관리, 호출, 실행 격리 |
| UI Builder | 정의 표시, 허용 설정 편집, 수정본 저장 |
| 개발자 plugin | 수정 정의와 소스의 차이 확인, 로컬 반영 |

에이전트는 다음 세 가지 형태를 사용할 수 있다.

| 형태 | SDK 작성 | Builder 표시와 편집 |
| --- | --- | --- |
| 공통 노드 | SDK가 제공한 LLM·Agent·조건 등의 노드를 연결한다. | 지원하는 구조와 설정을 표시한다. 허용된 설정을 편집한다. |
| 커스텀 노드 | 개발자가 Python으로 노드 내부를 구현한다. | 하나의 노드로 표시한다. 공개 설정만 편집한다. |
| 사용자 정의 실행부 | 개발자가 전체 실행 흐름을 구현한다. | 하나의 구성 요소로 표시한다. 공개 설정만 편집한다. |

SDK는 반복, 병렬, 서브에이전트, 사용자 상태, 외부 라이브러리를 전체적으로 금지하지 않는다. 각 실행기는 지원 기능을 선언한다. Runner는 필요한 실행기와 의존성이 준비된 에이전트만 실행한다.

초기 Builder는 공통 노드의 직렬 연결과 조건 분기를 편집한다. 그 밖의 구조는 읽기 전용으로 표시한다. 구조를 해석할 수 없으면 전체 실행부를 하나의 구성 요소로 표시한다. 원본 정의와 소스는 보존한다.

## 2. 공통 정의

공통 정의를 `AgentSpec`이라 한다. 저장 형식은 UTF-8 JSON이다. Python 코드와 Builder는 같은 정의를 사용한다.

| 항목 | 내용 |
| --- | --- |
| 버전 | 정의 형식 버전, SDK 버전 |
| 실행 정보 | 실행 방식, 실행기, Python 진입점 |
| 구조 | 노드 ID, 노드 종류, 연결. 사용자 정의 실행부는 생략할 수 있다. |
| 입출력 | 실행부와 커스텀 노드의 JSON 입출력 스키마 |
| 설정 | 현재 값, JSON 설정 스키마 |
| 수정 권한 | 실험자가 변경할 필드 경로와 값의 범위 |
| 코드 참조 | 패키지 내부 모듈과 함수 |
| 실행 요구 | 실행기 기능, 고정 의존성 목록 |

실행 방식은 `graph` 또는 `program`이다. `graph`는 SDK 실행기가 구조를 실행한다. `program`은 사용자 정의 실행부가 실행 흐름을 소유한다. 두 방식 모두 같은 Runner 호출 계약을 제공한다.

설정은 JSON 값으로 저장한다. 설정 스키마는 타입과 허용 범위를 정의한다. 코드와 의존성은 별도 파일로 저장한다. Python 객체와 클로저를 JSON에 저장하지 않는다.

노드 ID는 편집 후에도 유지한다. 노드 내부 코드를 바꾸어도 같은 논리 노드의 ID를 유지한다. 실행 기록은 이 ID를 사용한다.

개발자는 다음과 같이 커스텀 노드를 정의한다. 이름과 메서드는 제안 API다.

```python
from agent_playground_sdk import AgentSpec, CustomNode, export_project

spec = AgentSpec(
    schema_version="1.0",
    sdk_version="0.1.0",
    name="search-agent",
    execution={"mode": "graph", "engine": "sdk-graph"},
    nodes={
        "search": CustomNode(
            entrypoint="search_agent.nodes.search:run",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config={"top_k": 5},
            config_schema={
                "type": "object",
                "properties": {
                    "top_k": {"type": "integer", "minimum": 1, "maximum": 20}
                },
                "required": ["top_k"],
                "additionalProperties": False,
            },
            editable=["/top_k"],
        ),
    },
    edges=[],
    start="search",
    end="search",
)

export_project(spec, source_root="./src", output_dir="./export/search-agent")
```

커스텀 노드의 함수는 `async def run(input, context)` 형태다. `context`는 해당 노드의 설정, 세션 상태, 환경 연결, 기록 기능을 제공한다. 함수는 JSON 출력 객체를 반환한다. 내부 구현은 다른 함수와 외부 라이브러리를 사용할 수 있다.

실험자는 `top_k`를 변경할 수 있다. 노드 구현과 수정 권한은 변경할 수 없다. 서버는 승인된 기준 정의로 수정 권한을 검사한다.

## 3. Runner 호출 계약

에이전트 진입점은 `module:get_program` 형태다. 무인자 함수는 `AgentProgram`을 반환한다. SDK는 공통 그래프와 사용자 정의 실행부를 같은 인터페이스로 연결한다.

```python
from typing import Protocol

class AgentProgram(Protocol):
    async def open(self, environment, options) -> "AgentSession": ...

class AgentSession(Protocol):
    async def invoke(self, request) -> "AgentReply": ...
    async def aclose(self) -> None: ...
```

| 값 | 필수 내용 |
| --- | --- |
| `environment` | 모델·도구 연결, 실행 기록 연결 |
| `options` | 세션 ID, 실행 제한, 검증된 설정 |
| `request` | 요청 ID, 사용자 메시지, trace ID |
| `AgentReply` | 요청 ID, 최종 문자열, 도구 호출 요약 |
| 실행 오류 | 오류 코드, 단계, 메시지, 해당 노드 ID |

`open`은 빈 세션을 만든다. 같은 세션에서 여러 메시지를 순서대로 처리한다. 동시 호출은 거부한다. `aclose`는 세션 자원을 정리한다. 중복 종료는 안전해야 한다.

설정은 세션 시작 시 고정한다. 사용자 정의 실행부도 `options`의 설정을 사용해야 한다. 코드에 별도 값을 고정해 Builder 설정을 무시하면 호환 계약을 위반한다.

공통 그래프의 대화 이력은 SDK가 관리한다. 사용자 정의 실행부는 자체 상태를 관리할 수 있다. 두 방식 모두 세션 간 상태를 분리하고 실패한 턴의 변경을 확정하지 않는다. 외부 시스템의 부작용까지 자동으로 되돌리는 계약은 포함하지 않는다.

Runner는 요청 중복, 호출 순서, 세션 소유자를 검사한다. 호출 실패나 시간 초과 후에는 세션을 종료한다. 자동 재실행하지 않는다. 종료되지 않는 사용자 코드는 컨테이너 종료로 차단한다.

모델과 도구는 환경 연결을 통해 호출한다. 외부 라이브러리도 환경 연결을 사용하는 어댑터를 둘 수 있다. Stage 환경은 조회·모킹 도구만 제공한다. 자격증명은 패키지와 공개 설정에 넣지 않는다.

SDK는 턴·노드·모델·도구의 실행 이벤트를 제공한다. 커스텀 구현은 내부 작업을 같은 기록 인터페이스로 남긴다. 기록에는 trace ID, 노드 ID, 성공 여부, 소요 시간을 포함한다. Runner는 버전과 buildId를 연결한다. Langfuse는 기록 어댑터로 연결한다.

## 4. 패키징과 Builder 반영

교환 프로젝트는 다음 파일을 포함한다.

```text
agent.json          진입점, SDK·Python 버전, 실행 환경 참조
agent-spec.json     공통 정의
src/                Python 소스
requirements.lock   의존성 버전과 파일 해시
editor/             선택적 화면 배치 정보
```

CI는 고정 프로젝트를 Agent wheel로 만든다. 의존성은 승인된 저장 경로에서 확보한다. Python·SDK·의존성이 고정된 실행 환경을 준비한다. wheel과 실행 환경 참조를 같은 버전에 연결한다. Runner 준비 중에는 의존성을 다시 선택하지 않는다.

CI는 플랫폼 빌드 절차를 사용한다. 사용자 진입점과 노드를 CI에서 실행하지 않는다. import와 실행 검증은 격리 환경에서 수행한다. Runner는 패키지 해시와 실행 환경의 일치를 확인한다.

Builder는 정의와 소스를 읽어 에이전트를 가져온다. 구조를 찾기 위해 Python 코드를 실행하지 않는다. 지원하지 않는 노드 내부와 구조는 읽기 전용으로 보존한다. 정의 형식 자체를 읽을 수 없으면 오류를 표시한다.

Builder는 허용 설정만 변경한다. 변경된 정의는 새 버전으로 저장한다. Runner는 새 버전을 새 세션에서 시험한다.

개발자 plugin은 변경된 정의를 로컬에 반영한다. 원본 소스는 보존한다. 소스 변경이 있으면 차이를 보여준다. 로컬 변경과 충돌하면 덮어쓰지 않는다.

정의를 작성한 임의 Python 스크립트는 자동 역수정하지 않는다. Builder에서 수정한 뒤에는 변경된 `agent-spec.json`을 기준으로 사용한다. 재export 시에는 기준 버전을 확인한다.

기존 Java 설계의 JAR는 Python wheel로 바꾼다. Maven 좌표와 Java 진입점도 Python 계약으로 바꾼다. 저장·버전 고정·CI 등록·격리 실행·세션 버전 고정 원칙은 유지한다. 공통 그래프는 SDK가 Spec을 읽어 실행한다. 사용자 정의 실행부는 같은 호출 계약으로 연결한다.

## 5. 기술 검증 기준

- 같은 패키지를 로컬과 Runner에서 호출한다. 고정 mock으로 결과와 실행 순서를 비교한다.
- 두 턴의 대화와 세션 간 상태 분리를 확인한다.
- 커스텀 노드에서 고정 외부 라이브러리를 사용한다.
- 사용자 정의 실행부를 하나의 구성 요소로 가져온다. 공개 설정 변경이 실행에 반영되는지 확인한다.
- Builder 읽기·설정 변경·저장 후에도 노드 ID와 수정하지 않은 소스를 보존한다.
- 실행 오류를 고정 버전과 노드에 연결한다.
- 시간 초과와 종료 후에 실행 자원이 남지 않는지 확인한다.

초기 구현은 공통 직렬 흐름과 커스텀 실행부를 우선 지원한다. 반복·병렬의 공통 표현과 Builder 편집은 후속 구현으로 둔다. Python 버전, 의존성 승인 경로, Registry, 상태 저장 방식은 파일럿에서 확정한다.
