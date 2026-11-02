// Recurring services: first-period billing, client schedules and draft renewal invoices.
// Drafts are created only on a deliberate click while HQ is open; nothing is sent automatically.
(function(){
'use strict';
const onlyDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))?String(x):'';
const clean=x=>String(x==null?'':x).trim();
const amount=x=>Math.round(Number(x)*100)/100;
const cycles=['monthly','annual'];
const registry=()=>{if(!Array.isArray(state.recurringCharges))state.recurringCharges=[];return state.recurringCharges;};
const byId=id=>registry().find(x=>x.id===id);
const formatFrequency=f=>f==='annual'?'Annually':'Monthly';
const yearMonthDay=x=>{const [y,m,d]=x.split('-').map(Number);return {y,m,d};};
function validDate(x){
 if(!onlyDate(x))return false;
 const {y,m,d}=yearMonthDay(x),date=new Date(Date.UTC(y,m-1,d));
 return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
function nextDate(date,frequency,anchorDay){
 if(!validDate(date)||!cycles.includes(frequency))throw Error('Invalid billing date or frequency');
 const {y,m,d}=yearMonthDay(date),months=frequency==='annual'?12:1;
 const first=new Date(Date.UTC(y,m-1+months,1));
 const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 return [first.getUTCFullYear(),String(first.getUTCMonth()+1).padStart(2,'0'),String(Math.min(anchorDay||d,last)).padStart(2,'0')].join('-');
}
const chargesFor=clientId=>registry().filter(c=>c.clientId===clientId);
const cleanStart=x=>validDate(x)?x:TODAY();
function planFromJob(job,kind,source){
 const frequency=kind==='care'?'monthly':'annual';
 const first=kind==='care' ? job.servicePricing?.billingOptions?.monthlyFirst!==false : job.servicePricing?.billingOptions?.domainFirst!==false;
 const anchorDate=cleanStart(job.startDate);
 const detail=kind==='care' ? (source?.name||'Website care') : 'Domain registration and renewal';
 const title=kind==='care'?(source?.name||'Website care'):'Domain renewal';
 const prior=registry().find(c=>c.jobId===job.id&&c.kind===kind);
 if(!source||!Number.isFinite(Number(source.amount))||Number(source.amount)<=0) {
  if(prior){prior.active=false;prior.updatedAt=new Date().toISOString();}
  return;
 }
 if(prior){
  const alreadyInvoiced=state.invoices.some(i=>i.recurringChargeId===prior.id);
  prior.clientId=job.clientId;prior.name=title;prior.description=detail;
  // Do not reset agreed renewal amounts or dates once manually edited.
  if(!prior.amountEdited)prior.amount=amount(source.amount);
  if(!alreadyInvoiced&&prior.anchorDate!==anchorDate){
   prior.anchorDate=anchorDate;
   prior.anchorDay=Number(anchorDate.slice(-2));
   prior.nextInvoiceDate=first?nextDate(anchorDate,frequency,prior.anchorDay):anchorDate;
  }
  prior.firstIncludedInJob=first;prior.frequency=frequency;
  prior.updatedAt=new Date().toISOString();
  return;
 }
 registry().push({
  id:uid('bill'),clientId:job.clientId,jobId:job.id,kind,name:title,description:detail,
  amount:amount(source.amount),frequency,anchorDate,anchorDay:Number(anchorDate.slice(-2)),
  nextInvoiceDate:first?nextDate(anchorDate,frequency,Number(anchorDate.slice(-2))):anchorDate,
  firstIncludedInJob:first,active:true,createdAt:new Date().toISOString()
 });
}
function syncJob(job){
 if(!job||!job.clientId||!job.id||job.category!=='Website Design'||job.pricingModel!=='package')return;
 planFromJob(job,'care',job.servicePricing?.monthlyCare||job.monthlyCare);
 planFromJob(job,'domain',job.servicePricing?.annualDomain||job.annualDomain);
}
function firstPeriodControls(job={}){
 const price=job.servicePricing||{};
 const defaults=price.billingOptions||{
  monthlyFirst:price.version===1?false:true,
  domainFirst:true
 };
 const markup='<div id="hqFirstPeriodOptions" class="field full hq-first-period">'+
  '<h4>First-period billing</h4>'+
  '<label id="hqFirstMonthRow"><input id="hqBillFirstMonth" type="checkbox" '+(defaults.monthlyFirst!==false?'checked':'')+'> Charge the first month of website care on this job</label>'+
  '<label id="hqFirstDomainRow"><input id="hqBillFirstDomain" type="checkbox" '+(defaults.domainFirst!==false?'checked':'')+'> Charge the first year of the domain on this job</label>'+
  '<p>Switch either off to invoice that first period separately. Future renewals follow their monthly or annual schedule.</p></div>';
 return markup;
}
const openJobOld=openJobForm;
openJobForm=function(id,duplicateFromId){
 openJobOld(id,duplicateFromId);
 const form=document.getElementById('jobForm'),box=document.getElementById('hqPricingBox');
 if(!form||!box)return;
 const job=id?jobById(id):duplicateFromId?jobById(duplicateFromId):{};
 const holder=document.createElement('div');
 holder.innerHTML=firstPeriodControls(job||{});
 const control=holder.firstElementChild;
 const extras=box.querySelector('.hq-extra-head');
 box.insertBefore(control,extras||box.firstChild);
 const cat=form.elements.namedItem('category');
 const selector=box.querySelector('#hqPricingChoices');
 function showFirst(){
  const isWeb=cat.value==='Website Design';
  control.style.display=isWeb?'':'none';
  const care=selector.querySelector('[data-hq-opt="webCare"]'),domain=selector.querySelector('[data-hq-opt="webDomain"]');
  control.querySelector('#hqFirstMonthRow').style.display=isWeb&&care&&Number(care.value)>0?'':'none';
  control.querySelector('#hqFirstDomainRow').style.display=isWeb&&domain&&Number(domain.value)>0?'':'none';
  const caption=box.querySelector('#hqCareCaption');
  if(caption)caption.textContent='Website care — future monthly renewals';
 }
 const trigger=()=>cat.dispatchEvent(new Event('change',{bubbles:true}));
 cat.addEventListener('change',showFirst);
 selector.addEventListener('change',showFirst);
 for(const id of ['hqBillFirstMonth','hqBillFirstDomain'])control.querySelector('#'+id).addEventListener('change',trigger);
 showFirst();
 trigger();
 const originalSubmit=form.onsubmit;
 form.onsubmit=async e=>{
  const previous=new Set(state.jobs.map(j=>j.id));
  const previousEdited=id?JSON.stringify(jobById(id)||{}):null;
  await originalSubmit.call(form,e);
  const created=state.jobs.filter(j=>!previous.has(j.id));
  const existing=id?jobById(id):null;
  const edited=existing&&JSON.stringify(existing)!==previousEdited?[existing]:[];
  const affected=created.length?created:edited;
  if(!affected.length)return;
  for(const job of affected)syncJob(job);
  await saveState();
 };
};
function createInvoice(chargeId){
 const charge=byId(chargeId);
 if(!charge||!charge.active)throw Error('This recurring charge is paused or unavailable');
 if(!clientById(charge.clientId))throw Error('The linked client no longer exists');
 const period=charge.nextInvoiceDate;
 if(!validDate(period)||!Number.isFinite(Number(charge.amount))||Number(charge.amount)<=0)throw Error('Check the renewal date and amount first.');
 const found=state.invoices.find(inv=>inv.recurringChargeId===charge.id&&inv.recurringPeriod===period);
 if(found)throw Error('An invoice already exists for that billing period: '+found.number);
 const issue=TODAY(),days=Number(state.settings.defaultTerms||14),now=new Date().toISOString();
 const inv={
  id:uid('inv'),number:nextInvoiceNumber(),clientId:charge.clientId,jobId:null,
  issueDate:issue,dueDate:addDays(issue,days),status:'Draft',payments:[],
  items:[{description:charge.name+' — '+period+(clean(charge.description)?' — '+charge.description:''),qty:1,rate:amount(charge.amount)}],
  vatRate:Number(state.settings.defaultVatRate||0),
  notes:'Thank you for your business.',
  recurringChargeId:charge.id,recurringPeriod:period,sourceJobId:charge.jobId||null,createdAt:now
 };
 state.invoices.push(inv);
 state.settings.nextInvoiceNumber=Number(state.settings.nextInvoiceNumber||1)+1;
 charge.lastInvoiceId=inv.id;charge.lastInvoiceDate=issue;
 charge.nextInvoiceDate=nextDate(period,charge.frequency,charge.anchorDay);
 charge.updatedAt=now;
 return inv;
}
let inFlight=false;
async function draftCharge(id){
 if(inFlight)return;
 inFlight=true;
 try{
  const invoice=createInvoice(id);
  await saveState();
  render();
  openInvoicePreview(invoice.id);
  toast('Draft renewal invoice created: '+invoice.number);
 }catch(err){toast('Could not create renewal invoice: '+err.message)}
 finally{inFlight=false}
}
function scheduleForm(id,clientId){
 const current=id?byId(id):null;
 const client=current?.clientId||clientId||'';
 const options=state.clients.map(c=>'<option value="'+esc(c.id)+'"'+(c.id===client?' selected':'')+'>'+esc(c.name)+'</option>').join('');
 const f=current?.frequency||'monthly';
 openModal('<h2>'+(current?'Edit recurring charge':'Add recurring charge')+'</h2>'+
  '<p class="sub">Creates draft invoices when you choose to generate the next billing period. Nothing is automatically emailed or charged.</p>'+
  '<form id="hqRecurringForm"><div class="form-grid">'+
  '<div class="field full"><label>Client</label><select name="clientId" required><option value="">Choose client…</option>'+options+'</select></div>'+
  '<div class="field full"><label>Charge name</label><input name="name" required maxlength="120" value="'+esc(current?.name||'')+'" placeholder="e.g. Website maintenance"></div>'+
  '<div class="field full"><label>Description</label><textarea name="description" rows="3">'+esc(current?.description||'')+'</textarea></div>'+
  '<div class="field"><label>Amount per period (£)</label><input name="amount" type="number" min="0.01" step="0.01" required value="'+esc(current?.amount??'')+'"></div>'+
  '<div class="field"><label>Frequency</label><select name="frequency"><option value="monthly"'+(f==='monthly'?' selected':'')+'>Monthly</option><option value="annual"'+(f==='annual'?' selected':'')+'>Annually</option></select></div>'+
  '<div class="field"><label>Next invoice period starts</label><input type="date" name="nextInvoiceDate" required value="'+esc(current?.nextInvoiceDate||TODAY())+'"></div>'+
  '<div class="field"><label>Status</label><select name="active"><option value="true"'+(current?.active===false?'':' selected')+'>Active</option><option value="false"'+(current?.active===false?' selected':'')+'>Paused</option></select></div>'+
  '</div><div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button>'+
  '<button class="btn" type="submit">Save recurring charge</button></div></form>',true);
 const form=document.getElementById('hqRecurringForm');
 form.onsubmit=async e=>{
  e.preventDefault();
  const d=Object.fromEntries(new FormData(form).entries());
  const price=Number(d.amount);
  if(!d.clientId||!clientById(d.clientId))return toast('Choose a client');
  if(!clean(d.name)||!validDate(d.nextInvoiceDate)||!cycles.includes(d.frequency)||!Number.isFinite(price)||price<=0)return toast('Check the recurring charge details');
  const record=current||{id:uid('bill'),kind:'custom',createdAt:new Date().toISOString(),firstIncludedInJob:false};
  const oldDate=record.nextInvoiceDate;
  Object.assign(record,{clientId:d.clientId,name:clean(d.name),description:clean(d.description),
   amount:amount(price),amountEdited:true,frequency:d.frequency,nextInvoiceDate:d.nextInvoiceDate,
   anchorDay:Number(d.nextInvoiceDate.slice(-2)),active:d.active==='true',updatedAt:new Date().toISOString()});
  if(!current)registry().push(record);
  if(oldDate!==d.nextInvoiceDate)record.anchorDate=d.nextInvoiceDate;
  await saveState();closeModal();render();toast('Recurring charge saved');
 };
}
const oldInvoices=renderInvoices;
renderInvoices=function(){
 oldInvoices();
 const host=document.getElementById('content');if(!host)return;
 const sorted=registry().slice().sort((a,b)=>(a.nextInvoiceDate||'').localeCompare(b.nextInvoiceDate||''));
 const due=sorted.filter(c=>c.active&&c.nextInvoiceDate<=TODAY()).length;
 const panel=document.createElement('section');
 panel.className='hq-renewal-panel';
 panel.id='hqRenewalPanel';
 panel.innerHTML='<div class="hq-renewal-head"><div><h2>Recurring client charges</h2><p>Monthly and annual renewals. Generate an invoice for each period when due; drafts are never sent automatically.</p></div><button class="btn small" id="hqNewRecurring">+ Recurring Charge</button></div>'+
  '<div class="hq-renewal-count">'+due+' currently due · '+sorted.filter(x=>x.active).length+' active schedule(s)</div>'+
  (sorted.length ? '<div class="hq-renewal-list">'+sorted.map(c=>{
   const client=clientById(c.clientId),overdue=c.active&&c.nextInvoiceDate<=TODAY();
   return '<article class="hq-renewal-item"><div class="hq-renewal-main"><strong>'+esc(c.name)+'</strong><span>'+esc(client?.name||'Unknown client')+' · '+formatFrequency(c.frequency)+' · '+money(c.amount)+'</span>'+
    '<small>Next billing: '+esc(c.nextInvoiceDate||'Not set')+(c.firstIncludedInJob?' · First period included on the original job':'')+'</small></div>'+
    '<div class="hq-renewal-actions"><span class="badge '+(c.active?(overdue?'bad':'ok'):'')+'">'+(c.active?(overdue?'Due':'Upcoming'):'Paused')+'</span>'+
    '<button class="btn small secondary" data-hq-charge-edit="'+esc(c.id)+'">Edit</button>'+
    '<button class="btn small secondary" data-hq-charge-pause="'+esc(c.id)+'">'+(c.active?'Pause':'Resume')+'</button>'+
    (c.active?'<button class="btn small gold" data-hq-charge-invoice="'+esc(c.id)+'">'+(overdue?'Create due invoice':'Create next invoice')+'</button>':'')+
    '</div></article>';
  }).join('')+'</div>':'<p class="muted">No recurring charges yet. Add one here, or save a website job with monthly care or a supplied domain.</p>');
 host.prepend(panel);
 panel.querySelector('#hqNewRecurring').onclick=()=>scheduleForm();
 panel.querySelectorAll('[data-hq-charge-edit]').forEach(b=>b.onclick=()=>scheduleForm(b.dataset.hqChargeEdit));
 panel.querySelectorAll('[data-hq-charge-invoice]').forEach(b=>b.onclick=()=>draftCharge(b.dataset.hqChargeInvoice));
 panel.querySelectorAll('[data-hq-charge-pause]').forEach(b=>b.onclick=async()=>{
  const c=byId(b.dataset.hqChargePause);if(!c)return;
  c.active=!c.active;c.updatedAt=new Date().toISOString();await saveState();render();
 });
};
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-hq-client-recurring]');
 if(!btn)return;
 const client=clientById(btn.dataset.hqClientRecurring);
 if(!client)return;
 page='invoices';render();scheduleForm(null,client.id);
});
const css=document.createElement('style');
css.textContent='.hq-first-period{border-top:1px solid var(--line);padding:14px 0;margin-top:12px}.hq-first-period h4{margin:0 0 10px;font-size:13px}.hq-first-period label{display:flex;align-items:center;gap:9px;font-size:12px;line-height:1.4;margin:9px 0}.hq-first-period input{width:auto}.hq-first-period p{font-size:11px;color:var(--muted);margin:8px 0 0}.hq-renewal-panel{border:1px solid var(--line);border-radius:14px;background:#fff;padding:18px;margin-bottom:20px}.hq-renewal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.hq-renewal-head h2{margin:0 0 5px;font-size:19px}.hq-renewal-head p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}.hq-renewal-count{margin:12px 0;color:var(--muted);font-size:12px}.hq-renewal-item{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding:14px 0}.hq-renewal-main{display:flex;flex-direction:column;gap:4px;overflow-wrap:anywhere}.hq-renewal-main strong{font-size:14px}.hq-renewal-main span{font-size:12px}.hq-renewal-main small{font-size:11px;color:var(--muted)}.hq-renewal-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}@media(max-width:700px){.hq-renewal-item{align-items:stretch;flex-direction:column}.hq-renewal-actions{justify-content:flex-end}}';
document.head.appendChild(css);
window.ChipInRecurringBilling={nextDate,priceFromJob:syncJob,createInvoice,charges:registry,validDate};
})();
