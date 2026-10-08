import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Window } from 'happy-dom';
import { availableHomes, validateHomes, parseHomesJson } from '../catalog/inventory.js';

const root = process.cwd();
const catalog = validateHomes(parseHomesJson(await fs.readFile(path.join(root, 'catalog/homes.json'), 'utf8')));
const visibleHomes = availableHomes(catalog);
const hiddenHomes = catalog.filter((home) => home.status !== 'available');
const sampleHome = { id: '99/1', name: 'Казачья, 99/1', layout: 'standard', mapUrl: 'https://2gis.ru/tomsk/geo/123', status: 'preparing' };
assert.equal(availableHomes([{ ...sampleHome, status: 'sold' }, sampleHome]).length, 0);
assert.equal(availableHomes([{ ...sampleHome, status: 'available' }]).length, 1);
assert.throws(() => validateHomes([sampleHome, sampleHome]), /Повторяется адрес/);
const window = new Window({ url: 'https://zapovedny.test/' });

globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.FormData = window.FormData;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const server = await import(pathToFileURL(path.join(root, 'dist/server/entry.js')).href);
const css = await fs.readFile(path.join(root, 'styles/globals.css'), 'utf8');
const response = await server.renderPage(new Request('https://zapovedny.test/'), '/', {});
const html = await response.text();
const worker = await import(pathToFileURL(path.join(root, 'dist/server/index.js')).href);
const bundledWorker = await fs.readFile(path.join(root, 'dist/server/index.js'), 'utf8');
assert.ok(bundledWorker.length > 100_000 && !bundledWorker.includes("import * as pages from './entry.js'"), 'Publishable worker must be bundled');
const workerResponse = await worker.default.fetch(new Request('https://zapovedny.test/'), {});
const assetResponse = await worker.default.fetch(new Request('https://zapovedny.test/_next/static/test.js'), {
  ASSETS: { fetch: async () => new Response('asset-ok') },
});
const projectImageResponse = await worker.default.fetch(new Request('https://zapovedny.test/images/kazachya-aerial.webp'), {
  ASSETS: { fetch: async () => new Response('project-image-ok') },
});

assert.equal(response.status, 200);
assert.equal(workerResponse.status, 200);
assert.equal(await assetResponse.text(), 'asset-ok');
assert.equal(await projectImageResponse.text(), 'project-image-ok');
assert.equal(projectImageResponse.headers.get('Content-Type'), 'image/webp');
for (const phrase of ['Заповедный', 'Планировка', 'Сравнить адреса', 'Казачья вечером', '/images/kazachya-aerial.webp', '/images/kazachya-2gis-map.webp', '/images/plan-first-floor.jpg', 'Спутник', 'Место под лестницей', 'Визуализация', 'Кухня-гостиная', 'Осень в', '/images/living-green.webp', '/images/autumn-river-sunset.webp']) {
  assert.equal(html.includes(phrase), true, `SSR did not contain ${phrase}`);
}
for (const home of visibleHomes) assert.equal(html.includes(home.name), true, `${home.name} should be listed`);
for (const home of hiddenHomes) assert.equal(html.includes(home.name), false, `${home.name} must be hidden`);
assert.equal(css.includes('images.unsplash.com'), false, 'Stylesheet still references stock photos');
assert.equal((await fs.readdir(path.join(root, 'dist/client/images'))).length, 20);
assert.equal(html.includes('В ПРОДАЖЕ'), visibleHomes.length > 0, 'Availability should match the catalog');
assert.equal(html.includes('Казачья, 10/2'), false, 'Old addresses must not appear');
assert.equal(html.includes('Не по проекту'), false, 'Ambiguous heading must be removed');
assert.equal(html.includes('Уже построен.'), visibleHomes.length > 0, 'Finished house heading follows inventory');
assert.equal(html.includes('8 млн ₽'), visibleHomes.length > 0, 'Price offer should be hidden when no homes are for sale');

