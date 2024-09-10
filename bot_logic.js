import mysql from 'mysql2';
import cron from 'node-cron';
import axios from 'axios';

// Create a connection to the database (this can also be passed in from index.js)
const connection = mysql.createConnection({
    host: 'MySQL-8.2',
    user: 'root',
    password: '',
    database: 'check_list_questions'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database.');
});

// Telegram Bot Token (this should be securely stored, not hardcoded)
const telegramToken = '6706478331:AAHCSmPd3__PtJ7OrwhqJ1BqgzaGbSiOiXA';

// Function to send a message via Telegram
function sendTelegramMessage(chatId, message) {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    return axios.post(url, {
        chat_id: chatId,
        text: message
    });
}

// Function to get the next question for a restaurant
function getNextQuestion(restaurant, callback) {
    // Fetch the current last_question_id for this restaurant
    connection.query(
        `SELECT last_question_id FROM question_queue WHERE restaurant = ?`,
        [restaurant],
        (err, results) => {
            if (err) {
                console.error('Error fetching last_question_id:', err);
                return callback(err);
            }

            const lastQuestionId = results[0]?.last_question_id || 0;

            // Find the next question in the photo_questions table
            connection.query(
                `SELECT id, question FROM photo_questions WHERE restaurant = ? AND id > ? ORDER BY id ASC LIMIT 1`,
                [restaurant, lastQuestionId],
                (err, results) => {
                    if (err) {
                        console.error('Error fetching next question:', err);
                        return callback(err);
                    }

                    // If no more questions, loop back to the first question
                    if (results.length === 0) {
                        connection.query(
                            `SELECT id, question FROM photo_questions WHERE restaurant = ? ORDER BY id ASC LIMIT 1`,
                            [restaurant],
                            (err, results) => {
                                if (err) {
                                    console.error('Error fetching first question:', err);
                                    return callback(err);
                                }
                                callback(null, results[0]);
                            }
                        );
                    } else {
                        callback(null, results[0]);
                    }
                }
            );
        }
    );
}

// Function to update the queue after sending a question
function updateQueue(restaurant, questionId, callback) {
    connection.query(
        `UPDATE question_queue SET last_question_id = ? WHERE restaurant = ?`,
        [questionId, restaurant],
        (err, results) => {
            if (err) {
                console.error('Error updating question queue:', err);
                return callback(err);
            }
            callback(null, results);
        }
    );
}

// Function to get the chat ID for each restaurant
function getChatIdForRestaurant(restaurant) {
    const chatIds = {
        'Каста': '-4510016774', //4195045177
        'Тоскана': '-4510016774', //4093088535
        'Наполи':'-4510016774', //4179560968
        'Мафия':'-4510016774', //4165668191
        'Джорджия':'-4510016774' //4167894184
    };
    return chatIds[restaurant];
}

// Function to send daily questions to each restaurant
function sendDailyQuestions() {
    const restaurants = ['Каста', 'Тоскана', 'Наполи', 'Мафия', 'Джорджия'];

    restaurants.forEach(restaurant => {
        getNextQuestion(restaurant, (err, question) => {
            if (err || !question) {
                console.error(`No questions found for ${restaurant}`);
                return;
            }

            const chatId = getChatIdForRestaurant(restaurant);
            const message = `${question.question}`;

            sendTelegramMessage(chatId, message)
                .then(() => {
                    console.log(`Question sent to ${restaurant}: ${question.question}`);
                    updateQueue(restaurant, question.id, (err) => {
                        if (err) {
                            console.error('Error updating queue:', err);
                        }
                    });
                })
                .catch(error => {
                    console.error(`Error sending question to ${restaurant}:`, error);
                });
        });
    });
}

// Schedule the daily question sending at the specified time
function scheduleDailyQuestionCron() {
    cron.schedule('37 14 * * *', sendDailyQuestions); // Adjust to your desired time
}

export { sendDailyQuestions, scheduleDailyQuestionCron };