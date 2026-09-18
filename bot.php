<?php
// Hata raporlamasını aktif edelim ki Render loglarında bir sorun olursa hemen görebilelim
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Bot Token Tanımlaması (Yeni oluşturulan geçerli token)
define('BOT_TOKEN', '8963816483:AAHHgIr0sR6eT3N5WUhgVQPAHxjM7jLjTg');
define('API_URL', 'https://api.telegram.org/bot' . BOT_TOKEN . '/');

// Veritabanı ve Panel Ayarları
$db_host = getenv('DB_HOST') ?: 'localhost';
$db_name = getenv('DB_NAME') ?: 'starbaba_db';
$db_user = getenv('DB_USER') ?: 'root';
$db_pass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    // Veritabanı bağlantı hatası durumunda loglama
}
?>
