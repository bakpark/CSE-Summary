export const graphToolDefinitions = [
  {
    type: 'function',
    name: 'inspect_flow',
    description: '현재 그래프의 노드, 연결, 주요 설정을 관찰합니다. 수정 전에 먼저 호출합니다.',
    strict: true,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
  },
  {
    type: 'function',
    name: 'reset_flow',
    description: '새 초안을 만들기 위해 기존 노드와 연결을 모두 제거합니다. draft 모드에서만 사용합니다.',
    strict: true,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
  },
  {
    type: 'function',
    name: 'add_node',
    description: '지원되는 Flowise 노드를 그래프에 추가합니다.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        nodeType: { type: 'string', enum: ['startAgentflow', 'agentAgentflow', 'llmAgentflow', 'customFunctionAgentflow', 'conditionAgentflow', 'directReplyAgentflow'] },
        label: { type: 'string' },
        instruction: { type: ['string', 'null'], description: 'Agent/LLM 지침, 조건식 또는 Reply 메시지' },
        model: { type: ['string', 'null'], description: 'Agent 또는 LLM 노드가 사용할 모델 ID' },
        script: { type: ['string', 'null'], description: 'Function 노드의 JavaScript 함수' },
        inputSchema: { type: ['string', 'null'], description: 'Function 또는 Start 입력 JSON Schema 문자열' },
        outputSchema: { type: ['string', 'null'], description: 'Function 또는 LLM 출력 JSON Schema 문자열' },
        x: { type: ['number', 'null'] },
        y: { type: ['number', 'null'] }
      },
      required: ['nodeType', 'label', 'instruction', 'model', 'script', 'inputSchema', 'outputSchema', 'x', 'y'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'update_node',
    description: '기존 노드의 표시 이름, 지침, 모델, 스크립트, 입출력 스키마를 수정합니다.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        label: { type: ['string', 'null'] },
        instruction: { type: ['string', 'null'] },
        model: { type: ['string', 'null'] },
        script: { type: ['string', 'null'] },
        inputSchema: { type: ['string', 'null'] },
        outputSchema: { type: ['string', 'null'] }
      },
      required: ['nodeId', 'label', 'instruction', 'model', 'script', 'inputSchema', 'outputSchema'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'remove_node',
    description: '노드와 해당 노드에 연결된 edge를 제거합니다.',
    strict: true,
    parameters: {
      type: 'object',
      properties: { nodeId: { type: 'string' } },
      required: ['nodeId'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'connect_nodes',
    description: 'source 노드의 기본 출력에서 target 노드로 연결합니다.',
    strict: true,
    parameters: {
      type: 'object',
      properties: { sourceNodeId: { type: 'string' }, targetNodeId: { type: 'string' } },
      required: ['sourceNodeId', 'targetNodeId'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'disconnect_nodes',
    description: '두 노드 사이의 연결을 제거합니다.',
    strict: true,
    parameters: {
      type: 'object',
      properties: { sourceNodeId: { type: 'string' }, targetNodeId: { type: 'string' } },
      required: ['sourceNodeId', 'targetNodeId'],
      additionalProperties: false
    }
  }
] as const
