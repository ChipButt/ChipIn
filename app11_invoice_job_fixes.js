// Chip In HQ invoice/job pricing fixes: hourly discounts, richer job invoices, editing and email/share actions
function chipInRoundMoney(n){return Math.round((Number(n)||0)*100)/100}
function chipInHoursQty(j){return Math.max(0,Number(j?.hours||0))+Math.max(0,Number(j?.minutes||0))/60}
function chipInHoursLabel(j){const h=Math.max(0,Number(j?.hours||0)),m=Math.max(0,Number(j?.minutes||0));return `${h}h${m?` ${m}m`:''}`}
function chipInInvoiceTerms(inv){
  if(Number(inv?.paymentTermsDays)>0)return Number(inv.paymentTermsDays);
  if(inv?.issueDate&&inv?.dueDate){const a=new Date(inv.issueDate+'T12:00:00'),b=new Date(inv.dueDate+'T12:00:00'),d=Math.round((b-a)/86400000);if(d>=0)return d}
  return Number(state.settings.defaultTerms||14);
}
function chipInInvoiceJob(inv){return inv?.jobId?jobById(inv.jobId):null}
function chipInInvoiceJobRef(inv){return inv?.jobReference||chipInInvoiceJob(inv)?.reference||''}
function chipInInvoiceCustomerRef(inv){return inv?.customerReference||chipInInvoiceJob(inv)?.customerReference||''}
function chipInInvoiceNotes(inv){const j=chipInInvoiceJob(inv),n=String(inv?.notes||'');return j?.notes&&(!n||n==='Thank you for your business.')?j.notes:n}
function chipInClientEmail(inv){return String(clientById(inv?.clientId)?.email||'').trim()}
function chipInInvoiceEmailSubject(inv){return `Invoice ${inv.number} from ${state.settings.tradingName||state.settings.legalName||'Chip In'}`}
function chipInInvoiceEmailBody(inv){
  const c=clientById(inv.clientId)||{},name=c.contact||c.name||'there',terms=chipInInvoiceTerms(inv),total=invoiceTotals(inv).total;
  return `Hi ${name},\n\nPlease find invoice ${inv.number} for ${money(total)}. It is due on ${fmtDate(inv.dueDate)} (${terms} day${terms===1?'':'s'} payment terms).\n\nKind regards,\n${state.settings.tradingName||state.settings.legalName||'Chip In'}`;
}

chipInJobAmount=function(v){
  const rate=Number(v.rate||0),fixedDiscount=Math.max(0,Number(v.discount||0)),hourlyDiscount=v.rateType==='hourly'?Math.max(0,Number(v.hourlyDiscount||0)):0;
  const qty=v.rateType==='hourly'?(Math.max(0,Number(v.hours||0))+Math.max(0,Number(v.minutes||0))/60):Math.max(0,Number(v.days||0));
  const subtotal=Math.max(0,rate-hourlyDiscount)*qty,override=v.overrideAmount;
  return override!==''&&override!==null&&override!==undefined?Math.max(0,Number(override||0)):Math.max(0,subtotal-fixedDiscount);
};
chipInBasisText=function(j){
  if(!j.rateType)return'';
  if(j.overrideAmount!==null&&j.overrideAmount!==undefined&&j.overrideAmount!=='')return'Price overridden for this job';
  const q=j.rateType==='hourly'?chipInHoursLabel(j):`${Number(j.days||0)} day${Number(j.days||0)===1?'':'s'}`;
  const hourlyDisc=j.rateType==='hourly'&&Number(j.hourlyDiscount||0)>0?` · ${money(j.hourlyDiscount)}/hr discount`:'';
  return `${q} × ${money(j.rate||0)}${hourlyDisc}${Number(j.discount||0)>0?` · ${money(j.discount)} additional discount`:''}`;
};

