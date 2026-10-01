const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Basit Veritabanı (Keyler, Süreler, HWID'ler ve Durumlar)
let licenses = {
    "STAR_VIP_1": { days: 1, expiry: Date.now() + (24 * 60 * 60 * 1000), hwid: null, banned: false },
    "STAR_VIP_7": { days: 7, expiry: Date.now() + (7 * 24 * 60 * 60 * 1000), hwid: null, banned: false }
};

const ADMIN_USER = "starbaba511";
const ADMIN_PASS = "starbaba511511";

// ==========================================
// 1. WEB YÖNETİM PANELİ (Arayüz)
// ==========================================
app.get('/', (req, res) => {
    // Eğer Lua scripti API üzerinden istek atıyorsa burası çalışmaz, aşağıdaki API bloğuna gider.
    if (req.query.api_check === '1') return;

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
            <td>${kalanSure} Gün</td>
            <td>${item.hwid ? item.hwid : 'Kayıtsız (Boş)'}</td>
            <td>${item.banned ? 'Yasaklı ❌' : 'Aktif ✅'}</td>
            <td>
                <a href="/delete?key=${key}" style="color:#ff4757; text-decoration:none;">Sil</a> | 
                <a href="/ban?key=${key}" style="color:#ffa502; text-decoration:none;">${item.banned ? 'Kaldır' : 'Banla'}</a>
            </td>
        </tr>`;
    }

    res.send(`
        <html>
        <head><title>Starbaba Panel</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="background:#1e1e2f; color:#fff; font-family:sans-serif; padding:20px;">
            <h2>STARBABA LİSANS YÖNETİMİ</h2>
            <a href="/logout" style="color:#ff4757; float:right;">Çıkış Yap</a>
            <h3>Yeni Key Oluştur</h3>
            <form method="POST" action="/create">
                <input type="text" name="key" placeholder="Key Adı (Örn: STAR_TEST)" style="padding:8px;" required>
                <input type="number" name="days" placeholder="Gün (Örn: 1)" style="padding:8px;" required>
                <button type="submit" style="padding:8px 15px; background:#2ed573; color:#fff; border:none;">Oluştur</button>
            </form>
            <hr style="border-color:#444; margin:20px 0;">
            <table style="width:100%; text-align:left; border-collapse:collapse;">
                <tr style="background:#2f3542;"><th style="padding:10px;">Key</th><th>Süre</th><th>HWID (Cihaz)</th><th>Durum</th><th>İşlem</th></tr>
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
        res.send("Hatalı şifre! <='/'ye dön>");
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('auth');
    res.redirect('/');
});

app.post('/create', (req, res) => {
    if (req.cookies.auth !== 'true') return res.redirect('/');
    let k = req.body.key;
    let d = parseInt(req.body.days) || 1;
    if (k) {
        licenses[k] = {
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
// 2. LUA SCRIPT İÇİN GÜVENLİK VE API DOĞRULAMA
// ==========================================
app.get('/', (req, res) => {
    if (req.query.api_check === '1') {
        let key = req.query.key;
        let hwid = req.query.hwid;

        if (!key || !licenses[key]) {
            return res.json({ status: "error", message: "GEÇERSİZ VEYA RASTGELE KEY!" });
        }

        let lic = licenses[key];

        if (lic.banned) {
            return res.json({ status: "error", message: "BU KEY BANLANMIŞTIR!" });
        }

        if (Date.now() > lic.expiry) {
            return res.json({ status: "error", message: "KEY SÜRESİ DOLMUŞ!" });
        }

        // Tek Cihaz (HWID) Kilidi Kontrolü
        if (!lic.hwid) {
            lic.hwid = hwid; // İlk açıldığı cihaza kilitlenir
        } else if (lic.hwid !== hwid) {
            return res.json({ status: "error", message: "MAKSİMUM CİHAZ SINIRINA ULAŞILDI (Başka Cihazda Çalışmaz)!" });
        }

        return res.json({ status: "success", message: "Giriş Başarılı! İyi Oyunlar." });
    }
});

// ==========================================
// 3. RENDER UYUTmama (KEEP-ALIVE) MEKANİZMASi
// ==========================================
setInterval(() => {
    http.get('http://rebrand-saja.onrender.com', (res) => {}).on('error', () => {});
}, 240000); // Her 4 dakikada bir kendini tetikler

app.listen(PORT, () => {
    console.log(`Starbaba server running on port ${PORT}`);
});
