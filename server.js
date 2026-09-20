const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// Render port ayarı (10000 zorunludur)
const PORT = process.env.PORT || 10000;
const app = express();

// Telegram Bot Token'ını buraya ekle veya Render Environment Variables kısmına TOKEN olarak tanımla
const token = process.env.TOKEN || 'SENIN_TELEGRAM_BOT_TOKEN_BURAYA';
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());

// Sağlık kontrolü için web endpoint
app.get('/', (req, res) => {
    res.send('STARBABA KEY BOT is active and running!');
});

// Telegram Buton ve Komut Yönetimi
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '/start') {
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🕒 Saatlik Key', callback_data: 'saatlik' }, { text: '📅 Günlük Key', callback_data: 'gunluk' }],
                    [{ text: '📆 Haftalık Key', callback_data: 'haftalik' }, { text: '🗓 Aylık Key', callback_data: 'aylik' }],
                    [{ text: '♾️ Sınırsız Key', callback_data: 'sinirsiz' }],
                    [{ text: '🎁 Free 1000 Cihaz Key', callback_data: 'free_1000' }]
                ]
            }
        };
        bot.sendMessage(chatId, 'Starbaba Key Paneline Hoş Geldiniz\n\nİstediğiniz key türünü seçin:', keyboard);
    }
});

// Butonlara tıklandığında çalışacak kısım (Callback Query)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    let generatedKey = '';

    // Seçilen kategoriye göre key üretme simülasyonu veya veritabanı bağlantısı
    switch (data) {
        voter = data;
        case 'saatlik':
            generatedKey = 'STARBABA-SAAT-XXXX-YYYY';
            break;
        case 'gunluk':
            generatedKey = 'STARBABA-GUN-XXXX-YYYY';
            break;
        case 'haftalik':
            generatedKey = 'STARBABA-HAFTA-XXXX-YYYY';
            break;
        case 'aylik':
            generatedKey = 'STARBABA-AY-XXXX-YYYY';
            break;
        case 'sinirsiz':
            generatedKey = 'STARBABA-VIP-SINIRSIZ';
            break;
        case 'free_1000':
            generatedKey = 'STARBABA-1000-CIHAZ-FREE';
            break;
        default:
            generatedKey = 'Bilinmeyen işlem!';
    }

    bot.sendMessage(chatId, `Seçtiğiniz Key:\n` + `<code>${generatedKey}</code>`, { parse_mode: 'HTML' });
    bot.answerCallbackQuery(query.id);
});

// Sunucuyu başlatma
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
