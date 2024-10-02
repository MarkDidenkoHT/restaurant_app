import mysql from 'mysql2';
import express from 'express';
import {sendDailyQuestions, scheduleDailyQuestionCron} from '../../bot_logic.js';

const app = express();
const port = 3000;

// Middleware to serve static files from 'public' directory
app.use(express.static('public'));

// Middleware to parse incoming JSON requests and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MySQL connection configuration
const connection = mysql.createConnection({
  host: 'MySQL-8.2',
  user: 'root',
  password: '',
  database: 'check_list_questions'
});

// Connect to MySQL database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database with ID:', connection.threadId);
});

// Login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT restaurant, role FROM managers WHERE login = ? AND password = ?';

  connection.query(query, [username, password], (err, results) => {
      if (err) {
          console.error('Error during login:', err);
          return res.status(500).json({ error: 'Server error' });
      }

      if (results.length === 0) {
          return res.status(401).json({ error: 'Invalid username or password' });
      }

      const user = results[0];
      res.json({ restaurant: user.restaurant, role: user.role });
  });
});

// API endpoint for questions
app.get('/api/questions/:restaurant', (req, res) => {
  const restaurant = req.params.restaurant;
  const query = 'SELECT type, question FROM questions WHERE restaurant = ?';

  connection.query(query, [restaurant], (err, results) => {
    if (err) {
      console.error('Error executing query:', err.stack);
      res.status(500).send('Error retrieving data from the database.');
      return;
    }
    res.json(results); // Send the query results back as a JSON response
  });
});

// API endpoint for managers
app.get('/api/managers/:restaurant', (req, res) => {
  const restaurant = req.params.restaurant;
  const query = 'SELECT id,manager FROM managers WHERE restaurant = ?';

  connection.query(query, [restaurant], (err, results) => {
    if (err) {
      console.error('Error executing query:', err.stack);
      res.status(500).send('Error retrieving data from the database.');
      return;
    }
    res.json(results); // Send the query results back as a JSON response
  });
});

// API endpoint for tasks
app.post('/api/tasks', (req, res) => {
  const tasks = req.body; // Expecting an array of tasks

  if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'Invalid tasks data provided.' });
  }

  // Prepare the query and data for bulk insertion
  const query = `
      INSERT INTO tasks 
      (restaurant, type, question, manager_off, manager_on, date, status, comment) 
      VALUES ?
  `;

  const values = tasks.map(task => [
      task.restaurant,
      task.type,
      task.question,
      task.manager_off,
      task.manager_on,
      task.date,
      task.status,
      task.comment || null // Ensure the comment field is either filled or null
  ]);

  connection.query(query, [values], (err, result) => {
      if (err) {
          console.error('Error inserting tasks:', err);
          return res.status(500).json({ error: 'Failed to insert tasks into the database.' });
      }
      res.status(201).json({ message: 'Tasks inserted successfully.', insertedRows: result.affectedRows });
  });
});

// API endpoint for fetching tasks with status 'new'
app.get('/api/tasks/new', (req, res) => {
  const query = 'SELECT id, date, type, question, comment FROM tasks WHERE status = "new"';

  connection.query(query, (err, results) => {
      if (err) {
          console.error('Error executing query:', err.stack);
          res.status(500).send('Error retrieving data from the database.');
          return;
      }
      res.json(results); // Send the query results back as a JSON response
  });
});

// API endpoint to mark a task as complete
app.post('/api/tasks/complete/:id', (req, res) => {
  const taskId = req.params.id;
  const query = 'UPDATE tasks SET status = ? WHERE id = ?';
  
  connection.query(query, ['completed', taskId], (err, result) => {
      if (err) {
          console.error('Error updating task:', err);
          return res.status(500).json({ error: 'Failed to complete the task.' });
      }
      res.json({ message: 'Task completed successfully.' });
  });
});

// API endpoint for archived tasks
app.get('/api/tasks/archive', (req, res) => {
  const { restaurant } = req.query;

  let query = `
      SELECT id, date, type, question, comment, manager_off, manager_on, status
      FROM tasks
  `;

  const queryParams = [];

  if (restaurant) {
      query += ` WHERE restaurant = ?`;
      queryParams.push(restaurant);
  }

  query += ` ORDER BY date DESC`;

  connection.query(query, queryParams, (err, results) => {
      if (err) {
          console.error('Error retrieving archived tasks:', err.stack);
          res.status(500).send('Error retrieving tasks from the database.');
          return;
      }
      res.json(results); // Send the query results back as a JSON response
  });
});

// API endpoint to get unique types for a restaurant
app.get('/api/types/:restaurant', (req, res) => {
  const restaurant = req.params.restaurant;
  const query = 'SELECT DISTINCT type FROM tasks WHERE restaurant = ? ORDER BY type';

  connection.query(query, [restaurant], (err, results) => {
      if (err) {
          console.error('Error retrieving types:', err.stack);
          res.status(500).send('Error retrieving types from the database.');
          return;
      }
      res.json(results.map(row => row.type)); // Send only the type values as an array
  });
});

