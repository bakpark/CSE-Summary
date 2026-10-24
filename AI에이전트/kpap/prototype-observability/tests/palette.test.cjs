'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const dir = path.join(__dirname, '../dist');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const cssFiles = fs.readdirSync(dir).filter(f => f.endsWith('.css'));
const palette = Object.fromEntries([...read('palette.css').matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map(m=>[m[1],m[2]]));

test('palette is exactly nine grayscale values, one accent and two scoped status colors', () => {
  assert.deepEqual(palette, {surface:'#ffffff','surface-soft':'#f7f7f7','surface-muted':'#f2f2f2','surface-selected':'#e9e9e9',line:'#dddddd','line-strong':'#b5b5b5',muted:'#666666','ink-soft':'#454545',ink:'#242424',accent:'#255ed4',error:'#a12d35',warning:'#765416'});
  for (const [name,value] of Object.entries(palette)) if (!['accent','error','warning'].includes(name)) {
    assert.equal(new Set(value.slice(1).match(/../g)).size,1,name);
  }
});

test('all component colors come from the central palette, not new literals or named colors', () => {
  assert.ok(read('index.html').indexOf('palette.css') < read('index.html').indexOf('pilot.css'));
  for (const file of cssFiles.filter(f=>f!=='palette.css')) {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g,'');
    assert.doesNotMatch(css,/#[\da-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/,file);
    assert.doesNotMatch(css,/(?<=[:\s,])(?:white|black|blue|red|green|purple|gray|grey|pink|orange)(?![-\w])/i,file);
  }
});

test('no left card stripes or inset-shadow substitutes remain in any stylesheet', () => {
  for (const file of cssFiles) {
    const css = read(file);
    assert.doesNotMatch(css,/border-(?:left|right|inline-start)\s*:\s*(?:[2-9]|\d{2,})px/i,file);
    for (const m of css.matchAll(/box-shadow\s*:\s*([^;}]+)/g)) assert.equal(m[1].trim(),'none',file);
  }
});

test('selection and historical activity use neutral outlines while keyboard focus uses the one accent', () => {
  const css=read('component-system.css');
  assert.match(css,/\.trace-root-button\.selected, \.occurrence-item\.selected, \.conversation-nav\.selected \{\s*background: var\(--surface-selected\); color: var\(--ink\); outline: 1px solid var\(--muted\)/);
  assert.match(css,/\.occurrence-item\.replay-running \{ outline: 1px dashed var\(--ink-soft\)/);
  assert.match(css,/\.occurrence-item\.replay-running:focus-visible, \.snapshot-node\.replay-running:focus-visible \{\s*outline: 2px solid var\(--accent\)/);
  assert.match(css,/\.timeline-bar, \.timeline-bar\.generation, \.timeline-bar\.error-bar \{ background: var\(--muted\)/);
  assert.match(css,/\.snapshot-node\.replay-pulse \{ animation: none; \}/);
});

test('readable text/status tokens retain contrast on white and selected neutral surfaces', () => {
  const luminance = h => {const v=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
  const ratio=(a,b)=>{const v=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(v[0]+.05)/(v[1]+.05);};
  for(const key of ['ink','ink-soft','muted','error','warning'])for(const surface of ['surface','surface-selected'])assert.ok(ratio(palette[key],palette[surface])>=4.5,`${key}/${surface}`);
  assert.ok(ratio(palette.accent,palette.surface)>=4.5,'primary action');
});