const chipInPrevJobForm=jobForm;
jobForm=function(j={}){
  let html=chipInPrevJobForm(j);
  const marker='<div class="field full"><button class="btn small secondary" type="button" id="addDiscountBtn"';
  const hourly=`<div class="field hourly-discount"><label>Discount per hour (£)</label><input type="number" min="0" step="0.01" name="hourlyDiscount" value="${Number(j.hourlyDiscount||0)||''}" placeholder="0.00"></div><div class="field hourly-discount"><div class="hint-box" style="margin-top:17px">Deducts this amount from every hour worked. You can also add a separate fixed discount below.</div></div>`;
  return html.replace(marker,hourly+marker);
};
chipInBindJobPricing=function(j){
  const form=$('#jobForm');if(!form)return;
  const type=$('[name="rateType"]',form),rate=$('[name="rate"]',form),client=$('[name="clientId"]',form),cat=$('[name="category"]',form),hours=$('[name="hours"]',form),minutes=$('[name="minutes"]',form),days=$('[name="days"]',form),hourlyDiscount=$('[name="hourlyDiscount"]',form),discount=$('[name="discount"]',form),override=$('[name="overrideAmount"]',form),source=$('#rateSource',form);
  let rateTouched=!!j.id;
  const updateLayout=()=>{const hourly=type.value==='hourly';$$('.hourly-time',form).forEach(x=>x.style.display=hourly?'flex':'none');$$('.hourly-discount',form).forEach(x=>x.style.display=hourly?'flex':'none');$$('.day-time',form).forEach(x=>x.style.display=hourly?'none':'flex');$('#rateLabel',form).textContent=hourly?'Hourly rate (£)':'Day rate (£)'};
  const updateCalc=()=>{const v={rateType:type.value,rate:rate.value,hours:hours.value,minutes:minutes.value,days:days.value,hourlyDiscount:hourlyDiscount?.value||0,discount:discount.value,overrideAmount:override.value},qty=type.value==='hourly'?(Number(hours.value||0)+Number(minutes.value||0)/60):Number(days.value||0),hourDisc=type.value==='hourly'?Number(hourlyDiscount?.value||0):0,subtotal=Math.max(0,Number(rate.value||0)-hourDisc)*qty,total=chipInJobAmount(v);$('#jobCalcTotal',form).textContent=money(total);const unit=type.value==='hourly'?`${Number(hours.value||0)}h ${Number(minutes.value||0)}m`:`${Number(days.value||0)} day(s)`;const discText=hourDisc>0?` − ${money(hourDisc)}/hr`:'';const fixedText=Number(discount.value||0)>0?` − ${money(discount.value)} fixed discount`:'';$('#jobCalcBreakdown',form).textContent=override.value!==''?`Manual override replaces ${money(Math.max(0,subtotal-Number(discount.value||0)))} calculated total`:`${unit} × ${money(rate.value||0)}${discText}${fixedText}`};
  const pullRate=(force=false)=>{if(rateTouched&&!force)return;const r=chipInRateFor(client.value,cat.value,type.value);if(r.rate>0)rate.value=r.rate;source.textContent=r.source;updateCalc()};
  type.onchange=()=>{rateTouched=false;updateLayout();pullRate(true)};client.onchange=()=>{rateTouched=false;pullRate(true)};cat.onchange=()=>{rateTouched=false;pullRate(true)};rate.oninput=()=>{rateTouched=true;source.textContent='Rate entered for this job';updateCalc()};[hours,minutes,days,hourlyDiscount,discount,override].filter(Boolean).forEach(x=>x.oninput=updateCalc);$('#addDiscountBtn',form).onclick=()=>{$('#discountWrap',form).classList.remove('hidden-rate-field');discount.focus()};updateLayout();if(!j.id||!Number(rate.value||0))pullRate(true);else{source.textContent='Saved rate for this job';updateCalc()}
};

const chipInPrevOpenJobForm=openJobForm;
openJobForm=function(id){
  chipInPrevOpenJobForm(id);
  const form=$('#jobForm');if(!form)return;
  const oldSubmit=form.onsubmit;
  form.onsubmit=async e=>{
    const hd=$('[name="hourlyDiscount"]',form);if(hd&&!hd.value)hd.value='0';
    return oldSubmit(e);
  };
};

