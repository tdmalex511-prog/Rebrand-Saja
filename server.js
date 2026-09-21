const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const PORT = process.env.PORT || 10000;
const app = express();

// Telegram Bot Tokenin
const token = '8600379958:AAEXZ7r9tFjyxubL7cRQSLMqhoPDZpl6Hfg';
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Aktif keylerin tutulduğu ana bellek
const activeKeys = {};

// 🧹 SUNUCU ARKA PLAN TEMİZLEYİCİSİ (Her 2 saniyede bir süresi biten key'leri kökten siler)
setInterval(() => {
    const currentTime = Date.now();
    for (const k in activeKeys) {
        if (activeKeys.hasOwnProperty(k)) {
            if (currentTime > activeKeys[k].expiresAt) {
                console.log(`[SÜRESİ BİTTİ VE SİLİNDİ]: ${k}`);
                delete activeKeys[k]; // Bellekten ve panelden tamamen kazı
            }
        }
    }
}, 2000);

// Sunucu Durum Kontrolü
app.get('/', (req, res) => {
    res.send('STARBABA KEY BOT & API is active and running perfectly!');
});

// Lua Tarafından Lisans Sorgulama (GET /check)
app.get('/check', (req, res) => {
    const key = req.query.key ? req.query.key.trim() : '';
    const hwid = req.query.hwid ? req.query.hwid.trim() : '';

    if (!key) {
        return res.send('error: no key provided');
    }

    const keyData = activeKeys[key];

    // Key bellekte yoksa veya süresi dolup temizlendiyse
    if (!keyData) {
        return res.send('error: expired');
    }

    // Anlık zaman kontrolü
    if (Date.now() > keyData.expiresAt) {
        delete activeKeys[key];
        return res.send('error: expired');
    }

    // HWID Eşleştirme Koruması
    if (!keyData.hwid && hwid && hwid !== 'UNKNOWN_DEV') {
        keyData.hwid = hwid;
    } else if (keyData.hwid && hwid && keyData.hwid !== hwid && hwid !== 'UNKNOWN_DEV') {
        return res.send('error: hwid mismatch');
    }

    return res.send('success');
});

// Telegram /start Komutu
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '/start') {
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⚡ 1 Dakikalık Test Key', callback_data: 'bir_dakika' }],
                    [{ text: '🕒 Saatlik Key', callback_data: 'saatlik' }, { text: '📅 Günlük Key', callback_data: 'gunluk' }],
                    [{ text: '📆 Haftalık Key', callback_data: 'haftalik' }, { text: '🗓 Aylık Key', callback_data: 'aylik' }],
                    [{ text: '♾️ Sınırsız Key', callback_data: 'sinirsiz' }],
                    [{ text: '🎁 Free 1000 Cihaz Key', callback_data: 'free_1000' }]
                ]
            }
        };
        bot.sendMessage(chatId, '⭐ STARBABA KEY PANELİNE HOŞ GELDİNİZ\n\nİstediğiniz key türünü aşağıdaki butonlardan seçebilirsiniz:', keyboard);
    }
});

// Telegram Butonlarına Basıldığında Key Üretme
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    let generatedKey = '';
    let durationMs = 0;
    let durationText = '';

    const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();

    switch (data) {
        case 'bir_dakika':
            generatedKey = 'STARBABA-1DK-' + randomStr;
            durationMs = 60 * 1000; // Kesin 1 Dakika (60.000 ms)
            durationText = '1 Dakika (Test)';
            break;
        case 'saatlik':
            generatedKey = 'STARBABA-SAAT-' + randomStr;
            durationMs = 60 * 60 * 1000; // 1 Saat
            durationText = '1 Saat';
            break;
        case 'gunluk':
            generatedKey = 'STARBABA-GUN-' + randomStr;
            durationMs = 24 * 60 * 60 * 1000; // 1 Gün
            durationText = '1 Gün';
            break;
        case 'haftalik':
            generatedKey = 'STARBABA-HAFTA-' + randomStr;
            durationMs = 7 * 24 * 60 * 60 * 1000; // 1 Hafta
            durationText = '1 Hafta';
            break;
        case 'aylik':
            generatedKey = 'STARBABA-AY-' + randomStr;
            durationMs = 30 * 24 * 60 * 60 * 1000; // 1 Ay
            durationText = '1 Ay';
            break;
        case 'sinirsiz':
            generatedKey = 'STARBABA-VIP-SINIRSIZ-' + randomStr;
            durationMs = 365 * 10 * 24 * 60 * 60 * 1000; // 10 Yıl
            durationText = 'Sınırsız';
            break;
        case 'free_1000':
            generateKey = 'STARBABA-1000-CIHAZ-' + randomStr;
            durationMs = 24 * 60 * 60 * 1000; // 1 Gün
            durationText = 'Free 1000 Cihaz (1 Gün)';
            break;
    }

    // Süreyi ve bitiş zamanını kesin olarak kaydet
    const expirationTime = Date.now() + durationMs;
    activeKeys[generatedKey] = {
        expiresAt: expirationTime,
        hwid: null
    };

    console.log(`[YENİ KEY ÜRETİLDİ] Key: ${generatedKey} | Tür: ${durationText} | Bitiş MS: ${expirationTime}`);

    bot.sendMessage(chatId, `✅ Yeni Key Üretildi (${durationText}):\n\n<code>${generatedKey}</code>\n\nSüresi bittiğinde panelden otomatik silinecektir!`, { parse_mode: 'HTML' });
    bot.answerCallbackQuery(query.id);
});

app.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
