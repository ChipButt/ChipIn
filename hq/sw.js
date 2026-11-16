const CACHE='chipin-hq-v86-interactive-quotes';
const ASSETS=['./','./index.html','./styles.css','./canonical-hq.js','./app1.js','./app2_1.js','./app2_2.js','./app2_3.js','./app2_4.js','./app3.js','./app5_startup_gate.js','./app4.js','./app6.js','./app7.js','./app8_rates.js','./app9_jobs.js','./app10_settings_invoice.js','./app11_invoice_job_fixes.js','./app12_receipts_refresh.js','./app13_sync_tax_paid.js','./app14_simple_tax_pot.js','./app15_reports_calendar.js','./app16_outgoings.js','./app17_job_timesheets.js','./app18_sales_assistant.js','./app19_firebase_sales.js','./app20_recurring_jobs.js','./app21_prospect_conversion.js','./app22_client_pipeline.js','./app23_client_to_job.js','./app24_service_pricing.js','./app25_recurring_billing.js','./app26_quotes.js','./app27_interactive_quotes.js','./manifest.webmanifest','./chip_in_logo_TRUE_TRANSPARENT.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('chipin-hq-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  const navigation=req.mode==='navigate';
  const freshAsset=navigation||['script','style'].includes(req.destination)||url.pathname.endsWith('/sw.js')||url.pathname.endsWith('/index.html');
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(freshAsset){
      try{
        const response=await fetch(req,{cache:'no-cache'});
        if(response.ok)cache.put(req,response.clone());
        return response;
      }catch{
        return await caches.match(req)||(navigation?await caches.match('./index.html'):Response.error());
      }
    }
    const saved=await caches.match(req);
    if(saved)return saved;
    try{
      const response=await fetch(req);
      if(response.ok)cache.put(req,response.clone());
      return response;
    }catch{return Response.error();}
  })());
});
