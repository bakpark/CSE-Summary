import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AgentFlowInstance, FlowData } from '@flowiseai/agentflow'
import { Agentflow } from '@flowiseai/agentflow'
import {
  IconArrowUp,
  IconBraces,
  IconBrain,
  IconCheck,
  IconDownload,
  IconGitBranch,
  IconMoon,
  IconRefresh,
  IconSun,
  IconUpload
} from '@tabler/icons-react'

import { RunTrace } from './components/RunTrace'
import { INITIAL_FLOW } from './lib/initialFlow'
import type { AppConfig, BuilderMode, ReActStep, TransformResponse } from './lib/types'

const STORAGE_KEY = 'flowise-natural-language-builder.flow'
const allowedComponents = [
  'startAgentflow',
  'agentAgentflow',
  'llmAgentflow',
  'customFunctionAgentflow',
  'conditionAgentflow',
  'directReplyAgentflow'
]

const modeCopy: Record<BuilderMode, { label: string; helper: string; button: string }> = {
  draft: { label: '새 초안', helper: '원하는 업무와 결과를 설명하세요.', button: '초안 만들기' },
  edit: { label: '플로우 수정', helper: '현재 구조에서 바꿀 부분만 설명하세요.', button: '수정 적용' },
  script: { label: '스크립트 수정', helper: '선택한 함수의 동작과 입출력 변화를 설명하세요.', button: '함수 수정' }
}

function loadInitialFlow(): FlowData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as FlowData) : INITIAL_FLOW
  } catch {
    return INITIAL_FLOW
  }
}

