// backend/routes/auth.js
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// -------- helpers ----------
const ensureAuth = (req, res, next) => {
  if (req.session?.user) return next();
  return res.status(401).json({ ok:false, msg:'No autenticado' });
};
const ensureAdmin = (req, res, next) => {
  if (req.session?.user?.role === 'admin') return next();
  return res.status(403).json({ ok:false, msg:'Solo admin' });
};

// -------- LOGIN ----------
router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok:false, msg:'Email y contraseña requeridos' });

    const [rows] = await db.query(
      'SELECT id,email,password_hash,full_name,role,is_active FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = rows && rows[0];
    if (!user || !user.is_active) return res.status(401).json({ ok:false, msg:'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ ok:false, msg:'Credenciales inválidas' });

    req.session.user = { id:user.id, email:user.email, full_name:user.full_name, role:user.role };
    res.json({ ok:true, user:req.session.user, is_admin:user.role === 'admin' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, msg:'Error de servidor' });
  }
});


router.get('/api/me', (req, res) => {
  res.json({ ok: !!req.session?.user, user: req.session?.user || null });
});

// -------- LOGOUT ----------
router.post('/api/logout', (req, res) => {
  req.session?.destroy(() => res.json({ ok:true }));
});

// -------- ADMIN: CRUD de usuarios ----------
router.get('/api/users', ensureAuth, ensureAdmin, async (_req, res) => {
  const [rows] = await db.query(
    'SELECT id,email,full_name,role,is_active,created_at FROM users ORDER BY id ASC'
  );
  res.json({ ok:true, users: rows });
});

router.post('/api/users', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const { email, full_name, role = 'operator', password = 'Cambio123!', is_active = 1 } = req.body || {};
    if (!email || !full_name) return res.status(400).json({ ok:false, msg:'Falta email o nombre' });
    if (!['admin','operator'].includes(role)) return res.status(400).json({ ok:false, msg:'Rol inválido' });

    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'INSERT INTO users (email,password_hash,full_name,role,is_active) VALUES (?,?,?,?,?)',
      [email, hash, full_name, role, is_active ? 1 : 0]
    );
    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, msg:'No se pudo crear usuario' });
  }
});

router.patch('/api/users/:id', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role, is_active, password } = req.body || {};

    const fields = [];
    const vals = [];
    if (full_name != null) { fields.push('full_name = ?'); vals.push(full_name); }
    if (role != null) {
      if (!['admin','operator'].includes(role)) return res.status(400).json({ ok:false, msg:'Rol inválido' });
      fields.push('role = ?'); vals.push(role);
    }
    if (is_active != null) { fields.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      fields.push('password_hash = ?'); vals.push(hash);
    }
    if (!fields.length) return res.json({ ok:true });

    vals.push(id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, msg:'No se pudo actualizar' });
  }
});

router.delete('/api/users/:id', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.session.user.id === Number(id)) {
      return res.status(400).json({ ok:false, msg:'No puedes eliminar tu propio usuario' });
    }
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, msg:'No se pudo eliminar' });
  }
});

// -------- Página de login ----------
router.get(['/login', '/login.html'], (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'login.html'));
});

module.exports = router;
