const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Basit çerez okuma
function getCookie(req, name) {
    const list = {};
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    cookieHeader.split(`;`).forEach(cookie => {
        let [key, ...val] = cookie.split(`=`);
        key = key.trim();
        let valStr = val.join(`=`);
        list[key] = decodeURIComponent(valStr);
    });
    return list[name] || null;
}

let dbKeys = {};

// Otomatik rastgele şifreli key üretici
function generateRandomKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'STARLUA';
    for (let i = 0; i < 3; i++) {
        let part = '';
        for (let j = 0; j < 4; j++) {
            part += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        code += '-' + part;
    }
    return code;
}

function calculateExpireTime(type) {
    const now = Date.now();
    switch (type) {
        case '30m': return now + (30 * 60 * 1000);
        case '1d':  return now + (24 * 60 * 60 * 1000);
        case '1w':  return now + (7 * 24 * 60 * 60 * 1000);
        case '1m':  return now + (30 * 24 * 60 * 60 * 1000);
        case 'lifetime': return now + (365 * 100 * 24 * 60 * 60 * 1000);
        default: return now + (24 * 60 * 60 * 1000);
    }
}

// GİRİŞ EKRANI (LOGIN)
app.get('/login', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>STAR LUA - Giriş</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; background: #0b0f19; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .login-box { background: #1e293b; padding: 30px; border-radius: 12px; width: 100%; max-width: 400px; box-shadow: 0 8px 20px rgba(0,0,0,0.6); }
                h2 { text-align: center; color: #38bdf8; font-size: 28px; margin-bottom: 25px; }
                label { font-size: 16px; font-weight: bold; display: block; margin-top: 15px; }
                input { width: 100%; padding: 14px; margin-top: 8px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 16px; box-sizing: border-box; }
                button { width: 100%; padding: 14px; margin-top: 25px; border-radius: 8px; border: none; background: #0284c7; color: white; font-size: 18px; font-weight: bold; cursor: pointer; }
                button:hover { background: #0369a1; }
                .error { color: #f87171; text-align: center; margin-top: 15px; font-size: 15px; }
            </style>
        </head>
        <body>
            <div class="login-box">
                <h2>STAR LUA</h2>
                <form action="/login" method="POST">
                    <label>Kullanıcı Adı:</label>
                    <input type="text" name="username" required autocomplete="off">
                    <label>Şifre:</label>
                    <input type="password" name="password" required>
                    <button type="submit">Giriş Yap</button>
                </form>
                ${req.query.err ? '<div class="error">Kullanıcı adı veya şifre hatalı!</div>' : ''}
            </div>
        </body>
        </html>
    `);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'starbaba' && password === 'starbaba511') {
        res.setHeader('Set-Cookie', 'starlua_auth=true; Path=/; HttpOnly');
        res.redirect('/');
    } else {
        res.redirect('/login?err=1');
    }
});

// ANA YÖNETİM PANELİ
app.get('/', (req, res) => {
    const auth = getCookie(req, 'starlua_auth');
    if (!auth) {
        return res.redirect('/login');
    }

    const search = req.query.search ? req.query.search.toLowerCase() : '';
    
    let rows = '';
    for (let [k, v] of Object.entries(dbKeys)) {
        if (search && !k.toLowerCase().includes(search)) continue;

        let expireDate = new Date(v.expire).toLocaleString('tr-TR');
        let isExpired = Date.now() > v.expire ? '<span style="color:#f87171;">(Süresi Bitmiş)</span>' : '';
        
        rows += `
            <tr>
                <td style="word-break: break-all; font-weight: bold; color: #38bdf8;">${k}</td>
                <td>${v.status.toUpperCase()} ${isExpired}</td>
                <td style="word-break: break-all;">${v.boundSerial || 'Bağlı Değil'}</td>
                <td>${expireDate}</td>
                <td>
                    <a href="/reset-hwid?key=${encodeURIComponent(k)}" style="color:#fbbf24;">HWID Reset</a> | 
                    <a href="/toggle-ban?key=${encodeURIComponent(k)}" style="color:#facc15;">${v.status === 'banned' ? 'Uniban' : 'Ban'}</a> | 
                    <a href="/delete-key?key=${encodeURIComponent(k)}" style="color:#f87171;">Sil</a>
                </td>
            </tr>
        `;
    }

    res.send(`
        <html>
        <head>
            <title>STAR LUA - Yönetim Paneli</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; background: #0b0f19; color: #f8fafc; padding: 15px; margin: 0; }
                .container { max-width: 1000px; margin: auto; background: #1e293b; padding: 20px; border-radius: 12px; box-shadow: 0 6px 15px rgba(0,0,0,0.6); }
                h2 { color: #38bdf8; text-align: center; font-size: 28px; margin-top: 0; }
                .card { background: #0f172a; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #334155; }
                label { font-size: 16px; font-weight: bold; display: block; margin-top: 10px; color: #cbd5e1; }
                select, button, input { padding: 12px; margin-top: 6px; border-radius: 8px; border: 1px solid #475569; width: 100%; box-sizing: border-box; font-size: 16px; background: #1e293b; color: #fff; }
                button { background: #0284c7; color: white; font-weight: bold; cursor: pointer; border: none; margin-top: 12px; font-size: 18px; }
                button:hover { background: #0369a1; }
                table { width: 100%; margin-top: 15px; border-collapse: collapse; overflow-x: auto; display: block; }
                th, td { padding: 12px; border-bottom: 1px solid #334155; text-align: left; font-size: 15px; }
                th { background: #0f172a; color: #38bdf8; }
                a { text-decoration: none; font-weight: bold; }
                .search-container { display: flex; gap: 10px; }
                .logout-btn { background: #dc2626; padding: 10px 15px; border-radius: 8px; color: #fff; font-weight: bold; text-decoration: none; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="margin:0;">STAR LUA</h2>
                    <a href="/logout" class="logout-btn">Çıkış Yap</a>
                </div>
                
                <!-- Otomatik Key Oluşturma -->
                <div class="card">
                    <h3 style="margin-top:0; color:#38bdf8;">Otomatik Key Üret</h3>
                    <form action="/create-key" method="POST">
                        <label>Süre Seçin:</label>
                        <select name="duration">
                            <option value="30m">30 Dakika</option>
                            <option value="1d">1 Günlük</option>
                            <option value="1w">1 Haftalık</option>
                            <option value="1m">1 Aylık</option>
                            <option value="lifetime">Sınırsız (Lifetime)</option>
                        </select>
                        <button type="submit">Otomatik Key Oluştur</button>
                    </form>
                </div>

                <!-- Arama Kutusu -->
                <form action="/" method="GET" class="search-container">
                    <input type="text" name="search" placeholder="Key Ara..." value="${req.query.search || ''}">
                    <button type="submit" style="width: 140px; margin-top:0;">Ara</button>
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
                    ${rows || '<tr><td colspan="5" style="text-align:center; padding: 20px; color:#94a3b8;">Henüz kayıtlı key bulunmuyor.</td></tr>'}
                </table>
            </div>
        </body>
        </html>
    `);
});

// ÇIKIŞ
app.get('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'starlua_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.redirect('/login');
});

// OTOMATİK KEY ÜRETME İŞLEMİ
app.post('/create-key', (req, res) => {
    const auth = getCookie(req, 'starlua_auth');
    if (!auth) return res.redirect('/login');

    const { duration } = req.body;
    const newKey = generateRandomKey(); // Tamamen otomatik ve rastgele key üretir
    
    dbKeys[newKey] = {
        expire: calculateExpireTime(duration),
        boundSerial: null,
        status: 'active'
    };

    res.redirect('/');
});

// HWID RESET
app.get('/reset-hwid', (req, res) => {
    const auth = getCookie(req, 'starlua_auth');
    if (!auth) return res.redirect('/login');

    const key = req.query.key;
    if (key && dbKeys[key]) {
        dbKeys[key].boundSerial = null;
    }
    res.redirect('/');
});

// BAN / UNIBAN
app.get('/toggle-ban', (req, res) => {
    const auth = getCookie(req, 'starlua_auth');
    if (!auth) return res.redirect('/login');

    const key = req.query.key;
    if (key && dbKeys[key]) {
        dbKeys[key].status = dbKeys[key].status === 'banned' ? 'active' : 'banned';
    }
    res.redirect('/');
});

// SİL
app.get('/delete-key', (req, res) => {
    const auth = getCookie(req, 'starlua_auth');
    if (!auth) return res.redirect('/login');

    const key = req.query.key;
    if (key && dbKeys[key]) {
        delete dbKeys[key];
    }
    res.redirect('/');
});

// LUA SCRIPTİNDEN GELEN DOĞRULAMA API'Sİ
app.post('/connect', (req, res) => {
    const { game, user_key, serial } = req.body;
    
    if (!user_key || !serial) {
        return res.json({ status: false, reason: "INVALID_REQUEST" });
    }

    const cleanKey = user_key.trim();

    if (!dbKeys[cleanKey]) {
        return res.json({ status: false, reason: "USER OR GAME NOT REGISTERED" });
    }

    let keyData = dbKeys[cleanKey];

    if (keyData.status === 'banned') {
        return res.json({ status: false, reason: "USER BLOCKED" });
    }

    if (Date.now() > keyData.expire) {
        return res.json({ status: false, reason: "KEY EXPIRED" });
    }

    // HWID Tek Cihaz Kilidi
    if (keyData.boundSerial === null) {
        keyData.boundSerial = serial;
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`STAR LUA Panel aktif, ${PORT} portunda çalışıyor.`);
});
