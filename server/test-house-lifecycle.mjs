// Проверка сценария «дом продан»: скрывается в интерфейсе и отклоняется сервером.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const CATALOG = 'catalog/homes.json';
const original = fs.readFileSync(CATALOG, 'utf8');
const BASE = process.env.BASE || 'http://127.0.0.1:3000';

const write = (text) => fs.writeFileSync(CATALOG, text.replace(/^\uFEFF/, ''), 'utf8');
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe' });
const rebuild = () => {
  sh('node', ['node_modules/vinext/dist/cli.js', 'build']);
  sh('node', ['scripts/build.mjs']);
};
const restart = async () => {
  execFileSync('powershell', [
    '-Command',
    "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
      'Where-Object { $_.CommandLine -match "server.mjs" } | ' +
      'ForEach-Object { Stop-Process -Id $_.ProcessId -Force }',
  ], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2000));
  const { spawn } = await import('node:child_process');
  spawn('node', ['server/server.mjs'], { detached: true, stdio: 'ignore' }).unref();
  await new Promise((r) => setTimeout(r, 6000));
};

const lead = (home) =>
  fetch(`${BASE}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'T', phone: '+79000000000', preferredChannel: 'call', homes: [home], consent: true }),
  });

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

try {
  console.log('--- 8/1 в продаже (исходное состояние) ---');
  await restart();
  let health = await (await fetch(`${BASE}/api/health`)).json();
  check('8/1 есть в списке доступных', health.availableHomes.includes('8/1'));
  check('заявка на 8/1 принимается', (await lead('8/1')).status === 201);

  console.log('\n--- помечаем 8/1 проданным и пересобираем ---');
  write(original.replace('"id": "8/1", "name": "Казачья, 8/1", "layout": "standard", "mapUrl": "https://2gis.ru/tomsk/geo/70030077014628503", "status": "available"',
    '"id": "8/1", "name": "Казачья, 8/1", "layout": "standard", "mapUrl": "https://2gis.ru/tomsk/geo/70030077014628503", "status": "sold"'));
  rebuild();
  await restart();

  health = await (await fetch(`${BASE}/api/health`)).json();
  check('8/1 исчез из списка доступных', !health.availableHomes.includes('8/1'));
  check('в продаже осталось 9 домов', health.availableHomes.length === 9, `получено ${health.availableHomes.length}`);

  const html = await (await fetch(BASE)).text();
  check('8/1 не упоминается в HTML страницы', !html.includes('8/1'));
  check('остальные адреса на месте', ['5/1', '6/2', '7/1', '11/2'].every((id) => html.includes(id)));

  const sold = await lead('8/1');
  check('сервер отклоняет заявку на проданный дом', sold.status === 400, `статус ${sold.status}`);

  const okHome = await lead('5/1');
  check('заявка на свободный дом по-прежнему принимается', okHome.status === 201);

  console.log('\n--- новый дом 9/1 в статусе preparing ---');
  const withNew = JSON.parse(original.replace(/^\uFEFF/, ''));
  withNew.push({ id: '9/1', name: 'Казачья, 9/1', layout: 'standard', mapUrl: 'https://2gis.ru/tomsk/search/Казачья%20улица%209%2F1', status: 'preparing' });
  write(JSON.stringify(withNew, null, 2));
  rebuild();
  await restart();
  health = await (await fetch(`${BASE}/api/health`)).json();
  check('9/1 не показывается, пока preparing', !health.availableHomes.includes('9/1'));
  const html2 = await (await fetch(BASE)).text();
  check('9/1 нет в HTML', !html2.includes('9/1'));

  console.log('\n--- 9/1 становится available ---');
  const promoted = withNew.map((h) => (h.id === '9/1' ? { ...h, status: 'available' } : h));
  write(JSON.stringify(promoted, null, 2));
  rebuild();
  await restart();
  health = await (await fetch(`${BASE}/api/health`)).json();
  check('9/1 появился в продаже', health.availableHomes.includes('9/1'));
  check('заявка на 9/1 принимается', (await lead('9/1')).status === 201);
} finally {
  console.log('\n--- возвращаем каталог к реальному состоянию ---');
  write(original);
  rebuild();
  await restart();
  const health = await (await fetch(`${BASE}/api/health`)).json();
  check('каталог восстановлен: 10 домов в продаже', health.availableHomes.length === 10, `получено ${health.availableHomes.length}`);
}

console.log(`\nИТОГО: ${pass} прошло, ${fail} провалено`);
process.exit(fail ? 1 : 0);