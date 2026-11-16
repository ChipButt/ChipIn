// Build the self-contained Cloudflare Worker without external packages.
// Requires Node 20+ (no npm install). Run: node quote-portal/build.mjs
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const base = resolve(fileURLToPath(new URL('.', import.meta.url)));
const template = readFileSync(resolve(base, 'worker.js'), 'utf8');
const html = readFileSync(resolve(base, 'client.html'), 'utf8');
if (!template.includes('const UI = UI_TEMPLATE;') || !html.includes('__DATA__'))
  throw new Error('Quote portal build inputs are incomplete.');
const output = template.replace('const UI = UI_TEMPLATE;', 'const UI = ' + JSON.stringify(html) + ';');
if (output.includes('const UI = UI_TEMPLATE;')) throw new Error('UI was not bundled.');
mkdirSync(resolve(base, 'dist'), { recursive: true });
writeFileSync(resolve(base, 'dist/worker.js'), output);
console.log('Built quote-portal/dist/worker.js');
