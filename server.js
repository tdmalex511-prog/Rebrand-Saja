const http = require('http');
const https = require('https');
const fs = require('fs');

const TOKEN = 'TELEGRAM_BOT_TOKENINIZI_BURAYA_YAZIN'; // Bot tokenini buraya yaz
const PORT = process.env.PORT || 3000;
const DB_FILE = './licenses.json';

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

function getDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) {
        return {};
    }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function calculateExpiry(type) {
    const now = Date.now();
    switch (type) {
        case '1m': return now + (60 * 1000);
        case '1h': return now + (60 * 60 * 1000);
        case '1d': return now + (24 * 60 * 60 * 1000);
        case '7d': return now + (7 * 24 * 60 * 60 * 1000);
        case '30d': return now + (30 * 24 * 60 * 60 * 1000);
        case 'lifetime': return 'lifetime';
        default: return null;
    }
}

const userState = {};

// Telegram'a istek atma fonksiyonu
function telegramApi(method, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${TOKEN}/${method}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => resolve(JSON.parse(resData)));
        });
        req.on('error', err => reject(err));
        req.write(body);
        req.end();
    });
}

// Web Server ve API / Telegram Webhook Dinleyicisi
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Lua Scripti İçin Lisans Kontrol API'si
    if (url.pathname === '/api/check') {
        const deviceId = url.searchParams.get('device');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (!deviceId) {
            return res.end(JSON.stringify({ status: 'error', message: 'Device ID gereklidir.' }));
        }

        const db = getDB();
        const license = db[deviceId];

        if (!license) {
            return res.end(JSON.stringify({ status: 'unauthorized', message: 'Key bulunamadı!' }));
        }

        if (license.expires_at === 'lifetime' || Date.now() < license.expires_at) {
            return res.end(JSON.stringify({ status: 'active' }));
        } else {
            return res.end(JSON.stringify({ status: 'expired' }));
        }
    }

    // Telegram Bot Gelen Mesajlar (Webhook)
    if (req.method === 'POST' && url.pathname === '/webhook') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const update = JSON.parse(body);
                
                if (update.message) {
                    const chatId = update.message.chat.id;
                    const text = update.message.text ? update.message.text.trim() : '';

                    if (text === '/start') {
                        await telegramApi('sendMessage', {
                            chat_id: chatId,
                            text: "⭐ Starbaba Yönetim Paneline Hoş Geldiniz.\n\nAşağıdan key üretebilir veya yönetebilirsiniz:",
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
                        });
                    } else if (text.length > 10 && !text.startsWith('/')) {
                        if (!userState[chatId] || !userState[chatId].selected_duration) {
                            await telegramApi('sendMessage', { chat_id: chatId, text: "⚠️ Önce menüden hangi süreyle key üretmek istediğini seçmelisin!" });
                        } else {
                            const durationKey = userState[chatId].selected_duration;
                            const expiryTime = calculateExpiry(durationKey);
                            const db = getDB();
                            db[text] = { expires_at: expiryTime, created_at: Date.now() };
                            saveDB(db);
                            delete userState[chatId];
                            await telegramApi('sendMessage', { chat_id: chatId, text: `✅ **Başarılı!**\n\nCihaz ID: \`${text}\`\nSüre: **${durationKey.toUpperCase()}** olarak tanımlandı.`, parse_mode: 'Markdown' });
                        }
                    }
                } else if (update.callback_query) {
                    const q = update.callback_query;
                    const chatId = q.message.chat.id;
                    const data = q.data;

                    if (data === 'list_keys') {
                        const db = getDB();
                        const keys = Object.keys(db);
                        let msgText = keys.length === 0 ? "Hiç aktif key yok." : "📋 **Aktif Cihaz ID'leri:**\n\n" + keys.map((k, i) => `${i + 1}. \`${k}\``).join('\n');
                        await telegramApi('sendMessage', { chat_id: chatId, text: msgText, parse_mode: 'Markdown' });
                    } else if (data.startsWith('dur_')) {
                        const durationKey = data.replace('dur_', '');
                        userState[chatId] = { selected_duration: durationKey };
                        await telegramApi('sendMessage', { chat_id: chatId, text: `📌 **${durationKey.toUpperCase()}** seçildi. Şimdi müşterinin **Device ID**'sini buraya gönder:` });
                    }
                    await telegramApi('answerCallbackQuery', { callback_query_id: q.id });
                }
            } catch (e) {
                console.error(e);
            }
            res.writeHead(200);
            res.end('OK');
        });
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Starbaba Server is Running!');
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
