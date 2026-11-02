
(function(){
'use strict';
const CATALOG={"Website Design":{"base":250,"min":0,"groups":[{"id":"webExtraPages","label":"Extra page capacity","monthly":false,"default":0,"choices":[{"label":"Standard package only","price":0},{"label":"Add up to 7 additional pages (+£50)","price":50},{"label":"Add up to 14 additional pages (+£100)","price":100},{"label":"Add up to 21 additional pages (+£150)","price":150}]},{"id":"webDomain","label":"Domain","monthly":false,"default":0,"choices":[{"label":"I already have / will supply the domain","price":0},{"label":"Chip In supplies a standard domain (allow £25)","price":25}]},{"id":"webCare","label":"Optional monthly website care","monthly":true,"default":0,"choices":[{"label":"No ongoing plan — £0/month","price":0},{"label":"Website Health — £25/month","price":25},{"label":"Website Care — £49/month","price":49},{"label":"Website Partner — £89/month","price":89}]}],"checks":[],"source":"web-development"},"Hospitality & Events":{"base":0,"min":0,"groups":[{"id":"hospitalityType","label":"Type of work","monthly":false,"default":0,"choices":[{"label":"Hospitality / service shift","price":0},{"label":"Event setup / pack-down","price":0},{"label":"Guest-facing event support","price":0},{"label":"Runner / general event support","price":0},{"label":"Other practical event work","price":0}]},{"id":"hospitalityBooking","label":"Booking length","monthly":false,"default":1,"choices":[{"label":"Half day — 1 × 4-hour shift (£85)","price":85},{"label":"Full day — 1 × 8-hour shift with 30-minute break (£150)","price":150}]},{"id":"hospitalityExtraHours","label":"Hourly Add-On","monthly":false,"default":0,"choices":[{"label":"No extra hours","price":0},{"label":"1 extra hour (+£20)","price":20},{"label":"2 extra hours (+£40)","price":40},{"label":"3 extra hours (+£60)","price":60},{"label":"4 extra hours (+£80)","price":80}]}],"checks":[],"source":"hospitality"},"Admin Support":{"base":0,"min":0,"groups":[{"id":"adminType","label":"Type of help","monthly":false,"default":0,"choices":[{"label":"Research","price":0},{"label":"Organisation / backlog","price":0},{"label":"Data entry / handling","price":0},{"label":"Documents / spreadsheets","price":0},{"label":"Simple systems / process setup","price":0},{"label":"General project admin","price":0}]},{"id":"adminTime","label":"Estimated time","monthly":false,"default":4,"choices":[{"label":"Around 1 hour — £20","price":20},{"label":"Around 2 hours — £40","price":40},{"label":"Around 3 hours — £60","price":60},{"label":"Half day / around 4 hours — £70","price":70},{"label":"Full day / around 8 hours — £130","price":130},{"label":"2 full days — £250","price":250}]},{"id":"adminUrgency","label":"Turnaround","monthly":false,"default":0,"choices":[{"label":"Flexible / agreed deadline","price":0},{"label":"Within 48 hours (+£20)","price":20},{"label":"Same or next day where possible (+£40)","price":40}]}],"checks":[],"source":"general-support"},"Pub Quizzes":{"base":0,"min":150,"groups":[{"id":"quizService","label":"What do you need?","monthly":false,"default":0,"choices":[{"label":"Written, prepared & hosted quiz — from £150","price":150},{"label":"Quiz writing only (no hosting) — from £150","price":150}]},{"id":"quizSize","label":"Quiz size","monthly":false,"default":1,"choices":[{"label":"Short — around 4 rounds (-£20; £150 minimum)","price":-20},{"label":"Standard — around 6 rounds","price":0},{"label":"Large — around 8+ rounds (+£30)","price":30}]},{"id":"quizFrequency","label":"Booking","monthly":false,"default":0,"choices":[{"label":"One-off event","price":0},{"label":"Regular / recurring night — discuss ongoing rate","price":0}]}],"checks":[{"price":15,"label":"Picture round (+£15)"},{"price":15,"label":"Music / audio round (+£15)"},{"price":25,"label":"Bespoke themed / venue round (+£25)"},{"price":25,"label":"Printed answer sheets & pens (+£25)"}],"source":"pub-quizzes"},"Bingo Nights":{"base":150,"min":0,"groups":[{"id":"bingoLength","label":"Evening format","monthly":false,"default":0,"choices":[{"label":"Standard five-game night — around 2 hours (included)","price":0},{"label":"Extended evening — around 3 hours (+£40)","price":40}]},{"id":"bingoPlayers","label":"Expected players","monthly":false,"default":0,"choices":[{"label":"Up to 60 players (included)","price":0},{"label":"61–100 players (+£20)","price":20},{"label":"Over 100 players (+£40 guide; setup to discuss)","price":40}]},{"id":"bingoFrequency","label":"Booking type","monthly":false,"default":0,"choices":[{"label":"Regular / recurring night — £150","price":0},{"label":"One-off night — £175 (+£25)","price":25}]}],"checks":[{"price":30,"label":"Bespoke themed bingo content (+£30)"},{"price":30,"label":"Venue-branded A5 cards / presentation (+£30)"}],"source":"bingo-nights"},"Video Creation":{"base":40,"min":0,"groups":[{"id":"outputLength","label":"Finished video length","monthly":false,"default":0,"choices":[{"label":"Up to 1 minute (+£60)","price":60},{"label":"1–3 minutes (+£100)","price":100},{"label":"3–5 minutes (+£150)","price":150},{"label":"5–10 minutes (+£230)","price":230},{"label":"More than 10 minutes (+£340)","price":340}]},{"id":"filming","label":"Filming required?","monthly":false,"default":0,"choices":[{"label":"No — footage supplied (included)","price":0},{"label":"Simple local filming (+£90)","price":90},{"label":"Up to half a day filming (+£160)","price":160},{"label":"Up to a full day filming (+£280)","price":280}]},{"id":"editing","label":"Editing level","monthly":false,"default":1,"choices":[{"label":"Clean / straightforward edit (included)","price":0},{"label":"Polished standard edit (+£50)","price":50},{"label":"Detailed / story-led edit (+£110)","price":110}]},{"id":"graphics","label":"Graphics","monthly":false,"default":0,"choices":[{"label":"Graphics supplied / none needed (included)","price":0},{"label":"Simple titles from supplied assets (+£25)","price":25},{"label":"Graphics created for the video (+£60)","price":60},{"label":"More involved motion graphics (+£110)","price":110}]},{"id":"contentLevel","label":"Content level","monthly":false,"default":1,"choices":[{"label":"Straightforward content (included)","price":0},{"label":"Promotional / business content (+£35)","price":35},{"label":"More complex or story-led content (+£80)","price":80}]}],"checks":[],"source":"video-editing"},"Voice Acting":{"base":0,"min":0,"groups":[{"id":"voiceLength","label":"Script length","monthly":false,"default":1,"choices":[{"label":"Up to 150 words — £50","price":50},{"label":"151–500 words — £75","price":75},{"label":"501–1,000 words — £120","price":120},{"label":"1,001–2,000 words — £180","price":180},{"label":"Longer than 2,000 words — from £250","price":250}]},{"id":"voiceUse","label":"Where will it be used?","monthly":false,"default":0,"choices":[{"label":"Internal, website or organic social content","price":0},{"label":"Public event / announcement use (+£25)","price":25},{"label":"Paid advertising / sponsored campaign (+£75)","price":75}]},{"id":"voiceDelivery","label":"Audio delivery","monthly":false,"default":0,"choices":[{"label":"Clean voice recording","price":0},{"label":"Edited / cleaned final audio (+£20)","price":20},{"label":"Timed or roughly synced to supplied video (+£40)","price":40}]},{"id":"voiceVersions","label":"Versions / takes","monthly":false,"default":0,"choices":[{"label":"One final version","price":0},{"label":"Two versions (+£20)","price":20},{"label":"Three versions (+£40)","price":40}]},{"id":"voiceUrgency","label":"Turnaround","monthly":false,"default":0,"choices":[{"label":"Flexible / agreed date","price":0},{"label":"Within 48 hours where possible (+£25)","price":25},{"label":"Within 24 hours where possible (+£50)","price":50}]}],"checks":[],"source":"voice-acting"},"Production":{"base":0,"min":0,"groups":[{"id":"productionBooking","label":"Booking length","monthly":false,"default":2,"choices":[{"label":"Up to 3 hours — £60","price":60},{"label":"Half day / up to 4 hours — £80","price":80},{"label":"Full day / up to 8 hours — £150","price":150},{"label":"2 full days — £290","price":290},{"label":"3 full days — £425","price":425}]},{"id":"productionRole","label":"Support needed","monthly":false,"default":0,"choices":[{"label":"General production / runner support","price":0},{"label":"Content capture alongside support (+£25)","price":25},{"label":"More involved coordination responsibility (+£30)","price":30}]},{"id":"productionPrep","label":"Preparation before the day","monthly":false,"default":0,"choices":[{"label":"No additional prep","price":0},{"label":"Around 2 hours prep (+£40)","price":40},{"label":"Around half a day prep (+£80)","price":80}]}],"checks":[],"source":"production"}};
const CATEGORIES=Object.keys(CATALOG);
const LEGACY={'Website':'Website Design','Events / hospitality':'Hospitality & Events','Quiz hosting':'Pub Quizzes','Video editing':'Video Creation','General support':'Admin Support'};
const serviceCat=x=>CATALOG[x]?x:LEGACY[x]||null;
const round=x=>Math.round((Number(x)||0)*100)/100;
const clean=x=>String(x==null?'':x).trim();
const savedExtras=j=>Array.isArray(j&&j.customCharges)?j.customCharges:[];
function selection(spec,saved){
 const obj={};for(const group of spec.groups){
  const n=saved&&saved[group.id]!=null?Number(saved[group.id]):group.default;
  obj[group.id]=Number.isInteger(n)&&n>=0&&n<group.choices.length?n:group.default;
 }return obj;
}
function price(category,choices,checked,extras){
 const spec=CATALOG[serviceCat(category)];if(!spec)return null;
 const lines=[];let amount=spec.base,monthly=null;
 if(spec.base)lines.push({name:(serviceCat(category)==='Website Design'?'Website Design — Standard Package':serviceCat(category)+' — base'),amount:spec.base});
 for(const group of spec.groups){
  const item=group.choices[choices[group.id]??group.default];
  if(group.monthly){monthly=item.price>0?{name:item.label,amount:item.price,interval:'monthly'}:null;continue;}
  amount+=item.price;
  if(item.price)lines.push({name:group.label+': '+item.label,amount:item.price});
 }
 spec.checks.forEach((extra,i)=>{if(checked.includes(i)){amount+=extra.price;lines.push({name:extra.label,amount:extra.price});}});
 if(spec.min&&amount<spec.min){lines.push({name:'Minimum booking adjustment',amount:round(spec.min-amount)});amount=spec.min;}
 const custom=round(extras.reduce((s,x)=>s+Number(x.amount||0),0));
 return {base:round(amount),custom,total:round(amount+custom),lines,monthly};
}
const oldJobForm=jobForm;
jobForm=function(j={}){
 let html=oldJobForm(j);
 const categories=[...CATEGORIES,'Other'];
 if(j.category&&!categories.includes(j.category))categories.push(j.category);
 const options='<select name="category">'+categories.map(c=>'<option value="'+esc(c)+'"'+((j.category||'Other')===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>';
 html=html.replace(/<select name="category">[\s\S]*?<\/select>/,options);
 const section='<div class="field full hq-pricing-box" id="hqPricingBox"><h3>Service pricing</h3><p class="hq-pricing-intro">Select the published service options. Add your own extra charges where needed.</p><div id="hqPricingChoices"></div><div id="hqLegacyNotice" class="hint-box" style="display:none">This older job keeps its existing rate-based pricing until you choose to change it.</div><button type="button" class="btn small secondary" id="hqSwitchPrice" style="display:none">Use service package pricing</button><div class="hq-extra-head"><strong>Additional charges</strong><button type="button" id="hqAddCharge" class="btn small secondary">+ Add Custom Charge</button></div><div id="hqChargeRows"></div><div class="hq-price-grid"><span>Base / one-off</span><strong id="hqPriceBase">£0.00</strong><span>Custom charges</span><strong id="hqPriceExtras">£0.00</strong><b>Total for this job</b><b id="hqPriceTotal">£0.00</b><span id="hqCareCaption" style="display:none">Monthly care, separate</span><strong id="hqCareTotal" style="display:none"></strong></div><p class="hq-price-fineprint">Published prices are guides. Confirm the agreed amount before saving. Monthly care is not added to the one-off job.</p></div>';
 return html.replace('<div class="field full"><label>Invoice description</label>',section+'<div class="field full"><label>Invoice description</label>');
};
function customRow(item){
 return '<div class="hq-charge-row"><div class="field"><label>Charge name</label><input data-extra-name maxlength="120" value="'+esc(item.name||'')+'" placeholder="e.g. Extra revision"></div><div class="field"><label>Amount (£)</label><input data-extra-price type="number" min="0" step="0.01" value="'+esc(item.amount??'')+'" placeholder="0.00"></div><div class="field hq-charge-desc"><label>Description</label><textarea data-extra-desc rows="2" placeholder="What is included?">'+esc(item.description||'')+'</textarea></div><button type="button" class="btn small secondary hq-del-charge">Remove</button></div>';
}
function chargesIn(form,strict){
 const result=[];for(const row of form.querySelectorAll('.hq-charge-row')){
  const name=clean(row.querySelector('[data-extra-name]').value),description=clean(row.querySelector('[data-extra-desc]').value),raw=clean(row.querySelector('[data-extra-price]').value);
  if(!name&&!raw&&!description)continue;
  if(strict&&(!name||raw===''||!Number.isFinite(Number(raw))||Number(raw)<0))throw Error('Each extra charge requires a name and valid amount.');
  const amount=Number(raw||0);if(Number.isFinite(amount)&&amount>=0)result.push({name,description,amount:round(amount)});
 }return result;
}
const oldOpenJob=openJobForm;
openJobForm=function(id,duplicateFromId){
 oldOpenJob(id,duplicateFromId);
 const form=document.getElementById('jobForm'),box=document.getElementById('hqPricingBox');
 if(!form||!box)return;
 const j=id?jobById(id):duplicateFromId?jobById(duplicateFromId):{};
 const field=n=>form.elements.namedItem(n),cat=field('category'),optionsHost=box.querySelector('#hqPricingChoices'),chargesHost=box.querySelector('#hqChargeRows');
 let initialCategory=j?.category||'',lastCategory='',keepLegacy=!!(j?.id&&!j.servicePricing&&serviceCat(j.category));
 if(j?.pricingModel==='rate-extras'&&field('overrideAmount'))field('overrideAmount').value=j.pricingBaseAmount==null?'':String(j.pricingBaseAmount);
 chargesHost.innerHTML=savedExtras(j).map(customRow).join('');
 function bindCharges(){
  chargesHost.querySelectorAll('.hq-charge-row').forEach(row=>{
   row.querySelector('.hq-del-charge').onclick=()=>{row.remove();update();};
   row.querySelectorAll('input,textarea').forEach(input=>input.addEventListener('input',update));
  });
 }
 bindCharges();
 box.querySelector('#hqAddCharge').onclick=()=>{
  chargesHost.insertAdjacentHTML('beforeend',customRow({}));
  bindCharges();chargesHost.lastElementChild.querySelector('[data-extra-name]').focus();
 };
 const isPackage=()=>!!serviceCat(cat.value)&&!keepLegacy;
 function basicAmount(){
  const override=clean(field('overrideAmount')?.value);
  if(override!==''&&Number.isFinite(Number(override)))return round(Math.max(0,Number(override)));
  return round(chipInJobAmount({rateType:field('rateType')?.value,rate:field('rate')?.value,
   hours:field('hours')?.value,minutes:field('minutes')?.value,days:field('days')?.value,
   hourlyDiscount:field('hourlyDiscount')?.value,discount:field('discount')?.value,overrideAmount:null}));
 }
 function currentSelections(){
  const spec=CATALOG[serviceCat(cat.value)];const choices={},checked=[];
  if(!spec)return {choices,checked};
  for(const g of spec.groups)choices[g.id]=Number(optionsHost.querySelector('[data-hq-opt="'+g.id+'"]')?.value??g.default);
  optionsHost.querySelectorAll('[data-hq-check]:checked').forEach(el=>checked.push(Number(el.value)));
  return {choices,checked};
 }
 function draw(){
  const spec=CATALOG[serviceCat(cat.value)];
  if(lastCategory!==cat.value){
   lastCategory=cat.value;
   const saved=j?.category===cat.value?j?.servicePricing?.choices:null;
   const choices=spec?selection(spec,saved):{};
   optionsHost.innerHTML=spec?spec.groups.map(g=>'<div class="field"><label>'+esc(g.label)+'</label><select data-hq-opt="'+esc(g.id)+'">'+g.choices.map((choice,i)=>'<option value="'+i+'"'+(i===choices[g.id]?' selected':'')+'>'+esc(choice.label)+'</option>').join('')+'</select></div>').join('')+
    (spec.checks.length?'<div class="field full"><strong>Optional extras</strong>'+spec.checks.map((extra,i)=>'<label class="hq-check-extra"><input type="checkbox" data-hq-check value="'+i+'"'+(j?.category===cat.value&&j?.servicePricing?.checked?.includes(i)?' checked':'')+'> '+esc(extra.label)+'</label>').join('')+'</div>':''):'';
   optionsHost.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',update));
  }
  const pkg=isPackage();
  optionsHost.classList.toggle('hq-hide-package',!pkg);
  box.querySelector('#hqLegacyNotice').style.display=keepLegacy&&!!spec?'':'none';
  box.querySelector('#hqSwitchPrice').style.display=keepLegacy&&!!spec?'':'none';
  for(const name of ['rateType','rate','hours','minutes','days','hourlyDiscount','discount','overrideAmount']){
   const el=field(name),wrapper=el&&el.closest('.field');if(wrapper)wrapper.classList.toggle('hq-hide-package',pkg);
  }
  for(const selector of ['.calc-box','.hourly-timesheet','.hourly-time','.day-time','.hourly-discount','#addDiscountBtn','.discount-row']){
   form.querySelectorAll(selector).forEach(node=>(node.closest('.field')||node).classList.toggle('hq-hide-package',pkg));
  }
  update();
 }
 function update(){
  const extras=chargesIn(form,false),custom=round(extras.reduce((s,x)=>s+x.amount,0));
  const options=currentSelections(),pkg=isPackage()?price(cat.value,options.choices,options.checked,[]):null;
  const base=pkg?pkg.base:basicAmount();
  box.querySelector('#hqPriceBase').textContent=money(base);
  box.querySelector('#hqPriceExtras').textContent=money(custom);
  box.querySelector('#hqPriceTotal').textContent=money(round(base+custom));
  const caption=box.querySelector('#hqCareCaption'),output=box.querySelector('#hqCareTotal');
  caption.style.display=output.style.display=pkg?.monthly?'':'none';
  if(pkg?.monthly)output.textContent=money(pkg.monthly.amount)+'/month';
 }
 box.querySelector('#hqSwitchPrice').onclick=()=>{keepLegacy=false;draw();};
 cat.addEventListener('change',()=>{
  if(cat.value!==initialCategory){
   keepLegacy=false;
   // A stored package total is not an hourly/day rate for the next category.
   if(j?.pricingModel==='package'&&field('overrideAmount'))field('overrideAmount').value='';
  }
  draw();
 });
 form.querySelectorAll('input,select').forEach(el=>{if(el!==cat)el.addEventListener('input',update);});
 draw();
 const submit=form.onsubmit;
 form.onsubmit=async event=>{
  event.preventDefault();
  let custom,pricing=null,base=basicAmount();
  try{
   custom=chargesIn(form,true);
   if(isPackage()){
    const opts=currentSelections(),prices=price(cat.value,opts.choices,opts.checked,custom);
    base=prices.base;
    pricing={version:1,category:cat.value,choices:opts.choices,checked:opts.checked,lines:prices.lines,base:prices.base,monthlyCare:prices.monthly};
    for(const [key,value] of [['rateType','day'],['rate','0'],['days','1'],['discount','0'],['hourlyDiscount','0'],['overrideAmount',String(prices.total)]])
     if(field(key))field(key).value=value;
   }else if(custom.length||j?.pricingModel==='rate-extras'){
    base=basicAmount();if(field('overrideAmount'))field('overrideAmount').value=String(round(base+custom.reduce((s,x)=>s+x.amount,0)));
   }
  }catch(error){toast(error.message);return;}
  const oldIds=new Set(state.jobs.map(x=>x.id)),oldRecord=id?JSON.stringify(jobById(id)):null;
  await submit.call(form,event);
  const created=state.jobs.filter(x=>!oldIds.has(x.id));
  const modalClosed=!!document.getElementById('modal')?.classList.contains('hidden');
  const edited=id&&jobById(id)&&(modalClosed||JSON.stringify(jobById(id))!==oldRecord)?[jobById(id)]:[];
  const changed=created.length?created:edited;
  if(!changed.length)return;
  for(const record of changed){
   record.customCharges=structuredClone(custom);
   record.servicePricing=pricing;
   record.pricingModel=pricing?'package':custom.length?'rate-extras':'';
   record.pricingBaseAmount=round(base);
   record.monthlyCare=pricing?.monthlyCare||null;
   if(pricing)record.amount=round(base+custom.reduce((s,x)=>s+x.amount,0));
  }
  await saveState();
 };
};
const oldInvoiceItems=chipInInvoiceItemsForJob;
chipInInvoiceItemsForJob=function(job){
 if(!job||(!job.servicePricing&&!savedExtras(job).length))return oldInvoiceItems(job);
 let items=[];
 if(job.pricingModel==='package'&&job.servicePricing){
  items=(job.servicePricing.lines||[]).map(x=>({description:x.name,qty:1,rate:round(x.amount)}));
  if(!items.length)items=[{description:job.title||'Service',qty:1,rate:round(job.servicePricing.base)}];
 }else items=oldInvoiceItems({...job,overrideAmount:job.pricingBaseAmount==null?null:job.pricingBaseAmount});
 for(const x of savedExtras(job))items.push({description:clean(x.name)+(clean(x.description)?' — '+clean(x.description):''),qty:1,rate:round(x.amount)});
 const total=round(items.reduce((s,x)=>s+Number(x.qty)*Number(x.rate),0));
 if(Math.abs(total-Number(job.amount||0))>=0.01)items.push({description:'Agreed price adjustment',qty:1,rate:round(Number(job.amount||0)-total)});
 return items;
};
const originalBasis=chipInBasisText;
chipInBasisText=function(j){
 if(j?.pricingModel==='package')return 'Service package and selected extras';
 if(savedExtras(j).length)return 'Service rate and additional charges';
 return originalBasis(j);
};
const style=document.createElement('style');
style.textContent='.hq-pricing-box{border:1px solid #dce4ee;background:#f8fafd;padding:16px;border-radius:14px;margin:8px 0}.hq-pricing-box h3{margin:0;font-size:17px}.hq-pricing-intro,.hq-price-fineprint{font-size:12px;color:var(--muted);line-height:1.5;margin:6px 0 14px}.hq-price-fineprint{font-size:11px;margin:10px 0 0}#hqPricingChoices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hq-hide-package{display:none!important}.hq-check-extra{display:block;font-size:12px;margin:9px 0}.hq-extra-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:16px 0 10px}.hq-charge-row{display:grid;grid-template-columns:1fr 120px auto;gap:10px;align-items:end;padding:12px;background:white;border:1px solid var(--line);border-radius:12px;margin:8px 0}.hq-charge-desc{grid-column:1/3}.hq-price-grid{display:grid;grid-template-columns:1fr auto;gap:8px 12px;border-top:1px solid var(--line);padding-top:13px;font-size:12px;margin-top:16px}.hq-price-grid strong{text-align:right}.hq-price-grid b{font-size:17px;color:var(--navy)}@media(max-width:700px){#hqPricingChoices{grid-template-columns:1fr}.hq-charge-row{grid-template-columns:1fr 110px}.hq-charge-desc{grid-column:1/-1}.hq-del-charge{grid-column:1/-1}}';
document.head.appendChild(style);
window.ChipInServicePricing={catalog:CATALOG,price,serviceCat};
})();
