'use strict';
const M = PilotModel;
const S = { ...M.createState(MockAPI.baseline.prompt), tab: 'execute', node: 'query', editorOpen: false, case: null, scenario: 'pass', tracePage: 'list', traceEntry: 'browse', runSummary: null, traceAvailability: null, runList: { items: [], cursor: null, nextCursor: null, previous: [], sessionId: '', loaded: false, loading: false, error: null, job: 0, controller: null, view: { scroll: 0, focusId: 'view-heading' } }, traceData: null, traceId: null, observationId: null, graph: true, tracePanelOpen: true, traceNav: 'flow', traceScope: 'observation', selectedNodeId: null, turnId: null, conversationScope: 'session', mappingNote: null, evalPage: 'home', definitions: MockAPI.definitions.map(M.immutable), definitionSequence: 0, judgeSequence: 0, selectedDefinitionId: MockAPI.definitions[0].id, datasets: JSON.parse(JSON.stringify(MockAPI.datasets)), selectedDatasetId: MockAPI.datasets[0].id, definitionDraft: null, evalHomeView: { scroll: 0, focusId: 'view-heading' }, evalSetupOpen: false, evalDetailsOpen: {}, evalHistoryOpen: false, origin: null, evidenceContext: null, loading: null, error: null, job: 0, controller: null, reviews: {}, unmappedRecordsOpen: new Set() };
const viewState = { execute: { scroll: 0 }, evaluate: { scroll: 0 }, trace: { scroll: 0 } };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
const paths = { panel: 'M3 4h18v16H3zM9 4v16', chevronUp: 'm6 15 6-6 6 6', chevronDown: 'm6 9 6 6 6-6', chevronRight: 'm9 6 6 6-6 6', arrow: 'M5 12h14m-5-5 5 5-5 5', back: 'm14 6-6 6 6 6', check: 'm5 12 4 4L19 6', flow: 'M5 5h5v5H5zM14 14h5v5h-5zM10 7h7v7M7 10v7h7', spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z', close: 'm6 6 12 12M6 18 18 6', info: 'M12 11v6M12 7v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', play: 'm8 5 11 7-11 7Z', doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7' };
function icon(n, size = 16) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n] || paths.flow}"/></svg>`; }
function btn(text, action, cls = '', disabled = false, id = '') { return `<button ${id ? `id="${esc(id)}"` : ''} class="${cls}" onclick="${esc(action)}" ${disabled ? 'disabled' : ''}>${text}</button>`; }
function pill(text, cls = '') { return `<span class="pill ${cls}">${esc(text)}</span>`; }
function currentResult() { return S.evaluations.find(e => e.id === S.selectedEvaluationId) || null; }
function currentObservation() { return S.traceData?.observations.find(o => o.id === S.observationId) || null; }

