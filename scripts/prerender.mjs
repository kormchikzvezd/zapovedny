// Предсобирает страницу в обычный HTML на этапе build.
// Нужен там, где хостинг не умеет запускать Node-сервер:
// готовый index.html отдаётся любой площадкой без бэкенда.
//
// Страница одна и весь каталог известен на момент сборки, поэтому
// серверный рендер здесь избыточен.

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { availableHomes, parseHomesJson } from '../catalog/inventory.js';

const ROOT = process.cwd();
const origin = process.env.PUBLIC_ORIGIN || 'https://zapovedny-dom.ru';

const catalog = parseHomesJson(
  await fs.readFile(path.join(ROOT, 'catalog/homes.json'), 'utf8'),
);
const available = availableHomes(catalog);

if (available.length === 0) {
  console.log('Нет домов в продаже — страница всё равно собирается, блок цены будет скрыт кодом.');
}

const entry = path.join(ROOT, 'dist/server/entry.js');
const { renderPage } = await import(pathToFileURL(entry).href);

const response = await renderPage(new Request(`${origin}/`), '/', {});
if (response.status !== 200) {
  throw new Error(`Рендер вернул ${response.status}, ожидался 200`);
}

let html = await response.text();

// В статическом файле нет сервера, который подставил бы канонический адрес.
html = html.replace(/<meta name="origin" content="[^"]*">/g, '');
if (!html.includes('rel="canonical"')) {
  html = html.replace('</head>', `  <link rel="canonical" href="${origin}/" />\n</head>`);
}

// В бандле адрес может быть в одинарных, двойных кавычках или обратных.
// Раньше правились только первые два варианта, и форма уходила в Node.
const toPhp = (text) =>
  text.replace(/(['"`])\/api\/leads\1/g, '$1/api/leads.php$1');

html = toPhp(html);

const chunksRoot = path.join(ROOT, 'dist/client/_next/static');
let patchedChunks = 0;

async function patchChunks(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await patchChunks(full);
      continue;
    }
    if (!/\.(js|mjs)$/.test(entry.name)) continue;
    const code = await fs.readFile(full, 'utf8');
    if (!code.includes('/api/leads')) continue;
    await fs.writeFile(full, toPhp(code), 'utf8');
    patchedChunks += 1;
  }
}

await patchChunks(chunksRoot);
console.log(`Чанков с адресом формы переписано: ${patchedChunks}`);

const outDir = path.join(ROOT, 'dist/client');
const outFile = path.join(outDir, 'index.html');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(outFile, html, 'utf8');

// 404 для любого неизвестного адреса — на хостинге это обычный index.html.
await fs.writeFile(path.join(outDir, '404.html'), html, 'utf8');

const sold = catalog.filter((h) => h.status !== 'available').map((h) => h.id);
console.log(`index.html собран: ${html.length} байт`);
console.log(`Домов в продаже: ${available.length}${sold.length ? `, скрыто: ${sold.join(', ')}` : ''}`);