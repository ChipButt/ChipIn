// Chip In HQ detailed hourly work logs and optional invoice timesheet display
(function(){
  function workDays17(job){
    const raw=job?.workDays;
    if(Array.isArray(raw))return raw;
    if(typeof raw==='string'&&raw.trim()){
      try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:[]}catch{}
    }
    return [];
  }
  function timeMinutes17(value){
    const m=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));
    if(!m)return null;
    const h=Number(m[1]),min=Number(m[2]);
    if(h<0||h>23||min<0||min>59)return null;
    return h*60+min;
  }
  function spanMinutes17(start,end){
    const a=timeMinutes17(start),b=timeMinutes17(end);
    if(a===null||b===null)return 0;
    let d=b-a;if(d<0)d+=1440;
    return d;
  }
  function breakMinutes17(br){return spanMinutes17(br?.startTime,br?.endTime)}
  function dayMinutes17(day){
    const shift=spanMinutes17(day?.startTime,day?.endTime);
    const unpaid=(Array.isArray(day?.breaks)?day.breaks:[]).filter(b=>b?.paid!==true&&b?.paid!=='true').reduce((s,b)=>s+breakMinutes17(b),0);
    return Math.max(0,shift-unpaid);
  }
  function totalMinutes17(jobOrDays){
    const days=Array.isArray(jobOrDays)?jobOrDays:workDays17(jobOrDays);
    return days.reduce((s,d)=>s+dayMinutes17(d),0);
  }
  function durationLabel17(minutes){
    minutes=Math.max(0,Math.round(Number(minutes)||0));
    const h=Math.floor(minutes/60),m=minutes%60;
    return `${h}h${m?` ${m}m`:''}`;
  }
  function clockRange17(a,b){return a&&b?`${a}–${b}`:(a||b||'—')}
  function breakLabel17(br){
    const mins=breakMinutes17(br),kind=(br?.paid===true||br?.paid==='true')?'paid':'unpaid';
    return `${clockRange17(br?.startTime,br?.endTime)} ${kind}${mins?` (${durationLabel17(mins)})`:''}`;
  }
  function invoiceShowsTimes17(inv,j){
    if(!j||j.rateType!=='hourly'||!workDays17(j).length)return false;
    return inv?.showTimeBreakdown===true||inv?.showTimeBreakdown==='true';
  }
  function workDayRow17(day={}){
    const id=day.id||uid('workday'),breaks=Array.isArray(day.breaks)?day.breaks:[];
    return `<div class="workday-card" data-workday-id="${esc(id)}">
      <div class="workday-main">
        <div class="field"><label>Date</label><input type="date" data-workday="date" value="${esc(day.date||'')}"></div>
        <div class="field"><label>Start</label><input type="time" data-workday="start" value="${esc(day.startTime||'')}"></div>
        <div class="field"><label>Finish</label><input type="time" data-workday="end" value="${esc(day.endTime||'')}"></div>
        <div class="workday-total"><span>Paid time</span><strong data-workday-total>${durationLabel17(dayMinutes17(day))}</strong></div>
        <button class="icon-btn remove-workday" type="button" aria-label="Remove work day">×</button>
      </div>
      <div class="break-list">${breaks.map(b=>breakRow17(b)).join('')}</div>
      <button class="btn small secondary add-break" type="button">+ Add break</button>
    </div>`;
  }
  function breakRow17(br={}){
    const id=br.id||uid('break');
    return `<div class="break-row" data-break-id="${esc(id)}">
      <div class="field"><label>Break start</label><input type="time" data-break="start" value="${esc(br.startTime||'')}"></div>
      <div class="field"><label>Break finish</label><input type="time" data-break="end" value="${esc(br.endTime||'')}"></div>
      <div class="field"><label>Break type</label><select data-break="paid"><option value="false" ${br.paid===true||br.paid==='true'?'':'selected'}>Unpaid</option><option value="true" ${br.paid===true||br.paid==='true'?'selected':''}>Paid</option></select></div>
      <div class="break-duration" data-break-total>${durationLabel17(breakMinutes17(br))}</div>
      <button class="icon-btn remove-break" type="button" aria-label="Remove break">×</button>
    </div>`;
  }
  function readWorkDays17(form){
    return $$('.workday-card',form).map(card=>({
      id:card.dataset.workdayId||uid('workday'),
      date:$('[data-workday="date"]',card)?.value||'',
      startTime:$('[data-workday="start"]',card)?.value||'',
      endTime:$('[data-workday="end"]',card)?.value||'',
      breaks:$$('.break-row',card).map(row=>({
        id:row.dataset.breakId||uid('break'),
        startTime:$('[data-break="start"]',row)?.value||'',
        endTime:$('[data-break="end"]',row)?.value||'',
        paid:$('[data-break="paid"]',row)?.value==='true'
      }))
    })).filter(d=>d.date||d.startTime||d.endTime||d.breaks.length);
  }
  function nextWorkDate17(form){
    const dates=$$('[data-workday="date"]',form).map(x=>x.value).filter(Boolean).sort();
    const base=dates.at(-1)||$('[name="startDate"]',form)?.value||TODAY();
    if(!dates.length)return base;
    const d=new Date(base+'T12:00:00');d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);
  }
  function syncTimes17(form){
    const days=readWorkDays17(form),hasDetailed=days.length>0,legacy=form.dataset.legacyTimeMode==='true',hours=$('[name="hours"]',form),minutes=$('[name="minutes"]',form);
    const mins=hasDetailed?totalMinutes17(days):(legacy?((Number(hours?.value||0)*60)+Number(minutes?.value||0)):0);
    if(hasDetailed||!legacy){if(hours)hours.value=Math.floor(mins/60);if(minutes)minutes.value=mins%60;if(hours)hours.dispatchEvent(new Event('input',{bubbles:true}))}
    const total=$('#workTimeTotal',form);if(total)total.textContent=durationLabel17(mins);
    $$('.workday-card',form).forEach(card=>{
      const day={startTime:$('[data-workday="start"]',card)?.value||'',endTime:$('[data-workday="end"]',card)?.value||'',breaks:$$('.break-row',card).map(row=>({startTime:$('[data-break="start"]',row)?.value||'',endTime:$('[data-break="end"]',row)?.value||'',paid:$('[data-break="paid"]',row)?.value==='true'}))};
      const out=$('[data-workday-total]',card);if(out)out.textContent=durationLabel17(dayMinutes17(day));
      $$('.break-row',card).forEach(row=>{const br={startTime:$('[data-break="start"]',row)?.value||'',endTime:$('[data-break="end"]',row)?.value||''};const breakOut=$('[data-break-total]',row);if(breakOut)breakOut.textContent=durationLabel17(breakMinutes17(br))});
    });
  }
  function bindTimes17(form){
    const box=$('#workDaysBox',form),add=$('#addWorkDayBtn',form);if(!box||!add)return;
    form.dataset.legacyTimeMode=box.querySelector('.workday-card')?'false':'true';
    const rebind=()=>{
      $$('.remove-workday',box).forEach(b=>b.onclick=()=>{form.dataset.legacyTimeMode='false';b.closest('.workday-card')?.remove();syncTimes17(form)});
      $$('.add-break',box).forEach(b=>b.onclick=()=>{const card=b.closest('.workday-card'),list=$('.break-list',card);list.insertAdjacentHTML('beforeend',breakRow17());rebind();syncTimes17(form)});
      $$('.remove-break',box).forEach(b=>b.onclick=()=>{b.closest('.break-row')?.remove();syncTimes17(form)});
      $$('input,select',box).forEach(x=>x.oninput=()=>syncTimes17(form));
    };
    add.onclick=()=>{form.dataset.legacyTimeMode='false';box.insertAdjacentHTML('beforeend',workDayRow17({date:nextWorkDate17(form),breaks:[]}));rebind();syncTimes17(form)};
    rebind();syncTimes17(form);
  }

  const prevJobForm17=jobForm;
  jobForm=function(j={}){
    let html=prevJobForm17(j),days=workDays17(j);
    html=html.replace('<div class="field hourly-time"><label>Hours worked</label>','<div class="field hourly-time legacy-hourly-time"><label>Hours worked</label>')
             .replace('<div class="field hourly-time"><label>Minutes</label>','<div class="field hourly-time legacy-hourly-time"><label>Minutes</label>');
    const marker='<div class="field hourly-time legacy-hourly-time"><label>Hours worked</label>';
    const block=`<div class="field full hourly-timesheet"><label>Detailed time worked</label><div class="timesheet-help">Add each day worked, then record any paid or unpaid breaks. Unpaid breaks are deducted from the billable total; paid breaks are recorded but remain billable.</div><div id="workDaysBox" class="workdays-box">${days.map(workDayRow17).join('')}</div><div class="timesheet-actions"><button class="btn small secondary" type="button" id="addWorkDayBtn">+ Add work day</button><div class="timesheet-grand">Billable total: <strong id="workTimeTotal">${durationLabel17(days.length?totalMinutes17(days):((Number(j.hours||0)*60)+Number(j.minutes||0)))}</strong></div></div>${!days.length&&((Number(j.hours||0)*60)+Number(j.minutes||0))>0?`<div class="hint-box">This older job currently has a saved total of <strong>${durationLabel17((Number(j.hours||0)*60)+Number(j.minutes||0))}</strong>. It will keep that total until you add detailed work-day entries.</div>`:''}</div>`;
    return html.replace(marker,block+marker);
  };

  const prevBindJobPricing17=chipInBindJobPricing;
  chipInBindJobPricing=function(j){
    prevBindJobPricing17(j);
    const form=$('#jobForm');if(!form)return;
    $$('.legacy-hourly-time',form).forEach(x=>x.style.display='none');
    bindTimes17(form);
    const type=$('[name="rateType"]',form),oldChange=type?.onchange;
    if(type)type.onchange=e=>{if(oldChange)oldChange.call(type,e);$$('.legacy-hourly-time',form).forEach(x=>x.style.display='none');$$('.hourly-timesheet',form).forEach(x=>x.style.display=type.value==='hourly'?'flex':'none');if(type.value==='hourly')syncTimes17(form)};
    $$('.hourly-timesheet',form).forEach(x=>x.style.display=type?.value==='hourly'?'flex':'none');
  };

  openJobForm=function(id){
    if(!state.clients.length){openModal(`<h2>Add a client first</h2><p class="sub">A job needs somebody to invoice.</p><div class="form-actions"><button class="btn" id="addClientFromJob">Add client</button></div>`);$('#addClientFromJob').onclick=()=>openClientForm();return}
    chipInEnsureJobReferences();
    const j=id?jobById(id):{status:'Booked',rateType:'day',days:1,workDays:[]};
    openModal(jobForm(j),true);chipInBindJobPricing(j);
    $('#jobForm').onsubmit=async e=>{
      e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());
      v.rate=Number(v.rate||0);v.hours=Number(v.hours||0);v.minutes=Number(v.minutes||0);v.days=Number(v.days||0);v.hourlyDiscount=Number(v.hourlyDiscount||0);v.discount=Number(v.discount||0);v.overrideAmount=v.overrideAmount===''?null:Number(v.overrideAmount);v.workDays=readWorkDays17(e.target);
      if(v.rateType==='hourly'&&v.workDays.length){
        if(v.workDays.some(d=>!d.date||!d.startTime||!d.endTime)){toast('Each work day needs a date, start time and finish time.');return}
        if(v.workDays.some(d=>(d.breaks||[]).some(b=>!b.startTime||!b.endTime))){toast('Each break needs a start and finish time.');return}
        if(v.workDays.some(d=>(d.breaks||[]).reduce((s,b)=>s+breakMinutes17(b),0)>spanMinutes17(d.startTime,d.endTime))){toast('Break time cannot be longer than the shift.');return}
        const mins=totalMinutes17(v.workDays);v.hours=Math.floor(mins/60);v.minutes=mins%60
      }
      v.amount=chipInJobAmount(v);v.reference=j.reference||chipInNextJobReference();
      if(j.id)Object.assign(j,v);else state.jobs.push({id:uid('job'),...v,createdAt:new Date().toISOString()});
      await saveState();closeModal();render();
    };
  };

  chipInHoursQty=function(j){const days=workDays17(j);return days.length?totalMinutes17(days)/60:(Math.max(0,Number(j?.hours||0))+Math.max(0,Number(j?.minutes||0))/60)};
  chipInHoursLabel=function(j){const days=workDays17(j);return days.length?durationLabel17(totalMinutes17(days)):`${Math.max(0,Number(j?.hours||0))}h${Number(j?.minutes||0)?` ${Math.max(0,Number(j.minutes))}m`:''}`};

  function timeBreakdownHtml17(j){
    const days=workDays17(j);if(!days.length)return'';
    return `<div class="invoice-timesheet"><div class="invoice-timesheet-title">Time worked</div><table><thead><tr><th>Date</th><th>Shift</th><th>Breaks</th><th class="right">Billable</th></tr></thead><tbody>${days.map(d=>`<tr><td>${fmtDate(d.date)}</td><td>${esc(clockRange17(d.startTime,d.endTime))}</td><td>${(d.breaks||[]).length?(d.breaks||[]).map(b=>esc(breakLabel17(b))).join('<br>'):'—'}</td><td class="right"><strong>${durationLabel17(dayMinutes17(d))}</strong></td></tr>`).join('')}</tbody></table><div class="invoice-timesheet-total"><span>Total billable time</span><strong>${durationLabel17(totalMinutes17(days))}</strong></div></div>`;
  }

  const prevOpenInvoiceForm17=openInvoiceForm;
  openInvoiceForm=function(id,jobId){
    prevOpenInvoiceForm17(id,jobId);const form=$('#invoiceForm');if(!form)return;
    const inv=id?invoiceById(id):null,j=jobId?jobById(jobId):chipInInvoiceJob(inv);if(!j||j.rateType!=='hourly'||!workDays17(j).length)return;
    const grid=form.querySelector('.form-grid'),current=id?(inv?.showTimeBreakdown===true||inv?.showTimeBreakdown==='true'):true;
    if(grid&&!$('[name="showTimeBreakdown"]',form))grid.insertAdjacentHTML('beforeend',`<div class="field full"><label>Invoice time breakdown</label><select name="showTimeBreakdown"><option value="true" ${current?'selected':''}>Show dates, shift times and breaks</option><option value="false" ${current?'':'selected'}>Hide detailed times — show total hours only</option></select><div class="rate-source">This changes the invoice display only. The price still uses the calculated billable hours.</div></div>`);
  };

  const prevInvoicePreviewHtml17=invoicePreviewHTML;
  invoicePreviewHTML=function(inv){
    const html=prevInvoicePreviewHtml17(inv),j=chipInInvoiceJob(inv);if(!invoiceShowsTimes17(inv,j))return html;
    return html.replace('<div class="invoice-total">',timeBreakdownHtml17(j)+'<div class="invoice-total">');
  };

  const prevExportCSV17=exportCSV;
  exportCSV=function(type){
    if(type!=='jobs')return prevExportCSV17(type);
    const rows=[['Reference','Customer ref / PO','Job','Client','Category','Start','End','Rate type','Rate','Hours','Minutes','Detailed time entries','Days','Discount per hour','Additional discount','Override','Fee','Status','Description','Notes'],...state.jobs.map(j=>[j.reference,j.customerReference,j.title,clientById(j.clientId)?.name,j.category,j.startDate,j.endDate,j.rateType,j.rate,Math.floor(chipInHoursQty(j)),Math.round((chipInHoursQty(j)%1)*60),workDays17(j).map(d=>`${d.date} ${clockRange17(d.startTime,d.endTime)}${(d.breaks||[]).length?` [${d.breaks.map(b=>breakLabel17(b)).join('; ')}]`:''} = ${durationLabel17(dayMinutes17(d))}`).join(' | '),j.days,j.hourlyDiscount,j.discount,j.overrideAmount,j.amount,j.status,j.description,j.notes])];
    downloadBlob(new Blob([makeCSV(rows)],{type:'text/csv;charset=utf-8'}),'jobs.csv');
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
    let y=91;const itemHeader=()=>{d.setFillColor(244,246,250);d.rect(15,y,180,8,'F');d.setFont(undefined,'bold');d.text('Description',18,y+5.5);d.text('Qty',135,y+5.5,{align:'right'});d.text('Rate',165,y+5.5,{align:'right'});d.text('Amount',192,y+5.5,{align:'right'});d.setFont(undefined,'normal');y+=12};itemHeader();
    (view.items||[]).forEach(x=>{const lines=d.splitTextToSize(x.description,105),h=Math.max(8,lines.length*5+2);if(y+h>238){d.addPage();y=20;itemHeader()}d.text(lines,18,y);d.text(String(x.qty),135,y,{align:'right'});d.text(money(x.rate),165,y,{align:'right'});d.text(money(Number(x.qty||0)*Number(x.rate||0)),192,y,{align:'right'});y+=h});
    if(invoiceShowsTimes17(inv,j)){
      y+=4;if(y>220){d.addPage();y=20}
      d.setTextColor(10,47,87);d.setFont(undefined,'bold');d.setFontSize(10);d.text('TIME WORKED',15,y);y+=5;d.setTextColor(23,32,51);d.setFontSize(8);d.setFillColor(244,246,250);d.rect(15,y,180,7,'F');d.text('Date',18,y+4.8);d.text('Shift',48,y+4.8);d.text('Breaks',83,y+4.8);d.text('Billable',192,y+4.8,{align:'right'});y+=10;d.setFont(undefined,'normal');
      for(const day of workDays17(j)){
        const breaks=(day.breaks||[]).length?(day.breaks||[]).map(b=>breakLabel17(b)).join('; '):'—',breakLines=d.splitTextToSize(breaks,72),rowH=Math.max(7,breakLines.length*4.2+2);
        if(y+rowH>238){d.addPage();y=20;d.setFont(undefined,'bold');d.text('TIME WORKED (CONT.)',15,y);y+=7;d.setFont(undefined,'normal')}
        d.text(fmtDate(day.date),18,y);d.text(clockRange17(day.startTime,day.endTime),48,y);d.text(breakLines,83,y);d.setFont(undefined,'bold');d.text(durationLabel17(dayMinutes17(day)),192,y,{align:'right'});d.setFont(undefined,'normal');y+=rowH;
      }
      d.setDrawColor(220);d.line(145,y,195,y);y+=5;d.setFont(undefined,'bold');d.text('Total billable time',145,y);d.text(durationLabel17(totalMinutes17(j)),192,y,{align:'right'});d.setFont(undefined,'normal');y+=4;
    }
    y+=5;if(y>228){d.addPage();y=25}d.line(115,y,195,y);y+=7;d.text('Subtotal',145,y,{align:'right'});d.text(money(t.subtotal),192,y,{align:'right'});if(s.vatRegistered){y+=6;d.text(`VAT ${view.vatRate}%`,145,y,{align:'right'});d.text(money(t.vat),192,y,{align:'right'})}y+=8;d.setFont(undefined,'bold');d.setFontSize(12);d.text('TOTAL',145,y,{align:'right'});d.text(money(t.total),192,y,{align:'right'});
    if(y>232){d.addPage();y=25}d.setFontSize(8.5);d.setFont(undefined,'normal');d.setTextColor(90,97,110);const footerY=Math.max(250,y+14);d.text(`Payment terms: ${view.paymentTermsDays} day${view.paymentTermsDays===1?'':'s'} from invoice date\nPayment by bank transfer\nAccount name: ${s.bankName||''}\nSort code: ${s.sortCode||''}   Account number: ${s.accountNumber||''}`,15,Math.min(footerY,265));if(view.notes)d.text(d.splitTextToSize(view.notes,75),110,Math.min(footerY,265));
    return d.output('blob');
  };
})();