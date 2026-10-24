'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const M = require('../dist/pilot-model.js'), api = require('../dist/mock-api.js');
function setup({ reduced = false, mobile = false } = {}) {
  const elements = {}, animations = [], mediaListeners = {};
  let context;
  function get(id) {
    return elements[id] ||= { id, value: 'payment-regression', checked: true, innerHTML: '', textContent: '', scrollTop: 0,
      style: { setProperty() {} }, getBoundingClientRect() { return { height: 180 }; },
      focus() { context.document.activeElement = this; }, scrollIntoView() {}, addEventListener() {}, querySelector() { return get('modal-child'); }, querySelectorAll() { return []; },
      animate(frames, options) { const animation = { target: id, frames, options, cancelled: false, cancel() { this.cancelled = true; this.oncancel?.(); } }; animations.push(animation); return animation; },
      classList: { values: new Set(), add(v) { this.values.add(v); }, remove(v) { this.values.delete(v); }, contains(v) { return this.values.has(v); } } };
  }
  context = { console, AbortController, DOMException, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 12)), clearTimeout,
    document: { getElementById: get, activeElement: get('tab-execute'), body: { style: {} }, addEventListener() {} }, location: { hash: '' },
    window: { scrollY: 0, scrollTo({ top }) { this.scrollY = top; }, history: { pushState() {}, replaceState() {} }, addEventListener() {}, getComputedStyle() { return { gridTemplateColumns: '270px 700px' }; }, matchMedia(query) { return { matches: query.includes('reduced-motion') ? reduced : mobile, addEventListener(type, fn) { mediaListeners[query] = fn; } }; } } };
  vm.createContext(context); const run = text => vm.runInContext(text, context);
  for (const file of ['pilot-model.js', 'trace-adapter.js', 'mock-api.js', 'trace-replay.js', 'trace-views.js', 'trace-inspection.js', 'pilot.js']) run(fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8'));
  return { run, get, animations, setReduced(value) { reduced = value; mediaListeners['(prefers-reduced-motion: reduce)']?.(); } };
}
async function evaluated(ui, scenario = 'repeated') {
  ui.run(`editPrompt('saved candidate');saveDraft();S.case={id:'case-024'};S.scenario='${scenario}';navigate('evaluate')`);
  await ui.run('compare()');
}
test('evaluation is result-first, with graph absent and setup closed after completion', async () => {
  const ui = setup(); await evaluated(ui);
  assert.equal(ui.run('S.evalSetupOpen'), false);
  assert.ok(ui.get('app').innerHTML.includes('setup-disclosure '));
  assert.ok(!ui.get('app').innerHTML.includes('snapshot-graph'));
  assert.ok(!ui.get('app').innerHTML.includes('class="comparison-setup"'));
  ui.run('toggleEvaluationSetup()'); assert.ok(ui.get('app').innerHTML.includes('class="evaluation-metadata"'));
  ui.run('toggleEvaluationSetup()'); assert.equal(ui.run('S.evalSetupOpen'), false);
});
test('graph maps selected run node; exact occurrence and raw scroll survive navigation modes', async () => {
  const ui = setup(); await evaluated(ui); ui.run('window.scrollY=410'); await ui.run("openEvidence(S.selectedEvaluationId,0,'b')");
  assert.equal(ui.run('S.traceNav'), 'flow'); assert.equal(ui.run('S.tracePanelOpen'), true);
  assert.equal(ui.run('currentObservation().attempt'), 2); assert.equal(ui.run('S.selectedNodeId'), 'node_payment_query');
  assert.ok(ui.get('app').innerHTML.includes('설계 연결')); assert.ok(ui.get('app').innerHTML.includes('선택 노드의 호출'));
  ui.get('record-output').scrollTop = 104;
  ui.run("selectObservation(S.traceData.observations[0].id)"); assert.equal(ui.get('record-output').scrollTop, 0);
  ui.get('record-output').scrollTop = 23; ui.run('returnToCitation()'); assert.equal(ui.get('record-output').scrollTop, 104);
  ui.run("setTraceNav('calls');toggleTracePanel();toggleTracePanel();setTraceNav('flow')");
  assert.equal(ui.run('currentObservation().attempt'), 2); assert.equal(ui.get('record-output').scrollTop, 104);
  ui.run('returnToOrigin()'); assert.equal(ui.run('window.scrollY'), 410); assert.equal(ui.run('S.tab'), 'evaluate');
});
test('turn and unmapped evidence never force a graph node', async () => {
  for (const scenario of ['conversation', 'unmapped']) {
    const ui = setup(); await evaluated(ui, scenario); await ui.run("openEvidence(S.selectedEvaluationId,0,'b')");
    assert.equal(ui.run('S.traceScope'), 'conversation'); assert.equal(ui.run('S.selectedNodeId'), null); assert.equal(ui.run('S.traceNav'), 'calls');
    assert.ok(ui.get('app').innerHTML.includes('노드에 귀속하지 않음')); assert.equal(ui.run('isCitedSelection()'), true);
    if (scenario === 'unmapped') assert.ok(ui.get('app').innerHTML.includes('참조된 호출 원문'));
  }
});
test('explicit missing turn remains unresolved; session shows all turns, selected turn labels its real index', async () => {
  const trace = await api.trace(api.original.traceId, { delay: 0 });
  trace.turns.push({ id: 'turn-second', input: 'second question', output: 'second reply' });
  const missing = M.resolveEvidence(trace, { scope: 'turn', turnId: 'missing-turn' });
  assert.equal(missing.turnId, 'missing-turn'); assert.equal(missing.unavailable, true);
  const session = M.resolveEvidence(trace, { scope: 'session' }); assert.equal(session.turnId, null); assert.equal(session.conversationScope, 'session');
  const ui = setup(); ui.run(`S.traceData=${JSON.stringify(trace)};S.traceScope='conversation';S.conversationScope='turn';S.turnId='missing-turn'`);
  let rendered = ui.run('conversationInspector(S.traceData)'); assert.ok(rendered.includes('인용된 턴을 찾을 수 없습니다')); assert.ok(!rendered.includes('second reply'));
  ui.run("S.turnId='turn-second'"); rendered = ui.run('conversationInspector(S.traceData)'); assert.ok(rendered.includes('대화 · 턴 2')); assert.ok(rendered.includes('second reply'));
  ui.run("S.conversationScope='session';S.turnId=null"); rendered = ui.run('conversationInspector(S.traceData)'); assert.ok(rendered.includes('전체 2턴')); assert.ok(rendered.includes('second reply')); assert.ok(rendered.includes(trace.turns[0].output));
});
test('rapid panel/tab/selection actions have synchronous final state and cancel obsolete motion', async () => {
  const ui = setup(); await evaluated(ui); await ui.run("openEvidence(S.selectedEvaluationId,0,'b')");
  for (let n = 0; n < 12; n++) ui.run("toggleTracePanel();setTraceNav('calls');setTraceNav('flow');navigate('evaluate');navigate('trace')");
  assert.equal(ui.run('S.tab'), 'trace'); assert.equal(ui.run('S.tracePanelOpen'), true); assert.equal(ui.run('currentObservation().attempt'), 2);
  assert.ok(ui.animations.some(a => a.cancelled));
  for (const animation of ui.animations) animation.onfinish?.();
  assert.equal(ui.run('S.tab'), 'trace'); assert.equal(ui.run('currentObservation().attempt'), 2);
});
test('reduced motion skips and cancels animations without changing focus/state behavior', async () => {
  const ui = setup({ reduced: true }); await evaluated(ui); await ui.run("openEvidence(S.selectedEvaluationId,0,'b')");
  ui.run('toggleTracePanel()'); assert.equal(ui.animations.length, 0); assert.equal(ui.get('toggle-trace-panel'), ui.run('document.activeElement'));
  const active = setup(); active.run("navigate('evaluate')"); assert.ok(active.animations.length > 0);
  active.setReduced(true); assert.equal(active.run('Motion.active.size'), 0);
  const count = active.animations.length; active.run("navigate('execute')"); assert.equal(active.animations.length, count);
});
test('mobile evidence starts with compact navigator collapsed but selected occurrence retained', async () => {
  const ui = setup({ mobile: true }); await evaluated(ui); await ui.run("openEvidence(S.selectedEvaluationId,0,'b')");
  assert.equal(ui.run('S.tracePanelOpen'), false); assert.equal(ui.run('currentObservation().attempt'), 2);
  ui.run('toggleTracePanel()'); assert.equal(ui.run('S.tracePanelOpen'), true); assert.equal(ui.run('currentObservation().attempt'), 2);
});

