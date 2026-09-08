# Deep Agents에서 Request-scoped AgentProfile 구현하기

[AI 에이전트 목차](./README.md) · [분산 런타임 설계](./distributed-request-scoped-runtime.md)

> 확인일: 2026-09-09. 이 문서는 Python `deepagents`와 LangChain/LangGraph의 공식 API를 바탕으로 구성한 설계 가이드다. 코드 블록은 연결 지점을 설명하는 골격이며, 복사 후 바로 운영할 수 있는 완성 서버가 아니다. SDK 버전을 고정한 통합·부하·장애 테스트는 수행하지 않았다. `services` 같은 구성요소는 플랫폼이 구현해야 하는 어댑터다.

## 1. 적용 모델

```text
워커 시작
  → 공통 실행 템플릿 준비
  → 미들웨어와 서비스 클라이언트 연결

요청 접수
  → 인증·세션 확인
  → 프로필과 실행 템플릿 revision 확정
  → Run Manifest 저장

워커 실행
  → Manifest로 불변 Runtime Context 구성
  → 공유 실행 정의를 context와 thread_id로 호출
  → 미들웨어가 모델·지침·도구를 선택
  → 도구 실행 경계가 현재 권한과 업무 조건 검증
```

**공유하는 것은 실행 정의이고, 공유하지 않는 것은 요청의 프로필·대화·권한·작업 공간이다.** 프로필마다 프로세스를 띄우거나 전역 객체의 `current_profile`을 바꿀 필요가 없다.

LangChain은 Runtime Context를 통해 호출별 정보를 전달하고, 모델 요청 미들웨어에서 모델과 입력을 조정할 수 있다. Deep Agents도 `context_schema`, `middleware`, `checkpointer`, `store`를 구성하는 연결 지점을 제공한다. [1][2][3]

## 2. 동적 설정의 범위를 먼저 정한다

| 요소 | 기본 접근 | 주의점 |
| --- | --- | --- |
| tenant·사용자·run | Runtime Context | 서버가 인증한 값으로 구성한다. |
| 시스템 지침 | 모델 요청 미들웨어 | 기존 하네스 지침과 content block을 보존한다. |
| 주 실행 모델 | 모델 요청 override | 요약·자식 모델까지 변경되는지는 별도 확인한다. |
| 도구 노출 | 모델 요청의 tools 조정 | 내장 도구와 provider 도구도 정책 대상이다. |
| 실행 중 발견한 도구 | 모델 및 도구 호출 양쪽 hook | 스키마와 실행 바인딩을 같은 snapshot으로 묶는다. |
| 메모리 범위 | backend namespace 함수 | thread 상태, 장기 메모리, 파일 저장을 구분한다. |
| 샌드박스 연결 | 실행 명세의 외부 자원 참조 | provider 수명과 재연결 기능을 검증한다. |
| 실행 한도 | 플랫폼 예산·시간·동시성 정책 | 요약·자식·재시도도 합산한다. |
| 미들웨어 구성과 상태 스키마 | 버전이 있는 템플릿 | context를 바꿔 그래프 구조까지 교체한다고 가정하지 않는다. |
| 구조화 출력과 자식 구성 | 검증된 동적 hook 또는 별도 템플릿 | 선택 모델·실행 경로와의 호환성이 필요하다. |

이 표는 적용 방향이다. 모든 행이 SDK 옵션 하나로 완성된다는 의미는 아니다.

추천하는 초기 템플릿은 `light-tool-agent`와 `deep-work-agent` 정도다. 전자는 LangChain `create_agent`로 필요한 기능만 구성하고, 후자는 Deep Agents를 사용한다. 파일 기능을 쓰지 않는 요청에 무조건 모든 Deep Agents 기능을 제거해 적용하려 하지 않는다.

## 3. 불변 프로필과 실행 컨텍스트

다음은 플랫폼이 정의하는 데이터 모델의 예다. SDK의 `HarnessProfile` 클래스가 아니다.

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class ProfileRef:
    profile_id: str
    revision: str


