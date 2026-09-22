const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const PORT = process.env.PORT || 10000;
const app = express();

const token = '8600379958:AAEXZ7r9tFjyxubL7cRQSLMqhoPDZpl6Hfg';
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let activeKeys = {};

// Web Paneli (Yine dursun, alternatif olarak tarayıcıdan da bakabilirsin)
app.get('/', (req, res) => {
    let html = `<h2>STARBABA Admin Panel</h2><table border="1" cellpadding="5"><tr><th>Key</th><th>Süre (Saniye)</th><th>Kalan Süre</th><th>HWID</th><th>Durum</th></tr>`;
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
        html += `<tr><td>${k}</td><td>${item.duration}</td><td>${remaining}</td><td>${item.hwid || 'Boş'}</td><td><b>${item.status}</b></td></tr>`;
    }
    if (count === 0) {
        html += `<tr><td colspan="5" align="center">Henüz aktif key yok.</td></tr>`;
    }
    html += `</table>`;
    res.send(html);
});

// Lisans Doğrulama API
app.get('/check', (req, res) => {
    let key = req.query.key ? req.query.key.trim() : '';
    let hwid = req.query.hwid ? req.query.hwid.trim() : '';

    if (!key) return res.send('error: no key');

    let keyData = activeKeys[key];
    if (!keyData) return res.send('error: expired');

    if (keyData.status === 'banned') return res.send('error: banned');
    if (keyData.status === 'expired' || keyData.status === 'deleted') return res.send('error: expired');

    let now = Math.floor(Date.now() / 1000);

    if (!keyData.firstUsedAt) {
        keyData.firstUsedAt = now;
    }

    if (keyData.duration > 0) {
        let elapsed = now - keyData.firstUsedAt;
        if (elapsed >= keyData.duration) {
            keyData.status = 'expired';
            return res.send('error: expired');
        }
    }

    if (!keyData.hwid && hwid && hwid !== 'UNKNOWN_DEV') {
        keyData.hwid = hwid;
    } else if (keyData.hwid && hwid && keyData.hwid !== hwid && hwid !== 'UNKNOWN_DEV') {
        return res.send('error: hwid mismatch');
    }

    return res.send('success');
});

// Telegram Bot Komutları ve Buton Yönetimi
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    if (text === '/start') {
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⚡ 1 Dakikalık Key Üret', callback_data: '1dk' }],
                    [{ text: '🕒 Saatlik Key Üret', callback_data: 'saat' }, { text: '📅 Günlük Key Üret', callback_data: 'gun' }],
                    [{ text: '📆 Haftalık Key Üret', callback_data: 'hafta' }, { text: '🗓 Aylık Key Üret', callback_data: 'ay' }],
                    [{ text: '♾️ Sınırsız Key Üret', callback_data: 'sinirsiz' }],
                    [{ text: '📋 Aktif Keyleri Listele', callback_data: 'listele' }]
                ]
            }
        };
        bot.sendMessage(chatId, '⭐ Starbaba Yönetim Paneline Hoş Geldiniz.\n\nAşağıdan key üretebilir veya yönetebilirsiniz:', keyboard);
    } 
    // Bot üzerinden komutla işlem yapabilme (Örn: /ban STARBABA-...)
    else if (text.startsWith('/ban ')) {
        let keyToBan = text.replace('/ban ', '').trim();
        if (activeKeys[keyToBan]) {
            activeKeys[keyToBan].status = 'banned';
            bot.sendMessage(chatId, `✅ Başarıyla Banlandı:\n<code>${keyToBan}</code>`, { parse_mode: 'HTML' });
        } else {
            bot.sendMessage(chatId, `❌ Bu key sistemde bulunamadı!`);
        }
    } 
    else if (text.startsWith('/reset ')) {
        let keyToReset = text.replace('/reset ', '').trim();
        if (activeKeys[keyToReset]) {
            activeKeys[keyToReset].hwid = null;
            bot.sendMessage(chatId, `✅ HWID Sıfırlandı:\n<code>${keyToReset}</code>`, { parse_mode: 'HTML' });
        } else {
            bot.sendMessage(chatId, `❌ Bu key sistemde bulunamadı!`);
        }
    } 
    else if (text.startsWith('/delete ')) {
        let keyToDelete = text.replace('/delete ', '').trim();
        if (activeKeys[keyToDelete]) {
            delete activeKeys[keyToDelete];
            bot.sendMessage(chatId, `✅ Key Sistemden Silindi:\n<code>${keyToDelete}</code>`, { parse_mode: 'HTML' });
        } else {
            bot.sendMessage(chatId, `❌ Bu key sistemde bulunamadı!`);
        }
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'listele') {
        let count = 0;
        let msgText = "<b>📋 Aktif Key Listesi:</b>\n\n";
        let now = Math.floor(Date.now() / 1000);

        for (let k in activeKeys) {
            count++;
            let item = activeKeys[k];
            let remText = "Başlamadı";
            if (item.firstUsedAt && item.duration > 0) {
                let passed = now - item.firstUsedAt;
                let rem = item.duration - passed;
                remText = rem > 0 ? `${rem} sn` : "Bitti";
            }
            msgText += `🔑 <code>${k}</code>\n- Durum: <b>${item.status}</b>\n- Kalan: ${remText}\n- HWID: ${item.hwid || 'Yok'}\n\n`;
            msgText += `İşlem Komutları:\n/ban ${k}\n/reset ${k}\n/delete ${k}\n-------------------\n`;
        }

        if (count === 0) {
            bot.sendMessage(chatId, "Henüz oluşturulmuş bir key yok.");
        } else {
            bot.sendMessage(chatId, msgText, { parse_mode: 'HTML' });
        }
        bot.answerCallbackQuery(query.id);
        return;
    }

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

    bot.sendMessage(chatId, `✅ Yeni Key Üretildi:\n\n<code>${generatedKey}</code>`, { parse_mode: 'HTML' });
    bot.answerCallbackQuery(query.id);
});

app.listen(PORT, () => {
    console.log(`Starbaba Server running on port ${PORT}`);
});