test('generic rapid tab navigation focuses the active tab, explicit evidence return retains trigger focus', async () => {
  const ui = setup(); await evaluated(ui); await ui.run("openEvidence(S.selectedEvaluationId,0,'b')");
  ui.run("document.activeElement=document.getElementById('tab-evaluate');navigate('evaluate');document.activeElement=document.getElementById('tab-execute');navigate('execute');document.activeElement=document.getElementById('tab-trace');navigate('trace')");
  assert.equal(ui.run('S.tab'), 'trace'); assert.equal(ui.run('document.activeElement.id'), 'tab-trace');
  ui.run('returnToOrigin()'); assert.equal(ui.run('document.activeElement.id'), ui.run("'evidence-'+S.selectedEvaluationId+'-0-b'"));
});

test('compact evaluation hides explanation by default but keeps important issues and correct return target', async () => {
  for (const [scenario, expected] of Object.entries({ pass: '기준 3개 충족', fail: '미충족 1개', unjudgeable: '판정 불가 1개', judge_error: '평가 오류 1개' })) {
    const ui = setup(); await evaluated(ui, scenario); const id = ui.run('S.selectedEvaluationId');
    assert.ok(ui.get('app').innerHTML.includes(expected));
    assert.ok(!ui.get('app').innerHTML.includes('response-comparison'));
    assert.ok(!ui.get('app').innerHTML.includes('<table>'));
    assert.ok(!ui.get('app').innerHTML.includes('조회 결과와 응답 일치'));
    assert.ok(!ui.get('app').innerHTML.includes('Judge 1.2'));
    assert.ok(ui.get('context').innerHTML.includes('Mock · 조건 미검증'));
    if (scenario !== 'pass') {
      const trigger = `issue-evidence-${id}-0-b`; assert.ok(ui.get('app').innerHTML.includes(trigger));
      ui.run('window.scrollY=91'); await ui.run(`openEvidence('${id}',0,'b','${trigger}')`); ui.run('returnToOrigin()');
      assert.equal(ui.run('document.activeElement.id'), trigger); assert.equal(ui.run('window.scrollY'),91);
      assert.equal(ui.run(`!!S.evalDetailsOpen['${id}']`),false);
    }
    ui.run(`toggleEvaluationDetails('${id}')`); assert.ok(ui.get('app').innerHTML.includes('response-comparison')); assert.ok(ui.get('app').innerHTML.includes('<table>'));
    ui.run(`toggleEvaluationDetails('${id}')`); assert.ok(!ui.get('app').innerHTML.includes('<table>'));
  }
});