function chipInInvoiceItemsForJob(j){
  const desc=j.description||j.title||'Work',items=[];
  if(j.rateType==='hourly'){
    const qty=chipInHoursQty(j),label=chipInHoursLabel(j),rate=Number(j.rate||0),hourDisc=Math.max(0,Number(j.hourlyDiscount||0));
    items.push({description:`${desc} — ${label}`,qty:chipInRoundMoney(qty),rate});
    if(hourDisc>0)items.push({description:`Hourly discount — ${label}`,qty:chipInRoundMoney(qty),rate:-hourDisc});
  }else{
    items.push({description:desc,qty:Math.max(0,Number(j.days||1)),rate:Number(j.rate ?? j.amount ?? 0)});
  }
  if(Number(j.discount||0)>0)items.push({description:'Additional agreed discount',qty:1,rate:-Math.abs(Number(j.discount))});
  const calculated=chipInRoundMoney(items.reduce((s,x)=>s+Number(x.qty||0)*Number(x.rate||0),0));
  if(j.overrideAmount!==null&&j.overrideAmount!==undefined&&j.overrideAmount!==''){
    const adjustment=chipInRoundMoney(Number(j.overrideAmount||0)-calculated);if(Math.abs(adjustment)>=0.005)items.push({description:'Agreed price adjustment',qty:1,rate:adjustment});
  }
  return items;
}
function chipInInvoiceIsFlattened(inv,j){
  if(!j||!Array.isArray(inv?.items)||inv.items.length!==1)return false;
  const x=inv.items[0];return Math.abs(Number(x.qty||0)-1)<.001&&Math.abs(Number(x.rate||0)-Number(j.amount||0))<.01;
}

invoiceItemRow=function(x={}){return `<div class="form-grid invoice-item" style="grid-template-columns:1fr 90px 130px 38px;margin-bottom:8px"><div class="field"><input data-item="description" required placeholder="Description" value="${esc(x.description||'')}"></div><div class="field"><input data-item="qty" type="number" min="0" step="0.01" value="${x.qty??1}"></div><div class="field"><input data-item="rate" type="number" step="0.01" placeholder="£" value="${x.rate??''}"></div><button class="icon-btn remove-invoice-item" type="button">×</button></div>`};

const chipInPrevOpenInvoiceForm=openInvoiceForm;
openInvoiceForm=function(id,jobId){
  chipInPrevOpenInvoiceForm(id,jobId);
  const form=$('#invoiceForm');if(!form)return;
  const inv=id?invoiceById(id):null,linkedJob=jobId?jobById(jobId):chipInInvoiceJob(inv),notes=$('[name="notes"]',form),jobRef=$('[name="jobReference"]',form),custRef=$('[name="customerReference"]',form);
  if(linkedJob){
    if(!id||chipInInvoiceIsFlattened(inv,linkedJob)){$('#invoiceItems',form).innerHTML=chipInInvoiceItemsForJob(linkedJob).map(invoiceItemRow).join('');bindInvoiceItems()}
    if(notes&&(!id||!notes.value||notes.value==='Thank you for your business.'))notes.value=linkedJob.notes||'';
    if(jobRef&&!jobRef.value)jobRef.value=linkedJob.reference||'';
    if(custRef&&!custRef.value)custRef.value=linkedJob.customerReference||'';
  }
  const terms=chipInInvoiceTerms(inv),grid=form.querySelector('.form-grid');
  if(grid&&!$('[name="paymentTermsDays"]',form))grid.insertAdjacentHTML('beforeend',`<div class="field"><label>Payment terms</label><input type="number" min="0" step="1" name="paymentTermsDays" value="${terms}"><div class="rate-source">Days from invoice date</div></div>`);
  const issue=$('[name="issueDate"]',form),due=$('[name="dueDate"]',form),termInput=$('[name="paymentTermsDays"]',form);
  const updateDue=()=>{if(issue?.value&&due&&termInput)due.value=addDays(issue.value,Number(termInput.value||0))};
  if(issue)issue.onchange=updateDue;if(termInput)termInput.onchange=updateDue;
  const oldSubmit=form.onsubmit;
  form.onsubmit=async e=>{
    if(id){const current=invoiceById(id);if(current){current.archivePath='';current.archiveHash='';current.archivedAt='';current.archivePending=current.status!=='Draft'}}
    return oldSubmit(e);
  };
};

