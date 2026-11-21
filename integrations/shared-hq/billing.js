// The build inserts the same calendar and renewal calculation used by the HQ invoice editor.
function calculateRenewals(state,today){
  const TODAY=()=>today;
  const clientById=id=>state.clients.find(c=>c.id===id);
  const uid=()=> 'inv_'+crypto.randomUUID();
  const nextInvoiceNumber=()=>{
    const year=Number(today.slice(0,4))-(today.slice(5)<'04-06'?1:0);
    return (state.settings.invoicePrefix||'INV')+'-'+year+'-'+String(state.settings.nextInvoiceNumber||1).padStart(4,'0');
  };
  const addDays=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
  /* renewal helpers */
  /* renewal calculation */
  return createDueMonthDrafts();
}
async function runBilling(db,today=new Date().toISOString().slice(0,10)){
  for(let attempt=0;attempt<3;attempt++){
    const rows=(await db.prepare("SELECT collection,id,revision,data FROM hq_records WHERE collection IN ('recurringCharges','clients','invoices') OR (collection='$root' AND id='settings') OR (collection='$order' AND id IN ('clients','recurringCharges','invoices'))").all()).results;
    const byKey=new Map(rows.map(r=>[JSON.stringify([r.collection,r.id]),r]));
    const get=(c,id)=>JSON.parse(byKey.get(JSON.stringify([c,id]))?.data||'null');
    const state={settings:get('$root','settings')};
    if(!state.settings)return;
    for(const c of ['clients','recurringCharges','invoices'])state[c]=(get('$order',c)||[]).map(id=>get(c,id)).filter(Boolean);
    if(!calculateRenewals(state,today).changed)return;
    const actor='recurring-billing@automation.invalid';
    const changes=[db.prepare('INSERT OR IGNORE INTO hq_members(email,uid,name) VALUES(?,?,?)').bind(actor,'internal:recurring-billing','Automatic recurring billing')];
    const add=(c,id,value)=>{
      const row=byKey.get(JSON.stringify([c,id])),data=JSON.stringify(value);
      if(data!==row?.data)changes.push(db.prepare('INSERT INTO hq_records(collection,id,revision,data,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_by=excluded.updated_by').bind(c,id,(row?.revision||0)+1,data,actor));
    };
    for(const c of ['invoices','recurringCharges'])for(const row of state[c])add(c,row.id,row);
    add('$order','invoices',state.invoices.map(i=>i.id));add('$root','settings',state.settings);
    try{await db.batch(changes);return}catch(e){if(attempt===2||!String(e).includes('hq_revision_conflict'))throw e}
  }
}
