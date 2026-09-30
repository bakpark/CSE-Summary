import type { FlowNode, FlowNodeData } from './types.js'

type InputDefinition = Record<string, unknown> & {
  name: string
  label: string
  type: string
  default?: unknown
}

export interface NodeDefinition {
  name: string
  label: string
  type: string
  category: string
  description: string
  version: number
  color: string
  hideInput?: boolean
  inputs: InputDefinition[]
  outputs: Array<{ label: string; name: string; type: string }>
}

const modelOptions = [
  { label: 'GPT-6.1 Sol', name: 'gpt-6.1-sol' },
  { label: 'GPT-6 Astra', name: 'gpt-6-astra' },
  { label: 'GPT-6 Luna', name: 'gpt-6-luna' }
]

export const NODE_CATALOG: NodeDefinition[] = [
  {
    name: 'startAgentflow',
    label: 'Start',
    type: 'Start',
    category: 'Agent Flows',
    description: '워크플로 입력과 초기 상태를 정의합니다.',
    version: 1.3,
    color: '#77A47A',
    hideInput: true,
    inputs: [
      { id: 'start-input-label', name: 'inputLabel', label: '입력 이름', type: 'string', default: 'request' },
      { id: 'start-input-schema', name: 'inputSchema', label: '입력 JSON Schema', type: 'json', default: '{\n  "type": "object",\n  "properties": {}\n}', rows: 8 }
    ],
    outputs: [{ label: 'Start', name: 'start', type: 'string' }]
  },
  {
    name: 'agentAgentflow',
    label: 'Agent',
    type: 'Agent',
    category: 'Agent Flows',
    description: '도구를 사용해 목표를 수행하는 에이전트입니다.',
    version: 3.2,
    color: '#2F7C83',
    inputs: [
      { id: 'agent-model', name: 'llmModel', label: 'LLM 모델', type: 'options', default: 'gpt-6.1-sol', options: modelOptions },
      { id: 'agent-role', name: 'systemMessage', label: '역할과 정책', type: 'string', default: '', rows: 8, acceptVariable: true },
      { id: 'agent-prompt', name: 'prompt', label: '작업 입력', type: 'string', default: '{{request}}', rows: 6, acceptVariable: true }
    ],
    outputs: [{ label: 'Output', name: 'output', type: 'string' }]
  },
  {
    name: 'llmAgentflow',
    label: 'LLM',
    type: 'LLM',
    category: 'Agent Flows',
    description: '선택한 모델에 단일 추론 작업을 요청합니다.',
    version: 1.1,
    color: '#4E78A0',
    inputs: [
      { id: 'llm-model', name: 'llmModel', label: 'LLM 모델', type: 'options', default: 'gpt-6.1-sol', options: modelOptions },
      { id: 'llm-system', name: 'systemMessage', label: '시스템 지침', type: 'string', default: '', rows: 7, acceptVariable: true },
      { id: 'llm-prompt', name: 'prompt', label: '프롬프트', type: 'string', default: '{{request}}', rows: 7, acceptVariable: true },
      { id: 'llm-output', name: 'outputSchema', label: '출력 JSON Schema', type: 'json', default: '{\n  "type": "object",\n  "properties": {}\n}', rows: 7 }
    ],
    outputs: [{ label: 'Output', name: 'output', type: 'string' }]
  },
  {
    name: 'customFunctionAgentflow',
    label: 'Function',
    type: 'CustomFunction',
    category: 'Agent Flows',
    description: '명확한 입력과 출력을 갖는 결정적 JavaScript 함수입니다. 코드는 정의만 저장하며 이 Builder 서버에서 실행하지 않습니다.',
    version: 1.1,
    color: '#8D5F8F',
    inputs: [
      { id: 'function-name', name: 'functionName', label: '함수 이름', type: 'string', default: 'transformInput' },
      { id: 'function-input', name: 'inputSchema', label: '입력 JSON Schema', type: 'json', default: '{\n  "type": "object",\n  "properties": {}\n}', rows: 8 },
      { id: 'function-code', name: 'javascriptFunction', label: 'JavaScript', type: 'code', codeLanguage: 'javascript', default: 'function transformInput(input) {\n  return input\n}', rows: 14 },
      { id: 'function-output', name: 'outputSchema', label: '출력 JSON Schema', type: 'json', default: '{\n  "type": "object",\n  "properties": {}\n}', rows: 8 }
    ],
    outputs: [{ label: 'Output', name: 'output', type: 'string' }]
  },
  {
    name: 'conditionAgentflow',
    label: 'Condition',
    type: 'Condition',
    category: 'Agent Flows',
    description: '표현식 결과에 따라 경로를 나눕니다.',
    version: 1,
    color: '#BB7A2A',
    inputs: [
      { id: 'condition-expression', name: 'expression', label: '조건식', type: 'string', default: 'Boolean(input)', rows: 4, acceptVariable: true }
    ],
    outputs: [
      { label: 'True', name: 'true', type: 'boolean' },
      { label: 'False', name: 'false', type: 'boolean' }
    ]
  },
  {
    name: 'directReplyAgentflow',
    label: 'Reply',
    type: 'DirectReply',
    category: 'Agent Flows',
    description: '최종 결과를 호출자에게 반환합니다.',
    version: 1,
    color: '#3C8A72',
    inputs: [
      { id: 'reply-message', name: 'message', label: '응답', type: 'string', default: '{{previous.output}}', rows: 7, acceptVariable: true }
    ],
    outputs: [{ label: 'Output', name: 'output', type: 'string' }]
  }
]

export const ALLOWED_NODE_TYPES = NODE_CATALOG.map((node) => node.name)

export function getDefinition(name: string): NodeDefinition {
  const definition = NODE_CATALOG.find((candidate) => candidate.name === name)
  if (!definition) throw new Error(`지원하지 않는 노드 유형입니다: ${name}`)
  return definition
}

function defaultFor(input: InputDefinition): unknown {
  if ('default' in input) return input.default
  if (input.type === 'boolean') return false
  if (input.type === 'number') return 0
  if (input.type === 'array') return []
  return ''
}

export function createNodeData(definition: NodeDefinition, id: string, label?: string): FlowNodeData {
  const outputs = definition.outputs.map((output, index) => ({
    id: `${id}-output-${index}`,
    name: output.name,
    label: output.label,
    type: output.type
  }))

  return {
    id,
    name: definition.name,
    label: label || definition.label,
    type: definition.type,
    category: definition.category,
    description: definition.description,
    version: definition.version,
    color: definition.color,
    hideInput: definition.hideInput,
    inputParams: definition.inputs.map((input) => ({ ...input, id: `${id}-input-${input.name}-${input.type}` })),
    inputs: Object.fromEntries(definition.inputs.map((input) => [input.name, defaultFor(input)])),
    inputAnchors: [],
    outputAnchors: outputs
  }
}

export function createNode(name: string, id: string, label: string | undefined, x: number, y: number): FlowNode {
  const definition = getDefinition(name)
  return {
    id,
    type: 'agentflowNode',
    position: { x, y },
    data: createNodeData(definition, id, label)
  }
}
