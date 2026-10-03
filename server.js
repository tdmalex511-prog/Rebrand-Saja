const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Tamamen boş başlar, otomatik key atılmaz.
let dbKeys = {};

// Süre hesaplama fonksiyonu
function calculateExpireTime(type) {
    const now = Date.now();
    switch (type) {
        case '30m': return now + (30 * 60 * 1000);
        case '1d':  return now + (24 * 60 * 60 * 1000);
        case '1w':  return now + (7 * 24 * 60 * 60 * 1000);
        case '1m':  return now + (30 * 24 * 60 * 60 * 1000);
        case 'lifetime': return now + (365 * 100 * 24 * 60 * 60 * 1000); // 100 yıl
        default: return now + (24 * 60 * 60 * 1000);
    }
}

// 1. WEB YÖNETİM PANELİ (Tarayıcıdan yönetmek için)
app.get('/', (req, res) => {
    const search = req.query.search ? req.query.search.toLowerCase() : '';
    
    let rows = '';
    for (let [k, v] of Object.entries(dbKeys)) {
        if (search && !k.toLowerCase().includes(search)) continue;

        let expireDate = new Date(v.expire).toLocaleString('tr-TR');
        let isExpired = Date.now() > v.expire ? '<span style="color:red;">(Süresi Bitmiş)</span>' : '';
        
        rows += `
            <tr>
                <td><b>${k}</b></td>
                <td>${v.status.toUpperCase()} ${isExpired}</td>
                <td>Cihaz: ${v.boundSerial || 'Bağlı Değil'}</td>
                <td>Bitiş: ${expireDate}</td>
                <td>
                    <a href="/reset-hwid?key=${encodeURIComponent(k)}" style="color:orange;">HWID Reset</a> | 
                    <a href="/toggle-ban?key=${encodeURIComponent(k)}" style="color:yellow;">${v.status === 'banned' ? 'Uniban' : 'Ban'}</a> | 
                    <a href="/delete-key?key=${encodeURIComponent(k)}" style="color:red;">Sil</a>
                </td>
            </tr>
        `;
    }

    res.send(`
        <html>
        <head>
            <title>STARBABA Güvenli Lisans Paneli</title>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial; background: #0f172a; color: #f8fafc; padding: 20px; }
                .container { max-width: 950px; margin: auto; background: #1e293b; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
                input, select, button { padding: 10px; margin: 5px 0; border-radius: 5px; border: none; width: 100%; box-sizing: border-box; }
                button { background: #3b82f6; color: white; font-weight: bold; cursor: pointer; }
                button:hover { background: #2563eb; }
                table { width: 100%; margin-top: 20px; border-collapse: collapse; }
                th, td { padding: 10px; border-bottom: 1px solid #334155; text-align: left; font-size: 14px; }
                a { text-decoration: none; font-weight: bold; }
                .search-box { display: flex; gap: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>STARBABA Key Yönetim Paneli</h2>
                
                <!-- Key Oluşturma Formu -->
                <form action="/create-key" method="POST">
                    <label>Key Adı / Kodu:</label>
                    <input type="text" name="key" placeholder="Örn: STARBABA-VIP-999" required>
                    
                    <label>Süre Seçin:</label>
                    <select name="duration">
                        <option value="30m">30 Dakika</option>
                        <option value="1d">1 Gün</option>
                        <option value="1w">1 Hafta</option>
                        <option value="1m">1 Ay</option>
                        <option value="lifetime">Sınırsız (Lifetime)</option>
                    </select>
                    
                    <button type="submit">Yeni Key Oluştur</button>
                </form>

                <hr style="border-color: #334155; margin: 20px 0;">

                <!-- Arama Formu -->
                <form action="/" method="GET" class="search-box">
                    <input type="text" name="search" placeholder="Key Ara..." value="${req.query.search || ''}">
                    <button type="submit" style="width: 150px;">Ara</button>
                </form>

                <h3>Kayıtlı Keyler</h3>
                <table>
                    <tr>
                        <th>Key</th>
                        <th>Durum</th>
                        <th>HWID (Cihaz)</th>
                        <th>Bitiş Tarihi</th>
                        <th>İşlemler</th>
                    </tr>
                    ${rows || '<tr><td colspan="5" style="text-align:center;">Henüz kayıtlı key bulunmuyor.</td></tr>'}
                </table>
            </div>
        </body>
        </html>
    `);
});

// 2. YENİ KEY OLUŞTURMA İŞLEMİ
app.post('/create-key', (req, res) => {
    const { key, duration } = req.body;
    if (key) {
        dbKeys[key.trim()] = {
            expire: calculateExpireTime(duration),
            boundSerial: null, 
            status: 'active'   
        };
    }
    res.redirect('/');
});

// 3. HWID RESETLEME (Cihaz Kilidini Kaldırma)
app.get('/reset-hwid', (req, res) => {
    const key = req.query.key;
    if (key && dbKeys[key]) {
        dbKeys[key].boundSerial = null;
    }
    res.redirect('/');
});

// 4. BAN / UNIBAN İŞLEMİ
app.get('/toggle-ban', (req, res) => {
    const key = req.query.key;
    if (key && dbKeys[key]) {
        dbKeys[key].status = dbKeys[key].status === 'banned' ? 'active' : 'banned';
    }
    res.redirect('/');
});

// 5. KEY SİLME İŞLEMİ
app.get('/delete-key', (req, res) => {
    const key = req.query.key;
    if (key && dbKeys[key]) {
        delete dbKeys[key];
    }
    res.redirect('/');
});

// 6. LUA SCRIPTİNDEN GELEN İSTEK KONTROLÜ (API)
app.post('/connect', (req, res) => {
    const { game, user_key, serial } = req.body;
    
    if (!user_key || !serial) {
        return res.json({ status: false, reason: "INVALID_REQUEST" });
    }

    const cleanKey = user_key.trim();

    // Rastgele veya sonu değiştirilmiş keyler eşleşmeyeceği için direkt reddedilir
    if (!dbKeys[cleanKey]) {
        return res.json({ status: false, reason: "USER OR GAME NOT REGISTERED" });
    }

    let keyData = dbKeys[cleanKey];

    // Ban kontrolü
    if (keyData.status === 'banned') {
        return res.json({ status: false, reason: "USER BLOCKED" });
    }

    // Süre bitiş kontrolü
    if (Date.now() > keyData.expire) {
        return res.json({ status: false, reason: "KEY EXPIRED" });
    }

    // TEK CİHAZ (HWID) KİLİDİ KONTROLÜ
    if (keyData.boundSerial === null) {
        keyData.boundSerial = serial; // İlk giren cihaza kilitlenir
    } else if (keyData.boundSerial !== serial) {
        return res.json({ status: false, reason: "HWID MISMATCH - BU KEY BAŞKA CİHAZA BAĞLI!" });
    }

    return res.json({
        status: true,
        message: "Key başarıyla doğrulandı.",
        data: { expire: new Date(keyData.expire).toISOString() }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`STARBABA Güvenli Panel aktif, ${PORT} portunda çalışıyor.`);
});
