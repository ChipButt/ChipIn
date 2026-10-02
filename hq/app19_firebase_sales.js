// Chip In HQ - Firebase Spark Sales Assistant sync (no Cloud Functions / no Blaze)
(function(){
  'use strict';

  const CFG_KEY='chipin_firebase_sales_cfg_v1';
  const TOKEN_KEY='chipin_firebase_sales_refresh_v1';
  const baseRenderSales=window.renderSales;
  const baseSaveState=saveState;
  let fbIdToken='', fbRefreshToken='', fbUid='', fbTokenExpiry=0, fbSyncTimer=null, fbBusy=false;

  function getCfg(){
    try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch{return{}}
  }
  function putCfg(v){localStorage.setItem(CFG_KEY,JSON.stringify(v||{}))}
  function clearSession(){fbIdToken='';fbRefreshToken='';fbUid='';fbTokenExpiry=0}
  function salesPayload(){
    const today=window.ChipInSalesAssistant?.getToday?.()||{};
    const pipeline=window.ChipInSalesAssistant?.getPipeline?.()||[];
    return {
      version:1,
      syncedAt:new Date().toISOString(),
      today,
      pipeline:pipeline.map(l=>({
        id:l.id||'',businessName:l.businessName||'',contactName:l.contactName||'',
        email:l.email||'',phone:l.phone||'',address:l.address||'',service:l.service||'',
        stage:l.stage||'',problem:l.problem||'',lastContactDate:l.lastContactDate||'',
        lastContactSummary:l.lastContactSummary||'',nextActionMethod:l.nextActionMethod||'',
        nextActionDate:l.nextActionDate||'',nextActionReason:l.nextActionReason||''
      }))
    };
  }
  function authEndpoint(path,cfg=getCfg()){
    if(!cfg.apiKey)throw Error('Firebase Web API key is missing.');
    return `https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(cfg.apiKey)}`;
  }
  async function parseFirebaseError(r){
    let j={};try{j=await r.json()}catch{}
    const raw=j?.error?.message||('Firebase error '+r.status);
    const friendly={
      EMAIL_NOT_FOUND:'Firebase user not found.',
      INVALID_LOGIN_CREDENTIALS:'Firebase email or password is incorrect.',
      INVALID_PASSWORD:'Firebase password is incorrect.',
      USER_DISABLED:'This Firebase user is disabled.',
      OPERATION_NOT_ALLOWED:'Enable Email/Password sign-in in Firebase Authentication first.',
      API_KEY_INVALID:'The Firebase Web API key is not valid.'
    };
    throw Error(friendly[raw]||raw.replaceAll('_',' '));
  }
  async function signInFirebase(email,password){
    const r=await fetch(authEndpoint('accounts:signInWithPassword'),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,password,returnSecureToken:true})
    });
    if(!r.ok)return parseFirebaseError(r);
    const j=await r.json();
    fbIdToken=j.idToken;fbRefreshToken=j.refreshToken;fbUid=j.localId;
    fbTokenExpiry=Date.now()+(Number(j.expiresIn||3600)-120)*1000;
    if(!ghPass)throw Error('Unlock Chip In private storage first so the Firebase refresh token can be encrypted on this device.');
    localStorage.setItem(TOKEN_KEY,await sealText(fbRefreshToken,ghPass));
    const cfg=getCfg();cfg.email=j.email||email;cfg.uid=fbUid;cfg.connectedAt=new Date().toISOString();putCfg(cfg);
    return j;
  }
  async function refreshFirebase(){
    const cfg=getCfg();
    if(fbIdToken && Date.now()<fbTokenExpiry)return fbIdToken;
    if(!fbRefreshToken){
      const sealed=localStorage.getItem(TOKEN_KEY);
      if(!sealed||!ghPass)throw Error('Firebase Sales Assistant is locked. Unlock Chip In private storage first.');
      fbRefreshToken=await openText(sealed,ghPass);
    }
    const r=await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg.apiKey||'')}`,{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'refresh_token',refresh_token:fbRefreshToken})
    });
    if(!r.ok)return parseFirebaseError(r);
    const j=await r.json();
    fbIdToken=j.id_token;fbRefreshToken=j.refresh_token||fbRefreshToken;fbUid=j.user_id||cfg.uid||'';
    fbTokenExpiry=Date.now()+(Number(j.expires_in||3600)-120)*1000;
    if(ghPass)localStorage.setItem(TOKEN_KEY,await sealText(fbRefreshToken,ghPass));
    if(fbUid&&cfg.uid!==fbUid){cfg.uid=fbUid;putCfg(cfg)}
    return fbIdToken;
  }
  function firestoreDocUrl(cfg=getCfg()){
    if(!cfg.projectId)throw Error('Firebase Project ID is missing.');
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents/chipinSalesAssistant/current`;
  }
  async function writeSalesFeed(showToast=false){
    const cfg=getCfg();
    if(!cfg.projectId||!cfg.apiKey||!localStorage.getItem(TOKEN_KEY))return false;
    if(fbBusy)return false;
    fbBusy=true;
    try{
      const token=await refreshFirebase(),payload=salesPayload();
      const doc={fields:{
        version:{integerValue:'1'},
        syncedAt:{timestampValue:payload.syncedAt},
        ownerUid:{stringValue:fbUid||cfg.uid||''},
        actionCount:{integerValue:String(payload.today?.actions?.length||0)},
        todayJson:{stringValue:JSON.stringify(payload.today)},
        pipelineJson:{stringValue:JSON.stringify(payload.pipeline)}
      }};
      const r=await fetch(firestoreDocUrl(cfg),{
        method:'PATCH',
        headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify(doc)
      });
      if(!r.ok){
        if(r.status===403)throw Error('Firestore denied the write. Publish the generated Security Rules shown in Sales Assistant.');
        let j={};try{j=await r.json()}catch{}
        throw Error(j?.error?.message||('Firestore sync failed '+r.status));
      }
      cfg.lastSync=new Date().toISOString();putCfg(cfg);
      const e=document.getElementById('firebaseSalesStatus');if(e)e.textContent='Synced '+new Date(cfg.lastSync).toLocaleString('en-GB');
      if(showToast)toast('Firebase Sales Assistant synced');
      return true;
    }finally{fbBusy=false}
  }
  function scheduleFirebaseSync(){
    clearTimeout(fbSyncTimer);
    const cfg=getCfg();
    if(!cfg.projectId||!cfg.apiKey||!localStorage.getItem(TOKEN_KEY))return;
    fbSyncTimer=setTimeout(()=>writeSalesFeed(false).catch(e=>console.warn('Firebase sales sync failed',e)),1200);
  }
  saveState=async()=>{await baseSaveState();scheduleFirebaseSync()};

  function rulesText(uid){
    return `rules_version = '2';\n\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /chipinSalesAssistant/{document} {\n      allow read, write: if request.auth != null\n        && request.auth.uid == '${uid||'PASTE_FIREBASE_UID_HERE'}';\n    }\n\n    match /{document=**} {\n      allow read, write: if false;\n    }\n  }\n}`;
  }
  function addFirebaseUI(){
    const host=document.getElementById('content');
    const old=host?.querySelector('.sales-api-card');
    if(!old||document.getElementById('firebaseSalesPanel'))return;
    const cfg=getCfg(), connected=!!localStorage.getItem(TOKEN_KEY);
    old.querySelector('div')?.replaceChildren(document.createTextNode('Firebase Spark connection'));
    const p=old.querySelector('p.muted');if(p)p.textContent='HQ writes only the Sales Assistant feed directly to Firestore using Firebase Authentication. No Cloud Function, Worker or Blaze plan is required.';
    const hint=old.querySelector('.hint-box');if(hint)hint.innerHTML='<strong>ChatGPT side:</strong> read the same Firestore document through Google OAuth with a read-only identity. HQ remains the only writer.';
    const panel=document.createElement('div');
    panel.id='firebaseSalesPanel';panel.className='hint-box';panel.style.marginTop='14px';
    panel.innerHTML=`
      <strong>Firebase Spark · direct Firestore</strong>
      <div id="firebaseSalesStatus" class="muted" style="margin:4px 0 10px">${connected?(cfg.lastSync?'Synced '+new Date(cfg.lastSync).toLocaleString('en-GB'):'Connected — sync pending'):'Not connected'}</div>
      <div class="form-grid">
        <div class="field"><label>Firebase Project ID</label><input id="fbProjectId" value="${esc(cfg.projectId||'')}" placeholder="chip-in-sales-assistant"></div>
        <div class="field"><label>Firebase Web API key</label><input id="fbApiKey" value="${esc(cfg.apiKey||'')}" placeholder="AIza…"></div>
        <div class="field"><label>Firebase user email</label><input id="fbEmail" type="email" value="${esc(cfg.email||'')}" placeholder="Your Firebase Authentication user"></div>
        <div class="field"><label>${connected?'Password (only needed to reconnect)':'Firebase user password'}</label><input id="fbPassword" type="password" autocomplete="current-password" placeholder="${connected?'Leave blank unless reconnecting':'Password is not stored'}"></div>
      </div>
      <div class="row-actions" style="justify-content:flex-start;margin-top:10px;flex-wrap:wrap">
        <button class="btn small" id="fbConnectBtn">${connected?'Save settings & sync':'Connect & sync'}</button>
        ${connected?'<button class="btn small secondary" id="fbReconnectBtn">Sign in again</button><button class="btn small secondary" id="fbDisconnectBtn">Disconnect Firebase</button>':''}
      </div>
      ${cfg.uid?`<div style="margin-top:14px"><strong>Authenticated Firebase UID</strong><div class="mono" style="overflow-wrap:anywhere;margin-top:4px">${esc(cfg.uid)}</div><button class="btn small secondary" id="fbRulesBtn" style="margin-top:8px">Copy Firestore Security Rules</button></div>`:''}
      <p class="muted" style="margin:10px 0 0">The Firebase password is used only to sign in. HQ stores the resulting refresh token encrypted with your existing Chip In HQ passphrase.</p>`;
    old.appendChild(panel);

    const saveFields=()=>{
      const n={...getCfg(),
        projectId:document.getElementById('fbProjectId').value.trim(),
        apiKey:document.getElementById('fbApiKey').value.trim(),
        email:document.getElementById('fbEmail').value.trim()
      };putCfg(n);return n;
    };
    document.getElementById('fbConnectBtn').onclick=async()=>{
      const n=saveFields(),pass=document.getElementById('fbPassword').value;
      if(!n.projectId||!n.apiKey||!n.email)return toast('Add the Firebase Project ID, Web API key and user email');
      try{
        if(!connected||pass)await signInFirebase(n.email,pass);
        await writeSalesFeed(true);render();
      }catch(e){render();toast(e.message)}
    };
    document.getElementById('fbReconnectBtn')?.addEventListener('click',async()=>{
      const n=saveFields(),pass=document.getElementById('fbPassword').value;
      if(!pass)return toast('Enter the Firebase user password');
      try{await signInFirebase(n.email,pass);await writeSalesFeed(true);render()}catch(e){toast(e.message)}
    });
    document.getElementById('fbDisconnectBtn')?.addEventListener('click',()=>{
      localStorage.removeItem(TOKEN_KEY);clearSession();render();toast('Firebase Sales Assistant disconnected from this device');
    });
    document.getElementById('fbRulesBtn')?.addEventListener('click',async()=>{
      await navigator.clipboard.writeText(rulesText(getCfg().uid));toast('Firestore Security Rules copied');
    });
  }

  window.renderSales=function(){baseRenderSales();addFirebaseUI()};
  window.ChipInFirebaseSales={
    sync:()=>writeSalesFeed(true),
    payload:salesPayload,
    rules:()=>rulesText(getCfg().uid),
    config:()=>({...getCfg(),apiKey:getCfg().apiKey?'configured':''})
  };

  // Once the existing HQ passphrase has been unlocked, a stored Firebase token
  // can be decrypted automatically on the next sales save/sync.
})();