const chipInPrevExportCSV=exportCSV;
exportCSV=function(type){if(type!=='jobs')return chipInPrevExportCSV(type);const rows=[['Reference','Customer ref / PO','Job','Client','Category','Start','End','Rate type','Rate','Hours','Minutes','Days','Discount per hour','Additional discount','Override','Fee','Status','Description','Notes'],...state.jobs.map(j=>[j.reference,j.customerReference,j.title,clientById(j.clientId)?.name,j.category,j.startDate,j.endDate,j.rateType,j.rate,j.hours,j.minutes,j.days,j.hourlyDiscount,j.discount,j.overrideAmount,j.amount,j.status,j.description,j.notes])];downloadBlob(new Blob([makeCSV(rows)],{type:'text/csv;charset=utf-8'}),'jobs.csv')};

const chipInPrevInvoicePreviewHTML=invoicePreviewHTML;
invoicePreviewHTML=function(inv){
  const j=chipInInvoiceJob(inv),view={...inv,jobReference:chipInInvoiceJobRef(inv),customerReference:chipInInvoiceCustomerRef(inv),notes:chipInInvoiceNotes(inv),paymentTermsDays:chipInInvoiceTerms(inv)};
  if(chipInInvoiceIsFlattened(inv,j))view.items=chipInInvoiceItemsForJob(j);
  let html=chipInPrevInvoicePreviewHTML(view);
  const terms=`<strong>Payment terms:</strong> ${view.paymentTermsDays} day${view.paymentTermsDays===1?'':'s'} from invoice date<br>`;
  return html.replace('<div class="invoice-footer">',`<div class="invoice-footer">${terms}`);
};

invoiceRows=function(rows){return rows.map(i=>{const c=clientById(i.clientId),t=invoiceTotals(i),s=invoiceStatus(i);return `<tr><td><strong class="mono">${esc(i.number)}</strong></td><td>${esc(c?.name||'—')}</td><td>${fmtDate(i.issueDate)}<div class="muted">due ${fmtDate(i.dueDate)}</div></td><td>${money(t.total)}</td><td>${money(outstanding(i))}</td><td>${statusBadge(s)}</td><td class="right"><div class="row-actions"><button class="btn small secondary" data-action="view-invoice" data-id="${i.id}">Open</button><button class="btn small secondary" data-action="edit-invoice" data-id="${i.id}">Edit</button><button class="btn small secondary" data-action="email-invoice" data-id="${i.id}">Email</button>${s==='Draft'?`<button class="btn small" data-action="send-invoice" data-id="${i.id}">Mark sent</button>`:''}${s!=='Paid'&&s!=='Draft'?`<button class="btn small gold" data-action="pay-invoice" data-id="${i.id}">Payment</button>`:''}<button class="icon-btn" data-action="delete-invoice" data-id="${i.id}">×</button></div></td></tr>`}).join('')};