@dataclass(frozen=True)
class RunContext:
    tenant_id: str
    subject_id: str
    session_id: str
    thread_id: str
    run_id: str
    attempt_id: str
    profile: ProfileRef
    template_revision: str
    model_config_ref: str
    toolset_snapshot_ref: str
    memory_namespace: tuple[str, ...]
    budget_ref: str
    sandbox_ref: str | None = None
```

이 예는 중첩 필드도 불변 값으로 구성한다. `frozen=True`인 dataclass에 변경 가능한 dict를 넣으면 dict의 내부까지 자동으로 불변이 되는 것은 아니다.

프로필에는 모델, 지침, 도구, skill의 **검증된 참조와 revision**을 두는 편이 좋다. 도구 함수나 모델 클라이언트를 컨텍스트에 넣어 워커 간에 직렬화하려 하지 않는다. 각 워커가 같은 참조로 로컬 연결 객체를 구성한다.

원본 자격증명은 모델 입력·체크포인트·공개 trace에 넣지 않는다. `tenant_id`나 `subject_id`도 모델이 생성한 tool arguments에서 신뢰하지 않고 서버의 인증 문맥에서 가져온다.

Deep Agents의 HarnessProfile은 모델별 하네스 설정 묶음이다. 제품의 에이전트 프로필·인가·배포·세션 정책을 대신하는 레지스트리가 아니다. 둘 사이의 변환은 플랫폼이 소유하며, context에 `profile`이라는 필드를 넣는 것만으로 자동 적용되지는 않는다. [4]

## 4. 모델과 프롬프트: 기존 하네스 문맥을 보존한다

모델 선택과 지침 적용은 `wrap_model_call` 계열에서 처리한다. 공식 미들웨어 문서는 `ModelRequest.system_message`의 content block을 이용한 지침 확장과 모델 override를 설명한다. [3]

다음과 같은 단순 교체는 검토가 필요하다.

```text
기존 system message = 하네스 지침 + 파일·위임 사용법 + 기타 미들웨어 문맥

잘못된 구현 가능성:
  기존 내용을 무시하고 프로필의 짧은 시스템 지침으로 통째로 교체
```

플랫폼의 메시지 조합기는 기존 content block과 필요한 메타데이터를 유지하고 프로필 지침을 결합하도록 설계한다. 문자열 변환으로 구조화된 content나 cache 관련 정보를 잃지 않도록 한다. 반대로 매 모델 호출마다 프로필 지침이 이력에 다시 누적되지 않도록, 해당 호출의 입력만 파생시킨다.

미들웨어 순서는 결과에 영향을 준다. 최종 모델에 전달된 system message를 테스트 모델 또는 기록용 어댑터로 확인하고, 하네스 지침·프로필 지침·메모리가 의도한 순서와 횟수로 포함되는지 검증한다.

또한 **주 모델 하나의 변경과 전체 하네스의 모델 변경은 다르다.** 요약기, 토큰 계산, context window, provider별 prompt caching, 자식 에이전트가 생성 시 모델에 묶여 있다면 함께 검토해야 한다. 다중 모델 지원은 각 조합의 실험 결과를 compatibility matrix로 관리하도록 제안한다.

## 5. 도구: 노출과 실행을 함께 연결한다

두 경우를 구분한다.

```text
A. 시작 시 모든 도구를 이미 알고 있음
   → 미리 등록하고 요청별로 노출할 subset 선택

B. 요청 시 MCP·레지스트리에서 도구를 발견함
   → 모델 요청에 스키마 추가
   → 도구 실행 hook에서 실제 구현 연결
```

LangChain 공식 문서는 B를 위해 모델 호출과 도구 호출 양쪽의 hook을 사용하도록 설명한다. 모델에 스키마만 전달했다고 처음에 등록되지 않은 도구의 실행 경로가 자동으로 생기는 것은 아니다. [5]

따라서 `before_model`에서 임의로 `{"tools": ...}`를 state에 반환하는 방식을 표준 도구 교체 API로 사용하지 않는다. 모델 요청 override와 실제 tool binding 경로를 구현한다.

### 결합 미들웨어의 설명용 골격

아래 `services`는 SDK 객체가 아니라 플랫폼 어댑터다. 각 메서드의 계약은 다음 절에 정의한다. 예시는 비동기 호출 경로를 표현하며, 고정한 SDK 버전의 async hook 시그니처와 구성 순서를 확인한 뒤 사용해야 한다.

```python
from typing import Any

