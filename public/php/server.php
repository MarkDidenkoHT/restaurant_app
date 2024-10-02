<?php
$host = 'MySQL-8.2';
$user = 'root';
$password = '';
$database = 'check_list_questions';

// Create MySQL connection
$connection = new mysqli($host, $user, $password, $database);

// Check the connection
if ($connection->connect_error) {
    die('Connection failed: ' . $connection->connect_error);
}

// Helper function to get POST data
function getPostData() {
    return json_decode(file_get_contents('php://input'), true);
}

// API endpoint for login
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['login'])) {
    $data = getPostData();
    $username = $data['username'];
    $password = $data['password'];

    $stmt = $connection->prepare('SELECT restaurant, role FROM managers WHERE login = ? AND password = ?');
    $stmt->bind_param('ss', $username, $password);

    if ($stmt->execute()) {
        $result = $stmt->get_result();
        if ($result->num_rows > 0) {
            $user = $result->fetch_assoc();
            echo json_encode(['restaurant' => $user['restaurant'], 'role' => $user['role']]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid username or password']);
        }
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
    $stmt->close();
}

// API endpoint for fetching new tasks
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['tasks_new'])) {
    $query = 'SELECT id, date, type, question, comment FROM tasks WHERE status = "new"';
    if ($result = $connection->query($query)) {
        echo json_encode($result->fetch_all(MYSQLI_ASSOC));
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error retrieving data from the database']);
    }
}

// API endpoint to mark a task as complete
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['complete_task'])) {
    $taskId = $_GET['id'];
    $stmt = $connection->prepare('UPDATE tasks SET status = ? WHERE id = ?');
    $status = 'completed';
    $stmt->bind_param('si', $status, $taskId);

    if ($stmt->execute()) {
        echo json_encode(['message' => 'Task completed successfully']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to complete the task']);
    }
    $stmt->close();
}

// API endpoint for archived tasks
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['tasks_archive'])) {
    $restaurant = isset($_GET['restaurant']) ? $_GET['restaurant'] : null;
    $query = 'SELECT id, date, type, question, comment, manager_off, manager_on, status FROM tasks';
    if ($restaurant) {
        $query .= ' WHERE restaurant = ? ORDER BY date DESC';
        $stmt = $connection->prepare($query);
        $stmt->bind_param('s', $restaurant);
        $stmt->execute();
        $result = $stmt->get_result();
        echo json_encode($result->fetch_all(MYSQLI_ASSOC));
        $stmt->close();
    } else {
        $query .= ' ORDER BY date DESC';
        if ($result = $connection->query($query)) {
            echo json_encode($result->fetch_all(MYSQLI_ASSOC));
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Error retrieving tasks from the database']);
        }
    }
}

// API endpoint for fetching unique types for a restaurant
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['types']) && isset($_GET['restaurant'])) {
    $restaurant = $_GET['restaurant'];
    $stmt = $connection->prepare('SELECT DISTINCT type FROM tasks WHERE restaurant = ? ORDER BY type');
    $stmt->bind_param('s', $restaurant);

    if ($stmt->execute()) {
        $result = $stmt->get_result();
        $types = array_column($result->fetch_all(MYSQLI_ASSOC), 'type');
        echo json_encode($types);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error retrieving types from the database']);
    }
    $stmt->close();
}

// API endpoint for questions by type and restaurant
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['questions']) && isset($_GET['restaurant']) && isset($_GET['type'])) {
    $restaurant = $_GET['restaurant'];
    $type = $_GET['type'];
    $stmt = $connection->prepare('SELECT DISTINCT question FROM tasks WHERE restaurant = ? AND type = ? ORDER BY question');
    $stmt->bind_param('ss', $restaurant, $type);

    if ($stmt->execute()) {
        $result = $stmt->get_result();
        $questions = array_column($result->fetch_all(MYSQLI_ASSOC), 'question');
        echo json_encode($questions);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error retrieving questions from the database']);
    }
    $stmt->close();
}

