  const localRead=dbGet,localWrite=dbPut;
  const uploaded=new Map();
  async function uploadReceipt(blob){
    const bytes=await blob.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    await api('/hq/receipt?id='+hash,{method:'PUT',body:bytes});
    return hash;
  }
  dbPut=async(store,id,value)=>{
    if(store==='receipts')uploaded.set(id,await uploadReceipt(value));
    return localWrite(store,id,value);
  };
  dbGet=async(store,id)=>{
    if(store!=='receipts')return localRead(store,id);
    const expense=state.expenses.find(e=>e.id===id);
    if(!expense?.receiptFile)return localRead(store,id);
    const response=await api('/hq/receipt?id='+expense.receiptFile);
    return new Blob([await response.arrayBuffer()],{type:expense.receiptType||'application/octet-stream'});
  };
  async function migrateReceipts(){
    for(const expense of state.expenses.filter(e=>e.receiptName&&!e.receiptFile)){
      const blob=await localRead('receipts',expense.id);
      if(!blob)continue;
      const hash=await uploadReceipt(blob);
      const current=state.expenses.find(e=>e.id===expense.id);
      if(current&&!current.receiptFile&&current.receiptName===expense.receiptName){current.receiptFile=hash;await saveState()}
    }
  }
  buildBackup=async()=>{
    await pending;
    if(dirty)throw Error('Resolve unsaved edits before downloading a backup.');
    const snapshot=structuredClone(state),receipts=[];
    for(const e of snapshot.expenses.filter(e=>e.receiptName)){
      const blob=await dbGet('receipts',e.id);
      if(!blob)throw Error('Open HQ on the device holding '+e.receiptName+' to back it up.');
      receipts.push({id:e.id,name:e.receiptName,type:blob.type,data:await fileToDataURL(blob)});
    }
    const meetings=await (await api('/hq/meeting-data')).json();
    return {format:'ChipInHQBackup',version:APP_VERSION,exportedAt:new Date().toISOString(),state:snapshot,receipts,meetings};
  };
  const download=downloadBackup;
  downloadBackup=async()=>{try{await download()}catch(e){toast(e.message)}};
  restoreBackup=async file=>{
    if(!file)return;
    try{
      if(dirty||writes)throw Error('Finish saving your edits before reviewing a restore.');
      const backup=JSON.parse(await file.text());
      if(backup.format!=='ChipInHQBackup'||!backup.state?.settings||
        !['clients','jobs','expenses','invoices'].every(k=>Array.isArray(backup.state[k])))throw Error('Unrecognised HQ backup.');
      for(const [collection,items] of Object.entries(backup.state)){
        if(!Array.isArray(state[collection])||!Array.isArray(items)||!state[collection].every(v=>v&&typeof v.id==='string'))continue;
        if(items.some(v=>!v||typeof v.id!=='string'||!v.id.length)||new Set(items.map(v=>v.id)).size!==items.length)throw Error('Invalid or duplicate record ID in '+collection);
      }
      const candidate=mergeDefaults(backup.state,DEFAULT_STATE), current=baseline, target=flatten(candidate);
      const files=(backup.receipts||[]).map(r=>({id:r.id,blob:dataURLToBlob(r.data)}));
      const meetings=await (await api('/hq/meeting-data')).json();
      const meetingById=new Map(meetings.map(m=>[m.id,m]));
      const meetingChanges=(backup.meetings||[]).filter(m=>JSON.stringify(m.data)!==JSON.stringify(meetingById.get(m.id)?.data));
      const changes=[];
      for(const k of new Set([...current.keys(),...target.keys()])){
        const [c,id]=JSON.parse(k);
        if(c==='$order'||(c==='$root'&&id==='updatedAt')||target.get(k)===current.get(k))continue;
        const row=JSON.parse(target.get(k)||current.get(k));
        changes.push([!target.has(k)?'Remove':!current.has(k)?'Add':'Change',c,row?.number||row?.name||row?.title||id,id]);
      }
      for(const m of meetingChanges)changes.push([meetingById.has(m.id)?'Change':'Add','meeting',m.data.fields?.business||m.id,m.id]);
      const list=changes.map(parts=>'<li>'+parts.map(x=>esc(x)).join(' · ')+'</li>').join('');
      openModal('<h2>Review shared HQ restore</h2><p>These changes apply to both accounts. Review the records before restoring.</p><ul>'+list+'</ul><p>'+files.length+' receipt files in backup.</p><div class="form-actions"><button class="btn secondary" data-close-modal>Cancel</button><button id="applySharedRestore" class="btn">'+(changes.length||files.length?'Apply restore':'Close')+'</button></div>',true);
      document.getElementById('applySharedRestore').onclick=async event=>{
        const btn=event.currentTarget;btn.disabled=true;
        try{
          if(current!==baseline||writes||dirty)throw Error('HQ changed. Open the backup again to review it.');
          for(const r of files){const e=candidate.expenses.find(e=>e.id===r.id);if(e)e.receiptFile=await uploadReceipt(r.blob)}
          if(current!==baseline||writes||dirty)throw Error('HQ changed. Open the backup again to review it.');
          const extra=meetingChanges.map(m=>({collection:'$meeting',id:m.id,expected:meetingById.get(m.id)?.revision||0,data:m.data}));
          restoring=true;writes++;
          try{await write(candidate,extra,true);state=candidate}finally{writes--;restoring=false}
          closeModal();render();toast('Shared HQ restored.');
        }catch(e){toast(e.message);btn.disabled=false}
      };
    }catch(e){toast(e.message)}
  };
