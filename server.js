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

// Veritabanını okuma/yazma yardımcıları
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

// Süre hesaplama fonksiyonu (milisaniye cinsinden)
function calculateExpiry(durationStr) {
    const now = new Date().getTime();
    switch (durationStr) {
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

    // Sınırsız kontrolü
    if (license.expires_at === 'lifetime') {
        return res.json({ status: 'active', type: 'lifetime' });
    }

    // Süre kontrolü
    const now = new Date().getTime();
    if (now < license.expires_at) {
        return res.json({ status: 'active', expires_at: license.expires_at });
    } else {
        return res.json({ status: 'expired', message: 'Lisans süreniz dolmuştur.' });
    }
});

// --- 2. TELEGRAM BOTU YÖNETİMİ ---
// Geçici olarak kullanıcıların süre seçimlerini tutmak için hafıza nesnesi
const userState = {};

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    if (text === '/start') {
        return bot.sendMessage(chatId, "Hoş geldin! Lisans vermek istediğin kullanıcının **Device ID**'sini gönder.");
    }

    // Eğer kullanıcı bir ID gönderdiyse (Boşluksuz ve genelde uzun bir metindir)
    if (text.length > 10 && !text.startsWith('/')) {
        userState[chatId] = { target_device: text };
        
        // Süre seçim butonları gönderiliyor
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '⏱ Saatlik', callback_data: 'dur_1h' },
                        { text: '📅 Günlük', callback_data: 'dur_1d' }
                    ],
                    [
                        { text: '📆 Haftalık', callback_data: 'dur_7d' },
                        { text: '🗓 Aylık', callback_data: 'dur_30d' }
                    ],
                    [
                        { text: '♾ Sınırsız (Lifetime)', callback_data: 'dur_lifetime' }
                    ]
                ]
            }
        };
        return bot.sendMessage(chatId, `Cihaz ID alındı: \`${text}\`\nLütfen lisans süresini seçin:`, { parse_mode: 'Markdown', ...opts });
    }
});

// Butona basıldığında süreyi kaydetme
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data; // örn: dur_1d, dur_30d vb.

    if (!userState[chatId] || !userState[chatId].target_device) {
        return bot.answerCallbackQuery(query.id, { text: 'İşlem zaman aşımına uğradı, tekrar ID gönder.' });
    }

    const deviceId = userState[chatId].target_device;
    const durationKey = data.replace('dur_', '');
    const expiryTime = calculateExpiry(durationKey);

    if (!expiryTime) {
        return bot.answerCallbackQuery(query.id, { text: 'Geçersiz süre!' });
    }

    // Veritabanına kaydet
    const db = getDB();
    db[deviceId] = {
        expires_at: expiryTime,
        created_at: new Date().getTime()
    };
    saveDB(db);

    delete userState[chatId];

    bot.answerCallbackQuery(query.id, { text: 'Lisans başarıyla tanımlandı!' });
    bot.editMessageText(`✅ **Başarılı!**\n\nCihaz ID: \`${deviceId}\`\nSüre: **${durationKey.toUpperCase()}** olarak tanımlandı.`, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
    });
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
