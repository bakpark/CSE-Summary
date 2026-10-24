'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8');
test('reference workbench keeps stable application anchors and one honest fixed agent', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('pilot.css') < html.indexOf('reference-theme.css'));
  assert.match(html, /class="playground-workbench" aria-label="에이전트 작업영역"/);
  assert.match(html, /id="workspace-agent"[^>]*고정 예시[^>]*disabled/);
  for (const id of ['tabs', 'context', 'app', 'modal', 'toast']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1);
  }
  assert.ok(html.indexOf('trace-replay.js') < html.indexOf('pilot.js'));
});
test('reference theme preserves semantic text contrast and reduced-motion escape', () => {
  const css = read('reference-theme.css');
  const lum = hex => {
    const values = hex.match(/[\da-f]{2}/gi).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  };
  for (const [text, surface] of [['346671', 'edf6f8'], ['8c4f59', 'fcf1f2'], ['3e6f5d', 'edf7f1'], ['657080', 'ffffff'], ['ffffff', '3567b3']]) {
    const [a,b] = [lum(text),lum(surface)].sort((a,b) => b-a);
    assert.ok((a + .05) / (b + .05) >= 4.5, `${text}/${surface} must be readable`);
  }
  assert.match(css, /@media\(max-width:740px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.transition-motion \.transition-particle \{ display: none; \}/);
});
