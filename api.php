<?php
require_once 'boot.php';

$content = file_get_contents("php://input");
$update = json_decode($content, true);

if (!$update || !isset($update["message"])) {
    exit;
}

$chatId = $update["message"]["chat"]["id"];
$messageText = isset($update["message"]["text"]) ? trim($update["message"]["text"]) : "";

if ($messageText === "/start") {
    $replyText = "Merhaba! Starbaba Key Bot'a hoş geldiniz. Lütfen işleminizi seçin.";
    $url = API_URL . "sendMessage?chat_id=" . $chatId . "&text=" . urlencode($replyText);
    file_get_contents($url);
}
?>
