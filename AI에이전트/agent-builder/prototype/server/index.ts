import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'

import { ALLOWED_NODE_TYPES, NODE_CATALOG } from './catalog.js'
import { runReActTransform } from './reactEngine.js'

const app = express()
const port = Number(process.env.PORT || 8787)
const models = (process.env.OPENAI_MODELS || 'gpt-6.1-sol,gpt-6-astra,gpt-6-luna')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean)

app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/api/config', (_request, response) => {
  response.json({
    models,
    defaultModel: models[0],
    apiConfigured: Boolean(process.env.OPENAI_API_KEY),
    agentflowVersion: '0.0.0-dev.14'
  })
})

app.post('/api/flow/transform', async (request, response) => {
  try {
    const result = await runReActTransform(request.body)
    response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    response.status(400).json({ message })
  }
})

app.get('/flowise/api/v1/nodes', (_request, response) => {
  response.json(NODE_CATALOG)
})

app.get('/flowise/api/v1/nodes/:name', (request, response) => {
  const node = NODE_CATALOG.find((candidate) => candidate.name === request.params.name)
  if (!node) return response.status(404).json({ message: 'Node not found' })
  response.json(node)
})

app.post('/flowise/api/v1/node-load-method/:name', (request, response) => {
  const loadMethod = String(request.body?.loadMethod || '')
  if (loadMethod === 'listModels') {
    return response.json(models.map((name) => ({ label: name, name })))
  }
  if (loadMethod === 'listTools' || loadMethod === 'listToolInputArgs') return response.json([])
  response.json([])
})

app.post('/flowise/api/v1/node-config', (_request, response) => response.json([]))
app.get('/flowise/api/v1/credentials', (_request, response) => response.json([]))
app.get('/flowise/api/v1/components-credentials/:name', (_request, response) => response.json({ inputs: [] }))
app.get('/flowise/api/v1/node-icon/:name', (_request, response) => response.status(404).end())

app.get('/flowise/api/v1/capabilities', (_request, response) => {
  response.json({ nodes: ALLOWED_NODE_TYPES })
})

if (process.env.NODE_ENV === 'production') {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const distDir = path.resolve(currentDir, '../dist')
  app.use(express.static(distDir))
  app.use((_request, response) => response.sendFile(path.join(distDir, 'index.html')))
}

app.listen(port, '127.0.0.1', () => {
  console.log(`Agent Workshop API listening on http://127.0.0.1:${port}`)
})
