(async function sharedHQ(){
  const session=JSON.parse(sessionStorage.getItem('hqSession')||'null');
  if(!session){location.replace('/');return}
  let rows=new Map(), baseline=new Map(), pending=Promise.resolve(), busy=false, dirty=false, refreshRequest;
  const key=(c,id)=>JSON.stringify([c,id]);
  const badge=message=>{document.querySelector('#saveState').textContent=message};
  async function token(){
    if(Date.now()>session.expires-90000){
      refreshRequest??=(async()=>{
        const res=await fetch('https://securetoken.googleapis.com/v1/token?key=AIzaSyDOeXy5TVppDu8ktTgjg7eVLnMvo_EDDRc',{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',refresh_token:session.refresh})});
        if(!res.ok)throw Error('Session expired. Sign in again.');
        const data=await res.json();Object.assign(session,{id:data.id_token,refresh:data.refresh_token,expires:Date.now()+Number(data.expires_in)*1000});
        sessionStorage.setItem('hqSession',JSON.stringify(session));
      })().finally(()=>{refreshRequest=null});
      await refreshRequest;
    }
    return session.id;
  }
  window.ChipInSharedHQ={token};
  // The legacy settings card can replace in-memory records with an older snapshot.
  addGhSettings=addGhBadge=scheduleGh=()=>{};
  const retired=()=>{throw Error('This HQ uses your shared account. Reload to read the latest records.')};
  reconcileGh=syncGh=unlockGh=setupGh=unlockBox=retired;
  async function request(method,body){
    const id=await token();
    const res=await fetch('/records',{method,headers:{'X-HQ-Client':'shared-v2',Authorization:'Bearer '+id,'Content-Type':'application/json'},body:body&&JSON.stringify(body),cache:'no-store'});
    if(!res.ok)throw Error(res.status===409?'Someone else changed this record. Your edit was not saved. Reload to review the latest version.':'Shared HQ could not '+(body?'save your changes.':'load your records.'));
    return res.json();
  }
  function flatten(doc){
    const map=new Map();
    for(const [c,value] of Object.entries(doc)){
      if(Array.isArray(value)&&value.every(item=>item&&typeof item.id==='string')){
        map.set(key('$order',c),JSON.stringify(value.map(item=>item.id)));
        for(const item of value)map.set(key(c,item.id),JSON.stringify(item));
      }else map.set(key('$root',c),JSON.stringify(value));
    }
    return map;
  }
  function adopt(list){
    rows=new Map(list.map(row=>[key(row.collection,row.id),row]));
    const doc={};
    for(const row of list){
      if(row.data===null)continue;
      if(row.collection==='$root')doc[row.id]=row.data;
      if(row.collection==='$order')doc[row.id]=row.data.map(id=>rows.get(key(row.id,id))?.data).filter(Boolean);
    }
    state=mergeDefaults(doc,DEFAULT_STATE);baseline=flatten(state);
  }
  async function write(snapshot){
    const next=flatten(snapshot),ops=[];
    for(const k of new Set([...baseline.keys(),...next.keys()])){
      if(next.get(k)===baseline.get(k))continue;
      const [collection,id]=JSON.parse(k);
      if(collection==='$root'&&id==='updatedAt')continue;
      ops.push({collection,id,expected:rows.get(k)?.revision||0,data:JSON.parse(next.get(k)??'null')});
    }
    if(ops.length){
      await request('POST',ops);
      for(const op of ops)rows.set(key(op.collection,op.id),{...op,revision:op.expected+1});
    }
    baseline=next;badge('Saved to shared HQ');
  }
  // Keep the record revision seen when a form opened until its save completes.
  let writes=0;
  saveState=async function(){
    const snapshot=structuredClone(state);writes++;badge('Saving to shared HQ…');
    const save=pending.then(()=>write(snapshot));
    pending=save.catch(()=>{});
    try{await save;dirty=false}catch(e){dirty=true;badge(e.message);toast(e.message);throw e}finally{writes--}
  };
  const nav=document.getElementById('nav');
  const navButtons=[-1,1].map(direction=>{
    const button=document.createElement('button');
    button.type='button';button.className='hq-nav-step';
    button.setAttribute('aria-label',direction<0?'Scroll navigation left':'Scroll navigation right');
    button.textContent=direction<0?'‹':'›';
    button.onclick=()=>nav.scrollBy({left:direction*nav.clientWidth*.8,behavior:'smooth'});
    if(direction<0)nav.before(button);else nav.after(button);
    return button;
  });
  function updateArrows(){
    navButtons[0].disabled=nav.scrollLeft<=1;
    navButtons[1].disabled=nav.scrollLeft+nav.clientWidth>=nav.scrollWidth-1;
  }
  nav.addEventListener('scroll',updateArrows);new ResizeObserver(updateArrows).observe(nav);
  const signout=document.createElement('button');signout.className='ghost-btn';signout.textContent='Sign out';
  signout.onclick=()=>{sessionStorage.removeItem('hqSession');location.replace('/')};document.querySelector('.sidebar-foot').append(signout);
  document.getElementById('app').style.visibility='hidden';
  try{
    await openDB();adopt(await request('GET'));
    document.getElementById('brandLogo').src=LOGO_DATA_URL;document.getElementById('backupQuickBtn').onclick=downloadBackup;
    render();badge('Connected to shared HQ');document.getElementById('app').style.visibility='visible';
    void window.ChipInQuotePortal.synchronize();
  }catch(e){document.body.textContent=e.message;const a=document.createElement('a');a.href=location.hostname.endsWith('.workers.dev')?'/':'/hq/login';a.textContent=' Return to sign in';document.body.append(a);return}
  async function poll(){
    const editing=()=>dirty||writes||!document.getElementById('modal').classList.contains('hidden')||document.activeElement?.matches('input,textarea,select,[contenteditable=true]')||document.hidden;
    if(busy||editing())return;
    const before=baseline;busy=true;
    try{
      const list=await request('GET');
      if(editing()||before!==baseline)return;
      if(list.length!==rows.size||list.some(r=>rows.get(key(r.collection,r.id))?.revision!==r.revision)){adopt(list);render()}
      badge('Connected to shared HQ');
    }catch(e){badge(e.message)}finally{busy=false}
  }
  setInterval(poll,5000);window.addEventListener('focus',poll);
})();
