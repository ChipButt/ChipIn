// Chip In HQ job-profit reserve reports and dashboard calendar / prep planner
(function(){
  DEFAULT_STATE.prepBlocks=DEFAULT_STATE.prepBlocks||[];
  if(!state.prepBlocks)state.prepBlocks=[];
  PAGE_META.tax=['Tax','Reserve a set percentage of paid-job profit and track the pot month by month.'];

  function reserveRate15(){
    const n=Number(state.settings.reservePercent);
    return Math.max(0,Math.min(100,Number.isFinite(n)?n:25));
  }
  function paidDate15(j){return j?.paidDate||j?.endDate||j?.startDate||''}
  function linkedExpenses15(jobId){return (state.expenses||[]).filter(e=>e.jobId===jobId)}
  function linkedExpenseTotal15(jobId){return linkedExpenses15(jobId).reduce((s,e)=>s+Number(e.amount||0),0)}
  function jobFinance15(j){
    const fee=Number(j?.paidAmount??j?.amount??0),expenses=linkedExpenseTotal15(j?.id),profit=fee-expenses,rate=reserveRate15();
    const taxPot=Math.max(0,profit)*rate/100;
    return{job:j,fee,expenses,profit,taxPot,usable:profit-taxPot,paidDate:paidDate15(j)};
  }
  function paidJobRows15(start,end){
    return (state.jobs||[]).filter(j=>j.status==='Paid'&&inRange(paidDate15(j),start,end)).map(jobFinance15).sort((a,b)=>b.paidDate.localeCompare(a.paidDate));
  }
  function sumRows15(rows,key){return rows.reduce((s,r)=>s+Number(r[key]||0),0)}
  function monthBounds15(month){
    const [y,m]=month.split('-').map(Number),last=new Date(y,m,0).getDate();
    return[`${month}-01`,`${month}-${String(last).padStart(2,'0')}`];
  }
  function monthLabel15(month){return new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00'))}
  function report15(month){
    const [start,end]=monthBounds15(month),rows=paidJobRows15(start,end),rate=reserveRate15();
    const fee=sumRows15(rows,'fee'),jobExpenses=sumRows15(rows,'expenses'),profit=sumRows15(rows,'profit'),taxPot=sumRows15(rows,'taxPot'),usable=sumRows15(rows,'usable');
    const expensesPaid=(state.expenses||[]).filter(e=>inRange(e.date,start,end)),expensesPaidTotal=expensesPaid.reduce((s,e)=>s+Number(e.amount||0),0),linkedPaid=expensesPaid.filter(e=>e.jobId).reduce((s,e)=>s+Number(e.amount||0),0),unlinkedPaid=expensesPaid.filter(e=>!e.jobId).reduce((s,e)=>s+Number(e.amount||0),0);
    const ty=taxYearForDate(end),[tyStart,tyEnd]=taxYearBounds(ty),asOf=end<TODAY()?end:TODAY(),ytdRows=paidJobRows15(tyStart,asOf),ytdTarget=sumRows15(ytdRows,'taxPot'),ytdFees=sumRows15(ytdRows,'fee'),ytdJobExpenses=sumRows15(ytdRows,'expenses'),ytdProfit=sumRows15(ytdRows,'profit'),balance=Number(state.settings.taxPotBalance||0),topUp=Math.max(0,ytdTarget-balance);
    return{month,start,end,rate,rows,fee,jobExpenses,profit,taxPot,usable,expensesPaidTotal,linkedPaid,unlinkedPaid,ty,tyStart,tyEnd,asOf,ytdRows,ytdTarget,ytdFees,ytdJobExpenses,ytdProfit,balance,topUp,cashAfter:fee-expensesPaidTotal-taxPot};
  }

  calcTax=function(label=taxYearForDate()){
    const [start,end]=taxYearBounds(label),rows=paidJobRows15(start,end),rate=reserveRate15(),gross=sumRows15(rows,'fee'),jobExpenses=sumRows15(rows,'expenses'),profit=sumRows15(rows,'profit'),taxPot=sumRows15(rows,'taxPot'),usable=sumRows15(rows,'usable');
    const allExpenses=(state.expenses||[]).filter(e=>inRange(e.date,start,end)).reduce((s,e)=>s+Number(e.amount||0),0);
    return{gross,invoiceGross:gross,paidJobFallbackGross:0,allowable:jobExpenses,allExpenses,deductible:jobExpenses,useAllowance:false,profit,seProfit:profit,reservePercent:rate,taxPot,usable,estimatedDue:taxPot,incomeTax:taxPot,class4:0,payePaid:0,rows};
  };

  dashboardNumbers=function(){
    const ty=taxYearForDate(),t=calcTax(ty),out=(state.invoices||[]).reduce((s,i)=>s+outstanding(i),0);
    return{ty,income:t.gross,expenses:t.allowable,profit:t.profit,out};
  };

  let reportMonth15=TODAY().slice(0,7);
  renderTax=function(){
    const r=report15(reportMonth15),rate=r.rate,usablePct=Math.max(0,100-rate),jobRows=r.rows.map(x=>`<tr><td><strong>${esc(x.job.title||'Job')}</strong><div class="muted">${esc(x.job.reference||'')} · paid ${fmtDate(x.paidDate)}</div></td><td>${money(x.fee)}</td><td>${money(x.expenses)}</td><td><strong>${money(x.profit)}</strong></td><td>${money(x.taxPot)}</td><td>${money(x.usable)}</td></tr>`).join('');
    $('#content').innerHTML=`
      <div class="grid cards" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="card stat"><div class="accent-bar"></div><div class="label">Paid job fees · ${r.ty}</div><div class="value">${money(r.ytdFees)}</div><div class="hint">Full fees for jobs marked Paid</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">Linked job costs</div><div class="value">${money(r.ytdJobExpenses)}</div><div class="hint">Only expenses attached to those jobs</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">Paid-job profit</div><div class="value">${money(r.ytdProfit)}</div><div class="hint">Fee minus linked job costs</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">Tax pot target · ${rate}%</div><div class="value">${money(r.ytdTarget)}</div><div class="hint">Running target for this tax year</div></div>
      </div>

      <div class="section-title"><div><h2>Monthly income & expenses report</h2><p>Choose a month to see what came in, what went out, and what should be reserved.</p></div><div class="row-actions"><input id="reportMonth15" type="month" value="${r.month}" style="min-width:160px"><button class="btn secondary" id="downloadMonth15">Download CSV</button></div></div>
      <div class="tax-hero">
        <div class="card"><div class="label muted">RESERVE FOR ${monthLabel15(r.month).toUpperCase()}</div><div class="tax-big">${money(r.taxPot)}</div><div class="tax-meta">${rate}% of each paid job's fee after expenses linked to that job.</div><div class="kpi-row"><span>Paid job fees</span><strong>${money(r.fee)}</strong></div><div class="kpi-row"><span>Costs linked to those jobs</span><strong>− ${money(r.jobExpenses)}</strong></div><div class="kpi-row"><span>Job profit</span><strong>${money(r.profit)}</strong></div><div class="kpi-row"><span>Usable after ${rate}% reserve</span><strong>${money(r.usable)}</strong></div></div>
        <div class="card"><div class="label muted">RUNNING TAX POT TARGET · ${r.ty}</div><div class="tax-big">${money(r.ytdTarget)}</div><div class="tax-meta">Target accumulated from paid jobs up to ${fmtDate(r.asOf)}.</div><div class="kpi-row"><span>Actually in tax pot</span><strong>${money(r.balance)}</strong></div><div class="kpi-row"><span>Top-up needed</span><strong>${money(r.topUp)}</strong></div><div class="field" style="margin-top:14px"><label>Current tax pot bank balance (£)</label><input id="taxPotBalance15" type="number" min="0" step="0.01" value="${Number(state.settings.taxPotBalance||0)}"></div><button class="btn small" id="saveTaxPotBalance15" style="margin-top:8px">Update balance</button></div>
      </div>

      <div class="grid cards" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:14px">
        <div class="card stat"><div class="label">All expenses paid this month</div><div class="value">${money(r.expensesPaidTotal)}</div><div class="hint">Linked ${money(r.linkedPaid)} · general ${money(r.unlinkedPaid)}</div></div>
        <div class="card stat"><div class="label">Cash after month expenses + reserve</div><div class="value">${money(r.cashAfter)}</div><div class="hint">Cashflow view only; general expenses do not alter the ${rate}% tax split</div></div>
        <div class="card stat"><div class="label">Usable share of job profit</div><div class="value">${money(r.usable)}</div><div class="hint">${usablePct}% after linked job costs</div></div>
      </div>

      <div class="section-title"><div><h2>${monthLabel15(r.month)} paid jobs</h2><p>The reserve is calculated job-by-job: fee − expenses linked to that job, then ${rate}% to the Tax pot.</p></div></div>
      ${r.rows.length?`<div class="table-wrap"><table><thead><tr><th>Job</th><th>Fee</th><th>Linked expenses</th><th>Profit</th><th>Tax pot</th><th>Usable</th></tr></thead><tbody>${jobRows}</tbody></table></div>`:empty('No jobs were marked Paid in this month.')}

      <div class="section-title"><div><h2>Reserve settings</h2></div></div>
      <div class="card"><div class="form-grid"><div class="field"><label>Tax pot percentage</label><input id="reserveRate15" type="number" min="0" max="100" step="0.1" value="${rate}"></div><div class="field"><div class="hint-box" style="margin-top:17px"><strong>General expenses do not reduce this reserve.</strong> Only expenses explicitly linked to a job are deducted from that job's fee before the percentage is applied.</div></div></div><div class="form-actions"><button class="btn" id="saveReserveRate15">Save percentage</button></div></div>`;

    $('#reportMonth15').onchange=e=>{reportMonth15=e.target.value||TODAY().slice(0,7);renderTax()};
    $('#saveReserveRate15').onclick=async()=>{state.settings.reservePercent=Math.max(0,Math.min(100,Number($('#reserveRate15').value||0)));await saveState();renderTax();toast('Tax pot percentage saved')};
    $('#saveTaxPotBalance15').onclick=async()=>{state.settings.taxPotBalance=Math.max(0,Number($('#taxPotBalance15').value||0));await saveState();renderTax();toast('Tax pot balance updated')};
    $('#downloadMonth15').onclick=()=>downloadMonthlyReport15(r);
  };

  function downloadMonthlyReport15(r){
    const rows=[['Monthly Chip In report',monthLabel15(r.month)],[],['Paid job fees',r.fee],['Costs linked to those paid jobs',r.jobExpenses],['Paid-job profit',r.profit],[`Tax reserve (${r.rate}%)`,r.taxPot],['Usable job income after reserve',r.usable],[],['All expenses paid in month',r.expensesPaidTotal],['Linked expenses paid in month',r.linkedPaid],['General/unlinked expenses paid in month',r.unlinkedPaid],['Cash after expenses paid + reserve',r.cashAfter],[],[`Running tax pot target ${r.ty}`,r.ytdTarget],['Current tax pot balance',r.balance],['Top-up needed',r.topUp],[],['Job','Reference','Paid date','Fee','Linked expenses','Profit','Tax pot','Usable'],...r.rows.map(x=>[x.job.title,x.job.reference,x.paidDate,x.fee,x.expenses,x.profit,x.taxPot,x.usable])];
    downloadBlob(new Blob([makeCSV(rows)],{type:'text/csv;charset=utf-8'}),`chip-in-monthly-report-${r.month}.csv`);
  }

  createTaxPack=async function(){
    if(!window.JSZip){toast('ZIP library did not load. Try again online.');return}
    toast('Building tax pack…');
    const zip=new JSZip(),ty=taxYearForDate(),[start,end]=taxYearBounds(ty),t=calcTax(ty),rows=paidJobRows15(start,end);
    const jobs=[['Job','Reference','Paid date','Fee','Linked expenses','Profit','Tax pot','Usable'],...rows.map(x=>[x.job.title,x.job.reference,x.paidDate,x.fee,x.expenses,x.profit,x.taxPot,x.usable])];
    const expenses=[['Date','Supplier','Description','Category','Amount','Linked job','Receipt'],...state.expenses.filter(e=>inRange(e.date,start,end)).map(e=>[e.date,e.supplier,e.description,e.category,e.amount,jobById(e.jobId)?.title||'',e.receiptName])];
    zip.file('paid-job-profit.csv',makeCSV(jobs));zip.file('expenses.csv',makeCSV(expenses));
    zip.file('tax-pot-summary.txt',`Chip In HQ reserve summary — ${ty}\nGenerated: ${new Date().toLocaleString('en-GB')}\n\nPaid job fees: ${money(t.gross)}\nExpenses linked to those jobs: ${money(t.allowable)}\nPaid-job profit: ${money(t.profit)}\nTax pot percentage: ${t.reservePercent}%\nTax pot target: ${money(t.taxPot)}\nUsable job income: ${money(t.usable)}\n\nCalculation is performed per paid job: total fee - expenses linked to that job, then ${t.reservePercent}% of positive job profit is allocated to the Tax pot. General/unlinked expenses are reported separately and do not reduce the Tax pot calculation.\n\nThis is a budgeting reserve, not an HMRC tax calculation.`);
    for(const e of state.expenses.filter(x=>inRange(x.date,start,end)&&x.receiptName)){const blob=await dbGet('receipts',e.id);if(blob)zip.file(`receipts/${e.date}-${e.id}-${e.receiptName}`,blob)}
    downloadBlob(await zip.generateAsync({type:'blob'}),`chip-in-tax-pack-${ty.replace('/','-')}.zip`);toast('Tax pack downloaded');
  };

  const baseJobForm15=jobForm;
  jobForm=function(j={}){
    let html=baseJobForm15(j);
    const marker='<div class="field"><label>Rate type</label>';
    if(html.includes('name="startTime"'))return html;
    const times=`<div class="field"><label>Start time (optional)</label><input type="time" name="startTime" value="${esc(j.startTime||'')}"></div><div class="field"><label>End time (optional)</label><input type="time" name="endTime" value="${esc(j.endTime||'')}"></div>`;
    return html.replace(marker,times+marker);
  };

  jobRows=function(rows){return rows.map(j=>{const c=clientById(j.clientId),canComplete=['Booked','In progress'].includes(j.status),time=j.startTime?`<div class="muted">${esc(j.startTime)}${j.endTime?'–'+esc(j.endTime):''}</div>`:'';return `<tr><td><strong class="mono">${esc(j.reference||'—')}</strong><div><strong>${esc(j.title)}</strong></div><div class="muted">${esc(j.category||'General')}${j.customerReference?` · Customer ref: ${esc(j.customerReference)}`:''}</div></td><td>${esc(c?.name||'—')}</td><td>${fmtDate(j.startDate)}${j.endDate&&j.endDate!==j.startDate?' – '+fmtDate(j.endDate):''}${time}</td><td>${money(j.amount)}${chipInBasisText(j)?`<div class="muted">${esc(chipInBasisText(j))}</div>`:''}</td><td>${statusBadge(j.status)}</td><td class="right"><div class="row-actions">${j.status==='Complete'&&!state.invoices.some(i=>i.jobId===j.id)?`<button class="btn small gold" data-action="invoice-job" data-id="${j.id}">Invoice</button>`:''}${canComplete?`<button class="btn small secondary" data-action="complete-job" data-id="${j.id}">Complete</button>`:''}<button class="btn small secondary" data-action="add-prep-job" data-id="${j.id}">Prep</button><button class="btn small secondary" data-action="edit-job" data-id="${j.id}">Edit</button><button class="icon-btn" data-action="delete-job" data-id="${j.id}">×</button></div></td></tr>`}).join('')};

  function prepById15(id){return (state.prepBlocks||[]).find(x=>x.id===id)}
  function openPrep15(id,jobId,date){
    const p=id?prepById15(id):{},jobs=(state.jobs||[]).filter(j=>j.status!=='Cancelled').sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||'')),chosen=jobId||p.jobId||jobs[0]?.id||'';
    if(!jobs.length){toast('Create a job before adding prep time.');return}
    openModal(`<h2>${id?'Edit':'Add'} prep time</h2><p class="sub">Block out preparation time for a specific job. This is planning time only and does not alter the job fee.</p><form id="prepForm15"><div class="form-grid"><div class="field full"><label>Job</label><select name="jobId" required>${jobs.map(j=>`<option value="${j.id}" ${chosen===j.id?'selected':''}>${esc(j.title)} · ${fmtDate(j.startDate)}</option>`).join('')}</select></div><div class="field"><label>Date</label><input type="date" name="date" required value="${p.date||date||TODAY()}"></div><div class="field"><label>Start time</label><input type="time" name="startTime" value="${p.startTime||'09:00'}"></div><div class="field"><label>Duration (hours)</label><input type="number" min="0.25" step="0.25" name="duration" value="${p.duration??4}"></div><div class="field"><label>Label</label><input name="label" value="${esc(p.label||'Prep')}" placeholder="Prep"></div><div class="field full"><label>Notes</label><textarea name="notes" placeholder="Write quiz, edit video, collect equipment…">${esc(p.notes||'')}</textarea></div></div><div class="form-actions">${id?`<button class="btn danger" type="button" id="deletePrep15">Delete prep</button>`:''}<button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">Save prep</button></div></form>`,true);
    $('#prepForm15').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());v.duration=Number(v.duration||0);if(id)Object.assign(p,v);else(state.prepBlocks||(state.prepBlocks=[])).push({id:uid('prep'),...v,createdAt:new Date().toISOString()});await saveState();closeModal();render();toast('Prep time saved')};
    if($('#deletePrep15'))$('#deletePrep15').onclick=async()=>{state.prepBlocks=state.prepBlocks.filter(x=>x.id!==id);await saveState();closeModal();render();toast('Prep time removed')};
  }

  const baseHandleAction15=handleAction;
  handleAction=async function(action,id){
    if(action==='add-prep'){openPrep15(null,null);return}
    if(action==='add-prep-job'){openPrep15(null,id);return}
    if(action==='edit-prep'){openPrep15(id);return}
    return baseHandleAction15(action,id);
  };

  let calendarMonth15=TODAY().slice(0,7);
  function localDateKey15(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function monthKey15(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function calendarDates15(month){
    const [y,m]=month.split('-').map(Number),first=new Date(y,m-1,1,12),offset=(first.getDay()+6)%7,start=new Date(y,m-1,1-offset,12),days=[];
    for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(localDateKey15(d))}
    return days;
  }
  function jobsOn15(date){return (state.jobs||[]).filter(j=>j.status!=='Cancelled'&&j.startDate&&date>=j.startDate&&date<=(j.endDate||j.startDate))}
  function prepOn15(date){return (state.prepBlocks||[]).filter(p=>p.date===date)}
  function calendarHTML15(){
    const dates=calendarDates15(calendarMonth15),today=TODAY(),days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const cells=dates.map(date=>{const inMonth=date.slice(0,7)===calendarMonth15,jobs=jobsOn15(date),preps=prepOn15(date),events=[...jobs.map(j=>`<button class="cal-event15 job" data-action="edit-job" data-id="${j.id}" title="${esc(j.title)}">${j.startTime&&date===j.startDate?`<span>${esc(j.startTime)}</span> `:''}${esc(j.title)}</button>`),...preps.map(p=>`<button class="cal-event15 prep" data-action="edit-prep" data-id="${p.id}" title="${esc(p.notes||p.label||'Prep')}"><span>${esc(p.startTime||'')}</span> ${esc(p.label||'Prep')} · ${esc(jobById(p.jobId)?.title||'Job')}</button>`)].join('');return `<div class="cal-day15 ${inMonth?'':'other'} ${date===today?'today':''}"><div class="cal-date15">${Number(date.slice(-2))}</div>${events}</div>`}).join('');
    return `<div class="calendar15"><div class="cal-week15">${days.map(d=>`<div>${d}</div>`).join('')}</div><div class="cal-grid15">${cells}</div></div>`;
  }

  const baseRenderDashboard15=renderDashboard;
  renderDashboard=function(){
    baseRenderDashboard15();
    const t=calcTax(taxYearForDate()),existing=$('#dashboardCalendar15');
    $$('.card.stat .label').forEach(el=>{if(el.textContent.includes('Allowable expenses'))el.textContent='Job-linked costs';if(el.textContent.includes('Income received'))el.textContent=`Paid job fees · ${taxYearForDate()}`});
    $$('.card.stat .hint').forEach(el=>{if(el.textContent.includes('Recorded this tax year'))el.textContent='Costs attached to paid jobs'});
    if(existing)existing.remove();
    const wrap=document.createElement('div');wrap.id='dashboardCalendar15';wrap.innerHTML=`<div class="section-title"><div><h2>Work calendar</h2><p>Booked jobs appear automatically. Add prep blocks wherever you need time before a job.</p></div><div class="row-actions"><button class="btn secondary" id="calPrev15">←</button><strong id="calTitle15">${monthLabel15(calendarMonth15)}</strong><button class="btn secondary" id="calNext15">→</button><button class="btn" data-action="add-prep">+ Prep time</button></div></div>${calendarHTML15()}<div class="hint-box" style="margin-top:10px"><strong>Tax pot target so far:</strong> ${money(t.taxPot)} at ${t.reservePercent}%. Prep blocks are scheduling only and do not change job profit.</div>`;
    $('#content').appendChild(wrap);wirePageActions();
    $('#calPrev15').onclick=()=>{const [y,m]=calendarMonth15.split('-').map(Number),d=new Date(y,m-2,1);calendarMonth15=monthKey15(d);renderDashboard()};
    $('#calNext15').onclick=()=>{const [y,m]=calendarMonth15.split('-').map(Number),d=new Date(y,m,1);calendarMonth15=monthKey15(d);renderDashboard()};
  };

  const style=document.createElement('style');style.textContent=`
    .calendar15{background:var(--card,#fff);border:1px solid var(--line);border-radius:14px;overflow:hidden}
    .cal-week15,.cal-grid15{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.cal-week15>div{padding:8px 6px;text-align:center;font-size:11px;font-weight:700;color:var(--muted);background:#f6f7f9;border-bottom:1px solid var(--line)}
    .cal-day15{min-height:112px;padding:7px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:#fff;overflow:hidden}.cal-day15:nth-child(7n){border-right:0}.cal-day15.other{background:#f8f9fb;color:#9aa1ac}.cal-day15.today{box-shadow:inset 0 0 0 2px var(--gold,#d4a62a)}.cal-date15{font-size:12px;font-weight:700;margin-bottom:5px}
    .cal-event15{display:block;width:100%;border:0;border-radius:6px;padding:4px 5px;margin:3px 0;text-align:left;font-size:10px;line-height:1.25;cursor:pointer;white-space:normal}.cal-event15.job{background:#e9f0f8;color:#0a2f57}.cal-event15.prep{background:#fff4cf;color:#5b4610}.cal-event15 span{font-weight:700}
    @media(max-width:800px){.cal-day15{min-height:88px;padding:4px}.cal-event15{font-size:9px;padding:3px}.cal-week15>div{font-size:9px;padding:6px 2px}}
  `;document.head.appendChild(style);
})();
