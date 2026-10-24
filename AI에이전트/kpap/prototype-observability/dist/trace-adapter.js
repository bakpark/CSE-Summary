/* Proposed KPAP adapter over self-hosted Langfuse v3 public REST.
 * metadata.kpap is this pilot's explicit mapping proposal, NOT a native Langfuse contract.
 * No credentials, HTTP calls, persisted observations or inferred causal edges here. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TraceAdapter = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
  function error(code, status, message) { return Object.assign(new Error(message), { code, status }); }
  function duration(start, end) { const ms = Date.parse(end) - Date.parse(start); return Number.isFinite(ms) && ms >= 0 ? `${(ms / 1000).toFixed(2)}초` : '시간 미제공'; }
  function observation(raw, { run, metadata = {}, design }) {
    if (raw.traceId && raw.traceId !== run.traceId) throw error('TRACE_IDENTITY_MISMATCH', 502, '다른 실행의 관측이 반환되었습니다.');
    const kp = raw.metadata?.kpap || {}, common = metadata.kpap || {};
    if ((kp.runId || common.runId) && (kp.runId || common.runId) !== run.runId) throw error('RUN_IDENTITY_MISMATCH', 502, '관측의 실행 ID가 일치하지 않습니다.');
    const graphVersion = kp.graphVersion || common.graphVersion || null, snapshotId = kp.snapshotId || common.snapshotId || null;
    const mappingValid = !!kp.nodeId && !!kp.invocationId && graphVersion === design?.id && snapshotId === run.snapshotId && !!design?.nodes.some(n => n.id === kp.nodeId);
    return { id: raw.id, parentId: raw.parentObservationId ?? null, nodeId: kp.nodeId ?? null, ownerNodeId: mappingValid ? kp.nodeId : null, invocationId: kp.invocationId ?? null, nodeExecutionId: kp.invocationId ?? null, logicalCallId: kp.logicalCallId ?? null, attemptId: kp.attemptId ?? null, predecessorInvocationIds: mappingValid && Array.isArray(kp.predecessorInvocationIds) ? kp.predecessorInvocationIds.filter(id => typeof id === 'string') : [], attempt: kp.attempt ?? null, turnId: kp.turnId ?? null, type: raw.type ?? null, kind: kp.kind || (raw.type === 'GENERATION' ? 'generation' : 'span'), name: raw.name || '이름 없는 관측', operation: kp.resourceId || raw.model || raw.name || '관측', startTime: raw.startTime ?? null, endTime: raw.endTime ?? null, duration: duration(raw.startTime, raw.endTime), status: raw.level === 'ERROR' ? 'error' : raw.endTime ? 'completed' : 'open', statusMessage: raw.statusMessage ?? null, input: clone(raw.input), output: clone(raw.output), usage: clone(raw.usage), cost: raw.calculatedTotalCost ?? raw.totalCost ?? null, mappingReason: mappingValid ? null : '노드·수행 ID 또는 동일 스냅샷 연결을 확인할 수 없습니다.' };
  }
  function normalize(raw, { run, snapshot = null, design = null, observations = raw?.observations || [], nextCursor = null }) {
    if (!raw || raw.id !== run.traceId) throw error('TRACE_IDENTITY_MISMATCH', 502, '요청한 traceId와 응답이 다릅니다.');
    const kp = raw.metadata?.kpap || {};
    if (kp.runId && kp.runId !== run.runId) throw error('RUN_IDENTITY_MISMATCH', 502, '요청한 runId와 응답이 다릅니다.');
    const linkedDesign = run.snapshotId && design && kp.graphVersion === design.id && kp.snapshotId === run.snapshotId ? clone(design) : null;
    const rows = observations.map(row => observation(row, { run, metadata: raw.metadata, design: linkedDesign }));
    return { availability: 'available', observations: rows, nextCursor, trace: { id: run.runId, runId: run.runId, traceId: raw.id, sessionId: run.sessionId, snapshot: snapshot ? clone(snapshot) : { id: run.snapshotId || '스냅샷 미확인', label: '적용 설정 미확인' }, design: linkedDesign, graphVersion: kp.graphVersion ?? null, fixtureVersion: kp.fixtureVersion || 'Langfuse v3 Mock', input: clone(raw.input), text: typeof raw.output === 'string' ? raw.output : raw.output?.text ?? null, turns: clone(kp.turns) || [], observations: rows, nextCursor, source: 'langfuse-v3-public-mock', timestamp: raw.timestamp ?? null, metadataMapped: !!linkedDesign } };
  }
  function merge(existing, incoming) { const rows = new Map(existing.map(row => [row.id, row])); for (const row of incoming) rows.set(row.id, row); return [...rows.values()]; }
  return { error, duration, observation, normalize, merge };
});
