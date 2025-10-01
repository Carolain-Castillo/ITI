// backend/app.js
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const session = require('express-session');

const authRoutes = require('./routes/auth');                 // login/logout/me + admin users
const dispositivosRoutes = require('./routes/dispositivos'); // tus rutas existentes

const app = express();

app.use(cors());
app.use(express.json());

// ===== sesión =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-iti',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8h
}));

// ===== rutas públicas de auth y login.html =====
app.use(authRoutes);

// ===== estáticos mínimos para el login (sin pedir sesión) =====
app.use('/css', express.static(path.join(__dirname, '..', 'frontend', 'css')));
app.use('/js',  express.static(path.join(__dirname, '..', 'frontend', 'js')));
app.use('/logo_cyd.png', express.static(path.join(__dirname, '..', 'frontend', 'logo_cyd.png')));

// ===== gatekeeper para páginas HTML (redirige a /login si no hay sesión) =====
const requireAuth = (req, res, next) => {
  if (req.session?.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ ok:false, msg:'No autenticado' });
  return res.redirect('/login');
};

// Permite navegar a login sin sesión; el resto de HTML pide login
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const wantsHTML = req.path === '/' || req.path.endsWith('.html');
  const isLogin   = /\/login(\.html)?$/.test(req.path);
  if (!wantsHTML || isLogin) return next();
  if (req.session?.user) return next();
  return res.redirect('/login');
});

// ===== APIs protegidas =====
app.use('/api', requireAuth, dispositivosRoutes);

// ===== servir el resto del frontend (ya autenticado) =====
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor ITI escuchando en http://localhost:' + PORT));
