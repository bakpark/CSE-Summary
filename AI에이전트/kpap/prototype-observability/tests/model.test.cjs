'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/pilot-model.js');
const api = require('../dist/mock-api.js');
const create = () => M.createState(api.baseline.prompt);
async function evaluate(state, scenario = 'pass') {
  const candidate = M.comparisonCandidate(state);
  const response = await api.compare({ candidate, caseId: 'case-024', scenario }, { delay: 0 });
  return M.acceptEvaluation(state, response, candidate);
}
test('all four statuses come from response and counts are exact', async () => {
  for (const [scenario, expected] of Object.entries({ pass: 'PASS', fail: 'FAIL', unjudgeable: 'UNJUDGEABLE', judge_error: 'JUDGE_ERROR' })) {
    const state = create(); M.saveDraft(state); const result = await evaluate(state, scenario);
    assert.equal(result.criteria[0].b.status, expected);
    const counts = M.countStatuses(result, 'b');
    assert.equal(counts[expected], expected === 'PASS' ? 3 : 1);
    assert.equal(counts.PASS, expected === 'PASS' ? 3 : 2);
    assert.equal(M.resultSummary(result).tone, { PASS: 'success', FAIL: 'warning', UNJUDGEABLE: 'neutral', JUDGE_ERROR: 'error' }[expected]);
  }
});
test('unknown/missing status is never treated as PASS', () => {
  const state = create(), candidate = M.saveDraft(state);
  const result = M.acceptEvaluation(state, { id: 'invalid-status', candidate, criteria: [{ id: 'x', a: { status: 'PASS' }, b: { status: 'unexpected' } }] }, candidate);
  assert.equal(result.criteria[0].b.status, 'UNJUDGEABLE');
});
test('B1 remains immutable while B2 can be saved and evaluated', async () => {
  const state = create(); M.editDraft(state, 'B1 prompt'); M.saveDraft(state);
  const first = await evaluate(state), frozen = JSON.stringify(first);
  assert.throws(() => M.editDraft(state, 'overwrite'), /읽기 전용/);
  M.createNextDraft(state, first.id); assert.equal(state.draft.label, 'B2');
  M.editDraft(state, 'B2 prompt'); M.saveDraft(state); await evaluate(state, 'fail');
  assert.equal(state.evaluations.length, 2); assert.equal(JSON.stringify(first), frozen);
  assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first.candidate)); assert.ok(Object.isFrozen(first.criteria[0].b));
});
test('an existing unsaved B2 cannot be overwritten by creating another draft', async () => {
  const state = create(); M.saveDraft(state); const first = await evaluate(state);
  M.createNextDraft(state, first.id); M.editDraft(state, 'valuable unsaved B2');
  assert.throws(() => M.createNextDraft(state, first.id)); assert.equal(state.draft.prompt, 'valuable unsaved B2');
});
test('unsaved edits cannot silently evaluate the previous snapshot', () => {
  const state = create(); assert.throws(() => M.comparisonCandidate(state), /미저장/);
  const saved = M.saveDraft(state); M.editDraft(state, 'new draft');
  assert.throws(() => M.comparisonCandidate(state), /미저장/); assert.equal(saved.prompt, api.baseline.prompt);
  M.saveDraft(state); assert.equal(M.comparisonCandidate(state).prompt, 'new draft');
});
test('empty candidates, empty results and mismatched snapshots are rejected', () => {
  const state = create(); M.editDraft(state, ' '); assert.throws(() => M.saveDraft(state));
  M.editDraft(state, 'candidate'); const saved = M.saveDraft(state);
  assert.throws(() => M.acceptEvaluation(state, { candidate: saved, criteria: [] }, saved));
  assert.throws(() => M.acceptEvaluation(state, { candidate: { ...saved, prompt: 'wrong' }, criteria: [{}] }, saved), /설정/);
});
test('repeated tool evidence opens exact second occurrence with different arguments', async () => {
  const state = create(); M.saveDraft(state); const result = await evaluate(state, 'repeated');
  const ref = result.criteria[0].b.evidence; const trace = await api.trace(ref.traceId, { delay: 0 });
  const tools = trace.observations.filter(o => o.kind === 'tool'); assert.equal(tools.length, 2);
  assert.notEqual(tools[0].id, tools[1].id); assert.equal(tools[0].input.exclude_cancelled, false);
  assert.equal(tools[1].input.exclude_cancelled, true); assert.equal(ref.observationId, tools[1].id);
  assert.equal(tools[1].ownerNodeId, 'node_payment_query'); assert.equal(tools[1].output.total, 50000);
});
test('returned trace mutations cannot change recorded source', async () => {
  const trace = await api.trace(api.original.traceId, { delay: 0 }); trace.observations[0].input.exclude_cancelled = true;
  const again = await api.trace(api.original.traceId, { delay: 0 }); assert.equal(again.observations[0].input.exclude_cancelled, false);
});
test('mock cannot claim verified controlled comparison', () => {
  assert.equal(M.conditionLabel({ mode: 'mock', configApplied: true, isolatedState: true, fixedTools: true }), 'Mock · 실행 조건 미검증');
  assert.equal(M.conditionLabel({ mode: 'runtime', configApplied: true, isolatedState: null, fixedTools: true }), '조건 일치 미확인');
});
test('expected value requires confirmation and cancellation rejects without a result', async () => {
  await assert.rejects(api.saveCase({ datasetId: 'x', expectedConfirmed: false }, { delay: 0 }), /기대값/);
  const state = create(); const candidate = M.saveDraft(state); const controller = new AbortController();
  const pending = api.compare({ candidate, caseId: 'x', scenario: 'pass' }, { signal: controller.signal, delay: 100 }); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(state.evaluations.length, 0); assert.equal(state.saved.id, candidate.id);
});

