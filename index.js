const express = require('express');  // Import the Express module
const mysql = require('mysql2');  // Import the MySQL module

const app = express();  // Create an instance of an Express application
const port = 3000;  // Define the port number for your server

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Create a connection to the MySQL database
const connection = mysql.createConnection({
  host: 'MySQL-8.2',  // MySQL host (keep it as 'MySQL-8.2' since you mentioned it's working)
  user: 'root',  // MySQL username (root in your case)
  password: '',  // MySQL password (empty string in your case)
  database: 'check_list_questions'  // The name of the database you're connecting to
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database with ID:', connection.threadId);
});

// Define an API endpoint that responds with questions for a given restaurant
app.get('/api/questions/:restaurant', (req, res) => {
  const restaurant = req.params.restaurant;  // Get the restaurant name from the request parameters
  const query = 'SELECT * FROM questions WHERE restaurant = ?';  // SQL query to get the questions for the selected restaurant

  connection.query(query, [restaurant], (err, results) => {
    if (err) {
      console.error('Error executing query:', err.stack);
      res.status(500).send('Error retrieving data from the database.');  // Send a 500 error if something goes wrong
      return;
    }
    res.json(results);  // Send the query results back as a JSON response
  });
});

// Start the Express server and listen on the specified port
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);  // Log a message when the server is up and running
});
