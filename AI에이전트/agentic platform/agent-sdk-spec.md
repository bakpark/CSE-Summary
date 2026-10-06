# Agent Playground Python SDK 스펙 정의서

> 작성일: 2026-10-07. 상태: 구현 전 계약 초안 v0.4.
> 작성 기준: [ASD-STE100](https://www.asd-ste100.org/STE_faq.html)의 원칙을 한국어에 적용했다. 공식 준수를 뜻하지 않는다.
> 관련 설계: [Stage Runner](./agent-stage-runner-design.md), [Definition](./agent-definition-design.md), [Builder](./agent-builder-design.md).

Python SDK로 만든 에이전트를 Stage Runner에서 실행한다. 이후 같은 에이전트를 UI Builder로 가져온다. **Playground는 흐름을 함께 수정하고 평가하는 협업 공간이다.** SDK 실행 범위와 Builder 편집 범위는 분리한다.

**운영 서비스 배포는 필요하지 않다. 형상 업로드와 실행 준비는 필요하다.** 아래 형식과 API 이름은 구현 전 제안이다.

## 1. 책임과 지원 범위

| 구성 요소 | 책임 |
| --- | --- |
| SDK | 에이전트 정의, 실행 계약, 상태, 환경 연결, 실행 기록 |
| Stage Runner | 고정 패키지 로딩, 세션 관리, 호출, 실행 격리 |
| UI Builder | 정의 표시, 허용 흐름·설정 편집, 실험 형상 저장 |
| 개발자 plugin | 흐름·설정 변경과 평가 근거 공유, 실제 서비스에서 검토·반영 지원 |

에이전트는 다음 세 가지 형태를 사용할 수 있다.

| 형태 | SDK 작성 | Builder 표시와 편집 |
| --- | --- | --- |
| 공통 노드 | SDK가 제공한 LLM·Agent·조건 등의 노드를 연결한다. | 승인된 노드를 추가·수정·삭제한다. 허용 연결·분기와 설정을 편집한다. |
| 커스텀 노드 | 개발자가 Python으로 노드 내부를 구현한다. | 내부 코드는 보존한다. 등록된 노드를 외부 흐름에 연결하고 공개 설정을 편집한다. |
| 사용자 정의 실행부 | 개발자가 전체 실행 흐름을 구현한다. | 내부 흐름은 읽기 전용이다. 개발자가 노드로 등록하면 외부 흐름에 연결한다. 공개 설정을 편집한다. |

SDK는 반복, 병렬, 서브에이전트, 사용자 상태, 외부 라이브러리를 전체적으로 금지하지 않는다. 각 실행기는 지원 기능을 선언한다. Runner는 필요한 실행기와 의존성이 준비된 에이전트만 실행한다.

Builder는 공통 graph의 노드·연결·분기와 설정을 편집한다. 지원하지 않는 내부 구조는 읽기 전용으로 표시한다. 개발자는 커스텀 구현과 사용자 정의 실행부를 구성 요소 목록에 등록한다. Builder는 등록된 요소를 외부 흐름에 배치한다. 임의 Python 코드를 자동으로 편집 가능한 흐름으로 바꾸지 않는다.

## 2. 공통 정의

공통 정의를 `AgentSpec`이라 한다. 저장 형식은 UTF-8 JSON이다. Python 코드와 Builder는 같은 정의를 사용한다.

| 항목 | 내용 |
| --- | --- |
| 버전 | 정의 형식 버전, SDK 버전 |
| 실행 정보 | 실행 방식, 실행기, Python 진입점 |
| 구조 | 노드 ID, 노드 종류, 연결. 사용자 정의 실행부는 생략할 수 있다. |
| 입출력 | 실행부와 커스텀 노드의 JSON 입출력 스키마 |
| 설정 | 현재 값, JSON 설정 스키마 |
| 수정 권한 | 수정할 영역, 허용 노드·연결·분기 작업, 설정 필드와 값의 범위 |
| 코드 참조 | 패키지 내부 모듈과 함수 |
| 실행 요구 | 실행기 기능, 고정 의존성 목록 |
| 구성 요소 참조 | 등록 ID와 버전, 패키지 해시, 입출력·설정 스키마 |
| 입력·출력 매핑 | 요청에서 시작 노드로 전달할 값, 종료 출력에서 최종 답변으로 변환할 값 |

실행 방식은 `graph` 또는 `program`이다. `graph`는 SDK 실행기가 구조를 실행한다. `program`은 사용자 정의 실행부가 실행 흐름을 소유한다. 두 방식 모두 같은 Runner 호출 계약을 제공한다.

흐름 편집은 `graph`에서 수행한다. 개발자는 `program`의 입출력 매핑과 세션 연결을 정의해 노드로 등록할 수 있다. 이 노드를 공통 graph에 배치하면 외부 흐름을 편집할 수 있다. 내부 Python 흐름은 그대로 유지한다.

설정은 JSON 값으로 저장한다. 설정 스키마는 타입과 허용 범위를 정의한다. 코드와 의존성은 별도 파일로 저장한다. Python 객체와 클로저를 JSON에 저장하지 않는다.

Python 작성 코드는 개발자의 로컬에서 명시적으로 SDK export를 실행한다. 결과는 정적 JSON Spec과 모듈·함수 참조다. Plugin과 Builder는 원격 Python을 실행하거나 AST로 흐름을 역변환하지 않는다.

노드 ID는 편집 후에도 유지한다. 새 노드와 복제 노드는 새 ID를 받는다. 삭제한 ID는 다시 사용하지 않는다. 노드 내부 코드를 바꾸어도 같은 논리 노드의 ID를 유지한다. 실행 기록과 변경 비교는 이 ID를 사용한다.

수정 권한은 기준 형상과 승인된 구성 요소 목록으로 검사한다. 실험자는 권한 자체를 변경할 수 없다. 서버는 노드 입출력, 연결, 분기와 실행 제한을 검증한다. 새 노드는 등록된 구현과 의존성 버전을 참조한다. 패키지가 준비되지 않으면 실행 준비 상태로 표시한다.

### Stage 실행 예제

예제는 아래 파일셋과 KPAP 연결 설정이 준비된 상태를 가정한다. `agent-spec.json`은 등록된 검색 노드와 흐름을 정의한다. `src/search_agent/nodes/search.py`에 실제 `run` 구현이 있어야 한다. 파일 export만으로 실행되지는 않는다.

`agent.json`의 예시 값은 다음과 같다. 참조는 서버에서 고정 버전으로 해석한다.

```json
{
  "format_version": "1.0",
  "agent_id": "search-agent",
  "mode": "graph",
  "entrypoint": "agent_playground_sdk.runtime:get_graph_program",
  "spec": "agent-spec.json",
  "sources": ["src"],
  "resources": ["resources"],
  "dependencies": "requirements.lock",
  "components": "components.json",
  "python_version": "3.12",
  "sdk_version": "0.1.0",
  "engine": "sdk-graph@0.1.0",
  "runtime_ref": "python312-sdk01/7",
  "environment_ref": "stage-search/12"
}
```

입력·출력 매핑은 Spec에 둔다. 다음은 JSON 경로를 사용하는 제안 형식이다.

```json
{
  "input_mapping": {"query": "$.request.message"},
  "reply_mapping": {"output": "$.nodes.search.output.text"}
}
```

검색 코드 노드는 `query` 문자열을 받고 `{"text": "..."}` 객체를 반환한다. `$.nodes.search.output`은 해당 노드가 반환한 객체다. SDK는 매핑한 문자열을 `AgentReply.output`으로 반환한다. 노드 스키마는 이 필드를 선언해야 한다. 다음 SDK 호출은 업로드·준비·두 턴 시험을 수행한다.

```python
import asyncio
from agent_playground_sdk import AgentSpec, StageClient, export_project

async def main():
    spec = AgentSpec.from_file("./agent-spec.json")
    bundle = export_project(
        spec,
        manifest="./agent.json",
        source_root="./src",
        lock_file="./requirements.lock",
        output_dir="./export/search-agent",
    )
    async with StageClient.from_profile("kpap-stage") as stage:
        job = await stage.submit(bundle)
        ready = await stage.wait_ready(job.id, timeout_seconds=300)
        async with stage.open_session(
            version_id=ready.version_id
        ) as session:
            first = await session.invoke("노트북을 검색해줘")
            second = await session.invoke("그중 가장 가벼운 것은?")
            print(first.output, second.output)

asyncio.run(main())
```

`submit`은 고정 bundle을 등록하고 준비 작업 ID를 반환한다. `wait_ready`는 상태 API를 조회한다. 실패하면 해당 형상의 진단을 반환한다. `open_session`은 READY 형상만 사용한다. SDK는 `invoke`의 요청 ID·trace ID를 생성하고 종료 시 세션을 닫는다.

커스텀 노드는 `async def run(input, context)`를 구현한다. `context`는 선택 Spec의 노드 설정, 세션 상태, 환경 연결과 기록 기능을 제공한다. 함수는 JSON 출력 객체를 반환한다. 내부 코드는 보존한다. 흐름 작업 권한과 설정 권한은 Spec에서 따로 선언한다.

## 3. Runner 호출 계약

에이전트 진입점은 `module:function` 형태의 무인자 factory다. 무인자 함수는 `AgentProgram`을 반환한다. `graph`는 SDK의 공통 진입점을 사용한다. 사용자 Python factory가 선택 graph를 숨기거나 다시 생성하지 않는다. `program` 내부 구현은 등록된 adapter로 연결한다.

```python
from dataclasses import dataclass
from typing import Protocol

@dataclass(frozen=True)
class SessionOptions:
    session_id: str
    effective_spec: dict | None
    spec_ref: str | None
    spec_hash: str
    component_manifest: dict
    environment_ref: str
    limits: dict

class AgentProgram(Protocol):
    async def open(
        self, environment, options: SessionOptions
    ) -> "AgentSession": ...

class AgentSession(Protocol):
    async def invoke(self, request) -> "AgentReply": ...
    async def aclose(self) -> None: ...
```

| 값 | 필수 내용 |
| --- | --- |
| `environment` | 모델·도구 연결, 실행 기록 연결 |
| `options` | 위 SessionOptions. 전체 선택 Spec과 고정 구성 요소·환경 연결 |
| `request` | 요청 ID, `message` 문자열, trace ID |
| `AgentReply` | 요청 ID, 최종 `text` 문자열, 도구 호출 요약 |
| 실행 오류 | 오류 코드, 단계, 메시지, 해당 노드 ID |

`open`은 빈 세션을 만든다. 같은 세션에서 여러 메시지를 순서대로 처리한다. 동시 호출은 거부한다. `aclose`는 세션 자원을 정리한다. 중복 종료는 안전해야 한다.

`effective_spec` 또는 불변 `spec_ref` 중 하나를 제공한다. Runner는 해석한 전체 Spec의 해시를 `spec_hash`와 비교한다. Graph 실행기는 선택 Spec으로 compile한다. 코드 wheel에 들어 있는 원래 정의를 실행 기준으로 사용하지 않는다.

흐름과 설정은 세션 시작 시 고정한다. 사용자 정의 실행부의 adapter는 공개 설정을 선택 Spec에서 전달한다. 내부 코드는 보존한다. 환경 연결은 `environment_ref`와 일치해야 한다. 실행 기록에는 선택 Spec과 실제 구성 요소·환경을 연결한다.

공통 graph의 대화 이력은 SDK가 관리한다. 실패한 턴의 SDK 관리 상태는 확정하지 않는다. 사용자 정의 상태의 분리와 실패 처리는 구현자가 책임진다. SDK는 임의 Python 상태와 외부 부작용을 자동으로 되돌리지 않는다. 실패한 세션은 폐기한다.

등록된 `program` 노드는 graph 입력을 프로그램 요청으로 매핑한다. 프로그램 응답은 노드 출력으로 매핑한다. 등록 정의는 두 매핑과 입출력 스키마를 포함한다. 서버는 연결된 노드와의 스키마를 검사한다.

부모 세션은 각 `program` 노드의 자식 세션을 유지한다. 첫 방문에서 `open`한 뒤 각 방문에서 `invoke`한다. 자식 세션은 부모 세션과 노드 ID로 구분한다. 노드를 복제하면 별도 자식 세션을 사용한다. 부모 종료·실패 시 자식 세션을 모두 종료한다. 다음 형상은 새 부모·자식 세션에서 실행한다.

Runner는 요청 중복, 호출 순서, 세션 소유자를 검사한다. 호출 실패나 시간 초과 후에는 세션을 종료한다. 자동 재실행하지 않는다. 종료되지 않는 사용자 코드는 컨테이너 종료로 차단한다.

모델과 도구는 환경 연결을 통해 호출한다. 외부 라이브러리도 환경 연결을 사용하는 어댑터를 둘 수 있다. Stage 환경은 조회·모킹 도구만 제공한다. 자격증명은 패키지와 공개 설정에 넣지 않는다.

SDK는 턴·노드·모델·도구의 실행 이벤트를 제공한다. 커스텀 구현은 내부 작업을 같은 기록 인터페이스로 남긴다. 기록에는 trace ID, 부모·자식 세션 ID, 노드 ID, 성공 여부와 소요 시간을 포함한다. Runner는 버전과 buildId를 연결한다. Langfuse는 기록 어댑터로 연결한다.

## 4. 패키징과 Builder 반영

교환 프로젝트는 다음 파일을 포함한다.

```text
agent.json          진입점, SDK·Python 버전, 실행 환경 참조
agent-spec.json     공통 정의
src/                Python 소스
requirements.lock   의존성 버전과 파일 해시
components.json     등록 구성 요소, 진입점·패키지·버전 참조
resources/          선언한 템플릿·자료 파일
editor/             선택적 화면 배치 정보
```

Manifest, Spec, 필요한 소스·리소스, lock과 환경 참조를 검사한다. 선언한 파일이나 참조가 없으면 등록 검사를 FAILED로 끝낸다. 동적 import와 서비스 부팅에 필요한 구현은 개발자가 bundle에 포함한다. Plugin은 누락한 소스를 자동 추정하지 않는다.

`components.json`은 노드 참조를 등록 진입점과 고정 패키지에 연결한다. 서버는 이 매핑을 검증하고 SessionOptions의 `component_manifest`로 전달한다. 자격증명은 bundle 대신 환경 연결로 제공한다.

**초기는 기존 CI의 고정 wheel 경로를 사용한다.** CI는 고정 소스·리소스로 구현 패키지를 만든다. 승인 경로의 의존성과 고정 Python·SDK·런타임 이미지를 연결한다. 준비 중에는 의존성을 다시 선택하지 않는다. 소스를 직접 실행하는 dev bundle 경로는 확정 범위가 아니다.

전체 실행 Spec은 코드·구성 요소 패키지와 분리한다. 흐름·설정만 바뀌면 고정 code wheel과 환경을 재사용한다. 새 Spec을 외부에서 SessionOptions로 전달한다. 코드·의존성 또는 새 구성 요소가 바뀌면 CI 준비가 필요하다.

실행 형상은 Spec 해시, code·구성 요소 해시, lock 해시, SDK·engine 버전과 runtime 이미지 digest로 식별한다. 환경 참조도 고정한다. 버전 ID는 이 조합을 가리킨다. buildId는 CI 산출물을 식별한다. 여러 Spec 버전이 같은 buildId를 재사용할 수 있다. 등록 후 로컬 파일을 다시 읽거나 덮어쓰지 않는다.

| 준비 상태 | 의미 |
| --- | --- |
| RECEIVED | 고정 bundle과 등록 요청을 받았다. |
| VALIDATING | 형식·해시·권한·참조를 검사한다. |
| BUILDING | 필요한 wheel을 CI에서 만든다. 재사용이면 생략한다. |
| PREPARING | 패키지와 환경을 확보하고 실행 연결을 검증한다. |
| READY | 정확한 Spec·패키지·환경 조합으로 세션을 열 수 있다. |
| FAILED | 진단을 기록한다. 실행 가능 상태로 표시하지 않는다. |

준비 상태는 형상 준비 작업에 연결한다. 세션의 로딩·open 오류는 별도로 기록한다. 코드·의존성이 바뀌면 새 격리 프로세스에서 로딩한다. 실행 중인 Python 모듈을 교체하지 않는다. 같은 등록 ID와 내용은 같은 작업을 반환한다. 같은 ID의 다른 내용은 거부한다. 오래된 준비 결과가 새 형상을 READY로 바꾸지 않는다.

CI는 플랫폼 빌드 절차를 사용한다. 사용자 진입점과 노드를 CI에서 실행하지 않는다. Python module import와 실행 검증은 격리 환경에서 수행한다. Runner는 선택 Spec·패키지·실행 환경의 일치를 확인한다.

Builder는 정의와 소스를 읽어 에이전트를 가져온다. 구조를 찾기 위해 Python 코드를 실행하지 않는다. 노드 내부 코드와 지원하지 않는 내부 구조는 읽기 전용으로 보존한다. 등록된 구성 요소의 외부 연결은 편집할 수 있다. 정의 형식 자체를 읽을 수 없으면 오류를 표시한다.

Builder는 허용 노드·연결·분기와 설정을 변경한다. 변경된 정의는 새 버전으로 저장한다. Runner는 준비된 새 버전을 새 세션에서 시험한다.

Playground 형상은 KPAP의 별도 GitHub 저장소에서 관리한다. 실제 서비스 형상은 독립적으로 관리한다. 개발자의 로컬은 실제 서비스 프로젝트다.

개발자 plugin은 에이전트 형상을 Playground로 가져온다. 실험의 기준 import와 선정 실험을 노드 ID로 비교한다. 노드·연결·분기의 추가·수정·삭제와 설정 변경을 평가 근거와 함께 공유한다. 해당 에이전트의 소유 개발자가 실제 서비스 로컬에서 검토·반영한다.

공통 Spec 파일과 대응 경로가 명확하면 흐름·설정의 선택 적용을 지원한다. 임의 Python으로 구성한 흐름은 제안으로 보여주고 개발자가 반영한다. 실제 서비스 형상을 기본으로 덮어쓰지 않는다. 로컬 변경과 충돌하면 개발자가 해결한다.

정의를 작성한 임의 Python 스크립트는 자동 역수정하지 않는다. Playground에서는 수정한 `agent-spec.json`을 실행 기준으로 사용한다. 실제 서비스 반영은 개발자가 수행한다. 다시 import하면 새 기준 형상을 만들고 기존 실험을 보존한다.

기존 Java 설계의 JAR는 Python wheel로 바꾼다. Maven 좌표와 Java 진입점도 Python 계약으로 바꾼다. 저장·버전 고정·CI 등록·격리 실행·세션 버전 고정 원칙은 유지한다. 공통 그래프는 SDK가 Spec을 읽어 실행한다. 사용자 정의 실행부는 같은 호출 계약으로 연결한다.

## 5. 기술 검증 기준

- 같은 패키지를 로컬과 Runner에서 호출한다. 고정 mock으로 결과와 실행 순서를 비교한다.
- 흐름·설정 변경이 원래 Python 정의 대신 선택 Spec으로 실행되는지 확인한다.
- 등록 누락·빌드 실패·환경 준비 실패를 READY로 표시하지 않는지 확인한다.
- 두 턴의 대화와 세션 간 상태 분리를 확인한다.
- 커스텀 노드에서 고정 외부 라이브러리를 사용한다.
- 사용자 정의 실행부를 하나의 구성 요소로 가져온다. 공개 설정 변경이 실행에 반영되는지 확인한다.
- 등록된 사용자 정의 실행부 앞뒤에 노드를 연결한다. 입출력 매핑과 부모·자식 세션의 유지·종료를 확인한다.
- Builder에서 승인 노드와 연결·분기를 추가·수정·삭제한다. 수정한 흐름이 Runner에서 실행되는지 확인한다.
- Builder 읽기·설정 변경·저장 후에도 노드 ID와 수정하지 않은 소스를 보존한다.
- 노드 ID 기반 흐름·설정 차이를 공유한다. 공통 Spec 선택 적용과 Python 수동 반영 경로를 확인한다.
- 실행 오류를 고정 버전과 노드에 연결한다.
- 시간 초과와 종료 후에 실행 자원이 남지 않는지 확인한다.

초기 구현은 공통 직렬 흐름·조건 분기와 등록된 커스텀 실행부를 지원한다. 반복·병렬의 공통 표현과 Builder 편집은 후속 구현으로 둔다. Python 버전, 의존성 승인 경로, Registry, 상태 저장 방식은 파일럿에서 확정한다.
