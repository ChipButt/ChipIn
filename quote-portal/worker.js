// Chip In Works interactive quotations: Cloudflare Worker + dedicated D1 database.
// Deployed code replaces the UI_TEMPLATE marker with the adjacent client.html file.
const UI = UI_TEMPLATE;
const ALLOW = new Set(['https://chipinworks.co.uk','https://www.chipinworks.co.uk']);
const textEncoder = new TextEncoder();
const now = () => new Date().toISOString();
const clean = (x,n=180) => String(x??'').trim().slice(0,n);
const json = (o,s=200,h={}) => new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',...h}});
const bad = (s,c=400,h={}) => json({error:s},c,h);
const pennies = x => {const n=Number(x);if(!Number.isFinite(n)||n<0||n>1000000)throw Error('Invalid price');return Math.round(n*100)};
const secureRandom = () => Array.from(crypto.getRandomValues(new Uint8Array(27)),x=>x.toString(16).padStart(2,'0')).join('');
const digest = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',textEncoder.encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
function constantTime(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let z=0;for(let i=0;i<a.length;i++)z|=a.charCodeAt(i)^b.charCodeAt(i);return z===0}
function originHeaders(r){const o=r.headers.get('Origin');return ALLOW.has(o)?{'Access-Control-Allow-Origin':o,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}:{}}
async function body(r){if(Number(r.headers.get('content-length')||0)>60000)throw Error('Request too large');const v=await r.text();if(v.length>60000)throw Error('Request too large');return JSON.parse(v)}
function item(v){if(!v||!clean(v.name,130)||!['one-off','monthly','annual'].includes(v.frequency||'one-off'))throw Error('Invalid service');return {id:clean(v.id,80),name:clean(v.name,130),description:clean(v.description,1500),frequency:v.frequency||'one-off',pence:pennies(v.amount),includeFirst:v.includeFirst!==false}}
function validate(v){
 if(!v||!/^qte_[\da-z_-]{4,95}$/i.test(clean(v.id,110))||!/^20\d{2}-\d{2}-\d{2}$/.test(v.validUntil))throw Error('Invalid quote identifier or expiry');
 if(!['before-launch','split-50','upfront'].includes(v.paymentSchedule))throw Error('Invalid payment schedule');
 const required=(v.required||[]).slice(0,35).map(item),includedExtras=(v.includedExtras||[]).slice(0,35).map(item),optionalExtras=(v.optionalExtras||[]).slice(0,35).map(item);
 if(!required.length)throw Error('Project price is missing');
 if(optionalExtras.some(x=>!x.id)||new Set(optionalExtras.map(x=>x.id)).size!==optionalExtras.length)throw Error('Invalid extra identifiers');
 const careOptions=(v.careOptions||[]).slice(0,8).map(x=>({...item({...x,frequency:'monthly'}),id:Number(x.id)}));
 if(careOptions.some(x=>!Number.isInteger(x.id)||x.id<1||x.id>20)||new Set(careOptions.map(x=>x.id)).size!==careOptions.length)throw Error('Invalid care plans');
 let domain={mode:'own'};
 if(v.domain?.mode!=='own'&&v.domain){
  if(!['monthly','annual'].includes(v.domain.mode))throw Error('Invalid domain frequency');
  domain={...item({...v.domain,name:'Domain registration and renewal',frequency:v.domain.mode}),mode:v.domain.mode,suggested:clean(v.domain.suggested,253),available:!!v.domain.availabilityChecked,checkedOn:clean(v.domain.checkedOn,10)};
 }
 const defaultCare=Number(v.defaultCare||0),defaultExtras=(v.defaultExtras||[]).map(String);
 if(defaultCare&&!careOptions.some(x=>x.id===defaultCare))throw Error('Invalid default care plan');
 if(defaultExtras.some(id=>!optionalExtras.some(x=>x.id===id)))throw Error('Invalid default extra');
 return {id:clean(v.id,110),number:clean(v.number,50),title:clean(v.title,180),clientName:clean(v.clientName,170),clientContact:clean(v.clientContact,130),clientEmail:clean(v.clientEmail,240),issuedAt:clean(v.issuedAt,10),validUntil:v.validUntil,paymentSchedule:v.paymentSchedule,vatRegistered:!!v.vatRegistered,vatRate:Math.max(0,Math.min(30,Number(v.vatRate)||0)),notes:clean(v.notes,2500),required,includedExtras,optionalExtras,careOptions,domain,defaultCare,defaultExtras,demoUrl:/^https:\/\/[^ \n]+$/i.test(v.demoUrl||'')?clean(v.demoUrl,500):'',emailTemplate:v.emailTemplate?{subject:clean(v.emailTemplate.subject,200).replace(/[\r\n]+/g,' '),body:clean(v.emailTemplate.body,4000)}:null};
}
function total(p,s){
 const careIndex=Number(s.careIndex);
 if(!Number.isInteger(careIndex)||![0,...p.careOptions.map(x=>x.id)].includes(careIndex))throw Error('Choose a valid care plan');
 if(!Array.isArray(s.extraIds)||s.extraIds.length>35)throw Error('Invalid extras');
 const extraIds=s.extraIds.map(String);
 if(new Set(extraIds).size!==extraIds.length||extraIds.some(id=>!p.optionalExtras.some(x=>x.id===id)))throw Error('Invalid selected extras');
 let netPence=0;const recurring=[];
 function add(x){if(x.frequency==='one-off'||x.includeFirst)netPence+=x.pence;if(x.frequency!=='one-off')recurring.push({name:x.name,pence:x.pence,frequency:x.frequency})}
 p.required.forEach(add);if(p.domain?.mode!=='own')add(p.domain);p.includedExtras.forEach(add);
 if(careIndex)add(p.careOptions.find(x=>x.id===careIndex));
 p.optionalExtras.forEach(x=>{if(extraIds.includes(x.id))add(x)});
 const vatPence=p.vatRegistered?Math.round(netPence*p.vatRate/100):0;
 return {careIndex,extraIds,netPence,vatPence,initialPence:netPence+vatPence,recurring};
}

