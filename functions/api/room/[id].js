// Cloudflare Pages Function: Cloud Sync API for Insight Game
// Route: /api/room/:id (GET and POST)

const MAX_BODY_BYTES = 512 * 1024;
const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: CORS_HEADERS });
}

function validRoomId(roomId) {
  return typeof roomId === 'string' && ROOM_ID_PATTERN.test(roomId);
}

export async function onRequestGet(context) {
  const roomId = context.params.id;
  const kv = context.env.INSIGHT_KV;

  if (!validRoomId(roomId)) {
    return jsonResponse({ error: 'INVALID_ROOM_ID', message: 'Имя комнаты: 1–64 символа, только латиница, цифры, - и _.' }, 400);
  }

  if (!kv) {
    return jsonResponse({
      error: 'KV_NOT_BOUND',
      message: 'KV хранилище еще не привязано в настройках Cloudflare Pages. Используйте привязку INSIGHT_KV.'
    }, 503);
  }

  try {
    const data = await kv.get(`room:${roomId}`);
    if (!data) {
      return jsonResponse({ notFound: true, message: 'Комната не найдена' }, 404);
    }
    return new Response(data, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const roomId = context.params.id;
  const kv = context.env.INSIGHT_KV;

  if (!validRoomId(roomId)) {
    return jsonResponse({ error: 'INVALID_ROOM_ID', message: 'Имя комнаты: 1–64 символа, только латиница, цифры, - и _.' }, 400);
  }

  if (!kv) {
    return jsonResponse({
      error: 'KV_NOT_BOUND',
      message: 'KV хранилище еще не привязано в настройках Cloudflare Pages. Используйте привязку INSIGHT_KV.'
    }, 503);
  }

  try {
    const declaredLength = Number(context.request.headers.get('content-length') || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'PAYLOAD_TOO_LARGE', message: 'Состояние игры слишком большое.' }, 413);
    }

    const body = await context.request.text();
    if (body.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'PAYLOAD_TOO_LARGE', message: 'Состояние игры слишком большое.' }, 413);
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      return jsonResponse({ error: 'INVALID_JSON', message: 'Тело запроса должно быть JSON.' }, 400);
    }

    if (!parsed || !Array.isArray(parsed.players)) {
      return jsonResponse({ error: 'INVALID_STATE', message: 'В состоянии игры нет массива players.' }, 400);
    }

    await kv.put(`room:${roomId}`, body);

    return jsonResponse({
      success: true,
      roomId,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
