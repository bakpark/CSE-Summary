/* Restored observability tools. All filters are local to fetched observations. */
const TraceTools = { view: 'io', format: 'json', query: '', type: '', level: '', filtersOpen: false, collapsed: new Set() };
function resetTraceTools() { Object.assign(TraceTools, { view: 'io', format: 'json', query: '', type: '', level: '', filtersOpen: false, collapsed: new Set() }); }
function traceFilter() { return { query: TraceTools.query, type: TraceTools.type, level: TraceTools.level }; }
function traceTime(value) { return value == null ? '—' : `${(value / 1000).toFixed(2)}s`; }
function traceMoney(value) { return TraceViews.number(value) === null ? '—' : `$${value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`; }
function traceLevel(value) { return value ? pill(value, value === 'ERROR' ? 'red' : value === 'WARNING' ? 'amber' : '') : pill('Level 미제공'); }
function traceFilterControls(trace) {
  if (S.traceNav === 'flow') return '';
  const types = [...new Set(trace.observations.map(row => row.type).filter(Boolean))];
  return `<details class="observation-filters" ${TraceTools.filtersOpen ? 'open' : ''} ontoggle="TraceTools.filtersOpen=this.open"><summary>검색 · 필터${TraceTools.query || TraceTools.type || TraceTools.level ? ' · 적용됨' : ''}</summary><label class="sr-only" for="observation-search">조회된 관측 이름·종류·ID 검색</label><input id="observation-search" type="search" placeholder="관측 이름 · 종류 · ID" value="${esc(TraceTools.query)}" oninput="setObservationFilter('query',this.value)"><div><label>종류<select id="observation-type" onchange="setObservationFilter('type',this.value)"><option value="">전체</option>${types.map(type => `<option ${TraceTools.type === type ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></label><label>Level<select id="observation-level" onchange="setObservationFilter('level',this.value)"><option value="">전체</option>${['ERROR','WARNING','DEFAULT','DEBUG','UNKNOWN'].map(level => `<option value="${level}" ${TraceTools.level === level ? 'selected' : ''}>${level === 'UNKNOWN' ? '미제공' : level}</option>`).join('')}</select></label>${btn('초기화', 'clearObservationFilters()', 'quiet', false, 'clear-observation-filters')}</div></details><div id="trace-filter-status" class="trace-filter-status">${traceFilterStatus(trace)}</div>`;
}
function traceFilterStatus(trace) {
  const rows = TraceViews.filtered(trace.observations, traceFilter());
  return `${rows.length} / ${trace.observations.length}개 · 조회된 관측${S.observationId && !rows.some(row => row.id === S.observationId) ? '<span>선택 관측은 필터 밖 · 상세 유지</span>' : ''}`;
}
function setObservationFilter(key, value) {
  if (!['query','type','level'].includes(key) || !S.traceData) return;
  stopReplay(); rememberRecordScroll(); TraceTools[key] = value;
  if ($('trace-nav-content')) $('trace-nav-content').innerHTML = traceNavigationContent(S.traceData);
  if ($('trace-filter-status')) $('trace-filter-status').innerHTML = traceFilterStatus(S.traceData);
  restoreRecordScroll(); paintReplay(Replay.snapshot());
}
function clearObservationFilters() {
  stopReplay(); rememberRecordScroll(); TraceTools.query = TraceTools.type = TraceTools.level = ''; render('navigator'); focusTarget('observation-search');
}
function toggleObservationBranch(id) {
  stopReplay(); rememberRecordScroll(); TraceTools.collapsed.has(id) ? TraceTools.collapsed.delete(id) : TraceTools.collapsed.add(id); render('navigator'); focusTarget(`branch-${id}`);
}
function traceExploreRows(trace) {
  const rows = TraceViews.filtered(trace.observations, traceFilter());
  if (!rows.length) return `<div class="nav-empty">일치하는 관측이 없습니다.${btn('필터 초기화', 'clearObservationFilters()', 'quiet')}</div>`;
  if (S.traceNav === 'tree') {
    const tree = TraceViews.tree(trace.observations, traceFilter(), TraceTools.collapsed);
    return `<div class="hierarchy-note">부모 관측 계층 · 인과관계 아님</div><div class="observation-tree">${tree.rows.map(({row, depth, hasChildren, collapsed, context, issue}) => `<div class="observation-tree-row ${context ? 'ancestor-context' : ''}" style="--depth:${Math.min(depth, 6)}">${hasChildren ? `<button id="branch-${esc(row.id)}" class="branch-toggle" aria-label="${esc(row.name)} 하위 관측 ${collapsed ? '펼치기' : '접기'}" aria-expanded="${!collapsed}" onclick="toggleObservationBranch(${esc(JSON.stringify(row.id))})">${icon(collapsed ? 'chevronRight' : 'chevronDown', 12)}</button>` : '<span class="branch-placeholder"></span>'}${traceObservationRow(row, context ? '상위 문맥' : issue)}</div>`).join('')}</div>`;
  }
  if (S.traceNav === 'timeline') {
    const timeline = TraceViews.timeline(trace.observations), visible = new Set(rows.map(row => row.id));
    return `<div class="timeline-axis"><span>조회 구간 · 0s</span><span>${traceTime(timeline.duration)}</span></div>${timeline.rows.filter(mark => visible.has(mark.row.id)).map(mark => `<button id="observation-${esc(mark.row.id)}" class="timeline-observation occurrence-item ${S.traceScope === 'observation' && S.observationId === mark.row.id ? 'selected' : ''}" aria-pressed="${S.observationId === mark.row.id && S.traceScope === 'observation'}" onclick="selectObservation(${esc(JSON.stringify(mark.row.id))})"><span class="timeline-label"><strong>${esc(mark.row.name)}</strong><small>${mark.missing ? '시작 미제공' : mark.unknownEnd ? `${traceTime(mark.start)} · 종료 미확인` : traceTime(mark.duration)}</small></span><span class="timeline-track" aria-hidden="true">${mark.missing ? '<span class="timeline-missing">시각 없음</span>' : `<span class="timeline-bar ${mark.row.type === 'GENERATION' ? 'generation' : ''} ${mark.row.level === 'ERROR' ? 'error-bar' : ''} ${mark.unknownEnd ? 'unknown-end' : ''}" style="left:${mark.left}%;width:${mark.width}%"></span>`}</span></button>`).join('')}<p class="hierarchy-note">겹친 구간은 그대로 표시 · 임계 경로 추정 없음</p>`;
  }
  return `<div class="node-occurrences"><div class="section-label">호출 목록 <span>시작 시각 순</span></div>${rows.map(row => traceObservationRow(row)).join('')}</div>`;
}
function traceObservationRow(row, note = '') {
  const selected = S.traceScope === 'observation' && row.id === S.observationId;
  return `<button id="observation-${esc(row.id)}" class="occurrence-item inspected-occurrence ${selected ? 'selected' : ''}" aria-pressed="${selected}" onclick="selectObservation(${esc(JSON.stringify(row.id))})"><span><strong>${esc(row.name)}</strong><small>${esc(note || row.type || '종류 미제공')} · ${esc(row.duration)}</small><span class="observation-row-id">${esc(row.id)}</span></span>${row.level === 'ERROR' ? '<span class="level-dot error-dot" title="ERROR">!</span>' : row.level === 'WARNING' ? '<span class="level-dot warning-dot" title="WARNING">!</span>' : ''}</button>`;
}
function selectTraceRoot() {
  if (!S.traceData) return;
  stopReplay(); rememberRecordScroll(); S.traceScope = 'trace'; S.observationId = null; S.selectedNodeId = null; S.turnId = null; S.mappingNote = null; TraceTools.view = 'io'; render('inspector'); focusTarget('inspect-heading');
}
function setTraceInspectView(view) {
  if (!['io','metadata','scores','log'].includes(view) || (view === 'log' && S.traceScope !== 'trace')) return;
  stopReplay(); rememberRecordScroll(); TraceTools.view = view; render('inspector'); focusTarget(`inspect-tab-${view}`);
}
function setTraceFormat(format) {
  if (!['json','formatted'].includes(format)) return;
  stopReplay(); rememberRecordScroll(); TraceTools.format = format; render('inspector'); focusTarget(`format-${format}`);
}
function tracePayload(label, value, id) {
  const data = value === undefined ? null : value;
  return `<div class="payload-section"><div class="section-label">${label === 'INPUT' ? '입력' : '출력'}</div>${TraceTools.format === 'json' ? `<pre id="${id}" class="code" tabindex="0" aria-label="${label === 'INPUT' ? '입력' : '출력'} 기록">${data === null ? 'null' : esc(JSON.stringify(data,null,2))}</pre>` : `<div id="${id}" class="formatted-payload" tabindex="0" aria-label="${label === 'INPUT' ? '입력' : '출력'} 기록">${formattedTraceValue(data)}</div>`}</div>`;
}
function formattedTraceValue(value, depth = 0) {
  if (value === null || value === undefined) return '<span class="payload-null">미제공 · null</span>';
  if (typeof value !== 'object') return `<span class="payload-text">${esc(String(value))}</span>`;
  if (depth > 3) return `<pre class="nested-json">${esc(JSON.stringify(value,null,2))}</pre>`;
  if (Array.isArray(value) && value.every(row => row && typeof row === 'object' && typeof row.role === 'string' && Object.hasOwn(row,'content'))) return value.map(message => `<article class="payload-message"><strong>${esc(message.role)}</strong><div>${formattedTraceValue(message.content,depth+1)}</div></article>`).join('') || '<span>[]</span>';
  if (Array.isArray(value)) return value.length ? `<ol class="payload-array">${value.map(row => `<li>${formattedTraceValue(row,depth+1)}</li>`).join('')}</ol>` : '<span>[]</span>';
  return Object.keys(value).length ? `<dl class="payload-object">${Object.entries(value).map(([key,child]) => `<div><dt>${esc(key)}</dt><dd>${formattedTraceValue(child,depth+1)}</dd></div>`).join('')}</dl>` : '<span>{}</span>';
}
function traceMetadataRows(entries) {
  return `<dl class="trace-properties">${entries.map(([key,value]) => `<div><dt>${esc(key)}</dt><dd>${value === null || value === undefined || value === '' ? '—' : esc(typeof value === 'object' ? JSON.stringify(value) : value)}</dd></div>`).join('')}</dl>`;
}
function traceMetricStrip(record, root) {
  const metrics = TraceViews.metrics(record), latency = root ? TraceViews.number(record.latency) : null;
  const fields = root ? [['Trace 지연',latency === null ? '—' : `${latency.toFixed(2)}s`],['Trace 비용',traceMoney(record.cost)]] : [['지연',traceTime(metrics.duration)],['TTFT',traceTime(metrics.ttft)],['사용량',metrics.tokens === null ? '—' : `${metrics.tokens.toLocaleString()} ${metrics.unit === 'TOKENS' ? 'tok' : esc(metrics.unit)}`],['비용',traceMoney(metrics.cost)]];
  return `<div class="observability-metrics">${fields.map(([label,value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}${!root && record.model ? `<div class="model-metric"><span>모델</span><strong>${esc(record.model)}</strong></div>` : ''}</div>`;
}
function traceScoreTable(scores, empty) {
  return scores.length ? `<div class="table-wrap trace-score-table"><table><thead><tr><th>이름</th><th>값</th><th>출처 · 형식</th></tr></thead><tbody>${scores.map(score => `<tr><td><strong>${esc(score.name || '이름 없음')}</strong>${score.comment ? `<small>${esc(score.comment)}</small>` : ''}</td><td>${esc(score.stringValue ?? score.value ?? '—')}</td><td>${esc(score.source || '미제공')} · ${esc(score.dataType || '미제공')}</td></tr>`).join('')}</tbody></table></div>` : `<div class="trace-section-empty">${empty}</div>`;
}
function traceInspectorBody(trace, record, root) {
  const view = TraceTools.view === 'log' && !root ? 'io' : TraceTools.view;
  if (view === 'metadata') {
    const entries = root ? [['Trace ID',trace.traceId],['Session ID',trace.sessionId],['User ID',trace.userId],['환경',trace.environment],['태그',trace.tags],['Release / Version',`${trace.release || '—'} / ${trace.version || '—'}`],['기록 시각',trace.timestamp]] : [['Observation ID',record.id],['종류 / Level',`${record.type || '—'} / ${record.level || '—'}`],['부모 관측',record.parentId],['시작',record.startTime],['종료',record.endTime],['첫 출력',record.completionStartTime],['모델',record.model],['모델 파라미터',record.modelParameters],['사용량',record.usage],['Usage details',record.usageDetails],['Cost details',record.costDetails],['입력 / 출력 비용',`${traceMoney(record.inputCost)} / ${traceMoney(record.outputCost)}`],['소유 노드',record.ownerNodeId],['수행 ID',record.invocationId],['시도 ID',record.attemptId],['명시된 선행 수행',record.predecessorInvocationIds],['상태 메시지',record.statusMessage]];
    return `${traceMetadataRows(entries)}<details class="raw-metadata" open><summary>원본 metadata</summary><pre class="code" tabindex="0" aria-label="원본 메타데이터">${esc(JSON.stringify(record.metadata ?? null,null,2))}</pre></details><p class="inspection-note">—는 미제공 · 부모 계층은 인과선이 아니며 비용은 하위 관측과 합산하지 않습니다.</p>`;
  }
  if (view === 'scores') {
    const scores = TraceViews.scores(trace,root ? null : record.id), session = root ? TraceViews.sessionScores(trace) : [];
    return `<div class="scope-label">${root ? 'Trace 전체에 직접 연결된 점수' : '선택한 관측에 직접 연결된 점수'} · 읽기 전용</div>${traceScoreTable(scores,'직접 연결된 점수가 없습니다.')}${session.length ? `<details class="session-scores"><summary>세션 범위 점수 ${session.length}개 · Trace 점수 아님</summary>${traceScoreTable(session,'')}</details>` : ''}<p class="inspection-note">평가가 인용한 근거와 관측에 직접 연결된 점수는 별개입니다.</p>`;
  }
  if (view === 'log') {
    return `<div class="scope-label">관측 로그 · 조회된 기록의 시작 시각 순 · 런타임 stdout 아님</div><div class="trace-log">${TraceViews.chronological(trace.observations).map(row => `<button id="log-${esc(row.id)}" class="trace-log-row" onclick="selectObservation(${esc(JSON.stringify(row.id))})"><span>${esc(row.startTime || '시각 미제공')}</span><strong>${esc(row.name)} ${traceLevel(row.level)}</strong><small>${esc(row.type || '—')} · ${esc(row.id)}</small><p>${esc((row.statusMessage || (typeof row.output === 'string' ? row.output : JSON.stringify(row.output)) || '출력 미제공').slice(0,260))}</p></button>`).join('') || '<div class="trace-section-empty">조회된 관측이 없습니다.</div>'}</div>`;
  }
  return `<div class="io-format-toolbar"><span>${root ? 'Trace 원본 입출력' : '선택 관측 입출력'}</span><div role="group" aria-label="입출력 표시 형식"><button id="format-formatted" class="${TraceTools.format === 'formatted' ? 'active' : ''}" aria-pressed="${TraceTools.format === 'formatted'}" onclick="setTraceFormat('formatted')">읽기 형식</button><button id="format-json" class="${TraceTools.format === 'json' ? 'active' : ''}" aria-pressed="${TraceTools.format === 'json'}" onclick="setTraceFormat('json')">JSON</button></div></div>${typeof record.output?.total === 'number' ? `<div class="record-total">기록된 합계 <strong>${record.output.total.toLocaleString()}원</strong></div>` : ''}<div class="split record-data">${tracePayload('INPUT',record.input,'record-input')}${tracePayload('OUTPUT',record.output,'record-output')}</div>${!root ? observationMetadata(record) : ''}`;
}
function observabilityInspector(trace, root = false) {
  const record = root ? trace : currentObservation(); if (!record) return '';
  const node = !root && trace.design?.nodes.find(n => n.id === record.ownerNodeId), rows = !root ? trace.observations.filter(o => o.ownerNodeId && o.ownerNodeId === record.ownerNodeId) : [];
  const view = TraceTools.view === 'log' && !root ? 'io' : TraceTools.view, status = {completed:'종료 기록 있음',error:'관측 오류',open:'종료 시각 없음'}[record.status] || '상태 미확인';
  const tabs = [['io','입출력'],['metadata','메타데이터'],['scores','점수'],...(root ? [['log','로그']] : [])];
  return `<div class="inspect-head"><div><span class="inspector-eyebrow">${root ? 'Trace 전체' : `${esc(node?.name || '노드 미연결')} ${icon('chevronRight',10)} 호출 ${record.attempt || '—'}${rows.length ? ` · 조회된 관측 ${rows.length}개` : ''}`}</span><h2 id="inspect-heading" tabindex="-1">${esc(root ? trace.name : record.operation)}</h2><span class="tiny">${root ? esc(trace.environment || '환경 미제공') : `${esc(record.type || '종류 미제공')} · ${status}`}</span></div>${!root && record.ownerNodeId === 'node_payment_query' ? btn('설정 열기','editLinkedNode()','quiet',!!S.loading,'edit-owner') : ''}</div><div class="observation-id">${esc(root ? trace.traceId : record.id)}${!root ? `<span>${esc(record.invocationId || '수행 ID 미제공')}</span>` : ''}</div>${!root && (record.level === 'ERROR' || record.level === 'WARNING') ? `<div class="observation-alert ${record.level === 'ERROR' ? 'is-error' : ''}" role="status">${traceLevel(record.level)}<span>${esc(record.statusMessage || '상태 메시지 미제공')}</span></div>` : ''}${traceMetricStrip(record,root)}<div class="inspection-tabs" role="group" aria-label="기록 상세 보기">${tabs.map(([key,label])=>`<button id="inspect-tab-${key}" class="${view === key ? 'active' : ''}" aria-pressed="${view === key}" onclick="setTraceInspectView('${key}')">${label}${key === 'scores' ? ` <span>${TraceViews.scores(trace,root ? null : record.id).length}</span>` : ''}</button>`).join('')}</div><div class="inspection-body">${traceInspectorBody(trace,record,root)}</div><div class="inspector-footnote">읽기 전용${root ? ' · 미제공 값은 —' : ' · 설정 편집은 별도 후보'}</div>`;
}
async function showSameSessionRuns() {
  const sessionId = S.runSummary?.sessionId; if (!sessionId) return;
  stopReplay(); S.runList.view = {scroll:0,focusId:'run-session'}; showTraceList(); await selectRunSession(sessionId); if(S.tab === 'trace' && S.tracePage === 'list') focusTarget('run-session');
}
