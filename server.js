const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Gelişmiş Lisans ve Key Veritabanı (Free, Paid vb. tüm özellikler)
let licenses = {
    "STAR_VIP_1": { type: "Paid", days: 1, expiry: Date.now() + (24 * 60 * 60 * 1000), hwid: null, banned: false },
    "FREE_KEY_STAR": { type: "Free", days: 0.1, expiry: Date.now() + (2 * 60 * 60 * 1000), hwid: null, banned: false }
};

const ADMIN_USER = "starbaba511";
const ADMIN_PASS = "starbaba511511";

// ==========================================
// 1. GELİŞMİŞ WEB YÖNETİM PANELİ (Eski Özellikleriyle)
// ==========================================
app.get('/', (req, res) => {
    if (req.query.api_check === '1') return; // API isteklerini aşağıya bırakır

    if (req.cookies.auth !== 'true') {
        return res.send(`
            <html>
            <head><title>Starbaba Login</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="background:#121212; color:#fff; font-family:sans-serif; text-align:center; padding-top:50px;">
                <h2>STARBABA PANEL GİRİŞ</h2>
                <form method="POST" action="/login">
                    <input type="text" name="username" placeholder="Kullanıcı Adı" style="padding:10px; margin:5px; width:200px;"><br>
                    <input type="password" name="password" placeholder="Şifre" style="padding:10px; margin:5px; width:200px;"><br>
                    <button type="submit" style="padding:10px 20px; background:#ff4757; color:#fff; border:none; border-radius:5px;">Giriş Yap</button>
                </form>
            </body>
            </html>
        `);
    }

    let rows = "";
    for (let key in licenses) {
        let item = licenses[key];
        let kalanSure = Math.max(0, Math.ceil((item.expiry - Date.now()) / (1000 * 60 * 60 * 24)));
        rows += `<tr>
            <td style="padding:10px; border-bottom:1px solid #444;">${key}</td>
            <td><span style="padding:3px 8px; background:${item.type === 'Free' ? '#3742fa' : '#2ed573'}; border-radius:4px; font-size:12px;">${item.type}</span></td>
            <td>${kalanSure} Gün</td>
            <td>${item.hwid ? item.hwid : 'Boş (Kayıtsız)'}</td>
            <td>${item.banned ? 'Yasaklı ❌' : 'Aktif ✅'}</td>
            <td>
                <a href="/delete?key=${key}" style="color:#ff4757; text-decoration:none;">Sil</a> | 
                <a href="/ban?key=${key}" style="color:#ffa502; text-decoration:none;">${item.banned ? 'Aktif Et' : 'Banla'}</a>
            </td>
        </tr>`;
    }

    res.send(`
        <html>
        <head><title>Starbaba Panel</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="background:#1e1e2f; color:#fff; font-family:sans-serif; padding:20px;">
            <h2>STARBABA LİSANS YÖNETİM PANELİ</h2>
            <a href="/logout" style="color:#ff4757; float:right; text-decoration:none; font-weight:bold;">Çıkış Yap</a>
            
            <div style="background:#2f3542; padding:15px; border-radius:8px; margin-top:20px;">
                <h3>Yeni Key Oluştur (Free / Paid)</h3>
                <form method="POST" action="/create">
                    <input type="text" name="key" placeholder="Key Adı (Örn: STAR_KEY_123)" style="padding:8px; width:200px; margin-right:5px;" required>
                    <select name="type" style="padding:8px; margin-right:5px;">
                        <option value="Paid">Paid (Ücretli/Özel)</option>
                        <option value="Free">Free (Ücretsiz)</option>
                    </select>
                    <input type="number" name="days" placeholder="Süre (Gün)" style="padding:8px; width:100px; margin-right:5px;" required>
                    <button type="submit" style="padding:8px 15px; background:#2ed573; color:#fff; border:none; border-radius:4px; font-weight:bold;">Oluştur</button>
                </form>
            </div>

            <hr style="border-color:#444; margin:25px 0;">
            <h3>Mevcut Key Listesi</h3>
            <table style="width:100%; text-align:left; border-collapse:collapse; background:#2f3542; border-radius:6px; overflow:hidden;">
                <tr style="background:#3d3d5c;"><th style="padding:10px;">Key</th><th>Tür</th><th>Süre</th><th>HWID (Cihaz Kimliği)</th><th>Durum</th><th>İşlem</th></tr>
                ${rows}
            </table>
        </body>
        </html>
    `);
});

app.post('/login', (req, res) => {
    if (req.body.username === ADMIN_USER && req.body.password === ADMIN_PASS) {
        res.cookie('auth', 'true', { httpOnly: true });
        res.redirect('/');
    } else {
        res.send("Hatalı Kullanıcı Adı veya Şifre! <a href='/'>Geri Dön</a>");
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('auth');
    res.redirect('/');
});

app.post('/create', (req, res) => {
    if (req.cookies.auth !== 'true') return res.redirect('/');
    let k = req.body.key;
    let t = req.body.type || "Paid";
    let d = parseFloat(req.body.days) || 1;
    
    if (k) {
        licenses[k] = {
            type: t,
            days: d,
            expiry: Date.now() + (d * 24 * 60 * 60 * 1000),
            hwid: null,
            banned: false
        };
    }
    res.redirect('/');
});

app.get('/delete', (req, res) => {
    if (req.cookies.auth !== 'true') return res.redirect('/');
    delete licenses[req.query.key];
    res.redirect('/');
});

app.get('/ban', (req, res) => {
    if (req.cookies.auth !== 'true') return res.redirect('/');
    let k = req.query.key;
    if (licenses[k]) {
        licenses[k].banned = !licenses[k].banned;
    }
    res.redirect('/');
});

// ==========================================
// 2. LUA SCRIPT API VE GÜVENLİK DOĞRULAMASI
// ==========================================
app.get('/', (req, res) => {
    if (req.query.api_check === '1') {
        let key = req.query.key;
        let hwid = req.query.hwid;

        // 1. Rastgele veya uydurma key kontrolü
        if (!key || !licenses[key]) {
            return res.json({ status: "error", message: "GEÇERSİZ VEYA RASTGELE KEY!" });
        }

        let lic = licenses[key];

        // 2. Ban durumu kontrolü
        if (lic.banned) {
            return res.json({ status: "error", message: "BU KEY YASAKLANMIŞTIR (BAN)!" });
        }

        // 3. Süre bitimi kontrolü
        if (Date.now() > lic.expiry) {
            return res.json({ status: "error", message: "KEY SÜRESİ DOLMUŞTUR!" });
        }

        // 4. Tek Cihaz (HWID) Kilidi Kontrolü
        if (!lic.hwid) {
            lic.hwid = hwid; // İlk açılan cihaza sabitlenir
        } else if (lic.hwid !== hwid) {
            return res.json({ status: "error", message: "BU KEY BAŞKA BİR CİHAZA AİTTİR (Tek Cihaz Sınırı)!" });
        }

        return res.json({ status: "success", message: "Giriş Başarılı! Menü Yükleniyor." });
    }
});

// ==========================================
// 3. RENDER UYUTMAMA (KEEP-ALIVE) SİSTEMİ
// ==========================================
setInterval(() => {
    http.get('http://rebrand-saja.onrender.com', (res) => {}).on('error', () => {});
}, 240000);

app.listen(PORT, () => {
    console.log(`Starbaba server running on port ${PORT}`);
});
