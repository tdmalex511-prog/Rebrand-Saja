<?php
// Hata raporlamasını kapatalım ki Telegram JSON çıktısı bozulmasın
error_reporting(0);
ini_set('display_errors', 0);

// Bot Token Tanımlaması
define('BOT_TOKEN', '8963816483:AAHHgIrOstR6eT3N5WUhgVQPAHxjM7jLjTg');
define('API_URL', 'https://api.telegram.org/bot' . BOT_TOKEN . '/');

// Basit Dosya Tabanlı Veritabanı (Veritabanı hatası almamak için JSON dosyası kullanıyoruz)
$dbFile = 'keys.json';

function getKeysData() {
    global $dbFile;
    if (!file_exists($dbFile)) {
        file_put_contents($dbFile, json_encode([]));
    }
    return json_decode(file_get_contents($dbFile), true);
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
    $userKey = trim($_GET['key']);$keys = getKeysData();

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
// 2. TELEGRAM BOT İŞLEMLERİ
// ---------------------------------------------------------
$content = file_get_contents("php://input");
$update = json_decode($content, true);

if (!$update) {
    exit;
}

// Mesajlar (Komutlar)
if (isset($update["message"])) {
    $chatId =$update["message"]["chat"]["id"];
    $messageText = isset($update["message"]["text"]) ? trim($update["message"]["text"]) : "";

    if ($messageText === "/start") {
        sendMainMenu($chatId);
    } 
    elseif (strpos($messageText, '/') === 0) {
        handleAdminCommands($chatId,$messageText);
    }
}

// Buton Tıklamaları (Callback Query)
if (isset($update["callback_query"])) {
    $callbackQuery =$update["callback_query"];
    $chatId =$callbackQuery["message"]["chat"]["id"];
    $data =$callbackQuery["data"];

    if (in_array($data, ['gunluk', 'haftalik', 'aylik', 'sinirsiz', 'free1000'])) {$key = generateAndSaveKey($data);$replyText = "🔑 **Yeni Key Üretildi ve Kaydedildi!**\n\nTür: <code>" . strtoupper($data) . "</code>\nKey: <code>" . $key . "</code>";
    } else {
        $replyText = "Geçersiz işlem.";
    }

    sendMessage($chatId,$replyText);
}

// Ana Menü Gönderimi
function sendMainMenu($chatId) {$keyboard = [
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

    $replyText = "✨ **Starbaba Key Paneline Hoş Geldiniz**\n\nLütfen oluşturmak istediğiniz key türünü seçin:";
    $url = API_URL . "sendMessage?chat_id=" . $chatId . "&text=" . urlencode($replyText) . "&parse_mode=Markdown&reply_markup=" . urlencode(json_encode($keyboard));
    file_get_contents($url);
}

// Key Üretme ve Kaydetme
function generateAndSaveKey($type) {
    $prefix = "STARBABA-" . strtoupper(substr($type, 0, 3)) . "-";
    $randomStr = strtoupper(bin2hex(random_bytes(4)));$key = $prefix .$randomStr;

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
function handleAdminCommands($chatId, $text) {$parts = explode(' ', $text);$command = strtolower($parts[0]);$targetKey = isset($parts[1]) ? trim($parts[1]) : '';

    $keys = getKeysData();$replyText = "";

    if (empty($targetKey)) {
        sendMessage($chatId, "⚠️ Lütfen bir key belirtin! Örnek: `$command STARBABA-GUN-XXXX`");
        return;
    }

    switch ($command) {
        case '/kban':
            if (isset($keys[$targetKey])) {
                $keys[$targetKey]['status'] = 'banned';
                saveKeysData($keys);
                $replyText = "🚫 <code>$targetKey</code> başarıyla yasaklandı.";
            } else {
                $replyText = "❌ Bu key veritabanında bulunamadı.";
            }
            break;

        case '/kuniban':
            if (isset($keys[$targetKey])) {
                $keys[$targetKey]['status'] = 'active';
                saveKeysData($keys);
                $replyText = "✅ <code>$targetKey</code> üzerindeki yasak kaldırıldı.";
            } else {
                $replyText = "❌ Bu key veritabanında bulunamadı.";
            }
            break;

        case '/ksil':
            if (isset($keys[$targetKey])) {
                unset($keys[$targetKey]);
                saveKeysData($keys);
                $replyText = "🗑️ <code>$targetKey</code> veritabanından tamamen silindi.";
            } else {
                $replyText = "❌ Bu key veritabanında bulunamadı.";
            }
            break;

        case '/kreset':
            if (isset($keys[$targetKey])) {
                $keys[$targetKey]['status'] = 'active';
                saveKeysData($keys);
                $replyText = "🔄 <code>$targetKey</code> sıfırlandı ve aktif hale getirildi.";
            } else {
                $replyText = "❌ Bu key veritabanında bulunamadı.";
            }
            break;

        default:
            $replyText = "Bilinmeyen komut.";
            break;
    }

    sendMessage($chatId,$replyText);
}

function sendMessage($chatId, $text) {$url = API_URL . "sendMessage?chat_id=" . $chatId . "&text=" . urlencode($text) . "&parse_mode=Markdown";
    file_get_contents($url);
}
?>
