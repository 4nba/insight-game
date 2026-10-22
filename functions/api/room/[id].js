// Cloudflare Pages Function: Cloud Sync API for Insight Game
// Route: /api/room/:id (GET and POST)

export async function onRequestGet(context) {
  const roomId = context.params.id;
  const kv = context.env.INSIGHT_KV;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (!kv) {
    return new Response(JSON.stringify({ 
      error: 'KV_NOT_BOUND', 
      message: 'KV хранилище еще не привязано в настройках Cloudflare Pages. Используйте привязку INSIGHT_KV.' 
    }), { status: 200, headers: corsHeaders });
  }

  try {
    const data = await kv.get(`room:${roomId}`);
    if (!data) {
      return new Response(JSON.stringify({ notFound: true, message: 'Комната не найдена' }), { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    return new Response(data, { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPost(context) {
  const roomId = context.params.id;
  const kv = context.env.INSIGHT_KV;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (!kv) {
    return new Response(JSON.stringify({ 
      error: 'KV_NOT_BOUND', 
      message: 'KV хранилище еще не привязано в настройках Cloudflare Pages. Используйте привязку INSIGHT_KV.' 
    }), { status: 200, headers: corsHeaders });
  }

  try {
    const body = await context.request.text();
    // Save to KV with 30 days expiration TTL
    await kv.put(`room:${roomId}`, body, { expirationTtl: 60 * 60 * 24 * 30 });

    return new Response(JSON.stringify({ 
      success: true, 
      roomId, 
      updatedAt: new Date().toISOString() 
    }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
