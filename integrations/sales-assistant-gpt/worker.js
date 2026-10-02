export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = origin === 'https://chipinworks.co.uk' ? origin : 'https://chipinworks.co.uk';
    const cors = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Vary': 'Origin',
      'Content-Type': 'application/json; charset=utf-8'
    };
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});

    const auth = request.headers.get('Authorization') || '';
    if (!env.API_KEY || auth !== `Bearer ${env.API_KEY}`) {
      return new Response(JSON.stringify({error:'unauthorized'}),{status:401,headers:cors});
    }

    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/sync') {
      const data = await request.json();
      if (!data || data.version !== 1 || !data.today || !Array.isArray(data.pipeline)) {
        return new Response(JSON.stringify({error:'invalid_payload'}),{status:400,headers:cors});
      }
      await env.SALES_DATA.put('current', JSON.stringify(data));
      return new Response(JSON.stringify({ok:true,syncedAt:new Date().toISOString()}),{headers:cors});
    }

    const raw = await env.SALES_DATA.get('current');
    if (!raw) return new Response(JSON.stringify({error:'no_data'}),{status:404,headers:cors});
    const data = JSON.parse(raw);

    if (request.method === 'GET' && url.pathname === '/assistant/today') {
      return new Response(JSON.stringify(data.today),{headers:cors});
    }
    if (request.method === 'GET' && url.pathname === '/assistant/pipeline') {
      return new Response(JSON.stringify({syncedAt:data.syncedAt,pipeline:data.pipeline}),{headers:cors});
    }
    if (request.method === 'GET' && url.pathname.startsWith('/assistant/lead/')) {
      const id = decodeURIComponent(url.pathname.slice('/assistant/lead/'.length));
      const lead = data.pipeline.find(x=>x.id===id);
      return new Response(JSON.stringify(lead||{error:'not_found'}),{status:lead?200:404,headers:cors});
    }

    return new Response(JSON.stringify({error:'not_found'}),{status:404,headers:cors});
  }
};