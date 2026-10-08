<?php
/**
 * Приём заявок «Заповедного» для обычного виртуального хостинга.
 *
 * Работает там, где нельзя запустить Node-сервер: Reg.ru, Timeweb, Beget
 * и любой shared-хостинг с PHP 8 и SQLite или MySQL.
 *
 * Хранилище выбирается автоматически: если в корне лежит data/leads.db или
 * доступен SQLite — пишем туда, иначе пробуем MySQL из настроек хостинга.
 *
 * Настройки Telegram задаются в файле config.php рядом с этим скриптом.
 * config.php не должен попадать в git.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// config.php заполняет владелец хостинга. Без него приём заявок невозможен,
// но падать с белым экраном нельзя: посетитель должен увидеть просьбу позвонить,
// а владелец — понятную причину в журнале.
if (!is_file(__DIR__ . '/config.php')) {
    error_log('Zapovedny: нет api/config.php — скопируйте config.example.php и заполните его.');
    http_response_code(503);
    echo json_encode(['error' => 'not_configured']);
    exit;
}

require __DIR__ . '/config.php';

const MAX_BODY = 4096;
const CHANNELS = ['whatsapp', 'telegram', 'max', 'call'];

// Ответ 200 на всё, что не является отказом по существу: иначе роботы
// поймут, что их отсеяли, и начнут подбирать поле-приманку.
function reply(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Проверки запроса ---------------------------------------------------

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$own = ($_SERVER['HTTPS'] ?? '') !== 'off' ? 'https' : 'http';
$own .= '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    reply(405, ['error' => 'method_not_allowed']);
}

if ($origin !== '' && $origin !== $own && !in_array($origin, ALLOWED_ORIGINS, true)) {
    reply(403, ['error' => 'invalid_origin']);
}

$type = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
if (!str_starts_with($type, 'application/json')) {
    reply(415, ['error' => 'invalid_type']);
}

$length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($length > MAX_BODY) {
    reply(413, ['error' => 'too_large']);
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > MAX_BODY) {
    reply(400, ['error' => 'invalid_json']);
}

$data = json_decode($raw, true);
if (!is_array($data) || array_is_list($data)) {
    reply(400, ['error' => 'invalid_data']);
}

// --- Приманка для роботов ----------------------------------------------
// Поле скрыто от людей. Если его заполнили — бота. Отвечаем успехом,
// но ничего не пишем, чтобы он не понял, что его отсеяли.
if (!empty($data['website'])) {
    reply(201, ['ok' => true]);
}

// --- Валидация ----------------------------------------------------------

function normalize_phone(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $digits = preg_replace('/\D/', '', $value);
    if (strlen($digits) === 10) {
        $digits = '7' . $digits;
    }
    if (strlen($digits) === 11 && $digits[0] === '8') {
        $digits = '7' . substr($digits, 1);
    }
    if (strlen($digits) < 11 || strlen($digits) > 15) {
        return null;
    }
    return '+' . $digits;
}

$name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
$handle = is_string($data['messengerHandle'] ?? null) ? trim($data['messengerHandle']) : '';
$channel = $data['preferredChannel'] ?? null;
$homes = $data['homes'] ?? null;
$phone = normalize_phone($data['phone'] ?? null);

$invalid =
    $phone === null
    || !is_string($channel) || !in_array($channel, CHANNELS, true)
    || ($data['consent'] ?? null) !== true
    || mb_strlen($name) > 80
    || mb_strlen($handle) > 100
    || !is_array($homes)
    || count($homes) > 2;

if ($invalid) {
    reply(400, ['error' => 'invalid_data']);
}

// Адреса сверяются с каталогом на сервере. Проданный дом нельзя выбрать
// даже в обход интерфейса.
$catalog = json_decode((string)@file_get_contents(CATALOG_FILE), true);
$available = [];
foreach (is_array($catalog) ? $catalog : [] as $home) {
    if (($home['status'] ?? '') === 'available') {
        $available[(string)$home['id']] = true;
    }
}
foreach ($homes as $home) {
    if (!is_string($home) || !isset($available[$home])) {
        reply(400, ['error' => 'invalid_data']);
    }
}

// --- Запись -------------------------------------------------------------

$now = gmdate('c');
$homesValue = implode(', ', $homes) ?: null;

try {
    $pdo = db();
    $stmt = $pdo->prepare(
        'INSERT INTO leads
            (created_at, name, phone, preferred_channel, messenger_handle, homes, consent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$now, $name ?: null, $phone, $channel, $handle ?: null, $homesValue, $now]);
} catch (Throwable $error) {
    error_log('Zapovedny: не удалось сохранить заявку: ' . $error->getMessage());
    reply(503, ['error' => 'unavailable']);
}

error_log('Zapovedny: новая заявка ' . $phone . ' канал=' . $channel . ' дома=' . ($homesValue ?? '-'));

notify($phone, $channel, $name, $handle, $homesValue);

reply(201, ['ok' => true]);

// --- Вспомогательное ----------------------------------------------------

/** Подключение к базе: сначала SQLite, при неудаче MySQL. */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (file_exists(SQLITE_FILE) || DB_DRIVER === 'sqlite') {
        $dir = dirname(SQLITE_FILE);
        if (!is_dir($dir)) {
            @mkdir($dir, 0770, true);
        }
        $pdo = new PDO('sqlite:' . SQLITE_FILE, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA busy_timeout = 5000');
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                name TEXT,
                phone TEXT NOT NULL,
                preferred_channel TEXT NOT NULL,
                messenger_handle TEXT,
                homes TEXT,
                consent_at TEXT NOT NULL
            )'
        );
        return $pdo;
    }

    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME),
        DB_USER,
        DB_PASSWORD,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS leads (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            created_at DATETIME NOT NULL,
            name VARCHAR(80) NULL,
            phone VARCHAR(20) NOT NULL,
            preferred_channel VARCHAR(20) NOT NULL,
            messenger_handle VARCHAR(100) NULL,
            homes VARCHAR(255) NULL,
            consent_at DATETIME NOT NULL,
            INDEX leads_created_idx (created_at)
        )'
    );
    return $pdo;
}

/**
 * Уведомление в Telegram. Ошибка доставки не должна мешать сохранению
 * заявки и не должна показываться посетителю: она уже записана.
 */
function notify(string $phone, string $channel, string $name, string $handle, ?string $homes): void
{
    if (TELEGRAM_BOT_TOKEN === '' || TELEGRAM_CHAT_ID === '') {
        return;
    }

    $lines = ['Новая заявка с сайта «Заповедный»', ''];
    $lines[] = 'Телефон: ' . $phone;
    $lines[] = 'Канал: ' . $channel;
    if ($name !== '') {
        $lines[] = 'Имя: ' . $name;
    }
    if ($handle !== '') {
        $lines[] = 'Мессенджер: ' . $handle;
    }
    if ($homes !== null) {
        $lines[] = 'Дома: ' . $homes;
    }

    $ch = curl_init('https://api.telegram.org/bot' . TELEGRAM_BOT_TOKEN . '/sendMessage');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'chat_id' => TELEGRAM_CHAT_ID,
            'text' => implode("\n", $lines),
        ], JSON_UNESCAPED_UNICODE),
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status !== 200) {
        error_log('Zapovedny: Telegram не доставил уведомление, HTTP ' . $status . ': ' . (string)$body);
    }
}