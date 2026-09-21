const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const PORT = process.env.PORT || 10000;
const app = express();

// Telegram Bot Tokenin
const token = '8600379958:AAEXZ7r9tFjyxubL7cRQSLMqhoPDZpl6Hfg';
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Aktif keylerin tutulduğu bellek
const activeKeys = {};

// 🧹 ARKA PLANDA SÜREKLİ ÇALIŞAN SUNUCU TEMİZLİKÇİSİ (Süresi biten key'leri bellekten ve kökten siler)
setInterval(() => {
    const now = Date.now();
    for (const key in activeKeys) {
        if (now > activeKeys[key].expiresAt) {
            console.log(`[AUTO-DELETE] Süresi dolan key sunucudan tamamen silindi: ${key}`);
            delete activeKeys[key]; // Bellekten kazı ve yok et
        }
    }
}, 5000); // Her 5 saniyede bir süresi dolanları kontrol eder ve siler

// Sunucu Durum Kontrolü
app.get('/', (req, res) => {
    res.send('STARBABA KEY BOT & API is active and running perfectly!');
});

// Lua / Oyun Tarafından Lisans Sorgulama (GET)
app.get('/check', (req, res) => {
    const key = req.query.key ? req.query.key.trim() : '';
    const hwid = req.query.hwid ? req.query.hwid.trim() : '';

    if (!key) {
        return res.send('error: no key provided');
    }

    const keyData = activeKeys[key];

    // Key veritabanında (bellekte) yoksa veya yukarıdaki döngü sildiyse
    if (!keyData) {
        console.log(`[CHECK] Reddedildi - Key bulunamadı veya süresi bitti: ${key}`);
        return res.send('error: expired');
    }

    const now = Date.now();

    // Süre doldu mu kesin kontrolü
    if (now > keyData.expiresAt) {
        console.log(`[CHECK] Süresi dolmuş key engellendi: ${key}`);
        delete activeKeys[key];
        return res.send('error: expired');
    }

    // HWID Eşleştirme Koruması
    if (!keyData.hwid && hwid && hwid !== 'UNKNOWN_DEV') {
        keyData.hwid = hwid;
        console.log(`[CHECK] HWID Eşleşti -> Key: ${key} | HWID: ${hwid}`);
    } else if (keyData.hwid && hwid && keyData.hwid !== hwid && hwid !== 'UNKNOWN_DEV') {
        console.log(`[CHECK] HWID Uyuşmazlığı! Engellendi -> Kayıtlı: ${keyData.hwid}, Gelen: ${hwid}`);
        return res.send('error: hwid mismatch');
    }

    return res.send('success');
});

// Telegram /start Komutu ve Buton Dizilimi
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

// Butona Basıldığında Key Üretme Mantığı
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
            durationMs = 60 * 1000; // Tam 1 Dakika
            durationText = '1 Dakika (Test)';
            break;
        case 'saatlik':
            generatedKey = 'STARBABA-SAAT-' + randomStr;
            durationMs = 60 * 60 * 1000;
            durationText = '1 Saat';
            break;
        case 'gunluk':
            generatedKey = 'STARBABA-GUN-' + randomStr;
            durationMs = 24 * 60 * 60 * 1000;
            durationText = '1 Gün';
            break;
        case 'haftalik':
            generatedKey = 'STARBABA-HAFTA-' + randomStr;
            durationMs = 7 * 24 * 60 * 60 * 1000;
            durationText = '1 Hafta';
            break;
        case 'aylik':
            generatedKey = 'STARBABA-AY-' + randomStr;
            durationMs = 30 * 24 * 60 * 60 * 1000;
            durationText = '1 Ay';
            break;
        case 'sinirsiz':
            generatedKey = 'STARBABA-VIP-SINIRSIZ-' + randomStr;
            durationMs = 365 * 10 * 24 * 60 * 60 * 1000; // 10 Yıl
            durationText = 'Sınırsız';
            break;
        case 'free_1000':
            generatedKey = 'STARBABA-1000-CIHAZ-' + randomStr;
            durationMs = 24 * 60 * 60 * 1000;
            durationText = 'Free 1000 Cihaz (1 Gün)';
            break;
    }

    // Key'i ve bitiş süresini belleğe kaydet
    activeKeys[generatedKey] = {
        expiresAt: Date.now() + durationMs,
        hwid: null
    };

    console.log(`[GENERATE] Yeni key üretildi: ${generatedKey} (${durationText}) - Bitiş: ${new Date(activeKeys[generatedKey].expiresAt).toLocaleTimeString()}`);

    bot.sendMessage(chatId, `✅ Yeni Key Üretildi (${durationText}):\n\n<code>${generatedKey}</code>\n\nSüresi bittiğinde sistem otomatik olarak erişimi kesecektir!`, { parse_mode: 'HTML' });
    bot.answerCallbackQuery(query.id);
});

app.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
