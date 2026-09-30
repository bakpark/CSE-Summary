import { IconActivity, IconCheck, IconEye, IconTool, IconX } from '@tabler/icons-react'

import type { ReActStep } from '../lib/types'

interface RunTraceProps {
  steps: ReActStep[]
  busy: boolean
}

export function RunTrace({ steps, busy }: RunTraceProps) {
  if (steps.length === 0 && !busy) {
    return (
      <div className="trace-empty">
        <IconActivity size={18} stroke={1.7} />
        <p>작업을 시작하면 그래프 관찰과 도구 실행 기록이 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <ol className="trace-list" aria-live="polite">
      {steps.map((step) => (
        <li key={`${step.index}-${step.kind}`} className={`trace-item trace-${step.kind}`}>
          <span className="trace-icon" aria-hidden="true">
            {step.kind === 'observe' ? <IconEye size={14} /> : step.kind === 'act' ? <IconTool size={14} /> : step.ok === false ? <IconX size={14} /> : <IconCheck size={14} />}
          </span>
          <span>{step.summary}</span>
        </li>
      ))}
      {busy && (
        <li className="trace-item trace-running">
          <span className="trace-pulse" aria-hidden="true" />
          <span>ReAct 엔진이 다음 작업을 결정하고 있습니다.</span>
        </li>
      )}
    </ol>
  )
}