test('definition revisions and selected dataset are frozen into the run; selected criteria drive rows', async () => {
  const state = { ...create(), definitions: api.definitions.map(M.immutable), definitionSequence: 0, selectedDefinitionId: api.definitions[0].id, datasets: JSON.parse(JSON.stringify(api.datasets)), selectedDatasetId: 'payment-samples', case: api.datasets[1].cases[0] };
  const definition = M.saveDefinition(state, { ...api.definitions[0], name: '금액만 검증', criteria: ['amount'] });
  assert.equal(definition.revision, 2); const config = M.runConfiguration(state), candidate = M.saveDraft(state);
  const response = await api.compare({ candidate, caseId: state.case.id, scenario: 'fail', ...config }, { delay: 0 });
  const result = M.acceptEvaluation(state, response, candidate, config); assert.equal(result.criteria.length, 1); assert.equal(result.criteria[0].b.status, 'FAIL');
  M.saveDefinition(state, { ...definition, name: '다음 리비전', criteria: ['consistency'] }); state.datasets[1].name = 'changed';
  assert.equal(result.definition.name, '금액만 검증'); assert.equal(result.definition.revision, 2); assert.equal(result.dataset.name, '결제 샘플');
  assert.ok(Object.isFrozen(result.definition.judge));
  assert.throws(() => M.acceptEvaluation(state, { ...response, definition: state.definitions[0] }, candidate, config), /스냅샷/);
});
test('invalid definition and missing or mismatched dataset case block execution', () => {
  const state = { definitions: [], definitionSequence: 0, datasets: api.datasets, selectedDatasetId: 'payment-regression', case: null };
  assert.throws(() => M.saveDefinition(state, { name: '', criteria: ['amount'], judge: api.judges[0] }), /이름/);
  assert.throws(() => M.saveDefinition(state, { name: 'x', criteria: [], judge: api.judges[0] }), /기준/);
  assert.throws(() => M.runConfiguration(state), /정의/);
  M.saveDefinition(state, { name: 'x', criteria: ['amount'], judge: api.judges[0] });
  assert.throws(() => M.runConfiguration(state), /케이스/); state.case = api.datasets[1].cases[0];
  assert.throws(() => M.runConfiguration(state), /케이스/);
});
