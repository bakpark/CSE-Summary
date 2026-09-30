export interface Point {
  x: number
  y: number
}

export interface FlowNodeData {
  id: string
  name: string
  label: string
  type?: string
  category?: string
  description?: string
  version?: number
  color?: string
  hideInput?: boolean
  inputParams?: Array<Record<string, unknown>>
  inputs?: Record<string, unknown>
  inputAnchors?: Array<Record<string, unknown>>
  outputAnchors?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface FlowNode {
  id: string
  type: string
  position: Point
  data: FlowNodeData
  selected?: boolean
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type: string
  data?: Record<string, unknown>
}

export interface FlowData {
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export interface ReActStep {
  index: number
  kind: 'observe' | 'act' | 'result'
  tool?: string
  summary: string
  ok?: boolean
}
