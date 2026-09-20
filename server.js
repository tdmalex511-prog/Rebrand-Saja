const http = require('http');
const https = require('https');
const fs = require('fs');

const TOKEN = '8963816483:AAHHgIrOstR6eT3N5WUhgVQPAHxjM7jLjTg';
const PORT = process.env.PORT || 3000;
const DB_FILE = 'keys.json';

function getKeys() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify({}));
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveKeys(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function callTelegram(method, data) {
    const body = JSON.stringify(data);
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${TOKEN}/${method}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    };
    const req = https.request(options, (res) => {});
    req.on('error', (e) => {});
    req.write(body);
    req.end();
}

const server = http.createServer((req, res) => {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    
    // 1. LUA SCRIPT API KONTROLÜ (?key=xxxx)
    if (urlParams.searchParams.has('key')) {
        const userKey = urlParams.searchParams.get('key').trim();
        const keys = getKeys();
        
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        if (keys[userKey]) {
            res.end(keys[userKey].status === 'active' ? 'success' : 'banned');
        } else {
            res.end('invalid');
        }
        return;
    }

    // 2. TELEGRAM WEBHOOK İSTEKLERI
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const update = JSON.parse(body);

                // /start Komutu
                if (update.message && update.message.text === '/start') {
                    const chatId = update.message.chat.id;
                    const keyboard = {
                        inline_keyboard: [
                            [{ text: '⏰ Saatlik Key', callback_data: 'saatlik' }, { text: '📅 Günlük Key', callback_data: 'gunluk' }],
                            [{ text: '📆 Haftalık Key', callback_data: 'haftalik' }, { text: '🗓️ Aylık Key', callback_data: 'aylik' }],
                            [{ text: '♾️ Sınırsız Key', callback_data: 'sinirsiz' }],
                            [{ text: '🎁 Free 1000 Cihaz Key', callback_data: 'free1000' }]
                        ]
                    };
                    callTelegram('sendMessage', {
                        chat_id: chatId,
                        text: 'Starbaba Key Paneline Hoş Geldiniz\n\nİstediğiniz key türünü seçin:',
                        reply_markup: keyboard
                    });
                }

                // Buton Tıklamaları (Callback Query)
                if (update.callback_query) {
                    const cb = update.callback_query;
                    const chatId = cb.message.chat.id;
                    const data = cb.data;

                    callTelegram('answerCallbackQuery', {
                        callback_query_id: cb.id,
                        text: 'Key oluşturuluyor...'
                    });

                    // Saatlik key için 'SAT' öneki eklendi
                    const types = { 
                        'saatlik': 'SAT', 
                        'gunluk': 'GUN', 
                        'haftalik': 'HAF', 
                        'aylik': 'AYL', 
                        'sinirsiz': 'SNI', 
                        'free1000': 'FRE' 
                    };
                    
                    if (types[data]) {
                        const key = `STARBABA-${types[data]}-${Math.random().toString(16).substr(2, 8).toUpperCase()}`;
                        const keys = getKeys();
                        keys[key] = { type: data, status: 'active', created_at: new Date().toISOString() };
                        saveKeys(keys);

                        callTelegram('sendMessage', {
                            chat_id: chatId,
                            text: `Yeni Key Üretildi:\n\n\`${key}\``,
                            parse_mode: 'Markdown'
                        });
                    }
                }
            } catch (e) {}
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
        });
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('STARBABA Node.js Panel Aktif ve Çalışıyor!');
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
