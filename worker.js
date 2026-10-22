const MAX_BYTES = 512 * 1024;
const ID = /^[a-zA-Z0-9_-]{1,64}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/health') {
      if (!env.DB) return json({ ok: false, error: 'DB_NOT_BOUND' }, 503);
      try {
        await env.DB.prepare('SELECT id FROM sessions LIMIT 1').all();
        return json({ ok: true, storage: 'D1' });
      } catch {
        return json({ ok: false, error: 'DB_NOT_INITIALIZED' }, 503);
      }
    }
    if (!env.DB) return json({ error: 'DB_NOT_BOUND', message: 'Привяжите базу D1 с именем DB и примените миграцию.' }, 503);
    try {
      if (url.pathname === '/api/sessions' && request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT id, title, player_count AS playerCount, updated_at AS updatedAt FROM sessions ORDER BY updated_at DESC LIMIT 100'
        ).all();
        return json({ sessions: result.results });
      }
      const match = url.pathname.match(/^\/api\/room\/([a-zA-Z0-9_-]{1,64})$/);
      if (!match || !ID.test(match[1])) return json({ error: 'NOT_FOUND' }, 404);
      const id = match[1];
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT state FROM sessions WHERE id = ?').bind(id).first();
        return row ? new Response(row.state, { headers: {
          'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
        } }) : json({ notFound: true }, 404);
      }
      if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
      if (Number(request.headers.get('content-length')) > MAX_BYTES) return json({ error: 'PAYLOAD_TOO_LARGE' }, 413);
      // Limit the streamed body before parsing rather than buffering an unlimited request.
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'INVALID_JSON' }, 400);
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          return json({ error: 'PAYLOAD_TOO_LARGE' }, 413);
        }
        chunks.push(value);
      }
      let state;
      try { state = JSON.parse(await new Blob(chunks).text()); }
      catch { return json({ error: 'INVALID_JSON' }, 400); }
      if (!state || !Array.isArray(state.players) || state.players.length > 50
          || state.players.some(p => !p || typeof p !== 'object' || Array.isArray(p))) {
        return json({ error: 'INVALID_STATE' }, 400);
      }
      const title = String(state.sessionTitle || id).trim().slice(0, 120) || id;
      state.sessionTitle = title;
      state.cloudRoomId = id;
      const now = Date.now();
      const body = JSON.stringify(state);
      const sql = request.headers.get('if-none-match') === '*'
        ? 'INSERT OR IGNORE INTO sessions (id, title, state, player_count, updated_at) VALUES (?, ?, ?, ?, ?)'
        : `INSERT INTO sessions (id, title, state, player_count, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title=excluded.title, state=excluded.state,
             player_count=excluded.player_count, updated_at=excluded.updated_at`;
      const result = await env.DB.prepare(sql).bind(id, title, body, state.players.length, now).run();
      if (!result.meta.changes) return json({ error: 'SESSION_EXISTS' }, 409);
      return json({ success: true, roomId: id, updatedAt: now });
    } catch (error) {
      console.error('Session database operation failed:', error.message);
      return json({ error: 'DB_ERROR', message: 'Не удалось прочитать или сохранить сессию. Проверьте базу и миграции.' }, 503);
    }
  }
};