// API endpoint to update a question
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['update_question'])) {
    $data = getPostData();
    $id = $data['id'];
    $type = $data['type'];
    $question = $data['question'];

    $stmt = $connection->prepare('UPDATE questions SET type = ?, question = ? WHERE id = ?');
    $stmt->bind_param('ssi', $type, $question, $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false]);
    }
    $stmt->close();
}

// API endpoint to delete a question
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['delete_question'])) {
    $data = getPostData();
    $id = $data['id'];

    $stmt = $connection->prepare('DELETE FROM questions WHERE id = ?');
    $stmt->bind_param('i', $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false']);
    }
    $stmt->close();
}

// API endpoint to create a new question
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['create_question'])) {
    $data = getPostData();
    $restaurant = $data['restaurant'];
    $type = $data['type'];
    $question = $data['question'];

    $stmt = $connection->prepare('INSERT INTO questions (restaurant, type, question) VALUES (?, ?, ?)');
    $stmt->bind_param('sss', $restaurant, $type, $question);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false']);
    }
    $stmt->close();
}

// API endpoint for CRUD operations on managers (create, update, delete)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['manager_action'])) {
    $data = getPostData();
    if ($_GET['manager_action'] === 'create') {
        $restaurant = $data['restaurant'];
        $manager = $data['manager'];

        $stmt = $connection->prepare('INSERT INTO managers (restaurant, manager) VALUES (?, ?)');
        $stmt->bind_param('ss', $restaurant, $manager);

        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false']);
        }
        $stmt->close();
    } elseif ($_GET['manager_action'] === 'update') {
        $id = $data['id'];
        $manager = $data['manager'];

        $stmt = $connection->prepare('UPDATE managers SET manager = ? WHERE id = ?');
        $stmt->bind_param('si', $manager, $id);

        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false']);
        }
        $stmt->close();
    } elseif ($_GET['manager_action'] === 'delete') {
        $id = $data['id'];

        $stmt = $connection->prepare('DELETE FROM managers WHERE id = ?');
        $stmt->bind_param('i', $id);

        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false']);
        }
        $stmt->close();
    }
}

// API endpoint for CRUD operations on photo questions (create, update, delete)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['photo_action'])) {
    $data = getPostData();
    if ($_GET['photo_action'] === 'create') {
        $restaurant = $data['restaurant'];
        $question = $data['question'];

        $stmt = $connection->prepare('INSERT INTO photo_questions (restaurant, question) VALUES (?, ?)');
        $stmt->bind_param('ss', $restaurant, $question);

        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false']);
        }
        $stmt->close();
    } elseif ($_GET['photo_action'] === 'update') {
        $id = $data['id'];
        $question = $data['question'];

        $stmt = $connection->prepare('UPDATE photo_questions SET question = ? WHERE id = ?');
        $stmt->bind_param('si', $question, $id);

        if ($stmt->execute()) {
            echo json_encode(['success' => true']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false']);
        }
        $stmt->close();
    } elseif ($_GET['photo_action'] === 'delete') {
        $id = $data['id'];

        $stmt = $connection->prepare('DELETE FROM photo_questions WHERE id = ?');
        $stmt->bind_param('i', $id);

        if ($stmt->execute()) {
            echo json_encode(['success' => true']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false']);
        }
        $stmt->close();
    }
}

// Fetch photo questions for a restaurant
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['photo_questions']) && isset($_GET['restaurant'])) {
    $restaurant = $_GET['restaurant'];
    $stmt = $connection->prepare('SELECT id, question FROM photo_questions WHERE restaurant = ?');
    $stmt->bind_param('s', $restaurant);

    if ($stmt->execute()) {
        $result = $stmt->get_result();
        echo json_encode($result->fetch_all(MYSQLI_ASSOC));
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error retrieving photo questions from the database']);
    }
    $stmt->close();
}

// Close the connection
$connection->close();
?>