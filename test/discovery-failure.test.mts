// Real missing-schema regression. No upstream requests or production DB.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createClient} from '@libsql/client';
import {DiscoveryService} from '../lib/discovery';
import {LibSqlCoordStore} from '../lib/discovery-coord';
const dir=await mkdtemp(tmpdir()+'/packproof-missing-schema-');const db=createClient({url:'file:'+dir+'/db'});
let calls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('Unexpected upstream access')};
const originalError=console.error;const logs:string[]=[];console.error=(s)=>logs.push(String(s));let checks=0;const check=(x:unknown)=>{assert(x);checks++};
try{
 process.env.PACKPROOF_STORE='';
 const service=new DiscoveryService(new LibSqlCoordStore(async()=>db));
 const snapshot=await service.getDiscovery();check(snapshot.freshFailed);check(snapshot.freshNotableFailed);check(snapshot.topByCategory.every(c=>c.failed));check(snapshot.cache==='miss');
 const search=await service.searchDiscovery('captions','all');check(search.failed);check(search.repos.length===0);check(search.q==='captions');check(search.scope==='all');check(!JSON.stringify(search).includes('SQLITE'));
 check(calls===0);check(logs.length===2);check(logs.every(s=>!s.includes(dir)&&!s.includes('SQLITE')&&s.includes('discovery_unavailable')));
 // The failure is not cached forever: adding the actual migration recovers
 // coordination on the same service/connection without process restart.
 await db.execute(await readFile('migrations/0003_discovery_coord.sql','utf8'));
 const coord=new LibSqlCoordStore(async()=>db);check(await coord.claimCall(Date.now(),60000,8));
 // Transport/database failures also fail closed and redact their reason.
 const broken=new DiscoveryService(new LibSqlCoordStore(async()=>{throw Error('private-db-host token=secret')}));
 check((await broken.searchDiscovery('video')).failed);check((await broken.getDiscovery()).freshFailed);check(calls===0);check(!logs.some(x=>x.includes('private-db-host')||x.includes('token=')));
 console.log(JSON.stringify({discoveryFailureChecks:checks,upstreamCalls:calls,missingSchema:true,liveDatabase:false}));
}finally{globalThis.fetch=originalFetch;console.error=originalError;db.close();await rm(dir,{recursive:true,force:true})}
