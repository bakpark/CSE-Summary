import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import type { AgentFlowInstance, FlowData } from '@flowiseai/agentflow'
import {
  IconArrowUp,
  IconBraces,
  IconCheck,
  IconChevronRight,
  IconDownload,
  IconGitBranch,
  IconLayoutSidebarRight,
  IconMessageCircle,
  IconMoon,
  IconRefresh,
  IconSparkles,
  IconSun,
  IconUpload,
  IconX
} from '@tabler/icons-react'

import { RunTrace } from './components/RunTrace'
import { INITIAL_FLOW } from './lib/initialFlow'
import type { AppConfig, BuilderMode, ReActStep, TransformResponse } from './lib/types'

const STORAGE_KEY = 'flowise-natural-language-builder.flow'
const AgentflowCanvas = lazy(() => import('@flowiseai/agentflow').then((module) => ({ default: module.Agentflow })))
const allowedComponents = [
  'startAgentflow', 'agentAgentflow', 'llmAgentflow', 'customFunctionAgentflow',
  'conditionAgentflow', 'directReplyAgentflow'
]

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  steps?: ReActStep[]
}

interface PendingChange {
  response: TransformResponse
  before: FlowData
}

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '어떤 에이전트를 만들까요? 업무와 원하는 결과를 설명하면 변경안을 준비합니다. 캔버스는 언제든 직접 편집할 수 있습니다.'
}

function loadInitialFlow(): FlowData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as FlowData) : INITIAL_FLOW
  } catch {
    return INITIAL_FLOW
  }
}

function formatContract(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value ?? {}, null, 2)
}

