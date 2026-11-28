/* embed dashboardSync */
/* embed accountPage */
/* embed quoteClient */
/* embed meetingShared */

const workflowAssets='37c0452e69c64eaef11663e3563b6731b6cc21df';
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
  if(email==='recurring-billing@automation.invalid')return null;
  await db.prepare('UPDATE hq_members SET uid=? WHERE email=? AND uid IS NULL').bind(user.localId,email).run();
  return db.prepare('SELECT email,name FROM hq_members WHERE email=? AND uid=?').bind(email,user.localId).first();
}

/* billing service */
/* file service */
export default {scheduled(event,env,ctx){ctx.waitUntil(runBilling(env.DB))},async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(path==='/hq/meeting-shared.js')return new Response(meetingShared,{headers:{'Content-Type':'application/javascript','Cache-Control':'no-store'}});
  // Website meeting drafts share the HQ origin for linked-job handover.
  if(request.method==='GET' && (
    /^\/client-meeting\/(?:index\.html|meeting\.js|style\.css)?$/.test(path) ||
    /^\/hq\/meeting\/(?:index\.html|meeting\.js|style\.css)?$/.test(path) || path==='/client-meeting' ||
    path==='/favicon.svg' ||
    path==='/chipin_asset_pack/logo/chip_in_logo.png'
  )){
    const meetingPath=path.replace('/hq/meeting/','/client-meeting/');
    const file=(meetingPath==='/client-meeting/'||meetingPath==='/client-meeting')
      ? 'client-meeting/index.html' : meetingPath.slice(1);
    const upstream=await fetch('https://raw.githubusercontent.com/ChipButt/ChipIn/'+workflowAssets+'/'+file);
    if(!upstream.ok)return new Response('Meeting builder asset unavailable',{status:502});
    const ext=file.split('.').pop();
    const types={html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',css:'text/css; charset=utf-8',png:'image/png',svg:'image/svg+xml'};
    if(ext==='html'&&path.startsWith('/hq/meeting/'))return new Response((await upstream.text()).replaceAll('../chipin_asset_pack/','/chipin_asset_pack/').replace('../favicon.svg','/favicon.svg').replace('<head>',"<head><script>if(!sessionStorage.getItem('hqSession'))location.replace(location.hostname.endsWith('.workers.dev')?'/':'/hq/login')</script>").replace('<script src="./meeting.js">','<script src="/hq/meeting-shared.js"></script><script src="./meeting.js">'),{headers:{'Content-Type':types.html,'Cache-Control':'no-store'}});
    return new Response(upstream.body,{headers:{
      'Content-Type':types[ext]||'application/octet-stream',
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'
    }});
  }
  if(path==='/hq/app27_interactive_quotes.js')return new Response(quoteClient,{headers:{'Content-Type':'application/javascript','Cache-Control':'no-store'}});
  if(path==='/hq/dashboard-sync.js') return new Response(dashboardSync,{headers:{'Content-Type':'application/javascript','Cache-Control':'no-store'}});
  if(/^\/hq\/(?:|[a-zA-Z0-9_-]+\.(?:js|css|png|webmanifest))$/.test(path) && request.method==='GET'){
    if(path==='/hq/sw.js')return new Response(null,{status:404});
    const file=path==='/hq/'?'index.html':path.slice(4);
    const assetRef=['app22_client_pipeline.js','app28_email_drafts.js'].includes(file)?'0fae93c234553977e3c865bd643811b32df8b0c6':['app21_prospect_conversion.js','app23_client_to_job.js','app26_quotes.js'].includes(file)?workflowAssets:file==='app25_recurring_billing.js'?'3f985a0266d9f1f32e15860b5d9e2d81805cf37c':'0dccc9e6197d6eb8daefd9bf1836f816db80d791';
    const upstream=await fetch('https://raw.githubusercontent.com/ChipButt/ChipIn/'+assetRef+'/hq/'+file);
    if(!upstream.ok)return new Response('HQ asset unavailable',{status:502});
    const types={html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',webmanifest:'application/manifest+json'};
    const headers={'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
    if(file==='index.html')return new Response((await upstream.text()).replace('<head>',"<head><style>#app{visibility:hidden}#mobileSaveState{display:none}@media(max-width:700px){#mobileSaveState{display:block;font-size:11px;margin-top:3px}}@media(max-width:700px){#app .sidebar{height:80px}#app .content{padding-bottom:104px}#modal.modal{padding-bottom:98px}}</style><script>if(!sessionStorage.getItem('hqSession'))location.replace('/')</script>").replace('</body>','<script src="/hq/meeting-shared.js"></script><script src="dashboard-sync.js"></script></body>'),{headers});
    if(file==='app4.js')return new Response((await upstream.text()).replace(/\ninit\(\)\.catch[^\n]*/,''),{headers});
    if(file==='app6.js')return new Response((await upstream.text()).replace(/setTimeout\(\(\)=>bootstrapGhStorage[^\n]*/,''),{headers});
    return new Response(upstream.body,{headers});
  }
  if (path==='/' && request.method==='GET') return new Response(accountPage,{headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://identitytoolkit.googleapis.com; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"
  }});
  if (!['/account','/records','/migration/source','/migration/import','/quote-admin','/hq/receipt','/hq/meeting-data','/hq/renewals'].includes(path)) return json({error:'Unknown route'},404);
  try {
    const member=await identify(request,env.DB);
    if (!member) return denied();
    if(path==='/hq/receipt')return await sharedFile(request,env.DB);
    if(path==='/hq/meeting-data')return await meetingData(request,env.DB,member);
    if(path==='/hq/renewals' && request.method==='POST'){await runBilling(env.DB);return json({ok:true})}
    if(path==='/quote-admin'){
      if(request.method!=='POST')return json({error:'Unsupported method'},405);
      if(!env.HQ_QUOTE_BRIDGE_KEY)return json({error:'Quotation connection is not configured.'},503);
      const raw=await request.text();
      if(raw.length>58000)return json({error:'Quotation request is too large.'},413);
      const payload=JSON.parse(raw);
      const target=payload?.path, body=payload?.body;
      if(!['/api/admin/publish','/api/admin/sync','/api/admin/revoke'].includes(target)||!body||typeof body!=='object'||Array.isArray(body)) return json({error:'Unsupported quotation action.'},400);
      const ids=target==='/api/admin/sync'?body.ids:[target==='/api/admin/publish'?body.proposal?.id:body.id];
      if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||!/^qte_[a-z0-9_-]{4,95}$/i.test(id))) return json({error:'Invalid quotation reference.'},400);
      if(ids.length){
        const known=await env.DB.prepare('SELECT id FROM hq_records WHERE collection=? AND data IS NOT NULL AND id IN ('+ids.map(()=>'?').join(',')+')').bind('quotes',...ids).all();
        if(known.results.length!==new Set(ids).size)return json({error:'Quotation not found in shared HQ.'},404);
      }
      const response=await env.QUOTE_PORTAL.fetch('https://chipin-hq-quotes.goldplushighdefinition.workers.dev'+target,{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.HQ_QUOTE_BRIDGE_KEY},
        body:JSON.stringify(body)
      });
      return new Response(await response.text(),{status:response.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    const info=await env.DB.prepare('SELECT migration_verified, EXISTS(SELECT 1 FROM hq_verified_import) AND EXISTS(SELECT 1 FROM hq_records WHERE collection=\'clients\') AS imported FROM hq_workspace WHERE id=1').first();
    if(path==='/account'||path.startsWith('/migration/')){
      const owner=await env.DB.prepare('SELECT email FROM hq_migration_owners WHERE email=?').bind(member.email).first();
      if(path==='/account' && request.method==='GET')return json({...member,ready:info?.migration_verified===1,imported:!!info?.imported,canImport:!!owner&&!info?.imported&&!info?.migration_verified});
      if(!owner || info?.migration_verified || info?.imported)return denied();
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
    if(!info?.migration_verified && !info?.imported) return json({error:'Migration awaiting verification.'},423);
    if(request.method==='GET'){
      const rows=await env.DB.prepare("SELECT collection,id,revision,data FROM hq_records WHERE collection!='$meeting' ORDER BY collection,id").all();
      return json(rows.results.map(r=>({...r,data:r.data===null?null:JSON.parse(r.data)})));
    }
    if(request.method!=='POST') return json({error:'Unsupported method'},405);
    if(request.headers.get('X-HQ-Client')!=='shared-v3')return json({error:'Reload HQ to save using the current shared dashboard.'},428);
    const ops=await request.json().catch(()=>null);
    if(!Array.isArray(ops)||!ops.length||ops.length>5000) return json({error:'Invalid change batch.'},400);
    const seen=new Set(), sql='INSERT INTO hq_records(collection,id,revision,data,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_by=excluded.updated_by';
    const statements=[];
    for(const op of ops){
      if(!op||(op.collection==='$meeting'&&(request.headers.get('X-HQ-Restore')!=='confirmed'||!op.data?.fields))||typeof op.collection!=='string'||!op.collection.length||op.collection.length>128||typeof op.id!=='string'||!op.id.length||op.id.length>256||!Number.isSafeInteger(op.expected)||op.expected<0||!Object.hasOwn(op,'data')) return json({error:'Invalid record.'},400);
      const key=JSON.stringify([op.collection,op.id]);
      if(seen.has(key)) return json({error:'Duplicate record.'},400);
      seen.add(key);
      statements.push(env.DB.prepare(sql).bind(op.collection,op.id,op.expected+1,op.data===null?null:JSON.stringify(op.data),member.email));
    }
    await env.DB.batch(statements);
    if(ops.some(op=>op.collection==='recurringCharges'))ctx?.waitUntil(runBilling(env.DB));
    return json({saved:true});
  }catch(error){
    if(String(error?.message).includes('hq_revision_conflict'))return json({error:'A record changed on another device. Review the newer version before saving.'},409);
    return json({error:'HQ service temporarily unavailable.'},503);
  }
}};

