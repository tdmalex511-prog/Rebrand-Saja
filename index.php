<?php
session_start();

// --- GİRİŞ BİLGİLERİ ---
$dogru_kullanici = "admin";
$dogru_sifre = "starbaba_sifre"; 

$txt_file = 'keys.txt';

// Çıkış yapma isteği
if (isset($_GET['logout'])) {
    unset($_SESSION['logged_in']);
    header("Location: index.php");
    exit;
}

// Giriş kontrolü
if (isset($_POST['username']) && isset($_POST['password'])) {
    if ($_POST['username'] === $dogru_kullanici && $_POST['password'] === $dogru_sifre) {
        $_SESSION['logged_in'] = true;
        header("Location: index.php");
        exit;
    } else {
        $error = "Kullanıcı adı veya şifre hatalı!";
    }
}

// Giriş yapılmamışsa Giriş Ekranını Göster
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true):
?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>STARBABA Giriş</title>
    <style>
        body { background-color: #0d1117; color: #c9d1d9; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 15px; box-sizing: border-box; }
        .login-box { background: #161b22; padding: 30px 20px; border-radius: 12px; border: 1px solid #30363d; width: 100%; max-width: 400px; box-sizing: border-box; }
        .form-group { margin-bottom: 20px; text-align: left; }
        label { display: block; margin-bottom: 8px; font-size: 15px; color: #8b949e; font-weight: bold; }
        input { width: 100%; padding: 14px; background: #0d1117; border: 1px solid #30363d; color: #fff; border-radius: 8px; box-sizing: border-box; font-size: 16px; }
        button { width: 100%; padding: 14px; background: #238636; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; }
        button:hover { background: #2ea043; }
        .error { color: #f85149; font-size: 14px; margin-bottom: 20px; background: rgba(248, 81, 73, 0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(248, 81, 73, 0.4); text-align: center; }
    </style>
</head>
<body>
    <div class="login-box">
        <h2 style="color: #58a6ff; margin-top: 0; margin-bottom: 25px; text-align: center; font-size: 22px;">STARBABA Giriş</h2>
        <?php if(isset($error)) echo "<div class='error'>$error</div>"; ?>
        <form method="POST">
            <div class="form-group">
                <label>Kullanıcı Adı:</label>
                <input type="text" name="username" placeholder="Kullanıcı adınızı girin..." required autocomplete="off">
            </div>
            <div class="form-group">
                <label>Şifre:</label>
                <input type="password" name="password" placeholder="Şifrenizi girin..." required>
            </div>
            <button type="submit">Giriş Yap</button>
        </form>
    </div>
</body>
</html>
<?php 
exit; 
endif;

if (!file_exists($txt_file)) {
    file_put_contents($txt_file, "");
}

// --- İŞLEMLER (Oluştur, Sil, Reset, Ban) ---
if (isset($_GET['action'])) {
    $action = $_GET['action'];
    $target_key = $_GET['key'] ?? '';

    // 1. Key Üret
    if ($action == 'create') {
        $keyType = $_POST['key_type']; 
        $duration = $_POST['duration']; 
        
        if ($keyType == 'free') {
            $maxDevices = intval($_POST['max_devices']);
            if ($maxDevices <= 0) $maxDevices = 1000; 
        } else {
            $maxDevices = 1000; 
        }

        if ($duration == 'unlimited') {
            $expiryDate = 'Ömürlük / Sınırsız'; 
        } else {
            $days = intval($duration);
            $expiryDate = date('Y-m-d H:i:s', strtotime("+$days days"));
        }

        $uniqueKey = "STARBABA-" . strtoupper(substr(md5(mt_rand()), 0, 12));
        
        // Format: KEY | TÜR | LİMİT | TARİH | DURUM (Aktif/Banlı)
        $line = "$uniqueKey|$keyType|$maxDevices Cihaz|$expiryDate|Aktif\n";
        file_put_contents($txt_file, $line, FILE_APPEND | LOCK_EX);

        header("Location: index.php");
        exit;
    }

    // Dosyadaki satırları oku ve ilgili key üzerinde işlem yap
    $lines = file($txt_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $new_lines = [];

    foreach ($lines as $line) {
        $parts = explode('|', $line);
        if (count($parts) >= 4) {
            $k_code = $parts[0];
            
            if ($k_code === $target_key) {
                if ($action == 'delete') {
                    continue; // Bu satırı atla (Silindi)
                } elseif ($action == 'reset') {
                    // İstersen burada cihaz sayısını sıfırlama veya düzenleme yapabilirsin, şimdilik aktif tutuyoruz
                    $parts[4] = 'Aktif';
                } elseif ($action == 'ban') {
                    // Mevcut durumuna göre banla ya da banı kaldır
                    $current_status = $parts[4] ?? 'Aktif';
                    $parts[4] = ($current_status === 'Banlı') ? 'Aktif' : 'Banlı';
                }
            }
            // Eksik sütun kalmasın diye durum kontrolü
            if (!isset($parts[4])) {
                $parts[4] = 'Aktif';
            }
            $new_lines[] = implode('|', $parts);
        }
    }

    file_put_contents($txt_file, implode("\n", $new_lines) . (count($new_lines) > 0 ? "\n" : ""));
    header("Location: index.php");
    exit;
}

// Dosyadan okuma ve arama
$keys = [];
$lines = file($txt_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$search = trim($_GET['search_key'] ?? '');

foreach (array_reverse($lines) as $line) {
    $parts = explode('|', $line);
    if (count($parts) >= 4) {
        $k_data = [
            'key_code' => $parts[0],
            'key_type' => $parts[1],
            'max_devices' => $parts[2],
            'expiry_date' => $parts[3],
            'status' => $parts[4] ?? 'Aktif'
        ];

        if (!empty($search)) {
            if (stripos($k_data['key_code'], $search) !== false) {
                $keys[] = $k_data;
            }
        } else {
            $keys[] = $k_data;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>STARBABA VIP Panel</title>
    <style>
        body { background-color: #0d1117; color: #c9d1d9; font-family: Arial, sans-serif; margin: 0; padding: 15px; box-sizing: border-box; }
        .container { max-width: 650px; margin: 0 auto; background: #161b22; padding: 20px; border-radius: 12px; border: 1px solid #30363d; box-sizing: border-box; }
        h2 { color: #58a6ff; font-size: 18px; margin-bottom: 10px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-size: 14px; font-weight: bold; color: #8b949e; }
        select, input { width: 100%; padding: 12px; background: #0d1117; border: 1px solid #30363d; color: #fff; border-radius: 8px; box-sizing: border-box; font-size: 15px; }
        button { width: 100%; padding: 14px; background: #238636; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; }
        button:hover { background: #2ea043; }
        .logout { background: #da3633; margin-bottom: 20px; display: block; text-align: center; text-decoration: none; color: white; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 15px; }
        .logout:hover { background: #f85149; }
        table { width: 100%; margin-top: 20px; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #30363d; padding: 8px; text-align: left; word-break: break-all; }
        th { background: #21262d; color: #58a6ff; }
        .btn-action { padding: 5px 8px; font-size: 11px; border-radius: 4px; text-decoration: none; color: white; font-weight: bold; display: inline-block; margin: 2px 0; }
        .btn-reset { background: #1f6feb; }
        .btn-ban { background: #d29922; }
        .btn-unban { background: #238636; }
        .btn-delete { background: #da3633; }
    </style>
</head>
<body>

<div class="container">
    <a href="index.php?logout=true" class="logout">Çıkış Yap</a>

    <h2>Key Üretme Paneli</h2>
    <form action="index.php?action=create" method="POST">
        <div class="form-group">
            <label>1. Key Türünü Seçin:</label>
            <select name="key_type" id="keyTypeSelect" onchange="toggleDeviceInput()">
                <option value="free">Free Key</option>
                <option value="vip">VIP Key</option>
            </select>
        </div>

        <div class="form-group" id="deviceLimitGroup">
            <label>Cihaz Sayısı (Limit):</label>
            <input type="number" name="max_devices" value="1000" placeholder="Örn: 1000, 500...">
        </div>

        <div class="form-group">
            <label>2. Süre Seçin:</label>
            <select name="duration">
                <option value="1">1 Günlük</option>
                <option value="7">1 Haftalık</option>
                <option value="30">1 Aylık</option>
                <option value="unlimited">Sınırsız / Ömürlük</option>
            </select>
        </div>

        <button type="submit" id="submitBtn">Free Key Oluştur</button>
    </form>

    <h2 style="margin-top: 30px;">Key Arama ve Listesi</h2>
    <form action="index.php" method="GET">
        <div class="form-group" style="display: flex; gap: 10px;">
            <input type="text" name="search_key" placeholder="Key kodu aratın..." value="<?= htmlspecialchars($_GET['search_key'] ?? '') ?>">
            <button type="submit" style="background: #1f6feb; width: 100px;">Ara</button>
        </div>
    </form>

    <table>
        <tr>
            <th>Key Kodu / Durum</th>
            <th>Tür</th>
            <th>Limit</th>
            <th>Bitiş</th>
            <th>İşlemler</th>
        </tr>
        <?php if (!empty($keys)): ?>
            <?php foreach ($keys as $k): ?>
            <tr>
                <td>
                    <code><?= htmlspecialchars($k['key_code']) ?></code><br>
                    <span style="font-size: 10px; color: <?= ($k['status'] === 'Banlı') ? '#f85149' : '#3fb950'; ?>">
                        [<?= htmlspecialchars($k['status']) ?>]
                    </span>
                </td>
                <td><?= htmlspecialchars($k['key_type']) ?></td>
                <td><?= htmlspecialchars($k['max_devices']) ?></td>
                <td><?= htmlspecialchars($k['expiry_date']) ?></td>
                <td>
                    <a href="index.php?action=reset&key=<?= urlencode($k['key_code']) ?>" class="btn-action btn-reset">Sıfırla</a>
                    <?php if ($k['status'] === 'Banlı'): ?>
                        <a href="index.php?action=ban&key=<?= urlencode($k['key_code']) ?>" class="btn-action btn-unban">Ban Kaldır</a>
                    <?php else: ?>
                        <a href="index.php?action=ban&key=<?= urlencode($k['key_code']) ?>" class="btn-action btn-ban">Banla</a>
                    <?php endif; ?>
                    <a href="index.php?action=delete&key=<?= urlencode($k['key_code']) ?>" class="btn-action btn-delete" onclick="return confirm('Bu keyi silmek istediğinize emin misiniz?');">Sil</a>
                </td>
            </tr>
            <?php endforeach; ?>
        <?php else: ?>
            <tr><td colspan="5" style="text-align: center; color: #8b949e;">Kayıt bulunamadı.</td></tr>
        <?php endif; ?>
    </table>
</div>

<script>
function toggleDeviceInput() {
    var select = document.getElementById("keyTypeSelect");
    var deviceGroup = document.getElementById("deviceLimitGroup");
    var btn = document.getElementById("submitBtn");

    if (select.value === "vip") {
        deviceGroup.style.display = "none";
        btn.innerText = "VIP Key Oluştur";
        btn.style.background = "#9b59b6";
    } else {
        deviceGroup.style.display = "block";
        btn.innerText = "Free Key Oluştur";
        btn.style.background = "#238636";
    }
}
</script>

</body>
</html>