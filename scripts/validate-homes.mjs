import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateHomes, availableHomes, parseHomesJson } from '../catalog/inventory.js';

const path = fileURLToPath(new URL('../catalog/homes.json', import.meta.url));
const homes = validateHomes(parseHomesJson(readFileSync(path, 'utf8')));
console.log(`Каталог проверен: ${homes.length} адресов, в продаже ${availableHomes(homes).length}.`);
