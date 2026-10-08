// Те же проверки контракта, но для PHP-обработчика на обычном хостинге.
// Путь отличается: /api/leads.php вместо /api/leads
import { DatabaseSync } from 'node:sqlite';

const BASE = process.env.BASE || 'http://127.0.0.1:3222';
const ENDPOINT = `${BASE}/api/leads.php`;
const DB = process.env.DB || './data/leads.db';

let pass = 0, fail = 0;

async function check(name, expected, init) {
  const res = await fetch(ENDPOINT, init);
  const ok = res.status === expected;
  ok ? (pass += 1) : (fail += 1);
  const body = await res.text();
  console.log(
    `${ok ? 'OK  ' : 'FAIL'}  ${name.padEnd(40)} ждали ${expected}, получили ${res.status}  ${body.slice(0, 36)}`,
  );
}

const lead = (over = {}) =>
  JSON.stringify({
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

console.log('--- приём заявок (PHP) ---');
await check('валидная заявка', 201, post(lead()));
await check('телефон из 10 цифр', 201, post(lead({ phone: '9000001122' })));
await check('телефон с восьмёркой', 201, post(lead({ phone: '8 900 000 11 23' })));
await check('пустой массив домов', 201, post(lead({ homes: [] })));
await check('два дома', 201, post(lead({ homes: ['5/1', '6/2'] })));

console.log('\n--- отказы ---');
await check('дом 99/1 не в каталоге', 400, post(lead({ homes: ['99/1'] })));
await check('три дома (лимит 2)', 400, post(lead({ homes: ['5/1', '5/2', '6/1'] })));
await check('consent не true', 400, post(lead({ consent: false })));
await check('неизвестный канал', 400, post(lead({ preferredChannel: 'sms' })));
await check('короткий телефон', 400, post(lead({ phone: '123' })));
await check('имя длиннее 80', 400, post(lead({ name: 'x'.repeat(81) })));
await check('ники длиннее 100', 400, post(lead({ messengerHandle: 'x'.repeat(101) })));
await check('битый JSON', 400, post('{"name":'));
await check('Content-Type не json', 415, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
await check('чужой Origin', 403, post(lead({ phone: '+79000000009' }), { Origin: 'https://evil.example' }));
await check('тело больше 4096', 413, post(lead({ name: 'y'.repeat(5000) })));
await check('GET вместо POST', 405, { method: 'GET' });

console.log('\n--- приманка для ботов ---');
const hp = await fetch(ENDPOINT, post(lead({ phone: '+79000000077', website: 'http://spam.example' })));
console.log(`${hp.status === 201 ? 'OK  ' : 'FAIL'}  honeypot отвечает 201`);
hp.status === 201 ? (pass += 1) : (fail += 1);

console.log('\n--- база ---');
let db;
try {
  db = new DatabaseSync(DB);
  const rows = db.prepare('SELECT phone, preferred_channel, homes FROM leads ORDER BY id').all();
  console.log(`В базе записей: ${rows.length}`);
  for (const r of rows) console.log(`   ${r.phone}  ${r.preferred_channel}  ${r.homes ?? '-'}`);

  const leak = rows.filter((r) => r.phone === '+79000000077');
  const leaked = leak.length > 0;
  console.log(`${leaked ? 'FAIL' : 'OK  '}  заявка бота НЕ записана`);
  leaked ? (fail += 1) : (pass += 1);

  const good = rows.filter((r) => /^79\d{9}$/.test(r.phone.replace('+', '')));
  const allGood = good.length === rows.length;
  console.log(`${allGood ? 'OK  ' : 'FAIL'}  телефоны нормализованы в +79XXXXXXXXX`);
  allGood ? (pass += 1) : (fail += 1);
} catch (e) {
  console.log(`FAIL  не удалось прочитать базу: ${e.message}`);
  fail += 1;
}

console.log(`\nИТОГО: ${pass} прошло, ${fail} провалено`);
process.exit(fail ? 1 : 0);