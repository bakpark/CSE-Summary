'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8');

test('component polish is a final presentation layer, not a hidden-feature layer', () => {
  const css = read('component-system.css'), html = read('index.html');
  assert.ok(html.indexOf('trace-inspection.css') < html.indexOf('component-system.css'));
  const visibleStyles = css.slice(0, css.indexOf('@media(prefers-reduced-motion:reduce)'));
  assert.doesNotMatch(visibleStyles, /(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)/);
  // The only non-content exception is the established reduced-motion particle.
});

test('selected controls retain explicit focus and decorative motion remains optional', () => {
  const css = read('component-system.css');
  assert.match(css, /button\.selected:focus-visible, button\.active:focus-visible/);
  assert.match(css, /summary:focus-visible/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.snapshot-node\.replay-pulse \{ animation: none; \}/);
});

test('component labels and status colors meet normal-text contrast against white', () => {
  const luminance = h => {
    const v = h.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
    return v[0]*.2126+v[1]*.7152+v[2]*.0722;
  };
  const tokens = Object.fromEntries([...read('palette.css').matchAll(/--([\w-]+):\s*#([\da-f]{6});/g)].map(m=>[m[1],m[2]]));
  for (const hex of ['ink','ink-soft','muted','accent','error','warning'].map(k=>tokens[k])) {
    assert.ok(1.05/(luminance(hex)+.05)>=4.5,hex);
  }
});

test('tree row keeps exact ID and type after removing redundant letter tile', () => {
  const source = read('trace-inspection.js');
  const row = source.slice(source.indexOf('function traceObservationRow'), source.indexOf('function selectTraceRoot'));
  assert.ok(row.includes('observation-row-id'));
  assert.ok(row.includes('row.type'));
  assert.ok(row.includes('row.id'));
  assert.ok(row.includes('level-dot error-dot'));
  assert.ok(!row.includes('class="observation-kind'));
});
