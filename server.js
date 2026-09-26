const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// --- AYARLAR ---
const TOKEN = 'TELEGRAM_BOT_TOKENINIZI_BURAYA_YAZIN'; // Bot tokenini buraya yaz
const PORT = process.env.PORT || 3000;
const DB_FILE = './licenses.json';

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const bot = new TelegramBot(TOKEN, { polling: true });

// Veritabanı dosyası yoksa oluştur
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

function getDB() {
    try {
        const data = fs.readFileSync(DB_FILE);
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Süre hesaplama fonksiyonu
function calculateExpiry(durationStr) {
    const now = new Date().getTime();
    switch (durationStr) {
        case '1m': return now + (60 * 1000);                  // 1 Dakika
        case '1h': return now + (60 * 60 * 1000);              // 1 Saat
        case '1d': return now + (24 * 60 * 60 * 1000);         // 1 Gün
        case '7d': return now + (7 * 24 * 60 * 60 * 1000);     // 7 Gün (Haftalık)
        case '30d': return now + (30 * 24 * 60 * 60 * 1000);   // 30 Gün (Aylık)
        case 'lifetime': return 'lifetime';                    // Sınırsız
        default: return null;
    }
}

// --- 1. LUA SCRIPTI İÇİN API KONTROL NOKTASI ---
app.get('/api/check', (req, res) => {
    const deviceId = req.query.device;
    if (!deviceId) {
        return res.json({ status: 'error', message: 'Device ID gereklidir.' });
    }

    const db = getDB();
    const license = db[deviceId];

    if (!license) {
        return res.json({ status: 'unauthorized', message: 'Key bulunamadı!' });
    }

    if (license.expires_at === 'lifetime') {
        return res.json({ status: 'active', type: 'lifetime' });
    }

    const now = new Date().getTime();
    if (now < license.expires_at) {
        return res.json({ status: 'active', expires_at: license.expires_at });
    } else {
        return res.json({ status: 'expired', message: 'Lisans süreniz dolmuştur.' });
    }
});

// --- 2. TELEGRAM BOTU YÖNETİMİ ---
const userState = {};

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    if (text === '/start') {
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⚡ 1 Dakikalık Key Üret', callback_data: 'dur_1m' }],
                    [
                        { text: '⏱ Saatlik Key Üret', callback_data: 'dur_1h' },
                        { text: '📅 Günlük Key Üret', callback_data: 'dur_1d' }
                    ],
                    [
                        { text: '📆 Haftalık Key Üret', callback_data: 'dur_7d' },
                        { text: '🗓 Aylık Key Üret', callback_data: 'dur_30d' }
                    ],
                    [{ text: '♾ Sınırsız Key Üret', callback_data: 'dur_lifetime' }],
                    [{ text: '📋 Aktif Keyleri Listele', callback_data: 'list_keys' }]
                ]
            }
        };
        return bot.sendMessage(chatId, "⭐ Starbaba Yönetim Paneline Hoş Geldiniz.\n\nAşağıdan key üretebilir veya yönetebilirsiniz:", opts);
    }

    // Kullanıcı bir Device ID gönderdiğinde
    if (text.length > 10 && !text.startsWith('/')) {
        if (!userState[chatId] || !userState[chatId].selected_duration) {
            return bot.sendMessage(chatId, "⚠️ Önce menüden hangi süreyle key üretmek istediğini seçmelisin!");
        }

        const durationKey = userState[chatId].selected_duration;
        const expiryTime = calculateExpiry(durationKey);

        const db = getDB();
        db[text] = {
            expires_at: expiryTime,
            created_at: new Date().getTime()
        };
        saveDB(db);

        delete userState[chatId];
        return bot.sendMessage(chatId, `✅ **Başarılı!**\n\nCihaz ID: \`${text}\`\nSüre: **${durationKey.toUpperCase()}** olarak tanımlandı.`, { parse_mode: 'Markdown' });
    }
});

// Butonlara basıldığında çalışacak kısım
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'list_keys') {
        const db = getDB();
        const keys = Object.keys(db);
        if (keys.length === 0) {
            return bot.answerCallbackQuery(query.id, { text: 'Hiç aktif key bulunmuyor!' });
        }
        let msgText = "📋 **Aktif Cihaz ID'leri:**\n\n";
        keys.forEach((k, index) => {
            msgText += `${index + 1}. \`${k}\`\n`;
        });
        return bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
    }

    if (data.startsWith('dur_')) {
        const durationKey = data.replace('dur_', '');
        userState[chatId] = { selected_duration: durationKey };

        bot.answerCallbackQuery(query.id, { text: `Süre seçildi: ${durationKey}. Şimdi Device ID gönder!` });
        return bot.sendMessage(chatId, `📌 **${durationKey.toUpperCase()}** türünde key seçildi.\n\nŞimdi müşterinin gönderdiği **Device ID**'yi buraya yapıştırıp gönder:`, { parse_mode: 'Markdown' });
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
