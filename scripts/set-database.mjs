import { readFileSync, writeFileSync } from 'node:fs';

const id = process.argv[2];
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')
    || id === '00000000-0000-0000-0000-000000000000') {
  console.error('Usage: npm run configure:db -- <Database ID from Cloudflare D1>');
  process.exit(1);
}
const path = new URL('../wrangler.worker.jsonc', import.meta.url);
const config = JSON.parse(readFileSync(path, 'utf8'));
config.d1_databases[0].database_id = id;
writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log('Configured DB binding. Next: npm run db:remote, then npm run deploy.');
