'use strict';
// Browser and Node share this transport-independent contract implementation.
(function(root){
  const URI='urn:kpap:graph-config:1';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const fail=(code,path,message)=>{throw Object.assign(new Error(message),{code,path});};
  const keys=(v,allowed,path)=>{if(!object(v))fail('INVALID_VALUE',path,'객체가 필요합니다.');for(const k of Object.keys(v))if(!allowed.includes(k))fail('UNKNOWN_FIELD',path+'.'+k,'지원하지 않는 필드입니다.');};
  function value(v,s,path){
    if(!s||!['string','integer','number','boolean','array','object'].includes(s.type))fail('UNSUPPORTED_SCHEMA',path,'지원하지 않는 스키마입니다.');
    const valid=s.type==='object'?object(v):s.type==='array'?Array.isArray(v):s.type==='integer'?Number.isInteger(v):s.type==='number'?typeof v==='number'&&Number.isFinite(v):typeof v===s.type;
    if(!valid)fail('INVALID_VALUE',path,s.type+' 값이 필요합니다.');
    if(s.enum&&!s.enum.some(x=>JSON.stringify(x)===JSON.stringify(v)))fail('INVALID_VALUE',path,'허용 목록에 없는 값입니다.');
    if(typeof v==='string'&&((s.minLength!==undefined&&v.length<s.minLength)||(s.maxLength!==undefined&&v.length>s.maxLength)))fail('INVALID_VALUE',path,'문자열 길이를 확인하세요.');
    if(typeof v==='number'&&((s.minimum!==undefined&&v<s.minimum)||(s.maximum!==undefined&&v>s.maximum)))fail('INVALID_VALUE',path,'숫자 범위를 확인하세요.');
    if(Array.isArray(v)){if((s.maxItems!==undefined&&v.length>s.maxItems)||(s.minItems!==undefined&&v.length<s.minItems))fail('INVALID_VALUE',path,'항목 수를 확인하세요.');if(s.uniqueItems&&new Set(v.map(x=>JSON.stringify(x))).size!==v.length)fail('INVALID_VALUE',path,'중복 항목입니다.');v.forEach((x,i)=>value(x,s.items,path+'['+i+']'));}
    if(object(v)){for(const k of s.required||[])if(!Object.hasOwn(v,k))fail('INVALID_VALUE',path+'.'+k,'필수 값입니다.');for(const [k,x]of Object.entries(v)){if(!Object.hasOwn(s.properties||{},k))fail('UNKNOWN_FIELD',path+'.'+k,'지원하지 않는 필드입니다.');value(x,s.properties[k],path+'.'+k);}}
  }
  function schema(s,path,depth=0){
    if(depth>8)fail('UNSUPPORTED_SCHEMA',path,'스키마 중첩 한도는 8입니다.');
    keys(s,['type','properties','required','additionalProperties','items','enum','minimum','maximum','minLength','maxLength','minItems','maxItems','uniqueItems','title','description'],path);
    if(!['string','integer','number','boolean','array','object'].includes(s.type))fail('UNSUPPORTED_SCHEMA',path,'스키마 타입이 필요합니다.');
    if(s.type==='object'){if(!object(s.properties)||s.additionalProperties!==false)fail('UNSUPPORTED_SCHEMA',path,'properties와 additionalProperties:false가 필요합니다.');for(const [k,x]of Object.entries(s.properties))schema(x,path+'.'+k,depth+1);if(s.required&&(!Array.isArray(s.required)||s.required.some(k=>!Object.hasOwn(s.properties,k))))fail('UNSUPPORTED_SCHEMA',path,'required 필드를 확인하세요.');}
    if(s.type==='array')schema(s.items,path+'.items',depth+1);
    for(const k of ['minimum','maximum','minLength','maxLength','minItems','maxItems'])if(s[k]!==undefined&&(typeof s[k]!=='number'||!Number.isFinite(s[k])))fail('UNSUPPORTED_SCHEMA',path+'.'+k,'수치 제한이 필요합니다.');
    if(s.enum!==undefined&&(!Array.isArray(s.enum)||!s.enum.length))fail('UNSUPPORTED_SCHEMA',path+'.enum','비어 있지 않은 목록이 필요합니다.');
  }
  function canonical(c,path){
    const ref={type:'string',minLength:1,maxLength:200};
    const specs={prompt:{type:'string',minLength:1,maxLength:8000},model:ref,tools:{type:'array',uniqueItems:true,maxItems:100,items:ref},knowledge:{type:'object',additionalProperties:false,required:['resourceId','version','topK'],properties:{resourceId:ref,version:ref,topK:{type:'integer',minimum:1,maximum:100}}}};
    for(const [k,v]of Object.entries(c))value(v,specs[k],path+'.'+k);
  }
  function graph(g){
    keys(g,['schemaVersion','agentId','version','nodes','edges'],'graph');
    if(g.schemaVersion!=='1.0')fail('UNSUPPORTED_SCHEMA','schemaVersion','지원하는 그래프 규격은 1.0입니다.');
    if(typeof g.agentId!=='string'||!g.agentId.trim()||typeof g.version!=='string'||!g.version.trim())fail('INVALID_GRAPH','version','에이전트 ID와 그래프 버전이 필요합니다.');
    if(!Array.isArray(g.nodes)||!g.nodes.length||g.nodes.length>100||!Array.isArray(g.edges)||g.edges.length>300)fail('INVALID_GRAPH','nodes','노드 1–100개, 연결 최대 300개가 필요합니다.');
    const ids=new Set();
    for(const n of g.nodes){
      keys(n,['id','name','type','parentId','config','configSchema','editable'],'nodes');
      if(typeof n.id!=='string'||!/^[-a-zA-Z0-9_]+$/.test(n.id)||['__proto__','constructor','prototype'].includes(n.id)||ids.has(n.id))fail('INVALID_GRAPH','nodes.id','노드 ID는 고유한 영문·숫자·밑줄·하이픈이어야 합니다.');ids.add(n.id);
      if(!['input','output','llm','tool','rag','react','group','custom'].includes(n.type))fail('INVALID_GRAPH',n.id,'지원하지 않는 노드 종류입니다.');
      if(n.name!==undefined&&typeof n.name!=='string')fail('INVALID_GRAPH',n.id,'노드 이름은 문자열입니다.');
      keys(n.config||{},['prompt','model','tools','knowledge'],n.id+'.config');
      canonical(n.config||{},n.id+'.config');
      if(n.configSchema){schema(n.configSchema,n.id+'.configSchema');if(n.configSchema.type!=='object')fail('UNSUPPORTED_SCHEMA',n.id,'노드 설정 스키마는 객체입니다.');value(n.config||{},n.configSchema,n.id+'.config');}
      else if(Object.keys(n.config||{}).length)fail('UNSUPPORTED_SCHEMA',n.id,'설정에는 스키마가 필요합니다.');
      if(!Array.isArray(n.editable||[])||new Set(n.editable||[]).size!==(n.editable||[]).length)fail('INVALID_GRAPH',n.id,'editable은 중복 없는 목록입니다.');
      for(const k of n.editable||[])if(!Object.hasOwn(n.config||{},k)||!Object.hasOwn(n.configSchema?.properties||{},k))fail('INVALID_GRAPH',n.id+'.editable','설정과 스키마에 선언된 키만 편집할 수 있습니다.');
    }
    for(const n of g.nodes){let p=n,seen=new Set([n.id]);while(p.parentId!==undefined){const parent=g.nodes.find(x=>x.id===p.parentId);if(!parent||parent.type!=='group'||seen.has(parent.id))fail('INVALID_GRAPH',n.id+'.parentId','그룹 참조 또는 순환을 확인하세요.');seen.add(parent.id);p=parent;}}
    const edges=new Set();for(const e of g.edges){keys(e,['source','target','kind','label'],'edges');if(!ids.has(e.source)||!ids.has(e.target))fail('INVALID_GRAPH','edges','연결의 노드가 없습니다.');if(!['normal','conditional','loop','parallel'].includes(e.kind||'normal'))fail('INVALID_GRAPH','edges.kind','지원하지 않는 연결 종류입니다.');if(e.label!==undefined&&typeof e.label!=='string')fail('INVALID_GRAPH','edges.label','연결 이름은 문자열입니다.');const id=JSON.stringify(e);if(edges.has(id))fail('INVALID_GRAPH','edges','중복 연결입니다.');edges.add(id);}
    return clone(g);
  }
  function resolve(g,k,authorize=()=>true){
    graph(g);
    const configs=Object.fromEntries(g.nodes.map(n=>[n.id,clone(n.config||{})]));
    if(k===undefined)k={contractVersion:'1.0',graphVersion:g.version,overrides:[]};
    keys(k,['contractVersion','graphVersion','overrides'],'metadata.kpap');
    if(k.contractVersion!=='1.0')fail('UNSUPPORTED_EXTENSION','contractVersion','지원하는 확장 규격은 1.0입니다.');
    if(k.graphVersion!==g.version)fail('GRAPH_VERSION_MISMATCH','graphVersion','그래프를 다시 조회하세요.');
    if(!Array.isArray(k.overrides)||k.overrides.length>g.nodes.length)fail('INVALID_VALUE','overrides','변경 목록을 확인하세요.');
    const seen=new Set();for(const o of k.overrides){keys(o,['nodeId','config'],'overrides');const n=g.nodes.find(x=>x.id===o.nodeId);if(!n||seen.has(o.nodeId))fail('INVALID_NODE','overrides.nodeId','없는 노드 또는 중복 노드입니다.');seen.add(o.nodeId);keys(o.config,n.editable||[],o.nodeId+'.config');for(const [key,v]of Object.entries(o.config)){value(v,n.configSchema.properties[key],o.nodeId+'.'+key);configs[o.nodeId][key]=clone(v);}}
    for(const [id,c]of Object.entries(configs))canonical(c,id+'.config');
    // Check every effective resource, including unchanged defaults, after validation.
    for(const [id,c]of Object.entries(configs))for(const [key,v]of Object.entries(c))if(!authorize(id,key,v))fail('RESOURCE_FORBIDDEN',id+'.'+key,'해당 자원을 사용할 권한이 없습니다.');
    return configs;
  }
  function request(g,configs,input,id='preview'){
    if(typeof input!=='string'||!input.trim())fail('INVALID_VALUE','message','입력을 작성하세요.');
    const overrides=[];for(const n of g.nodes){const config={};for(const key of n.editable||[])if(JSON.stringify(configs[n.id]?.[key])!==JSON.stringify(n.config?.[key]))config[key]=configs[n.id]?.[key];if(Object.keys(config).length)overrides.push({nodeId:n.id,config});}
    const k={contractVersion:'1.0',graphVersion:g.version,overrides};resolve(g,k);
    return {headers:{'Content-Type':'application/json','A2A-Version':'1.0','A2A-Extensions':URI},body:{jsonrpc:'2.0',id,method:'SendMessage',params:{message:{messageId:'msg-'+id,role:'ROLE_USER',parts:[{text:input}]},metadata:{kpap:k}}}};
  }
  function accept(g,req,authorize){
    if(req.headers?.['A2A-Version']!=='1.0')fail('UNSUPPORTED_VERSION','A2A-Version','A2A 1.0이 필요합니다.');
    if(req.body?.jsonrpc!=='2.0'||req.body?.method!=='SendMessage')fail('INVALID_REQUEST','method','SendMessage 요청이 필요합니다.');
    const k=req.body.params?.metadata?.kpap;
    if(k!==undefined&&!String(req.headers?.['A2A-Extensions']||'').split(',').map(x=>x.trim()).includes(URI))fail('EXTENSION_REQUIRED','A2A-Extensions','확장 활성화 헤더가 필요합니다.');
    return resolve(g,k,authorize);
  }
  root.KPAPContract={URI,clone,validateGraph:graph,resolve,buildRequest:request,accept};
  if(typeof module!=='undefined')module.exports=root.KPAPContract;
})(typeof globalThis!=='undefined'?globalThis:this);
