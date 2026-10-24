'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const R = require('../dist/trace-replay.js'), api = require('../dist/mock-api.js');
function clockController() {
  let wall = 0, seq = 0; const pending = new Map(), events = [];
  const controller = R.createController({ now: () => wall, schedule(fn) { const id = ++seq; pending.set(id, fn); return id; }, cancel(id) { pending.delete(id); }, onUpdate(snapshot, reason) { events.push({ snapshot, reason }); } });
  return { controller, pending, events, setTime(value) { wall = value; }, tick(value) { wall = value; const [id, callback] = pending.entries().next().value || []; if (callback) { pending.delete(id); callback(); } } };
}
test('historical replay defaults paused and faithfully exposes repeated invocation overlap and explicit transition', async () => {
  const trace = (await api.getRunTrace({ runId: 'run-sample-replay', all: true }, { delay: 0 })).trace, model = R.build(trace), fake = clockController(), c = fake.controller;
  c.load(model, trace.observations[0].id); assert.equal(c.state.playing, false); assert.equal(fake.pending.size, 0); assert.equal(model.duration, 6500);
  c.play(); fake.tick(1500); assert.equal(c.state.position, 1500); assert.equal(c.snapshot().active.length, 2); assert.equal(c.state.selectionId, trace.observations[1].id); assert.deepEqual(c.snapshot().active.map(r => r.invocation), [1, 2]); assert.equal(c.snapshot().transitions.length, 0);
  fake.tick(4700); assert.equal(c.state.selectionId, trace.observations[2].id); assert.equal(c.snapshot().transitions.length, 1); assert.equal(c.snapshot().transitions[0].from, 'node_payment_query');
  fake.tick(7000); assert.equal(c.state.position, 6500); assert.equal(c.state.playing, false); assert.equal(fake.pending.size, 0);
});
test('pause, step and speed preserve exact occurrence; canceled callbacks cannot change a newer loaded run', async () => {
  const trace = (await api.getRunTrace({ runId: 'run-sample-replay', all: true }, { delay: 0 })).trace, fake = clockController(), c = fake.controller; c.load(R.build(trace));
  c.play(); const stale = [...fake.pending.values()][0]; fake.tick(500); c.pause(); fake.tick(4000); assert.equal(c.state.position, 500); assert.equal(fake.pending.size, 0);
  c.step(1); assert.equal(c.state.selectionId, trace.observations[1].id); assert.equal(c.state.position, 1000); c.speed(2); c.play(); fake.tick(4500); assert.equal(c.state.position, 2000); c.pause();
  const other = await api.trace(api.original.traceId, { delay: 0 }); c.load(R.build(other)); c.play(); const expected = c.state.selectionId, queued = fake.pending.size; stale(); assert.equal(c.state.selectionId, expected); assert.equal(fake.pending.size, queued); c.dispose(); assert.equal(fake.pending.size, 0);
});
test('timing and parent hierarchy never fabricate a transition; mismatched mapping suppresses edges', async () => {
  const raw = await api.getRunTrace({ runId: 'run-sample-retry', all: true }, { delay: 0 }); const model = R.build(raw.trace);
  assert.equal(R.frame(model, 2500, raw.observations[2].id).transitions.length, 0);
  const replay = (await api.getRunTrace({ runId: 'run-sample-replay', all: true }, { delay: 0 })).trace;
  replay.metadataMapped = false; assert.equal(R.frame(R.build(replay), 4700, replay.observations[2].id).transitions.length, 0);
  replay.metadataMapped = true; replay.graphVersion = 'wrong'; assert.equal(R.frame(R.build(replay), 4700, replay.observations[2].id).transitions.length, 0);
});
test('partial page, missing starts and missing ends remain explicitly incomplete, never fabricated intervals', async () => {
  const paged = R.build((await api.getRunTrace({ runId: 'run-sample-replay' }, { delay: 0 })).trace); assert.equal(paged.partialPage, true); assert.equal(paged.duration, 4000);
  const partial = R.build((await api.getRunTrace({ runId: 'run-sample-partial' }, { delay: 0 })).trace); assert.equal(partial.playable, false); assert.equal(partial.unknownEnd, 1); assert.equal(R.frame(partial, 0, partial.rows[0].id).active.length, 0); assert.equal(R.frame(partial, 0, partial.rows[0].id).unbounded.length, 1);
  const untimed = R.build((await api.getRunTrace({ runId: 'run-sample-untimed', all: true }, { delay: 0 })).trace); const c = clockController().controller; c.load(untimed); assert.equal(c.play(), false); c.step(1); assert.equal(c.state.selectionId, untimed.rows[1].id); assert.equal(c.state.position, null);
});
test('ineligible/stale navigation stops pending replay without modifying recorded business state', async () => {
  const trace = (await api.getRunTrace({ runId: 'run-sample-replay', all: true }, { delay: 0 })).trace; let current = true, wall = 0, callback;
  const c = R.createController({ isCurrent: () => current, now: () => wall, schedule(fn) { callback = fn; return 1; }, cancel() {} }); c.load(R.build(trace)); c.play(); current = false; wall = 2000; callback(); assert.equal(c.state.playing, false); assert.equal(c.state.position, 0);
  assert.equal((await api.getRun({ runId: trace.runId }, { delay: 0 })).status, 'completed');
});
