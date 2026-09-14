// ---------- Google Drive / Sheets cross-device sync ----------
// Structured business data + receipt files are stored as a chunked Chip In HQ backup
// inside the user's private Google Sheet. The public GitHub repository contains only
// the spreadsheet ID, never the contents or OAuth token.
const CHIPIN_GOOGLE_SHEET_ID = '1OHx-Xj2okH1uJsGCr4vbHTZ1yFYswciZjHAMh9LWP-Q';
const CHIPIN_GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${CHIPIN_GOOGLE_SHEET_ID}/edit`;
const CHIPIN_GOOGLE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const CHIPIN_SYNC_CHUNK = 30000;
let cloudToken = null;
let cloudTokenClient = null;
let cloudSyncTimer = null;
let cloudBusy = false;
let cloudStatus = 'Not connected';

function googleClientId(){ return localStorage.getItem('chipin_google_client_id') || ''; }
function setGoogleClientId(v){ const x=(v||'').trim(); if(x)localStorage.setItem('chipin_google_client_id',x); else localStorage.removeItem('chipin_google_client_id'); }
function hasUsefulLocalData(){ return !!(state?.clients?.length || state?.jobs?.length || state?.invoices?.length || state?.expenses?.length || state?.settings?.setupComplete); }
function stamp(v){ return Date.parse(v||0)||0; }

function cloudStatusEl(){ return document.getElementById('cloudSyncState'); }
function setCloudStatus(text,kind=''){
  cloudStatus=text;
  const el=cloudStatusEl();
  if(el){ el.textContent=text; el.dataset.kind=kind; }
}
function ensureCloudBadge(){
  if(document.getElementById('cloudSyncState')) return;
  const foot=document.querySelector('.sidebar-foot');
  if(!foot) return;
  const div=document.createElement('div');
  div.className='cloud-sync-state';
  div.id='cloudSyncState';
  div.textContent=cloudStatus;
  foot.insertBefore(div, foot.lastElementChild);
}

function loadGIS(){
  return new Promise((resolve,reject)=>{
    if(window.google?.accounts?.oauth2) return resolve();
    const existing=document.querySelector('script[data-chipin-gis]');
    if(existing){
      const wait=()=>window.google?.accounts?.oauth2?resolve():setTimeout(wait,100);
      return wait();
    }
    const s=document.createElement('script');
    s.src='https://accounts.google.com/gsi/client';
    s.async=true; s.defer=true; s.dataset.chipinGis='1';
    s.onload=()=>resolve(); s.onerror=()=>reject(new Error('Could not load Google sign-in. Check your internet connection.'));
    document.head.appendChild(s);
  });
}
function configureGoogleClient(){
  const id=googleClientId();
  if(!id || !window.google?.accounts?.oauth2) return false;
  cloudTokenClient=google.accounts.oauth2.initTokenClient({
    client_id:id,
    scope:CHIPIN_GOOGLE_SCOPE,
    callback:async resp=>{
      if(resp.error){ setCloudStatus('Google connection failed','bad'); toast('Google connection failed'); return; }
      cloudToken=resp.access_token;
      localStorage.setItem('chipin_google_connected','1');
      setCloudStatus('Google Drive connected','ok');
      try{ await reconcileWithCloud(); }
      catch(e){ console.error(e); setCloudStatus('Sync error','bad'); openModal(`<h2>Google sync problem</h2><p class="sub">${esc(e.message)}</p>`); }
    }
  });
  return true;
}
async function connectGoogle(prompt='consent'){
  const id=googleClientId();
  if(!id){ page='settings'; render(); toast('Add your Google OAuth Client ID first'); return; }
  await loadGIS(); configureGoogleClient();
  setCloudStatus('Connecting…');
  cloudTokenClient.requestAccessToken({prompt});
}
function disconnectGoogle(){
  if(cloudToken && window.google?.accounts?.oauth2) try{ google.accounts.oauth2.revoke(cloudToken,()=>{}); }catch{}
  cloudToken=null;
  localStorage.removeItem('chipin_google_connected');
  setCloudStatus('Not connected');
  render();
}

async function sheetsFetch(path,opts={}){
  if(!cloudToken) throw new Error('Google Drive is not connected on this device.');
  const res=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CHIPIN_GOOGLE_SHEET_ID}${path}`,{
    ...opts,
    headers:{Authorization:`Bearer ${cloudToken}`,'Content-Type':'application/json',...(opts.headers||{})}
  });
  if(res.status===401){ cloudToken=null; setCloudStatus('Google sign-in expired','warn'); throw new Error('Google sign-in expired. Reconnect Google Drive in Settings.'); }
  if(!res.ok){ const t=await res.text(); throw new Error(`Google Sheets sync failed (${res.status}). ${t.slice(0,240)}`); }
  if(res.status===204) return null;
  return res.json();
}

