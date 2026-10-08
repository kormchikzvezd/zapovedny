// Собирает папку, которую достаточно загрузить в корень сайта на хостинге.
//
// Внутри: статическая страница со всеми файлами, PHP-обработчик заявок,
// каталог домов и конфиг-шаблон. Node на сервере не нужен вообще.
//
// Запуск:  npm run package:shared
// Результат: dist/upload-zapovedny/  (загрузить в панели хостинга)

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dist/upload-zapovedny');
const SHARED = path.join(ROOT, 'deploy/shared-hosting');

const exists = (p) => fs.existsSync(p);

for (const required of [
  path.join(ROOT, 'dist/client/index.html'),
  path.join(ROOT, 'dist/client/images'),
  path.join(ROOT, 'dist/client/_next'),
  SHARED,
]) {
  if (!exists(required)) {
    console.error(`Нет ${path.relative(ROOT, required)}. Сначала выполните npm run build.`);
    process.exit(1);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};

// Страница и её ресурсы.
copy(path.join(ROOT, 'dist/client'), OUT);

// Обработчик заявок и каталог.
copy(path.join(SHARED, 'api/leads.php'), path.join(OUT, 'api/leads.php'));
copy(path.join(SHARED, 'api/config.example.php'), path.join(OUT, 'api/config.example.php'));
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
copy(path.join(ROOT, 'catalog/homes.json'), path.join(OUT, 'data/homes.json'));

// Правила для Apache: отдаём index.html по умолчанию и закрываем служебное.
fs.writeFileSync(
  path.join(OUT, '.htaccess'),
  `# Заповедный — настройки Apache для виртуального хостинга.

# Человек открывает адрес без .php — отдаём главную страницу.
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On

  # Заявки принимает один обработчик.
  RewriteRule ^api/leads/?$ api/leads.php [L]

  # Любой другой адрес ведёт на главную: сайт одностраничный.
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Конфиг с токеном Telegram не должен отдаваться наружу.
<Files "config.php">
  Require all denied
</Files>

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml application/json
</IfModule>

# Фотографии и шрифты меняются редко — можно хранить месяцами.
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/webp "access plus 30 days"
  ExpiresByType image/jpeg "access plus 30 days"
  ExpiresByType font/ttf "access plus 1 year"
  ExpiresByType text/css "access plus 7 days"
  ExpiresByType application/javascript "access plus 7 days"
  ExpiresByType text/html "access plus 1 hour"
</IfModule>
`,
  'utf8',
);

// Памятка внутри пакета.
fs.writeFileSync(
  path.join(OUT, 'ЧТО-ДЕЛАТЬ-НА-СЕРВЕРЕ.txt'),
  `Как поднять «Заповедный» на виртуальном хостинге
=============================================

1. Загрузите всё содержимое этой папки в корень сайта zapovedny-dom.ru
   через файловый менеджер панели или по FTP. Заменяйте файлы, а не
   добавляйте рядом.

2. Создайте data/leads.db и положите рядом homes.json (уже лежит).
   Права на папку data: 770. Файл базы создастся сам при первой заявке.

3. Скопируйте api/config.example.php в api/config.php и заполните:
     TELEGRAM_BOT_TOKEN — токен от @BotFather
     TELEGRAM_CHAT_ID  — идентификатор чата
   Если это не сделать, заявки будут сохраняться, но вы о них не узнаете.

4. Включите SSL-сертификат в панели хостинга.

5. Проверьте: https://zapovedny-dom.ru/ должна открыться главная.
   Отправьте тестовую заявку и убедитесь, что она пришла в Telegram.

6. Домен zapovedny-dom.ru нужно привязать к этому хостингу
   в панели reg.ru, раздел «Домены и поддомены» -> «Управление».

Посмотреть заявки
-----------------
В панели хостинга откройте phpMyAdmin (или используйте SQLite),
либо выполните на сервере:
  sqlite3 data/leads.db "select * from leads order by id desc limit 20;"

Продали дом
-----------
Откройте data/homes.json, найдите нужный адрес, замените
"status": "available" на "status": "sold" и загрузите файл заново.
Сайт читает этот файл при каждом запросе — пересборка не нужна.
`,
  'utf8',
);

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
})(OUT);

const bytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
console.log(`Папка для загрузки: ${path.relative(ROOT, OUT)}`);
console.log(`Файлов: ${files.length}, размер: ${(bytes / 1024 / 1024).toFixed(2)} МБ`);

// Проверка, что форма действительно переключилась на PHP.
const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
let chunkHits = 0;
(function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(full); continue; }
    if (!/\.js$/.test(entry.name)) continue;
    const code = fs.readFileSync(full, 'utf8');
    if (code.includes('/api/leads.php')) chunkHits += 1;
    if (code.includes("'/api/leads'")) {
      console.error(`В ${path.relative(OUT, full)} остался адрес Node. Запустите npm run build.`);
      process.exit(1);
    }
  }
})(path.join(OUT, '_next'));

console.log(`Форма переключена на PHP: ${chunkHits > 0 ? 'да' : 'НЕТ'}`);
if (html.includes('"/api/leads"')) {
  console.error('В HTML остался адрес Node. Запустите npm run build.');
  process.exit(1);
}