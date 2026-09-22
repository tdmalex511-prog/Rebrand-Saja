const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bellekte tutulan key veritabanı (İstersen sonradan veritabanına bağlayabilirsin)
// Yapı: { keyString: { duration: saniye, createdAt: zaman, firstUsedAt: null/zaman, hwid: null/string, status: 'active'/'banned'/'expired' } }
let database = {};

// 1. KONTROL ENDPOINT'İ (Lua buradan kontrol eder)
app.get('/check', (req, res) => {
    let { key, hwid } = req.query;
    if (!key) return res.send('error: invalid key');

    let keyData = database[key];
    if (!keyData) return res.send('error: not found');

    // Eğer key banlandıysa veya silindiyse
    if (keyData.status === 'banned') return res.send('error: banned');
    if (keyData.status === 'deleted') return res.send('error: not found');

    let now = Math.floor(Date.now() / 1000);

    // İlk kullanım anını kaydet ve süreyi o an başlat
    if (!keyData.firstUsedAt) {
        keyData.firstUsedAt = now;
    }

    // Süre hesaplama (Sınırsız değilse kontrol et)
    if (keyData.duration > 0) {
        let elapsed = now - keyData.firstUsedAt;
        if (elapsed >= keyData.duration) {
            keyData.status = 'expired';
            return res.send('error: expired');
        }
    }

    // HWID Cihaz Kilitleme Kontrolü
    if (!keyData.hwid) {
        keyData.hwid = hwid; // İlk giren cihaza kilitler
    } else if (keyData.hwid !== hwid) {
        return res.send('error: hwid mismatch'); // Başka cihazda çalışmaz
    }

    return res.send('success: active');
});

// 2. YÖNETİM: YENİ KEY OLUŞTURMA (Örn: 1 Dakika = 60, 1 Saat = 3600, Sınırsız = 0)
app.get('/create', (req, res) => {
    let { key, duration } = req.query; // duration saniye cinsindendir (60 = 1 dk)
    if (!key || !duration) return res.send('Eksik parametre! Örn: /create?key=STAR-1DK&duration=60');

    database[key] = {
        duration: parseInt(duration),
        createdAt: Math.floor(Date.now() / 1000),
        firstUsedAt: null,
        hwid: null,
        status: 'active'
    };

    res.send(`Key başarıyla oluşturuldu: ${key} (${duration} saniye)`);
});

// 3. YÖNETİM: RESET KEY (Cihaz / HWID Kilidini Kaldırır)
app.get('/reset', (req, res) => {
    let { key } = req.query;
    if (database[key]) {
        database[key].hwid = null;
        return res.send(`Başarılı: ${key} için HWID sıfırlandı.`);
    }
    res.send('Key bulunamadı!');
});

// 4. YÖNETİM: BANLA
app.get('/ban', (req, res) => {
    let { key } = req.query;
    if (database[key]) {
        database[key].status = 'banned';
        return res.send(`Başarılı: ${key} banlandı.`);
    }
    res.send('Key bulunamadı!');
});

// 5. YÖNETİM: UNBAN (Banı Kaldır)
app.get('/unban', (req, res) => {
    let { key } = req.query;
    if (database[key]) {
        database[key].status = 'active';
        return res.send(`Başarılı: ${key} unbanlandı.`);
    }
    res.send('Key bulunamadı!');
});

// 6. YÖNETİM: KEY'İ SİL
app.get('/delete', (req, res) => {
    let { key } = req.query;
    if (database[key]) {
        delete database[key];
        return res.send(`Başarılı: ${key} tamamen silindi.`);
    }
    res.send('Key bulunamadı!');
});

// Panel Ana Sayfası (Tüm Keylerin Durumunu Gösterir)
app.get('/', (req, res) => {
    let html = `<h2>STARBABA Admin Panel</h2><table border="1" cellpadding="5"><tr><th>Key</th><th>Süre (Saniye)</th><th>Kalan Süre</th><th>HWID</th><th>Durum</th></tr>`;
    let now = Math.floor(Date.now() / 1000);

    for (let k in database) {
        let item = database[k];
        let remaining = "Başlamadı";
        if (item.firstUsedAt && item.duration > 0) {
            let passed = now - item.firstUsedAt;
            let rem = item.duration - passed;
            remaining = rem > 0 ? `${rem} saniye` : "Süresi Bitti";
        }
        html += `<tr><td>${k}</td><td>${item.duration}</td><td>${remaining}</td><td>${item.hwid || 'Boş'}</td><td>${item.status}</td></tr>`;
    }
    html += `</table>`;
    res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Starbaba Server ${PORT} portunda çalışıyor.`);
});
