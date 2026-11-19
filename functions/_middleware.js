// Cloudflare Pages: preserve the public site's canonical URLs and keep HQ
// on the chipinworks.co.uk origin. Shared HQ data/auth remain in its Worker.
const HQ_ORIGIN = 'https://chipin-hq-shared.goldplushighdefinition.workers.dev';

function htmlResponse(upstream, body) {
  const headers = new Headers(upstream.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('Cache-Control', 'no-store');
  return new Response(body, {status: upstream.status, statusText: upstream.statusText, headers});
}

const RETIRE_OLD_HQ_SW = `self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('chipin-hq-')).map(k => caches.delete(k)));
  await self.registration.unregister();
  await self.clients.claim();
})()));`;

const CLEAR_LEGACY_SW = `<script>(async()=>{try{
  if('serviceWorker' in navigator){
    const registrations=await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(r=>new URL(r.scope).pathname.startsWith('/hq/')).map(r=>r.unregister()));
  }
  if('caches' in window){
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('chipin-hq-')).map(k=>caches.delete(k)));
  }
}catch(e){console.warn('Legacy HQ cache clean-up was not completed',e)}})();</script>`;

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const path = url.pathname;
  const host = url.hostname.toLowerCase();

  // Preserve the existing www -> apex canonical redirect for Google.
  if (host === 'www.chipinworks.co.uk') {
    return Response.redirect('https://chipinworks.co.uk' + path + url.search, 301);
  }

  let response;
  if (path === '/hq') {
    response = Response.redirect(url.origin + '/hq/' + url.search, 308);
  } else if (path === '/hq/sw.js') {
    response = new Response(RETIRE_OLD_HQ_SW, {
      headers: {'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'}
    });
  } else {
    const isHqPage = path === '/hq/' || path === '/hq/login' || path.startsWith('/hq/');
    const isHqApi = path === '/account' || path === '/records' ||
      path === '/quote-admin' || path === '/migration/source' || path === '/migration/import';
    if (isHqPage || isHqApi) {
      if (!context.env.HQ_SHARED) {
        response = new Response('Chip In HQ service connection unavailable.', {status:503});
      } else {
        // A service binding avoids Worker-to-Worker network routing loops.
        const upstreamPath = path === '/hq/login' ? '/' : path;
        const target = HQ_ORIGIN + upstreamPath + url.search;
        const upstream = await context.env.HQ_SHARED.fetch(new Request(target, request));
        if (path === '/hq/' && request.method === 'GET' && upstream.ok) {
          let body = await upstream.text();
          body = body.replace("location.replace('/')", "location.replace('/hq/login')");
          response = htmlResponse(upstream, body);
        } else if (path === '/hq/login' && request.method === 'GET' && upstream.ok) {
          let body = await upstream.text();
          body = body.replace('</head>', CLEAR_LEGACY_SW + '</head>');
          response = htmlResponse(upstream, body);
        } else if (path === '/hq/dashboard-sync.js' && request.method === 'GET' && upstream.ok) {
          const body = (await upstream.text()).replaceAll("location.replace('/')", "location.replace('/hq/login')");
          response = htmlResponse(upstream, body);
        } else {
          response = upstream;
        }
      }
    } else {
      response = await context.next();
    }
  }

  // The temporary staging hostname must not compete with the canonical
  // Google-indexed site. HQ is private and never belongs in search results.
  if (host.endsWith('.pages.dev') || path === '/hq' || path.startsWith('/hq/') || path === '/records' || path === '/account') {
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
  }
  return response;
}
