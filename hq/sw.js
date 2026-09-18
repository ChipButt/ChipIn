const CACHE='chipin-hq-v16-hq-scope';
const ASSETS=['./','./index.html','./styles.css','./app1.js','./app2_1.js','./app2_2.js','./app2_3.js','./app2_4.js','./app3.js','./app5_startup_gate.js','./app4.js','./app6.js','./app7.js','./app8_rates.js','./app9_jobs.js','./app10_settings_invoice.js','./app11_invoice_job_fixes.js','./app12_receipts_refresh.js','./app13_sync_tax_paid.js','./app14_simple_tax_pot.js','./app15_reports_calendar.js','./app16_outgoings.js','./manifest.webmanifest','./chip_in_logo_TRUE_TRANSPARENT.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('chipin-hq-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    if(new URL(e.request.url).origin===self.location.origin){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
    return resp;
  }).catch(()=>caches.match('./index.html'))));
});