async function readCloudBackup(){
  setCloudStatus('Checking Google Drive…');
  const data=await sheetsFetch('/values/Sync!A2:B1000?majorDimension=ROWS');
  const rows=(data.values||[]).filter(r=>r.length>1 && String(r[0]).match(/^\d+$/));
  if(!rows.length) return null;
  rows.sort((a,b)=>Number(a[0])-Number(b[0]));
  const raw=rows.map(r=>r[1]||'').join('');
  if(!raw || raw==='{}') return null;
  const backup=JSON.parse(raw);
  if(backup.format!=='ChipInHQBackup' || !backup.state) throw new Error('The Google Sheet contains data Chip In HQ could not recognise.');
  return backup;
}

async function writeCloudBackup(){
  if(!cloudToken || cloudBusy) return;
  cloudBusy=true;
  try{
    setCloudStatus('Syncing to Google Drive…');
    const backup=await buildBackup();
    const raw=JSON.stringify(backup);
    const chunks=[];
    for(let i=0;i<raw.length;i+=CHIPIN_SYNC_CHUNK) chunks.push(raw.slice(i,i+CHIPIN_SYNC_CHUNK));
    await sheetsFetch('/values/Sync!A2:C1000:clear',{method:'POST',body:'{}'});
    for(let start=0;start<chunks.length;start+=150){
      const part=chunks.slice(start,start+150);
      const firstRow=2+start;
      const lastRow=firstRow+part.length-1;
      const values=part.map((chunk,j)=>[String(start+j),chunk,(start+j===0)?state.updatedAt:'']);
      await sheetsFetch(`/values/Sync!A${firstRow}:C${lastRow}?valueInputOption=RAW`,{method:'PUT',body:JSON.stringify({range:`Sync!A${firstRow}:C${lastRow}`,majorDimension:'ROWS',values})});
    }
    setCloudStatus(`Synced · ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`,'ok');
  }finally{ cloudBusy=false; }
}

async function applyCloudBackup(backup){
  state=mergeDefaults(backup.state,DEFAULT_STATE);
  await dbPut('app','state',state);
  for(const [k] of await dbGetAllEntries('receipts')) await dbDelete('receipts',k);
  for(const r of backup.receipts||[]){ if(r?.id && r?.data) await dbPut('receipts',r.id,dataURLToBlob(r.data)); }
  render();
}
async function reconcileWithCloud(){
  const remote=await readCloudBackup();
  if(!remote){
    if(hasUsefulLocalData()) await writeCloudBackup();
    else setCloudStatus('Google Drive connected · empty','ok');
    return;
  }
  const remoteTime=stamp(remote.state?.updatedAt||remote.exportedAt);
  const localTime=stamp(state?.updatedAt);
  if(!hasUsefulLocalData() || remoteTime>localTime){
    await applyCloudBackup(remote);
    setCloudStatus('Loaded latest from Google Drive','ok');
    toast('Latest Chip In HQ data loaded');
  } else if(localTime>remoteTime){
    await writeCloudBackup();
  } else {
    setCloudStatus('Google Drive up to date','ok');
  }
}
function scheduleCloudSync(){
  if(!cloudToken) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>writeCloudBackup().catch(e=>{console.error(e);setCloudStatus('Sync error','bad');}),900);
}

