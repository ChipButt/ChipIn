/*
 * Migration-only service worker for the retired GitHub Pages HQ.
 * Remove cached old HQ files and stop the old offline dashboard from opening.
 * No customer, invoice, or quote data is modified.
 */
const NEW_HQ='https://chipin-hq-shared.goldplushighdefinition.workers.dev/';
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys=await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('chipin-hq-')).map(key => caches.delete(key)));
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){
      try{await client.navigate(NEW_HQ);}catch(error){}
    }
    await self.registration.unregister();
  })());
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.mode==='navigate' && req.method==='GET'){
    event.respondWith(Response.redirect(NEW_HQ,302));
  }
});
