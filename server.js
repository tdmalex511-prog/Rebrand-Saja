const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const PORT = process.env.PORT || 10000;
const app = express();

const token = '8600379958:AAEXZ7r9tFjyxubL7cRQSLMqhoPDZpl6Hfg';
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const activeKeys = {};

app.get('/', (req, res) => {
    res.send('STARBABA API is online!');
});

// ⚡ LİSANS KONTROL API (UNIX TIMESTAMP SİSTEMİ)
app.get('/check', (req, res) => {
    const key = req.query.key ? req.query.key.trim() : '';
    const hwid = req.query.hwid ? req.query.hwid.trim() : '';

    if (!key) return res.send('error: no key');

    const keyData = activeKeys[key];
    if (!keyData) {
        return res.send('error: expired');
    }

    const currentUnixTime = Math.floor(Date.now() / 1000);

    // Süre bittiyse kesinlikle expired dön ve bellekten sil
    if (currentUnixTime > keyData.expireTime) {
        delete activeKeys[key];
        return res.send('error: expired');
    }

    // HWID Kontrolü
    if (!keyData.hwid && hwid && hwid !== 'UNKNOWN_DEV') {
        keyData.hwid = hwid;
    } else if (keyData.hwid && hwid && keyData.hwid !== hwid && hwid !== 'UNKNOWN_DEV') {
        return res.send('error: hwid mismatch');
    }

    return res.send('success');
});

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
        bot.sendMessage(msg.chat.id, '⭐ STARBABA PANELİNE HOŞ GELDİNİZ', keyboard);
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
            durationSeconds = 315360000; // 10 Yıl
            break;
    }

    const generatedKey = prefix + randomStr;
    const expireTime = Math.floor(Date.now() / 1000) + durationSeconds;

    activeKeys[generatedKey] = {
        expireTime: expireTime,
        hwid: null
    };

    bot.sendMessage(query.message.chat.id, `✅ Key Üretildi:\n\n<code>${generatedKey}</code>`, { parse_mode: 'HTML' });
    bot.answerCallbackQuery(query.id);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