from langchain.agents.middleware import (
    AgentMiddleware,
    ModelRequest,
    ToolCallRequest,
)
from langchain.messages import ToolMessage


class ProfileMiddleware(AgentMiddleware):
    def __init__(self, services: Any) -> None:
        # 공유해도 되는 서비스 참조만 보관한다.
        self.services = services

    async def awrap_model_call(
        self, request: ModelRequest, handler: Any
    ) -> Any:
        ctx = request.runtime.context
        if ctx is None:
            raise ValueError("Authenticated RunContext is required")

        profile = await self.services.load_pinned_profile(ctx)
        model = await self.services.resolve_model(ctx)

        # 후보에는 하네스 내장 도구도 포함되므로 그대로 덮어쓰지 않는다.
        # 승인된 snapshot과 현재 노출 정책으로 최종 목록을 파생한다.
        exposed_tools = await self.services.build_exposure(
            ctx, request.tools
        )
        system_message = self.services.compose_system_message(
            request.system_message, profile
        )

        return await handler(request.override(
            model=model,
            tools=exposed_tools,
            system_message=system_message,
        ))

    async def awrap_tool_call(
        self, request: ToolCallRequest, handler: Any
    ) -> Any:
        ctx = request.runtime.context
        if ctx is None:
            raise ValueError("Authenticated RunContext is required")

        call = request.tool_call
        authorized = await self.services.authorize_current(ctx, call)
        if not authorized:
            return ToolMessage(
                content="Tool execution denied by current policy.",
                name=call["name"],
                tool_call_id=call["id"],
                status="error",
            )

        # 동일 snapshot의 구현으로 연결한다. unknown은 거부한다.
        bound_tool = await self.services.bind_tool(ctx, call)
        return await handler(request.override(tool=bound_tool))
```

### 플랫폼 어댑터가 보장할 계약

| 메서드 | 필요한 계약 |
| --- | --- |
| `load_pinned_profile` | run에 확정된 revision을 읽고 현재 latest로 바꾸지 않는다. |
| `resolve_model` | 승인된 model config만 사용하고 공유 클라이언트의 자격증명을 덮어쓰지 않는다. |
| `build_exposure` | snapshot·capability·현재 노출 정책으로 목록을 만들고 이름 충돌을 거부한다. |
| `compose_system_message` | 기존 하네스 content와 필요한 metadata를 유지한다. |
| `authorize_current` | 현재 권한, 자원 소유권, 실행 상태와 필요한 승인을 확인한다. |
| `bind_tool` | 모델에 노출한 스키마와 같은 revision의 실행 어댑터를 반환한다. |

도구 어댑터와 실제 Tool Gateway는 timeout, 입력 검증, 자격증명 주입, 감사, 변경 작업의 operation 원장과 멱등성을 구현해야 한다. 위 미들웨어 예제에는 그 구현이 포함되지 않았다.

인가 결과와 실제 부수효과 사이에는 정책이나 업무 상태가 바뀔 수 있다. 따라서 모델 앞의 필터나 미들웨어 검사만으로 끝내지 않고, 실제 변경 API가 현재의 업무 조건을 검증하도록 한다.

모든 예외를 잡아 문자열로 반환하는 방식도 피한다. 권한 거부·잘못된 입력과 인프라 오류를 구분하고, 프레임워크의 interrupt·취소 신호를 일반 도구 오류로 삼키지 않는다.

### 동적 도구 snapshot에 포함할 것

```text
snapshot revision
  ├─ 모델에 노출할 이름·설명·입력 스키마
  ├─ 논리 도구 ID와 구현 revision
  ├─ 원격 서비스 binding 참조
  ├─ 읽기/변경 여부와 승인 정책 참조
  └─ timeout·재시도·멱등성 계약