// API endpoint to get questions for a specific type and restaurant
app.get('/api/questions/:restaurant/:type', (req, res) => {
  const { restaurant, type } = req.params;
  const query = 'SELECT DISTINCT question FROM tasks WHERE restaurant = ? AND type = ? ORDER BY question';

  connection.query(query, [restaurant, type], (err, results) => {
      if (err) {
          console.error('Error retrieving questions:', err.stack);
          res.status(500).send('Error retrieving questions from the database.');
          return;
      }
      res.json(results.map(row => row.question)); // Send only the question values as an array
  });
});

// API endpoint to update a question
app.post('/api/questions/update', (req, res) => {
  const { id, type, question } = req.body;
  const query = 'UPDATE questions SET type = ?, question = ? WHERE id = ?';

  connection.query(query, [type, question, id], (err, result) => {
      if (err) {
          console.error('Error updating question:', err.stack);
          return res.status(500).json({ success: false });
      }
      res.json({ success: true });
  });
});

// API endpoint to delete a question
app.post('/api/questions/delete', (req, res) => {
  const { id } = req.body;
  const query = 'DELETE FROM questions WHERE id = ?';

  connection.query(query, [id], (err, result) => {
      if (err) {
          console.error('Error deleting question:', err.stack);
          return res.status(500).json({ success: false });
      }
      res.json({ success: true });
  });
});

// API endpoint to create a new question
app.post('/api/questions/create', (req, res) => {
  const { restaurant, type, question } = req.body;
  const query = 'INSERT INTO questions (restaurant, type, question) VALUES (?, ?, ?)';

  connection.query(query, [restaurant, type, question], (err, result) => {
      if (err) {
          console.error('Error creating question:', err.stack);
          return res.status(500).json({ success: false });
      }
      res.json({ success: true });
  });
});

// Create a new manager
app.post('/api/managers/create', (req, res) => {
  const { restaurant, manager } = req.body;
  const query = 'INSERT INTO managers (restaurant, manager) VALUES (?, ?)';

  connection.query(query, [restaurant, manager], (err, result) => {
      if (err) {
          console.error('Error creating manager:', err.stack);
          res.status(500).json({ success: false });
          return;
      }
      res.json({ success: true });
  });
});

// Update an existing manager
app.post('/api/managers/update', (req, res) => {
  const { id, manager } = req.body;
  const query = 'UPDATE managers SET manager = ? WHERE id = ?';

  connection.query(query, [manager, id], (err, result) => {
      if (err) {
          console.error('Error updating manager:', err.stack);
          res.status(500).json({ success: false });
          return;
      }
      res.json({ success: true });
  });
});

// Delete a manager
app.post('/api/managers/delete', (req, res) => {
  const { id } = req.body;
  const query = 'DELETE FROM managers WHERE id = ?';

  connection.query(query, [id], (err, result) => {
      if (err) {
          console.error('Error deleting manager:', err.stack);
          res.status(500).json({ success: false });
          return;
      }
      res.json({ success: true });
  });
});

// Fetch photo questions for a specific restaurant
app.get('/api/photo_questions/:restaurant', (req, res) => {
  const restaurant = req.params.restaurant;
  const query = 'SELECT id, question FROM photo_questions WHERE restaurant = ?';

  connection.query(query, [restaurant], (err, results) => {
      if (err) {
          console.error('Error retrieving photo questions:', err.stack);
          res.status(500).send('Error retrieving photo questions from the database.');
          return;
      }
      res.json(results); // Send the query results back as a JSON response
  });
});

// Update a specific photo question
app.post('/api/photo_questions/update', (req, res) => {
  const { id, question } = req.body;
  const query = 'UPDATE photo_questions SET question = ? WHERE id = ?';

  connection.query(query, [question, id], (err, result) => {
      if (err) {
          console.error('Error updating photo question:', err.stack);
          res.status(500).json({ success: false });
          return;
      }
      res.json({ success: true });
  });
});

// Delete a specific photo question
app.post('/api/photo_questions/delete', (req, res) => {
  const { id } = req.body;
  const query = 'DELETE FROM photo_questions WHERE id = ?';

  connection.query(query, [id], (err, result) => {
      if (err) {
          console.error('Error deleting photo question:', err.stack);
          res.status(500).json({ success: false });
          return;
      }
      res.json({ success: true });
  });
});

// Create a new photo question
app.post('/api/photo_questions/create', (req, res) => {
  const { restaurant, question } = req.body;
  const query = 'INSERT INTO photo_questions (restaurant, question) VALUES (?, ?)';

  connection.query(query, [restaurant, question], (err, result) => {
      if (err) {
          console.error('Error creating photo question:', err.stack);
          res.status(500).json({ success: false });
          return;
      }
      res.json({ success: true });
  });
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);

  scheduleDailyQuestionCron();
});