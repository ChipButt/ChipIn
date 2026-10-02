// Chip In HQ - optional GPT Action bridge
(function(){
  'use strict';
  const CFG='chipin_sales_bridge_v1';
  const baseRenderSales=window.renderSales;
  const baseSaveState=saveState;
  let syncTimer=null;

  function cfg(){
    try{return JSON.parse(localStorage.getItem(CFG)||'{}')}catch{return{}}
  }
  function setCfg(v){localStorage.setItem(CFG,JSON.stringify(v||{}))}
  function bridgePayload(){
    const today=window.ChipInSalesAssistant?.getToday?.()||{};
    const pipeline=window.ChipInSalesAssistant?.getPipeline?.()||[];
    return {
      version:1,
      syncedAt:new Date().toISOString(),
      today,
      pipeline:pipeline.map(l=>({
        id:l.id,businessName:l.businessName||'',contactName:l.contactName||'',
        email:l.email||'',phone:l.phone||'',address:l.address||'',service:l.service||'',
        stage:l.stage||'',problem:l.problem||'',lastContactDate:l.lastContactDate||'',
        lastContactSummary:l.lastContactSummary||'',nextActionMethod:l.nextActionMethod||'',
        nextActionDate:l.nextActionDate||'',nextActionReason:l.nextActionReason||''
      }))
    };
  }
  async function syncBridge(showToast=false){
    const c=cfg();
    if(!c.url||!c.key)return false;
    const url=c.url.replace(/\/$/,'')+'/sync';
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},body:JSON.stringify(bridgePayload())});
    if(!r.ok)throw Error('GPT bridge returned '+r.status);
    c.lastSync=new Date().toISOString();setCfg(c);
    if(showToast)toast('ChatGPT bridge synced');
    const el=document.getElementById('salesBridgeStatus');
    if(el)el.textContent='Last synced '+new Date(c.lastSync).toLocaleString('en-GB');
    return true;
  }
  function scheduleBridge(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>syncBridge(false).catch(e=>console.warn('Sales bridge sync failed',e)),1200);
  }
  saveState=async()=>{await baseSaveState();scheduleBridge()};

  function addBridgeUI(){
    const host=document.getElementById('content');
    const apiCard=host?.querySelector('.sales-api-card');
    if(!apiCard||document.getElementById('salesBridgePanel'))return;
    const c=cfg();
    const panel=document.createElement('div');
    panel.id='salesBridgePanel';
    panel.className='hint-box';
    panel.style.marginTop='14px';
    panel.innerHTML=`<strong>GPT Action bridge</strong>
      <div id="salesBridgeStatus" class="muted" style="margin:4px 0 10px">${c.lastSync?'Last synced '+new Date(c.lastSync).toLocaleString('en-GB'):'Not connected'}</div>
      <div class="form-grid">
        <div class="field full"><label>Bridge URL</label><input id="salesBridgeUrl" placeholder="https://your-worker.workers.dev" value="${esc(c.url||'')}"></div>
        <div class="field full"><label>Bridge API key</label><input id="salesBridgeKey" type="password" placeholder="Private key shared with your GPT Action" value="${esc(c.key||'')}"></div>
      </div>
      <div class="row-actions" style="justify-content:flex-start;margin-top:10px;flex-wrap:wrap">
        <button class="btn small" id="salesBridgeSave">Save & sync</button>
        ${c.url?'<button class="btn small secondary" id="salesBridgeClear">Disconnect</button>':''}
      </div>
      <p class="muted" style="margin:10px 0 0">Only Sales Assistant data is sent to this bridge. Your invoices, expenses, bank details and the rest of ChipIn-Data are not included.</p>`;
    apiCard.appendChild(panel);
    document.getElementById('salesBridgeSave').onclick=async()=>{
      const url=document.getElementById('salesBridgeUrl').value.trim();
      const key=document.getElementById('salesBridgeKey').value.trim();
      if(!/^https:\/\//i.test(url)||!key)return toast('Add an HTTPS bridge URL and API key');
      setCfg({url,key,lastSync:c.lastSync||''});
      try{await syncBridge(true);render()}catch(e){toast(e.message)}
    };
    document.getElementById('salesBridgeClear')?.addEventListener('click',()=>{
      localStorage.removeItem(CFG);render();toast('GPT bridge disconnected');
    });
  }
  window.renderSales=function(){baseRenderSales();addBridgeUI()};
  window.ChipInSalesBridge={sync:()=>syncBridge(true),payload:bridgePayload};
})();
