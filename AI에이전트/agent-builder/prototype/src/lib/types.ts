import type { FlowData } from '@flowiseai/agentflow'

export type BuilderMode = 'draft' | 'edit' | 'script'

export interface ReActStep {
  index: number
  kind: 'observe' | 'act' | 'result'
  tool?: string
  summary: string
  ok?: boolean
}

export interface TransformRequest {
  mode: BuilderMode
  instruction: string
  model: string
  flow: FlowData
  targetNodeId?: string
}

export interface TransformResponse {
  flow: FlowData
  message: string
  steps: ReActStep[]
  changedNodeIds: string[]
}

export interface AppConfig {
  models: string[]
  defaultModel: string
  apiConfigured: boolean
  agentflowVersion: string
}
