const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const PORT = process.env.PORT || 10000;
const app = express();

const token = '8600379958:AAEXZ7r9tFjyxubL7cRQSLMqhoPDZpl6Hfg';
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Aktif keyleri ve bitiş sürelerini tutan hafıza (Veritabanı)
// Format: { "KEY_KODU": { expiresAt: BitisZamaniTimestamp, hwid: "CihazID" } }
const activeKeys = {};

// Sağlık kontrolü
app.get('/', (req, res) => {
    res.send('STARBABA KEY BOT & API is active and running!');
});

// Lua scriptten gelen lisans kontrol endpoint'i (/ veya /api/check)
app.post('/', (req, res) => {
    const key = req.body.key || req.query.key;
    const hwid = req.body.hwid || req.query.hwid;

    if (!key || !activeKeys[key]) {
        return res.status(401).send('error: invalid or expired key');
    }

    const keyData = activeKeys[key];
    const now = Date.now();

    // Süresi dolmuş mu kontrol et
    if (now > keyData.expiresAt) {
        delete activeKeys[key]; // Süresi bittiği için sil
        return res.status(401).send('error: key expired');
    }

    // Eğer ilk defa giriyorsa HWID'yi sabitle
    if (!keyData.hwid) {
        keyData.hwid = hwid;
    } else if (keyData.hwid !== hwid && hwid !== 'UNKNOWN_DEV') {
        // Başka cihazda deneniyorsa engelle
        return res.status(403).send('error: hwid mismatch');
    }

    // Her şey yolunda, onay ver
    return res.status(200).send('success');
});

// Aynı endpoint için GET desteği (curl istekleri için)
app.get('/check', (req, res) => {
    const key = req.query.key;
    const hwid = req.query.hwid;

    if (!key || !activeKeys[key]) {
        return res.send('error: invalid key');
    }

    if (Date.now() > activeKeys[key].expiresAt) {
        delete activeKeys[key];
        return res.send('error: expired');
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
                    [{ text: '🕒 Saatlik Key (1 Saat)', callback_data: 'saatlik' }, { text: '📅 Günlük Key (1 Gün)', callback_data: 'gunluk' }],
                    [{ text: '📆 Haftalık Key (7 Gün)', callback_data: 'haftalik' }, { text: '🗓 Aylık Key (30 Gün)', callback_data: 'aylik' }],
                    [{ text: '♾️ Sınırsız Key', callback_data: 'sinirsiz' }],
                    [{ text: '🎁 Free 1000 Cihaz Key', callback_data: 'free_1000' }]
                ]
            }
        };
        bot.sendMessage(chatId, 'Starbaba Key Paneline Hoş Geldiniz\n\nİstediğiniz key türünü seçin:', keyboard);
    }
});

// Key Üretme ve Süre Hesaplama Mantığı
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    let generatedKey = '';
    let durationMs = 0;
    let durationText = '';

    const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();

    switch (data) {
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
            durationMs = 7 * 24 * 60 * 60 * 1000; // 7 Gün
            durationText = '1 Hafta';
            break;
        case 'aylik':
            generatedKey = 'STARBABA-AY-' + randomStr;
            durationMs = 30 * 24 * 60 * 60 * 1000; // 30 Gün
            durationText = '1 Ay';
            break;
        case 'sinirsiz':
            generatedKey = 'STARBABA-VIP-SINIRSIZ-' + randomStr;
            durationMs = 365 * 10 * 24 * 60 * 60 * 1000; // 10 Yıl (Sınırsız)
            durationText = 'Sınırsız';
            break;
        case 'free_1000':
            generatedKey = 'STARBABA-1000-CIHAZ-' + randomStr;
            durationMs = 24 * 60 * 60 * 1000; // 1 Gün
            durationText = 'Free 1000 Cihaz (1 Gün)';
            break;
    }

    // Key'i sistem veritabanına kaydet ve bitiş süresini işle
    activeKeys[generatedKey] = {
        expiresAt: Date.now() + durationMs,
        hwid: null
    };

    bot.sendMessage(chatId, `✅ Yeni Key Üretildi (${durationText}):\n\n<code>${generatedKey}</code>\n\nSüresi bitince otomatik iptal olur!`, { parse_mode: 'HTML' });
    bot.answerCallbackQuery(query.id);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
