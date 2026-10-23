(function(){
'use strict';
const form=document.getElementById('meetingForm');
const panes=Array.from(document.querySelectorAll('.pane'));
const stepButtons=Array.from(document.querySelectorAll('[data-jump]'));
const storageKey='chipin-client-meeting-bulls-head-v1';
const assetNames=[
 ['assetLogo','Logo / brand assets'],
 ['assetPhotos','Approved photographs'],
 ['assetFood','Food menu, prices and allergen information'],
 ['assetDrinks','Drinks and promotional information'],
 ['assetHours','Confirmed opening hours (including seasonal)'],
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
 return {version:1,updatedAt:new Date().toISOString(),step:active,fields:fields};
}
function applyState(state){
 if(!state||state.version!==1||!state.fields||typeof state.fields!=='object'||Array.isArray(state.fields))throw new Error('This is not a valid Chip In meeting backup.');
 for(const el of Array.from(form.elements)){
  if(!el.name||!Object.prototype.hasOwnProperty.call(state.fields,el.name))continue;
  const x=state.fields[el.name];
  if(el.type==='radio')el.checked=x===el.value;
  else if(el.type==='checkbox')el.checked=Array.isArray(x)&&x.includes(el.value);
  else if(typeof x==='string'||typeof x==='number')el.value=String(x);
 }
 goTo(Math.min(Math.max(Number(state.step)||0,0),steps-1));
 renderQuote();
}
function save(){
 try{localStorage.setItem(storageKey,JSON.stringify(getState()));document.getElementById('saveStatus').textContent='Saved on this device';clearTimeout(saveNoticeTimer);saveNoticeTimer=setTimeout(()=>document.getElementById('saveStatus').textContent='Changes save automatically in this browser',1900);}
 catch(e){document.getElementById('saveStatus').textContent='Local storage unavailable — download a backup';}
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
 const base=250, pages=extraPageBlocks*50, extras=positive(val('extraCost'));
 const oneOff=base+pages+extras;
 const domain=val('domainChoice');
 const domainYear=domain==='chipin'?20:0;
 const hosting=val('hostingChoice');
 const hostEntered=val('hostingCost')!=='';
 const hostPrice=hosting==='chipin'&&hostEntered?positive(val('hostingCost')):0;
 const hostInterval=val('hostingInterval');
 const hostMonth=hosting==='chipin'&&hostInterval==='month'?hostPrice:0;
 const hostYear=hosting==='chipin'&&hostInterval==='year'?hostPrice:0;
 const care=val('care')||'pending';
 const monthly=planData[care]?planData[care].monthly:null;
 const monthlyTotal=(monthly||0)+hostMonth;
 const annualTotal=domainYear+hostYear;
 const firstYear=oneOff+12*monthlyTotal+annualTotal;
 const unresolved=[];
 if(!val('contact'))unresolved.push('Name of decision-maker / contact');
 if(!val('email'))unresolved.push('Contact email');
 if(!val('approver'))unresolved.push('Who signs off the website');
 if(domain==='pending')unresolved.push('Domain choice and access');
 if(domain==='chipin'&&!val('domainOwner'))unresolved.push('Domain registrant / owner');
 if(domain==='chipin'&&!val('domainBilling'))unresolved.push('How annual domain renewal is billed');
 if(hosting==='pending')unresolved.push('Hosting provider and cost');
 if(hosting==='chipin'&&!hostEntered)unresolved.push('Chip In hosting price');
 if(care==='pending')unresolved.push('Monthly care decision (including no plan)');
 if(!val('paymentSchedule'))unresolved.push('Build payment schedule');
 if(!val('paymentMethod'))unresolved.push('Invoice / payment method');
 if(care!=='pending'&&care!=='none'&&!val('monthlyMethod'))unresolved.push('How monthly payments will be arranged');
 if(extras>0&&!val('extraDescription'))unresolved.push('What the separately priced feature includes');
 if(extras===0&&val('extraDescription'))unresolved.push('Price for the additional feature described');
 if(val('logoStatus')==='Logo design required — quote separately'&&extras===0)unresolved.push('Logo design quotation, if it is part of the order');
 if(val('specialRequests'))unresolved.push('Confirm any special requests fit standard scope or have a separate quote');
 return {base,pages,extras,oneOff,domain,domainYear,hosting,hostPrice,hostMonth,hostYear,care,monthly,monthlyTotal,annualTotal,firstYear,unresolved:unique(unresolved)};
}
function table(rows){
 return '<table class="quote-table"><thead><tr><th>Item</th><th>Charge</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('')+'</tbody></table>';
}
function quoteHTML(c){
 const list=[
  ['Standard website build — seven page areas; one review round',money(250)+' once'],
  ...(c.pages?[['Additional page capacity ('+Number(val('extraPages'))+' block'+(Number(val('extraPages'))>1?'s':'')+')',money(c.pages)+' once']]:[]),
  ...(c.extras?[['Additional agreed feature: '+safeText(val('extraDescription')),money(c.extras)+' once']]:[]),
  ['Domain',c.domain==='chipin'?money(20)+'/year':c.domain==='pending'?'Not decided':'Client/existing domain — £0 from Chip In'],
  ['Monthly website support',c.monthly===null?'Not chosen':esc(planData[c.care].title)+' — '+money(c.monthly)+'/month'],
  ['Hosting',c.hosting==='client'?'Client supplied (no Chip In fee)':c.hosting==='pending'?'Price / provider not agreed':money(c.hostPrice)+(val('hostingInterval')==='year'?'/year':'/month')]
 ];
 const clientTodos=assetNames.filter(([id])=>val(id)==='To supply').map(x=>x[1]);
 const starts=c.unresolved.length===0?'Ready for written confirmation':'Draft: some decisions are still open';
 const sum='<div class="totals"><div class="total-chip"><span>BUILD &amp; AGREED EXTRAS</span><strong>'+money(c.oneOff)+'</strong></div><div class="total-chip"><span>MONTHLY CHARGES</span><strong>'+money(c.monthlyTotal)+'</strong></div><div class="total-chip"><span>ANNUAL CHARGES</span><strong>'+money(c.annualTotal)+'</strong></div></div>';
 return '<div class="small">'+safeText(val('business'))+' · '+safeText(val('location'))+' · Meeting '+dateText(val('meetingDate'))+'</div>'+
 '<h3>Proposed website quotation</h3>'+
 '<p class="small">'+esc(starts)+' · Review all items before issuing a formal quotation or invoice.</p>'+
 table(list)+sum+
 '<p><strong>Indicative first 12 months:</strong> '+money(c.firstYear)+' <span class="small">(build + 12 monthly charges + annual charges; excludes any unpriced items)</span></p>'+
 '<h4>Website included</h4><p class="small">Home; About; Food/Menu; Drinks; Opening Hours; Events; Visit/Contact/Facilities. Mobile-friendly, clear contact routes, one review-amendment round, and an appropriate client editor.</p>'+
 '<h4>Content still required from client</h4><p class="small">'+(clientTodos.length?esc(clientTodos.join(' · ')):'None flagged as outstanding in the checklist')+'</p>'+
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
  ['Customer actions',esc(goals.join(' · ')||'Not chosen')],
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
 '\n\nCONTACT: '+val('contact')+' | '+val('email')+'\nMAIN PRIORITY: '+val('priority')+
 '\nDESIGN: '+val('style')+' / '+val('colours')+'\nCHANGES REQUESTED: '+val('demoChanges')+
 '\n\nSTANDARD WEBSITE: £250 (7 included areas, one review-amendment round, appropriate editor)\nADDITIONAL PAGE CAPACITY: '+money(c.pages)+
 '\nAGREED EXTRA FEATURES: '+(val('extraDescription')||'None')+' — '+money(c.extras)+
 '\nDOMAIN: '+(c.domain==='chipin'?'Chip In managed £20/year':c.domain)+
 '\nHOSTING: '+(c.hosting==='chipin'?money(c.hostPrice)+' / '+val('hostingInterval'):c.hosting)+
 '\nMAINTENANCE: '+planData[c.care].title+
 '\nBUILD TOTAL: '+money(c.oneOff)+'\nMONTHLY TOTAL: '+money(c.monthlyTotal)+
 '\nANNUAL TOTAL: '+money(c.annualTotal)+'\nFIRST YEAR (IF ALL PRICED): '+money(c.firstYear)+
 '\n\nCONTENT TO SUPPLY: '+outstanding+'\nCONTENT DUE: '+val('contentDue')+
 '\nPAYMENT SCHEDULE: '+val('paymentSchedule')+'\nPAYMENT METHOD: '+val('paymentMethod')+
 '\nMONTHLY ARRANGEMENT: '+val('monthlyMethod')+'\nDOMAIN RENEWAL ARRANGEMENT: '+val('domainBilling')+
 '\nDRAFT: '+val('draftDate')+'\nREVIEW: '+val('reviewDate')+'\nLAUNCH: '+val('launchDate')+
 '\n\nSTILL OPEN: '+(c.unresolved.join('; ')||'No core commercial decisions flagged')+
 '\n\nThis is meeting guidance, not an issued invoice or contract.';
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
document.getElementById('downloadNotes').addEventListener('click',backup);
document.getElementById('importNotes').addEventListener('change',async(e)=>{
 const file=e.target.files&&e.target.files[0];if(!file)return;
 try{const obj=JSON.parse(await file.text());applyState(obj);save();alert('Meeting notes restored on this device.');}
 catch(err){alert('Unable to restore these notes: '+err.message);}
 e.target.value='';
});
document.getElementById('resetMeeting').addEventListener('click',()=>{
 if(!confirm('Clear all saved meeting answers on this device? Download a backup first if you need one.'))return;
 try{localStorage.removeItem(storageKey);}catch(e){}
 form.reset();goTo(0);renderQuote();save();
});
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',()=>{save();renderQuote();});
form.addEventListener('change',()=>{save();renderQuote();});
try{
 const s=localStorage.getItem(storageKey);
 if(s){applyState(JSON.parse(s));document.getElementById('saveStatus').textContent='Restored locally saved meeting notes';}
 else goTo(0);
}catch(e){goTo(0);document.getElementById('saveStatus').textContent='Save a downloadable backup to preserve notes';}
renderQuote();
})();