test('evaluation home exposes usable definitions, datasets and target; create/edit validation preserves history', async () => {
  const ui = setup(); ui.run("navigate('evaluate')");
  assert.equal(ui.run('S.evalPage'), 'home');
  for (const text of ['평가 정의', '데이터셋 관리', '기존 Judge 관리', '실행 대상', '실행 이력이 없습니다']) assert.ok(ui.get('app').innerHTML.includes(text));
  ui.run('definitionModal();storeDefinition()'); assert.ok(ui.get('definition-error').innerHTML.includes('이름'));
  ui.run("S.definitionDraft.name='금액 검증';S.definitionDraft.criteria=['amount'];storeDefinition()"); assert.equal(ui.run('selectedDefinition().name'), '금액 검증');
  ui.run("selectDataset('payment-samples');saveDraft()"); await ui.run('compare()');
  assert.equal(ui.run('S.evalPage'), 'detail'); assert.equal(ui.run('currentResult().criteria.length'), 1);
  const result = ui.run('JSON.stringify(currentResult())');
  ui.run("showEvaluationHome();definitionModal(S.selectedDefinitionId);S.definitionDraft.name='금액 검증 수정';S.definitionDraft.judge.rubric='새 판정 지침';storeDefinition()");
  assert.equal(ui.run('selectedDefinition().revision'), 2); assert.equal(ui.run('selectedDefinition().judge.id'), 'mock-judge-1'); assert.equal(ui.run('JSON.stringify(currentResult())'), result);
  ui.run("definitionModal(S.selectedDefinitionId);S.definitionDraft.judge.rubric='또 다른 지침';storeDefinition()"); assert.equal(ui.run('selectedDefinition().judge.id'), 'mock-judge-2');
  ui.run("window.scrollY=330;openEvaluationResult(S.selectedEvaluationId,'open-'+S.selectedEvaluationId);showEvaluationHome()"); assert.equal(ui.run('window.scrollY'), 330);
});
test('manager adapters return explicit mock selection and empty dataset clears stale case', async () => {
  const ui = setup(); ui.run("navigate('evaluate');managerHandoff('dataset')");
  assert.ok(ui.get('modal').innerHTML.includes('실제 관리자 미연결')); ui.get('manager-selection').value = 'payment-samples'; ui.run('applyManagerSelection()'); assert.equal(ui.run('S.case.datasetId'), 'payment-samples');
  ui.run("selectDataset('payment-regression')"); assert.equal(ui.run('S.case'), null); ui.run('datasetCases()'); assert.ok(ui.get('modal').innerHTML.includes('케이스가 없습니다'));
  ui.run("managerHandoff('dataset')"); ui.get('new-dataset-name').value = '새 사례 모음'; ui.run('createMockDataset()'); assert.equal(ui.run('selectedDataset().name'), '새 사례 모음'); assert.equal(ui.run('S.case'), null);
  ui.run('caseModal()'); ui.get('dataset').value = ui.run('S.selectedDatasetId'); ui.get('expected-confirmed').checked = false; await ui.run('storeCase()'); assert.equal(ui.run('selectedDataset().cases.length'), 0);
  ui.get('expected-confirmed').checked = true; await ui.run('storeCase()'); assert.equal(ui.run('selectedDataset().cases.length'), 1); await ui.run('storeCase()'); assert.equal(ui.run('selectedDataset().cases.length'), 1);
  ui.run("definitionModal();S.definitionDraft.name='유지';managerHandoff('judge',true)"); ui.get('manager-selection').value = 'payment-review'; ui.run('applyManagerSelection()'); assert.equal(ui.run('S.definitionDraft.name'), '유지'); assert.equal(ui.run('S.definitionDraft.judge.id'), 'payment-review'); assert.equal(ui.run('selectedDefinition().judge.id'), 'payment-rubric');
});
test('run freezes inputs, busy selections are locked, home and evidence detail context survive', async () => {
  const ui = setup(); ui.run("navigate('evaluate');selectDataset('payment-samples');saveDraft();S.scenario='judge_error'");
  const pending = ui.run('compare()'); ui.run("selectDataset('payment-regression');selectDefinition('invalid');definitionModal()");
  assert.equal(ui.run('S.selectedDatasetId'), 'payment-samples'); assert.equal(ui.run('S.selectedDefinitionId'), 'definition-payment'); await pending;
  const id = ui.run('S.selectedEvaluationId'); ui.run('showEvaluationHome()'); assert.ok(ui.get('app').innerHTML.includes('평가 오류 1'));
  ui.run(`openEvaluationResult('${id}','open-${id}')`); await ui.run(`openEvidence('${id}',0,'b','issue-evidence-${id}-0-b')`); ui.run('returnToOrigin()'); assert.equal(ui.run('S.evalPage'), 'detail');
  ui.run('nextDraft()'); assert.equal(ui.run('S.evalPage'), 'home'); assert.equal(ui.run('S.draft.label'), 'B2');
});

