<?php
require_once 'boot.php';

$content = file_get_contents("php://input");
$update = json_decode($content, true);

if (!$update) {
    exit;
}

// 1. Metin Komutları ve Yönetim İşlemleri (/kset, /kban, /kuniban, /ksil, /kreset, /start)
if (isset($update["message"])) {
    $chatId = $update["message"]["chat"]["id"];
    $messageText = isset($update["message"]["text"]) ? trim($update["message"]["text"]) : "";

    if ($messageText === "/start") {
        sendMainMenu($chatId);
    } 
    // Yönetim Komutları Kontrolü
    elseif (strpos($messageText, '/') === 0) {
        handleAdminCommands($chatId, $messageText, $pdo);
    }
}

// 2. Butona Tıklama (Callback Query) İşlemleri
if (isset($update["callback_query"])) {
    $callbackQuery = $update["callback_query"];
    $chatId = $callbackQuery["message"]["chat"]["id"];
    $data = $callbackQuery["data"];

    if (in_array($data, ['gunluk', 'haftalik', 'aylik', 'sinirsiz', 'free1000'])) {
        $key = generateAndSaveKey($data, $pdo);
        $replyText = "🔑 **Yeni Key Üretildi ve Kaydedildi!**\n\nTür: <code>" . strtoupper($data) . "</code>\nKey: <code>" . $key . "</code>";
    } else {
        $replyText = "Geçersiz işlem.";
    }

    $url = API_URL . "sendMessage?chat_id=" . $chatId . "&text=" . urlencode($replyText) . "&parse_mode=Markdown";
    file_get_contents($url);
}

// Ana Menü Butonları
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

    $replyText = "✨ **Starbaba Key Paneline Hoş Geldiniz**\n\nLütfen oluşturmak istediğiniz key türünü seçin:";
    $url = API_URL . "sendMessage?chat_id=" . $chatId . "&text=" . urlencode($replyText) . "&parse_mode=Markdown&reply_markup=" . urlencode(json_encode($keyboard));
    file_get_contents($url);
}

// Key Üretip Veritabanına Kaydeden Fonksiyon
function generateAndSaveKey($type, $pdo) {
    $prefix = "STARBABA-" . strtoupper(substr($type, 0, 3)) . "-";
    $randomStr = strtoupper(bin2hex(random_bytes(4)));
    $key = $prefix . $randomStr;

    if ($pdo) {
        $stmt = $pdo->prepare("INSERT INTO keys (user_key, type, status) VALUES (?, ?, 'active')");
        $stmt->execute([$key, $type]);
    }

    return $key;
}

// Admin / Yönetim Komutlarını İşleyen Fonksiyon
function handleAdminCommands($chatId, $text, $pdo) {
    $parts = explode(' ', $text);
    $command = strtolower($parts[0]);
    $targetKey = isset($parts[1]) ? trim($parts[1]) : '';

    $replyText = "";

    if (!$pdo) {
        sendMessage($chatId, "❌ Veritabanı bağlantısı kurulamadı!");
        return;
    }

    switch ($command) {
        case '/kban':
            if (empty($targetKey)) { $replyText = "⚠️ Kullanım: /kban [KEY]"; break; }
            $stmt = $pdo->prepare("UPDATE keys SET status = 'banned' WHERE user_key = ?");
            $stmt->execute([$targetKey]);
            $replyText = "🚫 <code>$targetKey</code> başarıyla yasaklandı (banned).";
            break;

        case '/kuniban':
            if (empty($targetKey)) { $replyText = "⚠️ Kullanım: /kuniban [KEY]"; break; }
            $stmt = $pdo->prepare("UPDATE keys SET status = 'active' WHERE user_key = ?");
            $stmt->execute([$targetKey]);
            $replyText = "✅ <code>$targetKey</code> üzerindeki yasak kaldırıldı.";
            break;

        case '/ksil':
            if (empty($targetKey)) { $replyText = "⚠️ Kullanım: /ksil [KEY]"; break; }
            $stmt = $pdo->prepare("DELETE FROM keys WHERE user_key = ?");
            $stmt->execute([$targetKey]);
            $replyText = "🗑️ <code>$targetKey</code> veritabanından tamamen silindi.";
            break;

        case '/kreset':
            if (empty($targetKey)) { $replyText = "⚠️ Kullanım: /kreset [KEY]"; break; }
            // Örnek sıfırlama işlemi (durumu tekrar active yapma veya cihazları temizleme)
            $stmt = $pdo->prepare("UPDATE keys SET status = 'active' WHERE user_key = ?");
            $stmt->execute([$targetKey]);
            $replyText = "🔄 <code>$targetKey</code> sıfırlandı ve aktif hale getirildi.";
            break;

        default:
            $replyText = "B bilinmeyen komut.";
            break;
    }

    sendMessage($chatId, $replyText);
}

function sendMessage($chatId, $text) {
    $url = API_URL . "sendMessage?chat_id=" . $chatId . "&text=" . urlencode($text) . "&parse_mode=Markdown";
    file_get_contents($url);
}
?>
