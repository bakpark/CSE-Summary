import { describe, expect, it } from 'vitest'

import { addNode, connectNodes, emptyFlow, inspectFlow, updateNode, validateFlowShape } from '../server/graphTools.js'

const nullInputs = {
  instruction: null,
  model: null,
  script: null,
  inputSchema: null,
  outputSchema: null,
  x: null,
  y: null
}

describe('graph tools', () => {
  it('creates a typed function flow with stable connections', () => {
    const flow = emptyFlow()
    addNode(flow, { ...nullInputs, nodeType: 'startAgentflow', label: 'Start' })
    addNode(flow, {
      ...nullInputs,
      nodeType: 'customFunctionAgentflow',
      label: 'Normalize',
      script: 'function normalize(input) { return { text: input.text.trim() } }',
      inputSchema: '{"type":"object","properties":{"text":{"type":"string"}}}',
      outputSchema: '{"type":"object","properties":{"text":{"type":"string"}}}'
    })
    connectNodes(flow, 'startAgentflow_0', 'customFunctionAgentflow_0')

    expect(flow.nodes).toHaveLength(2)
    expect(flow.edges[0].sourceHandle).toBe('startAgentflow_0-output-0')
    expect(validateFlowShape(flow)).toEqual([])
  })

  it('updates the model independently on an LLM node', () => {
    const flow = emptyFlow()
    addNode(flow, { ...nullInputs, nodeType: 'startAgentflow', label: 'Start' })
    addNode(flow, { ...nullInputs, nodeType: 'llmAgentflow', label: 'Summarize', model: 'gpt-6-luna' })
    updateNode(flow, {
      nodeId: 'llmAgentflow_0',
      label: null,
      instruction: '한 문단으로 요약합니다.',
      model: 'gpt-6.1-sol',
      script: null,
      inputSchema: null,
      outputSchema: null
    })

    const inspected = inspectFlow(flow)
    expect(flow.nodes[1].data.inputs?.llmModel).toBe('gpt-6.1-sol')
    expect(inspected.ok).toBe(true)
  })

  it('rejects ambiguous or dynamic scripts', () => {
    const flow = emptyFlow()
    expect(() => addNode(flow, {
      ...nullInputs,
      nodeType: 'customFunctionAgentflow',
      label: 'Unsafe',
      script: 'eval(input.code)'
    })).toThrow()
  })
})