test('historical run detail never mixes current unsaved candidate preparation or settings', async () => {
  const ui = setup(); await evaluated(ui, 'pass');
  const id = ui.run('S.selectedEvaluationId'); ui.run("nextDraft();editPrompt('unfinished B2');navigate('evaluate')");
  ui.run(`openEvaluationResult('${id}');toggleEvaluationSetup()`);
  assert.ok(!ui.get('app').innerHTML.includes('compact-prepare')); assert.ok(!ui.get('app').innerHTML.includes('unfinished B2'));
  assert.ok(ui.get('app').innerHTML.includes('config-B1-r1')); assert.ok(ui.get('app').innerHTML.includes('평가 정의'));
  assert.equal(ui.run('S.draft.prompt'), 'unfinished B2');
});

test('evaluation launch order is dataset then definition then execution, including DOM keyboard order', () => {
  const ui = setup(); ui.run("navigate('evaluate')");
  const markup = ui.get('app').innerHTML, launch = markup.slice(markup.indexOf('class="launch-grid"'), markup.indexOf('class="launch-footer"'));
  assert.ok(markup.includes('id="launch-heading">평가 준비'));
  assert.ok(launch.indexOf('id="dataset-select"') < launch.indexOf('id="definition-select"'));
  assert.ok(launch.indexOf('id="definition-select"') < launch.indexOf('id="edit-candidate"'));
  assert.match(launch, /<span>01<\/span><h3>데이터셋<\/h3>/);
  assert.match(launch, /<span>02<\/span><h3>평가 정의<\/h3>/);
  assert.match(launch, /<span>03<\/span><h3>실행 대상<\/h3>/);
});

