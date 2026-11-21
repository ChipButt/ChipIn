(function(){
  const key='chipin-client-meetings-v2';
  const records=new Map();
  let api;
  function local(){return JSON.parse(localStorage.getItem(key)||'{"projects":{}}')}
  async function directory(request){
    api=request;
    const list=await (await api('/hq/meeting-data')).json();
    records.clear();for(const m of list)records.set(m.id,m);
    // Import records found only on this device. Existing server records win.
    for(const [id,data] of Object.entries(local().projects||{})){
      if(!data?.fields||records.has(id))continue;
      try{await put(id,data)}catch(e){
        const current=(await (await api('/hq/meeting-data')).json()).find(m=>m.id===id);
        if(!current)throw e;records.set(id,current);
      }
    }
    return Object.fromEntries([...records].map(([id,r])=>[id,r.data]));
  }
  async function put(id,data){
    const previous=records.get(id);
    if(previous&&JSON.stringify(previous.data)===JSON.stringify(data))return;
    const response=await api('/hq/meeting-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,expected:previous?.revision||0,data})});
    const {revision}=await response.json();records.set(id,{id,revision,data:structuredClone(data)});
  }
  window.HQMeetings={directory,put,projects:()=>Object.fromEntries([...records].map(([id,r])=>[id,r.data]))};
})();
