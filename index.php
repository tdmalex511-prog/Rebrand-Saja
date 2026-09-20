<?php
// Hata raporlamasını kapatalım ki çıktı bozulmasın
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

function sendTelegram($method,$data) {
    $ch = curl_init(API_URL .$method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS,$data);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $result = curl_exec($ch);
    curl_close($ch);
    return $result;
}

// 1. LUA SCRIPT API KONTROLÜ (?key=xxxx)
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

// 2. TELEGRAM WEBHOOK İŞLEMLERİ
$input = file_get_contents("php://input");
$update = json_decode($input, true);

// Eğer tarayıcıdan normal bir şekilde girildiyse (Telegram'dan istek gelmediyse)
if (!$update) {
    // Lua kontrolü veya buton isteği yoksa paneli göster
    if (!isset($_GET['key'])) {
        echo "STARBABA Panel Aktif ve Çalışıyor!";
    }
    exit;
}

// /start Komutu Kontrolü
if (isset($update["message"])) {
    $chatId =$update["message"]["chat"]["id"];
    $text = isset($update["message"]["text"]) ? trim($update["message"]["text"]) : "";

    if ($text === "/start") {
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

        sendTelegram("sendMessage", [
            "chat_id" => $chatId,
            "text" => "Starbaba Key Paneline Hoş Geldiniz\n\nİstediğiniz key türünü seçin:",
            "reply_markup" => json_encode($keyboard)
        ]);
    }
    exit;
}

// Buton Tıklamaları (Callback Query) Kontrolü
if (isset($update["callback_query"])) {
    $callback =$update["callback_query"];
    $callbackId =$callback["id"];
    $chatId =$callback["message"]["chat"]["id"];
    $data =$callback["data"];

    // Butonun dönmesini hemen durdur
    sendTelegram("answerCallbackQuery", [
        "callback_query_id" => $callbackId,
        "text" => "Key oluşturuluyor..."
    ]);

    $types = [
        'gunluk' => 'GUN', 
        'haftalik' => 'HAF', 
        'aylik' => 'AYL', 
        'sinirsiz' => 'SNI', 
        'free1000' => 'FRE'
    ];
    
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
        $replyText = "Geçersiz işlem türü.";
    }

    sendTelegram("sendMessage", [
        "chat_id" => $chatId,
        "text" => $replyText,
        "parse_mode" => "Markdown"
    ]);
    exit;
}
?>
