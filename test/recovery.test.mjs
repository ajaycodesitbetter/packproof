import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createClient} from '@libsql/client';
import {backupLocal,restoreLocal} from '../scripts/library-recovery.mjs';
const d=await mkdtemp(tmpdir()+'/packproof-recovery-');let checks=0;const check=x=>{assert(x);checks++};
try{
 const db=createClient({url:'file:'+d+'/original.db'});await db.execute(await readFile('migrations/0001_library.sql','utf8'));
 for(const user of ['synthetic-alice','synthetic-bob'])await db.execute({sql:'INSERT INTO library_saves(user_id,slug)VALUES(?,?)',args:[user,'pr-review-pass']});
 const original=(await db.execute('SELECT * FROM library_saves ORDER BY user_id,slug')).rows;db.close();
 check(await backupLocal(d+'/original.db',d+'/snapshot.json')===2);check(((await stat(d+'/snapshot.json')).mode&0o777)===0o600);
 check(await restoreLocal(d+'/snapshot.json',d+'/restored.db')===2);
 const restored=createClient({url:'file:'+d+'/restored.db'});check(JSON.stringify((await restored.execute('SELECT * FROM library_saves ORDER BY user_id,slug')).rows)===JSON.stringify(original));await restored.execute({sql:'INSERT INTO library_saves(user_id,slug)VALUES(?,?)',args:['synthetic-after-restore','pr-review-pass']});check((await restored.execute('SELECT count(*) AS n FROM library_saves')).rows[0].n===3);restored.close();
 await assert.rejects(restoreLocal(d+'/snapshot.json',d+'/restored.db'),/refusing overwrite/);checks++;
 await assert.rejects(backupLocal(d+'/original.db',d+'/snapshot.json'),/refusing overwrite/);checks++;
 const altered=JSON.parse(await readFile(d+'/snapshot.json','utf8'));altered.payload+=' ';await writeFile(d+'/bad.json',JSON.stringify(altered));
 await assert.rejects(restoreLocal(d+'/bad.json',d+'/bad.db'),/integrity/);checks++;
 await assert.rejects(stat(d+'/bad.db'));checks++;
 console.log(JSON.stringify({localRecoveryChecks:checks,rowsRestored:2,remoteBackup:false,retentionDeletion:false}));
}finally{await rm(d,{recursive:true,force:true})}