test('trace tab opens platform run list; session filter, cursor and exact back context work', async () => {
  const ui = setup(); ui.run("navigate('trace')"); await ui.run('loadRuns()');
  assert.equal(ui.run('S.tracePage'), 'list'); assert.ok(ui.get('app').innerHTML.includes('KPAP 실행 목록'));
  await ui.run("selectRunSession('session-payments')"); ui.run('window.scrollY=240'); await ui.run("openRun('run-sample-retry')");
  assert.equal(ui.run('S.runSummary.status'), 'completed'); assert.equal(ui.run('S.traceAvailability'), 'available');
  ui.run('showTraceList()'); assert.equal(ui.run('window.scrollY'), 240); assert.equal(ui.run('document.activeElement.id'), 'run-run-sample-retry'); assert.equal(ui.run('S.runList.sessionId'), 'session-payments');
  await ui.run("selectRunSession('session-empty')"); assert.ok(ui.get('app').innerHTML.includes('실행 기록이 없습니다'));
});
test('observation absence, outage and forbidden stay independent from business success', async () => {
  const ui = setup(); ui.run("navigate('trace')"); await ui.run('loadRuns()');
  await ui.run("openRun('run-sample-not-found')"); assert.equal(ui.run('S.runSummary.status'), 'completed'); assert.equal(ui.run('S.traceAvailability'), 'not_found'); assert.ok(ui.get('app').innerHTML.includes('삭제되었는지는 구분할 수 없습니다'));
  ui.run('showTraceList()'); await ui.run("selectRunSession('session-sdk')"); await ui.run("openRun('run-sample-outage')"); assert.equal(ui.run('S.error.status'), 503); assert.equal(ui.run('S.runSummary.status'), 'completed');
  ui.run('showTraceList()'); const before = ui.run('MockAPI.adapterStats.langfuseRequests'); await ui.run("openRun('run-sample-forbidden')"); assert.equal(ui.run('S.error.status'), 403); assert.equal(ui.run('MockAPI.adapterStats.langfuseRequests'), before); assert.ok(!ui.get('app').innerHTML.includes('id="retry-request"'));
});
test('run paging failure retries attempted page without corrupting previous cursor history', async () => {
  const ui = setup(); ui.run("navigate('trace')"); await ui.run('loadRuns()');
  ui.run('MockAPI.simulateError()'); await ui.run('nextRunPage()'); assert.equal(ui.run('S.runList.cursor'), null); assert.equal(ui.run('S.runList.previous.length'), 0);
  await ui.run('retryRuns()'); assert.equal(ui.run('S.runList.cursor'), 'run:5'); assert.equal(ui.run('S.runList.previous.length'), 1);
  ui.run('MockAPI.simulateError()'); await ui.run('previousRunPage()'); assert.equal(ui.run('S.runList.cursor'), 'run:5'); assert.equal(ui.run('S.runList.previous.length'), 1);
  await ui.run('retryRuns()'); assert.equal(ui.run('S.runList.cursor'), null); assert.equal(ui.run('S.runList.previous.length'), 0);
});
test('more observations retain exact selection and raw scroll; retry merges instead of replacing old page', async () => {
  const ui = setup(); ui.run("navigate('trace')"); await ui.run('loadRuns()'); await ui.run("openRun('run-sample-retry')");
  ui.run('selectObservation(S.traceData.observations[1].id)'); const id = ui.run('S.observationId'); ui.get('record-output').scrollTop = 119;
  ui.run('MockAPI.simulateError()'); await ui.run('loadSelectedRun(true)'); assert.equal(ui.run('S.traceData.observations.length'), 2); assert.equal(ui.run('S.observationId'), id);
  await ui.run('loadSelectedRun(S.traceRequestMore)'); assert.equal(ui.run('S.traceData.observations.length'), 3); assert.equal(ui.run('S.observationId'), id); assert.equal(ui.get('record-output').scrollTop, 119);
});
test('newer session/detail selection wins and leaving detail cancels without changing run status', async () => {
  const ui = setup(); ui.run("navigate('trace')"); await ui.run('loadRuns()');
  const p = ui.run("selectRunSession('session-payments')"), q = ui.run("selectRunSession('session-sdk')"); await Promise.all([p, q]); assert.ok(ui.run("S.runList.items.every(run=>run.sessionId==='session-sdk')"));
  const first = ui.run("openRun('run-sample-outage')"), second = ui.run("openRun('run-sample-legacy')"); await Promise.all([first, second]); assert.equal(ui.run('S.runSummary.runId'), 'run-sample-legacy'); assert.equal(ui.run('S.error'), null); assert.equal(ui.run('S.traceData.design'), null);
  const pending = ui.run("openRun('run-sample-outage')"); ui.run('showTraceList()'); await pending; assert.equal(ui.run('S.tracePage'), 'list'); assert.equal(ui.run('S.loading'), null); assert.equal(ui.run('S.runSummary.status'), 'completed');
});

