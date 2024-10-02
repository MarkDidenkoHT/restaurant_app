<?php
// Database connection
$host = 'MySQL-8.2';
$user = 'root';
$password = '';
$database = 'check_list_questions';

$connection = new mysqli($host, $user, $password, $database);

if ($connection->connect_error) {
    die('Connection failed: ' . $connection->connect_error);
}

// Telegram Bot Token (this should be securely stored, not hardcoded)
$telegramToken = '6706478331:AAHCSmPd3__PtJ7OrwhqJ1BqgzaGbSiOiXA';

// Function to send a message via Telegram using cURL
function sendTelegramMessage($chatId, $message) {
    global $telegramToken;

    $url = "https://api.telegram.org/bot$telegramToken/sendMessage";
    $postData = [
        'chat_id' => $chatId,
        'text' => $message
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded',
    ]);
    $response = curl_exec($ch);

    if ($response === false) {
        echo 'Error sending message: ' . curl_error($ch);
    }

    curl_close($ch);
    return json_decode($response, true);
}

// Function to get the next question for a restaurant
function getNextQuestion($restaurant, $callback) {
    global $connection;

    // Fetch the current last_question_id for this restaurant
    $stmt = $connection->prepare("SELECT last_question_id FROM question_queue WHERE restaurant = ?");
    $stmt->bind_param('s', $restaurant);
    $stmt->execute();
    $result = $stmt->get_result();
    $lastQuestionId = $result->fetch_assoc()['last_question_id'] ?? 0;
    $stmt->close();

    // Find the next question in the photo_questions table
    $stmt = $connection->prepare("SELECT id, question FROM photo_questions WHERE restaurant = ? AND id > ? ORDER BY id ASC LIMIT 1");
    $stmt->bind_param('si', $restaurant, $lastQuestionId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        // No more questions, loop back to the first question
        $stmt->close();
        $stmt = $connection->prepare("SELECT id, question FROM photo_questions WHERE restaurant = ? ORDER BY id ASC LIMIT 1");
        $stmt->bind_param('s', $restaurant);
        $stmt->execute();
        $result = $stmt->get_result();
    }

    $question = $result->fetch_assoc();
    $stmt->close();

    return $callback(null, $question);
}

// Function to update the queue after sending a question
function updateQueue($restaurant, $questionId, $callback) {
    global $connection;

    $stmt = $connection->prepare("UPDATE question_queue SET last_question_id = ? WHERE restaurant = ?");
    $stmt->bind_param('is', $questionId, $restaurant);
    if ($stmt->execute()) {
        $stmt->close();
        return $callback(null, true);
    } else {
        $stmt->close();
        return $callback('Error updating queue');
    }
}

// Function to get the chat ID for each restaurant
function getChatIdForRestaurant($restaurant) {
    $chatIds = [
        'Каста' => '-4510016774',
        'Тоскана' => '-4510016774',
        'Наполи' => '-4510016774',
        'Мафия' => '-4510016774',
        'Джорджия' => '-4510016774'
    ];
    return $chatIds[$restaurant] ?? null;
}

// Function to send daily questions to each restaurant
function sendDailyQuestions() {
    $restaurants = ['Каста', 'Тоскана', 'Наполи', 'Мафия', 'Джорджия'];

    foreach ($restaurants as $restaurant) {
        getNextQuestion($restaurant, function($err, $question) use ($restaurant) {
            if ($err || !$question) {
                echo "No questions found for $restaurant\n";
                return;
            }

            $chatId = getChatIdForRestaurant($restaurant);
            $message = $question['question'];

            sendTelegramMessage($chatId, $message);
            echo "Question sent to $restaurant: " . $question['question'] . "\n";

            updateQueue($restaurant, $question['id'], function($err) {
                if ($err) {
                    echo 'Error updating queue: ' . $err . "\n";
                }
            });
        });
    }
}

// For cron jobs, this should be scheduled using the server's cron job setup
function scheduleDailyQuestionCron() {
    sendDailyQuestions(); // This can be executed based on a server cron job setup
}

// Manually trigger for testing
// scheduleDailyQuestionCron();

// Close the database connection
$connection->close();

?>