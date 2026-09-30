import OpenAI from 'openai'
import { z } from 'zod'

import {
  addNode,
  cloneFlow,
  connectNodes,
  disconnectNodes,
  inspectFlow,
  removeNode,
  resetFlow,
  updateNode,
  validateFlowShape,
  type AddNodeArgs,
  type UpdateNodeArgs
} from './graphTools.js'
import { graphToolDefinitions } from './tools.js'
import type { FlowData, ReActStep } from './types.js'

const requestSchema = z.object({
  mode: z.enum(['draft', 'edit', 'script']),
  instruction: z.string().min(2).max(6000),
  model: z.string().min(1),
  flow: z.custom<FlowData>((value) => Boolean(value && typeof value === 'object')),
  targetNodeId: z.string().optional()
})

export interface ReActResult {
  flow: FlowData
  message: string
  steps: ReActStep[]
  changedNodeIds: string[]
}

interface FunctionCallItem {
  type: 'function_call'
  name: string
  arguments: string
  call_id: string
}

interface ResponseLike {
  id: string
  output: unknown[]
  output_text: string
}

export interface ResponsesLike {
  create(payload: Record<string, unknown>): Promise<ResponseLike>
}

function systemPrompt(mode: 'draft' | 'edit' | 'script', targetNodeId?: string): string {
  return `당신은 Flowise 기반 Agent Builder의 그래프 편집 에이전트다.
사용자에게 내부 추론을 노출하지 말고, 제공된 그래프 도구로만 변경한다.
항상 inspect_flow로 현재 상태를 관찰한 뒤 필요한 도구를 호출하고 결과를 확인한다.
draft 모드에서는 reset_flow 후 Start 노드부터 완전한 연결 그래프를 만든다.
edit 모드에서는 기존 구조를 최대한 보존하고 요청한 부분만 수정한다.
script 모드에서는 대상 Function 노드(${targetNodeId ?? '지정 안 됨'})의 JavaScript와 필요 시 입출력 JSON Schema만 수정한다.
Agent/LLM 노드에는 반드시 model을 지정한다. Function 노드는 부작용 없는 순수 함수로 만들고 입력과 출력 JSON Schema를 명시한다.
마지막에는 도구 호출을 멈추고 변경 사항을 한국어 두 문장 이내로 요약한다.`
}

function functionCalls(output: unknown[]): FunctionCallItem[] {
  return output.filter((item): item is FunctionCallItem => {
    if (!item || typeof item !== 'object') return false
    return (item as { type?: string }).type === 'function_call'
  })
}

export async function runReActTransform(
  rawRequest: unknown,
  apiKey = process.env.OPENAI_API_KEY,
  responsesOverride?: ResponsesLike
): Promise<ReActResult> {
  const request = requestSchema.parse(rawRequest)
  if (!apiKey && !responsesOverride) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. prototype/.env.example을 참고해 서버 환경 변수로 주입하세요.')
  if (request.mode === 'script' && !request.targetNodeId) throw new Error('스크립트 수정 대상 Function 노드를 선택하세요.')

  const responses = responsesOverride ?? (new OpenAI({ apiKey }).responses as unknown as ResponsesLike)
  const flow = cloneFlow(request.flow)
  const steps: ReActStep[] = []
  const changedNodeIds = new Set<string>()
  let response = await responses.create({
    model: request.model,
    instructions: systemPrompt(request.mode, request.targetNodeId),
    input: `작업 모드: ${request.mode}\n사용자 요청: ${request.instruction}\n선택 노드: ${request.targetNodeId ?? '없음'}`,
    tools: graphToolDefinitions,
    parallel_tool_calls: false,
    reasoning: { effort: request.mode === 'script' ? 'medium' : 'high' }
  })

  for (let turn = 0; turn < 10; turn += 1) {
    const calls = functionCalls(response.output as unknown[])
    if (calls.length === 0) {
      const errors = validateFlowShape(flow)
      if (errors.length > 0) throw new Error(`생성된 그래프 검증에 실패했습니다: ${errors.join(' ')}`)
      return {
        flow,
        message: response.output_text || '요청한 변경을 적용했습니다.',
        steps,
        changedNodeIds: [...changedNodeIds]
      }
    }

    const outputs: Array<{ type: 'function_call_output'; call_id: string; output: string }> = []
    for (const call of calls) {
      let result
      let ok = true
      steps.push({ index: steps.length + 1, kind: 'act', tool: call.name, summary: toolLabel(call.name) })
      try {
        const args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
        if (request.mode === 'script' && call.name !== 'inspect_flow' && call.name !== 'update_node') {
          throw new Error('script 모드에서는 대상 노드 조회와 수정만 허용됩니다.')
        }
        if (request.mode !== 'draft' && call.name === 'reset_flow') throw new Error('reset_flow는 draft 모드에서만 허용됩니다.')
        switch (call.name) {
          case 'inspect_flow':
            result = inspectFlow(flow)
            steps.push({ index: steps.length + 1, kind: 'observe', tool: call.name, summary: result.summary, ok: true })
            break
          case 'reset_flow':
            result = resetFlow(flow)
            break
          case 'add_node':
            result = addNode(flow, args as unknown as AddNodeArgs)
            if (typeof result.data?.nodeId === 'string') changedNodeIds.add(result.data.nodeId)
            break
          case 'update_node': {
            const updateArgs = args as unknown as UpdateNodeArgs
            if (request.mode === 'script' && updateArgs.nodeId !== request.targetNodeId) throw new Error('선택한 Function 노드만 수정할 수 있습니다.')
            result = updateNode(flow, updateArgs)
            changedNodeIds.add(updateArgs.nodeId)
            break
          }
          case 'remove_node':
            result = removeNode(flow, String(args.nodeId))
            changedNodeIds.add(String(args.nodeId))
            break
          case 'connect_nodes':
            result = connectNodes(flow, String(args.sourceNodeId), String(args.targetNodeId))
            break
          case 'disconnect_nodes':
            result = disconnectNodes(flow, String(args.sourceNodeId), String(args.targetNodeId))
            break
          default:
            throw new Error(`알 수 없는 도구입니다: ${call.name}`)
        }
      } catch (error) {
        ok = false
        result = { ok: false, summary: error instanceof Error ? error.message : String(error) }
      }
      steps.push({ index: steps.length + 1, kind: 'result', tool: call.name, summary: result.summary, ok })
      outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) })
    }

    response = await responses.create({
      model: request.model,
      previous_response_id: response.id,
      input: outputs,
      tools: graphToolDefinitions,
      parallel_tool_calls: false
    })
  }

  throw new Error('ReAct 편집이 최대 도구 호출 횟수를 초과했습니다. 요청을 더 작게 나눠주세요.')
}

function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    inspect_flow: '현재 그래프를 확인합니다.',
    reset_flow: '새 초안을 준비합니다.',
    add_node: '노드를 추가합니다.',
    update_node: '노드 설정을 수정합니다.',
    remove_node: '노드를 제거합니다.',
    connect_nodes: '노드를 연결합니다.',
    disconnect_nodes: '연결을 제거합니다.'
  }
  return labels[name] ?? name
}
