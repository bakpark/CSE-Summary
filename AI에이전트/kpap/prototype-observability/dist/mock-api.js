/* Browser-local fixtures. No runtime, model, Judge or Langfuse request is made. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./trace-adapter.js') : root.TraceAdapter);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MockAPI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (TraceAdapter) {
  'use strict';
  let failNext = false, sequence = 0;
  const clone = v => JSON.parse(JSON.stringify(v));
  const fixture = { id: 'payment-024', version: 'fixture-v1', input: '이번 달 결제 금액을 알려줘. 취소된 결제는 제외해줘.', expected: 50000, payments: [{ id: 'p01', amount: 30000, status: '완료' }, { id: 'p02', amount: 20000, status: '완료' }, { id: 'p03', amount: 18000, status: '취소' }] };
  const baseline = { id: 'config-A-v12', label: 'A', version: 'v12', prompt: '사용자의 기간에 해당하는 결제 내역을 조회하고 합계를 안내합니다.', model: 'GPT-4.1 mini', tools: ['payments.search'], knowledge: '결제 조회 정책 v3' };
  const scenarios = { pass: '수정 성공', fail: '미개선', unjudgeable: '판정 불가', judge_error: 'Judge 오류', repeated: '도구 재시도', conversation: '대화 단위 근거', unmapped: '노드 미연결 근거' };
  const judges = [
    { id: 'payment-rubric', version: '1.2', name: '결제 정확성', model: 'GPT-4.1 mini', rubric: '요청한 월과 취소 제외 조건을 확인하고, 기대값 및 조회 결과와 응답을 비교합니다.' },
    { id: 'payment-review', version: '1.0', name: '결제 응답 검토', model: 'GPT-4.1', rubric: '기대값에 근거해 응답을 검토합니다. 근거가 부족하면 판정 불가로 반환합니다.' }
  ];
  const definitions = [{ id: 'definition-payment', revision: 1, name: '결제 응답 검증', criteria: ['amount', 'consistency', 'scope'], judge: judges[0] }];
  const datasets = [{ id: 'payment-regression', name: '결제 회귀 테스트', revision: 1, cases: [] }, { id: 'payment-samples', name: '결제 샘플', revision: 1, cases: [{ id: 'case-sample-024', datasetId: 'payment-samples', expected: fixture.expected, fixtureVersion: fixture.version, source: '고정 예시 · 기대값 확인됨' }] }];
  const traces = new Map(), runs = new Map(), traceModes = new Map();
  const sessions = [{ id: 'session-current', name: '현재 대화' }, { id: 'session-payments', name: '결제 상담 · 1024' }, { id: 'session-sdk', name: 'SDK 연결 점검' }, { id: 'session-empty', name: '새 세션 · 실행 없음' }];
  function request(value, { signal, delay = 600 } = {}) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('취소됨', 'AbortError'));
      const onAbort = () => { clearTimeout(timer); reject(new DOMException('취소됨', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); if (failNext) { failNext = false; reject(new Error('예시 요청을 완료하지 못했어요. 다시 시도해 주세요.')); } else resolve(clone(value)); }, delay);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
  function hexId(text, length) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return Array.from({ length: length / 8 }, (_, i) => ((h + Math.imul(i + 1, 2654435761)) >>> 0).toString(16).padStart(8, '0')).join(''); }
  function registerRun(trace, override = {}) {
    const run = { runId: trace.id, sessionId: trace.sessionId, agentId: 'agent-cs', traceId: trace.traceId, status: 'completed', remoteState: null, createdAt: '2026-10-24T06:20:00Z', startedAt: '2026-10-24T06:20:00Z', endedAt: '2026-10-24T06:20:03Z', taskId: `task-${trace.id}`, contextId: `context-${trace.sessionId}`, snapshotId: trace.snapshot?.id || null, ...override };
    runs.set(run.runId, clone(run)); return run;
  }
  function makeTrace(key, candidate, exclude, repeated = false) {
    const traceId = hexId(key, 32), amount = exclude ? 50000 : 68000;
    const text = exclude ? '취소된 결제 18,000원을 제외한 이번 달 결제 금액은 총 50,000원입니다.' : '이번 달 결제 금액은 총 68,000원입니다.';
    const tool = (attempt, omitted) => ({ id: hexId(`${key}-tool-${attempt}`, 16), nodeId: 'node_payment_query', nodeExecutionId: `node-run-${key}-query`, ownerNodeId: 'node_payment_query', kind: 'tool', name: '결제 내역 조회', operation: 'payments.search', attempt, duration: '1.20초', input: { month: '2026-10', exclude_cancelled: omitted }, output: { payments: fixture.payments.filter(p => !omitted || p.status === '완료'), total: omitted ? 50000 : 68000 }, status: 'completed' });
    const observations = repeated ? [tool(1, false), tool(2, exclude)] : [tool(1, exclude)];
    observations.push({ id: hexId(`${key}-answer-1`, 16), nodeId: 'node_answer', nodeExecutionId: `node-run-${key}-answer`, ownerNodeId: 'node_answer', kind: 'generation', name: '답변 생성', operation: candidate.model, attempt: 1, duration: '1.42초', input: { total: amount }, output: { text }, status: 'completed' });
    observations.forEach(observation => { observation.turnId = `turn-${key}-1`; });
    const trace = { id: `run-${key}`, traceId, snapshot: clone(candidate), graphVersion: 'flow-v7', fixtureVersion: fixture.version, input: fixture.input, text, amount, duration: repeated ? '3.82초' : '2.62초', observations, sessionId: 'session-current', turns: [{ id: `turn-${key}-1`, input: fixture.input, output: text }], design: { id: 'flow-v7', nodes: [{ id: 'node_start', name: '시작', kind: 'input' }, { id: 'node_payment_query', name: '결제 조회 에이전트', kind: 'agent' }, { id: 'node_answer', name: '답변 생성', kind: 'generation' }], edges: [{ from: 'node_start', to: 'node_payment_query' }, { from: 'node_payment_query', to: 'node_answer' }] }, source: 'mock-record' };
    traces.set(traceId, clone(trace)); registerRun(trace); return trace;
  }
  const original = makeTrace('A024', baseline, false);
  function evidence(trace, kind, last = false) {
    const rows = trace.observations.filter(o => o.kind === kind), row = last ? rows.at(-1) : rows[0];
    return { runId: trace.id, traceId: trace.traceId, observationId: row.id };
  }
  async function compare({ candidate, caseId, scenario = 'pass', definition = null, dataset = null }, options) {
    if (!scenarios[scenario]) throw new Error('알 수 없는 예시입니다.');
    if (definition && (!definition.criteria?.length || definition.criteria.some(id => !['amount', 'consistency', 'scope'].includes(id)))) throw new Error('지원하지 않는 평가 기준입니다.');
    if (dataset && (dataset.caseCount !== 1 || !dataset.caseIds.includes(caseId))) throw new Error('이 Mock은 선택한 고정 사례 1개만 실행합니다.');
    const key = `${candidate.label}-${++sequence}`, corrected = scenario !== 'fail';
    const bTrace = makeTrace(key, candidate, corrected, scenario === 'repeated');
    const side = (status, reason, reference) => ({ status, reason, evidence: reference });
    const rows = [
      { id: 'amount', name: '취소 제외 · 금액 정확성', scope: '실행 결과', a: side('FAIL', '취소된 결제 18,000원이 포함됐습니다.', evidence(original, 'tool')), b: side(corrected ? 'PASS' : 'FAIL', corrected ? '취소 제외 인자와 50,000원 합계를 확인했습니다.' : '취소된 결제가 여전히 포함됐습니다.', evidence(bTrace, 'tool', true)) },
      { id: 'consistency', name: '조회 결과와 응답 일치', scope: '응답', a: side('PASS', '응답의 금액은 조회 합계와 일치합니다.', evidence(original, 'generation')), b: side('PASS', '응답의 금액은 조회 합계와 일치합니다.', evidence(bTrace, 'generation')) },
      { id: 'scope', name: '요청한 월의 내역 조회', scope: '도구 입력', a: side('PASS', '2026-10 조회 인자를 확인했습니다.', evidence(original, 'tool')), b: side('PASS', '2026-10 조회 인자를 확인했습니다.', evidence(bTrace, 'tool', true)) }
    ];
    if (scenario === 'unjudgeable') rows[0].b = side('UNJUDGEABLE', '예시 Judge에 기대값 근거가 전달되지 않아 판정을 보류했습니다.', evidence(bTrace, 'tool', true));
    if (scenario === 'judge_error') rows[0].b = side('JUDGE_ERROR', '예시 Judge가 시간 내 응답하지 않았습니다. 실행 실패와는 별개입니다.', evidence(bTrace, 'tool', true));
    if (scenario === 'conversation') { rows[0].scope = '대화'; rows[0].b.evidence = { runId: bTrace.id, traceId: bTrace.traceId, scope: 'turn', turnId: bTrace.turns[0].id }; rows[0].b.reason = '이 턴의 요청과 응답을 비교한 판정입니다. 원인 노드를 특정하지 않습니다.'; }
    if (scenario === 'unmapped') { bTrace.observations[0].ownerNodeId = null; bTrace.observations[0].nodeId = null; traces.set(bTrace.traceId, clone(bTrace)); }
    return request({ id: `eval-${key}`, candidate: clone(candidate), baseline: clone(baseline), caseId, fixtureVersion: fixture.version, judge: definition ? clone(definition.judge) : { id: 'payment-rubric', version: '1.2' }, ...(definition ? { definition: clone(definition), dataset: clone(dataset) } : {}), scenario, conditions: { mode: 'mock', configApplied: null, isolatedState: null, fixedTools: true }, criteria: definition ? rows.filter(row => definition.criteria.includes(row.id)) : rows, runs: { a: { traceId: original.traceId, text: original.text }, b: { traceId: bTrace.traceId, text: bTrace.text } } }, { delay: 1100, ...options });
  }
  // The maps below represent distinct mocked services: runs = minimal KPAP DB;
  // traces = Langfuse detail. traceModes is test transport behavior, never part of a run record.
  const adapterStats = { langfuseRequests: 0 };
  function seedRun(key, sessionId, status, minute, mode = 'available', repeated = false) {
    const trace = makeTrace(key, baseline, true, repeated); trace.sessionId = sessionId;
    if (mode === 'legacy') { trace.design = null; trace.observations.forEach(o => { o.ownerNodeId = null; o.nodeId = null; o.nodeExecutionId = null; }); }
    if (mode === 'untimed') { trace.observations.forEach(o => { o.missingTime = true; }); }
    if (mode === 'replay') { trace.observations.forEach((o, i) => { o.nodeExecutionId = `invocation-${key}-${i + 1}`; o.startOffset = [0, 1000, 4500][i]; o.endOffset = [3000, 4000, 6500][i]; }); trace.observations[2].predecessorInvocationIds = trace.observations.slice(0, 2).map(o => o.nodeExecutionId); }
    if (mode === 'empty') { trace.observations = []; trace.turns = []; trace.input = null; trace.text = null; }
    if (mode === 'partial') { trace.observations = trace.observations.slice(0, 1); trace.observations[0].status = 'running'; trace.observations[0].output = null; trace.text = null; trace.turns[0].output = null; }
    if (status === 'failed') { trace.observations[0].status = 'error'; trace.observations[0].statusMessage = '결제 서비스 응답 시간 초과'; trace.observations[0].output = null; }
    traces.set(trace.traceId, clone(trace));
    registerRun(trace, { sessionId, status, createdAt: `2026-10-24T07:${minute}:00Z`, startedAt: `2026-10-24T07:${minute}:00Z`, endedAt: ['running', 'unknown'].includes(status) ? null : `2026-10-24T07:${minute}:03Z`, remoteState: key === 'sample-unknown' ? 'unknown' : null, snapshotId: mode === 'legacy' ? null : baseline.id });
    traceModes.set(trace.id, mode);
  }
  seedRun('sample-replay', 'session-payments', 'completed', '09', 'replay', true);
  seedRun('sample-untimed', 'session-sdk', 'completed', '00', 'untimed');
  seedRun('sample-retry', 'session-payments', 'completed', '08', 'available', true);
  seedRun('sample-not-found', 'session-payments', 'completed', '07', 'not_found');
  seedRun('sample-partial', 'session-payments', 'running', '06', 'partial');
  seedRun('sample-legacy', 'session-sdk', 'completed', '05', 'legacy');
  seedRun('sample-outage', 'session-sdk', 'completed', '04', 'outage');
  seedRun('sample-forbidden', 'session-sdk', 'completed', '03', 'forbidden');
  seedRun('sample-failed', 'session-payments', 'failed', '02');
  seedRun('sample-empty', 'session-sdk', 'completed', '00', 'empty');
  seedRun('sample-unknown', 'session-sdk', 'unknown', '01', 'not_found');
  function runForTrace(traceId) { return clone([...runs.values()].find(run => run.traceId === traceId) || null); }
  async function listRuns({ agentId = 'agent-cs', sessionId = '', cursor = null, limit = 5 } = {}, options) {
    const offset = cursor ? Number(String(cursor).replace('run:', '')) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw TraceAdapter.error('INVALID_CURSOR', 400, '목록 커서가 올바르지 않습니다.');
    const filtered = [...runs.values()].filter(run => run.agentId === agentId && (!sessionId || run.sessionId === sessionId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.runId.localeCompare(a.runId));
    return request({ items: filtered.slice(offset, offset + limit), nextCursor: offset + limit < filtered.length ? `run:${offset + limit}` : null }, options);
  }
  async function getRun({ agentId = 'agent-cs', runId }, options) {
    const run = runs.get(runId); if (!run || run.agentId !== agentId) throw TraceAdapter.error('RUN_NOT_FOUND', 404, '플랫폼 실행 기록을 찾을 수 없습니다.');
    return request(run, options);
  }
  function publicTrace(trace, run) {
    const common = { runId: run.runId, snapshotId: run.snapshotId, graphVersion: trace.design?.id || null, codeVersion: 'sdk-mock-1', fixtureVersion: trace.fixtureVersion, turns: trace.turns };
    const start = Date.parse(run.startedAt || run.createdAt);
    return { id: run.traceId, sessionId: run.sessionId, timestamp: run.createdAt, name: 'CS 에이전트', input: trace.input, output: trace.text, metadata: { kpap: common }, observations: trace.observations.map((o, index) => {
      const time = o.missingTime ? null : new Date(start + (o.startOffset ?? index * 1200)).toISOString();
      return { id: o.id, traceId: run.traceId, parentObservationId: index ? trace.observations[0].id : null, type: o.kind === 'generation' ? 'GENERATION' : 'SPAN', name: o.name, startTime: time, endTime: o.status === 'running' || o.missingTime ? null : new Date(start + (o.endOffset ?? index * 1200 + 1200)).toISOString(), level: o.status === 'error' ? 'ERROR' : 'DEFAULT', statusMessage: o.statusMessage || null, model: o.kind === 'generation' ? trace.snapshot.model : null, input: clone(o.input), output: clone(o.output), usage: o.kind === 'generation' ? { input: 124, output: 42, total: 166, unit: 'TOKENS' } : null, calculatedTotalCost: o.kind === 'generation' ? 0.000116 : null, metadata: { kpap: { ...common, nodeId: o.ownerNodeId, invocationId: o.nodeExecutionId, logicalCallId: o.kind === 'tool' ? `${run.runId}-payments` : null, attemptId: o.kind === 'tool' ? `attempt-${o.attempt}` : null, predecessorInvocationIds: o.predecessorInvocationIds || [], attempt: o.attempt, turnId: o.turnId, kind: o.kind, resourceId: o.operation } } };
    }), scores: [] };
  }
  async function getRunTrace({ agentId = 'agent-cs', runId, cursor = null, all = false, observationId = null }, options = {}) {
    const run = runs.get(runId); if (!run || run.agentId !== agentId) throw TraceAdapter.error('RUN_NOT_FOUND', 404, '플랫폼 실행 기록을 찾을 수 없습니다.');
    const mode = traceModes.get(runId);
    // Authorization precedes any Langfuse lookup. No browser-supplied trace ID is trusted.
    if (mode === 'forbidden') throw TraceAdapter.error('FORBIDDEN', 403, '이 실행의 관측 상세를 볼 권한이 없습니다.');
    adapterStats.langfuseRequests++;
    if (mode === 'outage') { await request(null, options); throw TraceAdapter.error('LANGFUSE_UNAVAILABLE', 503, 'Langfuse에 연결할 수 없습니다. 업무 실행 상태는 유지됩니다.'); }
    if (mode === 'not_found' || !traces.has(run.traceId)) return request({ availability: 'not_found', observations: [], nextCursor: null, trace: null }, options);
    const trace = traces.get(run.traceId), raw = publicTrace(trace, run);
    const page = cursor ? Number(String(cursor).replace('v3-page:', '')) : 1, limit = 2;
    if (!Number.isInteger(page) || page < 1) throw TraceAdapter.error('INVALID_CURSOR', 400, '관측 페이지 커서가 올바르지 않습니다.');
    // Model the v3 observations page/limit response, then normalize to a KPAP cursor.
    // Native GET /traces/{id} itself has no nextCursor contract.
    const pageResponse = { data: all ? raw.observations : raw.observations.slice((page - 1) * limit, page * limit), meta: { page, limit, totalItems: raw.observations.length, totalPages: Math.ceil(raw.observations.length / limit) } };
    let rows = pageResponse.data;
    if (observationId && !rows.some(o => o.id === observationId)) { const exact = raw.observations.find(o => o.id === observationId); if (exact) rows = [...rows, exact]; }
    const response = TraceAdapter.normalize(raw, { run, snapshot: run.snapshotId ? trace.snapshot : null, design: trace.design, observations: rows, nextCursor: !all && page < pageResponse.meta.totalPages ? `v3-page:${page + 1}` : null });
    return request(response, options);
  }

  return { fixture, baseline, scenarios, judges, definitions, datasets, sessions, original, compare, listRuns, getRun, getRunTrace, runForTrace, adapterStats, simulateError: () => { failNext = true; }, trace: async (traceId, options) => { const run = runForTrace(traceId); if (!run) throw new Error('이 실행 기록을 찾을 수 없습니다.'); const value = await getRunTrace({ runId: run.runId, all: true }, options); if (value.availability !== 'available') throw new Error('관측 기록을 찾을 수 없습니다.'); return value.trace; }, saveCase: (payload, options) => payload.expectedConfirmed ? request({ id: payload.datasetId === 'payment-regression' ? 'case-024' : `case-${payload.datasetId}-024`, datasetId: payload.datasetId, expected: fixture.expected, fixtureVersion: fixture.version }, options) : Promise.reject(new Error('기대값을 먼저 확인해 주세요.')) };
});
