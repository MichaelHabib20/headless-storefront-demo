#!/usr/bin/env node
/**
 * Mock v3 API for e2e tests and local development.
 * - layout/home: recorded staging responses (src/test/fixtures/v3)
 * - shopper endpoints (session, me, cart, wishlist, compare, notifications): stateful
 *   in-memory store (scripts/mock/shopper.mjs). "Bearer test-customer" is a seeded customer.
 * - everything else: the modules in scripts/mock/modules.mjs, asked in order
 * Control: POST /__mode {"fail": true} → every API call returns 500. POST /__reset → fresh state.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createModules } from './mock/modules.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const port = Number(process.env.MOCK_API_PORT ?? 4010);
const dir = path.resolve('src/test/fixtures/v3');
const store = createShopperStore();
const modules = createModules(store);
let fail = false;
let delayMs = 0; // simulate a slow backend (races only show up when writes overlap)

/** The request body as text (`raw`, e.g. a multipart upload) and as JSON (`json`, null when it is not JSON). */
function readRequest(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve({ raw, json: raw ? JSON.parse(raw) : null });
      } catch {
        resolve({ raw, json: null });
      }
    });
  });
}
const readBody = async (req) => (await readRequest(req)).json;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    // `headers` lets a module answer something else than JSON (the mock payment page, a redirect).
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };

    if (url.pathname === '/__mode' && req.method === 'POST') {
      const mode = (await readBody(req)) ?? {};
      fail = Boolean(mode.fail);
      delayMs = Math.max(0, Number(mode.delayMs ?? 0));
      return send(200, { fail, delayMs });
    }
    if (url.pathname === '/__reset' && req.method === 'POST') {
      store.reset();
      for (const part of modules) part.reset?.();
      fail = false;
      delayMs = 0;
      return send(200, { reset: true });
    }
    if (delayMs && url.pathname.startsWith('/api/')) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (url.pathname === '/health') return send(200, { ok: true });
    // Test controls of the modules (e.g. GET /__events, POST /__seo of scripts/mock/seo.mjs).
    if (url.pathname.startsWith('/__')) {
      const controlBody = req.method === 'POST' ? await readBody(req) : null;
      for (const part of modules) {
        const answer = part.control?.(req.method, url.pathname, controlBody);
        if (answer) return send(answer[0], answer[1]);
      }
    }

    const prefix = '/api/customer/v3';
    if (!url.pathname.startsWith(prefix)) return send(404, { error: { code: 'not_found', message: 'Not found' } });
    if (fail) return send(500, { error: { code: 'server_error', message: 'Something went wrong.' } });

    const pathname = url.pathname.slice(prefix.length) || '/';
    const locale = String(url.searchParams.get('locale') ?? req.headers['accept-language'] ?? 'en').startsWith('ar') ? 'ar' : 'en';

    const recorded = pathname.match(/^\/(layout|home)$/);
    if (recorded && req.method === 'GET') {
      const answer = JSON.parse(fs.readFileSync(path.join(dir, `${recorded[1]}.${locale}.json`), 'utf8'));
      // Modules may add the members of later phases (e.g. Layout.marketing, Home.seo).
      for (const part of modules) if (part.decorate) answer.data = part.decorate(recorded[1], answer.data, locale);
      return send(200, answer);
    }

    const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || null;
    const sent = ['PUT', 'POST'].includes(req.method ?? '') ? await readRequest(req) : { raw: '', json: null };
    const body = sent.json;
    const request = { method: req.method, pathname, query: url.searchParams, token, locale, body, contentType: String(req.headers['content-type'] ?? ''), headers: req.headers, raw: sent.raw };
    for (const part of modules) {
      const answer = part.handle(request);
      if (answer) return send(answer[0], answer[1], answer[2]);
    }
    const [status, payload] = store.handle(request);
    send(status, payload);
  })
  .listen(port, () => console.log(`mock v3 API on http://127.0.0.1:${port}`));
