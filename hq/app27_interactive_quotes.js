// Chip In HQ: isolated connector to the Cloudflare customer quote portal.
(function(){
'use strict';
const BASE='https://chipin-hq-quotes.goldplushighdefinition.workers.dev';
const STORAGE='chipin_quote_portal_auth_v1';
let inFlight=false,lastChecked=0;
const quotes=()=>Array.isArray(state.quotes)?state.quotes:[];
const byId=id=>quotes().find(q=>q.id===id);
const str=x=>String(x??'').trim();
function portalReady(){return !!(localStorage.getItem(STORAGE)&&ghPass&&ghUnlocked)}
async function key(){
 const sealed=localStorage.getItem(STORAGE);
 if(!sealed)throw Error('Connect the quotation service first. Use the pairing code in the Quotes section.');
 if(!ghPass||!ghUnlocked)throw Error('Unlock your HQ private storage first, then retry.');
 return openText(sealed,ghPass);
}
async function call(path,body,authenticated=true){
 const auth=authenticated?await key():'';
 const response=await fetch(BASE+path,{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{'Authorization':'Bearer '+auth}:{})},body:JSON.stringify(body)});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Cloudflare quotation service error '+response.status);
 return result;
}
function htmlEsc(x){return esc(x??'');}
function statusLine(q){
 const c=q.interactive;
 if(!c?.url)return 'Not published';
 if(c.acceptance&&!q.invoiceId)return 'Customer accepted — review required';
 if(c.email?.status==='sent')return 'Email sent by Gmail to '+c.email.recipient;
 if(c.email?.status==='queued'||c.email?.status==='sending')return 'Email awaiting Gmail dispatch — not yet sent';
 if(c.email?.status==='failed')return 'Email sending needs attention — not sent';
 if(c.acceptance&&q.invoiceId)return 'Accepted & invoiced';
 if(c.firstOpenedAt)return 'Opened by customer';
 return 'Published — awaiting customer (email not sent by HQ)';
}
function collect(q){
 if(q.category!=='Website Design')throw Error('Interactive service selection is currently available for website quotations only.');
 const client=clientById(q.clientId);
 if(!client)throw Error('This quote does not have a valid client.');
 const p=window.ChipInQuotes.plan(q);
 const format=x=>({id:x.id||'',name:x.name,description:x.description||'',amount:x.amount,frequency:x.frequency||'one-off',includeFirst:x.includeFirst!==false});
 const required=p.base.map(x=>({...format(x),description:(/Standard Package/i.test(x.name)?'A tailored mobile-friendly small-business website, including the agreed home, about, menus or services, opening hours, events and contact pages where relevant; a client editor where appropriate and one review amendment before launch.':x.description||'')}));
 const includedExtras=p.extras.filter(x=>x.mode!=='offered').map(format);
 const optionalExtras=p.extras.filter(x=>x.mode==='offered').map(format);
 const careOptions=[
  {id:1,name:'Website Health',amount:25,description:'Monthly page, link and contact-form checks, plus 30 minutes of routine updates. Ideal for businesses whose information changes occasionally.',frequency:'monthly',includeFirst:q.care?.includeFirst!==false},
  {id:2,name:'Website Care',amount:49,description:'Regular site checks plus 60 minutes of menu, price, photo, opening-hours and text updates each month, to keep information accurate without separate small-change charges.',frequency:'monthly',includeFirst:q.care?.includeFirst!==false},
  {id:3,name:'Website Partner',amount:89,description:'Regular checks and 120 minutes of updates each month, with priority routine changes and a quarterly improvement review. Best for frequently changing promotions or content.',frequency:'monthly',includeFirst:q.care?.includeFirst!==false}
 ];
 // Preserve the client-selected first billing period and the quoted domain arrangement.
 const domain=!q.domain||q.domain.mode==='own'?{mode:'own'}:{
  id:'domain',name:'Domain registration and renewal',amount:Number(q.domain?.amount||25),
  mode:q.domain?.mode||'annual',frequency:q.domain?.mode||'annual',includeFirst:q.domain?.includeFirst!==false,
  suggested:q.domain?.suggested||'',availabilityChecked:!!q.domain?.availabilityChecked,checkedOn:q.domain?.checkedOn||''
 };
 return {id:q.id,number:q.number,title:q.title,clientName:client.name,clientContact:client.contact||'',
  clientEmail:client.email||'',issuedAt:q.issueDate,validUntil:q.validUntil,paymentSchedule:q.paymentSchedule||'before-launch',
  vatRegistered:!!q.vatRegistered,vatRate:Number(q.vatRate||0),notes:q.notes||'',
  required,domain,includedExtras,optionalExtras,careOptions,
  defaultCare:Number(q.care?.choiceIndex||0),defaultExtras:[],
  demoUrl:q.demo?.enabled?q.demo.url||'':'',emailTemplate:q.emailTemplate||null};
}
async function publish(id){
 const q=byId(id);
 if(!q)return;
 if(q.status==='Accepted'||q.status==='Declined')return toast('This quote is already closed.');
 if(q.interactive?.url)return toast('This quotation is already published. Open it to check the email status.');
 try{
  const proposal=collect(q);
  const r=await call('/api/admin/publish',{proposal});
  q.interactive={url:r.url,publishedAt:new Date().toISOString(),status:r.status,acceptance:null,email:r.email||null};
  if(q.status==='Draft'){q.status='Sent';q.sentDate=TODAY();}
  const client=clientById(q.clientId);
  if(client){client.pipelineStage='Quote';client.updatedAt=new Date().toISOString();}
  await saveState();
  render();window.ChipInQuotes.openPreview(q.id);
  toast(r.email?.status==='queued'?'Quotation published and email queued. Check that Gmail confirms sending; the background sender may need approval.':'Quotation published. Email delivery is not confirmed; check before relying on it.');
 }catch(e){toast(e.message);}
}
async function synchronize(showToast=false){
 if(inFlight||!portalReady())return;
 const pending=quotes().filter(q=>q.interactive?.url&&!q.invoiceId);
 if(!pending.length){if(showToast)toast('There are no published quotations to check.');return;}
 inFlight=true;lastChecked=Date.now();
 try{
  const r=await call('/api/admin/sync',{ids:pending.map(q=>q.id)});
  let changed=false,accepted=0;
  for(const record of r.quotes||[]){
   const q=byId(record.id);if(!q||!q.interactive)continue;
   if(record.status==='accepted'&&record.acceptance&&!q.interactive.acceptance){
    q.interactive.acceptance=record.acceptance;q.interactive.acceptedAt=record.acceptedAt;
    q.interactive.status='accepted';accepted++;changed=true;
   }
   if(record.status==='revoked'&&q.interactive.status!=='revoked'){q.interactive.status='revoked';changed=true;}
   if(record.firstOpenedAt&&!q.interactive.firstOpenedAt){q.interactive.firstOpenedAt=record.firstOpenedAt;changed=true;}
   if(record.email && JSON.stringify(q.interactive.email||null)!==JSON.stringify(record.email)) {q.interactive.email=record.email;changed=true;}
  }
  if(changed){await saveState();if(page==='quotes'||page==='dashboard')render();}
  if(accepted&&!showToast)toast(accepted+' customer quotation'+(accepted===1?' has':'s have')+' been accepted.');
  if(showToast)toast(accepted?accepted+' customer quotation'+(accepted===1?' has':'s have')+' been accepted.': 'Quotation status checked.');
 }catch(e){if(showToast)toast('Could not check customer quotations: '+e.message);else console.warn('Quote status check:',e);}
 finally{inFlight=false;}
}
function mountQuotes(){
 const host=document.getElementById('content');
 if(!host||!host.querySelector('#hqQuoteTable'))return;
 const ready=portalReady(),accepted=quotes().filter(q=>q.interactive?.acceptance&&!q.invoiceId);
 const bar=document.createElement('div');bar.className='hq-quote-online-bar';bar.id='hqQuoteOnlineBar';
 bar.innerHTML='<div><strong>Interactive customer quotations</strong><p class="muted" style="margin:5px 0 0">'+(ready?'Connected · replies checked automatically while HQ is open and unlocked (about every 90 seconds)':'One-time secure connection required before sending interactive quotation links')+'</p></div><div class="row-actions">'+
 '<a class="btn small secondary" href="'+BASE+'/demo" target="_blank" rel="noopener noreferrer">Try customer demo</a>'+ (ready?'<button class="btn small secondary" id="hqQuoteCheck">Check now</button>':'<button class="btn small" id="hqQuotePair">Connect quotations</button>')+'</div>';
 host.prepend(bar);
 document.getElementById('hqQuoteCheck')?.addEventListener('click',()=>synchronize(true));
 document.getElementById('hqQuotePair')?.addEventListener('click',pairForm);
 if(accepted.length){
  const panel=document.createElement('div');panel.className='hq-quote-accepted-notice';
  panel.innerHTML='<h3>'+accepted.length+' quotation'+(accepted.length===1?' needs':'s need')+' your review</h3>'+
  accepted.map(q=>'<div class="hq-quote-notice-row"><div><strong>'+htmlEsc(q.number)+'</strong> · '+htmlEsc(clientById(q.clientId)?.name||'Client')+'<p class="muted" style="margin:3px 0">Confirmed by '+htmlEsc(q.interactive.acceptance.signer)+' · '+money(q.interactive.acceptance.initialPence/100)+'</p></div><button type="button" class="btn small gold" data-review-online="'+htmlEsc(q.id)+'">Review choices</button></div>').join('');
  host.insertBefore(panel,bar.nextSibling);
  panel.querySelectorAll('[data-review-online]').forEach(b=>b.addEventListener('click',()=>review(b.dataset.reviewOnline)));
 }
 // One network check at most every 45 seconds while visiting the Quotes page.
 if(ready&&!inFlight&&Date.now()-lastChecked>45000)void synchronize(false);
}
function pairForm(){
 if(!ghPass||!ghUnlocked)return toast('Please unlock your HQ private storage first.');
 openModal('<h2>Connect interactive quotations</h2><p class="sub">Paste your one-time Cloudflare pairing code. The connection is encrypted with your existing HQ passphrase and is never written into your public GitHub code.</p><form id="hqQuotePairForm"><div class="field"><label>One-time pairing code</label><input name="pairCode" type="password" autocomplete="off" minlength="48" maxlength="48" required placeholder="Paste your pairing code"></div><div class="form-actions"><button type="button" class="btn secondary" data-close-modal>Cancel</button><button type="submit" class="btn gold">Connect</button></div></form>');
 const form=document.getElementById('hqQuotePairForm');
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
  try{
   const pairCode=str(form.elements.namedItem('pairCode').value);
   const result=await call('/api/pair',{code:pairCode},false);
   if(!result.key)throw Error('Pairing was unsuccessful.');
   localStorage.setItem(STORAGE,await sealText(result.key,ghPass));
   closeModal();render();toast('Customer quotations connected to Cloudflare.');
  }catch(e){toast(e.message);button.disabled=false;}
 };
}

