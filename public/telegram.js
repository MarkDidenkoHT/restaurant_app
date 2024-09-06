const fetch = require('node-fetch');

const telegramBotToken = '6706478331:AAHCSmPd3__PtJ7OrwhqJ1BqgzaGbSiOiXA';

function sendTelegramNotification(message,telegramChatId) {
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;

    var GeorgiaID ='4167894184';
    var CastaID ='4167894184';
    var ToscanaID ='4093088535';
    var MafiaID ='4165668191';
    var NapoliID ='4179560968';

    const params = {
        chat_id: telegramChatId,
        text: message,
    };

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    })
    .then(response => response.json())
    .then(data => {
        if (data.ok) {
            console.log('Message sent successfully:', data.result.text);
        } else {
            console.error('Error sending message:', data);
        }
    })
    .catch(error => {
        console.error('Error sending Telegram message:', error);
    });
}

module.exports = {
    sendTelegramNotification,
};