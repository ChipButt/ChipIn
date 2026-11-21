async function sharedFile(request,db){
  const hash=new URL(request.url).searchParams.get('id');
  if(!/^[0-9a-f]{64}$/.test(hash||''))return json({error:'Invalid file reference'},400);
  if(request.method==='GET'){
    const {count}=await db.prepare('SELECT count(*) AS count FROM hq_file_chunks WHERE id=?').bind(hash).first();
    if(!count)return json({error:'Receipt unavailable'},404);
    let part=0;
    const stream=new ReadableStream({async pull(controller){
      const row=await db.prepare('SELECT bytes FROM hq_file_chunks WHERE id=? AND part=?').bind(hash,part++).first();
      controller.enqueue(new Uint8Array(row.bytes));
      if(part===count)controller.close();
    }});
    return new Response(stream,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}});
  }
  if(request.method!=='PUT')return json({error:'Unsupported method'},405);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(!bytes.length||bytes.length>24*1024*1024)return json({error:'Receipt size must be between 1 byte and 24 MB'},413);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==digest)return json({error:'Receipt checksum mismatch'},400);
  const parts=[];
  for(let i=0;i<bytes.length;i+=512*1024)parts.push(db.prepare('INSERT OR IGNORE INTO hq_file_chunks(id,part,bytes) VALUES(?,?,?)').bind(hash,parts.length,bytes.slice(i,i+512*1024).buffer));
  await db.batch(parts);return json({id:hash});
}
async function meetingData(request,db,member){
  if(request.method==='GET')return json((await db.prepare("SELECT id,revision,data FROM hq_records WHERE collection='$meeting' AND data IS NOT NULL").all()).results.map(r=>({...r,data:JSON.parse(r.data)})));
  if(request.method!=='POST')return json({error:'Unsupported method'},405);
  const {id,expected,data}=await request.json();
  if(typeof id!=='string'||!id.length||id.length>256||!Number.isSafeInteger(expected)||expected<0||!data?.fields||JSON.stringify(data).length>750000)return json({error:'Invalid meeting'},400);
  await db.prepare("INSERT INTO hq_records(collection,id,revision,data,updated_by) VALUES('$meeting',?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_by=excluded.updated_by").bind(id,expected+1,JSON.stringify(data),member.email).run();
  return json({revision:expected+1});
}
