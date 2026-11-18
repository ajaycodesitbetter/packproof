// Route-level contract test. All network dependencies are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const snapshot={refreshedAt:new Date(0).toISOString(),cache:'hit',fresh:[],freshNotable:[],topByCategory:[]};
function loadPage(source, delays={shelf:0,query:0}) {
  const calls=[];
  const mod={exports:{}};
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const deps={getDiscovery:async()=>{calls.push('shelves');await sleep(delays.shelf);return snapshot},searchDiscovery:async(q,scope)=>{calls.push({q,scope});await sleep(delays.query);return{q,scope,refreshedAt:new Date(0).toISOString(),repos:[],failed:false}}};
  vm.runInNewContext(compiled,{exports:mod.exports,module:mod,require:id=>id==='@/lib/discovery'?deps:id.startsWith('@/components/')?{__esModule:true,default:()=>null}:require(id)});
  return {page:mod.exports.default,calls};
}
(async()=>{
  const source=fs.readFileSync('app/discover/page.tsx','utf8');
  const current=loadPage(source);
  const result=await current.page({searchParams:Promise.resolve({q:' design ',scope:'all'})});
  assert.deepEqual(current.calls,[{q:'design',scope:'all'}]);
  const html=renderToStaticMarkup(result);
  assert(html.includes('Browse discovery shelves'));
  assert(!html.includes('Fresh skill repos this week'));
  const browse=loadPage(source);
  await browse.page({searchParams:Promise.resolve({})});
  assert.deepEqual(browse.calls,['shelves']);
  const invalid=loadPage(source);
  await invalid.page({searchParams:Promise.resolve({q:'test',scope:'invalid'})});
  assert.deepEqual(invalid.calls,[{q:'test',scope:'skills'}]);
  console.log('PASS: query skips shelves, keeps trimmed query/scope; browse still loads shelves; invalid scope normalizes.');
  // A reproducible delay model, NOT measured production performance.
  const baseline=fs.readFileSync('test/fixtures/discover-before-search.tsx.txt','utf8');
  for(const [label,code] of [['before',baseline],['after',source]]){
    const run=loadPage(code,{shelf:600,query:80}); const start=performance.now();
    await run.page({searchParams:Promise.resolve({q:'design'})});
    console.log(`MOCKED ${label}: ${Math.round(performance.now()-start)}ms (shelves=600ms, query=80ms)`);
  }
})().catch(e=>{console.error(e);process.exitCode=1});
