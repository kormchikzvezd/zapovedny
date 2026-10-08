import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { availableHomes, HOME_LAYOUTS, HOME_STATUSES, validateHomes, parseHomesJson } from '../catalog/inventory.js';

const file = fileURLToPath(new URL('../catalog/homes.json', import.meta.url));
const homes = validateHomes(parseHomesJson(readFileSync(file, 'utf8')));
const [action, id, value, mapUrl] = process.argv.slice(2);

if (action === 'list' && !id) {
  console.table(homes.map(({ id, name, status, layout }) => ({ id, name, status, layout })));
  console.log(`В продаже: ${availableHomes(homes).length}.`);
} else if (action === 'status' && id && value && !mapUrl) {
  if (!HOME_STATUSES.includes(value)) throw new Error(`Статус: ${HOME_STATUSES.join(', ')}.`);
  const home = homes.find((item) => item.id === id);
  if (!home) throw new Error(`Адрес ${id} не найден.`);
  home.status = value;
  validateHomes(homes);
  writeFileSync(file, `${JSON.stringify(homes, null, 2)}\n`);
  console.log(`Казачья, ${id}: ${value}. В продаже: ${availableHomes(homes).length}. Изменения появятся на сайте после публикации.`);
} else if (action === 'add' && id && value && mapUrl) {
  if (!HOME_LAYOUTS.includes(value)) throw new Error(`Планировка: ${HOME_LAYOUTS.join(', ')}.`);
  homes.push({ id, name: `Казачья, ${id}`, layout: value, mapUrl, status: 'preparing' });
  validateHomes(homes);
  writeFileSync(file, `${JSON.stringify(homes, null, 2)}\n`);
  console.log(`Казачья, ${id} добавлена со статусом preparing. После проверки готовности переведите её в available и опубликуйте сайт.`);
} else {
  console.error('Использование: npm run homes -- list | status 5/1 sold | add 9/1 standard https://2gis.ru/tomsk/...');
  process.exitCode = 1;
}
