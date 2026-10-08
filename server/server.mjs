// Продакшн-сервер «Заповедного».
// Раздаёт статику из dist/client, рендерит страницу через vinext,
// принимает заявки в постоянную SQLite-базу и шлёт уведомление в Telegram.
// Внешних зависимостей нет: только Node.js 22+ (нужен node:sqlite).

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { availableHomes, parseHomesJson } from '../catalog/inventory.js';
import catalogFile from '../catalog/homes.json' with { type: 'json' };

const catalog = parseHomesJson(JSON.stringify(catalogFile));

const ROOT = path.resolve(import.meta.dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'dist/client');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'leads.db');
const PORT = Number(process.env.PORT || 3000);
const ORIGIN = process.env.PUBLIC_ORIGIN || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const log = (...args) => console.log(new Date().toISOString(), ...args);

/* ---------------- база ---------------- */

let db = null;

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    name TEXT,
    phone TEXT NOT NULL,
    preferred_channel TEXT NOT NULL,
    messenger_handle TEXT,
    homes TEXT,
    consent_at TEXT NOT NULL,
    notified INTEGER NOT NULL DEFAULT 0
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS leads_created_idx ON leads (created_at)');
  log('db ready at', DB_PATH);
}

/* ---------------- приём заявок ---------------- */

const VALID_CHANNELS = new Set(['whatsapp', 'telegram', 'max', 'call']);
const VALID_HOMES = new Set(availableHomes(catalog).map((home) => home.id));

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  let digits = value.replace(/\D/g, '');
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return `+${digits}`;
}

async function handleLead(req, ownOrigin) {
  const origin = req.headers.origin;
  if (origin && origin !== ownOrigin) return json({ error: 'invalid_origin' }, 403);
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    return json({ error: 'invalid_type' }, 415);
  }
  if (Number(req.headers['content-length'] || 0) > 4096) return json({ error: 'too_large' }, 413);

  let data;
  try {
    const raw = await readBody(req, 4096);
    if (raw.length > 4096) return json({ error: 'too_large' }, 413);
    data = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'invalid_data' }, 400);

  // Скрытое поле: бот заполняет его, человек — нет. Отвечаем успехом, но не пишем.
  if (data.website) {
    log('lead honeypot triggered, silently dropped');
    return json({ ok: true }, 201);
  }

  const phone = normalizePhone(data.phone);
  const channel = data.preferredChannel;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const handle = typeof data.messengerHandle === 'string' ? data.messengerHandle.trim() : '';
  const homes = data.homes;

  const invalid =
    !phone ||
    !VALID_CHANNELS.has(channel) ||
    data.consent !== true ||
    name.length > 80 ||
    handle.length > 100 ||
    !Array.isArray(homes) ||
    homes.length > 2 ||
    homes.some((home) => !VALID_HOMES.has(home));

  if (invalid) return json({ error: 'invalid_data' }, 400);

  if (!db) {
    log('ERROR database unavailable');
    return json({ error: 'unavailable' }, 503);
  }

  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO leads (created_at, name, phone, preferred_channel, messenger_handle, homes, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(now, name || null, phone, channel, handle || null, homes.join(', ') || null, now);
  } catch (error) {
    // База не сработала — честно отвечаем ошибкой, а не «успехом».
    log('ERROR failed to save lead:', error.message);
    return json({ error: 'unavailable' }, 503);
  }

  log(`new lead ${phone} channel=${channel} homes=${homes.join(',') || '-'}`);
  notifyTelegram({ phone, channel, name, handle, homes }).catch((error) =>
    log('ERROR telegram failed:', error.message),
  );

  return json({ ok: true }, 201);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function notifyTelegram({ phone, channel, name, handle, homes }) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  const lines = [
    'Новая заявка с сайта «Заповедный»',
    '',
    `Телефон: ${phone}`,
    `Канал: ${channel}`,
    name ? `Имя: ${name}` : null,
    handle ? `Мессенджер: ${handle}` : null,
    homes.length ? `Дома: ${homes.join(', ')}` : null,
    '',
    'Ответить: позвоните или напишите в выбранный канал.',
  ].filter(Boolean);

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: lines.join('\n') }),
  });
  if (!response.ok) throw new Error(`telegram ${response.status}`);
}

/* ---------------- статика ---------------- */

const etagCache = new Map();

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (rel.includes('..')) return notFound(res);

  let file = path.join(CLIENT_DIR, rel);
  try {
    const stat = await fsp.stat(file);
    if (stat.isDirectory()) file = path.join(file, 'index.html');
  } catch {
    return notFound(res);
  }

  const ext = path.extname(file).toLowerCase();
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) return notFound(res);

  const etag = `W/"${stat.size}-${Number(stat.mtimeMs).toString(36)}"`;
  if (etagCache.get(file) === etag && req.headers['if-none-match'] === etag) {
    res.writeHead(304).end();
    return;
  }
  etagCache.set(file, etag);

  const immutable = rel.startsWith('_next/') || rel.startsWith('images/') || rel.startsWith('fonts/');
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    ETag: etag,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
  });
  fs.createReadStream(file).pipe(res);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
}

/* ---------------- SSR ---------------- */

let renderPage = null;

async function loadRenderer() {
  const entry = path.join(ROOT, 'dist/server/entry.js');
  const module = await import(pathToFileURL(entry).href);
  renderPage = module.renderPage;
  log('renderer ready');
}

async function servePage(req, res, pathname, origin) {
  const url = `${origin}${pathname}`;
  const response = await renderPage(new Request(url, { method: 'GET' }), pathname, {});
  const html = await response.text();
  const headers = Object.fromEntries(response.headers);
  delete headers['content-encoding'];
  delete headers['content-length'];
  res.writeHead(response.status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(html);
}

/* ---------------- запуск ---------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const proto =
    process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).protocol.replace(':', '') :
    req.headers['x-forwarded-proto']?.split(',')[0].trim() || url.protocol.replace(':', '');
  const host =
    process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).host :
    req.headers['x-forwarded-host']?.split(',')[0].trim() || req.headers.host || 'localhost';
  const origin = `${proto}://${host}`;
  const pathname = url.pathname;

  try {
    if (pathname === '/api/leads') {
      if (req.method !== 'POST') return send(res, json({ error: 'method_not_allowed' }, 405));
      return send(res, await handleLead(req, origin));
    }
    if (pathname === '/api/health') {
      let dbOk = false;
      try {
        db.prepare('SELECT 1').get();
        dbOk = true;
      } catch {}
      return send(
        res,
        json({ ok: true, db: dbOk, availableHomes: [...VALID_HOMES] }, dbOk ? 200 : 503),
      );
    }

    // Статика: пробуем отдать файл, иначе — SSR.
    const staticPath = pathname;
    if (/\.[a-z0-9]{2,5}$/i.test(staticPath) || staticPath.startsWith('/images/') || staticPath.startsWith('/fonts/')) {
      return await serveStatic(req, res, staticPath);
    }

    await servePage(req, res, pathname, origin);
  } catch (error) {
    log('ERROR', pathname, error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal error');
  }
});

async function send(res, response) {
  const body = Buffer.from(await response.text());
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(body);
}

function shutdown(signal) {
  log(`${signal} received, closing`);
  server.close(() => {
    try { db?.close(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

initDb();
await loadRenderer();
server.listen(PORT, '0.0.0.0', () => log(`listening on :${PORT}`));