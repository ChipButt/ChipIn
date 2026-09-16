/*
  One-time migration service worker for the old root-scoped Chip In HQ PWA.
  It removes the former root HQ caches and unregisters itself so the public
  website is not controlled by the old admin-app service worker.
*/
const HQ_SCOPED_CACHE='chipin-hq-v12-hq-scope';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith('chipin-hq-') && key !== HQ_SCOPED_CACHE)
        .map(key => caches.delete(key))
    );
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const client of windows) {
      try { await client.navigate(client.url); } catch (_) {}
    }
  })());
});
