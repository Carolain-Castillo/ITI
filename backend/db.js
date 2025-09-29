// backend/db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',         
  password: '',         // <-- clave
  database: 'ITI',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
