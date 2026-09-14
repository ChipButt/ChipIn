const CACHE='chipin-hq-v1';
const ASSETS=['./','./index.html','./styles.css','./app1.js','./app2_1.js','./app2_2.js','./app2_3.js','./app2_4.js','./app3.js','./app4.js','./manifest.webmanifest','./chip_in_logo_TRUE_TRANSPARENT.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return resp;
  }).catch(()=>caches.match('./index.html'))));
});