const DEMO = validate({
 id:'qte_demo_sample_website',number:'QTE-DEMO',title:'Website Design & Services — Demonstration',
 clientName:'The Example Inn (sample business)',clientContact:'Demo Customer',clientEmail:'demo@example.test',
 issuedAt:'2026-11-16',validUntil:'2027-12-31',paymentSchedule:'split-50',
 vatRegistered:false,vatRate:0,
 notes:'Demo proposal only. A typical website includes responsive design, appropriate pages for the business, and agreed contact details. Optional subscriptions renew at their stated frequency. The domain will not be registered until purchased. This demonstration does not create a binding agreement.',
 required:[{id:'website',name:'Standard Website Design',description:'A tailored mobile-friendly business website with the agreed home, services or menus, about, opening hours and contact pages, plus one review amendment.',amount:250,frequency:'one-off',includeFirst:true}],
 domain:{mode:'annual',amount:25,includeFirst:true,suggested:'the-example-inn.co.uk',availabilityChecked:false},
 includedExtras:[],
 optionalExtras:[
  {id:'extra-page',name:'Additional website page',description:'A dedicated extra page for a special service, menu or event.',amount:40,frequency:'one-off',includeFirst:true},
  {id:'launch-seo',name:'Search visibility setup',description:'Additional search engine optimisation work beyond the standard website build.',amount:65,frequency:'one-off',includeFirst:true}
 ],
 careOptions:[
  {id:1,name:'Website Health',description:'Monthly checks and 30 minutes of routine content updates each month.',amount:25,frequency:'monthly',includeFirst:true},
  {id:2,name:'Website Care',description:'Regular checks and 60 minutes of updates each month.',amount:49,frequency:'monthly',includeFirst:true},
  {id:3,name:'Website Partner',description:'Regular checks, priority updates and 120 minutes of work each month, plus a quarterly review.',amount:89,frequency:'monthly',includeFirst:true}
 ],
 defaultCare:0,defaultExtras:[]
});