test('evidence not_found keeps typed availability and origin, never generic success or replacement occurrence', async () => {
  const ui = setup(); await evaluated(ui, 'pass');
  ui.run('window.scrollY=88');
  const list = await ui.run("MockAPI.listRuns({sessionId:'session-payments'},{delay:0})"); const missing = list.items.find(r => r.runId === 'run-sample-not-found');
  await ui.run(`openTrace(${JSON.stringify({runId:missing.runId,traceId:missing.traceId,observationId:'missing-exact'})},{title:'기록 근거',status:'FAIL',triggerId:'result-next'})`);
  assert.equal(ui.run('S.traceAvailability'), 'not_found'); assert.equal(ui.run('S.error'), null); assert.equal(ui.run('S.traceData'), null); assert.ok(ui.get('app').innerHTML.includes('삭제되었는지는 구분할 수 없습니다'));
  await ui.run('retryTraceEvidence()'); assert.equal(ui.run('S.traceAvailability'), 'not_found'); ui.run('returnToOrigin()'); assert.equal(ui.run('S.tab'), 'evaluate'); assert.equal(ui.run('window.scrollY'), 88);
});

test('replay steps select exact I/O without stealing control focus; citation return resynchronizes paused cursor', async () => {
  const ui = setup(); await evaluated(ui, 'repeated'); await ui.run("openEvidence(S.selectedEvaluationId,0,'b')");
  assert.equal(ui.run('Replay.state.playing'), false); const cited = ui.run('S.observationId');
  ui.get('replay-previous').focus(); ui.run('replayStep(-1)'); assert.equal(ui.run('currentObservation().input.exclude_cancelled'), false); assert.equal(ui.run('document.activeElement.id'), 'replay-previous');
  ui.run('returnToCitation()'); assert.equal(ui.run('S.observationId'), cited); assert.equal(ui.run('Replay.state.selectionId'), cited);
  ui.run('toggleReplay();navigate("evaluate")'); assert.equal(ui.run('Replay.state.playing'), false); assert.equal(ui.run('S.selectedEvaluationId'), ui.run('S.origin.resultId'));
});
test('reduced motion retains timed/step functionality but no decorative node or edge motion', async () => {
  const ui = setup({ reduced: true }); ui.run("navigate('trace')"); await ui.run('loadRuns()'); await ui.run("openRun('run-sample-replay')"); await ui.run('loadSelectedRun(true)');
  ui.run('replayStep(1);toggleReplay()'); assert.equal(ui.run('Replay.state.playing'), true); assert.equal(ui.get('historic-node_payment_query').classList.contains('replay-pulse'), false);
  ui.run('Replay.pause();replayStep(1)'); assert.equal(ui.run('currentObservation().kind'), 'generation'); assert.equal(ui.get('design-edge-node_payment_query-node_answer').classList.contains('transition-motion'), false);
  ui.run('showTraceList()'); assert.equal(ui.run('Replay.state.playing'), false);
});
test('replay never survives run reload, error, panel navigation or missing timestamp fallback', async () => {
  const ui = setup(); ui.run("navigate('trace')"); await ui.run('loadRuns()'); await ui.run("openRun('run-sample-replay')"); ui.run('toggleReplay();setTraceNav("calls")'); assert.equal(ui.run('Replay.state.playing'), false);
  ui.run('toggleReplay()'); const pending = ui.run('loadSelectedRun(true)'); assert.equal(ui.run('Replay.state.playing'), false); await pending; assert.equal(ui.run('Replay.state.playing'), false);
  ui.run('showTraceList()'); await ui.run("selectRunSession('session-sdk')"); await ui.run("openRun('run-sample-untimed')"); assert.equal(ui.run('Replay.state.model.playable'), false); ui.run('replayStep(1)'); assert.equal(ui.run('S.observationId'), ui.run('Replay.state.selectionId')); assert.equal(ui.run('Replay.state.position'), null);
});

