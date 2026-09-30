import { createNode, getDefinition } from './catalog.js'
import type { FlowData, FlowEdge, FlowNode } from './types.js'

export type NodeKind =
  | 'startAgentflow'
  | 'agentAgentflow'
  | 'llmAgentflow'
  | 'customFunctionAgentflow'
  | 'conditionAgentflow'
  | 'directReplyAgentflow'

export interface AddNodeArgs {
  nodeType: NodeKind
  label: string
  instruction: string | null
  model: string | null
  script: string | null
  inputSchema: string | null
  outputSchema: string | null
  x: number | null
  y: number | null
}

export interface UpdateNodeArgs {
  nodeId: string
  label: string | null
  instruction: string | null
  model: string | null
  script: string | null
  inputSchema: string | null
  outputSchema: string | null
}

export interface ToolResult {
  ok: boolean
  summary: string
  data?: Record<string, unknown>
}

export function cloneFlow(flow: FlowData): FlowData {
  return JSON.parse(JSON.stringify(flow)) as FlowData
}

export function emptyFlow(): FlowData {
  return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 0.9 } }
}

export function nextNodeId(flow: FlowData, name: string): string {
  let index = 0
  while (flow.nodes.some((node) => node.id === `${name}_${index}`)) index += 1
  return `${name}_${index}`
}

function autoPosition(flow: FlowData): { x: number; y: number } {
  const index = flow.nodes.length
  return { x: 90 + (index % 4) * 290, y: 120 + Math.floor(index / 4) * 220 }
}