```

플랫폼 도구 ID와 모델에 보여주는 이름을 분리할 수 있다. 예를 들어 `orders.cancel@v2`라는 내부 ID를 모델에는 `cancel_order`로 제공하되, 같은 실행의 이름이 다른 도구에 중복 연결되지 않도록 한다.

동적으로 발견한 스키마는 신뢰되지 않은 입력으로 검증한다. 임의 endpoint에 연결하거나 tool 설명을 시스템 보안 정책보다 우선하는 지침으로 취급하지 않는다. schema 크기·깊이·도구 개수도 제한하도록 제안한다.

## 6. 내장 도구와 다른 실행 경로를 빠뜨리지 않는다

프로필의 업무 도구만 필터링하면 파일, 셸, `task` 같은 하네스 capability가 별도로 노출될 수 있다. `tools=[]`는 업무 도구를 주지 않는다는 의미이지 모든 내장 기능이 사라진다는 보장은 아니다.

따라서 공통 템플릿의 내장 기능을 목록화하고, 허용할 capability를 별도로 지정한다. 동일한 검사를 모든 실행 경로에 적용할 수 없는 기능은 초기 템플릿에서 사용하지 않는 편이 안전하다.

특히 다음을 검증한다.

| 경로 | 확인할 사항 |
| --- | --- |
| 주 에이전트의 일반 도구 호출 | 미들웨어와 Tool Gateway를 경유하는가? |
| 선언형 서브에이전트 | 별도 도구·미들웨어 구성이 부모 정책을 우회하지 않는가? |
| interpreter의 프로그램 방식 도구 호출 | 허용 목록과 예산 검사가 같은 수준으로 적용되는가? |
| provider가 직접 실행하는 도구 | 로컬 tool hook을 경유하지 않는 실행의 정책·감사가 가능한가? |
| 셸 명령 | 파일 도구 permission 밖의 접근을 샌드박스가 차단하는가? |

자식 에이전트의 도구 목록을 생략했다고 최소 권한이 자동으로 적용된다고 가정하지 않는다. 실제 상속 규칙을 확인하고, 허용 목록·현재 identity·budget·workspace를 명시적으로 전달한다.

## 7. Backend와 메모리 namespace

다음은 공식 backend 인터페이스를 이용한 저장 범위 분리 예시다. 실제 저장소 연결과 인증된 컨텍스트 생성은 별도 구현해야 한다. [6]

```python
from deepagents.backends import (
    CompositeBackend,
    StateBackend,
    StoreBackend,
)

backend = CompositeBackend(
    default=StateBackend(),
    routes={
        "/memories/": StoreBackend(
            namespace=lambda rt: rt.context.memory_namespace,
        ),
    },
)
```

`memory_namespace`는 서버가 검증한 tuple로 설정한다. 예를 들어 tenant·사용자·프로필·메모리 스키마 revision을 포함할 수 있다. 프로필 revision이 바뀔 때 모든 장기 메모리를 새로 분리할 필요는 없으며, 메모리 호환성과 마이그레이션 정책을 별도로 정의한다.

위 예의 기본 작업 공간은 state 기반이고 `/memories/` 경로는 Store 기반이다. 메모리 미들웨어의 지침 로딩 기능과 cross-thread 저장소는 같은 개념이 아니다. 메모리 파일을 만들었다고 모델이 항상 그 내용을 사용한다고 가정하지 않고, 로딩·검색·보존 정책을 추가한다.

namespace의 입력 타입과 backend factory 방식은 버전별 변경이 있었다. 구 버전의 `StateBackend(runtime)`나 factory 예제를 최신 인스턴스 방식과 섞지 않는다. 공식 문서는 Runtime 인자와 이전 BackendContext 방식의 마이그레이션을 설명한다. [6]

파일 도구의 경로 permission은 셸 실행까지 통제하는 보안 경계가 아니다. 코드 실행이 필요한 템플릿은 실제 샌드박스의 파일·네트워크·프로세스 권한과 자격증명 정책을 설계해야 한다. [7]

## 8. 공통 실행 정의와 호출

아래는 앞 절의 미들웨어·backend를 연결하는 설명용 구성이다. `services`, 모델·checkpointer·store는 이미 검증된 서버 구성요소라는 전제가 필요하다.

```python
from deepagents import create_deep_agent

