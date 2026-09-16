// Chip In HQ simple profit split: reserve a chosen percentage of profit for tax.
(function(){
  function chipInReserveRate(){
    const n=Number(state.settings.reservePercent);
    return Math.max(0,Math.min(100,Number.isFinite(n)?n:25));
  }
  function chipInLinkedInvoices14(jobId){return (state.invoices||[]).filter(i=>i.jobId===jobId)}
  function chipInPaidJobFallback14(j,start,end){
    if(!j||j.status!=='Paid')return 0;
    const paidDate=j.paidDate||j.endDate||j.startDate;
    if(!inRange(paidDate,start,end))return 0;
    const linked=chipInLinkedInvoices14(j.id);
    if(!linked.length)return Number(j.paidAmount??j.amount??0);
    const total=linked.reduce((s,i)=>s+invoiceTotals(i).total,0);
    const recorded=linked.reduce((s,i)=>s+paymentsTotal(i),0);
    return Math.max(0,total-recorded);
  }
  function chipInIncomeForJob14(j,start,end){
    const linked=chipInLinkedInvoices14(j.id);
    let received=0;
    for(const inv of linked)for(const p of inv.payments||[])if(inRange(p.date,start,end))received+=Number(p.amount||0);
    received+=chipInPaidJobFallback14(j,start,end);
    return received;
  }
  function chipInProfitRows14(label){
    const [start,end]=taxYearBounds(label),rate=chipInReserveRate(),rows=[];
    for(const j of state.jobs||[]){
      const income=chipInIncomeForJob14(j,start,end);
      const expenses=(state.expenses||[]).filter(e=>e.jobId===j.id&&e.allowable!==false&&inRange(e.date,start,end)).reduce((s,e)=>s+Number(e.amount||0),0);
      if(!income&&!expenses)continue;
      const profit=income-expenses,taxPot=Math.max(0,profit)*rate/100;
      rows.push({job:j,income,expenses,profit,taxPot,usable:profit-taxPot});
    }
    return rows.sort((a,b)=>(b.job.paidDate||b.job.endDate||b.job.startDate||'').localeCompare(a.job.paidDate||a.job.endDate||a.job.startDate||''));
  }

  calcTax=function(label=taxYearForDate()){
    const [start,end]=taxYearBounds(label),rate=chipInReserveRate();
    let invoiceGross=0;
    for(const inv of state.invoices||[])for(const p of inv.payments||[])if(inRange(p.date,start,end))invoiceGross+=Number(p.amount||0);
    let paidJobFallbackGross=0;
    for(const j of state.jobs||[])paidJobFallbackGross+=chipInPaidJobFallback14(j,start,end);
    const gross=invoiceGross+paidJobFallbackGross;
    const allowable=(state.expenses||[]).filter(e=>e.allowable!==false&&inRange(e.date,start,end)).reduce((s,e)=>s+Number(e.amount||0),0);
    const profit=gross-allowable,taxPot=Math.max(0,profit)*rate/100,usable=profit-taxPot;
    return{
      gross,invoiceGross,paidJobFallbackGross,allowable,deductible:allowable,useAllowance:false,
      profit,seProfit:profit,reservePercent:rate,taxPot,usable,
      estimatedDue:taxPot,incomeTax:taxPot,class4:0,payePaid:0
    };
  };

  dashboardNumbers=function(){
    const ty=taxYearForDate(),t=calcTax(ty),out=(state.invoices||[]).reduce((s,i)=>s+outstanding(i),0);
    return{ty,income:t.gross,expenses:t.allowable,profit:t.profit,out};
  };

  const chipInBaseRenderDashboard14=renderDashboard;
  renderDashboard=function(){
    chipInBaseRenderDashboard14();
    const rate=chipInReserveRate();
    $$('.card.stat .label').forEach(el=>{if(el.textContent.trim()==='Estimated tax + NI')el.textContent=`Tax pot · ${rate}%`});
    $$('.card.stat .hint').forEach(el=>{if(el.textContent.includes('Estimate only'))el.textContent='Your chosen share of business profit'});
  };

  renderTax=function(){
    const ty=taxYearForDate(),t=calcTax(ty),[start,end]=taxYearBounds(ty),rate=t.reservePercent,rows=chipInProfitRows14(ty);
    const linkedExpenseTotal=rows.reduce((s,r)=>s+r.expenses,0),unlinkedExpenses=Math.max(0,t.allowable-linkedExpenseTotal);
    const jobIncome=rows.reduce((s,r)=>s+r.income,0),otherIncome=Math.max(0,t.gross-jobIncome);
    const splitLabel=rate===25?'75%':`${Math.max(0,100-rate)}%`;
    const detailRows=rows.map(r=>`<tr><td><strong>${esc(r.job.title||'Job')}</strong><div class="muted">${esc(r.job.reference||'')}</div></td><td>${money(r.income)}</td><td>${money(r.expenses)}</td><td><strong>${money(r.profit)}</strong></td><td>${money(r.taxPot)}</td><td><strong>${money(r.usable)}</strong></td></tr>`).join('');
    $('#content').innerHTML=`
      <div class="grid cards" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="card stat"><div class="accent-bar"></div><div class="label">Money received · ${ty}</div><div class="value">${money(t.gross)}</div><div class="hint">Cash received from paid work</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">Business expenses</div><div class="value">${money(t.allowable)}</div><div class="hint">Recorded allowable spending</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">Profit</div><div class="value">${money(t.profit)}</div><div class="hint">Received minus business expenses</div></div>
      </div>
      <div class="tax-hero" style="margin-top:14px">
        <div class="card"><div class="label muted">TAX POT · ${rate}% OF PROFIT</div><div class="tax-big">${money(t.taxPot)}</div><div class="tax-meta">This is the amount Chip In suggests moving aside based only on your chosen percentage.</div></div>
        <div class="card"><div class="label muted">USABLE INCOME · ${splitLabel} OF POSITIVE PROFIT</div><div class="tax-big">${money(t.usable)}</div><div class="tax-meta">Profit left after the tax-pot share. If the business is making a loss, no tax-pot amount is created.</div></div>
      </div>
      <div class="section-title"><div><h2>Simple split</h2><p>For ${fmtDate(start)} to ${fmtDate(end)}: money received − allowable business expenses = profit. ${rate}% of positive profit goes to the Tax pot; the rest is usable income.</p></div></div>
      <div class="card"><div class="form-grid"><div class="field"><label>Tax pot percentage</label><input id="simpleTaxRate" type="number" min="0" max="100" step="0.1" value="${rate}"><div class="rate-source">This is a budgeting percentage, not an HMRC tax calculation.</div></div><div class="field"><div class="hint-box" style="margin-top:17px"><strong>${money(t.profit)}</strong> profit × <strong>${rate}%</strong> = <strong>${money(t.taxPot)}</strong> Tax pot.</div></div></div><div class="form-actions"><button class="btn" id="saveSimpleTaxRate">Save percentage</button></div></div>
      <div class="section-title"><div><h2>Profit by job</h2><p>Linked expenses are deducted from the money received for each job.</p></div></div>
      ${rows.length?`<div class="table-wrap"><table><thead><tr><th>Job</th><th>Received</th><th>Expenses</th><th>Profit</th><th>Tax pot</th><th>Usable</th></tr></thead><tbody>${detailRows}</tbody>${(unlinkedExpenses>0||otherIncome>0)?`<tfoot><tr><td><strong>Unlinked / general business</strong></td><td>${money(otherIncome)}</td><td>${money(unlinkedExpenses)}</td><td colspan="3" class="muted">Included in the overall totals above</td></tr></tfoot>`:''}</table></div>`:empty('Paid jobs and linked expenses will appear here.')}
      <div class="warning-box" style="margin-top:14px"><strong>Tax pot is a budgeting tool.</strong> Chip In is deliberately not estimating your actual Income Tax or National Insurance here. Your eventual HMRC bill may be higher or lower than this percentage.</div>`;
    $('#saveSimpleTaxRate').onclick=async()=>{
      state.settings.reservePercent=Math.max(0,Math.min(100,Number($('#simpleTaxRate').value||0)));
      await saveState();renderTax();toast('Tax pot percentage saved');
    };
  };

  const chipInBaseRenderSettings14=renderSettings;
  renderSettings=function(){
    chipInBaseRenderSettings14();
    $$('h2').forEach(h=>{if(h.textContent.trim()==='Tax assumptions')h.textContent='Tax pot'});
    $$('label').forEach(l=>{
      const text=l.textContent.trim();
      if(text==='Suggested reserve %')l.textContent='Tax pot percentage';
      if(text==='Income Tax region')l.closest('.field')?.remove();
    });
  };

  createTaxPack=async function(){
    if(!window.JSZip){toast('ZIP library did not load. Try again online.');return}
    toast('Building tax pack…');
    const zip=new JSZip(),ty=taxYearForDate(),[start,end]=taxYearBounds(ty),t=calcTax(ty),rows=chipInProfitRows14(ty);
    const clients=[['Name','Contact','Email','Phone','Address'],...state.clients.map(c=>[c.name,c.contact,c.email,c.phone,c.address])];
    const invoices=[['Invoice','Client','Issue date','Due date','Status','Total','Paid'],...state.invoices.map(i=>[i.number,clientById(i.clientId)?.name,i.issueDate,i.dueDate,invoiceStatus(i),invoiceTotals(i).total,paymentsTotal(i)])];
    const expenses=[['Date','Supplier','Description','Category','Amount','Allowable','Job','Receipt'],...state.expenses.filter(e=>inRange(e.date,start,end)).map(e=>[e.date,e.supplier,e.description,e.category,e.amount,e.allowable!==false,jobById(e.jobId)?.title||'',e.receiptName])];
    const profitRows=[['Job','Reference','Received','Linked allowable expenses','Profit','Tax pot','Usable income'],...rows.map(r=>[r.job.title,r.job.reference,r.income,r.expenses,r.profit,r.taxPot,r.usable])];
    zip.file('clients.csv',makeCSV(clients));zip.file('invoices.csv',makeCSV(invoices));zip.file('expenses.csv',makeCSV(expenses));zip.file('profit-by-job.csv',makeCSV(profitRows));
    zip.file('tax-pot-summary.txt',`Chip In HQ simple profit split — ${ty}\nGenerated: ${new Date().toLocaleString('en-GB')}\n\nMoney received: ${money(t.gross)}\nAllowable business expenses: ${money(t.allowable)}\nProfit: ${money(t.profit)}\nTax pot percentage: ${t.reservePercent}%\nTax pot target: ${money(t.taxPot)}\nUsable income: ${money(t.usable)}\n\nCalculation: money received - allowable business expenses = profit. ${t.reservePercent}% of positive profit is reserved to the Tax pot.\n\nThis is a budgeting split, not an estimate of the tax or National Insurance actually due to HMRC.`);
    for(const e of state.expenses.filter(x=>inRange(x.date,start,end)&&x.receiptName)){const blob=await dbGet('receipts',e.id);if(blob)zip.file(`receipts/${e.date}-${e.id}-${e.receiptName}`,blob)}
    downloadBlob(await zip.generateAsync({type:'blob'}),`chip-in-tax-pack-${ty.replace('/','-')}.zip`);toast('Tax pack downloaded');
  };
})();