async function chipInShareInvoice(inv){
  const email=chipInClientEmail(inv);if(!email)return toast('This client does not have an email address saved.');
  const blob=pdfBlob(inv),file=new File([blob],`${inv.number}.pdf`,{type:'application/pdf'}),subject=chipInInvoiceEmailSubject(inv),body=chipInInvoiceEmailBody(inv);
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({title:subject,text:`To: ${email}\n\n${body}`,files:[file]});return}catch(e){if(e?.name==='AbortError')return}
  }
  downloadBlob(blob,`${inv.number}.pdf`);
  window.location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body+'\n\nThe invoice PDF has been downloaded ready to attach.')}`;
}
const chipInPrevHandleAction=handleAction;
handleAction=async function(action,id){if(action==='edit-invoice'){openInvoiceForm(id);return}if(action==='email-invoice'){await chipInShareInvoice(invoiceById(id));return}return chipInPrevHandleAction(action,id)};
const chipInPrevOpenInvoicePreview=openInvoicePreview;
openInvoicePreview=function(id){
  chipInPrevOpenInvoicePreview(id);
  const actions=$('#modalBody .section-title .row-actions');if(!actions)return;
  if(!$('#editInvoiceBtn')){const b=document.createElement('button');b.className='btn secondary';b.id='editInvoiceBtn';b.textContent='Edit invoice';b.onclick=()=>openInvoiceForm(id);actions.insertBefore(b,actions.firstChild)}
  if(!$('#emailInvoiceBtn')){const b=document.createElement('button');b.className='btn secondary';b.id='emailInvoiceBtn';b.textContent='Email invoice';b.onclick=()=>chipInShareInvoice(invoiceById(id));actions.insertBefore(b,actions.firstChild)}
};

pdfBlob=function(inv){
  if(!window.jspdf)throw Error('PDF library did not load.');
  const {jsPDF}=window.jspdf,d=new jsPDF({unit:'mm',format:'a4'}),snap=invoiceSnap(inv),s=snap.business,c=snap.client,j=chipInInvoiceJob(inv),view={...inv,jobReference:chipInInvoiceJobRef(inv),customerReference:chipInInvoiceCustomerRef(inv),notes:chipInInvoiceNotes(inv),paymentTermsDays:chipInInvoiceTerms(inv)};
  if(chipInInvoiceIsFlattened(inv,j))view.items=chipInInvoiceItemsForJob(j);
  const t=invoiceTotals(view);
  try{if(LOGO_PDF_DATA_URL)d.addImage(LOGO_PDF_DATA_URL,'PNG',15,13,58,17)}catch{}
  d.setTextColor(10,47,87);d.setFontSize(24);d.setFont(undefined,'bold');d.text('INVOICE',195,22,{align:'right'});d.setFontSize(9);d.setFont(undefined,'normal');d.setTextColor(95,102,116);d.text(view.number,195,28,{align:'right'});d.text(`Issued ${fmtDate(view.issueDate)}   Due ${fmtDate(view.dueDate)}`,195,33,{align:'right'});
  const refs=[view.jobReference?`Job ref: ${view.jobReference}`:'',view.customerReference?`Customer ref / PO: ${view.customerReference}`:''].filter(Boolean).join('   ');if(refs)d.text(refs,195,38,{align:'right'});
  d.setDrawColor(220);d.line(15,43,195,43);d.setTextColor(23,32,51);d.setFont(undefined,'bold');d.text('FROM',15,52);d.text('BILL TO',110,52);d.setFont(undefined,'normal');d.text(`${s.legalName||''} trading as ${s.tradingName||'Chip In'}\n${s.address||''}\n${s.email||''}${s.phone?'\n'+s.phone:''}`,15,58,{maxWidth:80});d.text(`${c.name||''}${c.contact?'\n'+c.contact:''}${c.address?'\n'+c.address:''}${c.email?'\n'+c.email:''}`,110,58,{maxWidth:80});
  let y=91;d.setFillColor(244,246,250);d.rect(15,y,180,8,'F');d.setFont(undefined,'bold');d.text('Description',18,y+5.5);d.text('Qty',135,y+5.5,{align:'right'});d.text('Rate',165,y+5.5,{align:'right'});d.text('Amount',192,y+5.5,{align:'right'});d.setFont(undefined,'normal');y+=12;
  (view.items||[]).forEach(x=>{const lines=d.splitTextToSize(x.description,105);d.text(lines,18,y);d.text(String(x.qty),135,y,{align:'right'});d.text(money(x.rate),165,y,{align:'right'});d.text(money(Number(x.qty||0)*Number(x.rate||0)),192,y,{align:'right'});y+=Math.max(8,lines.length*5+2)});
  y+=5;d.line(115,y,195,y);y+=7;d.text('Subtotal',145,y,{align:'right'});d.text(money(t.subtotal),192,y,{align:'right'});if(s.vatRegistered){y+=6;d.text(`VAT ${view.vatRate}%`,145,y,{align:'right'});d.text(money(t.vat),192,y,{align:'right'})}y+=8;d.setFont(undefined,'bold');d.setFontSize(12);d.text('TOTAL',145,y,{align:'right'});d.text(money(t.total),192,y,{align:'right'});
  d.setFontSize(8.5);d.setFont(undefined,'normal');d.setTextColor(90,97,110);d.text(`Payment terms: ${view.paymentTermsDays} day${view.paymentTermsDays===1?'':'s'} from invoice date\nPayment by bank transfer\nAccount name: ${s.bankName||''}\nSort code: ${s.sortCode||''}   Account number: ${s.accountNumber||''}`,15,255);
  if(view.notes)d.text(d.splitTextToSize(view.notes,75),110,255);
  return d.output('blob');
};
