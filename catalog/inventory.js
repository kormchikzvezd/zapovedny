export const HOME_STATUSES = ['available', 'reserved', 'sold', 'preparing'];
export const HOME_LAYOUTS = ['standard', 'extra-room', 'confirm'];

// Каталог правят вручную, в том числе в редакторах Windows, которые добавляют BOM.
// Без этой защиты сборка падает с SyntaxError на невидимом символе.
export function parseHomesJson(text) {
  return JSON.parse(String(text).replace(/^\uFEFF/, ''));
}

export function availableHomes(homes) {
  return homes.filter((home) => home.status === 'available');
}

export function validateHomes(homes) {
  if (!Array.isArray(homes)) throw new Error('Каталог домов должен быть массивом.');
  const seen = new Set();
  for (const home of homes) {
    if (!home || typeof home !== 'object' || Array.isArray(home)) throw new Error('Каждый дом должен быть объектом.');
    if (typeof home.id !== 'string' || !/^\d+\/\d+$/.test(home.id)) throw new Error('Номер дома должен иметь вид 9/1.');
    if (seen.has(home.id)) throw new Error(`Повторяется адрес ${home.id}.`);
    seen.add(home.id);
    if (home.name !== `Казачья, ${home.id}`) throw new Error(`Проверьте название дома ${home.id}.`);
    if (!HOME_LAYOUTS.includes(home.layout)) throw new Error(`Неизвестная планировка у ${home.id}.`);
    if (!HOME_STATUSES.includes(home.status)) throw new Error(`Неизвестный статус у ${home.id}.`);
    if (typeof home.mapUrl !== 'string' || !home.mapUrl.startsWith('https://2gis.ru/tomsk/')) throw new Error(`Проверьте ссылку 2ГИС у ${home.id}.`);
  }
  return homes;
}
