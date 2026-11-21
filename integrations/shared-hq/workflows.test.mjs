// Exercise the deployed service code against an isolated SQLite database.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';
const source=execFileSync('python3',[new URL('./build.py',import.meta.url).pathname],{encoding:'utf8'});
const {runBilling,sharedFile,meetingData}=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {runBilling,sharedFile,meetingData}').toString('base64'));
function database(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE hq_members(email TEXT PRIMARY KEY,uid TEXT UNIQUE,name TEXT NOT NULL);
 INSERT INTO hq_members VALUES('test','test','Test');
 CREATE TABLE hq_records(collection TEXT,id TEXT, revision INTEGER,data TEXT,updated_by TEXT REFERENCES hq_members(email),PRIMARY KEY(collection,id));
 CREATE TRIGGER guard BEFORE INSERT ON hq_records WHEN NEW.revision!=COALESCE((SELECT revision FROM hq_records WHERE id=NEW.id AND collection=NEW.collection),0)+1 BEGIN SELECT RAISE(ABORT,'hq_revision_conflict');END;
 CREATE TABLE hq_file_chunks(id TEXT,part INTEGER,bytes BLOB,PRIMARY KEY(id,part));`);
 function prepare(query,params=[]){
  const stmt=sql.prepare(query);
  const values=params.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);
  return {bind:(...args)=>prepare(query,args),all:async()=>({results:stmt.all(...values)}),first:async()=>stmt.get(...values),run:()=>stmt.run(...values)};
 }
 return {sql,prepare,batch:async stmts=>{
  sql.exec('BEGIN');try{for(const s of stmts)s.run();sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}
 }};
}
test('concurrent renewal checks create one draft and advance the charge once',async()=>{
 const db=database();
 const put=(c,id,v)=>db.sql.prepare("INSERT INTO hq_records VALUES(?,?,1,?,'test')").run(c,id,JSON.stringify(v));
 put('$root','settings',{invoicePrefix:'INV',nextInvoiceNumber:12,defaultTerms:14});
 for(const [c,ids] of Object.entries({clients:['c'],invoices:[],recurringCharges:['r']}))put('$order',c,ids);
 put('clients','c',{id:'c'});put('recurringCharges','r',{id:'r',clientId:'c',active:true,frequency:'monthly',name:'Hosting',amount:12,nextInvoiceDate:'2026-11-30',anchorDay:30});
 await Promise.all([runBilling(db,'2026-11-21'),runBilling(db,'2026-11-21')]);
 const get=c=>db.sql.prepare('SELECT data FROM hq_records WHERE collection=?').all(c).map(r=>JSON.parse(r.data));
 assert.equal(get('invoices').length,1);assert.equal(get('invoices')[0].number,'INV-2026-0012');
 assert.equal(get('invoices')[0].status,'Draft');assert.equal(get('recurringCharges')[0].nextInvoiceDate,'2026-12-30');
 assert.equal(get('$root')[0].nextInvoiceNumber,13);
});
test('a receipt survives a second upload and downloads byte-for-byte',async()=>{
 const db=database(),bytes=new Uint8Array(600000).fill(155);
 const id=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const url='https://example.test/hq/receipt?id='+id;
 for(let i=0;i<2;i++)assert.equal((await sharedFile(new Request(url,{method:'PUT',body:bytes}),db)).status,200);
 const download=await sharedFile(new Request(url),db);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),bytes);
});
test('another device reads the meeting and stale edits are rejected',async()=>{
 const db=database(),url='https://example.test/hq/meeting-data',member={email:'test'};
 const write=(expected,business)=>meetingData(new Request(url,{method:'POST',body:JSON.stringify({id:'m',expected,data:{fields:{business}}})}),db,member);
 await write(0,'First');await write(1,'Second');await assert.rejects(()=>write(1,'Old'),/hq_revision_conflict/);
 const [r]=await (await meetingData(new Request(url),db,member)).json();assert.equal(r.revision,2);assert.equal(r.data.fields.business,'Second');
});
