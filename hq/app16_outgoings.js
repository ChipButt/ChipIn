// Chip In HQ personal monthly outgoings tracker.
// Personal figures live in encrypted/local state; they are never hard-coded in the public repository.
(function(){
  DEFAULT_STATE.outgoings=DEFAULT_STATE.outgoings||[];
  if(!state.outgoings)state.outgoings=[];

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
  function usableIncomeMonth16(month){
    const [start,end]=monthBounds16(month),rate=reserveRate16();let fee=0,jobCosts=0,profit=0,taxPot=0,usable=0,count=0;
    for(const j of state.jobs||[]){
      if(j.status!=='Paid'||!inRange(paidDate16(j),start,end))continue;
      const f=Number(j.paidAmount??j.amount??0),cost=(state.expenses||[]).filter(e=>e.jobId===j.id).reduce((s,e)=>s+Number(e.amount||0),0),p=f-cost,t=Math.max(0,p)*rate/100,u=p-t;
      fee+=f;jobCosts+=cost;profit+=p;taxPot+=t;usable+=u;count++;
    }
    return{month,start,end,rate,fee,jobCosts,profit,taxPot,usable,count};
  }
  function coverage16(month=TODAY().slice(0,7)){
    const income=usableIncomeMonth16(month),target=totalOutgoings16(),gap=Math.max(0,target-income.usable),surplus=Math.max(0,income.usable-target),usableShare=Math.max(0,1-income.rate/100),profitNeeded=gap<=0?0:(usableShare>0?gap/usableShare:Infinity),pct=target>0?Math.max(0,Math.min(100,income.usable/target*100)):100;
    return{...income,target,gap,surplus,profitNeeded,pct};
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
    $('#outgoingForm16').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());v.amount=Math.max(0,Number(v.amount||0));v.dueDay=v.dueDay===''?null:Math.max(1,Math.min(31,Number(v.dueDay||1)));v.active=v.active==='true';v.group=String(v.group||'Other').trim()||'Other';v.name=String(v.name||'').trim();const target=o.id?o:{id:uid('out'),createdAt:new Date().toISOString()};Object.assign(target,v);if(!o.id)state.outgoings.push(target);await saveState();closeModal();render();toast('Outgoing saved')};
  }

  function parseOutgoingsWorkbook16(file){
    return file.arrayBuffer().then(buf=>{
      if(!window.XLSX)throw Error('Spreadsheet reader did not load. Refresh while online and try again.');
      const book=XLSX.read(buf,{type:'array'}),sheetName=book.SheetNames.includes('April 2024')?'April 2024':book.SheetNames[0];
      if(!sheetName)throw Error('No worksheet was found in that file.');
      const rows=XLSX.utils.sheet_to_json(book.Sheets[sheetName],{header:1,raw:false,defval:''});let group='',started=false;const items=[];
      for(const row of rows){
        const label=String(row[0]??'').trim(),rawAmount=row[1],note=String(row[3]??'').trim();
        if(/^Income$/i.test(label))break;
        if(/^Monthly expenses$/i.test(label)){started=true;continue}
        if(!started||!label)continue;
        const a=amount16(rawAmount),hasNumber=String(rawAmount??'').trim()!==''&&!Number.isNaN(Number(String(rawAmount).replace(/[£,\s]/g,'')));
        if(!hasNumber){
          if(!/total|estimate/i.test(label))group=label.replace(/\s+covers\s+…?$/i,'').trim()||label;
          continue;
        }
        if(/total expenses|estimate$/i.test(label))continue;
        if(!group)group='Other';
        items.push({id:uid('out'),name:label,amount:a,group,notes:note,dueDay:null,active:true,createdAt:new Date().toISOString()});
      }
      if(!items.length)throw Error(`No monthly outgoing rows were found in ${sheetName}.`);
      return{items,sheetName};
    });
  }
  function startImport16(){
    const input=document.createElement('input');input.type='file';input.accept='.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const result=await parseOutgoingsWorkbook16(file);if(outgoings16().length&&!window.confirm(`Replace your ${outgoings16().length} current outgoing entries with ${result.items.length} entries from ${result.sheetName}?`))return;state.outgoings=result.items;state.settings.outgoingsImportedAt=new Date().toISOString();state.settings.outgoingsImportSheet=result.sheetName;await saveState();render();toast(`${result.items.length} outgoings imported from ${result.sheetName}`)}catch(err){console.error(err);toast(err.message)}};input.click();
  }

  function outgoingRows16(items){
    return items.map(o=>`<tr class="${o.active===false?'outgoing-paused16':''}"><td><strong>${esc(o.name)}</strong>${o.notes?`<div class="muted">${esc(o.notes)}</div>`:''}</td><td>${o.dueDay?`Day ${o.dueDay}`:'—'}</td><td>${o.active===false?'<span class="badge">Paused</span>':'<span class="badge ok">Included</span>'}</td><td><strong>${money(o.amount)}</strong></td><td class="right"><div class="row-actions"><button class="btn small secondary" data-action="edit-outgoing" data-id="${o.id}">Edit</button><button class="icon-btn" data-action="delete-outgoing" data-id="${o.id}">×</button></div></td></tr>`).join('');
  }
  function renderOutgoings16(){
    const month=TODAY().slice(0,7),cover=coverage16(month),groupRows=groups16(),active=activeOutgoings16(),groupTotals=groupTotals16(),todayDay=new Date().getDate();
    const dueKnown=active.filter(o=>Number(o.dueDay)>0),dueLater=dueKnown.filter(o=>Number(o.dueDay)>todayDay).reduce((s,o)=>s+Number(o.amount||0),0),dueByNow=dueKnown.filter(o=>Number(o.dueDay)<=todayDay).reduce((s,o)=>s+Number(o.amount||0),0);
    const groupCards=groupTotals.map(g=>`<div class="card stat"><div class="label">${esc(g.group)}</div><div class="value">${money(g.total)}</div><div class="hint">Monthly total</div></div>`).join('');
    const sections=groupRows.map(g=>{const rows=outgoings16().filter(o=>(o.group||'Other')===g);return `<div class="section-title outgoing-group-title16"><div><h2>${esc(g)}</h2><p>${rows.filter(x=>x.active!==false).length} included · ${money(rows.filter(x=>x.active!==false).reduce((s,x)=>s+Number(x.amount||0),0))}/month</p></div></div><div class="table-wrap"><table><thead><tr><th>Outgoing</th><th>Due</th><th>Status</th><th>Monthly amount</th><th></th></tr></thead><tbody>${outgoingRows16(rows)}</tbody></table></div>`}).join('');
    const importHint=outgoings16().length?'Importing again will replace the current list after confirmation.':'Your current spreadsheet can be imported without putting any personal figures in the public GitHub code.';
    $('#content').innerHTML=`
      <div class="grid cards outgoing-summary16" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="card stat"><div class="accent-bar"></div><div class="label">Monthly outgoings</div><div class="value">${money(cover.target)}</div><div class="hint">${active.length} active commitments</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">Usable Chip In income · ${monthLabel16(month)}</div><div class="value">${money(cover.usable)}</div><div class="hint">After linked job costs + ${cover.rate}% Tax pot</div></div>
        <div class="card stat"><div class="accent-bar"></div><div class="label">${cover.gap>0?'Still to cover':'Surplus after outgoings'}</div><div class="value">${money(cover.gap>0?cover.gap:cover.surplus)}</div><div class="hint">${cover.gap>0?(Number.isFinite(cover.profitNeeded)?`${money(cover.profitNeeded)} more job profit at ${cover.rate}% reserve`:'No usable share at the current reserve rate'):'This month is covered by usable income'}</div></div>
      </div>
      <div class="outgoing-cover16"><div><strong>${money(cover.usable)}</strong> usable income against <strong>${money(cover.target)}</strong> monthly outgoings</div><div class="progress"><div style="width:${cover.pct}%"></div></div></div>
      ${dueKnown.length?`<div class="grid cards" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:14px"><div class="card stat"><div class="label">Known due dates up to today</div><div class="value">${money(dueByNow)}</div><div class="hint">Based on the due days you have entered</div></div><div class="card stat"><div class="label">Known due later this month</div><div class="value">${money(dueLater)}</div><div class="hint">Does not include entries with no due day yet</div></div></div>`:''}
      <div class="section-title"><div><h2>Monthly commitments</h2><p>These are personal outgoings. They are separate from the business Expenses page and do not reduce the Tax-pot calculation.</p></div><div class="row-actions"><button class="btn secondary" id="importOutgoings16">Import spreadsheet</button><button class="btn" data-action="new-outgoing">+ Outgoing</button></div></div>
      <div class="hint-box" style="margin-bottom:14px"><strong>Private by design.</strong> ${esc(importHint)} The import reads the spreadsheet in your browser, then saves the resulting list into Chip In HQ's private/local state.</div>
      ${groupCards?`<div class="grid cards outgoing-groups16" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-bottom:18px">${groupCards}</div>`:''}
      ${sections||empty('No outgoings yet. Import your spreadsheet or add the first one manually.')}`;
    $('#importOutgoings16').onclick=startImport16;wirePageActions();
  }

  const baseHandleAction16=handleAction;
  handleAction=async function(action,id){
    if(action==='new-outgoing'){openOutgoing16();return}
    if(action==='edit-outgoing'){openOutgoing16(id);return}
    if(action==='delete-outgoing'){
      const o=outgoingById16(id);if(!o)return;
      confirmAction(`Delete ${o.name}?`,async()=>{state.outgoings=outgoings16().filter(x=>x.id!==id);await saveState()});return;
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
    baseRenderDashboard16();
    const month=TODAY().slice(0,7),c=coverage16(month),panel=document.createElement('div');panel.id='dashboardOutgoings16';panel.className='card dashboard-outgoings16';
    if(!outgoings16().length){
      panel.innerHTML=`<div class="section-title" style="margin:0"><div><h2>Monthly outgoings</h2><p>Import your private outgoings spreadsheet to see how much usable income you need each month.</p></div><button class="btn" data-action="go-outgoings">Set up outgoings</button></div>`;
    }else{
      const headline=c.gap>0?`${money(c.gap)} usable income still to cover`:`Covered · ${money(c.surplus)} spare`,needed=c.gap>0&&Number.isFinite(c.profitNeeded)?`${money(c.profitNeeded)} additional job profit would create the remaining usable income at a ${c.rate}% reserve.`:'Your monthly outgoings are covered by usable income received so far.';
      panel.innerHTML=`<div class="outgoing-dashboard-grid16"><div><div class="label muted">${monthLabel16(month).toUpperCase()} OUTGOINGS</div><div class="outgoing-dashboard-big16">${money(c.target)}</div><div class="muted">Usable income received: <strong>${money(c.usable)}</strong></div></div><div><div class="label muted">MONTHLY POSITION</div><div class="outgoing-dashboard-big16 ${c.gap>0?'need16':'covered16'}">${headline}</div><div class="muted">${needed}</div></div></div><div class="progress" style="margin-top:14px"><div style="width:${c.pct}%"></div></div><div class="row-actions" style="justify-content:flex-end;margin-top:10px"><button class="btn small secondary" data-action="go-outgoings">Open outgoings</button></div>`;
    }
    const firstStats=$('#content .grid.cards');if(firstStats)firstStats.insertAdjacentElement('afterend',panel);else $('#content').prepend(panel);wirePageActions();
  };

  const style=document.createElement('style');style.textContent=`
    .outgoing-cover16{margin-top:14px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:#fff}.outgoing-cover16>.progress{margin-top:10px}
    .outgoing-paused16{opacity:.58}.outgoing-group-title16{margin-top:22px}.outgoing-groups16 .value{font-size:22px}
    .dashboard-outgoings16{margin-top:14px}.outgoing-dashboard-grid16{display:grid;grid-template-columns:1fr 1.25fr;gap:24px;align-items:center}.outgoing-dashboard-big16{font-size:26px;font-weight:800;line-height:1.15;margin:5px 0}.outgoing-dashboard-big16.need16{color:#a14035}.outgoing-dashboard-big16.covered16{color:#1f7a4d}
    @media(max-width:800px){.outgoing-dashboard-grid16{grid-template-columns:1fr}.outgoing-summary16{grid-template-columns:1fr!important}.outgoing-dashboard-big16{font-size:22px}}
  `;document.head.appendChild(style);
})();