export default function App() {
  const flowRef = useRef<AgentFlowInstance>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [flow, setFlow] = useState<FlowData>(loadInitialFlow)
  const [canvasRevision, setCanvasRevision] = useState(0)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [model, setModel] = useState('gpt-6.1-sol')
  const [scope, setScope] = useState('flow')
  const [instruction, setInstruction] = useState('고객 문의를 분류하고, 개인정보를 제거한 뒤, 답변 초안을 만드는 플로우를 만들어줘.')
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage])
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)
  const [message, setMessage] = useState('준비됨')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  const scriptNodes = useMemo(
    () => flow.nodes.filter((node) => node.data.name === 'customFunctionAgentflow'),
    [flow.nodes]
  )
  const scopedNode = scope.startsWith('script:')
    ? scriptNodes.find((node) => node.id === scope.slice(7))
    : undefined
  const changedNodes = useMemo(() => {
    if (!pendingChange) return []
    const ids = new Set(pendingChange.response.changedNodeIds)
    return pendingChange.response.flow.nodes.filter((node) => ids.has(node.id))
  }, [pendingChange])

  useEffect(() => {
    fetch('/api/config')
      .then((response) => response.json())
      .then((nextConfig: AppConfig) => {
        setConfig(nextConfig)
        setModel(nextConfig.defaultModel)
      })
      .catch(() => setError('Builder API에 연결할 수 없습니다. 서버를 실행한 뒤 다시 시도하세요.'))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, busy])

  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  }, [isDark])

  async function transform() {
    const prompt = instruction.trim()
    if (!prompt) {
      setError('요청 내용을 입력하세요.')
      return
    }

    const currentFlow = flowRef.current?.getFlow() ?? flow
    const isScript = scope.startsWith('script:')
    const requestedMode: BuilderMode = isScript ? 'script' : scope === 'new' ? 'draft' : 'edit'
    const targetNodeId = isScript ? scope.slice(7) : undefined

    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: prompt }])
    setInstruction('')
    setBusy(true)
    setError('')
    setPendingChange(null)

    try {
      const response = await fetch('/api/flow/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: requestedMode, instruction: prompt, model, flow: currentFlow, targetNodeId })
      })
      const payload = (await response.json()) as TransformResponse & { message: string }
      if (!response.ok) throw new Error(payload.message)

      setPendingChange({ response: payload, before: currentFlow })
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: payload.message, steps: payload.steps }
      ])
      setMessage('변경안 검토 대기 중')
      setInspectorOpen(true)
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : '작업을 완료하지 못했습니다.'
      setError(nextError)
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: `${nextError} 설정을 확인한 뒤 다시 요청하세요.` }
      ])
    } finally {
      setBusy(false)
    }
  }

  function applyPendingChange() {
    if (!pendingChange) return
    setFlow(pendingChange.response.flow)
    setCanvasRevision((revision) => revision + 1)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingChange.response.flow))
    setPendingChange(null)
    setMessage('변경안을 적용하고 저장했습니다.')
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'assistant', content: '변경안을 캔버스에 적용했습니다. 이어서 수정할 내용을 말해 주세요.' }
    ])
    if (scope === 'new') setScope('flow')
  }

  function discardPendingChange() {
    setPendingChange(null)
    setMessage('변경안을 취소했습니다.')
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void transform()
    }
  }

  function saveFlow(nextFlow = flowRef.current?.getFlow() ?? flow) {
    setFlow(nextFlow)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextFlow))
    setMessage('현재 플로우를 이 브라우저에 저장했습니다.')
  }

  function exportFlow() {
    const current = flowRef.current?.getFlow() ?? flow
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'agent-flow.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function importFlow(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result)) as FlowData
        if (!Array.isArray(next.nodes) || !Array.isArray(next.edges)) throw new Error('nodes와 edges가 있는 Flowise JSON이 필요합니다.')
        setFlow(next)
        setCanvasRevision((revision) => revision + 1)
        setPendingChange(null)
        setMessage('JSON 플로우를 불러왔습니다.')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'JSON을 불러오지 못했습니다.')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function resetSample() {
    setFlow(INITIAL_FLOW)
    setCanvasRevision((revision) => revision + 1)
    setPendingChange(null)
    setMessage('예제 플로우로 되돌렸습니다.')
  }

  function startNewConversation() {
    setMessages([welcomeMessage])
    setInstruction('')
    setScope('new')
    setPendingChange(null)
    setError('')
  }

  const apiReady = Boolean(config?.apiConfigured)

  return (
    <div className="app" data-theme={isDark ? 'dark' : 'light'}>
      <a className="skip-link" href="#flow-canvas">캔버스로 건너뛰기</a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><IconGitBranch size={19} stroke={1.8} aria-hidden="true" /></span>
          <div><strong>Agent Workshop</strong><span>AI-assisted Flowise builder</span></div>
        </div>

        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={() => setIsDark((value) => !value)} aria-label={isDark ? '밝은 테마 사용' : '어두운 테마 사용'}>
            {isDark ? <IconSun size={18} aria-hidden="true" /> : <IconMoon size={18} aria-hidden="true" />}
          </button>
          <button className="quiet-button file-action" type="button" onClick={() => importRef.current?.click()}><IconUpload size={16} aria-hidden="true" /> 불러오기</button>
          <button className="quiet-button file-action" type="button" onClick={exportFlow}><IconDownload size={16} aria-hidden="true" /> 내보내기</button>
          <button className="primary-button compact" type="button" onClick={() => saveFlow()}><IconCheck size={16} aria-hidden="true" /> 저장</button>
          <input ref={importRef} className="visually-hidden" type="file" accept="application/json" aria-label="Flowise JSON 불러오기" onChange={importFlow} />
        </div>
      </header>

      <main className={`workspace ${inspectorOpen ? 'with-inspector' : ''}`}>
        <aside className="chat-panel panel-surface" aria-label="Builder 대화">
          <div className="chat-header">
            <div><span className="section-label">Builder chat</span><h1>에이전트 만들기</h1></div>
            <button className="icon-button" type="button" onClick={startNewConversation} aria-label="새 대화 시작" title="새 대화 시작"><IconMessageCircle size={18} aria-hidden="true" /></button>
          </div>

          <div className="conversation" aria-live="polite">
            {messages.map((item) => (
              <article key={item.id} className={`chat-message ${item.role}`}>
                <div className="message-author">{item.role === 'assistant' ? 'Builder' : '나'}</div>
                <p>{item.content}</p>
                {item.steps && item.steps.length > 0 && (
                  <details className="activity-details">
                    <summary><IconSparkles size={15} aria-hidden="true" /> 작업 기록 {item.steps.length}개</summary>
                    <RunTrace steps={item.steps} busy={false} />
                  </details>
                )}
              </article>
            ))}
            {busy && (
              <article className="chat-message assistant working-message">
                <div className="message-author">Builder</div>
                <div className="working-row"><span className="trace-pulse" aria-hidden="true" /> 플로우를 살펴보고 변경안을 만들고 있습니다…</div>
              </article>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="composer-wrap">
            {!apiReady && config && (
              <div className="inline-notice" role="status"><IconBraces size={17} aria-hidden="true" /><span>서버에 OPENAI_API_KEY를 설정하면 AI 편집을 사용할 수 있습니다.</span></div>
            )}
            {error && <p className="composer-error" role="alert">{error}</p>}
            <div className="composer">
              <label className="visually-hidden" htmlFor="flow-instruction">Builder에게 요청하기</label>
              <textarea id="flow-instruction" name="flowInstruction" autoComplete="off" value={instruction} onChange={(event) => setInstruction(event.target.value)} onKeyDown={handleComposerKeyDown} rows={4} placeholder="만들거나 수정할 내용을 설명하세요…" />
              <div className="composer-tools">
                <label className="compact-select"><span>범위</span><select value={scope} onChange={(event) => setScope(event.target.value)} aria-label="편집 범위">
                  <option value="flow">현재 플로우</option><option value="new">새 플로우</option>
                  {scriptNodes.map((node) => <option key={node.id} value={`script:${node.id}`}>함수: {node.data.label}</option>)}
                </select></label>
                <label className="compact-select model-select"><span>모델</span><select value={model} onChange={(event) => setModel(event.target.value)} aria-label="Builder 작업 모델">
                  {(config?.models ?? [model]).map((candidate) => <option key={candidate}>{candidate}</option>)}
                </select></label>
                <button className="send-button" type="button" disabled={busy || !apiReady || !instruction.trim()} onClick={() => void transform()} aria-label="요청 보내기"><IconArrowUp size={18} aria-hidden="true" /></button>
              </div>
            </div>
            <p className="composer-hint">⌘/Ctrl + Enter로 전송 · 변경 전 검토할 수 있습니다.</p>
          </div>
        </aside>

        <section id="flow-canvas" className="canvas-panel" aria-label="Flowise 편집 캔버스">
          <div className="canvas-bar">
            <div><span className="canvas-title">Flowise Agentflow</span><span className="canvas-meta">노드 {flow.nodes.length}개 · 연결 {flow.edges.length}개</span></div>
            <div className="canvas-actions">
              <button className="quiet-button reset-action" type="button" onClick={resetSample}><IconRefresh size={16} aria-hidden="true" /> 예제로 초기화</button>
              <button className={`icon-button ${inspectorOpen ? 'active' : ''}`} type="button" onClick={() => setInspectorOpen((value) => !value)} aria-label={inspectorOpen ? '검토 패널 닫기' : '검토 패널 열기'} aria-expanded={inspectorOpen}><IconLayoutSidebarRight size={18} aria-hidden="true" /></button>
            </div>
          </div>
          <div className="flowise-stage">
            <Suspense fallback={<div className="canvas-loading" role="status"><span className="trace-pulse" aria-hidden="true" /> 캔버스를 불러오고 있습니다…</div>}>
              <AgentflowCanvas key={canvasRevision} ref={flowRef} apiBaseUrl="/flowise" initialFlow={flow} components={allowedComponents} isDarkMode={isDark} enableGenerator={false} showDefaultHeader={false} showDefaultPalette onFlowChange={setFlow} onSave={saveFlow} />
            </Suspense>
          </div>
          <div className={`status-bar ${error ? 'has-error' : ''}`} role="status"><span>{error || message}</span><span>Agentflow {config?.agentflowVersion ?? '확인 중…'}</span></div>
        </section>

        {inspectorOpen && (
          <aside className="inspector-panel panel-surface" aria-label="변경 검토 및 컨텍스트">
            <div className="inspector-header">
              <div><span className="section-label">Context</span><h2>{pendingChange ? '변경안 검토' : '플로우 컨텍스트'}</h2></div>
              <button className="icon-button" type="button" onClick={() => setInspectorOpen(false)} aria-label="검토 패널 닫기"><IconX size={18} aria-hidden="true" /></button>
            </div>

            {pendingChange ? (
              <div className="review-content">
                <div className="review-summary"><IconSparkles size={18} aria-hidden="true" /><div><strong>{changedNodes.length || pendingChange.response.changedNodeIds.length}개 노드 변경</strong><span>캔버스에는 아직 반영되지 않았습니다.</span></div></div>
                <div className="change-list" aria-label="변경 노드 목록">
                  {changedNodes.length > 0 ? changedNodes.map((node) => (
                    <div className="change-item" key={node.id}><span className="change-dot" aria-hidden="true" /><div><strong>{node.data.label}</strong><span>{node.data.name}</span></div><IconChevronRight size={16} aria-hidden="true" /></div>
                  )) : <p className="empty-copy">전체 플로우 구조가 새로 작성됩니다.</p>}
                </div>
                <div className="review-actions"><button className="primary-button" type="button" onClick={applyPendingChange}><IconCheck size={17} aria-hidden="true" /> 변경 적용</button><button className="quiet-button" type="button" onClick={discardPendingChange}><IconX size={17} aria-hidden="true" /> 취소</button></div>
              </div>
            ) : scopedNode ? (
              <div className="contract-preview">
                <div className="context-card"><IconBraces size={18} aria-hidden="true" /><div><strong>{scopedNode.data.label}</strong><span>대화 입력기의 편집 범위로 선택됨</span></div></div>
                <ContractBlock label="Input" value={formatContract(scopedNode.data.inputs?.inputSchema)} />
                <ContractBlock label="Output" value={formatContract(scopedNode.data.inputs?.outputSchema)} />
              </div>
            ) : (
              <div className="inspector-empty"><IconLayoutSidebarRight size={25} stroke={1.5} aria-hidden="true" /><h3>필요할 때만 열리는 패널</h3><p>AI 변경안 검토와 선택한 Function 노드의 입출력 계약을 여기에 표시합니다.</p></div>
            )}
          </aside>
        )}
      </main>
    </div>
  )
}

function ContractBlock({ label, value }: { label: string; value: string }) {
  return <div className="contract-block"><span>{label}</span><pre>{value}</pre></div>
}
