(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.PilotModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STATUSES = ['PASS', 'FAIL', 'UNJUDGEABLE', 'JUDGE_ERROR'];
  const LABELS = { PASS: '충족', FAIL: '미충족', UNJUDGEABLE: '판정 불가', JUDGE_ERROR: '평가 오류' };
  function immutable(value) {
    const copy = JSON.parse(JSON.stringify(value));
    function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
    return freeze(copy);
  }
  function createState(prompt) { return { draft: { label: 'B1', prompt, baseId: 'config-A-v12' }, saved: null, evaluations: [], selectedEvaluationId: null, snapshotSequence: 0 }; }
  function isEvaluated(state) { return !!state.saved && state.evaluations.some(e => e.candidate.id === state.saved.id); }
  function isDirty(state) { return !state.saved || state.saved.prompt !== state.draft.prompt; }
  function editDraft(state, text) {
    if (isEvaluated(state)) throw new Error('평가한 설정은 읽기 전용입니다. 다음 초안을 만들어 주세요.');
    state.draft.prompt = text;
  }
  function saveDraft(state) {
    if (isEvaluated(state)) throw new Error('평가한 설정은 변경할 수 없습니다.');
    if (!state.draft.prompt.trim()) throw new Error('프롬프트를 입력해 주세요.');
    if (!isDirty(state)) return state.saved;
    state.saved = immutable({ id: `config-${state.draft.label}-r${++state.snapshotSequence}`, label: state.draft.label, prompt: state.draft.prompt, baseId: state.draft.baseId, model: 'GPT-4.1 mini', tools: ['payments.search'], knowledge: '결제 조회 정책 v3' });
    return state.saved;
  }
  function createNextDraft(state, evaluationId) {
    const result = state.evaluations.find(e => e.id === evaluationId);
    if (!result) throw new Error('기준 평가를 찾을 수 없습니다.');
    if (!isEvaluated(state)) throw new Error('현재 후보를 먼저 평가하거나 초안을 유지해 주세요.');
    const max = Math.max(0, ...state.evaluations.map(e => Number(e.candidate.label.slice(1)) || 0));
    state.draft = { label: `B${max + 1}`, prompt: result.candidate.prompt, baseId: result.candidate.id };
    state.saved = null; return state.draft;
  }
  function comparisonCandidate(state) {
    if (!state.saved || isDirty(state)) throw new Error('미저장 변경이 있습니다. 저장한 뒤 비교해 주세요.');
    if (isEvaluated(state)) throw new Error('이미 평가한 설정입니다. 다음 초안을 만들어 주세요.');
    return immutable(state.saved);
  }
  const CRITERIA = [{ id: 'amount', name: '취소 제외 · 금액 정확성' }, { id: 'consistency', name: '조회 결과와 응답 일치' }, { id: 'scope', name: '요청한 월의 내역 조회' }];
  function saveDefinition(state, input) {
    if (!input.name?.trim()) throw new Error('평가 정의 이름을 입력해 주세요.');
    const criteria = [...new Set(input.criteria || [])];
    if (!criteria.length || criteria.some(id => !CRITERIA.some(c => c.id === id))) throw new Error('평가 기준을 하나 이상 선택해 주세요.');
    if (!input.judge?.id || !input.judge?.version || !input.judge?.rubric?.trim()) throw new Error('Judge 설정과 판정 지침을 확인해 주세요.');
    const old = state.definitions.find(d => d.id === input.id);
    const definition = immutable({ id: old?.id || `definition-${++state.definitionSequence}`, revision: (old?.revision || 0) + 1, name: input.name.trim(), criteria, judge: input.judge });
    state.definitions = [...state.definitions.filter(d => d.id !== definition.id), definition];
    state.selectedDefinitionId = definition.id; return definition;
  }
  function runConfiguration(state) {
    const definition = state.definitions.find(d => d.id === state.selectedDefinitionId);
    const dataset = state.datasets.find(d => d.id === state.selectedDatasetId);
    if (!definition) throw new Error('평가 정의를 만들거나 선택해 주세요.');
    if (!dataset) throw new Error('데이터셋을 선택해 주세요.');
    if (!state.case || (state.case.datasetId && state.case.datasetId !== dataset.id)) throw new Error('선택한 데이터셋에 평가할 케이스가 없습니다.');
    return immutable({ definition, dataset: { id: dataset.id, name: dataset.name, revision: dataset.revision, caseIds: [state.case.id], caseCount: 1, expected: state.case.expected ?? 50000, fixtureVersion: state.case.fixtureVersion || 'fixture-v1' } });
  }
  function normalizeStatus(status) { return STATUSES.includes(status) ? status : 'UNJUDGEABLE'; }
  function normalizeSide(side) { return { status: normalizeStatus(side?.status), reason: side?.reason || '판정 근거가 제공되지 않았습니다.', evidence: side?.evidence || null }; }
  function acceptEvaluation(state, response, expectedCandidate, expectedConfig = null) {
    if (!response || !Array.isArray(response.criteria) || !response.criteria.length) throw new Error('평가 기준 결과가 비어 있습니다.');
    if (response.candidate?.id !== expectedCandidate.id || response.candidate?.prompt !== expectedCandidate.prompt) throw new Error('평가 설정이 요청한 저장본과 다릅니다. 결과를 확인해 주세요.');
    if (expectedConfig && (JSON.stringify(response.definition) !== JSON.stringify(expectedConfig.definition) || JSON.stringify(response.dataset) !== JSON.stringify(expectedConfig.dataset))) throw new Error('평가 정의 또는 데이터셋이 요청한 스냅샷과 다릅니다.');
    if (state.evaluations.some(e => e.id === response.id)) return state.evaluations.find(e => e.id === response.id);
    const result = immutable({ ...response, candidate: expectedCandidate, criteria: response.criteria.map(c => ({ ...c, a: normalizeSide(c.a), b: normalizeSide(c.b) })) });
    state.evaluations.push(result); state.selectedEvaluationId = result.id; return result;
  }
  function countStatuses(result, side) {
    const counts = { PASS: 0, FAIL: 0, UNJUDGEABLE: 0, JUDGE_ERROR: 0 };
    for (const row of result.criteria) counts[normalizeStatus(row[side]?.status)]++;
    return counts;
  }
  function resultSummary(result) {
    const a = countStatuses(result, 'a'), b = countStatuses(result, 'b');
    if (b.JUDGE_ERROR) return { tone: 'error', title: `${result.candidate.label} 평가를 끝내지 못했어요.`, detail: `평가 오류 ${b.JUDGE_ERROR}개 · 완료된 기준과 분리해 표시합니다.` };
    if (b.UNJUDGEABLE) return { tone: 'neutral', title: `${result.candidate.label}의 일부 기준은 판단을 보류했어요.`, detail: `판정 불가 ${b.UNJUDGEABLE}개 · 통과로 계산하지 않습니다.` };
    if (b.FAIL) return { tone: 'warning', title: `${result.candidate.label}에 미충족 기준이 있어요.`, detail: `이 사례에서 충족 ${b.PASS}개 · 미충족 ${b.FAIL}개` };
    return { tone: 'success', title: `이 사례에서 ${result.candidate.label}의 모든 기준을 충족했어요.`, detail: `A 미충족 ${a.FAIL}개 → ${result.candidate.label} 미충족 0개 · 다른 사례의 품질 향상을 뜻하지 않습니다.` };
  }
  function conditionLabel(c) { if (c?.mode === 'mock') return 'Mock · 실행 조건 미검증'; return c?.configApplied === true && c?.isolatedState === true && c?.fixedTools === true ? '동일 조건 확인' : '조건 일치 미확인'; }
  function resolveEvidence(trace, reference = {}) {
    const observation = trace.observations?.find(o => o.id === reference.observationId) || null;
    const node = trace.design?.nodes?.find(n => n.id === observation?.ownerNodeId) || null;
    const globalScope = ['session', 'turn', 'conversation'].includes(reference.scope);
    const turnId = reference.scope === 'session' || reference.scope === 'conversation' ? null : reference.scope === 'turn' ? reference.turnId || null : reference.turnId || observation?.turnId || null;
    const missingTurn = !!turnId && !trace.turns?.some(t => t.id === turnId);
    if (!globalScope && observation && node) return { scope: 'observation', observationId: observation.id, nodeId: node.id, turnId, conversationScope: turnId ? 'turn' : 'session', unavailable: false, reason: null };
    const missingObservation = !!reference.observationId && !observation && !globalScope;
    return { scope: 'conversation', observationId: globalScope ? null : observation?.id || null, nodeId: null, turnId, conversationScope: turnId || reference.scope === 'turn' ? 'turn' : 'session', unavailable: missingTurn || missingObservation || (reference.scope === 'turn' && !turnId), reason: missingTurn || (reference.scope === 'turn' && !turnId) ? '인용된 턴을 찾을 수 없습니다. 다른 턴으로 대신하지 않습니다.' : globalScope ? '대화 단위의 근거입니다. 특정 노드에 귀속하지 않습니다.' : observation ? '이 호출은 설계 노드에 연결되지 않았습니다. 대화와 참조 원문을 확인하세요.' : missingObservation ? '요청한 호출을 찾을 수 없어 대화를 표시합니다. 인용 원문이나 미실행의 증거는 아닙니다.' : '전체 대화 기록을 확인합니다.' };
  }
  return { CRITERIA, saveDefinition, runConfiguration, resolveEvidence, STATUSES, LABELS, immutable, createState, isEvaluated, isDirty, editDraft, saveDraft, createNextDraft, comparisonCandidate, normalizeStatus, acceptEvaluation, countStatuses, resultSummary, conditionLabel };
});
