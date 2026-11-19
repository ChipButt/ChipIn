import accountPage from './account.html';

const apiKey = 'AIzaSyDOeXy5TVppDu8ktTgjg7eVLnMvo_EDDRc';
const json = (value, status=200) => Response.json(value, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const denied = () => json({error:'Sign in with your verified HQ email address.'},403);

async function identify(request, db) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if (!token || token.length > 8192) return null;
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+apiKey,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})
  });
  if (!response.ok) {
    if (response.status>=500||response.status===429) throw Error('Identity provider unavailable');
    return null;
  }
  const user = (await response.json()).users?.[0];
  if (!user?.emailVerified || !user.localId || !user.email) return null;
  const email=user.email.toLowerCase();
  await db.prepare('UPDATE hq_members SET uid=? WHERE email=? AND uid IS NULL').bind(user.localId,email).run();
  return db.prepare('SELECT email,name FROM hq_members WHERE email=? AND uid=?').bind(email,user.localId).first();
}

export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if (path==='/' && request.method==='GET') return new Response(accountPage,{headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://identitytoolkit.googleapis.com; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"
  }});
  if (!['/account','/records','/migration/source','/migration/import'].includes(path)) return json({error:'Unknown route'},404);
  try {
    const member=await identify(request,env.DB);
    if (!member) return denied();
    const info=await env.DB.prepare('SELECT migration_verified FROM hq_workspace WHERE id=1').first();
    if(path==='/account'||path.startsWith('/migration/')){
      const owner=await env.DB.prepare('SELECT email FROM hq_migration_owners WHERE email=?').bind(member.email).first();
      if(path==='/account' && request.method==='GET')return json({...member,ready:info?.migration_verified===1,canImport:!!owner&&!info?.migration_verified});
      if(!owner || info?.migration_verified)return denied();
      const sourceCommit='78f1402f5536fd40494e27bb8292279e4602b486';
      if(path==='/migration/source' && request.method==='GET'){
        const parts=await env.DB.prepare('SELECT contents FROM hq_migration_source WHERE commit_sha=? ORDER BY part').bind(sourceCommit).all();
        if(!parts.results.length)return json({error:'Backup unavailable'},503);
        return json({commit:sourceCommit,envelope:JSON.parse(parts.results.map(p=>p.contents).join(''))});
      }
      if(path==='/migration/import' && request.method==='POST'){
        const payload=await request.json();
        if(payload.commit!==sourceCommit||typeof payload.state!=='string'||payload.state.length>1500000)return json({error:'Invalid import.'},400);
        const state=JSON.parse(payload.state);
        if(!state.settings||!['clients','jobs','invoices','expenses'].every(k=>Array.isArray(state[k])))return json({error:'Unrecognised HQ records.'},400);
        const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload.state));
        const digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
        await env.DB.prepare('INSERT OR IGNORE INTO hq_verified_import(commit_sha,digest,state_json) VALUES(?,?,?)').bind(sourceCommit,digest,payload.state).run();
        const saved=await env.DB.prepare('SELECT state_json FROM hq_verified_import WHERE commit_sha=?').bind(sourceCommit).first();
        if(saved?.state_json!==payload.state)return json({error:'The staged copy differs. No records were replaced.'},409);
        return json({digest,counts:Object.fromEntries(Object.entries(state).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))});
      }
    }
    if(path!=='/records') return json({error:'Unsupported method'},405);
    if(!info?.migration_verified) return json({error:'Migration awaiting verification.'},423);
    if(request.method==='GET'){
      const rows=await env.DB.prepare('SELECT collection,id,revision,data FROM hq_records ORDER BY collection,id').all();
      return json(rows.results.map(r=>({...r,data:r.data===null?null:JSON.parse(r.data)})));
    }
    if(request.method!=='POST') return json({error:'Unsupported method'},405);
    const ops=await request.json().catch(()=>null);
    if(!Array.isArray(ops)||!ops.length||ops.length>100) return json({error:'Invalid change batch.'},400);
    const seen=new Set(), sql='INSERT INTO hq_records(collection,id,revision,data,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_by=excluded.updated_by';
    const statements=[];
    for(const op of ops){
      if(!op||typeof op.collection!=='string'||!op.collection.length||op.collection.length>128||typeof op.id!=='string'||!op.id.length||op.id.length>256||!Number.isSafeInteger(op.expected)||op.expected<0||!Object.hasOwn(op,'data')) return json({error:'Invalid record.'},400);
      const key=JSON.stringify([op.collection,op.id]);
      if(seen.has(key)) return json({error:'Duplicate record.'},400);
      seen.add(key);
      statements.push(env.DB.prepare(sql).bind(op.collection,op.id,op.expected+1,op.data===null?null:JSON.stringify(op.data),member.email));
    }
    await env.DB.batch(statements);
    return json({saved:true});
  }catch(error){
    if(String(error?.message).includes('hq_revision_conflict'))return json({error:'A record changed on another device. Review the newer version before saving.'},409);
    return json({error:'HQ service temporarily unavailable.'},503);
  }
}};
