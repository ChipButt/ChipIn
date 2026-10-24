(function(){
'use strict';
const form=document.getElementById('meetingForm');
const panes=Array.from(document.querySelectorAll('.pane'));
const stepButtons=Array.from(document.querySelectorAll('[data-jump]'));
const libraryKey='chipin-client-meetings-v2';
const legacyKey='chipin-client-meeting-bulls-head-v1';
let library={activeId:null,projects:{}};
const assetNames=[
 ['assetLogo','Logo / brand assets'],
 ['assetPhotos','Approved photographs'],
 ['assetFood','Food menu, prices and relevant allergen information'],
 ['assetDrinks','Products, services, drinks and promotional details'],
 ['assetHours','Confirmed opening hours (if relevant)'],
 ['assetEvents','Events and special offers'],
 ['assetContact','Contact, social, address and facilities'],
 ['assetDomain','Existing domain / access details']
];
const planData={
 pending:{title:'Not chosen yet',monthly:null},
 none:{title:'No maintenance plan',monthly:0},
 health:{title:'Website Health',monthly:25},
 care:{title:'Website Care',monthly:49},
 partner:{title:'Website Partner',monthly:89}
};
const steps=panes.length;
let active=0;
let saveNoticeTimer=null;
function field(name){return form.elements.namedItem(name);}
function val(name){const n=field(name);if(!n)return '';if(n instanceof RadioNodeList)return n.value||'';return (n.value||'').trim();}
function checkedValues(name){return Array.from(form.querySelectorAll('input[name="'+name+'"]:checked')).map(el=>el.value);}
function esc(s){return String(s===null||s===undefined?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function money(n){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);}
function positive(n){const x=Number(n);return Number.isFinite(x)&&x>=0?x:0;}
function safeText(s){return esc(s||'Not yet recorded');}
function dateText(s){if(!s)return 'To be agreed';const a=String(s).split('-');if(a.length!==3)return esc(s);return esc(a[2]+'/'+a[1]+'/'+a[0]);}
function unique(arr){return [...new Set(arr)];}
function deliveryInstructions(){
 const kind=val('deliveryMethod')||'portal';
 if(kind==='portal')return val('clientPortalUrl')?'Upload approved files here: '+val('clientPortalUrl'):'Chip In will send a private upload-page link after the quotation is approved. This is not a public Google Drive folder.';
 if(kind==='folder')return val('uploadFolder')?'Upload approved files to the private shared folder: '+val('uploadFolder'):'Chip In will send a private upload-folder invitation to the client email. Do not use public anonymous uploads.';
 if(kind==='other')return val('deliveryNotes')||'Delivery method to be agreed';
 return 'Email documents and approved photographs to '+(val('receivingEmail')||'jamesbutt.chipin+websites@gmail.com');
}
/* Dates are UTC-only calendar dates; the build and review use calendar days. */
function isoDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(new Date(s+'T12:00:00Z').getTime())&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
function addDays(s,n){if(!isoDate(s))return '';const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function firstMonday(y,m){const d=new Date(Date.UTC(y,m-1,1,12));d.setUTCDate(1+(8-d.getUTCDay())%7);return d.toISOString().slice(0,10);}
function lastMonday(y,m){const d=new Date(Date.UTC(y,m,0,12));d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return y+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
function standardBankHolidays(y){
 const days=new Set(),newYear=y+'-01-01',w=new Date(newYear+'T12:00:00Z').getUTCDay();
 days.add(w===6?y+'-01-03':w===0?y+'-01-02':newYear);
 const e=easter(y);days.add(addDays(e,-2));days.add(addDays(e,1));
 days.add(firstMonday(y,5));days.add(lastMonday(y,5));days.add(lastMonday(y,8));
 [25,26].forEach(day=>{const d=new Date(Date.UTC(y,11,day,12));let key=d.toISOString().slice(0,10);while(d.getUTCDay()===0||d.getUTCDay()===6||days.has(key)){d.setUTCDate(d.getUTCDate()+1);key=d.toISOString().slice(0,10);}days.add(key);});
 return days;
}
function addWorkingDays(s,count){if(!isoDate(s))return '';let d=s,added=0;while(added<count){d=addDays(d,1);const day=new Date(d+'T12:00:00Z').getUTCDay();if(day!==0&&day!==6&&!standardBankHolidays(Number(d.slice(0,4))).has(d))added++;}return d;}
function timeline(){
 const latest=val('contentDue'),received=val('assetsReceivedDate');
 const days=Number(val('buildDays')),duration=val('buildDays')!==''&&Number.isInteger(days)&&days>=1&&days<=180?days:null;
 const anchor=isoDate(received)?received:isoDate(latest)?latest:'';
 const draft=anchor&&duration!==null?addDays(anchor,duration):'';
 const feedback=draft?addDays(draft,3):'';
 const complete=feedback?addWorkingDays(feedback,5):'';
 const approval=isoDate(val('finalApprovalDate'))?val('finalApprovalDate'):'';
 const launchBase=approval||complete;
 return {latest,received,duration,anchor,draft,feedback,complete,approval,liveFrom:launchBase?addDays(launchBase,1):'',liveTo:launchBase?addDays(launchBase,2):''};
}
function timelineHTML(t){
 const label=d=>dateText(d);
 const cards=[
  ['01 · Client assets deadline',label(t.latest),'Latest agreed date to provide ALL required photos and content'],
  ['02 · Build starts',label(t.anchor),t.received?'Confirmed date when ALL required client materials arrived':'Projected from the promised asset deadline; actual receipt triggers the build'],
  ['03 · First website revision',label(t.draft),t.duration!==null?t.duration+' calendar days from complete assets':'Agree the build duration'],
  ['04 · Client review deadline',label(t.feedback),'3 calendar days to return one consolidated list of changes'],
  ['05 · Finished revision',label(t.complete),'5 working days after client feedback deadline, excluding standard England and Wales bank holidays'],
  ['06 · Website publication',t.liveFrom?label(t.liveFrom)+' to '+label(t.liveTo):'To be agreed',(t.approval?'After the recorded final written approval':'Illustrative ONLY if the client approves immediately when the finished version is presented')+'; normally within 24–48 hours, subject to DNS and SSL']
 ];
 return '<div class="timeline-cards">'+cards.map(r=>'<article><strong>'+esc(r[0])+'</strong><b>'+esc(r[1])+'</b><span>'+esc(r[2])+'</span></article>').join('')+'</div><p class="small-intro">All dates are '+(t.received?'based on the actual receipt date recorded':'projections assuming the client meets the assets deadline')+'. Late assets, delayed review, scope changes and exceptional bank holidays can shift the timetable. No site is published without final written approval.</p>';
}
function refreshTimeline(){const el=document.getElementById('timelinePreview');if(el)el.innerHTML=timelineHTML(timeline());}

function syncAssetToPages(changedPage){
 const map=[['Food / Menu','assetFood'],['Products / Services / Drinks','assetDrinks'],['Opening Hours','assetHours'],["What's On / Events",'assetEvents']];
 const match=map.find(([page])=>page===changedPage);
 if(!match)return;
 const status=field(match[1]);if(!status)return;
 const pageOn=checkedValues('includedPages').includes(changedPage);
 if(!pageOn)status.value='Not needed';
 else if(status.value==='Not needed')status.value='To supply';
}
function refreshHeader(){
 document.getElementById('heroBusiness').textContent=val('business')||'New client';
 document.getElementById('heroLocation').textContent=val('location')||'Enter business details to begin';
}
function projectLabel(state){return (state&&state.fields&&state.fields.business||'Untitled client')+' — '+((state&&state.fields&&state.fields.meetingDate)||'undated');}
function refreshPicker(){
 const select=document.getElementById('projectPicker');
 const pairs=Object.entries(library.projects);
 select.replaceChildren();
 for(const [id,state]of pairs){
  const opt=document.createElement('option');opt.value=id;opt.textContent=projectLabel(state);select.appendChild(opt);
 }
 select.value=library.activeId||'';
 refreshHeader();
}
function newId(){return 'client-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
function writeLibrary(){
 try{localStorage.setItem(libraryKey,JSON.stringify(library));return true;}catch(e){document.getElementById('saveStatus').textContent='Unable to save locally — download a backup';return false;}
}

function getState(){
 const fields={};
 Array.from(form.elements).forEach(el=>{
   if(!el.name)return;
   if(el.type==='radio'){if(el.checked)fields[el.name]=el.value;}
   else if(el.type==='checkbox'){
     if(!Array.isArray(fields[el.name]))fields[el.name]=[];
     if(el.checked)fields[el.name].push(el.value);
   }else if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT')fields[el.name]=el.value;
 });
 return {version:2,updatedAt:new Date().toISOString(),step:active,fields:fields};
}
function applyState(state){
 if(!state||![1,2].includes(state.version)||!state.fields||typeof state.fields!=='object'||Array.isArray(state.fields))throw new Error('This is not a valid Chip In meeting backup.');
 form.reset();
 for(const el of Array.from(form.elements)){
  if(!el.name||!Object.prototype.hasOwnProperty.call(state.fields,el.name))continue;
  const x=state.fields[el.name];
  if(el.type==='radio')el.checked=x===el.value;
  else if(el.type==='checkbox')el.checked=Array.isArray(x)&&x.includes(el.value);
  else if(typeof x==='string'||typeof x==='number')el.value=String(x);
 }
 // An older single-client meeting stored no page selectors, so all standard pages remain on.
 if(!Object.prototype.hasOwnProperty.call(state.fields,'includedPages'))form.querySelectorAll('[name="includedPages"]').forEach(el=>el.checked=true);
 goTo(Math.min(Math.max(Number(state.step)||0,0),steps-1));
 renderQuote();refreshHeader();
}
function save(){
 if(library.activeId)library.projects[library.activeId]=getState();
 if(writeLibrary()){
  document.getElementById('saveStatus').textContent='Saved on this device';
  clearTimeout(saveNoticeTimer);
  saveNoticeTimer=setTimeout(()=>document.getElementById('saveStatus').textContent='Changes save automatically in this browser',1900);
 }
 refreshPicker();
}
function loadProject(id){
 const state=library.projects[id];if(!state)return;
 library.activeId=id;applyState(state);refreshPicker();writeLibrary();
}
function createNewClient(){
 if(library.activeId)library.projects[library.activeId]=getState();
 form.reset();goTo(0);
 library.activeId=newId();library.projects[library.activeId]=getState();
 save();refreshHeader();
}
function goTo(i){
 active=Math.max(0,Math.min(steps-1,Number(i)||0));
 panes.forEach((el,j)=>{el.hidden=j!==active;});
 stepButtons.forEach((el,j)=>{el.classList.toggle('active',j===active);el.setAttribute('aria-current',j===active?'step':'false');});
 document.getElementById('progressCount').textContent=(active+1)+' of '+steps;
 document.getElementById('stepDescription').textContent=active===steps-1?'Review, then print or save the agreed documents.':'Step '+(active+1)+' of '+steps;
 document.getElementById('prevStep').disabled=active===0;
 document.getElementById('nextStep').textContent=active===steps-1?'Back to the start ↻':'Next step →';
 renderQuote();
 if(window.matchMedia('(max-width:760px)').matches){document.getElementById('workarea').scrollIntoView({block:'start',behavior:'smooth'});}
}
function calc(){
 const extraPageBlocks=Math.min(3,Math.max(0,Number(val('extraPages'))||0));
 const base=250,pages=extraPageBlocks*50,extras=positive(val('extraCost'));
 const oneOff=base+pages+extras;
 const domain=val('domainChoice'),domainYear=domain==='chipin'?20:0;
 const hosting=val('hostingChoice');
 const care=val('care')||'pending',monthly=planData[care]?planData[care].monthly:null;
 const monthlyTotal=monthly||0,annualTotal=domainYear;
 const firstYear=oneOff+12*monthlyTotal+annualTotal;
 const selectedPages=checkedValues('includedPages');
 const unresolved=[];
 if(!val('business'))unresolved.push('Business name');
 if(!val('contact'))unresolved.push('Client contact');
 if(!val('email'))unresolved.push('Contact email');
 if(!val('approver'))unresolved.push('Who approves the site');
 if(domain==='pending')unresolved.push('Domain arrangement');
 if(domain==='chipin'&&!val('domainOwner'))unresolved.push('Who owns the domain');
 if(domain==='chipin'&&!val('domainBilling'))unresolved.push('Annual domain invoice arrangement');
 if(hosting==='pending')unresolved.push('Hosting provider');
 if(hosting==='chipin')unresolved.push('Separate Chip In hosting scope and price (not included here)');
 if(care==='pending')unresolved.push('Monthly care choice, including no plan');
 if(!val('paymentSchedule'))unresolved.push('Build payment arrangement');
 if(!val('paymentMethod'))unresolved.push('Invoice payment method');
 if(care!=='pending'&&care!=='none'&&!val('monthlyMethod'))unresolved.push('How monthly care will be paid');
 if(extras>0&&!val('extraDescription'))unresolved.push('Describe the separately priced additional work');
 if(extras===0&&val('extraDescription'))unresolved.push('Agree a price for requested extra work');
 if(val('logoStatus')==='Logo design required — quote separately'&&extras===0)unresolved.push('Separate logo design quote');
 if(val('specialRequests'))unresolved.push('Check special requests against standard scope');
 if(selectedPages.length===0)unresolved.push('Choose at least one website page');
 const outstanding=assetNames.filter(([id])=>val(id)==='To supply');
 if(outstanding.length&&!val('contentDue'))unresolved.push('Deadline for client to send content');
 if(outstanding.length&&val('deliveryMethod')==='folder'&&!val('uploadFolder'))unresolved.push('Send client their private upload-folder invitation');
 if(document.getElementById('quoteApproved').checked&&val('deliveryMethod')==='portal'&&!val('clientPortalUrl'))unresolved.push('Activate the client upload workspace and record the link');
 if(outstanding.length&&val('deliveryMethod')==='email'&&!val('receivingEmail'))unresolved.push('Email address for sending content');
 if(outstanding.length&&val('deliveryMethod')==='other'&&!val('deliveryNotes'))unresolved.push('How client will deliver content');
 return {base,pages,extras,oneOff,domain,domainYear,hosting,care,monthly,monthlyTotal,annualTotal,firstYear,selectedPages,unresolved:unique(unresolved)};
}
function table(rows){
 return '<table class="quote-table"><thead><tr><th>Item</th><th>Charge</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('')+'</tbody></table>';
}
function quoteHTML(c){
 const list=[
  ['Standard website build — up to seven standard page areas; one review round',money(250)+' once'],
  ...(c.pages?[['Additional page capacity ('+Number(val('extraPages'))+' block'+(Number(val('extraPages'))>1?'s':'')+')',money(c.pages)+' once']]:[]),
  ...(c.extras?[['Additional agreed feature: '+safeText(val('extraDescription')),money(c.extras)+' once']]:[]),
  ['Domain',c.domain==='chipin'?money(20)+'/year':c.domain==='pending'?'Not decided':'Client/existing domain — £0 from Chip In'],
  ['Monthly website support',c.monthly===null?'Not chosen':esc(planData[c.care].title)+' — '+money(c.monthly)+'/month'],
  ['Hosting',c.hosting==='client'?'Client / external provider (cost paid separately)':c.hosting==='pending'?'Arrangement to be confirmed':'Chip In to arrange — separate price not yet included']
 ];
 const clientTodos=assetNames.filter(([id])=>val(id)==='To supply').map(x=>x[1]);
 const starts=c.unresolved.length===0?'Ready for written confirmation':'Draft: some decisions are still open';
 const sum='<div class="totals"><div class="total-chip"><span>BUILD &amp; AGREED EXTRAS</span><strong>'+money(c.oneOff)+'</strong></div><div class="total-chip"><span>MONTHLY CHARGES</span><strong>'+money(c.monthlyTotal)+'</strong></div><div class="total-chip"><span>ANNUAL CHARGES</span><strong>'+money(c.annualTotal)+'</strong></div></div>';
 return '<div class="small">'+safeText(val('business'))+' · '+safeText(val('location'))+' · Meeting '+dateText(val('meetingDate'))+'</div>'+
 '<h3>Proposed website quotation</h3>'+
 '<p class="small">'+esc(starts)+' · Review all items before issuing a formal quotation or invoice.</p>'+
 table(list)+sum+
 '<p><strong>Illustrative first 12 months after launch:</strong> '+money(c.firstYear)+' <span class="small">(build + 12 months of selected maintenance + annual domain; excludes unpriced hosting / third-party costs and assumes 12 months of care)</span></p>'+
 '<h4>Website sections selected</h4><p class="small">'+(c.selectedPages.length?esc(c.selectedPages.join('; ')):'No sections selected')+'. <strong>Mobile-friendly design, contact routes, social links where supplied, one review amendment and editor where appropriate.</strong></p>'+
 '<h4>Content still required from client</h4><p class="small">'+(clientTodos.length?esc(clientTodos.join(' · ')):'None flagged as outstanding in the checklist')+'</p><p class="small"><strong>Delivery:</strong> '+esc(deliveryInstructions())+' · Target '+dateText(val('contentDue'))+'</p>'+
 '<h4>Agreed payment arrangements</h4><p class="small">Build: '+safeText(val('paymentSchedule'))+'<br>Payment method: '+safeText(val('paymentMethod'))+'<br>Monthly care: '+safeText(val('monthlyMethod'))+'<br>Annual domain: '+safeText(val('domainBilling'))+'</p>'+
 '<h4>Timings &amp; approval</h4><p class="small">Target first draft: '+dateText(val('draftDate'))+' · Review: '+dateText(val('reviewDate'))+' · Target launch: '+dateText(val('launchDate'))+'<br>Client approval contact: '+safeText(val('approver'))+'</p>'+
 '<p class="small divide">Maintenance is optional and runs month to month with no long-term commitment. Unused update time does not carry forward. New pages, major redesigns, integrations, paid tools, domain fees and hosting are separate. Ad hoc updates: £40/hour, billed in 30-minute increments. Your site and any included editor remain usable without a maintenance subscription.</p>';
}
function renderQuote(){
 const c=calc();
 const ready=document.getElementById('readiness');
 ready.classList.toggle('warn',c.unresolved.length>0);
 ready.innerHTML=c.unresolved.length?'<strong>Still to confirm before issuing a fixed quote ('+c.unresolved.length+')</strong><ul>'+c.unresolved.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':'<strong>Core commercial decisions captured.</strong><p>Check the notes, confirm scope and obtain written acceptance before invoicing.</p>';
 document.getElementById('liveQuote').innerHTML=quoteHTML(c);
}
function topLine(){
 return '<div class="print-head"><div><b>Chip In</b><br><span>Website Design · Client meeting documents</span></div><div style="text-align:right"><strong>'+safeText(val('business'))+'</strong><br><span>'+safeText(val('location'))+'</span><br><span>'+dateText(val('meetingDate'))+'</span></div></div>';
}
function printQuoteDocument(){
 const c=calc();
 let body=topLine()+'<h1>Website proposal &amp; quotation</h1>';
 body+='<p class="stamp">'+(c.unresolved.length?'DRAFT — DETAILS TO CONFIRM':'PROPOSED — AWAITING WRITTEN ACCEPTANCE')+'</p>';
 body+='<p>Prepared for <strong>'+safeText(val('business'))+'</strong>. Contact: '+safeText(val('contact'))+' ('+safeText(val('email'))+').</p>';
 body+=quoteHTML(c);
 if(c.unresolved.length)body+='<h2>Decisions still outstanding</h2><ul>'+c.unresolved.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>';
 body+='<div class="print-terms"><strong>Important:</strong> This is the meeting proposal, not an invoice. Any outstanding requirements and third-party costs must be confirmed in writing. Work and payment begin according to the accepted quote and the subsequent invoice. Prices are shown as published or recorded in the meeting; any applicable tax treatment is confirmed on the formal invoice.</div>';
 body+='<div class="sign"><div>Client approval / written confirmation</div><div>Chip In final quotation / date</div></div>';
 return body;
}
function handoverHTML(){
 const c=calc();
 const clientTodos=assetNames.filter(([id])=>val(id)==='To supply').map(x=>x[1]);
 const supplied=assetNames.filter(([id])=>val(id)==='Already supplied').map(x=>x[1]);
 const tDate=dateText(val('contentDue'));
 const goals=checkedValues('goals');
 const rows=[
  ['Client contact',safeText(val('contact'))+' · '+safeText(val('email'))],
  ['Primary purpose',safeText(val('priority'))],
  ['Main visitors',safeText(val('audience'))],
  ['Customer priorities',esc(goals.join(' · ')||'Not chosen')],
  ['Pages to build',esc(c.selectedPages.join('; ')||'None chosen')],
  ['Page-specific instructions',safeText(val('pageNotes'))],
  ['Visual direction',safeText(val('style'))+' · '+safeText(val('colours'))],
  ['Client likes',safeText(val('demoLikes'))],
  ['Changes requested',safeText(val('demoChanges'))],
  ['Special requests',safeText(val('specialRequests'))],
  ['Preferred domain',safeText(val('proposedDomain'))],
  ['Existing domain',safeText(val('currentDomain'))],
  ['Hosting / domain notes',safeText(val('hostingNotes'))],
  ['Extra work',safeText(val('extraDescription'))],
  ['Launch target',dateText(val('launchDate'))]
 ];
 let out=topLine()+'<h1>Website project — who does what next?</h1><p>A simple record of the decisions made in the meeting. Scope and price are confirmed by the formal Chip In quotation.</p>';
 out+='<h2>Project decisions</h2><table>'+rows.map(x=>'<tr><td style="width:27%"><strong>'+x[0]+'</strong></td><td>'+x[1]+'</td></tr>').join('')+'</table>';
 out+='<div class="print-cols"><div><h2>What the client needs to do</h2><ul>';
 out+=clientTodos.length?clientTodos.map(x=>'<li>Provide '+esc(x)+'</li>').join(''):'<li>Confirm all supplied content is accurate and approved for use</li>';
 out+='<li>Supply any outstanding items by '+tDate+'</li><li>Confirm ownership/access for domain and hosting</li><li>Approve final quote and arrange agreed payment</li><li>Review first draft and consolidate one amendment round</li><li>Provide written approval before launch</li></ul><p><strong>Content contact:</strong> '+safeText(val('contentOwner'))+'</p></div><div><h2>What Chip In will do</h2><ul><li>Send written scope and confirmed quotation</li><li>Clarify any unpriced or additional requests</li><li>Confirm hosting and domain arrangements before purchase</li><li>Organise supplied content and build agreed pages</li><li>Test mobile, desktop and primary contact routes</li><li>Send the draft for one review-amendment round</li><li>Publish only after sign-off and arrange handover</li></ul><p><strong>Proposed first draft:</strong> '+dateText(val('draftDate'))+'</p></div></div>';
 out+='<h2>How to send your website materials</h2><p><strong>'+esc(deliveryInstructions())+'</strong></p><p><strong>Deadline:</strong> '+tDate+' · <strong>Content contact:</strong> '+safeText(val('contentOwner'))+'</p>';
 if(c.selectedPages.indexOf('Food / Menu')===-1)out+='<p class="print-note">Food / Menu is not requested for this website; no menu content is required.</p>';
 out+='<h2>Payment and approval process</h2><ol><li>Chip In sends the written quotation for approval.</li><li>Client approves the scope and receives an invoice with payment instructions.</li><li>Any new domain is bought only after approval; its standard managed fee is £20 annually.</li><li>Chip In sends a first draft; the client consolidates one amendment round and gives written launch approval.</li><li>Any optional care plan is billed monthly as agreed, with domain renewal invoiced annually. This tool does not take payments.</li></ol>';
 out+='<h2>Files already supplied</h2><p>'+esc(supplied.join(' · ')||'None marked supplied yet')+'</p>';
 out+='<h2>Additional meeting notes</h2><p>'+safeText(val('contentNotes'))+' '+safeText(val('commercialNotes'))+'</p>';
 if(c.unresolved.length)out+='<h2>Unresolved decisions</h2><ul>'+c.unresolved.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
 out+='<div class="print-terms"><strong>Reminder:</strong> £250 Standard Website Package; one draft review-amendment round; extras and ongoing costs agreed separately. Written confirmation is required before paid work is authorised.</div>';
 return out;
}
function plansHTML(){
 const cards=[
  ['Website Health','£25','For sites needing regular checks', ['Monthly page, link and form checks','Desktop and mobile functionality checks','Domain and SSL expiry checks','Versioned website backup','Content changes charged separately']],
  ['Website Care','£49','For a pub needing occasional updates',['Everything in Website Health','Up to 45 minutes of changes per month','Menu, price, text, photo and hours changes','Routine requests normally within 3 working days after content is supplied']],
  ['Website Partner','£89','For active events, promotions and changing content',['Everything in Website Care','Up to 90 minutes of updates monthly in total','Minor layout/content improvements','Priority requests normally within 2 working days','Quarterly improvement review']]
 ];
 let s=topLine()+'<h1>Website Care &amp; Updates</h1><p>Optional monthly support after the website goes live. Choose only the help you need.</p><div class="print-plan-grid">';
 cards.forEach((c,i)=>{s+='<div class="print-plan '+(i===1?'feature':'')+'"><h3>'+c[0]+'</h3><div class="plan-cost">'+c[1]+'<small style="font-size:10px"> / month</small></div><p>'+c[2]+'</p><ul>'+c[3].map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>';});
 s+='</div><h2>Or choose no monthly plan</h2><p>£0/month. Keep using the website and any included editor, and request ad hoc updates at £40/hour in 30-minute increments.</p>';
 s+='<div class="print-terms"><strong>The small print, kept simple:</strong> Plans are optional, month-to-month with no long-term commitment. Included time does not roll over. Changes outside the allowance are quoted. Domain, hosting, paid third-party software, major redesigns, new pages and complex functionality are separate. Routine turnaround times start after you supply the necessary content.</div>';
 s+='<p><strong>Client selection:</strong> '+safeText(planData[calc().care].title)+'</p><p class="print-note">Chip In · chipinworks.co.uk · Public package terms are available on the Website Design page.</p>';
 return s;
}
function printMode(which){
 const content=which==='quote'?printQuoteDocument():which==='handover'?handoverHTML():plansHTML();
 document.getElementById('printArea').innerHTML='<section class="print-sheet" data-print-active="true">'+content+'</section>';
 document.body.dataset.print=which;
 window.print();
}
function summaryPlain(){
 const c=calc();
 const outstanding=assetNames.filter(([id])=>val(id)==='To supply').map(x=>x[1]).join(', ');
 return 'CHIP IN — WEBSITE MEETING\n'+val('business')+' | '+val('location')+' | '+val('meetingDate')+
 '\nCONTACT: '+val('contact')+' | '+val('email')+
 '\nWEBSITE PRIORITY: '+val('priority')+
 '\nPAGES SELECTED: '+c.selectedPages.join('; ')+
 '\nPAGE NOTES: '+val('pageNotes')+
 '\nDESIGN: '+val('style')+' / '+val('colours')+
 '\nCHANGES REQUESTED: '+val('demoChanges')+
 '\n\nSTANDARD WEBSITE: £250 (up to 7 page areas; one review round; mobile-friendly; editor where appropriate)'+
 '\nEXTRA PAGE CAPACITY: '+money(c.pages)+
 '\nADDITIONAL AGREED FEATURES: '+(val('extraDescription')||'None')+' — '+money(c.extras)+
 '\nDOMAIN: '+(c.domain==='chipin'?'Chip In-managed standard domain £20/year':c.domain)+
 '\nHOSTING: '+(c.hosting==='chipin'?'Separate hosting quotation required':c.hosting)+
 '\nMAINTENANCE: '+planData[c.care].title+
 '\nONE-OFF BUILD: '+money(c.oneOff)+'\nMONTHLY CARE: '+money(c.monthlyTotal)+
 '\nANNUAL DOMAIN: '+money(c.annualTotal)+'\n12 MONTHS (excludes unpriced hosting): '+money(c.firstYear)+
 '\n\nCONTENT TO SUPPLY: '+outstanding+'\nCONTENT DUE: '+val('contentDue')+
 '\nCONTENT DELIVERY: '+deliveryInstructions()+
 '\nPAYMENT ARRANGEMENTS: '+val('paymentSchedule')+'; '+val('paymentMethod')+
 '\nMONTHLY BILLING: '+val('monthlyMethod')+'\nANNUAL BILLING: '+val('domainBilling')+
 '\nFIRST DRAFT: '+val('draftDate')+'\nREVIEW: '+val('reviewDate')+'\nLAUNCH: '+val('launchDate')+
 '\nOPEN ITEMS: '+(c.unresolved.join('; ')||'None flagged')+
 '\n\nMeeting summary, not an invoice. The client content files must still be supplied.';
}
function openClientOnboarding(){
 const box=document.getElementById('activationStatus');
 if(!document.getElementById('onboardingReady').checked){
  box.textContent='One-time Google Apps Script setup is not confirmed yet. Open the Setup instructions, deploy and test the backend, then tick the setup box.';
  return;
 }
 if(!document.getElementById('quoteApproved').checked){
  box.textContent='First confirm that the client accepted the written quotation.';
  return;
 }
 if(!val('business')||!val('email')){
  box.textContent='Enter the business name and client email before activating.';
  return;
 }
 const url='https://script.google.com/macros/s/AKfycbzz7FWTrjHkH8LUCrEElzr1MFCN9lN408-C_wC2o2FAU5j8HYXd43uUBgUHRDsiB78/exec?mode=onboard-admin';
 const fields=getState().fields;
 const payload={meetingId:library.activeId,business:val('business'),email:val('email'),contact:val('contact'),brief:{version:2,fields}};
 let hash='';
 try{
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  let binary='';bytes.forEach(byte=>binary+=String.fromCharCode(byte));
  hash=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
 }catch(err){box.textContent='Could not prepare the meeting specification: '+err.message;return;}
 const fullUrl=url+(hash.length<16000?'#brief='+encodeURIComponent(hash):'');
 if(hash.length>=16000)box.textContent='Brief is unusually long. Open the admin console and paste your exported meeting notes there.';
 else box.textContent='Opening secure client workspace activation. Sign in with your owner key, verify their details and press Create. This requires the one-time Apps Script deployment.';
 window.open(fullUrl,'_blank','noopener');
}
function buildBriefMarkdown(){
 const c=calc();
 const list=items=>items.length?items.map(item=>'- '+item).join('\n'):'- None';
 const fields=['business','location','contact','email','phone','approver','priority','audience','sellingPoint','specialRequests','style','colours','logoStatus','photos','demoLikes','demoChanges','references','pageNotes','contentOwner','contentDue','contentNotes','currentDomain','proposedDomain','domainOwner','hostingChoice','hostingNotes','care','paymentSchedule','paymentMethod','monthlyMethod','domainBilling','draftDate','reviewDate','launchDate','launchApprover','commercialNotes'];
 const lines=[
  '# Chip In — Website Build Specification',
  '',
  '> This is an internal build brief exported from the client meeting. Build only the chosen page areas. Treat special requests and additional features as pending until explicitly agreed and priced. Do not assume that assets have been supplied merely because they appear on this checklist.',
  '',
  '## Client',
  '- Business: '+(val('business')||'Not provided'),
  '- Location: '+(val('location')||'Not provided'),
  '- Client contact: '+(val('contact')||'Not provided'),
  '- Email: '+(val('email')||'Not provided'),
  '- Phone: '+(val('phone')||'Not provided'),
  '- Sign-off authority: '+(val('approver')||'Not specified'),
  '- Meeting: '+(val('meetingDate')||'Not specified'),
  '',
  '## Package and exact scope',
  '- Base price: £250 one-off, with up to seven standard page areas and one review-amendment round.',
  '- Fully built, mobile-friendly site; clear contact routes; social links where supplied; editor where appropriate; launch and handover.',
  '- Pages/sections SELECTED:',
  list(c.selectedPages),
  '- Pages/sections NOT REQUIRED:',
  list(Array.from(form.querySelectorAll('[name="includedPages"]:not(:checked)')).map(e=>e.value)),
  '- Extra page capacity: '+money(c.pages),
  '- Agreed additional functionality: '+(val('extraDescription')||'None'),
  '- Additional agreed cost: '+money(c.extras),
  '- Page-specific notes: '+(val('pageNotes')||'None'),
  '',
  '## Business objectives and creative brief',
  '- Priorities:',
  list(checkedValues('goals')),
  '- Primary goal: '+(val('priority')||'Not specified'),
  '- Intended audience: '+(val('audience')||'Not specified'),
  '- Differentiator: '+(val('sellingPoint')||'Not specified'),
  '- Style: '+(val('style')||'Not specified'),
  '- Colours: '+(val('colours')||'Not specified'),
  '- Logo status: '+(val('logoStatus')||'Not specified'),
  '- Image direction: '+(val('photos')||'Not specified'),
  '- Likes: '+(val('demoLikes')||'None recorded'),
  '- Requested changes: '+(val('demoChanges')||'None recorded'),
  '- Inspiration links: '+(val('references')||'None supplied'),
  '- Special requests (check against agreed price): '+(val('specialRequests')||'None recorded'),
  '',
  '## Content and assets',
  'Status of each material:',
  ...assetNames.map(([id,label])=>'- '+label+': '+(val(id)||'Unknown')),
  '- Person responsible: '+(val('contentOwner')||'Not specified'),
  '- Requested by: '+(val('contentDue')||'Not specified'),
  '- Delivery arrangement: '+deliveryInstructions(),
  '- Content notes: '+(val('contentNotes')||'None'),
  '- CRITICAL: Actual logos/photos/menus/files must be provided separately. This document does not contain or transfer those files.',
  '',
  '## Technical, domain and care',
  '- Domain arrangement: '+(c.domain==='chipin'?'Chip In-managed standard domain, £20 per year':c.domain),
  '- Existing domain: '+(val('currentDomain')||'None recorded'),
  '- Preferred domain: '+(val('proposedDomain')||'Not chosen'),
  '- Domain owner: '+(val('domainOwner')||'Not specified'),
  '- Hosting arrangement: '+(c.hosting==='chipin'?'Chip In to arrange, separate unpriced charge must be confirmed':c.hosting),
  '- Hosting notes: '+(val('hostingNotes')||'None recorded'),
  '- Care plan: '+planData[c.care].title+' ('+(c.monthly===null?'not chosen':money(c.monthly)+'/month')+')',
  '',
  '## Commercial and project milestones',
  '- Build and agreed extras: '+money(c.oneOff),
  '- Domain (annual): '+money(c.annualTotal),
  '- Care (monthly): '+money(c.monthlyTotal),
  '- First 12-month illustration, excluding any unpriced hosting: '+money(c.firstYear),
  '- Payment schedule: '+(val('paymentSchedule')||'Not agreed'),
  '- Payment method: '+(val('paymentMethod')||'Not agreed'),
  '- Monthly billing: '+(val('monthlyMethod')||'Not agreed'),
  '- Annual domain billing: '+(val('domainBilling')||'Not agreed'),
  '- First draft target: '+(val('draftDate')||'Not set'),
  '- Client review target: '+(val('reviewDate')||'Not set'),
  '- Launch target: '+(val('launchDate')||'Not set'),
  '- Launch approver: '+(val('launchApprover')||'Not specified'),
  '- Other notes: '+(val('commercialNotes')||'None'),
  '',
  '## Open decisions — resolve before treating as fully agreed',
  list(c.unresolved),
  '',
  '## Build instructions for a new ChatGPT work session',
  'Use this specification and the client-approved content files to build the website. Do not invent unavailable client details, domain credentials, hosting charges, menus, or prices. Match Chip In’s published £250 package scope. Flag missing decisions. Provide a draft for client review, allow one consolidated amendment round, and require launch approval.',
  '',
  '_Internal build document — keep private. No account passwords should be placed in these meeting notes._'
 ];
 return lines.join('\n');
}
function downloadBuildBrief(){
 const text=buildBriefMarkdown();
 const blob=new Blob([text],{type:'text/markdown;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download='chipin-'+(val('business')||'client').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-website-build-brief.md';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function copySummary(){
 const str=summaryPlain();
 try{
  if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(str);
  else{
   const ta=document.createElement('textarea');ta.value=str;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();if(!document.execCommand('copy'))throw new Error('Copy not supported');ta.remove();
  }
  const b=document.getElementById('copySummary');b.textContent='Copied ✓';setTimeout(()=>b.textContent='Copy meeting summary',2200);
 }catch(e){alert('Copy is unavailable in this browser. Use Print / Save PDF or Back up meeting notes.');}
}
function backup(){
 const data=JSON.stringify(getState(),null,2);
 const blob=new Blob([data],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='chipin-'+(val('business')||'client').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-meeting.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
stepButtons.forEach(b=>b.addEventListener('click',()=>{goTo(b.dataset.jump);save();}));
document.getElementById('prevStep').addEventListener('click',()=>{goTo(active-1);save();});
document.getElementById('nextStep').addEventListener('click',()=>{goTo(active===steps-1?0:active+1);save();});
document.getElementById('quoteTop').addEventListener('click',()=>{goTo(8);save();});
document.getElementById('plansTop').addEventListener('click',()=>{goTo(6);save();});
document.getElementById('printQuote').addEventListener('click',()=>printMode('quote'));
document.getElementById('printHandover').addEventListener('click',()=>printMode('handover'));
document.getElementById('printPlans').addEventListener('click',()=>printMode('plans'));
document.getElementById('copySummary').addEventListener('click',copySummary);
document.getElementById('downloadBuildBrief').addEventListener('click',downloadBuildBrief);
document.getElementById('activateAssets').addEventListener('click',openClientOnboarding);
document.getElementById('onboardingReady').addEventListener('change',e=>{try{localStorage.setItem('chipin-onboarding-setup-confirmed-v1',e.target.checked?'yes':'no');}catch(err){};});
document.getElementById('downloadNotes').addEventListener('click',backup);
document.getElementById('newClient').addEventListener('click',()=>createNewClient());
document.getElementById('projectPicker').addEventListener('change',e=>{
 if(e.target.value===library.activeId)return;
 if(library.activeId)library.projects[library.activeId]=getState();
 loadProject(e.target.value);
});
document.getElementById('importNotes').addEventListener('change',async(e)=>{
 const file=e.target.files&&e.target.files[0];if(!file)return;
 try{const obj=JSON.parse(await file.text());applyState(obj);save();alert('Meeting notes restored to this client on this device.');}
 catch(err){alert('Unable to restore these notes: '+err.message);}
 e.target.value='';
});
document.getElementById('resetMeeting').addEventListener('click',()=>{
 if(!confirm("Reset the current client's answers? Other client records remain saved. Download a backup first if needed."))return;
 form.reset();goTo(0);renderQuote();save();
});
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',()=>{save();renderQuote();});
form.addEventListener('change',e=>{
 if(e.target.name==='includedPages')syncAssetToPages(e.target.value);
 save();renderQuote();
});
try{
 const saved=localStorage.getItem(libraryKey);
 if(saved){
  const data=JSON.parse(saved);
  if(data&&data.projects&&typeof data.projects==='object'&&!Array.isArray(data.projects)&&Object.keys(data.projects).length)library=data;
 }
 if(!Object.keys(library.projects).length){
  const legacy=localStorage.getItem(legacyKey);
  if(legacy){
   try{
    const old=JSON.parse(legacy);
    if(old&&old.version===1&&old.fields){
     const id='previous-bulls-head-draft';
     library.projects[id]=old;
    }
   }catch(e){}
  }
  const blankId=newId();
  form.reset();goTo(0);
  library.projects[blankId]=getState();
  library.activeId=blankId;
 }
 if(!library.projects[library.activeId])library.activeId=Object.keys(library.projects)[0];
 loadProject(library.activeId);
 document.getElementById('saveStatus').textContent='Saved client meetings are available on this device';
}catch(e){
 form.reset();goTo(0);
 library={activeId:null,projects:{}};
 createNewClient();
 document.getElementById('saveStatus').textContent='Local save issue — download a backup before leaving';
}
try{document.getElementById('onboardingReady').checked=localStorage.getItem('chipin-onboarding-setup-confirmed-v1')==='yes';}catch(err){}
renderQuote();refreshHeader();
})();