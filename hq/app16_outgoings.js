// Chip In HQ personal monthly outgoings tracker.
// Personal figures live in encrypted/local state; they are never hard-coded in the public repository.
(function(){
  DEFAULT_STATE.outgoings=DEFAULT_STATE.outgoings||[];
  DEFAULT_STATE.monthlyEarningsRecords=DEFAULT_STATE.monthlyEarningsRecords||{};
  if(!state.outgoings)state.outgoings=[];
  if(!state.monthlyEarningsRecords||Array.isArray(state.monthlyEarningsRecords))state.monthlyEarningsRecords={};
  const OUTGOINGS_SEED_VERSION='april-2024-v1';
  let outgoingsSeedLoading16=false;

  if(!NAV.some(x=>x[0]==='outgoings')){
    const taxIndex=NAV.findIndex(x=>x[0]==='tax');
    NAV.splice(taxIndex<0?NAV.length:taxIndex,0,['outgoings','↓','Outgoings']);
  }
  PAGE_META.outgoings=['Outgoings','Track personal monthly commitments and see how much usable Chip In income still needs to cover them.'];

  function outgoings16(){return Array.isArray(state.outgoings)?state.outgoings:[]}
  function outgoingById16(id){return outgoings16().find(x=>x.id===id)}
  function amount16(v){const n=Number(String(v??'').replace(/[£,\s]/g,''));return Number.isFinite(n)?n:0}
  function activeOutgoings16(){return outgoings16().filter(x=>x.active!==false)}
  function totalOutgoings16(){return activeOutgoings16().reduce((s,x)=>s+Number(x.amount||0),0)}
  function groups16(){
    const order=[],seen=new Set();
    for(const x of outgoings16()){
      const g=String(x.group||'Other').trim()||'Other';
      if(!seen.has(g)){seen.add(g);order.push(g)}
    }
    return order;
  }
  function groupTotals16(){
    const map=new Map();
    for(const x of activeOutgoings16()){
      const g=String(x.group||'Other').trim()||'Other';
      map.set(g,(map.get(g)||0)+Number(x.amount||0));
    }
    return [...map.entries()].map(([group,total])=>({group,total}));
  }
  function monthBounds16(month){
    const [y,m]=String(month).split('-').map(Number),last=new Date(y,m,0).getDate();
    return[`${month}-01`,`${month}-${String(last).padStart(2,'0')}`];
  }
  function monthLabel16(month){return new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00'))}
  function reserveRate16(){const n=Number(state.settings.reservePercent);return Math.max(0,Math.min(100,Number.isFinite(n)?n:25))}
  function paidDate16(j){return j?.paidDate||j?.endDate||j?.startDate||''}
  function monthlyRecords16(){return state.monthlyEarningsRecords||(state.monthlyEarningsRecords={})}
  function syncCurrentMonthlyRecord16(){
    const month=TODAY().slice(0,7),records=monthlyRecords16(),target=totalOutgoings16(),rate=reserveRate16(),now=new Date().toISOString(),old=records[month];
    if(old&&Number(old.target)===target&&Number(old.reserveRate)===rate)return false;
    records[month]={month,target,reserveRate:rate,createdAt:old?.createdAt||now,updatedAt:now};
    return true;
  }
  function backfillRecentMonthlyRecords16(){
    const records=monthlyRecords16(),current=TODAY().slice(0,7),currentRec=records[current];
    if(!currentRec)return false;
    let changed=false;
    const paidMonths=new Set();
    for(const j of state.jobs||[]){
      if(j.status!=='Paid')continue;
      const d=paidDate16(j);
      if(/^\d{4}-\d{2}-\d{2}$/.test(d))paidMonths.add(d.slice(0,7));
    }
    for(const month of paidMonths){
      if(month>=current||records[month])continue;
      records[month]={
        month,
        target:Number(currentRec.target||0),
        reserveRate:Number(currentRec.reserveRate??reserveRate16()),
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
        backfilledFrom:current
      };
      changed=true;
    }
    return changed;
  }
  function usableIncomeMonthAtRate16(month,rate){
    const [start,end]=monthBounds16(month);let fee=0,jobCosts=0,profit=0,taxPot=0,usable=0,count=0;
    for(const j of state.jobs||[]){
      if(j.status!=='Paid'||!inRange(paidDate16(j),start,end))continue;
      const f=Number(j.paidAmount??j.amount??0),cost=(state.expenses||[]).filter(e=>e.jobId===j.id).reduce((s,e)=>s+Number(e.amount||0),0),p=f-cost,t=Math.max(0,p)*rate/100,u=p-t;
      fee+=f;jobCosts+=cost;profit+=p;taxPot+=t;usable+=u;count++;
    }
    return{month,start,end,rate,fee,jobCosts,profit,taxPot,usable,count};
  }
  function usableIncomeMonth16(month){
    return usableIncomeMonthAtRate16(month,reserveRate16());
  }
  function coverage16(month=TODAY().slice(0,7)){
    const income=usableIncomeMonth16(month),target=totalOutgoings16(),gap=Math.max(0,target-income.usable),surplus=Math.max(0,income.usable-target),usableShare=Math.max(0,1-income.rate/100),profitNeeded=gap<=0?0:(usableShare>0?gap/usableShare:Infinity),pct=target>0?Math.max(0,Math.min(100,income.usable/target*100)):100;
    return{...income,target,gap,surplus,profitNeeded,pct};
  }

  async function ensurePrivateOutgoings16(){
    if(outgoings16().length){
      if(!state.settings.outgoingsSeedVersion)state.settings.outgoingsSeedVersion='existing-data';
      return false;
    }
    if(state.settings.outgoingsSeedVersion||outgoingsSeedLoading16||!ghUnlocked)return false;
    outgoingsSeedLoading16=true;
    try{
      const f=await getFile('data/outgoings_seed.json');
      if(!f)return false;
      const seed=JSON.parse(f.text);
      if(seed.format!=='ChipInOutgoingsSeed'||!Array.isArray(seed.items))throw Error('Private outgoings baseline is not recognised.');
      state.outgoings=seed.items.map((x,i)=>({
        id:x.id||uid('out'),name:String(x.name||'').trim(),amount:Math.max(0,Number(x.amount||0)),group:String(x.group||'Other').trim()||'Other',
        notes:String(x.notes||''),dueDay:x.dueDay==null?null:Math.max(1,Math.min(31,Number(x.dueDay)||1)),active:x.active!==false,
        createdAt:x.createdAt||new Date().toISOString()
      })).filter(x=>x.name);
      state.settings.outgoingsSeedVersion=seed.version||OUTGOINGS_SEED_VERSION;
      state.settings.outgoingsLoadedAt=new Date().toISOString();
      syncCurrentMonthlyRecord16();
      await saveState();
      render();
      toast('Outgoings loaded from private ChipIn-Data');
      return true;
    }catch(err){console.error(err);toast('Could not load private outgoings baseline');return false}
    finally{outgoingsSeedLoading16=false}
  }

  function outgoingForm16(o={}){
    const known=groups16(),group=o.group||known[0]||'Essential Fixed';
    return `<h2>${o.id?'Edit':'Add'} outgoing</h2><p class="sub">This is a personal monthly outgoing. It does not alter business expenses or the Tax-pot calculation.</p><form id="outgoingForm16"><div class="form-grid">
      <div class="field full"><label>Name</label><input name="name" required value="${esc(o.name||'')}" placeholder="Mortgage, phone, Spotify…"></div>
      <div class="field"><label>Monthly amount (£)</label><input name="amount" type="number" min="0" step="0.01" required value="${o.amount??''}"></div>
      <div class="field"><label>Group</label><input name="group" list="outgoingGroups16" required value="${esc(group)}"><datalist id="outgoingGroups16">${known.map(g=>`<option value="${esc(g)}"></option>`).join('')}<option value="Essential Fixed"></option><option value="Essential Variable/Adjustable"></option><option value="Other"></option><option value="NRC (Non Regular Costs)"></option></datalist></div>
      <div class="field"><label>Due day (optional)</label><input name="dueDay" type="number" min="1" max="31" step="1" value="${o.dueDay??''}" placeholder="e.g. 15"><div class="rate-source">Useful for seeing what is coming up later in the month.</div></div>
      <div class="field"><label>Include in monthly target?</label><select name="active"><option value="true" ${o.active!==false?'selected':''}>Yes</option><option value="false" ${o.active===false?'selected':''}>No / paused</option></select></div>
      <div class="field full"><label>Notes</label><textarea name="notes">${esc(o.notes||'')}</textarea></div>
    </div><div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">Save outgoing</button></div></form>`;
  }
  function openOutgoing16(id){
    const o=id?outgoingById16(id):{};openModal(outgoingForm16(o),true);
    $('#outgoingForm16').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());v.amount=Math.max(0,Number(v.amount||0));v.dueDay=v.dueDay===''?null:Math.max(1,Math.min(31,Number(v.dueDay||1)));v.active=v.active==='true';v.group=String(v.group||'Other').trim()||'Other';v.name=String(v.name||'').trim();const target=o.id?o:{id:uid('out'),createdAt:new Date().toISOString()};Object.assign(target,v);if(!o.id)state.outgoings.push(target);syncCurrentMonthlyRecord16();await saveState();closeModal();render();toast('Outgoing saved')};
  }

  function outgoingRows16(items){
    return items.map(o=>`<tr class="${o.active===false?'outgoing-paused16':''}"><td><strong>${esc(o.name)}</strong>${o.notes?`<div class="muted">${esc(o.notes)}</div>`:''}</td><td>${o.dueDay?`Day ${o.dueDay}`:'—'}</td><td>${o.active===false?'<span class="badge">Paused</span>':'<span class="badge ok">Included</span>'}</td><td><strong>${money(o.amount)}</strong></td><td class="right"><div class="row-actions"><button class="btn small secondary" data-action="edit-outgoing" data-id="${o.id}">Edit</button><button class="icon-btn" data-action="delete-outgoing" data-id="${o.id}">×</button></div></td></tr>`).join('');
  }
  function monthlyHistory16(){
    const records=monthlyRecords16(),months=Object.keys(records).sort().reverse();
    return months.map(month=>{
      const rec=records[month]||{},rate=Number.isFinite(Number(rec.reserveRate))?Number(rec.reserveRate):reserveRate16(),income=usableIncomeMonthAtRate16(month,rate),target=Math.max(0,Number(rec.target||0)),difference=income.usable-target;
      return{month,target,rate,backfilledFrom:rec.backfilledFrom||'',...income,difference};
    });
  }
  function monthlyHistoryTable16(){
    const rows=monthlyHistory16();
    if(!rows.length)return empty('Your first monthly record will be created automatically.');
    return `<div class="table-wrap"><table class="monthly-history16"><thead><tr><th>Month</th><th>Paid job fees</th><th>Tax to put aside</th><th>Usable earned</th><th>Needed to earn</th><th>Difference</th><th>Position</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${monthLabel16(r.month)}</strong><div class="muted">${r.rate}% reserve recorded${r.backfilledFrom?' · target carried back from '+monthLabel16(r.backfilledFrom):''}</div></td><td>${money(r.fee)}</td><td><strong>${money(r.taxPot)}</strong><div class="muted">${r.rate}% of positive profit</div></td><td><strong>${money(r.usable)}</strong></td><td>${money(r.target)}</td><td class="${r.difference>=0?'history-positive16':'history-negative16'}"><strong>${r.difference>=0?'+':''}${money(r.difference)}</strong></td><td>${r.difference>=0?'<span class="badge ok">Target met</span>':'<span class="badge warn">Below target</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderOutgoings16(){
    const changedCurrent16=syncCurrentMonthlyRecord16(),changedBackfill16=backfillRecentMonthlyRecords16();if(changedCurrent16||changedBackfill16)saveState().catch(console.error);
    if(!outgoings16().length&&!state.settings.outgoingsSeedVersion&&ghUnlocked&&!outgoingsSeedLoading16){ensurePrivateOutgoings16();}
    if(outgoings16().length&&!state.settings.outgoingsSeedVersion)state.settings.outgoingsSeedVersion='existing-data';
    const month=TODAY().slice(0,7),cover=coverage16(month),groupRows=groups16(),active=activeOutgoings16(),groupTotals=groupTotals16(),todayDay=new Date().getDate();
    const dueKnown=active.filter(o=>Number(o.dueDay)>0),dueLater=dueKnown.filter(o=>Number(o.dueDay)>todayDay).reduce((sum,o)=>sum+Number(o.amount||0),0),dueByNow=dueKnown.filter(o=>Number(o.dueDay)<=todayDay).reduce((sum,o)=>sum+Number(o.amount||0),0);
    const groupCards=groupTotals.map(g=>`<div class="card stat"><div class="label">${esc(g.group)}</div><div class="value">${money(g.total)}</div><div class="hint">Monthly total</div></div>`).join('');
    const sections=groupRows.map(g=>{const rows=outgoings16().filter(o=>(o.group||'Other')===g);return `<div class="section-title outgoing-group-title16"><div><h2>${esc(g)}</h2><p>${rows.filter(x=>x.active!==false).length} included · ${money(rows.filter(x=>x.active!==false).reduce((sum,x)=>sum+Number(x.amount||0),0))}/month</p></div></div><div class="table-wrap"><table class="outgoings-table16"><colgroup><col class="out-name16"><col class="out-due16"><col class="out-status16"><col class="out-amount16"><col class="out-actions16"></colgroup><thead><tr><th>Outgoing</th><th>Due</th><th>Status</th><th>Monthly amount</th><th></th></tr></thead><tbody>${outgoingRows16(rows)}</tbody></table></div>`}).join('');
    const emptyMessage=outgoingsSeedLoading16?'Loading your saved outgoings from private storage…':(!ghUnlocked&&!state.settings.outgoingsSeedVersion?'Unlock private storage to load your saved outgoings.':'No outgoings currently listed. Add one with the button above.');
    $('#content').innerHTML=`
      <div class="grid cards outgoing-summary16" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="card stat"><div class="accent-bar"></div><div class="label">Monthly outgoings</div><div class="value">${money(cover.target)}</div><div class="hint">${active.length} active commitments</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">Usable Chip In income · ${monthLabel16(month)}</div><div class="value">${money(cover.usable)}</div><div class="hint">After linked job costs + ${cover.rate}% Tax pot</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">${cover.gap>0?'Still to cover':'Surplus after outgoings'}</div><div class="value">${money(cover.gap>0?cover.gap:cover.surplus)}</div><div class="hint">${cover.gap>0?(Number.isFinite(cover.profitNeeded)?`${money(cover.profitNeeded)} more job profit at ${cover.rate}% reserve`:'No usable share at the current reserve rate'):'This month is covered by usable income'}</div></div>
      </div>
      <div class="outgoing-cover16"><div><strong>${money(cover.usable)}</strong> usable income against <strong>${money(cover.target)}</strong> monthly outgoings</div><div class="progress"><div style="width:${cover.pct}%"></div></div></div>
      ${dueKnown.length?`<div class="grid cards" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:14px"><div class="card stat"><div class="label">Known due dates up to today</div><div class="value">${money(dueByNow)}</div><div class="hint">Based on the due days you have entered</div></div><div class="card stat"><div class="label">Known due later this month</div><div class="value">${money(dueLater)}</div><div class="hint">Does not include entries with no due day yet</div></div></div>`:''}
      <div class="section-title"><div><h2>Monthly earnings record</h2><p>Each month's target is saved with that month, so later changes to your outgoings do not rewrite your old targets. “Tax to put aside” is that month's recorded reserve applied to positive job profit after linked job costs. “Usable earned” is what remains after those costs and the Tax-pot reserve.</p></div></div>
      ${monthlyHistoryTable16()}
      <div class="section-title"><div><h2>Monthly commitments</h2><p>These are personal outgoings. They are separate from the business Expenses page and do not reduce the Tax-pot calculation.</p></div><div class="row-actions"><button class="btn" data-action="new-outgoing">+ Outgoing</button></div></div>
      ${groupCards?`<div class="grid cards outgoing-groups16" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-bottom:18px">${groupCards}</div>`:''}
      ${sections||empty(emptyMessage)}`;
    wirePageActions();
  }

  const baseHandleAction16=handleAction;
  handleAction=async function(action,id){
    if(action==='new-outgoing'){openOutgoing16();return}
    if(action==='edit-outgoing'){openOutgoing16(id);return}
    if(action==='delete-outgoing'){
      const o=outgoingById16(id);if(!o)return;
      confirmAction(`Delete ${o.name}?`,async()=>{state.outgoings=outgoings16().filter(x=>x.id!==id);syncCurrentMonthlyRecord16();await saveState()});return;
    }
    if(action==='go-outgoings'){page='outgoings';render();return}
    return baseHandleAction16(action,id);
  };

  const baseRender16=render;
  render=function(){
    if(page!=='outgoings')return baseRender16();
    renderNav();const meta=PAGE_META.outgoings||['Outgoings','Monthly commitments'];$('#pageTitle').textContent=meta[0];$('#pageSubtitle').textContent=meta[1];renderTopActions();renderOutgoings16();wirePageActions();
  };

  const baseRenderDashboard16=renderDashboard;
  renderDashboard=function(){
    const changedCurrent16=syncCurrentMonthlyRecord16(),changedBackfill16=backfillRecentMonthlyRecords16();if(changedCurrent16||changedBackfill16)saveState().catch(console.error);
    baseRenderDashboard16();
    const month=TODAY().slice(0,7),c=coverage16(month);
    let slot=document.getElementById('dashboardOutgoingsSlot16');
    if(!slot){
      slot=document.createElement('div');
      slot.id='dashboardOutgoingsSlot16';
      const split=document.querySelector('#content .split');
      if(split)split.appendChild(slot);else document.getElementById('content')?.appendChild(slot);
    }
    if(!slot)return;
    if(!outgoings16().length){
      if(ghUnlocked&&!state.settings.outgoingsSeedVersion&&!outgoingsSeedLoading16)ensurePrivateOutgoings16();
      slot.innerHTML=`<div class="section-title"><div><h2>Monthly position</h2></div></div><div class="card"><p class="muted">${outgoingsSeedLoading16?'Loading your saved outgoings from private storage…':(!ghUnlocked?'Unlock private storage to load your saved outgoings.':'Your private outgoings are ready to be loaded.')}</p><button class="btn" data-action="go-outgoings">Open outgoings</button></div>`;
    }else{
      slot.innerHTML=`<div class="grid cards outgoing-summary16 dashboard-summary16" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="card stat"><div class="accent-bar"></div><div class="label">Monthly outgoings</div><div class="value">${money(c.target)}</div><div class="hint">${activeOutgoings16().length} active commitments</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">Usable Chip In income · ${monthLabel16(month)}</div><div class="value">${money(c.usable)}</div><div class="hint">After linked job costs + ${c.rate}% Tax pot</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">${c.gap>0?'Still to cover':'Surplus after outgoings'}</div><div class="value">${money(c.gap>0?c.gap:c.surplus)}</div><div class="hint">${c.gap>0?(Number.isFinite(c.profitNeeded)?`${money(c.profitNeeded)} more job profit at ${c.rate}% reserve`:'No usable share at the current reserve rate'):'This month is covered by usable income'}</div></div>
      </div>
      <div class="outgoing-cover16 dashboard-cover16"><div><strong>${money(c.usable)}</strong> usable income against <strong>${money(c.target)}</strong> monthly outgoings</div><div class="progress"><div style="width:${c.pct}%"></div></div></div>`;
    }
    wirePageActions();
  };

  const style=document.createElement('style');style.textContent=`
    .outgoing-cover16{margin-top:14px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:#fff}.outgoing-cover16>.progress{margin-top:10px}
    .outgoing-paused16{opacity:.58}.outgoing-group-title16{margin-top:22px}.outgoing-groups16 .value{font-size:22px}.outgoings-table16{width:100%;table-layout:fixed}.outgoings-table16 .out-name16{width:42%}.outgoings-table16 .out-due16{width:12%}.outgoings-table16 .out-status16{width:14%}.outgoings-table16 .out-amount16{width:18%}.outgoings-table16 .out-actions16{width:14%}.outgoings-table16 th,.outgoings-table16 td{vertical-align:top}
    .monthly-history16 td,.monthly-history16 th{white-space:nowrap}.history-positive16{color:#1f7a4d}.history-negative16{color:#a14035}
    .dashboard-outgoings16{margin-top:14px}.outgoing-dashboard-grid16{display:grid;grid-template-columns:1fr 1.25fr;gap:24px;align-items:center}.outgoing-dashboard-big16{font-size:26px;font-weight:800;line-height:1.15;margin:5px 0}.outgoing-dashboard-big16.need16{color:#a14035}.outgoing-dashboard-big16.covered16{color:#1f7a4d}
    @media(max-width:800px){.outgoing-dashboard-grid16{grid-template-columns:1fr}.outgoing-summary16{grid-template-columns:1fr!important}.outgoing-dashboard-big16{font-size:22px}.outgoings-table16{min-width:720px}.outgoings-table16 .out-name16{width:40%}.outgoings-table16 .out-due16{width:12%}.outgoings-table16 .out-status16{width:14%}.outgoings-table16 .out-amount16{width:18%}.outgoings-table16 .out-actions16{width:16%}}
  `;document.head.appendChild(style);
})();
