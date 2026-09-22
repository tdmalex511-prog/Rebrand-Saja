const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const PORT = process.env.PORT || 10000;
const app = express();

const token = '8600379958:AAEXZ7r9tFjyxubL7cRQSLMqhoPDZpl6Hfg';
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let activeKeys = {};

// Admin Paneli (Tabloda müşterileri görür, Banlayabilir, HWID Sıfırlayabilir veya Silebilirsin)
app.get('/', (req, res) => {
    let html = `<h2>STARBABA Admin Panel</h2><table border="1" cellpadding="5"><tr><th>Key</th><th>Süre (Saniye)</th><th>Kalan Süre</th><th>HWID</th><th>Durum</th><th>Yönetim</th></tr>`;
    let now = Math.floor(Date.now() / 1000);
    let count = 0;

    for (let k in activeKeys) {
        count++;
        let item = activeKeys[k];
        let remaining = "Başlamadı";
        if (item.firstUsedAt && item.duration > 0) {
            let passed = now - item.firstUsedAt;
            let rem = item.duration - passed;
            remaining = rem > 0 ? `${rem} saniye` : "Süresi Bitti";
            if (rem <= 0) item.status = 'expired';
        }
        html += `<tr>
            <td>${k}</td>
            <td>${item.duration}</td>
            <td>${remaining}</td>
            <td>${item.hwid || 'Boş'}</td>
            <td><b>${item.status}</b></td>
            <td>
                <a href="/ban?key=${k}" style="color:red;">Banla</a> | 
                <a href="/reset?key=${k}" style="color:blue;">HWID Sıfırla</a> | 
                <a href="/delete?key=${k}" style="color:gray;">Sil</a>
            </td>
        </tr>`;
    }
    if (count === 0) {
        html += `<tr><td colspan="6" align="center">Henüz aktif key yok. Telegram botundan key üretin.</td></tr>`;
    }
    html += `</table>`;
    res.send(html);
});

// Lisans Doğrulama API (Lua buradan kontrol eder)
app.get('/check', (req, res) => {
    let key = req.query.key ? req.query.key.trim() : '';
    let hwid = req.query.hwid ? req.query.hwid.trim() : '';

    if (!key) return res.send('error: no key');

    let keyData = activeKeys[key];
    if (!keyData) return res.send('error: expired');

    if (keyData.status === 'banned') return res.send('error: banned');
    if (keyData.status === 'expired' || keyData.status === 'deleted') return res.send('error: expired');

    let now = Math.floor(Date.now() / 1000);

    // İlk kullanımda süreyi başlat ve HWID kilitle
    if (!keyData.firstUsedAt) {
        keyData.firstUsedAt = now;
    }

    // Süre bittiyse reddet
    if (keyData.duration > 0) {
        let elapsed = now - keyData.firstUsedAt;
        if (elapsed >= keyData.duration) {
            keyData.status = 'expired';
            return res.send('error: expired');
        }
    }

    // HWID Eşleştirme Koruması
    if (!keyData.hwid && hwid && hwid !== 'UNKNOWN_DEV') {
        keyData.hwid = hwid;
    } else if (keyData.hwid && hwid && keyData.hwid !== hwid && hwid !== 'UNKNOWN_DEV') {
        return res.send('error: hwid mismatch');
    }

    return res.send('success');
});

// Müşteri Yönetim Komutları (Tarayıcıdan tek tıkla yapılır)
app.get('/reset', (req, res) => {
    let key = req.query.key;
    if (activeKeys[key]) {
        activeKeys[key].hwid = null;
        return res.send(`OK: ${key} için HWID sıfırlandı. Müşteri başka telefondan girebilir.`);
    }
    res.send('Key bulunamadı!');
});

app.get('/ban', (req, res) => {
    let key = req.query.key;
    if (activeKeys[key]) {
        activeKeys[key].status = 'banned';
        return res.send(`OK: ${key} başarıyla banlandı. Hilesi kapanacaktır.`);
    }
    res.send('Key bulunamadı!');
});

app.get('/delete', (req, res) => {
    let key = req.query.key;
    if (activeKeys[key]) {
        delete activeKeys[key];
        return res.send(`OK: ${key} sistemden tamamen silindi.`);
    }
    res.send('Key bulunamadı!');
});

// Telegram Bot ile Key Üretme
bot.on('message', async (msg) => {
    if (msg.text === '/start') {
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⚡ 1 Dakikalık Test Key', callback_data: '1dk' }],
                    [{ text: '🕒 Saatlik Key', callback_data: 'saat' }, { text: '📅 Günlük Key', callback_data: 'gun' }],
                    [{ text: '📆 Haftalık Key', callback_data: 'hafta' }, { text: '🗓 Aylık Key', callback_data: 'ay' }],
                    [{ text: '♾️ Sınırsız Key', callback_data: 'sinirsiz' }]
                ]
            }
        };
        bot.sendMessage(msg.chat.id, '⭐ Starbaba Key Paneline Hoş Geldiniz', keyboard);
    }
});

bot.on('callback_query', async (query) => {
    const data = query.data;
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    let durationSeconds = 0;
    let prefix = '';

    switch (data) {
        case '1dk': prefix = 'STARBABA-1DK-'; durationSeconds = 60; break;
        case 'saat': prefix = 'STARBABA-SAAT-'; durationSeconds = 3600; break;
        case 'gun': prefix = 'STARBABA-GUN-'; durationSeconds = 86400; break;
        case 'hafta': prefix = 'STARBABA-HAFTA-'; durationSeconds = 604800; break;
        case 'ay': prefix = 'STARBABA-AY-'; durationSeconds = 2592000; break;
        case 'sinirsiz': prefix = 'STARBABA-VIP-'; durationSeconds = 0; break;
    }

    const generatedKey = prefix + randomStr;

    activeKeys[generatedKey] = {
        duration: durationSeconds,
        createdAt: Math.floor(Date.now() / 1000),
        firstUsedAt: null,
        hwid: null,
        status: 'active'
    };

    bot.sendMessage(query.message.chat.id, `✅ Key Üretildi:\n\n<code>${generatedKey}</code>`, { parse_mode: 'HTML' });
    bot.answerCallbackQuery(query.id);
});

app.listen(PORT, () => {
    console.log(`Starbaba Server running on port ${PORT}`);
});
