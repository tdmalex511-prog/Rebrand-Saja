<?php
error_reporting(0);
ini_set('display_errors', 0);

define('BOT_TOKEN', '8963816483:AAHHgIrOstR6eT3N5WUhgVQPAHxjM7jLjTg');
define('API_URL', 'https://api.telegram.org/bot' . BOT_TOKEN . '/');

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

// 1. LUA SCRIPT API KONTROLÜ
if (isset($_GET['key'])) {
    header('Content-Type: text/plain; charset=utf-8');
    $userKey = trim($_GET['key']);$keys = getKeysData();

    if (isset($keys[$userKey])) {
        echo ($keys[$userKey]['status'] === 'active') ? "success" : "banned";
    } else {
        echo "invalid";
    }
    exit;
}

// 2. TELEGRAM WEBHOOK
$content = file_get_contents("php://input");
$update = json_decode($content, true);

if (!$update) {
    exit;
}

// Normal Mesajlar (/start)
if (isset($update["message"])) {
    $chatId =$update["message"]["chat"]["id"];
    $text = isset($update["message"]["text"]) ? trim($update["message"]["text"]) : "";

    if ($text === "/start") {
        sendMainMenu($chatId);
    }
}

// Buton Tıklamaları (Callback Query)
if (isset($update["callback_query"])) {
    $callback =$update["callback_query"];
    $callbackId =$callback["id"];
    $chatId =$callback["message"]["chat"]["id"];
    $data =$callback["data"];

    // Önce Telegram'a döndürmeyi durdurması için sinyal verelim
    file_get_contents(API_URL . "answerCallbackQuery?callback_query_id=" . $callbackId);

    // Key Türüne Göre Üretim
    $types = ['gunluk' => 'GUN', 'haftalik' => 'HAF', 'aylik' => 'AYL', 'sinirsiz' => 'SNI', 'free1000' => 'FRE'];
    
    if (isset($types[$data])) {$prefix = "STARBABA-" . $types[$data] . "-";
        $key =$prefix . strtoupper(bin2hex(random_bytes(4)));

        $keys = getKeysData();
        $keys[$key] = [
            'type' => $data,
            'status' => 'active',
            'created_at' => date('Y-m-d H:i:s')
        ];
        saveKeysData($keys);

        $replyText = "Yeni Key Üretildi:\n\n`" . $key . "`";
    } else {
        $replyText = "Geçersiz işlem.";
    }

    // Kullanıcıya Mesaj Gönder
    file_get_contents(API_URL . "sendMessage?chat_id=" . $chatId . "&text=" . urlencode($replyText) . "&parse_mode=Markdown");
}

function sendMainMenu($chatId) {$keyboard = [
        'inline_keyboard' => [
            [['text' => '📅 Günlük Key', 'callback_data' => 'gunluk'], ['text' => '📆 Haftalık Key', 'callback_data' => 'haftalik']],
            [['text' => '🗓️ Aylık Key', 'callback_data' => 'aylik'], ['text' => '♾️ Sınırsız Key', 'callback_data' => 'sinirsiz']],
            [['text' => '🎁 Free 1000 Cihaz Key', 'callback_data' => 'free1000']]
        ]
    ];

    $url = API_URL . "sendMessage?chat_id=" . $chatId . "&text=" . urlencode("Starbaba Key Paneline Hoş Geldiniz\n\nİstediğiniz key türünü seçin:") . "&reply_markup=" . urlencode(json_encode($keyboard));
    file_get_contents($url);
}
?>
