'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const adapter = require('../dist/trace-adapter.js'), api = require('../dist/mock-api.js');
test('KPAP run list stores minimal summaries; session cursor never pretends to be Langfuse list', async () => {
  const first = await api.listRuns({ limit: 3 }, { delay: 0 }); assert.equal(first.items.length, 3); assert.equal(first.nextCursor, 'run:3');
  assert.ok(first.items.every(run => /^[0-9a-f]{32}$/.test(run.traceId))); assert.ok(first.items.every(run => !('observations' in run) && !('input' in run) && !('availability' in run)));
  const next = await api.listRuns({ cursor: first.nextCursor, limit: 3 }, { delay: 0 }); assert.ok(next.items.every(run => !first.items.some(previous => previous.runId === run.runId)));
  const session = await api.listRuns({ sessionId: 'session-payments' }, { delay: 0 }); assert.ok(session.items.every(run => run.sessionId === 'session-payments'));
  assert.equal((await api.listRuns({ sessionId: 'session-empty' }, { delay: 0 })).items.length, 0);
});
test('not_found and upstream 503 never overwrite completed A2A status; forbidden performs no LF lookup', async () => {
  const missing = await api.getRunTrace({ runId: 'run-sample-not-found' }, { delay: 0 }); assert.equal(missing.availability, 'not_found');
  assert.equal((await api.getRun({ runId: 'run-sample-not-found' }, { delay: 0 })).status, 'completed');
  await assert.rejects(api.getRunTrace({ runId: 'run-sample-outage' }, { delay: 0 }), error => error.status === 503);
  assert.equal((await api.getRun({ runId: 'run-sample-outage' }, { delay: 0 })).status, 'completed');
  const before = api.adapterStats.langfuseRequests; await assert.rejects(api.getRunTrace({ runId: 'run-sample-forbidden' }, { delay: 0 }), error => error.status === 403); assert.equal(api.adapterStats.langfuseRequests, before);
});
test('observation page/limit normalizes to cursor; exact occurrence beyond first page merges without duplicate', async () => {
  const first = await api.getRunTrace({ runId: 'run-sample-retry' }, { delay: 0 }); assert.equal(first.observations.length, 2); assert.equal(first.nextCursor, 'v3-page:2');
  assert.equal(first.observations[0].input.exclude_cancelled, false); assert.equal(first.observations[1].input.exclude_cancelled, true); assert.notEqual(first.observations[0].attemptId, first.observations[1].attemptId);
  const next = await api.getRunTrace({ runId: 'run-sample-retry', cursor: first.nextCursor }, { delay: 0 }); assert.equal(next.nextCursor, null);
  const exact = await api.getRunTrace({ runId: 'run-sample-retry', observationId: next.observations[0].id }, { delay: 0 }); assert.ok(exact.observations.some(o => o.id === next.observations[0].id)); assert.equal(adapter.merge(exact.observations, next.observations).length, 3);
});
test('absent stable metadata yields no graph mapping; open observation is not business running state', async () => {
  const legacy = await api.getRunTrace({ runId: 'run-sample-legacy' }, { delay: 0 }); assert.equal(legacy.trace.design, null); assert.ok(legacy.observations.every(o => o.ownerNodeId === null && o.invocationId === null));
  const partial = await api.getRunTrace({ runId: 'run-sample-partial' }, { delay: 0 }); assert.equal(partial.availability, 'available'); assert.equal(partial.observations[0].status, 'open'); assert.equal(partial.observations[0].output, null); assert.equal(partial.observations[0].cost, null);
  const empty = await api.getRunTrace({ runId: 'run-sample-empty' }, { delay: 0 }); assert.equal(empty.availability, 'available'); assert.deepEqual(empty.observations, []);
});
test('raw identity mismatch rejects; parent span never becomes a design edge; no metric imputation', () => {
  const run = { runId: 'r', traceId: 't', snapshotId: 's', sessionId: 'session' };
  const raw = { id: 't', metadata: { kpap: { runId: 'r', snapshotId: 's', graphVersion: 'g' } }, observations: [{ id: 'o', traceId: 't', parentObservationId: 'parent', type: 'SPAN', metadata: { kpap: { nodeId: 'node', invocationId: 'invocation' } } }] };
  const design = { id: 'g', nodes: [{ id: 'node' }], edges: [] };
  const result = adapter.normalize(raw, { run, design }); assert.equal(result.observations[0].ownerNodeId, 'node'); assert.deepEqual(result.trace.design.edges, []); assert.equal(result.observations[0].cost, null); assert.equal(result.observations[0].usage, null);
  assert.throws(() => adapter.normalize({ ...raw, id: 'wrong' }, { run, design }), /traceId/);
  assert.throws(() => adapter.normalize({ ...raw, metadata: { kpap: { runId: 'other' } } }, { run, design }), /runId/);
  assert.equal(adapter.normalize(raw, { run: { ...run, snapshotId: null }, design }).trace.design, null);
});
