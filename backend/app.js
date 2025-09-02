// backend/app.js
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// servir el frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// rutas API
app.use('/api', require('./routes/dispositivos'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor ITI escuchando en http://localhost:' + PORT));
