const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'keys.json');

const ADMIN_USER = "starbaba511";
const ADMIN_PASS = "starbaba511511";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Veritabanı Yükleme / Kaydetme Fonksiyonları
function getKeys() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 4));
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

function saveKeys(keys) {
    fs.writeFileSync(DB_FILE, JSON.stringify(keys, null, 4));
}

// 1. API KONTROLÜ (Lua oyun scriptinden gelen istekler için)
app.get('/', (req, res, next) => {
    if (req.query.api_check !== undefined) {
        const keys = getKeys();
        const incomingKey = req.query.key || '';
        const incomingHwid = req.query.hwid || '';
        const currentTime = Math.floor(Date.now() / 1000);

        if (!keys[incomingKey]) {
            return res.json({ status: "error", message: "Geçersiz Key!" });
        }

        let kdata = keys[incomingKey];

        if (kdata.status === 'Banlı') {
            return res.json({ status: "error", message: "Bu Key Banlanmıştır!" });
        }

        if (kdata.type !== 'unlimited' && kdata.expires_at && currentTime > kdata.expires_at) {
            return res.json({ status: "error", message: "Key Süresi Dolmuş!" });
        }

        const allowedDevices = parseInt(kdata.max_devices || 1);
        if (!kdata.hwid_list) {
            kdata.hwid_list = kdata.hwid ? [kdata.hwid] : [];
        }

        if (kdata.hwid_list.includes(incomingHwid)) {
            return res.json({ status: "success", message: "Giriş Başarılı!" });
        } else {
            if (kdata.hwid_list.length < allowedDevices) {
                kdata.hwid_list.push(incomingHwid);
                if (!kdata.expires_at && kdata.type !== 'unlimited') {
                    kdata.expires_at = currentTime + kdata.duration;
                }
                keys[incomingKey] = kdata;
                saveKeys(keys);
                return res.json({ status: "success", message: "Cihaz başarıyla eklendi!" });
            } else {
                return res.json({ status: "error", message: "Maksimum cihaz sınırına ulaşıldı!" });
            }
        }
    }
    next();
});

// Çıkış İşlemi
app.get('/logout', (req, res) => {
    res.clearCookie('admin_logged');
    res.redirect('/');
});

// Giriş İşlemi (POST)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.cookie('admin_logged', 'true', { maxAge: 86400000, httpOnly: true });
        res.redirect('/');
    } else {
        res.redirect('/?error=Hatalı+kullanıcı+adı+veya+şifre');
    }
});

// Panel İşlemleri (Key Üretme ve Yönetim)
app.post('/action', (req, res) => {
    const isLogged = req.cookies.admin_logged === 'true';
    if (!isLogged) return res.redirect('/');

    let keys = getKeys();
    const { create_key, action, target_key } = req.body;

    if (create_key !== undefined) {
        const type = req.body.key_type;
        const category = req.body.category;
        let maxDevices = parseInt(req.body.max_devices) || 1;
        if (maxDevices < 1) maxDevices = 1;

        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        let prefix = "STAR_";
        if (category === 'FREE') {
            prefix += "free_";
        } else {
            if (type === 'day') prefix += "day_";
            else if (type === 'week') prefix += "week_";
            else if (type === 'month') prefix += "month_";
            else if (type === 'seasonal') prefix += "seasonal_";
            else if (type === 'unlimited') prefix += "unl_";
        }

        const newKey = prefix + randomStr;
        let duration = 86400;
        if (type === 'week') duration = 604800;
        else if (type === 'month') duration = 2592000;
        else if (type === 'seasonal') duration = 7776000;
        else if (type === 'unlimited') duration = 999999999;

        keys[newKey] = {
            key: newKey,
            category: category,
            type: type,
            status: 'Aktif',
            max_devices: maxDevices,
            hwid_list: [],
            created_at: Math.floor(Date.now() / 1000),
            duration: duration,
            expires_at: 0
        };
        saveKeys(keys);
    } else if (action && target_key && keys[target_key]) {
        if (action === 'delete') {
            delete keys[target_key];
        } else if (action === 'ban') {
            keys[target_key].status = 'Banlı';
        } else if (action === 'unban') {
            keys[target_key].status = 'Aktif';
        } else if (action === 'reset_hwid') {
            keys[target_key].hwid_list = [];
            keys[target_key].expires_at = 0;
        }
        saveKeys(keys);
    }
    res.redirect('/');
});

