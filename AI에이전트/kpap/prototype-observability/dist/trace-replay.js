/* Historical cursor over returned observations. No runtime control or inferred transitions. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TraceReplay = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  function build(trace) {
    const source = trace?.observations || [], starts = source.map(o => time(o.startTime)).filter(t => t !== null), origin = starts.length ? Math.min(...starts) : null;
    const invocations = new Map();
    const rows = source.map((o, index) => {
      const start = time(o.startTime), rawEnd = time(o.endTime), end = start !== null && rawEnd !== null && rawEnd >= start ? rawEnd : null;
      const owner = o.ownerNodeId, key = o.invocationId;
      if (owner && key) { if (!invocations.has(owner)) invocations.set(owner, []); if (!invocations.get(owner).includes(key)) invocations.get(owner).push(key); }
      return { id: o.id, observation: o, sourceIndex: index, start: start === null ? null : start - origin, end: end === null ? null : end - origin, invalidEnd: rawEnd !== null && start !== null && rawEnd < start, invocation: owner && key ? invocations.get(owner).indexOf(key) + 1 : null };
    }).sort((a, b) => a.start === null ? (b.start === null ? a.sourceIndex - b.sourceIndex : 1) : b.start === null ? -1 : a.start - b.start || a.sourceIndex - b.sourceIndex);
    const duration = Math.max(0, ...rows.flatMap(row => [row.start ?? 0, row.end ?? 0]));
    const key = JSON.stringify([trace?.traceId, trace?.snapshot?.id, trace?.design?.id, source.map(o => [o.id, o.startTime, o.endTime, o.ownerNodeId, o.invocationId, o.predecessorInvocationIds]), trace?.nextCursor]);
    return { key, origin, traceId: trace?.traceId, rows, duration, timed: rows.filter(r => r.start !== null).length, untimed: rows.filter(r => r.start === null).length, unknownEnd: rows.filter(r => r.start !== null && r.end === null).length, partialPage: !!trace?.nextCursor, design: trace?.metadataMapped === true && trace?.snapshot?.id && trace?.graphVersion === trace?.design?.id ? trace.design : null, playable: starts.length > 0 && duration > 0 };
  }
  function frame(model, position, selectionId) {
    const active = position === null ? [] : model.rows.filter(r => r.start !== null && r.end !== null && r.start <= position && position < r.end);
    const unbounded = position === null ? [] : model.rows.filter(r => r.start !== null && r.end === null && r.start <= position);
    const transitions = [];
    if (position !== null && model.design) for (const target of model.rows) {
      if (target.start === null || position < target.start || position >= target.start + 650 || !target.observation.ownerNodeId) continue;
      for (const predecessor of target.observation.predecessorInvocationIds || []) {
        const source = model.rows.find(r => r.observation.invocationId === predecessor && r.observation.ownerNodeId);
        if (!source || source.observation.ownerNodeId === target.observation.ownerNodeId) continue;
        const from = source.observation.ownerNodeId, to = target.observation.ownerNodeId;
        if (!model.design.edges?.some(edge => edge.from === from && edge.to === to)) continue;
        if (!transitions.some(edge => edge.from === from && edge.to === to)) transitions.push({ from, to, predecessor, targetId: target.id });
      }
    }
    return { active, unbounded, transitions, selected: model.rows.find(r => r.id === selectionId) || null };
  }
  function createController({ now = () => Date.now(), schedule = fn => setTimeout(fn, 40), cancel = clearTimeout, onUpdate = () => {}, isCurrent = () => true } = {}) {
    const state = { model: null, position: 0, selectionId: null, playing: false, speed: 1 };
    let timer = null, epoch = 0, wall = 0;
    const snapshot = () => ({ ...state, ...(state.model ? frame(state.model, state.position, state.selectionId) : { active: [], unbounded: [], transitions: [], selected: null }) });
    const emit = reason => onUpdate(snapshot(), reason);
    function stopTimer() { if (timer !== null) cancel(timer); timer = null; epoch++; }
    function advance() {
      const next = now(), elapsed = Math.max(0, next - wall); wall = next;
      state.position = Math.min(state.model.duration, (state.position || 0) + elapsed * state.speed);
      const started = state.model.rows.filter(r => r.start !== null && r.start <= state.position), latest = started.at(-1)?.start;
      const group = started.filter(r => r.start === latest);
      if (group.length && !group.some(r => r.id === state.selectionId)) state.selectionId = group[0].id;
      if (state.position >= state.model.duration) { state.playing = false; stopTimer(); }
    }
    function tick(token) {
      if (token !== epoch || !state.playing) return;
      timer = null;
      if (!isCurrent(state.model)) { state.playing = false; stopTimer(); return; }
      advance(); emit('tick');
      if (state.playing) { const next = epoch; timer = schedule(() => tick(next)); }
    }
    function pause(notify = true) { if (state.playing && isCurrent(state.model)) advance(); state.playing = false; stopTimer(); if (notify) emit('pause'); }
    function load(model, selectionId, position = undefined) { pause(false); state.model = model; const row = model?.rows.find(r => r.id === selectionId) || model?.rows[0]; state.selectionId = row?.id || null; state.position = position === undefined ? row?.start ?? null : position === null ? null : Math.max(0, Math.min(model.duration, position)); emit('load'); }
    function play() {
      if (!state.model?.playable || !isCurrent(state.model)) return false;
      if (state.playing) return true;
      if (state.position === null || state.position >= state.model.duration) { state.position = 0; state.selectionId = state.model.rows.find(r => r.start !== null)?.id || null; }
      state.playing = true; wall = now(); emit('play'); const token = ++epoch; timer = schedule(() => tick(token)); return true;
    }
    function select(id) { const row = state.model?.rows.find(r => r.id === id); if (!row) return; pause(false); state.selectionId = id; state.position = row.start; emit('select'); }
    function step(delta) { if (!state.model?.rows.length) return; const index = state.model.rows.findIndex(r => r.id === state.selectionId), next = Math.max(0, Math.min(state.model.rows.length - 1, index + delta)); select(state.model.rows[next].id); }
    function speed(value) { if (![.5, 1, 2].includes(Number(value))) return; if (state.playing) advance(); state.speed = Number(value); wall = now(); emit('speed'); }
    return { state, snapshot, load, play, pause, select, step, speed, dispose() { pause(false); state.model = null; } };
  }
  return { build, frame, createController };
});