export default function App() {
  const flowRef = useRef<AgentFlowInstance>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [flow, setFlow] = useState<FlowData>(loadInitialFlow)
  const [canvasRevision, setCanvasRevision] = useState(0)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [model, setModel] = useState('gpt-6.1-sol')
  const [mode, setMode] = useState<BuilderMode>('draft')
  const [instruction, setInstruction] = useState('고객 문의를 분류하고, 개인정보를 제거한 뒤, 답변 초안을 만드는 플로우를 만들어줘.')
  const [scriptInstruction, setScriptInstruction] = useState('빈 문자열을 제거하고 결과에 처리 시각 필드를 추가해줘.')
  const [scriptTargetId, setScriptTargetId] = useState('customFunctionAgentflow_0')
  const [steps, setSteps] = useState<ReActStep[]>([])
  const [message, setMessage] = useState('캔버스에서 노드를 직접 편집하거나 자연어로 구조를 바꿀 수 있습니다.')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  const scriptNodes = useMemo(
    () => flow.nodes.filter((node) => node.data.name === 'customFunctionAgentflow'),
    [flow.nodes]
  )

  useEffect(() => {
    fetch('/api/config')
      .then((response) => response.json())
      .then((nextConfig: AppConfig) => {
        setConfig(nextConfig)
        setModel(nextConfig.defaultModel)
      })
      .catch(() => setError('Builder API에 연결할 수 없습니다. 서버 실행 상태를 확인하세요.'))
  }, [])

  useEffect(() => {
    if (!scriptNodes.some((node) => node.id === scriptTargetId)) setScriptTargetId(scriptNodes[0]?.id ?? '')
  }, [scriptNodes, scriptTargetId])

  async function transform(requestedMode: BuilderMode) {
    const prompt = requestedMode === 'script' ? scriptInstruction : instruction
    if (!prompt.trim()) {
      setError('수정할 내용을 입력하세요.')
      return
    }
    setBusy(true)
    setError('')
    setSteps([])
    setMode(requestedMode)
    try {
      const response = await fetch('/api/flow/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: requestedMode,
          instruction: prompt,
          model,
          flow: flowRef.current?.getFlow() ?? flow,
          targetNodeId: requestedMode === 'script' ? scriptTargetId : undefined
        })
      })
      const payload = (await response.json()) as TransformResponse & { message: string }
      if (!response.ok) throw new Error(payload.message)
      setFlow(payload.flow)
      setSteps(payload.steps)
      setMessage(payload.message)
      setCanvasRevision((revision) => revision + 1)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.flow))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '작업을 완료하지 못했습니다.')
    } finally {
      setBusy(false)
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
        if (!Array.isArray(next.nodes) || !Array.isArray(next.edges)) throw new Error('nodes와 edges가 필요합니다.')
        setFlow(next)
        setCanvasRevision((revision) => revision + 1)
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
    setSteps([])
    setMessage('예제 플로우로 되돌렸습니다.')
  }

  const activeCopy = modeCopy[mode]
  const apiReady = Boolean(config?.apiConfigured)

  return (
    <div className="app" data-theme={isDark ? 'dark' : 'light'}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><IconGitBranch size={19} stroke={1.8} /></span>
          <div>
            <strong>Agent Workshop</strong>
            <span>Flowise canvas with controlled AI editing</span>
          </div>
        </div>

        <div className="model-control">
          <label htmlFor="builder-model">작업 모델</label>
          <select id="builder-model" value={model} onChange={(event) => setModel(event.target.value)}>
            {(config?.models ?? [model]).map((candidate) => <option key={candidate}>{candidate}</option>)}
          </select>
        </div>

        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={() => setIsDark((value) => !value)} aria-label={isDark ? '밝은 테마' : '어두운 테마'}>
            {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          <button className="quiet-button" type="button" onClick={() => importRef.current?.click()}><IconUpload size={16} /> 불러오기</button>
          <button className="quiet-button" type="button" onClick={exportFlow}><IconDownload size={16} /> 내보내기</button>
          <button className="primary-button compact" type="button" onClick={() => saveFlow()}><IconCheck size={16} /> 저장</button>
          <input ref={importRef} className="visually-hidden" type="file" accept="application/json" onChange={importFlow} />
        </div>
      </header>

      <main className="workspace">
        <aside className="command-panel panel-surface">
          <div className="panel-heading">
            <div>
              <span className="section-label">Natural language</span>
              <h1>말로 설계하고 캔버스로 다듬기</h1>
            </div>
            <IconBrain size={22} stroke={1.6} />
          </div>

          <div className="mode-tabs" role="tablist" aria-label="편집 모드">
            {(['draft', 'edit'] as BuilderMode[]).map((candidate) => (
              <button key={candidate} type="button" role="tab" aria-selected={mode === candidate} className={mode === candidate ? 'active' : ''} onClick={() => setMode(candidate)}>
                {modeCopy[candidate].label}
              </button>
            ))}
          </div>

          <div className="field-block grow-field">
            <label htmlFor="flow-instruction">{activeCopy.label}</label>
            <textarea id="flow-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={8} />
            <p className="field-help">{activeCopy.helper}</p>
          </div>

          {!apiReady && config && (
            <div className="inline-notice" role="status">
              <IconBraces size={17} />
              <span>서버에 OPENAI_API_KEY를 설정하면 자연어 편집이 활성화됩니다.</span>
            </div>
          )}

          <button className="primary-button submit-button" type="button" disabled={busy || !apiReady} onClick={() => transform(mode === 'draft' ? 'draft' : 'edit')}>
            <span>{busy ? '작업 중' : activeCopy.button}</span>
            <IconArrowUp size={17} />
          </button>

          <div className="trace-section">
            <div className="subheading">
              <h2>ReAct 실행 기록</h2>
              <span>{steps.length} events</span>
            </div>
            <RunTrace steps={steps} busy={busy} />
          </div>
        </aside>

        <section className="canvas-panel" aria-label="Flowise 편집 캔버스">
          <div className="canvas-bar">
            <div>
              <span className="canvas-title">Flowise Agentflow</span>
              <span className="canvas-meta">노드 {flow.nodes.length}개, 연결 {flow.edges.length}개</span>
            </div>
            <button className="quiet-button" type="button" onClick={resetSample}><IconRefresh size={16} /> 예제로 초기화</button>
          </div>
          <div className="flowise-stage">
            <Agentflow
              key={canvasRevision}
              ref={flowRef}
              apiBaseUrl="/flowise"
              initialFlow={flow}
              components={allowedComponents}
              isDarkMode={isDark}
              enableGenerator={false}
              showDefaultHeader={false}
              showDefaultPalette
              onFlowChange={setFlow}
              onSave={saveFlow}
            />
          </div>
          <div className={`status-bar ${error ? 'has-error' : ''}`} role="status">
            <span>{error || message}</span>
            <span>Agentflow {config?.agentflowVersion ?? 'loading'}</span>
          </div>
        </section>

        <aside className="inspector-panel panel-surface">
          <div className="panel-heading compact-heading">
            <div>
              <span className="section-label">Function contract</span>
              <h2>스크립트 수정</h2>
            </div>
            <IconBraces size={21} stroke={1.6} />
          </div>

          <div className="field-block">
            <label htmlFor="script-node">대상 Function 노드</label>
            <select id="script-node" value={scriptTargetId} onChange={(event) => setScriptTargetId(event.target.value)} disabled={scriptNodes.length === 0}>
              {scriptNodes.length === 0 && <option value="">Function 노드 없음</option>}
              {scriptNodes.map((node) => <option key={node.id} value={node.id}>{node.data.label}</option>)}
            </select>
          </div>

          <div className="field-block">
            <label htmlFor="script-instruction">자연어 수정 요청</label>
            <textarea id="script-instruction" value={scriptInstruction} onChange={(event) => setScriptInstruction(event.target.value)} rows={7} />
            <p className="field-help">코드와 입출력 JSON Schema를 함께 수정할 수 있습니다.</p>
          </div>

          <button className="secondary-button" type="button" disabled={busy || !apiReady || !scriptTargetId} onClick={() => transform('script')}>
            <IconBraces size={17} /> 함수 수정
          </button>

          <div className="contract-preview">
            <h3>선택 노드 계약</h3>
            {scriptNodes.find((node) => node.id === scriptTargetId) ? (
              <>
                <ContractBlock label="Input" value={String(scriptNodes.find((node) => node.id === scriptTargetId)?.data.inputs?.inputSchema ?? '{}')} />
                <ContractBlock label="Output" value={String(scriptNodes.find((node) => node.id === scriptTargetId)?.data.inputs?.outputSchema ?? '{}')} />
              </>
            ) : (
              <p className="empty-copy">캔버스에서 Function 노드를 추가하면 계약을 확인할 수 있습니다.</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}

function ContractBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="contract-block">
      <span>{label}</span>
      <pre>{value}</pre>
    </div>
  )
}