// Add cloud saving to the existing local save path.
const _chipinLocalSaveState=saveState;
saveState=async function(){
  await _chipinLocalSaveState();
  scheduleCloudSync();
};

function injectGoogleSyncSettings(){
  const host=document.getElementById('content');
  if(!host || document.getElementById('googleSyncCard')) return;
  const card=document.createElement('div');
  card.id='googleSyncCard';
  card.innerHTML=`<div class="section-title"><div><h2>Google Drive sync</h2></div></div>
  <div class="card"><div class="accent-bar"></div>
    <h2>Use the same Chip In HQ everywhere</h2>
    <p class="muted">Your private Google Sheet is the master copy. Clients, jobs, invoices, payments, expenses, settings and attached receipts can then follow you between your computer and phone.</p>
    <div class="field" style="max-width:760px"><label>Google OAuth Client ID</label><input id="googleClientIdInput" value="${esc(googleClientId())}" placeholder="xxxxxxxx.apps.googleusercontent.com"></div>
    <div class="hint-box" style="margin-top:12px">Spreadsheet already configured: <strong>Chip In HQ - Business Data</strong>. The OAuth Client ID is the only Google Cloud credential the browser needs; it is not a password or secret.</div>
    <div class="row-actions" style="justify-content:flex-start;margin-top:14px;flex-wrap:wrap">
      <button type="button" class="btn secondary" id="saveGoogleClientId">Save Client ID</button>
      <button type="button" class="btn gold" id="connectGoogleBtn">${cloudToken?'Sync now':'Connect Google Drive'}</button>
      ${cloudToken?'<button type="button" class="btn secondary" id="disconnectGoogleBtn">Disconnect this device</button>':''}
      <a class="btn secondary" href="${CHIPIN_GOOGLE_SHEET_URL}" target="_blank" rel="noopener">Open data sheet</a>
    </div>
    <p class="muted" style="margin-top:12px"><strong>Status:</strong> <span id="settingsCloudStatus">${esc(cloudStatus)}</span></p>
  </div>`;
  const danger=[...host.querySelectorAll('.section-title h2')].find(h=>h.textContent.trim()==='Danger zone')?.closest('.section-title');
  if(danger) danger.before(card); else host.appendChild(card);
  document.getElementById('saveGoogleClientId').onclick=async()=>{
    setGoogleClientId(document.getElementById('googleClientIdInput').value);
    cloudToken=null; cloudTokenClient=null;
    await loadGIS().catch(()=>{}); configureGoogleClient();
    toast('Google Client ID saved');
  };
  document.getElementById('connectGoogleBtn').onclick=async()=>{
    setGoogleClientId(document.getElementById('googleClientIdInput').value);
    if(cloudToken) await writeCloudBackup().catch(e=>openModal(`<h2>Sync problem</h2><p class="sub">${esc(e.message)}</p>`));
    else await connectGoogle('consent').catch(e=>openModal(`<h2>Google connection problem</h2><p class="sub">${esc(e.message)}</p>`));
  };
  const dis=document.getElementById('disconnectGoogleBtn'); if(dis)dis.onclick=disconnectGoogle;
}

// Extend Settings without changing the rest of the app.
const _chipinRenderSettings=renderSettings;
renderSettings=function(){ _chipinRenderSettings(); injectGoogleSyncSettings(); };

async function initCloudSync(){
  ensureCloudBadge();
  const id=googleClientId();
  if(!id){ setCloudStatus('Google Drive not connected'); return; }
  try{
    await loadGIS(); configureGoogleClient();
    if(localStorage.getItem('chipin_google_connected')==='1'){
      setCloudStatus('Connecting to Google Drive…');
      // Try a silent token first. If Google requires interaction, leave a clear status.
      cloudTokenClient.requestAccessToken({prompt:''});
    } else setCloudStatus('Google Drive ready to connect');
  }catch(e){ console.error(e); setCloudStatus('Google Drive unavailable','bad'); }
}

// app4.js starts asynchronously, so this runs after its globals exist and once the DOM settles.
setTimeout(initCloudSync,350);