test('reference-style flow wrapper keeps node editing and trace navigation identity', async () => {
  const ui = setup();
  assert.ok(ui.get('app').innerHTML.includes('class="flow-panel"'));
  ui.run("selectNode('query')");
  assert.equal(ui.run('document.activeElement.id'), 'node-prompt');
  ui.run("editPrompt('reference style preserves draft');saveDraft();closeEditor()");
  assert.equal(ui.run('S.saved.prompt'), 'reference style preserves draft');
  assert.equal(ui.run('document.activeElement.id'), 'edit-query');
  await ui.run('openOriginalTrace()');
  assert.ok(ui.get('app').innerHTML.includes('trace-nav-inner flow-view'));
  const selected = ui.run('S.observationId');
  ui.run("setTraceNav('calls')");
  assert.ok(ui.get('app').innerHTML.includes('trace-nav-inner calls-view'));
  assert.equal(ui.run('S.observationId'), selected);
  ui.run("setTraceNav('flow')");
  assert.ok(ui.get('app').innerHTML.includes('trace-nav-inner flow-view'));
  assert.equal(ui.run('S.observationId'), selected);
});

async function richTrace(ui) {
  ui.run("navigate('trace')");await ui.run('loadRuns()');await ui.run("openRun('run-sample-observability')");
  while(ui.run('!!S.traceData.nextCursor')) await ui.run('loadSelectedRun(true)');
}
test('restored native trace root shows structured I/O with no node or turn dependency', async () => {
  const ui=setup();ui.run("navigate('trace')");await ui.run("selectRunSession('session-sdk')");await ui.run("openRun('run-sample-legacy')");
  assert.equal(ui.run('S.traceData.design'),null);assert.equal(ui.run('S.traceData.turns.length'),0);
  ui.run('selectTraceRoot()');assert.equal(ui.run('S.traceScope'),'trace');assert.equal(ui.run('S.selectedNodeId'),null);assert.ok(ui.get('app').innerHTML.includes('&quot;received&quot;: true'));
  ui.run("setTraceFormat('formatted')");assert.ok(ui.get('app').innerHTML.includes('payload-object'));assert.ok(ui.get('app').innerHTML.includes('native-sdk'));
  assert.equal((ui.get('app').innerHTML.match(/id="record-output"/g)||[]).length,1);
});
test('tree filters retain ancestors and selected detail; exact ID survives mode and filter changes', async () => {
  const ui=setup();await richTrace(ui);assert.equal(ui.run('S.traceNav'),'tree');
  const target=ui.run('S.traceData.observations[3].id');ui.run(`selectObservation('${target}')`);ui.get('record-output').scrollTop=73;
  ui.run("setObservationFilter('level','ERROR')");assert.equal(ui.run('S.observationId'),target);assert.ok(ui.get('trace-nav-content').innerHTML.includes('상위 문맥'));assert.ok(ui.get('trace-filter-status').innerHTML.includes('선택 관측은 필터 밖'));
  ui.run("setObservationFilter('query','no-such-record')");assert.ok(ui.get('trace-nav-content').innerHTML.includes('일치하는 관측이 없습니다'));assert.equal(ui.run('S.observationId'),target);
  ui.run("clearObservationFilters();setTraceNav('timeline');setTraceNav('calls');setTraceNav('tree')");assert.equal(ui.run('S.observationId'),target);assert.equal(ui.get('record-output').scrollTop,73);
});
test('metadata, exact metrics and scores retain trace/observation/session attribution', async () => {
  const ui=setup();await richTrace(ui);ui.run('selectTraceRoot();setTraceInspectView("scores")');
  assert.ok(ui.get('app').innerHTML.includes('response_quality'));assert.ok(ui.get('app').innerHTML.includes('세션 범위 점수'));assert.ok(!ui.get('app').innerHTML.includes('tool_result_valid'));
  ui.run('selectObservation(S.traceData.observations[3].id)');assert.ok(ui.get('app').innerHTML.includes('tool_result_valid'));assert.ok(!ui.get('app').innerHTML.includes('response_quality'));assert.ok(!ui.get('app').innerHTML.includes('session_review'));
  ui.run('selectObservation(S.traceData.observations[1].id);setTraceInspectView("metadata")');const html=ui.get('app').innerHTML;
  assert.ok(html.includes('temperature'));assert.ok(html.includes('원본 metadata'));assert.ok(html.includes('0.24s'));assert.ok(html.includes('356 tok'));
  ui.run('selectObservation(S.traceData.observations[2].id);setTraceInspectView("io")');assert.ok(ui.get('app').innerHTML.includes('TimeoutError'));assert.ok(ui.get('app').innerHTML.includes('관측 오류'));
});
test('formatted messages escape content and preserve raw-pane scroll separately by format', async () => {
  const ui=setup();await richTrace(ui);ui.run('selectObservation(S.traceData.observations[1].id)');ui.get('record-output').scrollTop=64;
  ui.run("setTraceFormat('formatted')");assert.equal(ui.get('record-output').scrollTop,0);assert.ok(ui.get('app').innerHTML.includes('payload-message'));ui.get('record-output').scrollTop=22;
  ui.run("setTraceFormat('json')");assert.equal(ui.get('record-output').scrollTop,64);ui.run("setTraceFormat('formatted')");assert.equal(ui.get('record-output').scrollTop,22);
  assert.ok(ui.run("formattedTraceValue({unsafe:'<img src=x onerror=alert(1)>'})").includes('&lt;img'));
});
test('chronological log opens exact observation and same-session action uses only KPAP list', async () => {
  const ui=setup();await richTrace(ui);ui.run('selectTraceRoot();setTraceInspectView("log")');const html=ui.get('app').innerHTML;
  const ids=ui.run('S.traceData.observations.map(o=>o.id)');assert.ok(html.indexOf(`id="log-${ids[0]}"`)<html.indexOf(`id="log-${ids[5]}"`));
  ui.run(`selectObservation('${ids[2]}')`);assert.equal(ui.run('TraceTools.view'),'io');assert.equal(ui.run('S.observationId'),ids[2]);
  const calls=ui.run('MockAPI.adapterStats.langfuseRequests');await ui.run('showSameSessionRuns()');assert.equal(ui.run('S.tracePage'),'list');assert.equal(ui.run('S.runList.sessionId'),'session-payments');assert.equal(ui.run('MockAPI.adapterStats.langfuseRequests'),calls);
});
test('partial observation paging keeps active filter and trace-root scope, no guessed total cost', async () => {
  const ui=setup();ui.run("navigate('trace')");await ui.run('loadRuns()');await ui.run("openRun('run-sample-observability')");
  ui.run('selectTraceRoot();setTraceInspectView("metadata");setObservationFilter("level","ERROR")');assert.equal(ui.run('S.traceData.observations.length'),2);
  await ui.run('loadSelectedRun(true)');assert.equal(ui.run('S.traceScope'),'trace');assert.equal(ui.run('TraceTools.level'),'ERROR');assert.equal(ui.run('TraceTools.view'),'metadata');assert.equal(ui.run('S.traceData.cost'),null);
  assert.ok(ui.get('app').innerHTML.includes('상위 문맥'));assert.equal(ui.run('TraceViews.metrics(S.traceData.observations[0]).cost'),.00031);
});