const GMAIL_FROM = 'jamesbutt.chipin@gmail.com';
const SINGLE_LINE = s => clean(s,250).replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
const EMAIL_TEST = /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/;
const OUTBOX_URL = 'https://chipin-hq-quotes.goldplushighdefinition.workers.dev';
function quoteEmail(q,proposal){
 const recipient=clean(proposal.clientEmail,240).toLowerCase();
 if(!EMAIL_TEST.test(recipient))throw Error('The client has no valid email address on this published quote.');
 const number=SINGLE_LINE(proposal.number||q.number);
 const contact=SINGLE_LINE(proposal.clientContact||proposal.clientName||'there');
 const quoteUrl=OUTBOX_URL+'/q/'+q.view_token;
 const vars={clientName:contact,quoteNumber:number,quoteLink:quoteUrl,validUntil:SINGLE_LINE(proposal.validUntil)};
 const fallbackSubject='Your quotation from Chip In Works - {quoteNumber}';
 const fallbackBody='Hello {clientName},\n\nThank you for your interest in Chip In Works.\n\nPlease review your personalised quotation using the secure link below. You can select any optional services and confirm your choices directly on the page:\n\n{quoteLink}\n\nQuotation reference: {quoteNumber}\nValid until: {validUntil}\n\nIf you have any questions, just reply to this email.\n\nKind regards,\nChip In Works\n'+GMAIL_FROM;
 const expand=s=>s.replace(/\{(clientName|quoteNumber|quoteLink|validUntil)\}/g,(_,key)=>vars[key]);
 const template=proposal.emailTemplate;
 const subject=SINGLE_LINE(expand(template?.subject||fallbackSubject));
 let content=expand(clean(template?.body||fallbackBody,4000));
 // A customer quotation email must always include its immutable private quotation URL.
 if(!content.includes(quoteUrl))content+='\n\nView your quotation:\n'+quoteUrl;
 return {recipient,sender:GMAIL_FROM,subject,body:content};
}