function parseSchema(value: string | null, label: string): string | null {
  if (value === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error(`${label}가 유효한 JSON이 아닙니다.`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label}는 JSON 객체여야 합니다.`)
  }
  return JSON.stringify(parsed, null, 2)
}

export function validateScript(script: string): void {
  if (!/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/.test(script) && !/=>/.test(script)) {
    throw new Error('스크립트는 이름이 있는 함수 또는 화살표 함수를 포함해야 합니다.')
  }
  if (/\b(eval|Function)\s*\(/.test(script)) {
    throw new Error('eval과 Function 생성자는 사용할 수 없습니다.')
  }
  // Compilation only. The function is never invoked by the Builder server.
  new Function(`"use strict";\n${script}`)
}

function applyNodeInputs(node: FlowNode, args: Omit<AddNodeArgs, 'nodeType' | 'label' | 'x' | 'y'> | Omit<UpdateNodeArgs, 'nodeId' | 'label'>): void {
  const inputs = node.data.inputs ?? {}
  if (args.model !== null) inputs.llmModel = args.model
  if (args.instruction !== null) {
    if (node.data.name === 'directReplyAgentflow') inputs.message = args.instruction
    else if (node.data.name === 'conditionAgentflow') inputs.expression = args.instruction
    else inputs.systemMessage = args.instruction
  }
  if (args.inputSchema !== null) inputs.inputSchema = parseSchema(args.inputSchema, '입력 스키마')
  if (args.outputSchema !== null) inputs.outputSchema = parseSchema(args.outputSchema, '출력 스키마')
  if (args.script !== null) {
    if (node.data.name !== 'customFunctionAgentflow') throw new Error('스크립트는 Function 노드에만 설정할 수 있습니다.')
    validateScript(args.script)
    inputs.javascriptFunction = args.script
    const match = args.script.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/)
    if (match?.[1]) inputs.functionName = match[1]
  }
  node.data.inputs = inputs
}

export function addNode(flow: FlowData, args: AddNodeArgs): ToolResult {
  getDefinition(args.nodeType)
  if (args.nodeType === 'startAgentflow' && flow.nodes.some((node) => node.data.name === 'startAgentflow')) {
    throw new Error('Start 노드는 하나만 둘 수 있습니다.')
  }
  const id = nextNodeId(flow, args.nodeType)
  const position = autoPosition(flow)
  const node = createNode(args.nodeType, id, args.label, args.x ?? position.x, args.y ?? position.y)
  applyNodeInputs(node, args)
  flow.nodes.push(node)
  return { ok: true, summary: `${args.label} 노드를 추가했습니다.`, data: { nodeId: id } }
}

export function updateNode(flow: FlowData, args: UpdateNodeArgs): ToolResult {
  const node = flow.nodes.find((candidate) => candidate.id === args.nodeId)
  if (!node) throw new Error(`노드를 찾을 수 없습니다: ${args.nodeId}`)
  if (args.label !== null) node.data.label = args.label
  applyNodeInputs(node, args)
  return { ok: true, summary: `${node.data.label} 노드를 수정했습니다.`, data: { nodeId: node.id } }
}

export function removeNode(flow: FlowData, nodeId: string): ToolResult {
  const node = flow.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) throw new Error(`노드를 찾을 수 없습니다: ${nodeId}`)
  flow.nodes = flow.nodes.filter((candidate) => candidate.id !== nodeId)
  flow.edges = flow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
  return { ok: true, summary: `${node.data.label} 노드와 연결을 제거했습니다.`, data: { nodeId } }
}

export function connectNodes(flow: FlowData, sourceNodeId: string, targetNodeId: string): ToolResult {
  const source = flow.nodes.find((node) => node.id === sourceNodeId)
  const target = flow.nodes.find((node) => node.id === targetNodeId)
  if (!source || !target) throw new Error('연결할 source 또는 target 노드가 없습니다.')
  if (sourceNodeId === targetNodeId) throw new Error('노드를 자기 자신에게 연결할 수 없습니다.')
  if (flow.edges.some((edge) => edge.source === sourceNodeId && edge.target === targetNodeId)) {
    return { ok: true, summary: '요청한 연결이 이미 존재합니다.' }
  }
  const sourceHandle = String(source.data.outputAnchors?.[0]?.id ?? `${sourceNodeId}-output-0`)
  const edge: FlowEdge = {
    id: `edge-${sourceNodeId}-${targetNodeId}`,
    source: sourceNodeId,
    target: targetNodeId,
    sourceHandle,
    targetHandle: targetNodeId,
    type: 'agentflowEdge',
    data: { sourceColor: source.data.color, targetColor: target.data.color }
  }
  flow.edges.push(edge)
  return { ok: true, summary: `${source.data.label}에서 ${target.data.label}로 연결했습니다.` }
}

export function disconnectNodes(flow: FlowData, sourceNodeId: string, targetNodeId: string): ToolResult {
  const before = flow.edges.length
  flow.edges = flow.edges.filter((edge) => !(edge.source === sourceNodeId && edge.target === targetNodeId))
  return {
    ok: before !== flow.edges.length,
    summary: before !== flow.edges.length ? '노드 연결을 제거했습니다.' : '해당 연결이 없습니다.'
  }
}

export function resetFlow(flow: FlowData): ToolResult {
  flow.nodes = []
  flow.edges = []
  flow.viewport = { x: 0, y: 0, zoom: 0.9 }
  return { ok: true, summary: '기존 그래프를 비우고 새 초안을 시작했습니다.' }
}

export function inspectFlow(flow: FlowData): ToolResult {
  return {
    ok: true,
    summary: `노드 ${flow.nodes.length}개와 연결 ${flow.edges.length}개를 확인했습니다.`,
    data: {
      nodes: flow.nodes.map((node) => ({ id: node.id, type: node.data.name, label: node.data.label, inputs: node.data.inputs })),
      edges: flow.edges.map((edge) => ({ source: edge.source, target: edge.target }))
    }
  }
}

export function validateFlowShape(flow: FlowData): string[] {
  const errors: string[] = []
  const nodeIds = new Set(flow.nodes.map((node) => node.id))
  if (!flow.nodes.some((node) => node.data.name === 'startAgentflow')) errors.push('Start 노드가 필요합니다.')
  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push(`깨진 연결이 있습니다: ${edge.id}`)
  }
  const scriptNodes = flow.nodes.filter((node) => node.data.name === 'customFunctionAgentflow')
  for (const node of scriptNodes) {
    try {
      parseSchema(String(node.data.inputs?.inputSchema ?? '{}'), `${node.data.label} 입력 스키마`)
      parseSchema(String(node.data.inputs?.outputSchema ?? '{}'), `${node.data.label} 출력 스키마`)
      validateScript(String(node.data.inputs?.javascriptFunction ?? ''))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  return errors
}