test('same-session navigation cancels pending detail fetch without late selection theft', async () => {
  const ui=setup();await richTrace(ui);const pending=ui.run('loadSelectedRun()');await ui.run('showSameSessionRuns()');await pending;
  assert.equal(ui.run('S.tracePage'),'list');assert.equal(ui.run('S.loading'),null);assert.equal(ui.run('S.runList.sessionId'),'session-payments');assert.equal(ui.run('document.activeElement.id'),'run-session');
});

test('graphless replay opens exact native observation without inventing a missing citation', async () => {
  const ui=setup();ui.run("navigate('trace')");await ui.run("selectRunSession('session-sdk')");await ui.run("openRun('run-sample-legacy')");
  ui.run('selectTraceRoot();replayStep(1)');assert.equal(ui.run('S.traceScope'),'observation');assert.equal(ui.run('S.selectedNodeId'),null);assert.ok(ui.get('trace-inspector').innerHTML.includes('입출력'));assert.ok(!ui.get('trace-inspector').innerHTML.includes('인용된 턴을 찾을 수 없습니다'));
  ui.run('selectTraceRoot();toggleReplay();Replay.pause()');assert.equal(ui.run('S.traceScope'),'observation');assert.equal(ui.run('S.evidenceContext'),null);
});
test('same unmapped exact observation remains the cited record after manual inspector switch', async () => {
  const ui=setup();await evaluated(ui,'unmapped');await ui.run("openEvidence(S.selectedEvaluationId,0,'b')");const cited=ui.run('S.observationId');assert.equal(ui.run('S.traceScope'),'conversation');
  ui.run(`selectObservation('${cited}')`);assert.equal(ui.run('S.traceScope'),'observation');assert.equal(ui.run('isCitedSelection()'),true);assert.equal(ui.run('S.selectedNodeId'),null);
});