async function queueCustomerEmail(id){
 const q=byId(id);
 if(!q?.interactive?.url)return toast('Publish the interactive quotation before emailing it.');
 if(!portalReady())return toast('Unlock HQ and connect interactive quotations first.');
 try{
  const result=await call('/api/admin/send-email',{id});
  q.interactive.email=result.email;
  await saveState();
  render();window.ChipInQuotes.openPreview(q.id);
  if(result.email.status==='sent')toast('Gmail previously confirmed sending this quote.');
  else if(result.email.status==='queued')toast('Quotation queued. Gmail dispatch runs hourly; the email has NOT been sent yet.');
  else toast('Existing Gmail delivery status: '+result.email.status);
 }catch(e){toast('Email not queued: '+e.message);}
}

function draftContent(q,client){
 const defaultSubject="Your quotation from Chip In Works - {quoteNumber}";
 const defaultBody="Hello {clientName},\n\nThank you for your interest in Chip In Works.\n\nPlease review your personalised quotation using the secure link below. You can select any optional services and confirm your choices directly on the page:\n\n{quoteLink}\n\nQuotation reference: {quoteNumber}\nValid until: {validUntil}\n\nIf you have any questions, just reply to this email.\n\nKind regards,\nChip In Works\njamesbutt.chipin@gmail.com";
 const variables={clientName:client.contact||client.name||'there',quoteNumber:q.number,quoteLink:q.interactive.url,validUntil:q.validUntil};
 const expand=value=>String(value).replace(/\{(clientName|quoteNumber|quoteLink|validUntil)\}/g,(_,name)=>variables[name]);
 const subject=expand(q.emailTemplate?.subject||defaultSubject);
 let content=expand(q.emailTemplate?.body||defaultBody);
 if(!content.includes(q.interactive.url))content+='\n\nView your quotation:\n'+q.interactive.url;
 return {subject,body:content};
}
function previewActions(q){
 if(!q||q.category!=='Website Design')return;
 const actions=document.querySelector('.hq-quote-preview-actions .row-actions');
 if(!actions)return;
 const button=document.createElement('button');button.type='button';button.className='btn small secondary';
 if(q.interactive?.url){
  const deliveryNote=document.createElement('p');deliveryNote.className='muted';deliveryNote.style.cssText='width:100%;margin:6px 0';deliveryNote.textContent='Publishing queues your customer email. Sending is handled by a separate Gmail task that can pause for approval, so Queued does not mean Sent. For immediate manual sending, open the Gmail draft.';actions.append(deliveryNote);
  button.textContent='Copy customer quote link';button.onclick=()=>navigator.clipboard.writeText(q.interactive.url).then(()=>toast('Secure client quote link copied')).catch(()=>toast('Could not copy the link.'));
  actions.append(button);
  const client=clientById(q.clientId);
  if(client?.email){
   if(!q.interactive.email || q.interactive.email.status==='failed'){
    const sendButton=document.createElement('button');sendButton.type='button';sendButton.className='btn small gold';
    sendButton.textContent='Queue quotation email';
    sendButton.onclick=()=>queueCustomerEmail(q.id);
    actions.append(sendButton);
   }else{
    const mailStatus=document.createElement('span');mailStatus.className='muted';
    mailStatus.textContent=q.interactive.email.status==='sent'?'Sent by Gmail to '+q.interactive.email.recipient+' at '+new Date(q.interactive.email.sentAt).toLocaleString('en-GB'):'Email queued: awaiting Gmail send';
    actions.append(mailStatus);
   }
   // Open Gmail Compose directly instead of a mailto: handler, which fails on many computers.
   const emailButton=document.createElement('a');emailButton.className='btn small secondary';emailButton.textContent='Open Gmail draft';
   const draft=draftContent(q,client);
   emailButton.href='https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(client.email)+'&su='+encodeURIComponent(draft.subject)+'&body='+encodeURIComponent(draft.body);
   emailButton.target='_blank';emailButton.rel='noopener noreferrer';
   emailButton.title='Opens a prefilled Gmail compose window. Review and press Send in Gmail.';
   actions.append(emailButton);
  }
  const stateInfo=document.createElement('p');stateInfo.className='muted';stateInfo.style.cssText='width:100%;margin-top:8px';
  stateInfo.textContent='Interactive quotation: '+statusLine(q);actions.append(stateInfo);
  if(q.interactive.acceptance&&!q.invoiceId){
   const reviewButton=document.createElement('button');reviewButton.type='button';reviewButton.className='btn small gold';reviewButton.textContent='Review customer choices';
   reviewButton.onclick=()=>review(q.id);actions.append(reviewButton);
  }
 }else if(['Draft','Sent'].includes(q.status)){
  button.textContent='Publish & email quotation';button.onclick=()=>publish(q.id);actions.append(button);
 }
}
function review(id){
 const q=byId(id),a=q?.interactive?.acceptance;
 if(!a)return toast('No customer acceptance has been received.');
 const planNames={0:'No care plan',1:'Website Health — £25/month',2:'Website Care — £49/month',3:'Website Partner — £89/month'};
 const extraIds=new Set(a.extraIds||[]),extraNames=(q.extras||[]).filter(x=>extraIds.has(x.id)).map(x=>x.name);
 const selectedCare=planNames[a.careIndex]||'Unknown care plan';
 openModal('<h2>Customer accepted quotation</h2><p class="sub">'+htmlEsc(q.number)+' · '+htmlEsc(clientById(q.clientId)?.name||'')+'</p>'+
 '<p><strong>Accepted by:</strong> '+htmlEsc(a.signer)+' ('+htmlEsc(a.email)+')</p>'+
 '<p><strong>Website care:</strong> '+htmlEsc(selectedCare)+'</p>'+
 '<p><strong>Additional extras:</strong> '+htmlEsc(extraNames.join(', ')||'None')+'</p>'+
 '<p><strong>Confirmed initial amount:</strong> '+money(a.initialPence/100)+'</p>'+
 '<p class="sub">Confirming updates this HQ quote with the client’s selections and creates the normal job and a draft invoice. Nothing is emailed or charged automatically.</p>'+
 '<div class="form-actions"><button type="button" class="btn secondary" data-close-modal>Review later</button><button type="button" class="btn gold" id="hqApproveOnline">Approve and create draft invoice</button></div>',true);
 document.getElementById('hqApproveOnline').onclick=()=>window.ChipInQuotes.approveOnline(id);
}

