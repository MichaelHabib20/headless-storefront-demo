#!/usr/bin/env node
/**
 * Serves recorded v3 responses (src/test/fixtures/v3) so e2e tests are fast and
 * deterministic. POST /__mode {"fail": true} makes every API call return 500.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const port = Number(process.env.MOCK_API_PORT ?? 4010);
const dir = path.resolve('src/test/fixtures/v3');
let fail = false;

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };

    if (url.pathname === '/__mode' && req.method === 'POST') {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        fail = Boolean(JSON.parse(raw || '{}').fail);
        send(200, { fail });
      });
      return;
    }
    if (url.pathname === '/health') return send(200, { ok: true });

    const match = url.pathname.match(/^\/api\/customer\/v3\/(layout|home)$/);
    if (!match) return send(404, { error: { code: 'not_found', message: 'Not found' } });
    if (fail) return send(500, { error: { code: 'server_error', message: 'Something went wrong.' } });

    const locale = (req.headers['accept-language'] ?? 'en').toString().startsWith('ar') ? 'ar' : 'en';
    send(200, fs.readFileSync(path.join(dir, `${match[1]}.${locale}.json`), 'utf8'));
  })
  .listen(port, () => console.log(`mock v3 API on http://127.0.0.1:${port}`));
