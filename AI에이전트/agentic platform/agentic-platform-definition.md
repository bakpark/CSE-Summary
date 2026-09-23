# Agentic Platform의 정의

> **Agentic Platform은 회사의 업무 방식과 서비스 절차를 에이전트로 담아내고, 임직원과 고객이 어떤 채널에 있든 이를 안전하게 호출하고 실행할 수 있도록 제공하는 공통 AI 실행 기반이다.**

에이전트는 사용자에게 보이는 표면이다. 그 안에는 단순한 Prompt가 아니라 목표, 절차, 판단 기준, 사용할 도구, 권한, 사용자 확인과 완료 조건이 담긴다. 에이전트를 만든다는 것은 챗봇을 만드는 것이 아니라, **회사의 일하는 방식과 결제·혜택·송금 등의 서비스 Workflow를 실행 가능한 형태로 만드는 것**이다.

플랫폼은 하나의 에이전트를 특정 Builder나 화면에 가두지 않는다. 사내용 Work Agent는 Claude Desktop, Web, Slack 등 임직원이 일하는 채널에 공급하고, 대고객 Service Agent는 고객 App과 Web, 상담 채널 등에 공급한다.

```text
회사의 업무·서비스 방식
          ↓
      검증된 Agent
          ↓
     Agentic Platform
   ├─ Work Agents
   │   ├─ Claude Desktop
   │   ├─ Web
   │   └─ Slack
   └─ Service Agents
       ├─ 고객 App
       ├─ 고객 Web
       └─ 상담·API Channel
```

두 영역은 Agent Builder, Stage Runner, Registry, Lifecycle, Tool Gateway, 평가·관측 기준을 공유할 수 있다. 다만 내부 업무와 고객 서비스는 사용자 신원, 접근 데이터, 자격증명, 가용성, 위험 수준이 다르므로 Runtime과 권한 경계를 분리한다.

특히 결제·송금처럼 자금 이동이 발생하는 업무에서 에이전트는 고객 의도를 이해하고 필요한 절차를 안내·조율할 수 있지만, 거래의 정합성과 최종 실행은 기존 도메인 시스템이 보장해야 한다. 플랫폼은 거래 내용에 대한 명시적 고객 확인, 본인 인증, 한도·위험 정책, 중복 실행 방지와 감사 기록을 일관되게 적용한다.

Agentic Platform의 핵심 가치는 다음 세 가지다.

- **업무와 서비스의 자산화**: 내부 업무 방식과 고객 서비스 절차를 반복 가능한 Agent와 Workflow로 만든다.
- **채널 독립적 공급**: 하나의 Agent를 임직원과 고객이 실제로 사용하는 여러 채널에 제공한다.
- **안전한 실행과 권한 관리**: 어디서 호출되더라도 대상 사용자와 서비스 위험에 맞는 권한·승인·감사 기준을 적용한다.

현재 6주 과제는 Agentic Platform의 첫 번째 적용 영역인 **Work Agent Pilot**이다. CCAB로 만든 에이전트를 안전하게 실행·검증하고 Claude Desktop에서 사용할 수 있게 한다. 이후 같은 공통 기반을 Web·Slack과 고객 App·Web의 **Service Agent**로 확장한다.

> **사용자가 Agent 플랫폼을 찾아가는 것이 아니라, Agent가 임직원과 고객이 있는 채널로 찾아가는 환경을 지향한다.**