# 실행 템플릿을 준비하는 시점의 코드.
# 기본 하네스 기능과 자식 실행 정책을 별도로 검토해야 한다.
agent = create_deep_agent(
    model=template_model,
    system_prompt=template_instructions,
    tools=[],
    middleware=[ProfileMiddleware(services)],
    context_schema=RunContext,
    backend=backend,
    checkpointer=persistent_checkpointer,
    store=persistent_store,
)

# 인증·admission·단일 writer 확보 후의 호출.
result = await agent.ainvoke(
    {"messages": [{"role": "user", "content": user_input}]},
    config={"configurable": {"thread_id": ctx.thread_id}},
    context=ctx,
)
```

`template_model`은 단순 placeholder로 아무 모델이나 넣는 값이 아니다. 기본 미들웨어의 요약·모델별 설정에 영향을 줄 수 있으므로 주 모델 동적 전환과 함께 검증한다.

공유 미들웨어에 `self.current_profile`, `self.user_id`, 현재 thread의 호출 횟수를 저장하지 않는다. Deep Agents 문서도 미들웨어 인스턴스 변경으로 인한 병렬 호출의 race condition을 경고한다. 호출별 값은 context/state에 두고, 분산 예산과 operation 상태는 외부 원장에 둔다. [2]

동일한 실행 정의를 다른 thread에서 재사용하는 것과 같은 thread를 여러 워커가 동시에 쓰는 것은 다르다. 위 코드의 `ainvoke` 자체에 실행 큐·lease·fencing·중복 요청 처리가 포함됐다고 해석하지 않는다.

## 9. 승인과 resume

Deep Agents는 도구 호출 전 승인을 위한 interrupt 연동을 제공하며, LangGraph는 `Command(resume=...)`를 통한 재개를 지원한다. [8]

고정된 `interrupt_on` 설정만으로 모든 요청별 도구와 동적 인가 정책이 완성되는 것은 아니다. 동적 도구 승인에는 해당 SDK 버전에서 지원되는 hook 또는 플랫폼의 승인 어댑터를 검증해 적용한다.

```text
승인 대기 상태를 저장할 때
  run + tool revision + 검증된 인자 hash + 승인 대상 + 만료 조건

resume 전
  세션 접근 권한 확인
  → 승인 대상과 인자 일치 확인
  → 현재 권한·업무 상태 재검사
  → 동일 실행 설정으로 context 재구성
  → resume
```

```python
from langgraph.types import Command

# verified_resume_value는 승인 API에서 검증해 구성한 값이다.
# ctx는 최신 임의 프로필이 아니라 원래 Run Manifest로 복원한다.
result = await agent.ainvoke(
    Command(resume=verified_resume_value),
    config={"configurable": {"thread_id": ctx.thread_id}},
    context=ctx,
)
```

재개 시 원래 사용자 입력을 새 메시지로 다시 넣어 중복 작업을 유발하지 않는다. 일반적인 새 사용자 turn, interrupt 응답, 장애 후 retry를 서로 다른 API 경로로 구분한다.

승인 결과가 있다고 성공 처리하지 않고 도메인 시스템의 완료 상태를 확인한다. 승인 이후 인자가 바뀌면 기존 승인을 재사용하지 않는 정책도 필요하다.

## 10. 동적 서브에이전트와 템플릿 경계

서브에이전트가 모두 절대적으로 정적이라고 단정할 수는 없다. 공식 문서는 interpreter runtime을 이용한 동적 서브에이전트 실행을 설명하며, 해당 기능을 beta로 표시한다. 다만 이는 context에 임의 프로필을 넣으면 어떤 그래프나 미들웨어 구성이든 자동 교체된다는 의미가 아니다. [9]

초기 플랫폼에서는 검증된 자식 템플릿을 선택하는 dispatcher를 고려할 수 있다. 자식의 프로필 revision과 parent run, 허용 capability, workspace, 예산을 명시적으로 바인딩한다.

다음 두 경우에는 별도 실행 템플릿을 허용하는 편이 낫다.

```text
구성만 다른 에이전트
  → 공유 템플릿 + request-scoped profile