const previousDashboard=renderDashboard;
renderDashboard=function(){
 previousDashboard();
 const pending=quotes().filter(q=>q.interactive?.acceptance&&!q.invoiceId);
 const host=document.getElementById('content');
 if(!host||!pending.length)return;
 const panel=document.createElement('div');
 panel.className='hq-quote-dashboard-alert';
 panel.innerHTML='<div><strong>'+pending.length+' customer quotation'+(pending.length===1?' has':'s have')+' been accepted</strong><p>Review the confirmed extras and payment arrangement before creating a draft invoice.</p></div><button class="btn small gold" id="hqDashboardQuoteReview">Review quotations</button>';
 host.prepend(panel);
 panel.querySelector('button').onclick=()=>{page='quotes';render();};
};
// Check for customer acceptances while HQ is open. Only published quote IDs are queried.
function autoCheckOnReturn(){
 if(!portalReady()||inFlight||Date.now()-lastChecked<60000)return;
 if(quotes().some(q=>q.interactive?.url&&!q.invoiceId))void synchronize(false);
}
window.setInterval(()=>{if(document.visibilityState!=='hidden')autoCheckOnReturn()},90000);
window.addEventListener('focus',autoCheckOnReturn);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')autoCheckOnReturn()});
const css=document.createElement('style');
css.textContent='.hq-quote-dashboard-alert{display:flex;align-items:center;justify-content:space-between;gap:15px;border:1px solid #c7d9e9;background:#eef6fc;border-radius:12px;padding:15px;margin-bottom:18px;flex-wrap:wrap}.hq-quote-dashboard-alert p{margin:5px 0 0;color:var(--muted);font-size:12px}.hq-quote-online-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:#f5f9fd;border:1px solid #dce7f0;border-radius:12px;margin-bottom:16px;flex-wrap:wrap}.hq-quote-accepted-notice{background:#fff;border:1px solid #d6e4ed;border-radius:12px;padding:16px;margin-bottom:15px}.hq-quote-accepted-notice h3{margin:0 0 8px;font-size:17px}.hq-quote-notice-row{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid #e5ecf3;padding:11px 0;flex-wrap:wrap}';
document.head.appendChild(css);
window.ChipInQuotePortal={mountQuotes,previewActions,pairForm,publish,synchronize,review,collect,portalReady,queueCustomerEmail,base:BASE};
})();
