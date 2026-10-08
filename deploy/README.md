# Развёртывание «Заповедного» на VPS

Проверено локально на Windows (Node.js 24.18). На сервере нужен Node.js 22 или новее —
из-за `node:sqlite`, на котором держится база заявок.

## 1. Подготовка сервера

```bash
# Node.js 24 через NodeSource
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# пользователь без входа в систему
sudo adduser --system --group --home /opt/zapovedny zapovedny
```

## 2. Загрузка проекта

```bash
sudo mkdir -p /opt/zapovedny
sudo chown zapovedny:zapovedny /opt/zapovedny
sudo -u zapovedny git clone <адрес-репозитория> /opt/zapovedny/app
cd /opt/zapovedny/app
npm ci
```

## 3. Переменные окружения

Файл `/opt/zapovedny/app/.env` — **вне git, права 600**.

```
PORT=3000
PUBLIC_ORIGIN=https://zapovedny-dom.online
DATA_DIR=/opt/zapovedny/data
DB_PATH=/opt/zapovedny/data/leads.db
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=987654321
```

`PUBLIC_ORIGIN` обязателен в продакшене: по нему проверяется `Origin` при приёме заявок
и формируются абсолютные адреса при серверном рендере.

Без `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` заявки всё равно сохраняются, но уведомлений не будет.

```bash
sudo chown zapovedny:zapovedny /opt/zapovedny/app/.env
sudo chmod 600 /opt/zapovedny/app/.env
```

## 4. Сборка

```bash
cd /opt/zapovedny/app
sudo -u zapovedry npm run homes:check   # если запись в каталоге не нужна — sudo -u zapovedny
sudo -u zapovedny npm run build
sudo -u zapovedny npm test
```

## 5. Служба systemd

Файл `deploy/zapovedny.service`:

```bash
sudo cp deploy/zapovedny.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zapovedny
sudo systemctl status zapovedny
```

Проверка:

```bash
curl -s http://127.0.0.1:3000/api/health
```

Ожидается `{"ok":true,"db":true,"availableHomes":[...]}`.
Если `db:false` — база недоступна, заявки не сохраняются.

## 6. nginx и HTTPS

Файл `deploy/nginx.conf`:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/zapovedny
sudo ln -sf /etc/nginx/sites-available/zapovedny /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d zapovedny-dom.online
```

## 7. Резервное копирование

Файл `deploy/backup.sh` — копия базы раз в сутки в 04:17, хранение 14 дней.

```bash
sudo cp deploy/backup.sh /usr/local/bin/zapovedny-backup
sudo chmod +x /usr/local/bin/zapovedny-backup
sudo crontab -e
# добавить строку:
17 4 * * * /usr/local/bin/zapovedny-backup >> /var/log/zapovedny-backup.log 2>&1
```

Проверка и восстановление:

```bash
sudo /usr/local/bin/zapovedny-backup          # создать копию сейчас
ls -la /opt/zapovedny/backups/

# восстановление
sudo systemctl stop zapovedny
sudo cp /opt/zapovedny/backups/leads-ДАТА.db.gz /opt/zapovedny/data/leads.db
gunzip /opt/zapovedny/data/leads.db.gz
sudo systemctl start zapovedny
```

## 8. Откат версии

```bash
cd /opt/zapovedny/app
git log --oneline -5
git checkout <предыдущий-коммит>
npm ci && npm run build
sudo systemctl restart zapovedny
```

База при откате не трогается: структура таблицы не менялась.

## 9. Обновление каталога домов

```bash
cd /opt/zapovedny/app
npm run homes -- list                 # посмотреть
npm run homes -- status 8/1 sold      # поставить статус
npm run homes -- add 9/1 standard "https://2gis.ru/tomsk/..."   # добавить
npm run homes:check && npm run build  # проверить и пересобрать
sudo systemctl restart zapovedny
```

Подробности — в `OWNER_GUIDE.md`.

## 10. Что проверить после развёртывания

| Проверка | Ожидание |
| --- | --- |
| `curl https://zapovedny-dom.online/api/health` | `{"ok":true,"db":true,...}` |
| Главная на телефоне | Вёрстка целая, нижняя панель «Позвонить» на месте |
| Все фото | `/images/*` отдаются, не 404 |
| Шрифты | `/fonts/*` отдаются |
| Звонок | Кнопки ведут на `tel:+79234256836`, показывают 8 923 425-68-36 |
| Тестовая заявка | Появляется в базе **и** приходит в Telegram |
| Ошибка базы | Не показывает «успех», предлагает позвонить |
| Проданный дом | Исчезает с сайта и отклоняется сервером |

## Логи

```bash
sudo journalctl -u zapovedny -f              # журнал службы
sudo journalctl -u zapovedny --since today   # только сегодня
tail -f /var/log/nginx/access.log            # запросы
```