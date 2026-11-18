// Local-only recovery drill. Never connects to Turso or overwrites a database.
import {createClient} from '@libsql/client';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex');
async function absent(path){try{await stat(path);throw Error('Destination exists; refusing overwrite')}catch(e){if(e.code!=='ENOENT')throw e}}
export async function backupLocal(databasePath,snapshotPath){
 const source=resolve(databasePath),target=resolve(snapshotPath);await stat(source);await absent(target);
 const db=createClient({url:'file:'+source});
 try{
  const tx=await db.transaction('read');let rows;
  try{rows=(await tx.execute('SELECT user_id, slug, created_at FROM library_saves ORDER BY user_id, slug')).rows;await tx.commit()}finally{tx.close()}
  const payload=JSON.stringify({format:'packproof-library-v1',created_at:new Date().toISOString(),rows});
  await writeFile(target,JSON.stringify({sha256:hash(payload),payload}),{flag:'wx',mode:0o600});return rows.length;
 }finally{db.close()}
}
export async function restoreLocal(snapshotPath,newDatabasePath){
 const target=resolve(newDatabasePath);await absent(target);
 const envelope=JSON.parse(await readFile(snapshotPath,'utf8'));if(typeof envelope.payload!=='string'||hash(envelope.payload)!==envelope.sha256)throw Error('Snapshot integrity check failed');
 const data=JSON.parse(envelope.payload);if(data.format!=='packproof-library-v1'||!Array.isArray(data.rows))throw Error('Unsupported snapshot');
 for(const r of data.rows)if(typeof r.user_id!=='string'||typeof r.slug!=='string'||typeof r.created_at!=='string')throw Error('Invalid snapshot row');
 const db=createClient({url:'file:'+target});try{
  await db.execute("CREATE TABLE library_saves (user_id TEXT NOT NULL, slug TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(user_id, slug))");
  await db.batch(data.rows.map(r=>({sql:'INSERT INTO library_saves(user_id,slug,created_at) VALUES(?,?,?)',args:[r.user_id,r.slug,r.created_at]})),'write');return data.rows.length;
 }finally{db.close()}
}
// Importable functions only. Call from the recovery test or an explicit local
// operator script. There is deliberately no remote URL or production restore.
