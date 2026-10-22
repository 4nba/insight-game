// Run the real Worker handler with SQLite and an adapter for D1's statement API.
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import worker from '../worker.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../migrations/0001_sessions.sql', import.meta.url), 'utf8'));
export const env = {
  DB: { prepare(sql) {
    const query = { values: [],
      bind(...values) { this.values = values; return this; },
      async all() { return { results: db.prepare(sql).all(...this.values) }; },
      async first() { return db.prepare(sql).get(...this.values) || null; },
      async run() { return { meta: db.prepare(sql).run(...this.values) }; }
    };
    return query;
  } },
  ASSETS: { async fetch() {
    return new Response(readFileSync(new URL('../dist/index.html', import.meta.url)), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } }
};

if (process.argv.includes('--serve')) {
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const request = new Request(`http://127.0.0.1${req.url}`, {
        method: req.method, headers: req.headers, body: body.length ? body : undefined
      });
      const response = await worker.fetch(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.writeHead(500); res.end(error.message); }
  });
  server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}`));
}