let savedLead;
const DB = { prepare(statement) {
  assert.match(statement, /INSERT INTO leads/);
  return { bind(...values) { savedLead = values; return { run: async () => ({ success: true }) }; } };
} };
const leadRequest = (body, origin = 'https://zapovedny.test') => new Request('https://zapovedny.test/api/leads', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
});
const validLead = { name: 'Анна', phone: '8 900 123-45-67', preferredChannel: 'max', messengerHandle: '@anna', homes: visibleHomes.length ? [visibleHomes[0].id] : [], consent: true };
const savedResponse = await worker.default.fetch(leadRequest(validLead), { DB });
assert.equal(savedResponse.status, 201);
assert.deepEqual(savedLead.slice(0, 5), ['Анна', '+79001234567', 'max', '@anna', validLead.homes.join(', ') || null]);
assert.equal((await worker.default.fetch(leadRequest({ ...validLead, homes: ['10/2'] }), { DB })).status, 400);
if (hiddenHomes.length) assert.equal((await worker.default.fetch(leadRequest({ ...validLead, homes: [hiddenHomes[0].id] }), { DB })).status, 400);
assert.equal((await worker.default.fetch(leadRequest({ ...validLead, consent: false }), { DB })).status, 400);
assert.equal((await worker.default.fetch(leadRequest(validLead, 'https://foreign.test'), { DB })).status, 403);
assert.equal((await worker.default.fetch(leadRequest(validLead), {})).status, 503);

globalThis.window = window;
globalThis.document = window.document;
const document = window.document;
const container = document.createElement('div');
document.body.append(container);
const reactRoot = createRoot(container);

await React.act(async () => {
  reactRoot.render(React.createElement(server.pageRoutes[0].module.default));
});

for (const selector of ['.hero-call-button', '.house-call-button', '.mobile-call']) {
  assert.equal(container.querySelector(selector)?.getAttribute('href'), 'tel:+79234256836', `${selector} should open the dialer`);
}
assert.match(container.querySelector('.house-call-button').textContent, /8 923 425-68-36/);

