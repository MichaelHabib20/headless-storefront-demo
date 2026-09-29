#!/usr/bin/env node
/**
 * Mock v3 API for e2e tests and local development.
 * - layout/home: recorded staging responses (src/test/fixtures/v3)
 * - shopper endpoints (session, me, cart, wishlist, compare, notifications): stateful
 *   in-memory store (scripts/mock/shopper.mjs). "Bearer test-customer" is a seeded customer.
 * Control: POST /__mode {"fail": true} → every API call returns 500. POST /__reset → fresh state.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createShopperStore } from './mock/shopper.mjs';

const port = Number(process.env.MOCK_API_PORT ?? 4010);
const dir = path.resolve('src/test/fixtures/v3');
const store = createShopperStore();
let fail = false;

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };

    if (url.pathname === '/__mode' && req.method === 'POST') {
      fail = Boolean((await readBody(req))?.fail);
      return send(200, { fail });
    }
    if (url.pathname === '/__reset' && req.method === 'POST') {
      store.reset();
      return send(200, { reset: true });
    }
    if (url.pathname === '/health') return send(200, { ok: true });

    const prefix = '/api/customer/v3';
    if (!url.pathname.startsWith(prefix)) return send(404, { error: { code: 'not_found', message: 'Not found' } });
    if (fail) return send(500, { error: { code: 'server_error', message: 'Something went wrong.' } });

    const pathname = url.pathname.slice(prefix.length) || '/';
    const locale = String(url.searchParams.get('locale') ?? req.headers['accept-language'] ?? 'en').startsWith('ar') ? 'ar' : 'en';

    const recorded = pathname.match(/^\/(layout|home)$/);
    if (recorded && req.method === 'GET') {
      return send(200, fs.readFileSync(path.join(dir, `${recorded[1]}.${locale}.json`), 'utf8'));
    }

    const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || null;
    const body = ['PUT', 'POST'].includes(req.method ?? '') ? await readBody(req) : null;
    const [status, payload] = store.handle({ method: req.method, pathname, query: url.searchParams, token, locale, body });
    send(status, payload);
  })
  .listen(port, () => console.log(`mock v3 API on http://127.0.0.1:${port}`));
