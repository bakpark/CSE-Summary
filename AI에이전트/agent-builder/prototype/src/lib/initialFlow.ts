import type { FlowData, FlowNode } from '@flowiseai/agentflow'

const models = [
  { label: 'GPT-6.1 Sol', name: 'gpt-6.1-sol' },
  { label: 'GPT-6 Astra', name: 'gpt-6-astra' },
  { label: 'GPT-6 Luna', name: 'gpt-6-luna' }
]

function node(
  id: string,
  name: string,
  label: string,
  type: string,
  color: string,
  position: { x: number; y: number },
  inputs: Record<string, unknown>,
  inputParams: Array<Record<string, unknown> & { name: string; label: string; type: string }>,
  hideInput = false
): FlowNode {
  return {
    id,
    type: 'agentflowNode',
    position,
    data: {
      id,
      name,
      label,
      type,
      color,
      hideInput,
      inputs,
      inputParams: inputParams.map((input) => ({ ...input, id: `${id}-input-${String(input.name)}-${String(input.type)}` })),
      inputAnchors: [],
      outputAnchors: [{ id: `${id}-output-0`, name: 'output', label: 'Output', type: 'string' }]
    }
  }
}

export const INITIAL_FLOW: FlowData = {
  nodes: [
    node(
      'startAgentflow_0',
      'startAgentflow',
      '요청 접수',
      'Start',
      '#77A47A',
      { x: 60, y: 180 },
      { inputLabel: 'request', inputSchema: '{\n  "type": "object",\n  "properties": {\n    "text": { "type": "string" }\n  },\n  "required": ["text"]\n}' },
      [
        { name: 'inputLabel', label: '입력 이름', type: 'string', default: 'request' },
        { name: 'inputSchema', label: '입력 JSON Schema', type: 'json', rows: 8 }
      ],
      true
    ),
    node(
      'agentAgentflow_0',
      'agentAgentflow',
      '요청 분석',
      'Agent',
      '#2F7C83',
      { x: 360, y: 180 },
      {
        llmModel: 'gpt-6.1-sol',
        systemMessage: '사용자의 요청을 분석하고 후속 함수가 처리할 수 있는 구조로 정리합니다.',
        prompt: '{{request}}'
      },
      [
        { name: 'llmModel', label: 'LLM 모델', type: 'options', options: models },
        { name: 'systemMessage', label: '역할과 정책', type: 'string', rows: 8, acceptVariable: true },
        { name: 'prompt', label: '작업 입력', type: 'string', rows: 6, acceptVariable: true }
      ]
    ),
    node(
      'customFunctionAgentflow_0',
      'customFunctionAgentflow',
      '텍스트 정규화',
      'CustomFunction',
      '#8D5F8F',
      { x: 660, y: 180 },
      {
        functionName: 'normalizeText',
        inputSchema: '{\n  "type": "object",\n  "properties": {\n    "text": { "type": "string" }\n  },\n  "required": ["text"]\n}',
        javascriptFunction: 'function normalizeText(input) {\n  return { text: input.text.trim().replace(/\\s+/g, " ") }\n}',
        outputSchema: '{\n  "type": "object",\n  "properties": {\n    "text": { "type": "string" }\n  },\n  "required": ["text"]\n}'
      },
      [
        { name: 'functionName', label: '함수 이름', type: 'string' },
        { name: 'inputSchema', label: '입력 JSON Schema', type: 'json', rows: 8 },
        { name: 'javascriptFunction', label: 'JavaScript', type: 'code', codeLanguage: 'javascript', rows: 14 },
        { name: 'outputSchema', label: '출력 JSON Schema', type: 'json', rows: 8 }
      ]
    ),
    node(
      'directReplyAgentflow_0',
      'directReplyAgentflow',
      '결과 반환',
      'DirectReply',
      '#3C8A72',
      { x: 960, y: 180 },
      { message: '{{텍스트 정규화.output}}' },
      [{ name: 'message', label: '응답', type: 'string', rows: 7, acceptVariable: true }]
    )
  ],
  edges: [
    edge('startAgentflow_0', 'agentAgentflow_0', '#77A47A', '#2F7C83'),
    edge('agentAgentflow_0', 'customFunctionAgentflow_0', '#2F7C83', '#8D5F8F'),
    edge('customFunctionAgentflow_0', 'directReplyAgentflow_0', '#8D5F8F', '#3C8A72')
  ],
  viewport: { x: 0, y: 0, zoom: 0.82 }
}

function edge(source: string, target: string, sourceColor: string, targetColor: string) {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    sourceHandle: `${source}-output-0`,
    targetHandle: target,
    type: 'agentflowEdge',
    data: { sourceColor, targetColor }
  }
}
