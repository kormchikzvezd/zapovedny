import catalog from '../catalog/homes.json';
import { availableHomes } from '../catalog/inventory.js';

const VALID_CHANNELS = new Set(['whatsapp', 'telegram', 'max', 'call']);
const VALID_HOMES = new Set(availableHomes(catalog).map((home) => home.id));

const json = (body, status) => new Response(JSON.stringify(body), {
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

export async function saveLead(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'invalid_origin' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'invalid_type' }, 415);
  if (Number(request.headers.get('Content-Length') || 0) > 4096) return json({ error: 'too_large' }, 413);

  let data;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'too_large' }, 413);
    data = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'invalid_data' }, 400);
  // A hidden field keeps simple automated submissions out of the lead list.
  if (data.website) return json({ ok: true }, 201);

  const phone = normalizePhone(data.phone);
  const channel = data.preferredChannel;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const messengerHandle = typeof data.messengerHandle === 'string' ? data.messengerHandle.trim() : '';
  const homes = data.homes;
  if (!phone || !VALID_CHANNELS.has(channel) || data.consent !== true ||
    name.length > 80 || messengerHandle.length > 100 ||
    !Array.isArray(homes) || homes.length > 2 || homes.some((home) => !VALID_HOMES.has(home))) {
    return json({ error: 'invalid_data' }, 400);
  }
  if (!env?.DB) {
    console.error('Lead database binding is unavailable');
    return json({ error: 'unavailable' }, 503);
  }

  try {
    await env.DB.prepare(`INSERT INTO leads
      (name, phone, preferred_channel, messenger_handle, homes, consent_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(name || null, phone, channel, messengerHandle || null, homes.join(', ') || null, new Date().toISOString())
      .run();
    return json({ ok: true }, 201);
  } catch (error) {
    console.error('Failed to save lead', error);
    return json({ error: 'unavailable' }, 503);
  }
}
