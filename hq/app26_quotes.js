// Chip In HQ - proposals, subscriptions and quote-to-invoice workflow.
(function(){
'use strict';
const clean=x=>String(x==null?'':x).trim();
const round=x=>Math.round((Number(x)||0)*100)/100;
const pricing=()=>window.ChipInServicePricing;
const quotes=()=>{if(!Array.isArray(state.quotes))state.quotes=[];return state.quotes;};
const byId=id=>quotes().find(q=>q.id===id);
const codes=['Draft','Sent','Accepted','Declined'];
const freq=f=>f==='monthly'?'per month':f==='annual'?'per year':'one-off';
const isIncluded=x=>x.mode!=='offered';
const vatPct=q=>q.vatRegistered?Number(q.vatRate||0):0;
const gross=(q,n)=>round(n*(1+vatPct(q)/100));
const validity=q=>q.status==='Sent'&&q.validUntil&&q.validUntil<TODAY()?'Expired':q.status;
const number=()=>{
 const y=TODAY().slice(0,4),n=Number(state.settings.nextQuoteNumber||1);
 return 'QTE-'+y+'-'+String(n).padStart(4,'0');
};
const option=(value,label,selected)=>'<option value="'+esc(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+esc(label)+'</option>';
const field=(label,html)=>'<div class="field"><label>'+esc(label)+'</label>'+html+'</div>';
const catNames=()=>[...Object.keys(pricing().catalog),'Other'];
function plan(q){
 const base=(q.baseLines||[]).map(x=>({name:x.name,amount:round(x.amount),frequency:'one-off',includeFirst:true,mode:'required',kind:'base'}));
 const domain=q.domain&&q.domain.mode!=='own'?{name:'Domain registration and renewal'+(q.domain.suggested?' — '+q.domain.suggested:''),amount:round(q.domain.amount),frequency:q.domain.mode,includeFirst:q.domain.includeFirst!==false,mode:'required',kind:'domain'}:null;
 const care=q.care&&Number(q.care.amount)>0?{name:q.care.name||'Website care',amount:round(q.care.amount),frequency:'monthly',includeFirst:q.care.includeFirst!==false,mode:'included',kind:'care'}:null;
 const extras=(q.extras||[]).map(x=>({...x,amount:round(x.amount),kind:'extra',frequency:x.frequency||'one-off'}));
 const chosen=[...base,...(domain?[domain]:[]),...(care?[care]:[]),...extras.filter(isIncluded)];
 const offered=extras.filter(x=>!isIncluded(x));
 const upfront=round(chosen.reduce((sum,x)=>sum+((x.frequency==='one-off'||x.includeFirst!==false)?x.amount:0),0));
 return {chosen,offered,base,domain,care,extras,upfront,monthly:chosen.filter(x=>x.frequency==='monthly'),annual:chosen.filter(x=>x.frequency==='annual')};
}
function domainAvailability(q){
 const d=q.domain;
 if(!d||d.mode==='own'||!d.suggested)return '';
 return '<p class="hq-quote-domain-note"><strong>Suggested domain:</strong> '+esc(d.suggested)+'<span> — '+(d.availabilityChecked?('Checked as available'+(d.checkedOn?' on '+fmtDate(d.checkedOn):'')+'; not yet registered'):'Availability not confirmed')+'. Domain availability can change until registration.</span></p>';
}
function priceBreakdown(q){
 const p=plan(q);
 const first=label=>'<div class="hq-quote-summary-row"><span>'+esc(label)+'</span></div>';
 const section=(title,items)=>items.length?'<div class="hq-quote-summary-block"><strong>'+esc(title)+'</strong>'+items.map(x=>'<div class="hq-quote-summary-row"><span>'+esc(x.name)+(x.description?' — '+esc(x.description):'')+'</span><b>'+money(x.amount)+(x.frequency==='one-off'?'':' / '+(x.frequency==='monthly'?'month':'year'))+'</b></div>').join('')+'</div>':'';
 return section('One-off project costs',p.base)+section('Required / selected subscriptions',p.chosen.filter(x=>x.frequency!=='one-off'))+section('Additional one-off charges',p.extras.filter(x=>isIncluded(x)&&x.frequency==='one-off'))+
 section('Offered optional extras — not included',p.offered)+domainAvailability(q)+
 '<div class="hq-quote-total"><span>Due for initial invoice</span><strong>'+money(gross(q,p.upfront))+'</strong></div>'+
 (vatPct(q)?'<p class="muted">Includes '+vatPct(q)+'% VAT on '+money(p.upfront)+' net.</p>':'<p class="muted">VAT not charged.</p>')+
 '<p class="muted">Ongoing commitments are charged '+(p.monthly.length?'monthly':'')+(p.monthly.length&&p.annual.length?' and ':'')+(p.annual.length?'annually':'')+'. First periods appear in the initial total where selected. Optional extras above are not charged unless agreed.</p>';
}
function extraRow(x={}){
 const id=x.id||uid('charge');
 return '<div class="hq-quote-extra" data-quote-extra="'+esc(id)+'">'+
 field('Extra / add-on','<input data-q-name maxlength="120" value="'+esc(x.name||'')+'" placeholder="e.g. SEO reporting">')+
 field('Price (£)','<input type="number" min="0" step="0.01" data-q-amount value="'+esc(x.amount??'')+'" placeholder="0.00">')+
 field('Frequency','<select data-q-frequency>'+option('one-off','One-off',x.frequency||'one-off')+option('monthly','Monthly',x.frequency)+option('annual','Annual',x.frequency)+'</select>')+
 field('How to offer it','<select data-q-mode>'+option('included','Included option',x.mode||'included')+option('required','Required charge',x.mode)+option('offered','Optional — offer only',x.mode)+'</select>')+
 '<div class="field hq-quote-extra-note"><label>Description</label><input data-q-description value="'+esc(x.description||'')+'" placeholder="What is included?"></div>'+
 '<label class="hq-quote-first"><input type="checkbox" data-q-first '+(x.includeFirst!==false?'checked':'')+'> Include first period in initial invoice</label>'+
 '<button type="button" class="btn small secondary" data-q-remove>Remove</button></div>';
}
function catalogueOptions(form,q,restore){
 const c=form.elements.namedItem('category').value,spec=pricing().catalog[c],host=form.querySelector('#hqQuoteOptions');
 if(!spec){host.innerHTML=field('One-off project fee (£)','<input name="otherBase" type="number" min="0" step="0.01" required value="'+esc(restore?.otherBase??'')+'" placeholder="Agreed fee">');return;}
 host.innerHTML=spec.groups.filter(g=>g.id!=='webDomain'&&g.id!=='webCare').map(g=>
  field(g.label,'<select data-q-group="'+esc(g.id)+'">'+g.choices.map((x,i)=>option(i,x.label,restore?.choices?.[g.id]??g.default)).join('')+'</select>')).join('')+
 (spec.checks.length?'<div class="field"><label>Catalogue add-ons</label>'+spec.checks.map((x,i)=>'<label class="hq-quote-check"><input type="checkbox" data-q-check="'+i+'" '+(restore?.checked?.includes(i)?'checked':'')+'> '+esc(x.label)+'</label>').join('')+'</div>':'');
}
function formHTML(q={}){
 const web=q.category==='Website Design'||!q.id;
 const domain=q.domain||{mode:'annual',amount:25,includeFirst:true};
 const care=q.care||{};
 const spec=pricing().catalog['Website Design'],careGroup=spec.groups.find(g=>g.id==='webCare');
 const careIndex=care.choiceIndex??0;
 return '<h2>'+((q.id?'Edit':'Create')+' quote')+'</h2><p class="sub">Use service packages, required running costs and optional extras. Nothing becomes an invoice until a quote is accepted.</p>'+
 '<form id="hqQuoteForm"><div class="form-grid">'+
 field('Client','<select name="clientId" required><option value="">Choose client…</option>'+state.clients.map(c=>option(c.id,c.name,q.clientId)).join('')+'</select>')+
 field('Service','<select name="category">'+catNames().map(c=>option(c,c,q.category||'Website Design')).join('')+'</select>')+
 '<div class="field full"><label>Proposal title</label><input name="title" required maxlength="160" value="'+esc(q.title||'Website Design & Services')+'"></div>'+
 field('Date issued','<input name="issueDate" type="date" required value="'+esc(q.issueDate||TODAY())+'">')+
 field('Valid until','<input name="validUntil" type="date" required value="'+esc(q.validUntil||addDays(TODAY(),30))+'">')+
 '<div class="field full"><h3>Project package</h3><div id="hqQuoteOptions" class="hq-quote-options"></div></div>'+
 '<div id="hqQuoteWebsite" class="field full" style="'+(web?'':'display:none')+'"><h3>Website essentials & care</h3>'+
 '<p class="sub">The domain is required unless the client supplies an existing domain. Annual registration is a published £25 allowance; agree any monthly domain price before quoting.</p>'+
 '<div class="form-grid">'+
 field('Domain arrangement','<select name="domainMode">'+option('annual','Chip In domain — annual billing',domain.mode)+option('monthly','Chip In domain — monthly billing',domain.mode)+option('own','Client supplies their own domain',domain.mode)+'</select>')+
 field('Domain price (£ per selected period)','<input name="domainAmount" type="number" min="0" step="0.01" value="'+esc(domain.mode==='own'?0:domain.amount??25)+'">')+
 '<div class="field full" id="hqSuggestedDomainRow"><label>Suggested domain name</label><input name="suggestedDomain" type="text" maxlength="253" autocomplete="off" spellcheck="false" placeholder="examplebusiness.co.uk" value="'+esc(domain.suggested||'')+'"><p class="sub">Enter a domain you have already checked. It will appear on the quote.</p><label class="hq-quote-first"><input name="domainAvailabilityChecked" type="checkbox" '+(domain.availabilityChecked?'checked':'')+'> I have checked this domain is available</label><p class="sub">Availability may change until the domain is registered.</p></div>'+
 '<label class="hq-quote-first"><input type="checkbox" name="domainFirst" '+(domain.includeFirst!==false?'checked':'')+'> Include first domain period in initial invoice</label>'+
 field('Website care plan','<select name="careIndex">'+careGroup.choices.map((x,i)=>option(i,x.label,careIndex)).join('')+'</select>')+
 '<label class="hq-quote-first"><input type="checkbox" name="careFirst" '+(care.includeFirst!==false?'checked':'')+'> Include first care month in initial invoice</label></div></div>'+
 '<div class="field full"><div class="hq-quote-extra-head"><h3>Additional services and extras</h3><button type="button" class="btn small secondary" id="hqQuoteAddExtra">+ Add extra</button></div>'+
 '<p class="sub">An offered optional extra appears in the proposal but not in the agreed total or recurring billing.</p>'+
 '<div id="hqQuoteExtraRows">'+(q.extras||[]).map(extraRow).join('')+'</div></div>'+
 '<div class="field full"><label>Proposal notes / scope and terms</label><textarea name="notes" rows="4">'+esc(q.notes||'Prices are subject to the scope agreed. Subscription services renew at the intervals shown until cancelled under the agreed terms.')+'</textarea></div>'+
 '<div class="field full"><h3>Quote summary</h3><div id="hqQuoteLiveSummary"></div></div></div>'+
 '<div class="form-actions"><button type="button" class="btn secondary" data-close-modal>Cancel</button><button class="btn gold" type="submit">Save draft quote</button></div></form>';
}
function values(form,validate){
 const fd=new FormData(form),category=clean(fd.get('category')),spec=pricing().catalog[category],choices={},checked=[];
 form.querySelectorAll('[data-q-group]').forEach(n=>choices[n.dataset.qGroup]=Number(n.value));
 form.querySelectorAll('[data-q-check]:checked').forEach(n=>checked.push(Number(n.dataset.qCheck)));
 if(spec){if(category==='Website Design'){choices.webDomain=0;choices.webCare=0;}}
 const baseLines=spec?pricing().price(category,choices,checked,[],{monthlyFirst:false,domainFirst:false}).lines.map(x=>({name:x.name,amount:round(x.amount)})):[{name:clean(fd.get('title'))||'Project fee',amount:round(fd.get('otherBase'))}];
 const website=category==='Website Design';
 const mode=fd.get('domainMode'),rawDomain=Number(fd.get('domainAmount'));
 const careChoices=pricing().catalog['Website Design'].groups.find(g=>g.id==='webCare').choices;
 const careIndex=Number(fd.get('careIndex')||0),chosenCare=careChoices[careIndex]||careChoices[0];
 const suggestion=mode==='own'?'':clean(fd.get('suggestedDomain')).toLowerCase().replace(/\.$/,'');
 const availabilityChecked=website&&mode!=='own'&&!!fd.get('domainAvailabilityChecked');
 const domain=website?{mode,amount:mode==='own'?0:round(rawDomain),includeFirst:!!fd.get('domainFirst'),suggested:suggestion,availabilityChecked,checkedOn:availabilityChecked?(form.dataset.domainCheckedOn||TODAY()):null}:null;
 const care=website?{name:chosenCare.label,amount:round(chosenCare.price),choiceIndex:careIndex,includeFirst:!!fd.get('careFirst')}:null;
 const extras=Array.from(form.querySelectorAll('[data-quote-extra]')).map(row=>{
  const val=k=>row.querySelector('[data-q-'+k+']');
  return {id:row.dataset.quoteExtra,name:clean(val('name').value),description:clean(val('description').value),amount:round(val('amount').value),frequency:val('frequency').value,mode:val('mode').value,includeFirst:val('first').checked};
 }).filter(x=>x.name||x.description||x.amount);
 const q={clientId:fd.get('clientId'),category,title:clean(fd.get('title')),issueDate:fd.get('issueDate'),validUntil:fd.get('validUntil'),
  notes:clean(fd.get('notes')),choices,checked,otherBase:fd.get('otherBase'),baseLines,domain,care,extras,
  vatRegistered:!!state.settings.vatRegistered,vatRate:Number(state.settings.defaultVatRate||0)};
 if(validate){
  if(!clientById(q.clientId))throw Error('Choose a client first.');
  if(!q.title||!q.issueDate||!q.validUntil||q.validUntil<q.issueDate)throw Error('Check the title, issue date and valid-until date.');
  if(baseLines.some(x=>!Number.isFinite(x.amount)||x.amount<0))throw Error('Enter a valid project price.');
  if(website&&!['own','monthly','annual'].includes(mode))throw Error('Choose a domain arrangement.');
  if(website&&mode!=='own'&&(!clean(fd.get('domainAmount'))||!Number.isFinite(rawDomain)||rawDomain<=0))throw Error('Enter an agreed domain price greater than zero.');
   if(suggestion&&!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(suggestion))throw Error('Enter only the domain, e.g. examplebusiness.co.uk.');
   if(availabilityChecked&&!suggestion)throw Error('Enter a suggested domain before marking its availability as checked.');
  for(const row of form.querySelectorAll('[data-quote-extra]')){
   const amt=row.querySelector('[data-q-amount]').value,name=clean(row.querySelector('[data-q-name]').value),desc=clean(row.querySelector('[data-q-description]').value);
   if((name||amt||desc)&&(!name||amt===''||!Number.isFinite(Number(amt))||Number(amt)<0))throw Error('Each extra requires a name and a valid price.');
  }
 }
 return q;
}
function openForm(id,clientId){
 if(!state.clients.length){openModal('<h2>Add a client first</h2><p class="sub">Quotes need a client record.</p><button class="btn" id="quoteAddClient">+ Client</button>');document.getElementById('quoteAddClient').onclick=()=>openClientForm();return;}
 const existing=id?byId(id):null;
 if(existing&&existing.status!=='Draft')return openPreview(existing.id);
 const q=existing||{clientId:clientId||'',category:'Website Design'};
 openModal(formHTML(q),true);
 const form=document.getElementById('hqQuoteForm'),cat=form.elements.namedItem('category');
 form.dataset.domainCheckedOn=q.domain?.checkedOn||'';
 const suggestedInput=form.elements.namedItem('suggestedDomain'),checkedInput=form.elements.namedItem('domainAvailabilityChecked');
 suggestedInput.addEventListener('input',()=>{
  if(clean(suggestedInput.value).toLowerCase()!==(q.domain?.suggested||'')){checkedInput.checked=false;form.dataset.domainCheckedOn='';}
 });
 function recalc(){try{document.getElementById('hqQuoteLiveSummary').innerHTML=priceBreakdown(values(form,false));}catch(e){document.getElementById('hqQuoteLiveSummary').textContent='Select a valid price.';}}
 function categoryChanged(restore){
  const name=cat.value;
  document.getElementById('hqQuoteWebsite').style.display=name==='Website Design'?'':'none';
  catalogueOptions(form,q,restore);
  form.querySelectorAll('#hqQuoteOptions input,#hqQuoteOptions select').forEach(n=>n.addEventListener('change',recalc));
  if(!existing&&form.elements.namedItem('title').value==='Website Design & Services')form.elements.namedItem('title').value=name==='Website Design'?'Website Design & Services':name;
  recalc();
 }
 cat.onchange=()=>categoryChanged(null);
 categoryChanged(q);
 const domainMode=form.elements.namedItem('domainMode'),domainAmount=form.elements.namedItem('domainAmount'),oldDomain=q.domain?.mode||'annual';
 const showDomain=()=>{
  const supplied=domainMode.value!=='own';
  domainAmount.disabled=!supplied;
  form.querySelector('#hqSuggestedDomainRow').style.display=supplied?'':'none';
  suggestedInput.disabled=!supplied;
  checkedInput.disabled=!supplied;
 };
 domainMode.onchange=()=>{
  const next=domainMode.value;
  if(next==='own')domainAmount.value='0';
  else if(next==='annual'&&(!Number(domainAmount.value)||oldDomain==='own'))domainAmount.value='25';
  else if(next==='monthly')domainAmount.value='';
  showDomain();recalc();
 };
 showDomain();
 document.getElementById('hqQuoteAddExtra').onclick=()=>{const host=document.getElementById('hqQuoteExtraRows');host.insertAdjacentHTML('beforeend',extraRow());recalc();host.lastElementChild.querySelector('[data-q-name]').focus();};
 form.addEventListener('click',event=>{const btn=event.target.closest('[data-q-remove]');if(btn){btn.closest('[data-quote-extra]').remove();recalc();}});
 form.addEventListener('input',recalc);form.addEventListener('change',recalc);
 form.onsubmit=async event=>{
  event.preventDefault();
  try{
   const value=values(form,true);
   if(value.domain?.availabilityChecked)
    value.domain.checkedOn=existing?.domain?.availabilityChecked&&existing.domain.suggested===value.domain.suggested&&existing.domain.checkedOn?existing.domain.checkedOn:TODAY();
   if(existing)Object.assign(existing,value,{updatedAt:new Date().toISOString()});
   else {
    const record={id:uid('qte'),number:number(),status:'Draft',createdAt:new Date().toISOString(),...value};
    quotes().push(record);
    state.settings.nextQuoteNumber=Number(state.settings.nextQuoteNumber||1)+1;
   }
   const saved=existing||quotes().at(-1);
   await saveState();closeModal();render();openPreview(saved.id);
  }catch(error){toast(error.message);}
 };
}
function quoteHTML(q){
 const s=state.settings,c=clientById(q.clientId),p=plan(q);
 return '<div class="invoice-preview hq-quote-preview"><div class="invoice-head"><img src="'+LOGO_DATA_URL+'" alt="Chip In"><div class="invoice-title"><h2>QUOTATION</h2><div class="num mono">'+esc(q.number)+'</div><div class="num">Issued '+fmtDate(q.issueDate)+' · Valid until '+fmtDate(q.validUntil)+'</div></div></div>'+
 '<div class="invoice-parties"><div><h4>From</h4><p><strong>'+esc(s.legalName||'')+' trading as '+esc(s.tradingName||'Chip In')+'</strong>\n'+esc(s.address||'')+'\n'+esc(s.email||'')+'</p></div><div><h4>Prepared for</h4><p><strong>'+esc(c?.name||'Client')+'</strong>\n'+esc(c?.contact||'')+'\n'+esc(c?.address||'')+'\n'+esc(c?.email||'')+'</p></div></div>'+
 '<h3>'+esc(q.title)+'</h3><div class="hq-quote-summary-block">'+priceBreakdown(q)+'</div>'+
 '<div class="hq-quote-terms"><strong>Scope & terms</strong><p>'+esc(q.notes||'').replace(/\n/g,'<br>')+'</p><p>Any offered optional extras are subject to separate approval. Future subscription charges follow the billing frequencies above.</p></div></div>';
}
function openPreview(id){
 const q=byId(id);if(!q)return;
 const status=validity(q),locked=q.status!=='Draft';
 openModal('<div class="section-title hq-quote-preview-actions"><div><h2>'+esc(q.number)+'</h2><p>'+esc(clientById(q.clientId)?.name||'')+' · '+statusBadge(status)+'</p></div><div class="row-actions">'+
 '<button class="btn small secondary" id="hqQuotePDF">Download PDF</button>'+
 (!locked?'<button class="btn small secondary" id="hqQuoteEdit">Edit draft</button><button class="btn small" id="hqQuoteSent">Mark as sent</button>':'')+
 (q.status==='Sent'?'<button class="btn small gold" id="hqQuoteAccept">Accept quote</button><button class="btn small secondary" id="hqQuoteDecline">Declined</button>':'')+
 (q.status==='Accepted'?'<button class="btn small gold" id="hqQuoteInvoice">Open draft invoice</button>':'')+
 '</div></div>'+quoteHTML(q),true);
 document.getElementById('hqQuotePDF').onclick=()=>downloadPDF(q);
 document.getElementById('hqQuoteEdit')?.addEventListener('click',()=>openForm(id));
 document.getElementById('hqQuoteSent')?.addEventListener('click',()=>setSent(q));
 document.getElementById('hqQuoteAccept')?.addEventListener('click',()=>accept(q));
 document.getElementById('hqQuoteDecline')?.addEventListener('click',()=>setDeclined(q));
 document.getElementById('hqQuoteInvoice')?.addEventListener('click',()=>{const inv=invoiceById(q.invoiceId);if(inv)openInvoicePreview(inv.id);else toast('Draft invoice not found.');});
}
function stage(q,s){
 const client=clientById(q.clientId);if(!client)return;
 client.pipelineStage=s;client.updatedAt=new Date().toISOString();
 const lead=(state.salesAssistant?.leads||[]).find(l=>l.id===client.sourceLeadId||l.clientRecordId===client.id||l.convertedClientId===client.id);
 if(lead){lead.stage=s;lead.updatedAt=new Date().toISOString();}
}
async function setSent(q){
 if(q.status!=='Draft')return; q.status='Sent';q.sentDate=TODAY();stage(q,'Quote');
 await saveState();render();openPreview(q.id);toast('Quote marked sent. Email the downloaded PDF separately.');
}
async function setDeclined(q){
 if(q.status!=='Sent')return;q.status='Declined';q.declinedDate=TODAY();
 await saveState();render();openPreview(q.id);
}
async function accept(q){
 if(q.status!=='Sent')return;
 if(q.jobId||q.invoiceId)return toast('This quote is already converted.');
 const p=plan(q),web=q.category==='Website Design';
 // Only accepted charges become a job and invoice; merely offered extras stay on the quote.
 const custom=p.extras.filter(isIncluded).map(x=>({
   id:x.id||uid('charge'),name:x.name,description:x.description||'',amount:x.amount,
   frequency:x.frequency,includeFirst:x.includeFirst!==false
 }));
 const standardAnnualDomain=web&&p.domain?.frequency==='annual'&&Math.abs(p.domain.amount-25)<0.005;
 if(web&&p.domain&&!standardAnnualDomain)custom.push({id:uid('charge'),name:p.domain.name,description:'Required domain service',amount:p.domain.amount,frequency:p.domain.frequency,includeFirst:p.domain.includeFirst});
 const lines=p.base.map(x=>({name:x.name,amount:x.amount}));
 if(standardAnnualDomain&&p.domain.includeFirst)lines.push({name:'First year — '+p.domain.name,amount:p.domain.amount});
 if(web&&p.care?.includeFirst)lines.push({name:'First month — '+p.care.name,amount:p.care.amount});
 const base=round(lines.reduce((sum,x)=>sum+x.amount,0));
 const extraInitial=round(custom.reduce((sum,x)=>sum+(x.frequency==='one-off'||x.includeFirst?x.amount:0),0));
 const upfront=round(base+extraInitial);
 if(Math.abs(upfront-p.upfront)>.01)return toast('Quote totals need review before conversion.');
 const job={
  id:uid('job'),clientId:q.clientId,category:q.category,title:q.title,status:'Booked',
  startDate:TODAY(),endDate:'',description:q.title,notes:q.notes||'',
  rateType:'day',rate:0,days:1,discount:0,overrideAmount:upfront,amount:upfront,
  pricingModel:'package',pricingBaseAmount:base,customCharges:custom,
  servicePricing:{version:2,category:q.category,choices:{...(q.choices||{}),...(web?{webDomain:standardAnnualDomain?1:0,webCare:q.care?.choiceIndex||0}:{})},checked:q.checked||[],lines,base,
   monthlyCare:web&&p.care?{name:p.care.name,amount:p.care.amount,interval:'monthly'}:null,
   annualDomain:standardAnnualDomain?{name:p.domain.name,amount:p.domain.amount,interval:'annual'}:null,
   billingOptions:{monthlyFirst:p.care?.includeFirst!==false,domainFirst:p.domain?.includeFirst!==false}},
  sourceQuoteId:q.id,suggestedDomain:q.domain?.suggested||'',createdAt:new Date().toISOString()
 };
 // Preserve normal job numbering when the existing job utility is available.
 if(typeof chipInEnsureJobReferences==='function')chipInEnsureJobReferences();
 if(typeof chipInNextJobReference==='function')job.reference=chipInNextJobReference();
 state.jobs.push(job);
 const inv={
  id:uid('inv'),number:nextInvoiceNumber(),clientId:q.clientId,jobId:job.id,
  status:'Draft',issueDate:TODAY(),dueDate:addDays(TODAY(),Number(state.settings.defaultTerms||14)),
  items:typeof chipInInvoiceItemsForJob==='function'?chipInInvoiceItemsForJob(job):[{description:q.title,qty:1,rate:upfront}],
  notes:q.notes||'Thank you for your business.',vatRate:q.vatRate,
  payments:[],sourceQuoteId:q.id,createdAt:new Date().toISOString()
 };
 state.invoices.push(inv);state.settings.nextInvoiceNumber=Number(state.settings.nextInvoiceNumber||1)+1;
 q.status='Accepted';q.acceptedDate=TODAY();q.jobId=job.id;q.invoiceId=inv.id;
 stage(q,'Won');
 // Subscribe renewals only after the quote has actually been accepted.
 window.ChipInRecurringBilling?.priceFromJob?.(job);
 await saveState();render();openInvoicePreview(inv.id);
 toast('Accepted: job and draft invoice created. No invoice has been sent.');
}
function downloadPDF(q){
 if(!window.jspdf)return toast('PDF library did not load. Try again online.');
 const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),p=plan(q),s=state.settings,c=clientById(q.clientId)||{};
 const n=x=>money(x),bodyColor=()=>{doc.setTextColor(23,32,51);doc.setFontSize(9);doc.setFont(undefined,'normal');};
 let y=16;
 try{if(LOGO_PDF_DATA_URL)doc.addImage(LOGO_PDF_DATA_URL,'PNG',15,12,55,16);}catch(e){}
 doc.setTextColor(10,47,87);doc.setFontSize(23);doc.setFont(undefined,'bold');doc.text('QUOTATION',195,22,{align:'right'});
 doc.setFontSize(9);doc.setFont(undefined,'normal');doc.text(q.number,195,29,{align:'right'});doc.text('Valid until '+fmtDate(q.validUntil),195,35,{align:'right'});
 doc.setDrawColor(218,226,238);doc.line(15,42,195,42);
 bodyColor();doc.text('FROM',15,51);doc.text('PREPARED FOR',110,51);
 doc.text(doc.splitTextToSize((s.legalName||'')+' trading as '+(s.tradingName||'Chip In')+'\n'+(s.address||'')+'\n'+(s.email||''),79),15,57);
 doc.text(doc.splitTextToSize((c.name||'')+'\n'+(c.contact||'')+'\n'+(c.address||'')+'\n'+(c.email||''),80),110,57);
 y=91;
 const ensure=needed=>{if(y+needed>275){doc.addPage();y=18;}};
 const heading=name=>{ensure(13);doc.setFillColor(241,246,251);doc.rect(15,y,180,8,'F');doc.setFont(undefined,'bold');doc.setFontSize(10);doc.setTextColor(10,47,87);doc.text(name,18,y+5.5);y+=13;bodyColor();};
 const line=(name,amt,period)=>{const lines=doc.splitTextToSize(name,125);ensure(lines.length*5+6);bodyColor();doc.text(lines,18,y);doc.text(n(amt)+(period?' / '+period:''),192,y,{align:'right'});y+=Math.max(8,lines.length*5+3);};
 const block=(title,items)=>{if(!items.length)return;heading(title);items.forEach(x=>line(x.name+(x.description?' — '+x.description:''),x.amount,x.frequency==='one-off'?'':x.frequency==='monthly'?'month':'year'));};
 ensure(15);doc.setTextColor(10,47,87);doc.setFont(undefined,'bold');doc.setFontSize(13);doc.text(doc.splitTextToSize(q.title,175),15,y);y+=15;
 block('One-off project costs',p.base);
 block('Required / selected subscriptions',p.chosen.filter(x=>x.frequency!=='one-off'));
 block('Additional one-off charges',p.extras.filter(x=>isIncluded(x)&&x.frequency==='one-off'));
 block('Optional extras — not included',p.offered);
 heading('Initial invoice summary');
 line('Initial amount excluding VAT',p.upfront);
 if(q.vatRegistered)line('VAT at '+vatPct(q)+'%',round(gross(q,p.upfront)-p.upfront));
 line('INITIAL AMOUNT INCLUDING VAT',gross(q,p.upfront));
 if(q.domain?.suggested&&q.domain?.mode!=='own'){
  heading('Suggested domain');
  const status=q.domain.availabilityChecked?'Checked as available'+(q.domain.checkedOn?' on '+fmtDate(q.domain.checkedOn):''):'Availability not confirmed';
  const domainLines=doc.splitTextToSize(q.domain.suggested+' — '+status+'. Not reserved until registered.',173);
  for(const str of domainLines){ensure(6);bodyColor();doc.text(str,18,y);y+=5;}
 }
 if(q.notes){ensure(18);heading('Scope and terms');const lines=doc.splitTextToSize(q.notes,172);for(const str of lines){ensure(6);doc.text(str,18,y);y+=5;}}
 ensure(18);doc.setFontSize(8);doc.setTextColor(90,97,110);
 doc.text('Optional extras are not charged unless accepted separately. Recurring services renew at the frequencies stated.',15,y,{maxWidth:178});
 doc.save(q.number+'.pdf');
}
function renderQuotes(){
 const list=quotes().slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
 document.getElementById('content').innerHTML='<div class="toolbar"><select id="hqQuoteFilter">'+option('','All quote statuses','')+codes.map(s=>option(s,s,'')).join('')+option('Expired','Expired','')+'</select><input id="hqQuoteSearch" class="search" placeholder="Search quotes…"></div>'+
 '<div id="hqQuoteTable"></div>';
 const draw=()=>{
  const query=clean(document.getElementById('hqQuoteSearch').value).toLowerCase(),filter=document.getElementById('hqQuoteFilter').value;
  const rows=list.filter(q=>(!filter||validity(q)===filter)&&[q.number,q.title,clientById(q.clientId)?.name].join(' ').toLowerCase().includes(query));
  document.getElementById('hqQuoteTable').innerHTML=rows.length?'<div class="table-wrap"><table><thead><tr><th>Quote</th><th>Client</th><th>Issued / expiry</th><th>Initial estimate</th><th>Status</th><th></th></tr></thead><tbody>'+rows.map(q=>
   '<tr><td><strong class="mono">'+esc(q.number)+'</strong><div>'+esc(q.title)+'</div></td><td>'+esc(clientById(q.clientId)?.name||'—')+'</td><td>'+fmtDate(q.issueDate)+'<div class="muted">valid until '+fmtDate(q.validUntil)+'</div></td><td>'+money(gross(q,plan(q).upfront))+'</td><td>'+statusBadge(validity(q))+'</td><td class="right"><button class="btn small secondary" data-q-open="'+esc(q.id)+'">Open</button></td></tr>').join('')+'</tbody></table></div>':empty('No matching quotes. Create your first proposal.');
  document.querySelectorAll('[data-q-open]').forEach(b=>b.onclick=()=>openPreview(b.dataset.qOpen));
 };
 document.getElementById('hqQuoteFilter').onchange=draw;document.getElementById('hqQuoteSearch').oninput=draw;draw();
}
NAV.splice(NAV.findIndex(x=>x[0]==='invoices'),0,['quotes','▤','Quotes']);
PAGE_META.quotes=['Quotes','Proposals, optional add-ons and monthly / annual commitments.'];
const originalRender=render;
render=function(){
 if(page!=='quotes')return originalRender();
 renderNav();document.getElementById('pageTitle').textContent=PAGE_META.quotes[0];
 document.getElementById('pageSubtitle').textContent=PAGE_META.quotes[1];
 renderTopActions();renderQuotes();wirePageActions();
};
const originalTopActions=renderTopActions;
renderTopActions=function(){
 originalTopActions();
 if(page==='quotes')document.getElementById('topActions').innerHTML='<button class="btn" data-action="new-quote">+ Quote</button>';
 if(page==='invoices')document.getElementById('topActions').insertAdjacentHTML('afterbegin','<button class="btn secondary" data-action="new-quote">+ Quote</button>');
};
const oldHandleAction=handleAction;
handleAction=async function(action,id){
 if(action==='new-quote')return openForm(null,id);
 if(action==='open-quote')return openPreview(id);
 return oldHandleAction(action,id);
};
const previousRenderClients=renderClients;
renderClients=function(){
 previousRenderClients();
 document.querySelectorAll('.hq-client-item').forEach(card=>{
  const control=card.querySelector('.hq-client-controls'),existing=card.querySelector('[data-client-edit]');
  if(!control||!existing||card.querySelector('[data-hq-new-quote]'))return;
  const btn=document.createElement('button');btn.className='btn small secondary';btn.type='button';btn.textContent='+ Quote';
  btn.dataset.hqNewQuote=existing.dataset.clientEdit;
  btn.onclick=()=>openForm(null,btn.dataset.hqNewQuote);
  control.insertBefore(btn,existing);
 });
};
const css=document.createElement('style');
css.textContent='.hq-quote-domain-note{margin:9px 0;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:#f7f9fc;font-size:12px;line-height:1.55}.hq-quote-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hq-quote-check{display:block;margin:8px 0;font-size:12px}.hq-quote-check input,.hq-quote-first input{width:auto}.hq-quote-first{display:flex;align-items:center;gap:8px;font-size:12px;margin:10px 0}.hq-quote-extra-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.hq-quote-extra-head h3{margin:0}.hq-quote-extra{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;background:#f7f9fc;border:1px solid var(--line);padding:12px;border-radius:12px;margin:10px 0}.hq-quote-extra-note{grid-column:1/-1}.hq-quote-extra .hq-quote-first{margin:0}.hq-quote-summary-block{margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:11px}.hq-quote-summary-block>strong{display:block;margin-bottom:8px;font-size:13px}.hq-quote-summary-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:5px 0;font-size:12px}.hq-quote-summary-row b{white-space:nowrap}.hq-quote-total{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding:16px 4px 6px;font-weight:700}.hq-quote-total strong{font-size:20px;color:var(--navy)}.hq-quote-preview-actions{flex-wrap:wrap}.hq-quote-preview .hq-quote-summary-block{background:#fff}.hq-quote-terms{margin-top:16px;font-size:12px;white-space:pre-wrap}.hq-quote-terms p{line-height:1.6}@media(max-width:700px){.hq-quote-options,.hq-quote-extra{grid-template-columns:1fr}.hq-quote-preview-actions .row-actions{flex-wrap:wrap}.hq-quote-summary-row{flex-wrap:wrap}}';
document.head.appendChild(css);
window.ChipInQuotes={plan,openForm,openPreview,renderQuotes,values};
})();
