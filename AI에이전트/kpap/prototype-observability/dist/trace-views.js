/* Client-side views over the observations already returned by the adapter.
 * Parent hierarchy is not causality. No aggregate usage/cost is synthesized. */
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.TraceViews=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
  const time=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
  function chronological(rows){return rows.map((row,index)=>({row,index,start:time(row.startTime)})).sort((a,b)=>a.start===null?(b.start===null?a.index-b.index:1):b.start===null?-1:a.start-b.start||a.index-b.index).map(x=>x.row);}
  function matches(row,filter={}){
    const query=(filter.query||'').trim().toLowerCase();
    return (!query||[row.name,row.operation,row.id,row.type].join(' ').toLowerCase().includes(query))&&(!filter.type||row.type===filter.type)&&(!filter.level||(row.level||'UNKNOWN')===filter.level);
  }
  function filtered(rows,filter){return chronological(rows).filter(row=>matches(row,filter));}
  function tree(rows,filter={},collapsed=new Set()){
    const ordered=chronological(rows),byId=new Map(ordered.map(row=>[row.id,row])),parents=new Map(),issues=new Map();
    for(const row of ordered){
      const seen=new Set([row.id]);let parent=row.parentId,cycle=false;
      while(parent&&byId.has(parent)){if(seen.has(parent)){cycle=true;break;}seen.add(parent);parent=byId.get(parent).parentId;}
      parents.set(row.id,!cycle&&row.parentId&&byId.has(row.parentId)?row.parentId:null);
      if(cycle) issues.set(row.id,'순환 부모 관계');
      else if(row.parentId&&!byId.has(row.parentId)) issues.set(row.id,'부모 미조회');
    }
    const matching=new Set(ordered.filter(row=>matches(row,filter)).map(row=>row.id)),included=new Set(matching);
    for(const id of matching){let parent=parents.get(id);while(parent){included.add(parent);parent=parents.get(parent);}}
    const children=new Map();for(const row of ordered){const parent=parents.get(row.id);if(!children.has(parent))children.set(parent,[]);children.get(parent).push(row);}
    const result=[],filtering=!!((filter.query||'').trim()||filter.type||filter.level);
    function visit(parent,depth){for(const row of children.get(parent)||[]){if(!included.has(row.id))continue;const hasChildren=(children.get(row.id)||[]).some(child=>included.has(child.id));result.push({row,depth,hasChildren,collapsed:collapsed.has(row.id)&&!filtering,context:!matching.has(row.id),issue:issues.get(row.id)||null});if(!collapsed.has(row.id)||filtering)visit(row.id,depth+1);}}
    visit(null,0);return {rows:result,matched:matching.size,total:rows.length};
  }
  function timeline(rows){
    const sorted=chronological(rows),starts=sorted.map(row=>time(row.startTime)).filter(v=>v!==null),origin=starts.length?Math.min(...starts):null;
    const extent=sorted.map(row=>{const start=time(row.startTime),end=time(row.endTime);return start===null?null:end!==null&&end>=start?end:start;}).filter(v=>v!==null);
    const duration=origin===null?0:Math.max(0,Math.max(...extent)-origin);
    return {origin,duration,rows:sorted.map(row=>{const start=time(row.startTime),end=time(row.endTime),validEnd=start!==null&&end!==null&&end>=start;return {row,start:start===null?null:start-origin,duration:validEnd?end-start:null,unknownEnd:start!==null&&!validEnd,missing:start===null,left:start===null||!duration?0:(start-origin)/duration*100,width:validEnd&&duration?(end-start)/duration*100:0};})};
  }
  function metrics(record){
    const start=time(record.startTime),end=time(record.endTime),completion=time(record.completionStartTime),usage=record.usage||{},details=record.usageDetails||{};
    return {duration:start!==null&&end!==null&&end>=start?end-start:null,ttft:completion!==null&&start!==null&&completion>=start&&(end===null||completion<=end)?completion-start:number(record.timeToFirstToken)!==null&&record.timeToFirstToken>=0?record.timeToFirstToken*1000:null,tokens:number(usage.total)??number(details.total),input:number(usage.input)??number(details.input),output:number(usage.output)??number(details.output),unit:usage.unit||'TOKENS',cost:number(record.cost)};
  }
  function scores(trace,observationId=null){return (trace.scores||[]).filter(score=>observationId?score.observationId===observationId&&(!score.traceId||score.traceId===trace.traceId):!score.observationId&&score.traceId===trace.traceId);}
  function sessionScores(trace){return (trace.scores||[]).filter(score=>!score.observationId&&!score.traceId&&score.sessionId===trace.sessionId);}
  return {number,time,chronological,matches,filtered,tree,timeline,metrics,scores,sessionScores};
});
