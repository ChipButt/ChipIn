const CACHE='chipin-hq-v2';
const ASSETS=['./','./index.html','./styles.css','./app1.js','./app2_1.js','./app2_2.js','./app2_3.js','./app2_4.js','./app3.js','./app4.js','./app5.js','./manifest.webmanifest','./chip_in_logo_TRUE_TRANSPARENT.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin){ e.respondWith(fetch(e.request)); return; }
  e.respondWith(fetch(e.request).then(resp=>{
    const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return resp;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
