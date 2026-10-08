// Проверка приёма заявок по контракту docs/LEADS_API.md
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const URL_LEADS = `${BASE}/api/leads`;

let pass = 0;
let fail = 0;

async function check(name, expected, init) {
  const res = await fetch(URL_LEADS, init);
  const ok = res.status === expected;
  if (ok) pass += 1;
  else fail += 1;
  const body = await res.text();
  console.log(
    `${ok ? 'OK  ' : 'FAIL'}  ${name.padEnd(40)} expected ${expected}, got ${res.status}  ${body.slice(0, 40)}`,
  );
}

const lead = (over = {}) => JSON.stringify({
  name: 'Test',
  phone: '+7 900 000-00-00',
  preferredChannel: 'telegram',
  messengerHandle: '@test',
  homes: ['7/1'],
  consent: true,
  website: '',
  ...over,
});

const post = (body, headers = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body,
});

console.log('--- приём заявок ---');
await check('валидная заявка', 201, post(lead()));
await check('телефон из 10 цифр нормализуется', 201, post(lead({ phone: '9000001122' })));
await check('телефон с восьмёркой нормализуется', 201, post(lead({ phone: '8 900 000 11 23' })));
await check('пустой массив домов допустим', 201, post(lead({ homes: [] })));
await check('два дома допустимы', 201, post(lead({ homes: ['5/1', '6/2'] })));
await check('дом 11/2 в продаже', 201, post(lead({ homes: ['11/2'] })));

console.log('\n--- отказы ---');
await check('дом 99/1 не в каталоге', 400, post(lead({ homes: ['99/1'] })));
await check('три дома (лимит 2)', 400, post(lead({ homes: ['5/1', '5/2', '6/1'] })));
await check('consent не true', 400, post(lead({ consent: false })));
await check('consent отсутствует', 400, post(JSON.stringify({ name: 'T', phone: '+79000000001', preferredChannel: 'call', homes: [] })));
await check('неизвестный канал', 400, post(lead({ preferredChannel: 'sms' })));
await check('канал отсутствует', 400, post(lead({ preferredChannel: undefined })));
await check('короткий телефон', 400, post(lead({ phone: '123' })));
await check('телефон не строка', 400, post(lead({ phone: 7900000000 })));
await check('имя длиннее 80', 400, post(lead({ name: 'x'.repeat(81) })));
await check('ники длиннее 100', 400, post(lead({ messengerHandle: 'x'.repeat(101) })));
await check('homes не массив', 400, post(lead({ homes: '7/1' })));
await check('битый JSON', 400, post('{"name":'));
await check('JSON-массив вместо объекта', 400, post('[1,2,3]'));
await check('Content-Type не json', 415, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
await check('чужой Origin', 403, post(lead({ phone: '+79000000009' }), { Origin: 'https://evil.example' }));
await check('тело больше 4096', 413, post(lead({ name: 'y'.repeat(5000) })));
await check('GET вместо POST', 405, { method: 'GET' });

console.log('\n--- ловушка для ботов ---');
const honeypotRes = await fetch(URL_LEADS, post(lead({ phone: '+79000000077', website: 'http://spam.example' })));
console.log(`${honeypotRes.status === 201 ? 'OK  ' : 'FAIL'}  honeypot отвечает 201 (как в оригинале)`);
honeypotRes.status === 201 ? (pass += 1) : (fail += 1);

console.log('\n--- база ---');
const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync('./data/leads.db');
const rows = db.prepare('SELECT phone, preferred_channel, homes FROM leads ORDER BY id').all();
console.log(`В базе записей: ${rows.length}`);
for (const r of rows) console.log(`   ${r.phone}  ${r.preferred_channel}  ${r.homes ?? '-'}`);

const botLeak = rows.filter((r) => r.phone === '+79000000077');
console.log(`${botLeak.length === 0 ? 'OK  ' : 'FAIL'}  заявка бота НЕ записана в базу`);
botLeak.length === 0 ? (pass += 1) : (fail += 1);

const okPhones = rows.filter((r) => /^7(9\d{9})\d?$/.test(r.phone.replace('+', '')) || /^79\d{9}$/.test(r.phone.replace('+', '')));
console.log(`${okPhones.length === rows.length ? 'OK  ' : 'FAIL'}  все телефоны нормализованы в формат +7XXXXXXXXXX`);
okPhones.length === rows.length ? (pass += 1) : (fail += 1);

console.log(`\nИТОГО: ${pass} прошло, ${fail} провалено`);
process.exit(fail ? 1 : 0);