import { describe, expect, it } from 'vitest'

import { addNode, emptyFlow } from '../server/graphTools.js'
import { runReActTransform, type ResponsesLike } from '../server/reactEngine.js'

describe('ReAct graph editor', () => {
  it('observes, edits through a strict tool, and returns the validated flow', async () => {
    const flow = emptyFlow()
    const emptyInputs = { instruction: null, model: null, script: null, inputSchema: null, outputSchema: null, x: null, y: null }
    addNode(flow, { ...emptyInputs, nodeType: 'startAgentflow', label: 'Start' })
    addNode(flow, { ...emptyInputs, nodeType: 'llmAgentflow', label: 'Writer', model: 'gpt-6-luna' })

    const responses = [
      {
        id: 'response-1',
        output_text: '',
        output: [{ type: 'function_call', name: 'inspect_flow', arguments: '{}', call_id: 'call-1' }]
      },
      {
        id: 'response-2',
        output_text: '',
        output: [{
          type: 'function_call',
          name: 'update_node',
          arguments: JSON.stringify({
            nodeId: 'llmAgentflow_0',
            label: 'Policy Writer',
            instruction: '정책 문서를 작성합니다.',
            model: 'gpt-6.1-sol',
            script: null,
            inputSchema: null,
            outputSchema: null
          }),
          call_id: 'call-2'
        }]
      },
      { id: 'response-3', output_text: '모델과 지침을 수정했습니다.', output: [] }
    ]
    const fake: ResponsesLike = {
      create: async () => {
        const next = responses.shift()
        if (!next) throw new Error('Unexpected API call')
        return next
      }
    }

    const result = await runReActTransform({
      mode: 'edit',
      instruction: 'Writer 노드를 정책 작성용으로 바꿔줘.',
      model: 'gpt-6.1-sol',
      flow
    }, undefined, fake)

    expect(result.message).toBe('모델과 지침을 수정했습니다.')
    expect(result.flow.nodes[1].data.label).toBe('Policy Writer')
    expect(result.flow.nodes[1].data.inputs?.llmModel).toBe('gpt-6.1-sol')
    expect(result.steps.some((step) => step.kind === 'observe')).toBe(true)
    expect(result.changedNodeIds).toEqual(['llmAgentflow_0'])
  })
})
