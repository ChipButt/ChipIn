// Chip In HQ desktop unlock resilience, locked-sync safety, and paid-job tax consistency
(function(){
  function chipInStorageLockedStatus(){
    return localStorage.getItem(CRED_KEY)?'Saved locally · private storage locked':'Saved locally · private storage not linked';
  }

  // Never let a local save fail/noise just because private storage is currently locked.
  const chipInBaseSyncGh13=syncGh;
  syncGh=async function(){
    if(!ghUnlocked||!ghToken){setGhStatus(chipInStorageLockedStatus(),'warn');return;}
    return chipInBaseSyncGh13();
  };
  scheduleGh=function(){
    clearTimeout(ghTimer);
    if(!ghUnlocked||!ghToken){setGhStatus(chipInStorageLockedStatus(),'warn');return;}
    ghTimer=setTimeout(()=>syncGh().catch(e=>{
      console.error(e);
      setGhStatus('Saved locally · sync needs attention','bad');
      toast('Saved locally. Private sync needs attention.');
    }),800);
  };

  // A valid passphrase must always unlock the local app, even if the saved GitHub token
  // has expired or the network/private repository is temporarily unavailable.
  unlockGh=async function(pass){
    const c=localStorage.getItem(CRED_KEY);
    if(!c)throw Error('This device is not connected yet. Use “Relink this device” below.');
    let token='';
    try{token=await openText(c,pass)}catch{throw Error('That passphrase does not match this device. If it works on another device, use “Relink this device” below.');}
    ghPass=pass;
    try{
      await checkToken(token);
      ghToken=token;ghUnlocked=true;
      setGhStatus('Private storage connected','ok');
      try{await reconcileGh()}catch(err){
        console.error(err);
        ghToken='';ghUnlocked=false;
        setGhStatus('Local mode · private storage needs relinking','warn');
        return {localOnly:true,message:err.message};
      }
      return {localOnly:false};
    }catch(err){
      console.error(err);
      ghToken='';ghUnlocked=false;
      setGhStatus('Local mode · private storage needs relinking','warn');
      return {localOnly:true,message:err.message};
    }
  };

  unlockBox=function(){
    openModal(`<h2>Unlock Chip In HQ</h2>
      <p class="sub">Enter your Chip In HQ passphrase. Your local records will open even if private sync needs reconnecting.</p>
      <form id="ghUnlock"><div class="field"><label>Passphrase</label><input name="pass" type="password" autocomplete="current-password" required autofocus></div>
      <div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Use local copy only</button><button class="btn secondary" type="button" id="relinkDevice">Relink this device</button><button class="btn gold" type="submit">Unlock</button></div></form>`);
    $('#relinkDevice').onclick=()=>setupGh();
    $('#ghUnlock').onsubmit=async e=>{
      e.preventDefault();
      const p=String(new FormData(e.target).get('pass')||''),b=e.target.querySelector('[type=submit]');
      b.disabled=true;b.textContent='Unlocking…';
      try{
        const result=await unlockGh(p);
        closeModal();render();
        if(!state.settings.setupComplete)setTimeout(chipInAllowBusinessSetup,100);
        toast(result?.localOnly?'Unlocked locally. Relink private storage to resume sync.':'Private storage unlocked');
      }catch(err){b.disabled=false;b.textContent='Unlock';toast(err.message)}
    };
  };

  // Show/retain a payment received date when a job is marked Paid.
  const chipInBaseJobForm13=jobForm;
  jobForm=function(j={}){
    let html=chipInBaseJobForm13(j);
    const marker='<div class="field full"><label>Invoice description</label>';
    const paidDate=`<div class="field paid-date-field" style="${j.status==='Paid'?'':'display:none'}"><label>Payment received date</label><input type="date" name="paidDate" value="${esc(j.paidDate||TODAY())}"><div class="rate-source">Used for cash-basis tax figures when this job is paid.</div></div><div class="field paid-date-field" style="${j.status==='Paid'?'':'display:none'}"><div class="hint-box" style="margin-top:17px">If this job has a linked invoice, marking it Paid will record any remaining invoice balance as received on this date.</div></div>`;
    return html.replace(marker,paidDate+marker);
  };

  const chipInBaseBindJobPricing13=chipInBindJobPricing;
  chipInBindJobPricing=function(j){
    chipInBaseBindJobPricing13(j);
    const form=$('#jobForm');if(!form)return;
    const status=$('[name="status"]',form),paidDate=$('[name="paidDate"]',form);
    const toggle=()=>{$$('.paid-date-field',form).forEach(x=>x.style.display=status.value==='Paid'?'flex':'none');if(status.value==='Paid'&&paidDate&&!paidDate.value)paidDate.value=TODAY()};
    if(status){const prior=status.onchange;status.onchange=e=>{if(prior)prior.call(status,e);toggle()};toggle()}
  };

  function chipInLinkedInvoicesForJob(jobId){return (state.invoices||[]).filter(i=>i.jobId===jobId)}
  function chipInEnsurePaidJobReceipt(j){
    if(!j||j.status!=='Paid')return false;
    j.paidDate=j.paidDate||TODAY();
    j.paidAmount=Number(j.amount||0);
    let changed=false;
    for(const inv of chipInLinkedInvoicesForJob(j.id)){
      const remaining=outstanding(inv);
      if(remaining>.005){
        inv.payments=inv.payments||[];
        inv.payments.push({id:uid('pay'),date:j.paidDate,amount:remaining,note:'Recorded when linked job was marked Paid'});
        inv.status='Paid';
        changed=true;
      }else if(inv.status!=='Paid'){
        inv.status='Paid';changed=true;
      }
    }
    return changed;
  }

  const chipInBaseOpenJobForm13=openJobForm;
  openJobForm=function(id){
    chipInBaseOpenJobForm13(id);
    const form=$('#jobForm');if(!form)return;
    const oldSubmit=form.onsubmit;
    form.onsubmit=async e=>{
      const desiredStatus=$('[name="status"]',form)?.value||'',paidDate=$('[name="paidDate"]',form)?.value||TODAY();
      const before=id?jobById(id):null,wasPaid=before?.status==='Paid';
      await oldSubmit(e);
      let j=id?jobById(id):state.jobs[state.jobs.length-1];
      if(j&&desiredStatus==='Paid'){
        j.paidDate=paidDate;j.paidAmount=Number(j.amount||0);
        const invoiceChanged=chipInEnsurePaidJobReceipt(j);
        if(!wasPaid||invoiceChanged){await saveState();render();toast(invoiceChanged?'Job marked paid · linked invoice payment recorded':'Job marked paid · tax figures updated')}
      }
    };
  };

  // Cash-basis gross receipts: count explicit invoice payments first, then top up any
  // Paid job that has no/full recorded receipt so manually-paid jobs are not omitted.
  const chipInBaseCalcTax13=calcTax;
  calcTax=function(label=taxYearForDate()){
    const base=chipInBaseCalcTax13(label),[start,end]=taxYearBounds(label);
    let invoiceGross=0;
    for(const inv of state.invoices||[])for(const p of inv.payments||[])if(inRange(p.date,start,end))invoiceGross+=Number(p.amount||0);
    let fallbackGross=0;
    for(const j of state.jobs||[]){
      if(j.status!=='Paid')continue;
      const paidDate=j.paidDate||j.endDate||j.startDate;
      if(!inRange(paidDate,start,end))continue;
      const linked=chipInLinkedInvoicesForJob(j.id);
      if(!linked.length){fallbackGross+=Number(j.paidAmount??j.amount??0);continue;}
      const invoiceTotal=linked.reduce((s,i)=>s+invoiceTotals(i).total,0);
      const recordedAll=linked.reduce((s,i)=>s+paymentsTotal(i),0);
      if(recordedAll+0.005<invoiceTotal)fallbackGross+=Math.max(0,invoiceTotal-recordedAll);
    }
    const gross=invoiceGross+fallbackGross;
    const allowable=base.allowable;
    const method=state.settings.useTradingAllowance;
    const useAllowance=method==='allowance'||(method==='auto'&&allowable<1000);
    const deductible=useAllowance?Math.min(1000,gross):allowable;
    const seProfit=Math.max(0,gross-deductible);
    const employment=Number(state.settings.employmentIncome||0),payePaid=Number(state.settings.payeTaxPaid||0),totalIncome=employment+seProfit;
    let pa=12570;if(totalIncome>100000)pa=Math.max(0,12570-(totalIncome-100000)/2);
    const taxable=Math.max(0,totalIncome-pa);let incomeTax=0;
    if(state.settings.taxRegion==='england_wales_ni'){
      incomeTax+=Math.min(taxable,37700)*.20;incomeTax+=Math.min(Math.max(taxable-37700,0),87440)*.40;incomeTax+=Math.max(taxable-125140,0)*.45;
    }else{
      const bands=[[3967,.19],[12989,.20],[14136,.21],[31338,.42],[62710,.45],[Infinity,.48]];let rem=taxable;
      for(const [width,rate] of bands){const part=Math.min(rem,width);if(part>0)incomeTax+=part*rate;rem-=part;if(rem<=0)break}
    }
    const class4=Math.min(Math.max(seProfit-12570,0),37700)*.06+Math.max(seProfit-50270,0)*.02;
    const estimatedDue=Math.max(0,incomeTax-payePaid)+class4;
    return{...base,gross,invoiceGross,paidJobFallbackGross:fallbackGross,deductible,useAllowance,seProfit,totalIncome,pa,taxable,incomeTax,class4,payePaid,estimatedDue};
  };
})();
