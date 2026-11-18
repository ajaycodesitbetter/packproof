import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createClient } from '@libsql/client';
import { createLibraryHandlers } from '../lib/library-http';
const dir=await mkdtemp(tmpdir()+'/packproof-http-');
process.env.NODE_ENV='production'; process.env.PACKPROOF_STORE='libsql'; process.env.TURSO_DATABASE_URL='file:'+dir+'/library.db';
const db=createClient({url:process.env.TURSO_DATABASE_URL});
await db.execute(await readFile('migrations/0001_library.sql','utf8'));
const store=await import('../lib/library');
let identity:string|null=null;let failures:string[]=[];let checks=0;
const h=createLibraryHandlers({identity:async()=>identity,...store,knownSlug:s=>['pack-a','pack-b'].includes(s),reportFailure:o=>failures.push(o)});
const check=(value:unknown)=>{assert(value);checks++};
const req=(body:unknown,headers:Record<string,string>={})=>new Request('https://local.test/api/library',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
try {
 check((await h.GET()).status===401);check((await h.POST(req({slug:'pack-a',saved:true}))).status===401);
 identity='alice';
 for(const headers of [{origin:'https://evil.test'},{origin:''},{'sec-fetch-site':'cross-site'}])check((await h.POST(req({slug:'pack-a',saved:true},headers))).status===403);
 check((await h.POST(req({}, {'content-type':'text/plain'}))).status===415);
 check((await h.POST(req('x'.repeat(2049)))).status===413);
 check((await h.POST(req('{}',{'content-length':'9999'}))).status===413);
 for(const body of ['{',null,[],false])check((await h.POST(req(body))).status===400);
 check((await h.POST(req({slug:{},saved:true}))).status===404);
 check((await h.POST(req({slug:'missing',saved:true}))).status===404);
 check((await h.POST(req({slug:'pack-a',saved:'true'}))).status===400);
 let r=await h.POST(req({slug:'pack-a',saved:true,userId:'bob'}));check(r.status===200);check(r.headers.get('cache-control')==='private, no-store');
 check(JSON.stringify(await store.getLibrary('alice'))==='["pack-a"]');check((await store.getLibrary('bob')).length===0);
 identity='bob';check((await h.GET()).status===200);check(JSON.stringify(await (await h.GET()).json())==='{"slugs":[]}');
 await h.POST(req({slug:'pack-a',saved:true}));check((await store.getLibrary('bob')).length===1);
 await h.POST(req({slug:'pack-a',saved:false}));check((await store.getLibrary('bob')).length===0);check((await store.getLibrary('alice')).length===1);
 await Promise.all(Array.from({length:50},()=>store.setInLibrary('alice','pack-b',true)));check((await store.getLibrary('alice')).length===2);
 const weird="' OR 1=1 --";await store.setInLibrary(weird,'pack-a',true);check((await store.getLibrary(weird)).length===1);check((await store.getLibrary('bob')).length===0);
 const broken=createLibraryHandlers({identity:async()=> 'alice',getLibrary:async()=>{throw Error('secret internal detail')},setInLibrary:async()=>{throw Error('secret internal detail')},knownSlug:()=>true,reportFailure:o=>failures.push(o)});
 for(const r of [await broken.GET(),await broken.POST(req({slug:'pack-a',saved:true}))]){check(r.status===503);check(!(await r.text()).includes('secret'));}
 check(failures.join(',')==='read,write');
 const start=performance.now();const results=await Promise.all(Array.from({length:100},()=>h.GET()));check(results.every(r=>r.status===200));check(performance.now()-start<10000);
 console.log(JSON.stringify({libraryBoundaryChecks:checks,syntheticIdentities:3,concurrentDuplicateWrites:50,localReadBurst:100,externalOAuth:false}));
} finally {db.close();await rm(dir,{recursive:true,force:true});}
