const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'juz40_secret_key';

// 1. Кіру (Login)
router.post('/login', async (req, res) => {
  // Фронтендтен қандай атаумен келсе де қабылдау (username, phone, login)
  const loginInput = req.body.username || req.body.phone || req.body.login;
  const password = req.body.password;

  if (!loginInput || !password) {
    return res.status(400).json({ error: 'Логин мен парольді толық енгізіңіз' });
  }

  try {
    const cleanLogin = loginInput.toString().toLowerCase().trim();
    const userRes = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = $1',
      [cleanLogin]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'Логин немесе пароль қате' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Логин немесе пароль қате' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role || (user.username === 'admin' ? 'admin' : 'curator'),
        subject: user.subject,
        streamId: user.stream_id,
        fullName: user.full_name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role || (user.username === 'admin' ? 'admin' : 'curator'),
        subject: user.subject,
        streamId: user.stream_id,
        studentsCount: user.students_count || '0',
        avatarUrl: user.avatar_url,
        firstName: user.first_name,
        lastName: user.last_name,
        department: user.department
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Менің профилім ( Get /me )
router.get('/me', auth, async (req, res) => {
  try {
    const userRes = await pool.query(
      'SELECT id, username, full_name, first_name, last_name, department, role, subject, stream_id, students_count, avatar_url FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Пайдаланушы табылмады' });
    res.json(userRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Профильді жаңарту (Фото, пароль, оқушылар саны)
router.put('/profile', auth, async (req, res) => {
  const { studentsCount, avatarUrl, password, firstName, lastName, department } = req.body;
  try {
    let query = `UPDATE users SET students_count = COALESCE($1, students_count), avatar_url = COALESCE($2, avatar_url),
      first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name), department = COALESCE($5, department)`;
    let params = [studentsCount, avatarUrl, firstName, lastName, department];

    const returning = 'RETURNING id, username, full_name, first_name, last_name, department, role, subject, stream_id, students_count, avatar_url';
    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      query += `, password = $6 WHERE id = $7 ${returning}`;
      params.push(hash, req.user.id);
    } else {
      query += ` WHERE id = $6 ${returning}`;
      params.push(req.user.id);
    }

    const updated = await pool.query(query, params);
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;