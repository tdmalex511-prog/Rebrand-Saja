const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const PORT = process.env.PORT || 10000;
const app = express();

// 🔥 Buraya BotFather'dan aldığın güncel token'ı yaz (veya env'den al)
const token = process.env.BOT_TOKEN || 'BURAYA_BOT_TOKENINI_YAZ';
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Key Veritabanı Bellek Deposu
let activeKeys = {};

app.get('/', (req, res) => {
    let html = `<h2>STARBABA Admin Panel</h2><table border="1" cellpadding="5"><tr><th>Key</th><th>Süre (Saniye)</th><th>Kalan Süre</th><th>HWID</th><th>Durum</th></tr>`;
    let now = Math.floor(Date.now() / 1000);

    for (let k in activeKeys) {
        let item = activeKeys[k];
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

// ⚡ LİSANS KONTROL API (Lua Buraya Sorar)
app.get('/check', (req, res) => {
    let key = req.query.key ? req.query.key.trim() : '';
    let hwid = req.query.hwid ? req.query.hwid.trim() : '';

    if (!key) return res.send('error: no key');

    let keyData = activeKeys[key];
    if (!keyData) return res.send('error: expired');

    if (keyData.status === 'banned') return res.send('error: banned');
    if (keyData.status === 'deleted') return res.send('error: expired');

    let now = Math.floor(Date.now() / 1000);

    // İlk kullanım anı ve süreyi başlatma
    if (!keyData.firstUsedAt) {
        keyData.firstUsedAt = now;
    }

    // Süre bitti mi kontrolü
    if (keyData.duration > 0) {
        let elapsed = now - keyData.firstUsedAt;
        if (elapsed >= keyData.duration) {
            keyData.status = 'expired';
            return res.send('error: expired');
        }
    }

    // HWID Kilitleme
    if (!keyData.hwid && hwid && hwid !== 'UNKNOWN_DEV') {
        keyData.hwid = hwid;
    } else if (keyData.hwid && hwid && keyData.hwid !== hwid && hwid !== 'UNKNOWN_DEV') {
        return res.send('error: hwid mismatch');
    }

    return res.send('success');
});

// 🛠️ YÖNETİM KOMUTLARI (Reset, Ban, Unban, Sil)
app.get('/reset', (req, res) => {
    let key = req.query.key;
    if (activeKeys[key]) {
        activeKeys[key].hwid = null;
        return res.send(`OK: ${key} HWID sıfırlandı.`);
    }
    res.send('Key bulunamadı!');
});

app.get('/ban', (req, res) => {
    let key = req.query.key;
    if (activeKeys[key]) {
        activeKeys[key].status = 'banned';
        return res.send(`OK: ${key} banlandı.`);
    }
    res.send('Key bulunamadı!');
});

app.get('/unban', (req, res) => {
    let key = req.query.key;
    if (activeKeys[key]) {
        activeKeys[key].status = 'active';
        return res.send(`OK: ${key} unbanlandı.`);
    }
    res.send('Key bulunamadı!');
});

app.get('/delete', (req, res) => {
    let key = req.query.key;
    if (activeKeys[key]) {
        delete activeKeys[key];
        return res.send(`OK: ${key} silindi.`);
    }
    res.send('Key bulunamadı!');
});

// TELEGRAM BOT BUTON YÖNETİMİ
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
        case '1dk':
            prefix = 'STARBABA-1DK-';
            durationSeconds = 60; // Tam 60 Saniye
            break;
        case 'saat':
            prefix = 'STARBABA-SAAT-';
            durationSeconds = 3600;
            break;
        case 'gun':
            prefix = 'STARBABA-GUN-';
            durationSeconds = 86400;
            break;
        case 'hafta':
            prefix = 'STARBABA-HAFTA-';
            durationSeconds = 604800;
            break;
        case 'ay':
            prefix = 'STARBABA-AY-';
            durationSeconds = 2592000;
            break;
        case 'sinirsiz':
            prefix = 'STARBABA-VIP-';
            durationSeconds = 0; // Sınırsız
            break;
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