// 2. WEB PANEL ARAYÜZÜ
app.get('/', (req, res) => {
    const isLogged = req.cookies.admin_logged === 'true';
    const errorMsg = req.query.error || '';

    if (!isLogged) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>STARBABA - Giriş Yap</title>
                <style>
                    * { box-sizing: border-box; }
                    body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
                    .login-card { background: #1e293b; padding: 40px 30px; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.7); width: 100%; max-width: 420px; }
                    h2 { text-align: center; margin-bottom: 25px; color: #38bdf8; font-size: 26px; }
                    input { width: 100%; padding: 14px; margin: 12px 0; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 8px; font-size: 16px; }
                    button { width: 100%; padding: 14px; background: #38bdf8; border: none; color: #0f172a; font-weight: bold; border-radius: 8px; cursor: pointer; margin-top: 15px; font-size: 16px; }
                    button:hover { background: #0ea5e9; }
                    .error { color: #f87171; text-align: center; font-size: 14px; margin-bottom: 10px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="login-card">
                    <h2>STARBABA PANEL</h2>
                    ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
                    <form method="POST" action="/login">
                        <input type="text" name="username" placeholder="Kullanıcı Adı" required>
                        <input type="password" name="password" placeholder="Şifre" required>
                        <button type="submit">Giriş Yap</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    }

    const keys = getKeys();
    const currentTime = Math.floor(Date.now() / 1000);
    let tableRows = '';
    const reversedKeys = Object.keys(keys).reverse();

    if (reversedKeys.length === 0) {
        tableRows = `<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Henüz key yok.</td></tr>`;
    } else {
        reversedKeys.forEach(k => {
            const data = keys[k];
            const category = data.category || 'VIP';
            const catBadge = category === 'VIP' ? 'badge-vip' : 'badge-free';
            const statusBadge = data.status === 'Aktif' ? 'badge-active' : 'badge-banned';
            const maxDev = data.max_devices || 1;
            const hwidList = data.hwid_list || [];
            
            let timeText = "Kullanılmadı";
            if (data.type === 'unlimited') {
                timeText = "Sınırsız";
            } else if (data.expires_at) {
                const left = data.expires_at - currentTime;
                timeText = left > 0 ? Math.floor(left / 3600) + " Saat" : "<span style='color:#f87171'>Bitti</span>";
            }

            tableRows += `
                <tr>
                    <td><strong class="clickable-key" onclick="copyKey('${data.key}')" title="Kopyala">${data.key}</strong></td>
                    <td><span class="badge ${catBadge}">${category}</span></td>
                    <td>${data.type.toUpperCase()}</td>
                    <td><span class="badge ${statusBadge}">${data.status}</span></td>
                    <td>${hwidList.length} / ${maxDev}</td>
                    <td>${timeText}</td>
                    <td>
                        <form method="POST" action="/action" style="display:inline;">
                            <input type="hidden" name="target_key" value="${data.key}">
                            ${data.status === 'Aktif' ? 
                                `<button type="submit" name="action" value="ban" class="btn-action btn-ban">Ban</button>` : 
                                `<button type="submit" name="action" value="unban" class="btn-action btn-unban">Aç</button>`
                            }
                            <button type="submit" name="action" value="reset_hwid" class="btn-action btn-reset" onclick="return confirm('Sıfırlansın mı?');">Reset</button>
                            <button type="submit" name="action" value="delete" class="btn-action btn-del" onclick="return confirm('Silinsin mi?');">Sil</button>
                        </form>
                    </td>
                </tr>
            `;
        });
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>STARBABA - Yönetim Paneli</title>
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: sans-serif; margin: 0; padding: 15px; }
                .container { max-width: 1100px; margin: auto; background: #1e293b; padding: 20px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 15px; flex-wrap: wrap; gap: 10px; }
                .header h2 { color: #38bdf8; margin: 0; font-size: 20px; }
                .logout { background: #ef4444; color: white; padding: 8px 15px; border-radius: 6px; text-decoration: none; font-size: 14px; }
                .panel-sections { display: grid; grid-template-columns: 1fr; gap: 20px; margin: 20px 0; max-width: 600px; margin-left: auto; margin-right: auto; }
                .card-box { background: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #334155; }
                .card-box h3 { margin-top: 0; color: #38bdf8; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
                select, input[type="number"] { width: 100%; padding: 12px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: white; font-size: 14px; margin-bottom: 12px; }
                button { padding: 12px 15px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; font-size: 14px; width: 100%; }
                .btn-create { background: #22c55e; color: white; }
                .btn-create:hover { background: #16a34a; }
                .table-responsive { width: 100%; overflow-x: auto; margin-top: 20px; }
                table { width: 100%; border-collapse: collapse; background: #0f172a; border-radius: 8px; overflow: hidden; min-width: 700px; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #1e293b; font-size: 13px; }
                th { background: #334155; color: #38bdf8; }
                .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
                .badge-active { background: #22c55e; color: white; }
                .badge-banned { background: #ef4444; color: white; }
                .badge-vip { background: #10b981; color: white; }
                .badge-free { background: #6366f1; color: white; }
                .btn-action { padding: 6px 10px; font-size: 12px; margin-right: 3px; border-radius: 4px; width: auto; display: inline-block; }
                .btn-ban { background: #f59e0b; color: white; }
                .btn-unban { background: #3b82f6; color: white; }
                .btn-reset { background: #8b5cf6; color: white; }
                .btn-del { background: #ef4444; color: white; }
                .clickable-key { cursor: pointer; color: #38bdf8; text-decoration: underline; }
                .clickable-key:hover { color: #7dd3fc; }
                .toast { position: fixed; bottom: 20px; right: 20px; background: #22c55e; color: white; padding: 12px 20px; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: none; z-index: 9999; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>STARBABA Key Yönetim Paneli</h2>
                    <a href="/logout" class="logout">Çıkış Yap</a>
                </div>

                <div class="panel-sections">
                    <div class="card-box">
                        <h3>Özel Tekil Key Oluştur</h3>
                        <form method="POST" action="/action">
                            <label style="font-size:13px; color:#94a3b8;">Kategori:</label>
                            <select name="category">
                                <option value="VIP">VIP Key</option>
                                <option value="FREE">Free Key</option>
                            </select>

                            <label style="font-size:13px; color:#94a3b8;">Süre Türü:</label>
                            <select name="key_type">
                                <option value="day">Günlük (1 Gün)</option>
                                <option value="week">Haftalık (7 Gün)</option>
                                <option value="month">Aylık (30 Gün)</option>
                                <option value="seasonal">Sezonluk</option>
                                <option value="unlimited">Sınırsız</option>
                            </select>

                            <label style="font-size:13px; color:#94a3b8;">Kaç Cihaz Girebilsin?</label>
                            <input type="number" name="max_devices" value="1" min="1" max="100000" required>

                            <button type="submit" name="create_key" value="1" class="btn-create">Tek Key Üret</button>
                        </form>
                    </div>
                </div>

                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Key Değeri (Tıkla Kopyala)</th>
                                <th>Kategori</th>
                                <th>Tür</th>
                                <th>Durum</th>
                                <th>Cihaz Limiti</th>
                                <th>Kalan Süre</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="toast" class="toast">Key kopyalandı!</div>

            <script>
            function copyKey(text) {
                navigator.clipboard.writeText(text).then(function() {
                    var toast = document.getElementById("toast");
                    toast.style.display = "block";
                    setTimeout(function() { toast.style.display = "none"; }, 2000);
                });
            }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Starbaba Server ${PORT} portunda başarıyla çalışıyor.`);
});