const click = async (element) => {
  assert.ok(element, 'Expected interactive element to exist');
  await React.act(async () => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
};

await click(container.querySelector('.header-cta'));
assert.match(container.querySelector('.lead-modal>p').textContent, visibleHomes.length ? /дома на Казачьей/ : /новых адресах на Казачьей/);
assert.doesNotMatch(container.querySelector('.lead-modal>p').textContent, /8\/1/);
assert.equal(container.querySelectorAll('.contact-options input[type="radio"]').length, 4);
await click(container.querySelector('.modal-close'));

assert.deepEqual([...container.querySelectorAll('.map-addresses button')].map((button) => button.textContent), visibleHomes.map((home) => home.id));
assert.equal(container.querySelector('.map-preview-image').getAttribute('src'), '/images/kazachya-2gis-map.webp');
assert.equal(container.querySelector('[aria-label="Уменьшить карту"]').disabled, true);
await click(container.querySelector('[aria-label="Увеличить карту"]'));
assert.equal(container.querySelector('.map-preview-image').style.transform, 'scale(1.18)');
await click(container.querySelector('.map-view-switch button:last-child'));
assert.equal(container.querySelector('.map-preview-image').getAttribute('src'), '/images/kazachya-satellite-map.webp');
assert.equal(container.querySelector('.map-preview-image').style.transform, 'scale(1)');
assert.match(container.querySelector('.map-label').textContent, /Спутник/);
await click(container.querySelector('.map-view-switch button:first-child'));
assert.equal(container.querySelector('.map-preview-image').getAttribute('src'), '/images/kazachya-2gis-map.webp');
assert.ok(container.querySelector('a[aria-label="Открыть интерактивную карту улицы Казачьей в 2ГИС"]'));
const standardHome = visibleHomes.find((home) => home.layout === 'standard');
if (standardHome) {
  await click(container.querySelector(`[aria-label="Выбрать дом ${standardHome.id}"]`));
  assert.equal(container.querySelector('.house-card h3').textContent, standardHome.name);
  assert.match(container.querySelector('.house-layout').textContent, /две детские и родительская с балконом/);
}
const chosenHome = visibleHomes.find((home) => home.layout === 'extra-room') ?? standardHome ?? visibleHomes[0];
if (chosenHome) {
  await click(container.querySelector(`[aria-label="Выбрать дом ${chosenHome.id}"]`));
  assert.equal(container.querySelector('.house-card h3').textContent, chosenHome.name);
  if (chosenHome.layout === 'extra-room') assert.match(container.querySelector('.house-layout').textContent, /отдельный вход в кухню/);
  if (visibleHomes.length > 1) assert.equal(container.querySelector('select[aria-label="Первый дом для сравнения"]').value, chosenHome.id);
}

assert.equal(container.querySelectorAll('.gallery-item').length, 6);
assert.equal(container.querySelectorAll('.plans-grid img').length, 2);
assert.equal(container.querySelectorAll('.interior-card').length, 3);
assert.equal(container.querySelectorAll('.living-card').length, 3);
assert.equal(container.querySelectorAll('.autumn-card').length, 4);
await click(container.querySelector('.living-card'));
assert.match(container.querySelector('.gallery-caption').textContent, /Тёплый зелёный/);
await click(container.querySelector('.gallery-dialog [aria-label="Следующее изображение"]'));
assert.match(container.querySelector('.gallery-caption').textContent, /Спокойный орех/);
await click(container.querySelector('.gallery-dialog [aria-label="Закрыть изображение"]'));
await click(container.querySelector('.autumn-card'));
assert.match(container.querySelector('.gallery-caption').textContent, /Закат у воды/);
await click(container.querySelector('.gallery-dialog [aria-label="Закрыть изображение"]'));
await click(container.querySelector('.gallery-item'));
assert.match(container.querySelector('.gallery-caption').textContent, /Казачья вечером/);
await click(container.querySelector('[aria-label="Следующее изображение"]'));
assert.match(container.querySelector('.gallery-caption').textContent, /Фасад дуплекса/);
await click(container.querySelector('[aria-label="Закрыть изображение"]'));
assert.equal(container.querySelector('.gallery-lightbox'), null);

if (visibleHomes.length) {
  const areaSlider = container.querySelector('input[aria-label="Площадь квартиры"]');
  await React.act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor.set.call(areaSlider, '90');
    areaSlider.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  assert.equal(container.querySelector('.main-result strong').textContent, '+80');

  const priceSlider = container.querySelector('input[aria-label="Стоимость квартиры"]');
  await React.act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor.set.call(priceSlider, '10000000');
    priceSlider.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  assert.match(container.querySelector('.result-metrics').textContent, /111\s?111\s?₽\/м²/);
}

await click(container.querySelector('.house-button'));
if (chosenHome) assert.match(container.querySelector('.lead-modal>p').textContent, new RegExp(chosenHome.name.replace('/', '\\/')));
assert.ok(container.querySelector('a[href^="https://wa.me/79234256836"]'));
assert.ok(container.querySelector('a[href="tel:+79234256836"]'));

const changeInput = async (selector, value) => {
  const element = container.querySelector(selector);
  await React.act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor.set.call(element, value);
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};
await changeInput('.lead-field input[type="text"]', 'Анна');
await changeInput('.lead-field input[type="tel"]', '+7 900 123-45-67');
await click(container.querySelector('.contact-options input[value="telegram"]'));
assert.ok(container.querySelector('.lead-field input[placeholder="Можно оставить пустым"]'));
await changeInput('.lead-field input[placeholder="Можно оставить пустым"]', '@anna');
await click(container.querySelector('.lead-consent input'));
const originalFetch = globalThis.fetch;
let submitted;
globalThis.fetch = async (url, options) => { submitted = { url, ...JSON.parse(options.body) }; return new Response(JSON.stringify({ ok: true }), { status: 201 }); };
await React.act(async () => container.querySelector('.lead-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
assert.equal(submitted.url, '/api/leads');
assert.equal(submitted.preferredChannel, 'telegram');
assert.deepEqual(submitted.homes, chosenHome ? [chosenHome.id] : []);
assert.match(container.querySelector('.lead-success').textContent, /Заявка/);
globalThis.fetch = originalFetch;
await click(container.querySelector('.modal-close'));
assert.equal(container.querySelector('[role="dialog"]'), null);

if (visibleHomes.length > 1) {
  const comparedHome = visibleHomes.find((home) => home.id !== chosenHome.id);
  const secondHome = container.querySelector('select[aria-label="Второй дом для сравнения"]');
  await React.act(async () => {
    secondHome.value = comparedHome.id;
    secondHome.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await click(container.querySelector('.comparison-link'));
  assert.match(container.querySelector('.lead-modal>p').textContent, new RegExp(`${chosenHome.name.replace('/', '\\/')} и ${comparedHome.name.replace('/', '\\/')}`));
  await click(container.querySelector('.modal-close'));
} else {
  assert.equal(container.querySelector('.comparison-table'), null);
}

await click(container.querySelector('.menu-toggle'));
assert.equal(container.querySelector('.navigation').classList.contains('navigation-open'), true);
assert.match(css, /@media\(max-width:760px\)/);

await React.act(async () => reactRoot.unmount());
window.happyDOM.abort();

console.log(JSON.stringify({ serverRender: 'passed', sitesWorker: 'passed', staticAssets: 'passed', projectImages: 'passed', imageGallery: 'passed', interiorIdeas: 'passed', livingIdeas: 'passed', autumnGallery: 'passed', responsiveNavigation: 'passed', mapSelection: 'passed', mapLayers: 'passed', mapZoom: 'passed', comparison: 'passed', calculator: 'passed', leadForm: 'passed', htmlBytes: Buffer.byteLength(html) }));