상태 스키마·중단 위치·실행 구조가 다른 에이전트
  → 버전이 있는 별도 템플릿 또는 graph factory
```

프로필별 실행 정의 캐시와 graph factory도 유효한 대안이다. 매번 생성하는 비용이나 캐시 효과는 측정하고, request-scoped 전략을 선택했다는 이유만으로 다른 경로를 금지하지 않는다. Agent Server에서의 배포 factory와 직접 만든 워커의 수명 관리도 구분한다. [10]

## 11. 구현 전 검증 순서

먼저 같은 실행 정의에 서로 다른 두 프로필·두 tenant를 동시에 주입하는 작은 검증부터 시작한다. 테스트 모델로 최종 system message와 tool schema를 기록하고, 실제 모델 호출 전에도 누출 여부를 확인할 수 있게 한다.

그다음 실행 중 발견한 도구의 정상 호출, 등록되지 않은 이름 거부, 스키마 revision 불일치, 권한 철회와 승인 후 인자 변경을 검증한다. 기본 파일 도구와 자식 실행도 같은 정책 검증에 포함한다.

마지막으로 요약이 발동할 만큼 긴 입력, 모델 교체, 워커 장애 후 resume, 동일 thread의 중복 요청, 도구 성공 직후 장애를 테스트한다. 각 단계의 결과를 사용한 `deepagents`, `langchain`, `langgraph`, provider adapter 버전과 함께 기록한다.

| 검증 항목 | 최소 확인 결과 |
| --- | --- |
| 동시 프로필 실행 | 모델·프롬프트·도구·저장 namespace가 섞이지 않음 |
| 동적 도구 | 노출한 schema와 실행 implementation이 일치함 |
| 기본 하네스 기능 | 허용하지 않은 파일·셸·위임 경로가 열리지 않음 |
| 모델 전환 | 요약·토큰 계산·자식·구조화 출력까지 호환됨 |
| 승인·재개 | context와 revision을 복원하고 현재 권한을 재확인함 |
| 분산 장애 | 단일 writer·멱등성·예산 계약이 유지됨 |

검증 전에는 “모든 프로필을 완전히 동적으로 처리한다”가 아니라 **지원하는 템플릿·모델·도구 조합을 명시한 request-scoped 실행 구현**으로 표현하는 것이 정확하다.

## 결론

Deep Agents는 request-scoped 프로필을 구현할 수 있는 유효한 연결 지점을 제공한다. 핵심은 프로필을 전역 에이전트에 덮어쓰는 것이 아니라, **확정된 실행 컨텍스트를 모델 요청·도구 실행·backend에 일관되게 전달하는 것**이다.

미들웨어 연결은 시작점이고, 분산 환경에서의 완성도는 실행 명세·재개·단일 writer·현재 권한·멱등성 계약을 함께 구현했는지로 판단한다.

## 참고 자료

1. [Runtime — LangChain](https://docs.langchain.com/oss/python/langchain/runtime)
2. [Customize Deep Agents — LangChain](https://docs.langchain.com/oss/python/deepagents/customization)
3. [Custom middleware — LangChain](https://docs.langchain.com/oss/python/langchain/middleware/custom)
4. [Harness profiles — Deep Agents](https://docs.langchain.com/oss/python/deepagents/profiles)
5. [Tools: dynamic selection and runtime registration — LangChain](https://docs.langchain.com/oss/python/langchain/tools)
6. [Backends — Deep Agents](https://docs.langchain.com/oss/python/deepagents/backends)
7. [Permissions — Deep Agents](https://docs.langchain.com/oss/python/deepagents/permissions)
8. [Human-in-the-loop — Deep Agents](https://docs.langchain.com/oss/python/deepagents/human-in-the-loop), [Interrupts — LangGraph](https://docs.langchain.com/oss/python/langgraph/interrupts)
9. [Dynamic subagents — Deep Agents](https://docs.langchain.com/oss/python/deepagents/dynamic-subagents)
10. [Going to production — Deep Agents](https://docs.langchain.com/oss/python/deepagents/going-to-production)