async function admin(r,env){const h=r.headers.get('Authorization')||'';return h.startsWith('Bearer ')&&constantTime(h.slice(7),env.ADMIN_KEY||'')}
async function showQuote(req,env,token){
 if(!/^[0-9a-f]{54}$/.test(token))return new Response('Quote not found',{status:404});
 const q=await env.DB.prepare('SELECT * FROM quotes WHERE view_token=?').bind(token).first();
 if(!q)return new Response('Quote not found',{status:404});
 if(!q.first_opened_at&&q.status==='published')await env.DB.prepare('UPDATE quotes SET first_opened_at=? WHERE id=? AND first_opened_at IS NULL').bind(now(),q.id).run();
 const seed=JSON.stringify({token,proposal:JSON.parse(q.proposal_json),status:q.status,acceptedAt:q.accepted_at,acceptance:q.acceptance_json?JSON.parse(q.acceptance_json):null,expired:q.valid_until<now().slice(0,10)}).replace(/</g,'\\u003c');
 return new Response(UI.replace('__DATA__',seed),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src https:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
}
export default {async fetch(req,env){
 const u=new URL(req.url),p=u.pathname,m=req.method,c=originHeaders(req);
 try {
 if(m==='OPTIONS'&&p.startsWith('/api/'))return new Response(null,{status:204,headers:c});
 if(m==='GET'&&p==='/api/health')return json({ok:true,service:'chipin-interactive-quotes',version:'1.0.0'});
 if(m==='GET'&&p==='/')return new Response('Chip In Works quotation service',{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});

 if(m==='GET'&&p==='/demo'){
  const payload=JSON.stringify({token:'demo',demo:true,proposal:DEMO,status:'published',expired:false}).replace(/</g,'\\u003c');
  return new Response(UI.replace('__DATA__',payload),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
 }
 if(m==='POST'&&p==='/api/demo/accept'){
  const choice=await body(req),signer=clean(choice.signer,120),email=clean(choice.email,240);
  if(!choice.agreed||signer.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return bad('Enter your name, email and confirmation');
  const result=total(DEMO,choice);
  return json({ok:true,demo:true,initialPence:result.initialPence,recurring:result.recurring,careIndex:result.careIndex,extraIds:result.extraIds,acceptedAt:now()});
 }

 if(m==='GET'&&p.startsWith('/q/'))return showQuote(req,env,p.slice(3));
 if(m==='POST'&&p==='/api/pair'){
   const v=await body(req),code=clean(v.code,90);
   if(!/^[0-9a-f]{48}$/.test(code))return bad('Invalid or expired pairing code',403,c);
   const r=await env.DB.prepare('UPDATE pair_codes SET used_at=? WHERE code_hash=? AND used_at IS NULL AND expires_at>?').bind(now(),await digest(code),now()).run();
   if(r.meta.changes!==1)return bad('Invalid or expired pairing code',403,c);
   return json({ok:true,key:env.ADMIN_KEY},200,c);
 }
 if(m==='POST'&&p.startsWith('/api/admin/')){
   if(!await admin(req,env))return bad('Unauthorised: connect HQ first',401,c);
   const v=await body(req);

   if(p==='/api/admin/send-email')return bad('Automatic email sending is disabled. Open a Gmail draft for manual review and sending.',410,c);
   if(p==='/api/admin/publish'){
    const doc=validate(v.proposal);
    const old=await env.DB.prepare('SELECT view_token,status FROM quotes WHERE id=?').bind(doc.id).first();
    if(old)return json({ok:true,status:old.status,url:u.origin+'/q/'+old.view_token,alreadyPublished:true},200,c);
    const token=secureRandom(),t=now();
    await env.DB.prepare('INSERT INTO quotes(id,number,view_token,customer_name,status,proposal_json,issued_at,valid_until,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(doc.id,doc.number,token,doc.clientName,'published',JSON.stringify(doc),doc.issuedAt,doc.validUntil,t,t).run();
    return json({ok:true,status:'published',url:u.origin+'/q/'+token,email:null},201,c);
   }
   if(p==='/api/admin/sync'){
    const ids=Array.isArray(v.ids)?v.ids.slice(0,100).map(String).filter(x=>/^qte_[\da-z_-]{4,95}$/i.test(x)):[];
    if(!ids.length)return json({ok:true,quotes:[]},200,c);
    const rows=await env.DB.prepare('SELECT q.id,q.status,q.view_token,q.first_opened_at,q.accepted_at,q.acceptance_json,e.recipient AS mail_recipient,e.status AS mail_status,e.created_at AS mail_created_at,e.sent_at AS mail_sent_at,e.gmail_message_id AS mail_message_id,e.last_error AS mail_error FROM quotes q LEFT JOIN quote_email_outbox e ON e.quote_id=q.id WHERE q.id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all();
    return json({ok:true,quotes:rows.results.map(x=>({id:x.id,status:x.status,url:u.origin+'/q/'+x.view_token,firstOpenedAt:x.first_opened_at,acceptedAt:x.accepted_at,acceptance:x.acceptance_json?JSON.parse(x.acceptance_json):null,email:x.mail_status?{recipient:x.mail_recipient,status:x.mail_status,createdAt:x.mail_created_at,sentAt:x.mail_sent_at,gmailMessageId:x.mail_message_id,error:x.mail_error}:null}))},200,c);
   }
   if(p==='/api/admin/revoke'){
    const r=await env.DB.prepare("UPDATE quotes SET status='revoked',updated_at=? WHERE id=? AND status='published'").bind(now(),clean(v.id,110)).run();
    return json({ok:r.meta.changes===1},200,c);
   }
 }
 const match=p.match(/^\/api\/q\/([0-9a-f]{54})\/accept$/);
 if(m==='POST'&&match){
   const q=await env.DB.prepare('SELECT * FROM quotes WHERE view_token=?').bind(match[1]).first();
   if(!q)return bad('Quote not found',404);
   if(q.status==='accepted')return bad('This quote has already been accepted',409);
   if(q.status!=='published'||q.valid_until<now().slice(0,10))return bad('This quote is no longer available',410);
   const v=await body(req),signer=clean(v.signer,120),email=clean(v.email,240).toLowerCase();
   if(!v.agreed||signer.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return bad('Enter your name, email and confirmation');
   const calculations=total(JSON.parse(q.proposal_json),v),t=now(),accepted={...calculations,signer,email,agreed:true,acceptedAt:t};
   const changed=await env.DB.prepare("UPDATE quotes SET status='accepted',accepted_at=?,acceptance_json=?,updated_at=? WHERE id=? AND status='published' AND valid_until>=?").bind(t,JSON.stringify(accepted),t,q.id,t.slice(0,10)).run();
   if(changed.meta.changes!==1)return bad('This quotation is already closed',409);
   return json({ok:true,initialPence:calculations.initialPence,acceptedAt:t});
 }
 return bad('Not found',404,c);
 }catch(e){const msg=String(e?.message||'');console.error('Quote portal:',msg);return bad(/Invalid|Choose|Enter|too large|missing|required/i.test(msg)?msg:'Request failed',/Invalid|Choose|Enter|too large|missing|required/i.test(msg)?400:500,c)}
}};
