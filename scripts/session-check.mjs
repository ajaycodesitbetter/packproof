// Offline-only session/API integration. Creates no account or public endpoint.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {encode} from 'next-auth/jwt';
import {createClient} from '@libsql/client';
const dir=await mkdtemp(tmpdir()+'/packproof-session-');const url='file:'+dir+'/db';const db=createClient({url});await db.execute(await readFile('migrations/0001_library.sql','utf8'));
const secret=randomBytes(48).toString('hex');const base='http://localhost:3101';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3101'],{env:{...process.env,AUTH_SECRET:secret,AUTH_URL:base,PACKPROOF_STORE:'libsql',TURSO_DATABASE_URL:url,PACKPROOF_LOCAL_STORE:'0'},stdio:'pipe'});let logs='';server.stderr.on('data',d=>{logs+=d});server.stdout.on('data',()=>{});
let checks=0;const check=(x)=>{assert(x);checks++};
async function cookie(sub,maxAge=300){return 'authjs.session-token='+await encode({secret,salt:'authjs.session-token',token:{sub,name:'Synthetic test identity'},maxAge})}
const get=c=>fetch(base+'/api/library',{headers:c?{cookie:c}:{}});
const post=(c,body,origin=base)=>fetch(base+'/api/library',{method:'POST',headers:{cookie:c,origin,'content-type':'application/json'},body:JSON.stringify(body)});
try{
 for(let i=0;i<80;i++){try{await get();break}catch{await new Promise(r=>setTimeout(r,100))}}
 const a=await cookie('local-alice'),b=await cookie('local-bob');
 check((await get()).status===401);check((await get('authjs.session-token=forged')).status===401);check((await get(await cookie('expired',-600))).status===401);
 check((await post(a,{slug:'pr-review-pass',saved:true,userId:'local-bob'})).status===200);
 check((await (await get(a)).json()).slugs.includes('pr-review-pass'));check(!(await (await get(b)).json()).slugs.includes('pr-review-pass'));
 check((await post(b,{slug:'pr-review-pass',saved:true})).status===200);check((await post(b,{slug:'pr-review-pass',saved:false})).status===200);check((await (await get(a)).json()).slugs.includes('pr-review-pass'));
 check((await post(a,{slug:'pr-review-pass',saved:false},'https://untrusted.test')).status===403);check((await (await get(a)).json()).slugs.includes('pr-review-pass'));
 const start=performance.now();const burst=await Promise.all(Array.from({length:100},()=>get()));check(burst.every(r=>r.status===401));check(performance.now()-start<10000);
 check(!logs.includes(secret));console.log(JSON.stringify({signedSessionHTTPChecks:checks,localAnonymousBurst:100,externalOAuth:false,liveTraffic:false}));
}finally{server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));db.close();await rm(dir,{recursive:true,force:true})}
