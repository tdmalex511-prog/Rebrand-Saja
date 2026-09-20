<?php
// Hata raporlamasını ve çıktı tamponunu tamamen temizleyelim
error_reporting(0);
ini_set('display_errors', 0);
while (ob_get_level()) {
    ob_end_clean();
}

// Bot Token Tanımlaması
define('BOT_TOKEN', '8963816483:AAHHgIrOstR6eT3N5WUhgVQPAHxjM7jLjTg');
define('API_URL', 'https://api.telegram.org/bot' . BOT_TOKEN . '/');

// Basit Dosya Tabanlı Veritabanı
$dbFile = 'keys.json';

function getKeysData() {
    global $dbFile;
    if (!file_exists($dbFile)) {
        file_put_contents($dbFile, json_encode([], JSON_PRETTY_PRINT));
    }
    $content = file_get_contents($dbFile);
    return $content ? json_decode($content, true) : [];
}

function saveKeysData($data) {
    global $dbFile;
    file_put_contents($dbFile, json_encode($data, JSON_PRETTY_PRINT));
}

// ---------------------------------------------------------
// 1. LUA SCRIPT İÇİN API KONTROLÜ (?key=xxxx)
// ---------------------------------------------------------
if (isset($_GET['key'])) {
    header('Content-Type: text/plain; charset=utf-8');
    $userKey = trim($_GET['key']);
    $keys = getKeysData();

    if (isset($keys[$userKey])) {
        if ($keys[$userKey]['status'] === 'active') {
            echo "success";
        } else {
            echo "banned";
        }
    } else {
        echo "invalid";
    }
    exit;
}

// ---------------------------------------------------------
// 2. TELEGRAM BOT İŞLEMLERİ (Anında Yanıt Veren Yapı)
// ---------------------------------------------------------
$content = file_get_contents("php://input");
$update = json_decode($content, true);

if (!$update) {
    exit;
}

// Normal Mesajlar (/start vb.)
if (isset($update["message"])) {
    $chatId = $update["message"]["chat"]["id"];
    $messageText = isset($update["message"]["text"]) ? trim($update["message"]["text"]) : "";

    if ($messageText === "/start") {
        sendMainMenu($chatId);
    } 
    elseif (strpos($messageText, '/') === 0) {
        handleAdminCommands($chatId, $messageText);
    }
}

// Buton Tıklamaları (Callback Query)
if (isset($update["callback_query"])) {
    $callbackQuery = $update["callback_query"];
    $callbackId = $callbackQuery["id"];
    $chatId = $callbackQuery["message"]["chat"]["id"];
    $data = $callbackQuery["data"];

    // 1. Önce Telegram'a butonun dönmesini durduracak onayı anında fırlatalım
    fastPost("answerCallbackQuery", [
        "callback_query_id" => $callbackId,
        "text" => "İşlem yapılıyor..."
    ]);

    // 2. Key türünü kontrol edip veritabanına kaydedelim
    if (in_array($data, ['gunluk', 'haftalik', 'aylik', 'sinirsiz', 'free1000'])) {
        $key = generateAndSaveKey($data);
        $replyText = "Yeni Key Üretildi ve Kaydedildi!\n\nTür: " . strtoupper($data) . "\nKey: " . $key;
    } else {
        $replyText = "Geçersiz işlem.";
    }

    // 3. Üretilen key'i kullanıcıya mesaj olarak gönderelim
    sendMessage($chatId, $replyText);
}

// Ana Menü Gönderimi (Butonlar)
function sendMainMenu($chatId) {
    $keyboard = [
        'inline_keyboard' => [
            [
                ['text' => '📅 Günlük Key', 'callback_data' => 'gunluk'],
                ['text' => '📆 Haftalık Key', 'callback_data' => 'haftalik']
            ],
            [
                ['text' => '🗓️ Aylık Key', 'callback_data' => 'aylik'],
                ['text' => '♾️ Sınırsız Key', 'callback_data' => 'sinirsiz']
            ],
            [
                ['text' => '🎁 Free 1000 Cihaz Key', 'callback_data' => 'free1000']
            ]
        ]
    ];

    $replyText = "Starbaba Key Paneline Hoş Geldiniz\n\nLütfen oluşturmak istediğiniz key türünü seçin:";
    
    fastPost("sendMessage", [
        'chat_id' => $chatId,
        'text' => $replyText,
        'reply_markup' => json_encode($keyboard)
    ]);
}

// Key Üretme ve Kaydetme
function generateAndSaveKey($type) {
    $typePrefixMap = [
        'gunluk' => 'GUN',
        'haftalik' => 'HAF',
        'aylik' => 'AYL',
        'sinirsiz' => 'SNI',
        'free1000' => 'FRE'
    ];
    
    $code = isset($typePrefixMap[$type]) ? $typePrefixMap[$type] : 'VIP';
    $prefix = "STARBABA-" . $code . "-";
    $randomStr = strtoupper(bin2hex(random_bytes(4)));
    $key = $prefix . $randomStr;

    $keys = getKeysData();
    $keys[$key] = [
        'type' => $type,
        'status' => 'active',
        'created_at' => date('Y-m-d H:i:s')
    ];
    saveKeysData($keys);

    return $key;
}

// Admin Komutları İşleyicisi (/kban, /kuniban, /ksil, /kreset)
function handleAdminCommands($chatId, $text) {
    $parts = explode(' ', $text);
    $command = strtolower($parts[0]);
    $targetKey = isset($parts[1]) ? trim($parts[1]) : '';

    $keys = getKeysData();
    $replyText = "";

    if (empty($targetKey)) {
        sendMessage($chatId, "Lütfen bir key belirtin! Örnek: $command STARBABA-GUN-XXXX");
        return;
    }

    switch ($command) {
        case '/kban':
            if (isset($keys[$targetKey])) {
                $keys[$targetKey]['status'] = 'banned';
                saveKeysData($keys);
                $replyText = "$targetKey başarıyla yasaklandı.";
            } else {
                $replyText = "Bu key veritabanında bulunamadı.";
            }
            break;

        case '/kuniban':
            if (isset($keys[$targetKey])) {
                $keys[$targetKey]['status'] = 'active';
                saveKeysData($keys);
                $replyText = "$targetKey üzerindeki yasak kaldırıldı.";
            } else {
                $replyText = "Bu key veritabanında bulunamadı.";
            }
            break;

        case '/ksil':
            if (isset($keys[$targetKey])) {
                unset($keys[$targetKey]);
                saveKeysData($keys);
                $replyText = "$targetKey veritabanından tamamen silindi.";
            } else {
                $replyText = "Bu key veritabanında bulunamadı.";
            }
            break;

        case '/kreset':
            if (isset($keys[$targetKey])) {
                $keys[$targetKey]['status'] = 'active';
                saveKeysData($keys);
                $replyText = "$targetKey sıfırlandı ve aktif hale getirildi.";
            } else {
                $replyText = "Bu key veritabanında bulunamadı.";
            }
            break;

        default:
            $replyText = "Bilinmeyen komut.";
            break;
    }

    sendMessage($chatId, $replyText);
}

// Mesaj Gönderme Fonksiyonu
function sendMessage($chatId, $text) {
    fastPost("sendMessage", [
        'chat_id' => $chatId,
        'text' => $text
    ]);
}

// cURL ile Telegram'a gecikmesiz istek atma fonksiyonu
function fastPost($method, $data) {
    $ch = curl_init(API_URL . $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
    curl_exec($ch);
    curl_close($ch);
}
?>