// Motion is presentation-only: state/focus never wait for an animation to finish.
const Motion = {
  active: new Set(),
  reduced() { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; },
  cancel() { for (const animation of this.active) animation.cancel(); this.active.clear(); },
  capture() { const id = S.tab === 'trace' ? 'trace-workspace' : 'execution-workspace'; const el = $(id); return { id, columns: el && window.getComputedStyle ? window.getComputedStyle(el).gridTemplateColumns : null, setupHeight: $('evaluation-setup')?.getBoundingClientRect?.().height || 0 }; },
  animate(el, frames, duration = 180) {
    if (!el?.animate || this.reduced()) return;
    const animation = el.animate(frames, { duration, easing: 'cubic-bezier(.22,.68,0,1)' });
    this.active.add(animation); animation.onfinish = () => this.active.delete(animation); animation.oncancel = () => this.active.delete(animation);
  },
  play(kind, previous) {
    if (!kind || this.reduced()) return;
    if (kind === 'panel') {
      const layout = $(previous.id), next = layout && window.getComputedStyle ? window.getComputedStyle(layout).gridTemplateColumns : null;
      if (previous.columns && next && previous.columns !== next) this.animate(layout, [{ gridTemplateColumns: previous.columns }, { gridTemplateColumns: next }], 230);
      this.animate(S.tab === 'trace' ? $('trace-nav-content') : $('editor-panel'), [{ opacity: .2, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'translateX(0)' }], 200);
    } else if (kind === 'setup') {
      const target = $('evaluation-setup'), height = target?.getBoundingClientRect?.().height || 0;
      this.animate(target, [{ height: `${previous.setupHeight}px`, opacity: .4 }, { height: `${height}px`, opacity: 1 }], 200);
    } else {
      const target = kind === 'inspector' ? $('trace-inspector') : kind === 'navigator' ? $('trace-nav-content') : kind === 'setup' ? $('evaluation-setup') : $('view-content');
      const x = kind === 'inspector' ? 5 : 0, y = kind === 'view' || kind === 'evidence' ? 5 : 0;
      this.animate(target, [{ opacity: .35, transform: `translate(${x}px,${y}px)` }, { opacity: 1, transform: 'translate(0,0)' }], kind === 'evidence' ? 210 : 170);
    }
  }
};
// Replay owns a historical cursor only; selecting/playing never invokes A2A or Langfuse.
const Replay = TraceReplay.createController({
  isCurrent(model) { return !!model && S.tab === 'trace' && S.tracePage === 'detail' && S.traceData?.traceId === model.traceId && !S.loading && !S.error; },
  onUpdate: replayUpdated
});
function replayModel() { return TraceReplay.build(S.traceData); }
function replaySnapshot() {
  const model = replayModel();
  if (Replay.state.model?.key === model.key) return Replay.snapshot();
  const row = model.rows.find(r => r.id === S.observationId) || model.rows[0], position = row?.start ?? null;
  return { model, position, selectionId: row?.id || null, playing: false, speed: Replay.state.speed, ...TraceReplay.frame(model, position, row?.id) };
}
function syncReplay() {
  if (S.tab !== 'trace' || S.tracePage !== 'detail' || !S.traceData || S.loading || S.error) { Replay.pause(false); return; }
  const model = replayModel();
  if (Replay.state.model?.key !== model.key) {
    const old = Replay.state, sameSelection = old.model?.traceId === model.traceId && old.selectionId === S.observationId;
    const position = sameSelection && old.position !== null && old.model.origin !== null && model.origin !== null ? old.model.origin + old.position - model.origin : undefined;
    Replay.load(model, S.observationId, position);
  }
  else if (!Replay.state.playing && S.observationId && Replay.state.selectionId !== S.observationId) Replay.select(S.observationId);
  paintReplay(Replay.snapshot());
}
function replayLabel(snapshot) {
  if (!snapshot.model.playable) return '시각 불완전 · 수동 탐색';
  if (snapshot.playing) return '재생 중';
  return snapshot.position >= snapshot.model.duration ? '조회 범위 재생 끝' : '일시정지';
}
function replayMarkup(trace) {
  if (!trace.observations.length) return '';
  const snapshot = replaySnapshot(), model = snapshot.model, index = model.rows.findIndex(r => r.id === snapshot.selectionId);
  return `<section class="replay-console" aria-label="과거 기록 재생"><div class="replay-controls"><div class="replay-heading"><strong>기록 재생</strong><span>과거 기록 · 실시간 실행 아님</span></div><div class="replay-buttons">${btn(icon('back', 13), 'replayStep(-1)', '', index <= 0, 'replay-previous')}${btn(icon('play', 12) + ' 재생', 'toggleReplay()', 'primary', !model.playable || !!S.loading, 'replay-play')}${btn(icon('chevronRight', 13), 'replayStep(1)', '', index >= model.rows.length - 1, 'replay-next')}</div><label class="replay-speed">속도<select id="replay-speed" aria-label="기록 재생 속도" onchange="setReplaySpeed(this.value)">${[.5, 1, 2].map(value => `<option value="${value}" ${snapshot.speed === value ? 'selected' : ''}>${value}×</option>`).join('')}</select></label><span id="replay-time" class="replay-time"></span>${model.partialPage ? btn('남은 관측 조회', 'loadSelectedRun(true)', 'quiet', !!S.loading, 'replay-load-more') : ''}</div><div class="replay-track" aria-hidden="true"><span id="replay-progress"></span></div><div class="replay-foot"><span id="replay-state"></span><span id="replay-selection"></span><span class="spacer"></span><span>${model.partialPage ? '조회된 범위만 재생' : '조회된 관측 기준'} · I/O는 저장 기록${model.untimed || model.unknownEnd ? ' · 일부 시각 미확인' : ''}${!trace.design ? ' · 플로우 매핑 없음' : ''}</span></div><div id="replay-active" class="replay-active" aria-label="해당 시각의 관측"></div></section>`;
}
function toggleReplay() { if (Replay.state.playing) Replay.pause(); else Replay.play(); }
function replayStep(direction) { Replay.step(direction); }
function setReplaySpeed(value) { Replay.speed(value); }
function stopReplay() { Replay.pause(false); }
function replayUpdated(snapshot, reason) {
  if (S.tab !== 'trace' || S.tracePage !== 'detail' || !S.traceData || S.traceData.traceId !== snapshot.model?.traceId) return;
  if (snapshot.selectionId && snapshot.selectionId !== S.observationId && reason !== 'load') {
    rememberRecordScroll(); const focusId = document.activeElement?.id;
    const resolved = M.resolveEvidence(S.traceData, { observationId: snapshot.selectionId });
    S.observationId = resolved.observationId; S.traceScope = resolved.scope; S.selectedNodeId = resolved.nodeId; S.turnId = resolved.turnId; S.conversationScope = resolved.conversationScope; S.mappingNote = resolved.reason;
    if (resolved.scope === 'conversation' && resolved.observationId) S.unmappedRecordsOpen.add(traceSelectionKey());
    if ($('trace-inspector')) $('trace-inspector').innerHTML = inspector(S.traceData);
    if ($('trace-nav-content')) $('trace-nav-content').innerHTML = traceNavigationContent(S.traceData);
    if ($('trace-evidence-banner')) $('trace-evidence-banner').innerHTML = evidenceBanner();
    restoreRecordScroll(); if (focusId) $(focusId)?.focus({ preventScroll: true });
  }
  paintReplay(snapshot);
}
function paintReplay(snapshot) {
  const model = snapshot.model; if (!model || !$('replay-play')) return;
  const index = model.rows.findIndex(r => r.id === snapshot.selectionId), setText = (id, text) => { if ($(id)) $(id).textContent = text; };
  const play = $('replay-play'); play.innerHTML = snapshot.playing ? '<span class="pause-symbol" aria-hidden="true">Ⅱ</span> 일시정지' : icon('play', 12) + (snapshot.position >= model.duration && model.playable ? ' 다시 재생' : ' 재생');
  play.disabled = !model.playable || !!S.loading; play.setAttribute?.('aria-label', snapshot.playing ? '기록 재생 일시정지' : '과거 기록 재생');
  $('replay-previous').disabled = index <= 0; $('replay-previous').setAttribute?.('aria-label', '이전 관측');
  $('replay-next').disabled = index >= model.rows.length - 1; $('replay-next').setAttribute?.('aria-label', '다음 관측');
  setText('replay-time', snapshot.position === null ? '시각 없음' : `${(snapshot.position / 1000).toFixed(1)} / ${(model.duration / 1000).toFixed(1)}s`);
  setText('replay-state', replayLabel(snapshot)); setText('replay-selection', `관측 ${Math.max(0, index + 1)} / ${model.rows.length}${snapshot.selected?.invocation ? ` · 수행 #${snapshot.selected.invocation}` : ''}`);
  $('replay-progress')?.style.setProperty?.('--replay-progress', `${model.duration ? (snapshot.position || 0) / model.duration * 100 : 0}%`);
  const rows = [...snapshot.active.map(row => ({ row, unknown: false })), ...snapshot.unbounded.map(row => ({ row, unknown: true }))];
  const key = rows.map(({row, unknown}) => `${row.id}:${unknown}`).join('|');
  if ($('replay-active') && $('replay-active').dataset?.key !== key) {
    const activeFocus = document.activeElement?.id;
    $('replay-active').innerHTML = rows.length ? `<span>${snapshot.active.length > 1 ? `동시 관측 ${snapshot.active.length}` : snapshot.active.length ? '기록 구간' : '종료 미확인'}</span>${rows.map(({row, unknown}) => `<button id="replay-observation-${row.id}" class="${unknown ? 'unknown-interval' : ''}" onclick="selectObservation('${row.id}')">${esc(row.observation.name)}${row.invocation ? ` · 수행 #${row.invocation}` : ''}${row.observation.attemptId ? ` · ${esc(row.observation.attemptId)}` : ''}${unknown ? ' · 종료 시각 미확인' : ''}</button>`).join('')}` : '<span>이 시각의 확인된 진행 구간 없음</span>';
    if ($('replay-active').dataset) $('replay-active').dataset.key = key;
    if (activeFocus?.startsWith('replay-observation-')) ($(activeFocus) || $('replay-play'))?.focus({ preventScroll: true });
  }
  const toggle = (element, name, on) => { if (element) element.classList[on ? 'add' : 'remove'](name); };
  toggle($('nav-conversation'), 'selected', S.traceScope === 'conversation'); $('nav-conversation')?.setAttribute?.('aria-pressed', String(S.traceScope === 'conversation'));
  for (const node of S.traceData?.design?.nodes || []) {
    const active = snapshot.active.filter(row => row.observation.ownerNodeId === node.id), unknown = snapshot.unbounded.some(row => row.observation.ownerNodeId === node.id);
    const element = $(`historic-${node.id}`); toggle(element, 'replay-running', active.length > 0); toggle(element, 'replay-unbounded', unknown); toggle(element, 'replay-pulse', snapshot.playing && active.length > 0 && !Motion.reduced());
    element?.setAttribute?.('data-replay-active', String(active.length));
    const badge = $(`replay-node-${node.id}`); if (badge) { badge.textContent = active.length ? `기록 구간 ${active.length}` : unknown ? '종료 미확인' : ''; badge.hidden = !active.length && !unknown; }
  }
  for (const row of model.rows) { toggle($(`observation-${row.id}`), 'replay-running', snapshot.active.some(active => active.id === row.id)); toggle($(`observation-${row.id}`), 'replay-unbounded', snapshot.unbounded.some(active => active.id === row.id)); }
  for (const edge of S.traceData?.design?.edges || []) {
    const element = $(`design-edge-${edge.from}-${edge.to}`), recorded = snapshot.transitions.some(t => t.from === edge.from && t.to === edge.to);
    toggle(element, 'recorded-transition', recorded); toggle(element, 'transition-motion', recorded && snapshot.playing && !Motion.reduced());
    element?.setAttribute?.('aria-label', recorded ? '명시된 실제 전이' : '설계 연결');
  }
}

const recordScroll = new Map(), navigationScroll = new Map();
let renderedTraceKey = null, renderedNavKey = null;
function traceSelectionKey() { return S.traceData ? `${S.traceData.traceId}:${S.traceScope}:${S.observationId || S.turnId || S.selectedNodeId || 'conversation'}` : null; }
function rememberRecordScroll() {
  if (renderedTraceKey) recordScroll.set(renderedTraceKey, { input: $('record-input')?.scrollTop || 0, output: $('record-output')?.scrollTop || 0 });
  if (renderedNavKey) navigationScroll.set(renderedNavKey, $('trace-nav-scroll')?.scrollTop || 0);
}
function restoreRecordScroll() {
  renderedTraceKey = S.tab === 'trace' && S.tracePage === 'detail' && !(S.loading === 'trace' && !S.traceRequestMore) && !(S.error?.kind === 'trace' && !S.traceRequestMore) ? traceSelectionKey() : null;
  renderedNavKey = S.tab === 'trace' && S.tracePage === 'detail' && S.traceData && !(S.loading === 'trace' && !S.traceRequestMore) && !(S.error?.kind === 'trace' && !S.traceRequestMore) ? `${S.traceData.traceId}:${S.traceNav}` : null;
  const saved = recordScroll.get(renderedTraceKey);
  if ($('record-input')) $('record-input').scrollTop = saved?.input || 0;
  if ($('record-output')) $('record-output').scrollTop = saved?.output || 0;
  if ($('trace-nav-scroll')) $('trace-nav-scroll').scrollTop = navigationScroll.get(renderedNavKey) || 0;
}

function candidateState() { return M.isEvaluated(S) ? '평가본 · 고정' : M.isDirty(S) ? '초안 · 미저장' : '저장본 · 미평가'; }
function saveView() { const activeId = document.activeElement?.id; viewState[S.tab] = { scroll: window.scrollY || 0, focusId: activeId?.startsWith('tab-') ? viewState[S.tab].focusId || null : activeId || null }; }
function focusTarget(id) { const target = $(id); (target && !target.disabled && !target.closest?.('[inert]') ? target : $('view-heading'))?.focus({ preventScroll: true }); }
function setRoute(tab, replace = false) { if (window.history) window.history[replace ? 'replaceState' : 'pushState']({ tab }, '', `#${tab}`); }
function navigate(tab, options = {}) { stopReplay();
  if (!['execute', 'evaluate', 'trace'].includes(tab)) return;
  if (tab === S.tab && !options.restore && !options.pop) { focusTarget(`tab-${tab}`); return; }
  saveView(); closeModal(false); S.tab = tab; if (!options.pop) setRoute(tab);
  render('view'); const destination = options.restore || viewState[tab];
  window.scrollTo({ top: destination.scroll || 0, behavior: 'instant' });
  focusTarget(options.restore ? destination.focusId || 'view-heading' : `tab-${tab}`);
  if (tab === 'trace' && S.tracePage === 'list' && !S.runList.loaded && !S.runList.loading) loadRuns();
}
function contextMarkup() {
  if (S.tab === 'trace') return '<div class="context"><span>KPAP 실행 기록 · Langfuse 관측</span><span class="spacer"></span><span class="mock-state">v3 어댑터 Mock · 실제 미연결</span></div>';
  if (S.tab === 'evaluate') return '<div class="context evaluation-global-context"><span>평가 워크스페이스</span><span class="spacer"></span><span class="mock-state">Mock · 조건 미검증</span></div>';
  const recent = currentResult();
  return `<div class="context">${pill('A · v12')}${pill(`${S.draft.label} · ${candidateState()}`, M.isDirty(S) ? 'blue' : '')}${recent && recent.candidate.label !== S.draft.label ? pill(`표시 결과 · ${recent.candidate.label}`) : ''}<span class="spacer"></span><span class="mock-state">Mock · 실제 실행 없음</span></div>`;
}
function render(animate = false) {
  const focusId = document.activeElement?.id, previous = Motion.capture();
  rememberRecordScroll(); Motion.cancel();
  $('tabs').style.setProperty?.('--tab-index', ['execute', 'evaluate', 'trace'].indexOf(S.tab));
  $('tabs').innerHTML = ['execute', 'evaluate', 'trace'].map((t, i) => `<button id="tab-${t}" class="${S.tab === t ? 'active' : ''}" aria-current="${S.tab === t ? 'page' : 'false'}" onclick="navigate('${t}')">${['실행', '평가', '추적'][i]}</button>`).join('');
  $('context').innerHTML = contextMarkup();
  $('app').innerHTML = `<div id="view-content">${S.tab === 'execute' ? execution() : S.tab === 'evaluate' ? evaluation() : tracing()}</div>`;
  restoreRecordScroll();
  if (focusId) $(focusId)?.focus({ preventScroll: true });
  Motion.play(animate === true ? 'view' : animate, previous);
  syncReplay();
}
function titlebar(title, subtitle, actions = '') { return `<div class="titlebar compact-title"><div><h1 id="view-heading" tabindex="-1">${title}</h1><div class="subtitle">${subtitle}</div></div><div class="actions">${actions}</div></div>`; }
function graph(historical = false) {
  const selected = historical ? currentObservation()?.ownerNodeId : `node_${S.node === 'query' ? 'payment_query' : S.node}`;
  const nodes = [['start', '시작', '사용자 메시지', ''], ['query', '결제 조회 에이전트', 'payments.search 사용', 'purple'], ['answer', '답변 생성', 'GPT-4.1 mini', 'rose']];
  return `<section class="flow-panel" aria-label="에이전트 흐름"><div class="flow-panel-heading"><strong>흐름</strong><span>${historical ? '읽기 전용' : '설계 · flow-v7'}</span></div><div class="canvas"><div class="canvas-label">${historical ? '기록에 연결된 설계 · flow-v7' : '에이전트 플로우'}</div>${nodes.map((a, i) => {
    const nodeId = `node_${a[0] === 'query' ? 'payment_query' : a[0]}`;
    return `${i ? '<div class="edge"></div>' : ''}<button id="${historical ? 'historic' : 'edit'}-${a[0]}" class="node ${a[3]} ${selected === nodeId ? 'selected' : ''}" onclick="${historical ? `selectNodeOccurrence('${nodeId}')` : `selectNode('${a[0]}')`}"><span class="node-head">${icon(i === 0 ? 'play' : i === 1 ? 'flow' : 'spark', 15)}${a[1]}</span><small>${a[2]}</small></button>`;
  }).join('')}<div class="canvas-caption">${historical ? '설계 연결 · 실제 호출 순서는 기록에서 확인' : '노드를 선택하면 설정이 열립니다'}</div></div></section>`;
}
function execution() {
  return `${titlebar('실행', '원본 A를 보며 후보 설정을 편집합니다.', btn('평가 준비 ' + icon('arrow', 13), "navigate('evaluate')", 'primary', false, 'go-evaluate'))}<div id="execution-workspace" class="work-grid ${S.editorOpen ? 'with-editor' : 'without-editor'}">${graph()}<section class="panel chat-panel"><div class="panel-title">실행 기록 ${pill('A · v12 · 읽기 전용')}</div><div class="bubble user"><small>사용자</small>${esc(MockAPI.fixture.input)}</div><div class="bubble assistant"><span class="chat-avatar" aria-hidden="true">${icon('spark', 14)}</span><small>CS 에이전트 · A</small><div class="response">${esc(MockAPI.original.text)}</div><div class="bubble-footer"><span class="tiny">고정 예시 기록</span>${btn('응답 추적 ' + icon('arrow', 12), 'openOriginalTrace()', 'quiet', false, 'original-trace')}</div></div><div class="record-note">${icon('info', 14)}<span>설정을 바꿔도 이 대화는 바뀌지 않습니다.<br>후보 결과는 평가 탭에서 별도로 확인하세요.</span></div><div class="composer"><span>Mock · 새 대화 실행은 연결되지 않았습니다</span>${icon('play', 13)}</div></section>${S.editorOpen ? `<section id="editor-panel" class="panel editor">${editor()}</section>` : ''}</div>`;
}
function selectNode(node) { S.node = node; S.editorOpen = true; render('panel'); focusTarget('node-prompt'); }
function closeEditor() { S.editorOpen = false; render('panel'); focusTarget(`edit-${S.node}`); }
function editor() {
  const locked = M.isEvaluated(S), query = S.node === 'query';
  return `<div class="panel-title"><span>${query ? '결제 조회 에이전트' : S.node === 'answer' ? '답변 생성' : '시작'}</span>${btn(icon('close', 15) + '<span class="sr-only">설정 닫기</span>', 'closeEditor()', 'quiet', false, 'close-editor')}</div>${query ? `<div class="editor-identity" id="editor-identity">${pill(`${S.draft.label} · ${candidateState()}`, locked ? '' : 'purple')}</div><div class="field">모델<div class="actions field-value">${pill('GPT-4.1 mini')}</div></div><label class="field">노드 프롬프트<textarea id="node-prompt" aria-label="노드 프롬프트" ${locked || S.loading === 'compare' ? 'readonly' : ''} oninput="editPrompt(this.value)">${esc(S.draft.prompt)}</textarea></label><div class="field">도구 · 지식<div class="actions field-value">${pill('payments.search')}${pill('결제 조회 정책 v3')}</div></div><p class="tiny">도구 호출을 생성하는 에이전트 설정입니다.<br>이 파일럿에서는 프롬프트만 편집합니다.</p><div class="editor-bottom"><span id="dirty" class="tiny">${locked ? '평가에 사용된 설정 · 변경 불가' : M.isDirty(S) ? '미저장 변경 · 평가에 반영되지 않음' : '저장됨 · 미배포'}</span>${locked ? btn('다음 초안', 'nextDraft()', 'primary', !!S.loading, 'next-draft-editor') : btn(`${S.draft.label} 저장`, 'saveDraft()', 'primary', !!S.loading, 'save-draft')}</div>` : `<p class="muted">${S.node === 'answer' ? '조회 결과를 자연어로 안내하는 노드입니다.' : '사용자 메시지를 플로우에 전달합니다.'}</p><p class="tiny">이 예시에서 편집 가능한 설정은 조회 에이전트의 프롬프트입니다.</p>${btn('조회 에이전트 설정', "selectNode('query')", 'quiet')}`}`;
}
function editPrompt(text) {
  if (S.loading === 'compare') return toast('비교 중인 설정은 수정할 수 없습니다. 완료 또는 취소 후 편집해 주세요.');
  try { M.editDraft(S, text); } catch (error) { toast(error.message); return; }
  $('context').innerHTML = contextMarkup();
  if ($('editor-identity')) $('editor-identity').innerHTML = pill(`${S.draft.label} · ${candidateState()}`, 'purple');
  if ($('dirty')) $('dirty').textContent = M.isDirty(S) ? '미저장 변경 · 평가에 반영되지 않음' : '저장됨 · 미배포';
}
function saveDraft() {
  if (S.loading) return toast('요청이 끝난 뒤 저장해 주세요. 초안은 유지됩니다.');
  try { M.saveDraft(S); render(); toast(`${S.saved.label} 저장 완료 · 운영 적용 아님`); } catch (error) { toast(error.message); }
}
function nextDraft() {
  if (S.loading) return;
  if (!M.isEvaluated(S)) { navigate('execute'); selectNode('query'); toast(`${S.draft.label} 초안을 계속 편집하세요.`); return; }
  try { M.createNextDraft(S, S.selectedEvaluationId); S.node = 'query'; S.editorOpen = true; S.evalSetupOpen = true; S.evalPage = 'home'; navigate('execute'); focusTarget('node-prompt'); toast(`${S.draft.label} 초안을 만들었어요. 이전 평가본은 유지됩니다.`); } catch (error) { toast(error.message); }
}
function selectedDefinition() { return S.definitions.find(d => d.id === S.selectedDefinitionId) || null; }
function selectedDataset() { return S.datasets.find(d => d.id === S.selectedDatasetId) || null; }
function evaluation() { return S.evalPage === 'detail' && currentResult() ? evaluationDetail() : evaluationHome(); }
function showEvaluationHome() {
  S.evalPage = 'home'; S.error = null; render('view');
  window.scrollTo({ top: S.evalHomeView.scroll || 0, behavior: 'instant' }); focusTarget(S.evalHomeView.focusId || 'view-heading');
}
function openEvaluationResult(id, triggerId = 'view-heading') {
  if (!S.evaluations.some(e => e.id === id)) return;
  if (S.evalPage === 'home') S.evalHomeView = { scroll: window.scrollY || 0, focusId: triggerId };
  S.selectedEvaluationId = id; S.evalPage = 'detail'; S.evalSetupOpen = false; render('view'); window.scrollTo({ top: 0, behavior: 'instant' }); focusTarget('result-heading');
}
function selectDefinition(id) { if (S.loading) return; S.selectedDefinitionId = id; render(); focusTarget('definition-select'); }
function selectDataset(id) {
  if (S.loading) return;
  S.selectedDatasetId = id; S.case = selectedDataset()?.cases[0] || null; render(); focusTarget('dataset-select');
}
function readiness() {
  if (!selectedDefinition()) return '평가 정의를 선택해 주세요';
  if (!selectedDataset()) return '데이터셋을 선택해 주세요';
  if (!S.case) return '데이터셋에 케이스를 추가해 주세요';
  if (M.isEvaluated(S)) return '다음 후보를 만들어 다시 평가하세요';
  if (M.isDirty(S)) return `${S.draft.label} 후보를 저장해 주세요`;
  return `${selectedDefinition().criteria.length}개 기준 · 1케이스 · A와 ${S.saved.label} 비교`;
}
function evaluationHome() {
  const definition = selectedDefinition(), dataset = selectedDataset(), locked = M.isEvaluated(S), busy = !!S.loading;
  const ready = !!definition && !!dataset && !!S.case && !M.isDirty(S) && !locked;
  const runs = S.evaluations.slice().reverse();
  return `${titlebar('평가', '', btn('평가 정의 만들기', 'definitionModal()', '', busy, 'new-definition'))}<div class="content evaluation-home"><section class="evaluation-launch" aria-labelledby="launch-heading"><div class="launch-heading"><h2 id="launch-heading">새 평가 실행</h2><span>데이터셋 → 정의 → 실행</span></div><div class="launch-grid"><article class="launch-step"><div class="step-heading"><span>01</span><h3>데이터셋</h3>${btn('케이스 보기', 'datasetCases()', 'quiet', !dataset || busy, 'dataset-cases')}</div><label class="sr-only" for="dataset-select">데이터셋 선택</label><select id="dataset-select" onchange="selectDataset(this.value)" ${busy ? 'disabled' : ''}>${!dataset ? '<option value="">데이터셋을 선택하세요</option>' : ''}${S.datasets.map(d => `<option value="${d.id}" ${d.id === dataset?.id ? 'selected' : ''}>${esc(d.name)} · ${d.cases.length}케이스</option>`).join('')}</select><div class="step-meta">${dataset?.cases.length ? '기대값 확인됨 · 고정 예시 1개' : btn('+ 현재 세션에서 추가', 'caseModal()', 'quiet inline-add', busy, 'save-case')}</div>${btn('데이터셋 관리 ' + icon('arrow', 11), "managerHandoff('dataset')", 'quiet integration-link', busy, 'dataset-manager')}</article><article class="launch-step"><div class="step-heading"><span>02</span><h3>평가 정의</h3>${btn('편집', 'definitionModal(S.selectedDefinitionId)', 'quiet', !definition || busy, 'edit-definition')}</div><label class="sr-only" for="definition-select">평가 정의 선택</label><select id="definition-select" onchange="selectDefinition(this.value)" ${busy ? 'disabled' : ''}>${!definition ? '<option value="">정의를 선택하세요</option>' : ''}${S.definitions.map(d => `<option value="${d.id}" ${d.id === definition?.id ? 'selected' : ''}>${esc(d.name)} · r${d.revision}</option>`).join('')}</select><p class="step-meta">${definition ? `${definition.criteria.length}개 기준 · ${esc(definition.judge.name)}` : '정의를 만들면 반복해서 사용할 수 있습니다'}</p>${btn('기존 Judge 관리 ' + icon('arrow', 11), "managerHandoff('judge')", 'quiet integration-link', busy, 'judge-manager')}</article><article class="launch-step"><div class="step-heading"><span>03</span><h3>실행 대상</h3>${btn('편집', "navigate('execute');selectNode('query')", 'quiet', busy, 'edit-candidate')}</div><div class="target-identity">${pill('A · v12')}${icon('arrow', 12)}${pill(`${S.draft.label} · ${candidateState()}`, M.isDirty(S) ? 'blue' : '')}</div><p class="step-meta">${S.saved ? esc(S.saved.id) : '현재 후보 · 저장 후 평가 가능'}</p>${locked ? btn('다음 후보 만들기', 'nextDraft()', 'quiet integration-link', busy, 'home-next-draft') : M.isDirty(S) ? btn(`${S.draft.label} 저장`, 'saveDraft()', 'quiet integration-link', busy, 'home-save-candidate') : '<span class="candidate-ready">저장한 설정으로 실행</span>'}</article></div><div class="launch-footer"><div><span class="readiness ${ready ? 'ready' : ''}">${ready ? icon('check', 13) : icon('info', 13)}${esc(readiness())}</span>${btn('Mock 예시 · ' + esc(MockAPI.scenarios[S.scenario]), 'compareDetails()', 'quiet mock-scenario', busy, 'compare-details')}</div>${btn(S.loading === 'compare' ? '<span class="spin"></span> 평가 중' : '평가 실행 ' + icon('play', 12), 'compare()', 'primary', busy || !ready, 'start-compare')}</div></section>${S.error?.kind === 'compare' ? errorView() : S.loading === 'compare' ? `<section class="card loading-card"><div class="actions"><span class="spin"></span>${esc(S.saved.label)} 평가 중<span class="spacer"></span>${btn('취소', 'cancelRequest()', 'quiet', false, 'cancel-compare')}</div><div class="progress"></div></section>` : ''}<section class="evaluation-recent" aria-labelledby="recent-heading"><div class="recent-heading"><h2 id="recent-heading">실행 이력</h2><span>${runs.length}건</span></div>${runs.length ? `<div class="run-list">${runs.map(result => { const c = M.countStatuses(result, 'b'); return `<button id="open-${result.id}" class="run-row" onclick="openEvaluationResult('${result.id}','open-${result.id}')"><span><strong>${esc(result.definition?.name || '결제 응답 검증')}</strong><small>r${result.definition?.revision || 1} · ${esc(result.dataset?.name || '고정 예시')} · 1케이스</small></span><span class="run-pair">A → ${esc(result.candidate.label)}</span><span class="run-statuses">${['FAIL', 'UNJUDGEABLE', 'JUDGE_ERROR', 'PASS'].filter(key => c[key]).map(key => pill(`${M.LABELS[key]} ${c[key]}`, key === 'PASS' ? 'green' : key === 'UNJUDGEABLE' ? 'amber' : 'red')).join('')}</span>${icon('arrow', 14)}</button>`; }).join('')}</div>` : '<div class="empty-runs">아직 실행한 평가가 없습니다.<span>위에서 데이터셋과 평가 정의를 선택해 시작하세요.</span></div>'}</section><div class="workspace-footnote">Mock 작업공간 · 관리자 연동 전 · 새로고침 시 초기화</div></div>`;
}
function definitionModal(id = null, preserve = false) {
  if (S.loading) return;
  if (!preserve) { const existing = S.definitions.find(d => d.id === id); S.definitionDraft = existing ? JSON.parse(JSON.stringify(existing)) : { name: '', criteria: M.CRITERIA.map(c => c.id), judge: JSON.parse(JSON.stringify(MockAPI.judges[0])) }; }
  const draft = S.definitionDraft;
  modal(draft.id ? '평가 정의 편집' : '평가 정의 만들기', `<label class="field">이름<input id="definition-name" maxlength="60" value="${esc(draft.name)}" oninput="S.definitionDraft.name=this.value" placeholder="예: 결제 응답 검증"></label><fieldset class="definition-criteria"><legend>평가 기준</legend>${M.CRITERIA.map(c => `<label class="check-label"><input id="criterion-${c.id}" type="checkbox" ${draft.criteria.includes(c.id) ? 'checked' : ''} onchange="toggleDefinitionCriterion('${c.id}',this.checked)">${esc(c.name)}</label>`).join('')}</fieldset><div class="field"><span>Judge 설정</span><div class="judge-reference"><div><strong>${esc(draft.judge.name)} · ${esc(draft.judge.version)}</strong><small>${esc(draft.judge.model)}</small></div>${btn('기존 설정 선택', "managerHandoff('judge',true)", 'quiet', false, 'pick-judge')}</div></div><details class="judge-options"><summary>판정 지침 편집 · Mock 사본</summary><label class="field"><span class="sr-only">Judge 판정 지침</span><textarea id="definition-rubric" oninput="S.definitionDraft.judge.rubric=this.value">${esc(draft.judge.rubric)}</textarea></label></details><p class="tiny">${draft.id ? '저장 시 새 리비전 · 이전 실행의 정의는 유지됩니다.' : '저장하면 평가 홈에서 재사용할 수 있습니다.'} 실제 Judge 설정은 변경되지 않습니다.</p><div id="definition-error" role="alert"></div><div class="actions">${btn('취소', 'closeModal()', '', false, 'cancel-definition')}${btn('정의 저장', 'storeDefinition()', 'primary', false, 'save-definition')}</div>`);
  focusTarget('definition-name');
}
function toggleDefinitionCriterion(id, checked) { const values = new Set(S.definitionDraft.criteria); checked ? values.add(id) : values.delete(id); S.definitionDraft.criteria = [...values]; }
function storeDefinition() {
  if (S.loading) return;
  try {
    const draft = S.definitionDraft, previous = S.definitions.find(d => d.id === draft.id)?.judge, base = previous?.id === draft.judge.id ? previous : MockAPI.judges.find(j => j.id === draft.judge.id);
    if (base && draft.judge.rubric !== base.rubric) draft.judge = { ...draft.judge, sourceId: base.sourceId || base.id, id: `mock-judge-${++S.judgeSequence}`, version: '1', name: `${base.name.replace(/ · 사본$/, '')} · 사본` };
    const definition = M.saveDefinition(S, draft); S.definitionDraft = null; closeModal(false); render('view'); focusTarget('definition-select'); toast(`${definition.name} · r${definition.revision} 저장됨`);
  } catch (error) { $('definition-error').innerHTML = `<p class="form-error">${esc(error.message)}</p>`; }
}
function datasetCases() {
  const dataset = selectedDataset(); if (!dataset) return managerHandoff('dataset');
  modal(`${dataset.name} · 케이스`, `${dataset.cases.length ? `<div class="selection"><strong>취소 제외 · 월 결제 합계</strong><p>${esc(MockAPI.fixture.input)}</p><div class="divider"></div>기대값 <strong>50,000원</strong><p class="tiny">${esc(dataset.cases[0].id)} · ${esc(dataset.cases[0].fixtureVersion)}<br>확인된 고정 예시 · 원본 응답과 정답을 분리합니다.</p></div>` : '<div class="empty-panel">케이스가 없습니다.<p>현재 세션의 요청과 기대값을 확인해 추가하세요.</p></div>'}<p class="tiny">실제 목록·편집은 기존 데이터셋 관리자에 연결할 영역입니다.</p><div class="actions">${btn('데이터셋 관리', "managerHandoff('dataset')", '', false, 'cases-manager')}${dataset.cases.length ? btn('닫기', 'closeModal()', 'primary') : btn('현재 세션에서 추가', 'caseModal()', 'primary', false, 'empty-add-case')}</div>`);
}
function managerHandoff(kind, fromDefinition = false) {
  if (S.loading) return;
  S.managerKind = kind; S.managerFromDefinition = fromDefinition;
  const judge = kind === 'judge';
  modal(judge ? '기존 Judge 관리' : '기존 데이터셋 관리', `<div class="integration-state">${pill('실제 관리자 미연결', 'amber')}<p>아래는 기존 관리자에서 선택 후 돌아오는 Mock입니다.</p></div><label class="field">${judge ? 'Judge 설정' : '데이터셋'}<select id="manager-selection">${(judge ? MockAPI.judges : S.datasets).map(item => `<option value="${item.id}" ${item.id === (judge ? (fromDefinition ? S.definitionDraft?.judge.id : selectedDefinition()?.judge.id) : S.selectedDatasetId) ? 'selected' : ''}>${esc(item.name)} · ${judge ? esc(item.version) : `${item.cases.length}케이스`}</option>`).join('')}</select></label>${judge ? '' : '<details class="manager-create"><summary>빈 데이터셋 예시 생성</summary><label class="field">이름<input id="new-dataset-name" maxlength="60" placeholder="예: 결제 회귀 검증"></label>' + btn('Mock 데이터셋 생성', 'createMockDataset()', '', false, 'create-mock-dataset') + '</details>'}<div class="adapter-contract">연결 예정: ${judge ? 'Judge 구성 ID · 버전' : '데이터셋 ID · 리비전'} 반환<br>실제 관리 화면·API는 연결하지 않았습니다.</div><div id="manager-error" role="alert"></div><div class="actions">${btn('취소', 'cancelManager()', '', false, 'cancel-manager')}${btn('Mock 선택 적용', 'applyManagerSelection()', 'primary', false, 'apply-manager')}</div>`);
}
function cancelManager() { if (S.managerFromDefinition) return definitionModal(null, true); closeModal(); }
function applyManagerSelection() {
  if (S.loading) return;
  const id = $('manager-selection').value;
  if (S.managerKind === 'judge') {
    const judge = MockAPI.judges.find(j => j.id === id); if (!judge) return;
    if (!S.managerFromDefinition) S.definitionDraft = selectedDefinition() ? JSON.parse(JSON.stringify(selectedDefinition())) : { name: '', criteria: M.CRITERIA.map(c => c.id) };
    S.definitionDraft.judge = JSON.parse(JSON.stringify(judge)); definitionModal(null, true); toast('선택한 Judge를 정의에 반영했습니다. 저장하면 적용됩니다.');
  } else { if (!S.datasets.some(d => d.id === id)) return; closeModal(false); selectDataset(id); toast('Mock 데이터셋을 선택했어요.'); }
}
function createMockDataset() {
  if (S.loading) return;
  const name = $('new-dataset-name')?.value.trim();
  if (!name) { $('manager-error').innerHTML = '<p class="form-error">데이터셋 이름을 입력해 주세요.</p>'; return; }
  if (S.datasets.some(d => d.name === name)) { $('manager-error').innerHTML = '<p class="form-error">같은 이름의 데이터셋이 있습니다.</p>'; return; }
  const dataset = { id: `mock-dataset-${S.datasets.length + 1}`, name, revision: 1, cases: [] };
  S.datasets.push(dataset); closeModal(false); selectDataset(dataset.id); toast('빈 Mock 데이터셋을 만들었어요. 세션 케이스를 추가해 주세요.');
}

function comparisonSetup(locked, result = null) {
  if (locked && result) {
    const a = M.countStatuses(result, 'a'), b = M.countStatuses(result, 'b');
    return `<section class="evaluation-metadata"><div><span>평가 정의</span><strong>${esc(result.definition?.name || '결제 응답 검증')} · r${result.definition?.revision || 1}</strong></div><div><span>데이터셋</span><strong>${esc(result.dataset?.name || '고정 예시')} · r${result.dataset?.revision || 1}</strong></div><div><span>설정</span><strong>${esc(result.candidate.id)}</strong></div><div><span>평가</span><strong>Judge ${esc(result.judge.version)} · ${esc(result.fixtureVersion)}</strong></div><div><span>기록</span><strong>${esc(result.id)}</strong></div><p>A 판정 불가 ${a.UNJUDGEABLE} · 오류 ${a.JUDGE_ERROR} / ${esc(result.candidate.label)} 판정 불가 ${b.UNJUDGEABLE} · 오류 ${b.JUDGE_ERROR}</p><div class="actions">${btn('평가한 프롬프트', `viewEvaluatedSettings('${result.id}')`, 'quiet', false, 'compare-details')}${btn(S.reviews[result.id] ? '검토 확인됨' : '검토 확인', `markReviewed('${result.id}')`, 'quiet', false, `review-${result.id}`)}</div></section>`;
  }
  return `<section class="comparison-setup compact-prepare"><div class="prepare-target">${pill('A · v12')}${icon('arrow', 13)}${pill(`${S.draft.label} · ${candidateState()}`, M.isDirty(S) ? 'blue' : '')}${btn('편집', "navigate('execute');selectNode('query')", 'quiet', false, 'edit-candidate')}</div><div class="prepare-case"><div><strong>취소 제외 · 월 결제 합계</strong><span>기대값 50,000원</span></div>${btn(S.case ? '케이스 확인됨' : '케이스 확인', 'caseModal()', 'quiet', !!S.case || !!S.loading, 'save-case')}</div><div class="prepare-actions">${btn('비교 설정', 'compareDetails()', 'quiet', false, 'compare-details')}<span class="tiny">예시: ${MockAPI.scenarios[S.scenario]}</span>${btn(S.loading === 'compare' ? '<span class="spin"></span>비교 중' : '예시 비교 시작', 'compare()', 'primary', !!S.loading, 'start-compare')}</div></section>`;
}
function evaluationDetail() {
  const result = currentResult(), locked = !!result, expanded = S.evalSetupOpen;
  const history = S.evalHistoryOpen && S.evaluations.length > 1 ? `<div class="compact-history"><label for="result-history">평가 기록</label><select id="result-history" onchange="selectResult(this.value)">${S.evaluations.map(e => `<option value="${e.id}" ${e.id === S.selectedEvaluationId ? 'selected' : ''}>${e.candidate.label} · ${MockAPI.scenarios[e.scenario]}</option>`).join('')}</select></div>` : '';
  const toolbar = result ? `<div class="evaluation-tools"><button id="toggle-eval-setup" class="quiet" aria-expanded="${expanded && locked}" aria-controls="evaluation-setup" onclick="${locked ? 'toggleEvaluationSetup()' : 'compareDetails()'}">설정 ${icon('chevronDown', 11)}</button>${S.evaluations.length > 1 ? `<button id="toggle-eval-history" class="quiet" aria-expanded="${S.evalHistoryOpen}" onclick="toggleEvaluationHistory()">이력 ${S.evaluations.length} ${icon('chevronDown', 11)}</button>` : ''}</div>` : '';
  return `<div class="evaluation-breadcrumb">${btn(icon('back', 12) + ' 평가 홈', 'showEvaluationHome()', 'quiet', false, 'evaluation-home')}<span>${esc(result?.definition?.name || '평가 실행')} ${result?.definition ? `· r${result.definition.revision}` : ''}</span></div>${titlebar('실행 결과', '', toolbar)}` + `<div class="content evaluation-content simplified-evaluation">${history}${S.error?.kind === 'compare' ? errorView() : S.loading === 'compare' ? `<section class="card loading-card"><div class="actions"><span class="spin"></span>${esc(S.saved.label)} 비교 중<span class="spacer"></span>${btn('취소', 'cancelRequest()', 'quiet', false, 'cancel-compare')}</div><div class="progress"></div></section>` : ''}${result ? results(result) : ''}${locked && result ? `<div id="evaluation-setup" class="setup-disclosure ${S.evalSetupOpen ? 'is-open' : ''}" ${S.evalSetupOpen ? '' : 'inert aria-hidden="true"'}>${S.evalSetupOpen ? comparisonSetup(true, result) : ''}</div>` : ''}</div>`;
}
function toggleEvaluationSetup() {
  if (!currentResult()) return;
  S.evalSetupOpen = !S.evalSetupOpen; render('setup'); focusTarget('toggle-eval-setup');
}
function toggleEvaluationHistory() { S.evalHistoryOpen = !S.evalHistoryOpen; render(); focusTarget('toggle-eval-history'); }
function toggleEvaluationDetails(id) { S.evalDetailsOpen[id] = !S.evalDetailsOpen[id]; render('view'); focusTarget(`details-toggle-${id}`); }
function viewEvaluatedSettings(id) {
  const result = S.evaluations.find(e => e.id === id); if (!result) return;
  modal(`${result.candidate.label} 평가에 사용한 설정`, `<div class="selection"><strong>${esc(result.candidate.id)}</strong><p>Judge ${esc(result.judge.version)} · ${esc(result.fixtureVersion)}</p><div class="code">${esc(result.candidate.prompt)}</div></div><p>${esc(M.conditionLabel(result.conditions))}<br>이 설정은 평가본입니다. 현재 초안이나 다른 결과를 변경하지 않습니다.</p><div class="actions">${btn('확인', 'closeModal()', 'primary')}</div>`);
}
function caseModal() {
  const dataset = selectedDataset();
  if (!dataset) return managerHandoff('dataset');
  if (dataset.cases.length) return datasetCases();
  modal('현재 세션을 케이스로 추가', `<label class="field">저장 대상<select id="dataset">${S.datasets.map(d => `<option value="${d.id}" ${d.id === S.selectedDatasetId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label><div class="selection">${esc(MockAPI.fixture.input)}<div class="divider"></div><strong>기대값 50,000원</strong><p>완료 30,000원 + 완료 20,000원 · 취소 18,000원 제외</p><span class="tiny">현재 세션 A · 원본 응답은 정답이 아닌 참고 기록</span></div><label class="check-label"><input type="checkbox" id="expected-confirmed"> 기대값과 저장 대상을 확인했습니다</label><p class="tiny">Mock 저장 · 실제 데이터셋은 변경되지 않습니다.</p><div id="caseState" role="status"></div><div class="actions">${btn('취소', 'closeModal()', '', false, 'cancel-case')}${btn('케이스 추가', 'storeCase()', 'primary', false, 'confirm-case')}</div>`);
}
async function storeCase() {
  if (S.loading) return;
  if (!$('expected-confirmed')?.checked) { $('caseState').innerHTML = '<p class="form-error">기대값 확인에 체크해 주세요.</p>'; $('expected-confirmed')?.focus(); return; }
  const payload = { datasetId: $('dataset').value, expectedConfirmed: true };
  const dataset = S.datasets.find(d => d.id === payload.datasetId);
  if (!dataset) { $('caseState').innerHTML = '<p class="form-error">데이터셋을 다시 선택해 주세요.</p>'; return; }
  if (dataset.cases.length) { $('caseState').innerHTML = '<p class="form-error">이 세션은 이미 포함되어 있습니다. 중복 추가하지 않습니다.</p>'; return; }
  await perform('case', signal => MockAPI.saveCase(payload, { signal }), value => { dataset.cases.push(value); dataset.revision++; S.selectedDatasetId = dataset.id; S.case = value; closeModal(false, false); toast('세션 케이스를 추가했어요. 실제 데이터셋은 변경되지 않습니다.'); }, () => focusTarget('start-compare'));
}
function compareDetails() {
  modal('비교 설정과 실행 조건', `<div class="selection"><strong>A v12 → ${esc(S.draft.label)}</strong><p>${esc(selectedDefinition()?.name || '정의 미선택')} · r${selectedDefinition()?.revision || '—'}<br>${esc(selectedDefinition()?.judge.name || 'Judge 미선택')} · ${esc(selectedDefinition()?.judge.version || '—')}</p><span class="section-label">평가할 저장본</span><div class="code">${esc(S.saved?.prompt || '아직 저장하지 않았습니다.')}</div>${M.isDirty(S) ? '<p class="form-error">현재 초안에 미저장 변경이 있습니다. 그대로는 비교할 수 없습니다.</p>' : ''}</div><dl class="conditions"><div><dt>결제 내역</dt><dd>고정 예시 fixture-v1</dd></div><div><dt>설정 실제 적용</dt><dd>미검증 · 런타임 미연결</dd></div><div><dt>대화 상태 격리</dt><dd>미검증 · 실제 실행 없음</dd></div></dl><label class="field">반환할 Mock 예시<select id="scenario-select" onchange="S.scenario=this.value;render()" ${S.loading ? 'disabled' : ''}>${Object.entries(MockAPI.scenarios).map(([key, label]) => `<option value="${key}" ${S.scenario === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><p>예시는 프롬프트·판정 지침의 의미와 무관하게 선택한 결과를 반환합니다. 설정·데이터셋은 실행 시점의 사본으로 기록됩니다.</p><div class="actions">${btn('확인', 'closeModal()', 'primary', false, 'close-details')}</div>`);
}
async function compare() {
  if (S.loading) return;
  let candidate;
  try { candidate = M.comparisonCandidate(S); } catch (error) { modal('비교할 설정을 확인해 주세요', `<p>${esc(error.message)}</p><p>이전 저장본으로 조용히 비교하지 않습니다.</p><div class="actions">${btn('돌아가기', 'closeModal()')}${btn('초안 확인', "closeModal(false);navigate('execute');selectNode('query')", 'primary')}</div>`); return; }
  if (!S.case) return caseModal();
  let config; try { config = M.runConfiguration(S); } catch (error) { toast(error.message); return; }
  const scenario = S.scenario;
  if (S.evalPage === 'home') S.evalHomeView = { scroll: window.scrollY || 0, focusId: 'start-compare' };
  await perform('compare', signal => MockAPI.compare({ candidate, caseId: S.case.id, scenario, ...config }, { signal }), response => { M.acceptEvaluation(S, response, candidate, config); S.evalPage = 'detail'; S.evalSetupOpen = false; toast(`${candidate.label} 예시 결과를 기록했어요.`); }, () => { if (S.tab === 'evaluate') { $('result-heading')?.scrollIntoView({ block: 'start', behavior: 'instant' }); focusTarget('result-heading'); } });
}
function selectResult(id) { S.evalPage = 'detail'; S.selectedEvaluationId = id; S.evalSetupOpen = false; render('view'); focusTarget('result-history'); }
function statusPill(side) { const cls = { PASS: 'green', FAIL: 'red', UNJUDGEABLE: 'amber', JUDGE_ERROR: 'red' }[side.status]; return pill(M.LABELS[side.status], cls); }
function results(result) {
  const a = M.countStatuses(result, 'a'), b = M.countStatuses(result, 'b'), summary = M.resultSummary(result);
  const title = b.JUDGE_ERROR ? `평가 오류 ${b.JUDGE_ERROR}개` : b.UNJUDGEABLE ? `판정 불가 ${b.UNJUDGEABLE}개` : b.FAIL ? `미충족 ${b.FAIL}개` : `기준 ${b.PASS}개 충족`;
  const counts = [['PASS', '충족'], ['FAIL', '미충족'], ['UNJUDGEABLE', '판정 불가'], ['JUDGE_ERROR', '평가 오류']].filter(([key]) => b[key] > 0).map(([key, label]) => `${label} ${b[key]}`).join(' · ');
  const issues = result.criteria.map((row, index) => ({ row, index })).filter(({ row }) => row.b.status !== 'PASS');
  const detailsOpen = !!S.evalDetailsOpen[result.id];
  const baselineUncertain = a.UNJUDGEABLE || a.JUDGE_ERROR;
  return `<section class="result-block compact-result" aria-labelledby="result-heading"><div class="compact-result-target"><div>${pill('A · v12')}${icon('arrow', 13)}${pill(`${result.candidate.label} · 평가본`)}<span>${result.dataset?.caseCount || 1}케이스</span></div>${!M.isEvaluated(S) ? '<span class="tiny">이전 결과</span>' : ''}</div><div class="compact-verdict ${summary.tone}"><div class="verdict-icon">${icon(summary.tone === 'success' ? 'check' : 'info', 21)}</div><div><h2 id="result-heading" tabindex="-1">${title}</h2>${issues.length ? `<p>${counts}</p>` : ''}</div></div>${baselineUncertain ? `<div class="baseline-uncertainty">A: ${a.UNJUDGEABLE ? `판정 불가 ${a.UNJUDGEABLE}` : ''}${a.UNJUDGEABLE && a.JUDGE_ERROR ? ' · ' : ''}${a.JUDGE_ERROR ? `평가 오류 ${a.JUDGE_ERROR}` : ''}</div>` : ''}${issues.length ? `<div class="visible-issues">${issues.map(({ row, index }) => { const trigger = `issue-evidence-${result.id}-${index}-b`; return `<div class="visible-issue"><span>${esc(row.name)}</span>${statusPill(row.b)}${btn('근거 ' + icon('arrow', 11), `openEvidence('${result.id}',${index},'b','${trigger}')`, 'quiet', !row.b.evidence, trigger)}</div>`; }).join('')}</div>` : ''}<div class="compact-result-actions"><button id="details-toggle-${result.id}" class="quiet" aria-expanded="${detailsOpen}" aria-controls="result-details-${result.id}" onclick="toggleEvaluationDetails('${result.id}')">${detailsOpen ? '상세 접기' : '기준·응답 보기'} ${icon(detailsOpen ? 'chevronUp' : 'chevronDown', 12)}</button>${btn(M.isEvaluated(S) ? '다음 후보 만들기' : `${S.draft.label} 편집`, 'nextDraft()', 'primary', !!S.loading, 'result-next')}</div></section><section id="result-details-${result.id}" class="evaluation-detail ${detailsOpen ? 'is-open' : ''}" ${detailsOpen ? '' : 'inert aria-hidden="true"'}>${detailsOpen ? resultDetails(result) : ''}</section>`;
}
function resultDetails(result) {
  return `<div class="response-comparison"><article><div class="panel-title">A</div><p>${esc(result.runs.a.text)}</p></article><article><div class="panel-title">${esc(result.candidate.label)}</div><p>${esc(result.runs.b.text)}</p></article></div><div class="table-wrap"><table><thead><tr><th>기준</th><th>A</th><th>${esc(result.candidate.label)}</th><th>근거</th></tr></thead><tbody>${result.criteria.map((row, index) => `<tr id="result-row-${index}"><td><strong>${esc(row.name)}</strong><small class="criterion-reason">${esc(row.b.reason)}</small></td><td>${statusPill(row.a)}</td><td>${statusPill(row.b)}</td><td><div class="evidence-actions">${btn('A', `openEvidence('${result.id}',${index},'a')`, 'quiet', !row.a.evidence, `evidence-${result.id}-${index}-a`)}${btn(result.candidate.label + ' ' + icon('arrow', 11), `openEvidence('${result.id}',${index},'b')`, 'quiet', !row.b.evidence, `evidence-${result.id}-${index}-b`)}</div></td></tr>`).join('')}</tbody></table></div>`;
}
function markReviewed(id) { S.reviews[id] = true; render(); toast('사람 검토 여부를 별도로 기록했어요. 자동 판정은 바뀌지 않습니다.'); }
function openOriginalTrace() { return openTrace({ runId: MockAPI.original.id, traceId: MockAPI.original.traceId, observationId: MockAPI.original.observations[0].id }, { title: '원본 대화', triggerId: 'original-trace' }); }
function openEvidence(resultId, index, side, triggerId = null) {
  const result = S.evaluations.find(e => e.id === resultId), criterion = result?.criteria[index];
  if (!criterion?.[side].evidence) return toast('연결된 기록 근거가 없습니다.');
  if (!triggerId && !S.evalDetailsOpen[resultId]) { S.evalDetailsOpen[resultId] = true; render(); }
  return openTrace(criterion[side].evidence, { title: criterion.name, reason: criterion[side].reason, status: criterion[side].status, resultId, side, triggerId: triggerId || `evidence-${resultId}-${index}-${side}` });
}
async function openTrace(reference, context = {}) { stopReplay();
  if (S.loading && S.loading !== 'trace') return toast('현재 요청을 완료하거나 취소한 뒤 기록을 열어 주세요.');
  saveView(); rememberRecordScroll();
  if (S.tab !== 'trace') S.origin = { tab: S.tab, scroll: window.scrollY || 0, focusId: context.triggerId || document.activeElement?.id, resultId: S.selectedEvaluationId, evalPage: S.evalPage };
  closeModal(false); S.traceEntry = 'evidence'; S.tracePage = 'detail'; S.traceRequestMore = false; S.runSummary = MockAPI.runForTrace(reference.traceId); S.traceAvailability = null; S.traceId = reference.traceId; S.observationId = reference.observationId || null; S.evidenceContext = { ...context, reference: { ...reference }, citedObservationId: reference.observationId || null }; S.traceData = null; S.tab = 'trace'; S.graph = true; S.traceNav = 'flow'; S.tracePanelOpen = !window.matchMedia?.('(max-width: 740px)').matches; S.traceScope = 'observation'; S.selectedNodeId = null; setRoute('trace'); window.scrollTo({ top: 0, behavior: 'instant' });
  await perform('trace', signal => {
    const run = MockAPI.runForTrace(reference.traceId);
    if (!run || (reference.runId && reference.runId !== run.runId)) throw TraceAdapter.error('RUN_REFERENCE_MISMATCH', 404, '근거에 연결된 플랫폼 실행을 확인할 수 없습니다.');
    return MockAPI.getRunTrace({ agentId: run.agentId, runId: run.runId, all: true, observationId: reference.observationId }, { signal });
  }, response => {
    S.traceAvailability = response.availability;
    if (response.availability === 'not_found') { S.traceData = null; return; }
    const trace = response.trace; S.traceData = trace; const resolved = M.resolveEvidence(trace, reference);
    S.observationId = resolved.observationId; S.traceScope = resolved.scope; S.selectedNodeId = resolved.nodeId; S.turnId = resolved.turnId; S.conversationScope = resolved.conversationScope; S.mappingNote = resolved.reason;
    if (resolved.scope === 'conversation') { S.traceNav = 'calls'; S.graph = false; }
  }, () => { if (S.tab === 'trace') { Motion.play('evidence', Motion.capture()); focusTarget('inspect-heading'); } });
}
function returnToOrigin() {
  const origin = S.origin || { tab: 'execute', scroll: 0, focusId: 'view-heading' };
  if (origin.resultId) S.selectedEvaluationId = origin.resultId;
  if (origin.evalPage) S.evalPage = origin.evalPage;
  navigate(origin.tab, { restore: origin });
}
function isCitedSelection() {
  const ref = S.evidenceContext?.reference;
  if (!ref || !S.traceData) return false;
  const resolved = M.resolveEvidence(S.traceData, ref);
  return !resolved.unavailable && resolved.scope === S.traceScope && resolved.observationId === S.observationId && (resolved.scope !== 'conversation' || resolved.turnId === S.turnId);
}
function returnToCitation() { stopReplay();
  const resolved = M.resolveEvidence(S.traceData, S.evidenceContext.reference);
  S.traceScope = resolved.scope; S.observationId = resolved.observationId; S.selectedNodeId = resolved.nodeId; S.turnId = resolved.turnId; S.conversationScope = resolved.conversationScope; S.mappingNote = resolved.reason;
  render('inspector'); focusTarget('inspect-heading');
}
function evidenceBanner() {
  const context = S.evidenceContext;
  const unresolved = S.traceData && context?.reference && M.resolveEvidence(S.traceData, context.reference).unavailable;
  if (!context?.title) return '';
  return `<div class="evidence-context"><div>${pill(context.status ? M.LABELS[context.status] : '대화 기록', context.status === 'FAIL' ? 'red' : '')}<strong>${esc(context.title)}</strong><span class="evidence-scope">${S.traceScope === 'conversation' ? '대화 / 턴' : '호출 근거'}</span></div>${context.reason ? `<p>${esc(context.reason)}</p>` : ''}${context.status && unresolved ? `<div class="citation-warning">인용된 근거가 확인되지 않습니다. 다른 기록을 정확한 근거로 대신하지 않습니다.</div>` : context.status && !isCitedSelection() ? `<div class="citation-warning"><span>다른 호출을 확인 중입니다. 위 판정이 인용한 근거와 다릅니다.</span>${btn('평가 근거로 돌아가기', 'returnToCitation()', 'quiet', false, 'return-citation')}</div>` : `<span class="tiny">${context.status ? '판정에 인용된 근거 · 원인 노드나 노드 점수를 뜻하지 않습니다.' : '원본 대화에서 연결한 실행 기록입니다.'}</span>`}</div>`;
}
const RUN_LABELS = { queued: '대기', running: '진행 중', completed: '완료', failed: '실패', cancelled: '취소', unknown: '확인 불가' };
function runStatus(run) { const status = run?.status; return pill(RUN_LABELS[status] || '확인 불가', status === 'completed' ? 'green' : status === 'failed' ? 'red' : status === 'running' ? 'blue' : ''); }
function sessionName(id) { return MockAPI.sessions.find(s => s.id === id)?.name || id; }
function runTime(value) { return value ? `${value.slice(5, 10)} ${value.slice(11, 16)}` : '미확인'; }
async function loadRuns(cursor = S.runList.cursor, reset = false, previous = null) {
  const list = S.runList;
  list.controller?.abort(); const job = ++list.job; list.controller = new AbortController(); list.loading = true; list.error = null;
  if (reset) { list.previous = []; list.cursor = null; cursor = null; }
  const sessionId = list.sessionId, pendingPrevious = previous || list.previous.slice(); list.attempted = { cursor, previous: pendingPrevious }; render();
  try {
    const response = await MockAPI.listRuns({ agentId: 'agent-cs', sessionId, cursor, limit: 5 }, { signal: list.controller.signal });
    if (job !== list.job) return;
    list.items = response.items; list.nextCursor = response.nextCursor; list.cursor = cursor; list.previous = pendingPrevious; list.loaded = true;
  } catch (error) { if (job === list.job && error.name !== 'AbortError') list.error = { message: error.message, status: error.status || null }; }
  finally { if (job === list.job) { list.loading = false; if (S.tab === 'trace' && S.tracePage === 'list') render('view'); } }
}
function selectRunSession(id) { if (!['', ...MockAPI.sessions.map(s => s.id)].includes(id)) return; S.runList.sessionId = id; return loadRuns(null, true); }
function nextRunPage() { if (S.runList.loading || !S.runList.nextCursor) return; return loadRuns(S.runList.nextCursor, false, [...S.runList.previous, S.runList.cursor]); }
function previousRunPage() { if (S.runList.loading || !S.runList.previous.length) return; return loadRuns(S.runList.previous.at(-1), false, S.runList.previous.slice(0, -1)); }
function retryRuns() { const attempted = S.runList.attempted; return loadRuns(attempted ? attempted.cursor : S.runList.cursor, false, attempted?.previous || null); }
function showTraceList() { stopReplay();
  if (S.loading === 'trace') { S.controller?.abort(); S.job++; S.loading = null; S.error = null; }
  S.tracePage = 'list'; render('view'); window.scrollTo({ top: S.runList.view.scroll || 0, behavior: 'instant' }); focusTarget(S.runList.view.focusId || 'view-heading');
  if (!S.runList.loaded) return loadRuns();
}
function traceList() {
  const list = S.runList;
  const back = S.origin?.tab === 'evaluate' ? btn(icon('back', 12) + ' 비교 결과로', 'returnToOrigin()', 'quiet', false, 'return-origin') : '';
  return `${titlebar('추적', '실행 목록은 KPAP 기록, 관측 상세는 Langfuse에서 조회합니다.', back)}<div class="content trace-browser"><div class="run-list-toolbar"><label for="run-session">세션<select id="run-session" onchange="selectRunSession(this.value)"><option value="">전체 세션</option>${MockAPI.sessions.map(session => `<option value="${session.id}" ${session.id === list.sessionId ? 'selected' : ''}>${esc(session.name)}</option>`).join('')}</select></label><span class="spacer"></span><span class="tiny">업무 상태 · A2A 기준</span>${btn('새로고침', 'loadRuns()', 'quiet', list.loading, 'refresh-runs')}</div><section class="platform-runs" aria-label="KPAP 실행 목록">${list.loading ? '<div class="runs-loading" role="status"><span class="spin"></span>실행 목록을 불러오는 중</div>' : list.error ? `<div class="runs-empty" role="alert"><h2>실행 목록을 불러오지 못했습니다</h2><p>${esc(list.error.message)}</p>${btn('목록 다시 조회', 'retryRuns()', '', false, 'retry-runs')}</div>` : !list.items.length ? `<div class="runs-empty"><h2>이 세션의 실행 기록이 없습니다</h2><p>관측 수집 여부가 아닌 플랫폼 실행 목록입니다.</p>${list.sessionId ? btn('전체 세션 보기', "selectRunSession('')", 'quiet', false, 'all-sessions') : ''}</div>` : `<div class="run-columns" aria-hidden="true"><span>실행</span><span>세션</span><span>업무 상태</span><span>시작 · UTC</span><span>설정</span></div>${list.items.map(run => `<button id="run-${run.runId}" class="platform-run" onclick="openRun('${run.runId}')"><span class="run-main"><strong>${esc(run.runId)}</strong><small>${esc(run.traceId)}</small></span><span class="run-session-name">${esc(sessionName(run.sessionId))}</span><span>${runStatus(run)}</span><span class="run-timestamp">${runTime(run.startedAt)}</span><span class="run-snapshot">${esc(run.snapshotId || '적용 미확인')}${icon('arrow', 12)}</span></button>`).join('')}`}</section><div class="run-pagination"><span>현재 페이지 ${list.loading ? '—' : list.items.length}개 · KPAP Mock</span><div class="actions">${btn('이전', 'previousRunPage()', 'quiet', list.loading || !list.previous.length, 'runs-previous')}${btn('다음', 'nextRunPage()', '', list.loading || !list.nextCursor, 'runs-next')}</div></div><div class="trace-integration-note">${icon('info', 13)}<span>Langfuse v3 공개 API 어댑터 예시 · 실제 서버 미연결</span></div></div>`;
}
async function openRun(runId) { stopReplay();
  if (S.loading && S.loading !== 'trace') return toast('현재 요청이 끝난 뒤 실행 기록을 열어 주세요.');
  const run = S.runList.items.find(row => row.runId === runId); if (!run) return;
  if (S.tracePage === 'list') S.runList.view = { scroll: window.scrollY || 0, focusId: `run-${runId}` };
  S.traceEntry = 'browse'; S.tracePage = 'detail'; S.traceRequestMore = false; S.runSummary = M.immutable(run); S.evidenceContext = null; S.traceData = null; S.traceAvailability = null; S.traceId = run.traceId; S.observationId = null; S.traceNav = 'flow'; S.tracePanelOpen = !window.matchMedia?.('(max-width: 740px)').matches; S.traceScope = 'observation'; S.selectedNodeId = null; S.mappingNote = null;
  window.scrollTo({ top: 0, behavior: 'instant' });
  return loadSelectedRun();
}
async function loadSelectedRun(more = false) { stopReplay();
  const run = S.runSummary; if (!run) return;
  if (more && (S.loading || !S.traceData?.nextCursor)) return;
  S.traceRequestMore = more;
  const cursor = more ? S.traceData.nextCursor : null;
  const previous = S.traceData, selected = S.observationId;
  await perform('trace', signal => MockAPI.getRunTrace({ agentId: run.agentId, runId: run.runId, cursor, observationId: more ? null : selected }, { signal }), response => {
    if (S.runSummary?.runId !== run.runId) return;
    S.traceAvailability = response.availability;
    if (response.availability === 'not_found') { S.traceData = null; return; }
    if (more && previous) {
      S.traceData = { ...response.trace, observations: TraceAdapter.merge(previous.observations, response.observations) };
    } else {
      S.traceData = response.trace;
      const ref = selected && response.observations.some(o => o.id === selected) ? { observationId: selected } : response.observations.length ? { observationId: response.observations[0].id } : {};
      const resolved = M.resolveEvidence(S.traceData, ref);
      S.observationId = resolved.observationId; S.traceScope = resolved.scope; S.selectedNodeId = resolved.nodeId; S.turnId = resolved.turnId; S.conversationScope = resolved.conversationScope; S.mappingNote = resolved.reason;
      if (!S.traceData.design) { S.traceNav = 'calls'; S.graph = false; }
      if (resolved.scope === 'conversation' && resolved.observationId) S.unmappedRecordsOpen.add(traceSelectionKey());
    }
  }, () => { if (S.tab === 'trace' && S.tracePage === 'detail') focusTarget(more ? 'load-more-observations' : 'trace-detail-heading'); });
}
function runSummaryMarkup() {
  const run = S.runSummary; if (!run) return '';
  return `<section class="selected-run-summary"><div class="selected-run-main"><span class="summary-label">업무 상태 · KPAP</span>${runStatus(run)}<strong id="trace-detail-heading" tabindex="-1">${esc(run.runId)}</strong><span>${esc(sessionName(run.sessionId))}</span></div><details class="run-identifiers"><summary>실행 연결 정보</summary><dl><div><dt>traceId</dt><dd>${esc(run.traceId)}</dd></div><div><dt>sessionId</dt><dd>${esc(run.sessionId)}</dd></div><div><dt>taskId / contextId</dt><dd>${esc(run.taskId || '미제공')} / ${esc(run.contextId || '미제공')}</dd></div>${run.remoteState ? `<div><dt>원격 상태</dt><dd>${esc(run.remoteState)}</dd></div>` : ''}<div><dt>적용 스냅샷</dt><dd>${esc(run.snapshotId || '미확인')}</dd></div><div><dt>시작 / 종료</dt><dd>${esc(run.startedAt || '미확인')} / ${esc(run.endedAt || '미확인')}</dd></div></dl></details></section>`;
}
function traceLookupState() {
  if (S.error?.kind === 'trace') {
    const forbidden = S.error.status === 403;
    return `<section class="trace-availability ${forbidden ? 'forbidden' : 'unavailable'}" role="alert">${pill(`${S.error.status || '연결'} · 관측 조회`, forbidden ? '' : 'amber')}<h2>${forbidden ? '관측 상세 권한이 없습니다' : '관측 상세를 조회하지 못했습니다'}</h2><p>${esc(S.error.message)}</p><span>업무 실행 상태와는 별개입니다.</span><div class="actions">${forbidden ? btn('실행 목록', 'showTraceList()', '', false, 'forbidden-back') : btn('상세 조회 재시도', S.traceEntry === 'browse' ? 'loadSelectedRun(S.traceRequestMore)' : 'retry()', '', false, 'retry-request')}</div></section>`;
  }
  if (S.traceAvailability === 'not_found') return `<section class="trace-availability">${pill('관측 미조회')}<h2>관측 기록을 찾지 못했습니다</h2><p>아직 수집되지 않았는지, 삭제되었는지는 구분할 수 없습니다.</p><span>업무 완료 여부는 위 KPAP 상태를 따릅니다.</span><div class="actions">${btn('상세 다시 조회', S.traceEntry === 'browse' ? 'loadSelectedRun()' : 'retryTraceEvidence()', '', false, 'retry-not-found')}</div></section>`;
  return '';
}

function traceDesignGraph(trace) {
  const nodes = trace.design?.nodes || [];
  if (!nodes.length) return '<div class="nav-empty">연결된 설계 스냅샷이 없습니다.<br>호출 목록에서 기록을 확인하세요.</div>';
  return `<div class="snapshot-graph" aria-label="선택한 실행의 읽기 전용 설계 플로우">${nodes.map((node, index) => {
    const records = trace.observations.filter(o => o.ownerNodeId === node.id), connected = index > 0 && trace.design.edges?.some(e => e.from === nodes[index - 1].id && e.to === node.id);
    const selected = S.selectedNodeId === node.id;
    return `${connected ? `<div id="design-edge-${nodes[index - 1].id}-${node.id}" class="design-edge" aria-hidden="true"><span class="transition-particle"></span></div>` : index ? '<div class="design-gap"></div>' : ''}<button id="historic-${node.id}" class="snapshot-node ${node.kind} ${selected ? 'selected' : ''}" aria-pressed="${selected}" onclick="selectNodeOccurrence('${node.id}')"><span class="snapshot-node-label">${icon(node.kind === 'input' ? 'play' : node.kind === 'agent' ? 'flow' : 'spark', 14)}${esc(node.name)}<span id="replay-node-${node.id}" class="replay-node-badge" hidden></span></span><small>${node.kind === 'input' ? '대화 입력' : records.length ? `조회된 관측 ${records.length}개` : '연결 기록 없음'}</small></button>${selected && records.length > 1 ? `<div class="inline-occurrences" role="group" aria-label="선택 노드의 호출">${records.map(o => occurrenceButton(o, true)).join('')}</div>` : ''}`;
  }).join('')}<p class="design-legend">점선은 설계 연결 · 흐름 추정 안 함<br>움직이는 점은 명시된 실제 전이만 표시</p></div>`;
}
function occurrenceButton(observation, compact = false) {
  const selected = S.traceScope === 'observation' && observation.id === S.observationId, cited = observation.id === S.evidenceContext?.citedObservationId;
  return `<button id="observation-${observation.id}" class="occurrence-item ${selected ? 'selected' : ''}" aria-pressed="${selected}" onclick="selectObservation('${observation.id}')"><span class="occurrence-number">${observation.attempt || 1}</span><span><strong>${compact ? `호출 ${observation.attempt || 1}` : esc(observation.name)}</strong><small>${esc(observation.operation)} · ${esc(observation.duration)}</small></span>${cited ? '<span class="cited-dot" title="평가가 인용한 호출"><span class="sr-only">평가 근거</span></span>' : ''}</button>`;
}
function traceNavigationContent(trace) {
  return S.traceNav === 'flow' ? traceDesignGraph(trace) : `<div class="node-occurrences"><div class="section-label">기록된 호출 <span>${trace.observations.length}</span></div>${trace.observations.length ? trace.observations.map(o => occurrenceButton(o)).join('') : '<p class="nav-empty">연결된 호출 기록이 없습니다.<br>미실행을 뜻하지 않습니다.</p>'}</div>`;
}
function traceNavigator(trace) {
  const selectedRecords = trace.observations.filter(o => o.ownerNodeId && o.ownerNodeId === S.selectedNodeId);
  const records = S.traceNav === 'flow' ? selectedRecords : trace.observations;
  return `<aside id="trace-navigator" class="trace-navigator" ${S.tracePanelOpen ? '' : 'inert aria-hidden="true"'}><div class="trace-nav-inner ${S.traceNav === 'flow' ? 'flow-view' : 'calls-view'}"><div class="navigator-heading"><div><strong>실행 탐색</strong><small>${esc(trace.design?.id || '설계 미연결')} · 읽기 전용</small></div>${icon('flow', 15)}</div><div class="navigator-segment" role="group" aria-label="실행 탐색 방식"><button id="nav-flow" class="${S.traceNav === 'flow' ? 'active' : ''}" aria-pressed="${S.traceNav === 'flow'}" onclick="setTraceNav('flow')">플로우</button><button id="nav-calls" class="${S.traceNav === 'calls' ? 'active' : ''}" aria-pressed="${S.traceNav === 'calls'}" onclick="setTraceNav('calls')">호출 목록</button></div><div id="trace-nav-scroll" class="trace-nav-scroll"><div id="trace-nav-content">${traceNavigationContent(trace)}</div></div><button id="nav-conversation" class="conversation-nav ${S.traceScope === 'conversation' ? 'selected' : ''}" aria-pressed="${S.traceScope === 'conversation'}" onclick="selectTraceConversation()">${icon('doc', 14)}대화 / 턴 기록${icon('arrow', 12)}</button></div></aside>`;
}
function tracing() {
  if (S.tracePage === 'list') return traceList();
  const trace = S.traceData;
  const back = `${btn(icon('back', 12) + ' 실행 목록', 'showTraceList()', 'quiet', false, 'back-run-list')}${S.origin ? btn(S.origin.tab === 'evaluate' ? '비교 결과로' : '원본 대화로', 'returnToOrigin()', 'quiet', false, 'return-origin') : ''}`;
  return `${titlebar('실행 상세', trace ? `${esc(trace.snapshot.label)} · 읽기 전용` : '업무 상태와 관측 조회 상태를 구분합니다.', back)}<div class="content trace-content">${runSummaryMarkup()}${S.loading === 'trace' && !S.traceRequestMore ? `<div class="trace-loading" role="status"><div class="loading-navigator"></div><div class="loading-record"><span class="spin"></span>관측 상세를 조회하는 중${btn('조회 취소', 'cancelRequest()', 'quiet', false, 'cancel-trace')}</div></div>` : (S.error?.kind === 'trace' && !S.traceRequestMore) || S.traceAvailability === 'not_found' ? traceLookupState() : !trace ? `<div class="empty"><h2>관측 조회를 취소했습니다</h2>${S.runSummary ? btn('상세 다시 조회', S.traceEntry === 'browse' ? 'loadSelectedRun()' : 'retryTraceEvidence()', '', false, 'reload-trace') : btn('실행 목록 보기', 'showTraceList()', 'primary')}</div>` : `${S.error?.kind === 'trace' ? traceLookupState() : ''}<div id="trace-evidence-banner">${evidenceBanner()}</div>${replayMarkup(trace)}<div class="trace-toolbar"><button id="toggle-trace-panel" class="quiet panel-toggle" aria-expanded="${S.tracePanelOpen}" aria-controls="trace-navigator" onclick="toggleTracePanel()">${icon('panel', 14)} ${S.tracePanelOpen ? '탐색 패널 접기' : '탐색 패널 열기'}</button><span class="tiny">관측 ${trace.observations.length}개 조회 · 수집 완료 미확정</span></div><div id="trace-workspace" class="trace-workspace revised-trace cohesive-trace ${S.tracePanelOpen ? '' : 'nav-hidden'}">${traceNavigator(trace)}<section id="trace-inspector" class="inspector">${inspector(trace)}</section></div>${trace.nextCursor ? `<div class="observation-pagination"><span>아직 조회하지 않은 관측 페이지가 있습니다.</span>${btn(S.loading === 'trace' ? '관측 조회 중…' : '관측 더 보기', 'loadSelectedRun(true)', '', !!S.loading, 'load-more-observations')}</div>` : ''}`}</div>`;
}
function retryTraceEvidence() { return openTrace(S.evidenceContext?.reference || { traceId: S.traceId }, S.evidenceContext || {}); }
function observationMetadata(observation) {
  return `<details class="observation-metadata"><summary>관측 메타데이터</summary><dl><div><dt>종류 / 수행</dt><dd>${esc(observation.type || '미제공')} / ${esc(observation.invocationId || '미제공')}</dd></div><div><dt>논리 호출 / 시도 ID</dt><dd>${esc(observation.logicalCallId || '미제공')} / ${esc(observation.attemptId || '미제공')}</dd></div><div><dt>명시된 선행 수행</dt><dd>${observation.predecessorInvocationIds?.length ? esc(observation.predecessorInvocationIds.join(', ')) : '미제공 · 연결선 모션 없음'}</dd></div><div><dt>부모 관측</dt><dd>${esc(observation.parentId || '미제공')} · 계층 관계, 인과선 아님</dd></div><div><dt>사용량</dt><dd>${observation.usage ? esc(JSON.stringify(observation.usage)) : '미제공'}</dd></div><div><dt>관측 비용</dt><dd>${observation.cost == null ? '미제공' : '$' + esc(observation.cost)} · 하위 관측과 합산하지 않음</dd></div>${observation.statusMessage ? `<div><dt>관측 메시지</dt><dd>${esc(observation.statusMessage)}</dd></div>` : ''}</dl></details>`;
}
function conversationInspector(trace) {
  const allTurns = trace.turns || [], selectedTurn = allTurns.find(t => t.id === S.turnId);
  const turnScope = S.conversationScope === 'turn', turns = turnScope ? (selectedTurn ? [selectedTurn] : []) : allTurns;
  const referenced = currentObservation(), index = selectedTurn ? allTurns.indexOf(selectedTurn) + 1 : null;
  const heading = turnScope ? selectedTurn ? `대화 · 턴 ${index}` : '인용된 턴을 찾을 수 없습니다' : `대화 · 이 실행 전체 ${allTurns.length}턴`;
  return `<div class="inspect-head"><div><span class="inspector-eyebrow">${turnScope ? '턴' : '선택 실행'} 단위 근거</span><h2 id="inspect-heading" tabindex="-1">${heading}</h2><span class="tiny">${esc(turnScope ? S.turnId || '턴 ID 없음' : trace.sessionId || trace.traceId)}</span></div>${pill('노드에 귀속하지 않음')}</div><div class="scope-notice">${icon('info', 14)}<span>${esc(S.mappingNote || '선택한 실행의 요청과 응답입니다. 세션 내 다른 실행은 목록에서 확인합니다.')}</span></div>${turns.length ? `<div class="trace-conversation">${turns.map(turn => `<div class="conversation-turn"><span class="turn-label">턴 ${allTurns.indexOf(turn) + 1} · ${esc(turn.id)}</span><article><span class="section-label">사용자 요청</span><p>${esc(turn.input == null ? '요청 기록 미제공' : typeof turn.input === 'string' ? turn.input : JSON.stringify(turn.input))}</p></article><article><span class="section-label">에이전트 응답</span><p>${esc(turn.output == null ? '응답 기록 미제공' : typeof turn.output === 'string' ? turn.output : JSON.stringify(turn.output))}</p></article></div>`).join('')}</div>` : `<div class="inspector-empty"><p>이 범위의 대화 기록이 없습니다.<br>다른 턴을 인용 근거로 보여주지 않습니다.</p>${btn('전체 대화 살펴보기', 'selectTraceConversation()', 'quiet')}</div>`}${referenced ? `<details id="unmapped-record" class="unmapped-record" ${S.unmappedRecordsOpen.has(traceSelectionKey()) ? 'open' : ''} ontoggle="rememberUnmappedDisclosure('${traceSelectionKey()}',this.open)"><summary>노드 미연결 · 참조된 호출 원문</summary><div class="observation-id">${esc(referenced.id)}</div><div class="split record-data"><div><div class="section-label">INPUT · 기록값</div><pre id="record-input" class="code" tabindex="0" aria-label="입력 기록">${esc(JSON.stringify(referenced.input, null, 2))}</pre></div><div><div class="section-label">OUTPUT · 기록값</div><pre id="record-output" class="code" tabindex="0" aria-label="출력 기록">${esc(JSON.stringify(referenced.output, null, 2))}</pre></div></div></details>` : ''}`;
}
function rememberUnmappedDisclosure(key, open) { if (open) S.unmappedRecordsOpen.add(key); else S.unmappedRecordsOpen.delete(key); }
function inspector(trace) {
  if (S.traceScope === 'conversation') return conversationInspector(trace);
  const observation = currentObservation();
  if (!observation) return `<div class="inspector-empty">${icon('flow', 24)}<h2 id="inspect-heading" tabindex="-1">연결된 호출 기록이 없습니다</h2><p>선택한 설계 노드에 매핑된 기록이 없습니다.<br>노드가 실행되지 않았다는 뜻은 아닙니다.</p>${btn('대화 기록 보기', 'selectTraceConversation()', 'quiet')}</div>`;
  const records = trace.observations.filter(o => o.ownerNodeId === observation.ownerNodeId), node = trace.design?.nodes.find(n => n.id === observation.ownerNodeId);
  const runStatus = { completed: '완료', error: '실행 오류', running: '실행 중', cancelled: '취소됨', open: '종료 시각 없음' }[observation.status] || '상태 미확인';
  return `<div class="inspect-head"><div><span class="inspector-eyebrow">${esc(node?.name || '노드 미연결')} ${icon('chevronRight', 10)} 호출 ${observation.attempt || '—'} · 조회된 관측 ${records.length || 1}개</span><h2 id="inspect-heading" tabindex="-1">${esc(observation.operation)}</h2><span class="tiny">${esc(observation.duration)} · ${runStatus}</span></div>${observation.ownerNodeId === 'node_payment_query' ? btn('설정 열기 ' + icon('arrow', 12), 'editLinkedNode()', 'quiet', !!S.loading, 'edit-owner') : ''}</div><div class="observation-id">${esc(observation.id)}<span>${esc(observation.nodeExecutionId || '수행 ID 미제공')}</span></div><div class="split record-data"><div><div class="section-label">INPUT · 기록값</div><pre id="record-input" class="code" tabindex="0" aria-label="입력 기록">${esc(JSON.stringify(observation.input, null, 2))}</pre></div><div><div class="section-label">OUTPUT · 기록값</div>${typeof observation.output?.total === 'number' ? `<div class="record-total">기록된 합계 <strong>${observation.output.total.toLocaleString()}원</strong>${Array.isArray(observation.output.payments) ? `<span>결제 ${observation.output.payments.length}건</span>` : ''}</div>` : ''}<pre id="record-output" class="code" tabindex="0" aria-label="출력 기록">${esc(JSON.stringify(observation.output, null, 2))}</pre></div></div>${observationMetadata(observation)}<div class="inspector-footnote">이 기록은 수정되지 않습니다. 설정 편집은 별도 후보에서 진행됩니다.</div>`;
}
function selectObservation(id) {
  stopReplay();
  if (!S.traceData?.observations.some(o => o.id === id)) return;
  rememberRecordScroll(); const resolved = M.resolveEvidence(S.traceData, { observationId: id });
  S.observationId = resolved.observationId; S.traceScope = resolved.scope; S.selectedNodeId = resolved.nodeId; S.turnId = resolved.turnId; S.conversationScope = resolved.conversationScope; S.mappingNote = resolved.reason;
  Replay.select(id); render('inspector'); focusTarget('inspect-heading');
}
function selectNodeOccurrence(nodeId) { stopReplay();
  const node = S.traceData?.design?.nodes.find(n => n.id === nodeId); if (!node) return;
  if (node.kind === 'input') return selectTraceConversation();
  const records = S.traceData.observations.filter(o => o.ownerNodeId === nodeId);
  if (records.length) return selectObservation(records.some(o => o.id === S.observationId) ? S.observationId : records[0].id);
  rememberRecordScroll(); S.selectedNodeId = nodeId; S.observationId = null; S.traceScope = 'observation'; render('inspector'); focusTarget('inspect-heading');
}
function selectTraceConversation() { stopReplay(); rememberRecordScroll(); S.traceScope = 'conversation'; S.observationId = null; S.selectedNodeId = null; S.turnId = null; S.conversationScope = 'session'; S.mappingNote = '선택한 실행의 대화입니다. 같은 세션의 다른 실행은 목록에서 확인합니다.'; render('inspector'); focusTarget('inspect-heading'); }
function setTraceNav(mode) { stopReplay(); if (!['flow', 'calls'].includes(mode) || S.traceNav === mode) return; S.traceNav = mode; S.graph = mode === 'flow'; render('navigator'); focusTarget(`nav-${mode}`); }
function toggleGraph() { setTraceNav(S.traceNav === 'flow' ? 'calls' : 'flow'); }
function toggleTracePanel() { stopReplay(); S.tracePanelOpen = !S.tracePanelOpen; render('panel'); focusTarget('toggle-trace-panel'); }
function editLinkedNode() {
  const observation = currentObservation();
  if (observation?.ownerNodeId !== 'node_payment_query') return toast('편집할 소유 노드 연결이 없습니다.');
  const label = S.traceData.snapshot.label;
  navigate('execute'); selectNode('query');
  toast(`${label} 기록의 소유 노드를 열었어요. 현재 ${S.draft.label} ${M.isEvaluated(S) ? '평가본은 고정입니다. 다음 초안을 만들 수 있어요.' : '초안은 유지됩니다.'}`);
}
let modalFocusId = null, toastTimer;
async function perform(kind, fn, success, after) {
  if (S.loading && kind !== 'trace') return;
  S.controller?.abort(); const id = ++S.job; S.controller = new AbortController(); S.loading = kind; S.error = null; render();
  if (kind === 'case' && $('caseState')) { $('caseState').innerHTML = '<p><span class="spin"></span>예시 케이스를 저장하고 있어요…</p>'; if ($('confirm-case')) $('confirm-case').disabled = true; }
  let succeeded = false;
  try { const value = await fn(S.controller.signal); if (id !== S.job) return; success(value); succeeded = true; }
  catch (error) { if (id !== S.job) return; if (error.name !== 'AbortError') { S.error = { kind, message: error.message, status: error.status || null, code: error.code || null }; if (kind === 'case' && $('caseState')) $('caseState').innerHTML = `<p class="form-error">${esc(error.message)}</p>`; } }
  finally { if (id === S.job) { S.loading = null; render(); if ($('confirm-case')) $('confirm-case').disabled = false; if (succeeded) after?.(); } }
}
function cancelRequest() { stopReplay(); S.controller?.abort(); S.job++; S.loading = null; S.error = null; closeModal(false); render(); toast('예시 요청을 취소했어요. 초안과 이전 결과는 유지됩니다.'); }
function errorView() { return `<div class="error" role="alert"><strong>${S.error.kind === 'compare' ? '비교 결과를 받지 못했어요.' : '실행 기록을 불러오지 못했어요.'}</strong><p>${esc(S.error.message)}</p>${btn('다시 시도', 'retry()', '', false, 'retry-request')}</div>`; }
function retry() { const kind = S.error?.kind; S.error = null; if (kind === 'trace') return openTrace(S.evidenceContext?.reference || { traceId: S.traceId, observationId: S.observationId }, S.evidenceContext || {}); if (kind === 'compare') return compare(); return storeCase(); }
function modal(title, content) {
  if (!$('modal').classList.contains('open')) modalFocusId = document.activeElement?.id || null;
  $('modal').innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button id="close-modal" class="close" aria-label="닫기" onclick="closeModal()">${icon('close', 18)}</button></div>${content}</section>`;
  $('modal').classList.add('open'); document.body.style.overflow = 'hidden'; $('modal').querySelector('button,select,textarea,input')?.focus();
}
function closeModal(restore = true, cancelPending = true) {
  if (!$('modal').classList.contains('open')) return;
  if (cancelPending && S.loading === 'case') { S.controller?.abort(); S.job++; S.loading = null; render(); }
  $('modal').classList.remove('open'); document.body.style.overflow = ''; if (restore && modalFocusId) focusTarget(modalFocusId); modalFocusId = null;
}
function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('show'); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500); }
function showDemo() { modal('파일럿 범위', '<p>가상 결제 내역과 기록을 사용하는 인터랙티브 파일럿입니다. 실제 런타임·LLM·Judge·Langfuse 호출은 없습니다.</p><p>프롬프트는 편집할 수 있지만 비교 결과는 선택한 Mock 예시입니다. 저장은 운영 적용이 아니며 새로고침하면 초기화됩니다.</p><p>평가 설정과 호출 근거는 결과별로 고정됩니다. 다음 후보를 만들어 반복할 수 있습니다.</p><div class="actions">' + btn('다음 요청 오류 체험', "MockAPI.simulateError();closeModal();toast('다음 예시 요청에서 오류와 재시도를 확인할 수 있습니다.')") + btn('확인', 'closeModal()', 'primary') + '</div>'); }
function showHelp() { modal('작업 흐름', '<div class="steps"><div class="step">대화의 실행 기록에서 입력과 출력을 확인합니다.</div><div class="step">소유 노드의 프롬프트를 편집하고 후보를 저장합니다.</div><div class="step">기대값을 확인해 기존 데이터셋에 예시 케이스를 연결합니다.</div><div class="step">평가 설정에서 원하는 Mock 예시를 선택하고 비교합니다.</div><div class="step">정확한 호출 근거를 확인하거나 다음 후보로 이어갑니다.</div></div><div class="actions">' + btn('확인', 'closeModal()', 'primary') + '</div>'); }
$('modal').addEventListener('click', event => { if (event.target === $('modal')) closeModal(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Tab' && $('modal').classList.contains('open')) {
    const focusable = [...$('modal').querySelectorAll('button:not([disabled]),select:not([disabled]),textarea,input:not([disabled]),a[href]')];
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
  }
});
window.addEventListener('popstate', event => { const tab = event.state?.tab || location.hash.slice(1); navigate(['execute', 'evaluate', 'trace'].includes(tab) ? tab : 'execute', { pop: true }); });
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => { Motion.cancel(); if (Replay.state.model) paintReplay(Replay.snapshot()); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { Replay.pause(); } });
setRoute('execute', true); render();
