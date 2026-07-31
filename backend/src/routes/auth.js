const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const JWT_SECRET = require('../config/jwtSecret');
const { verifyInitData } = require('../utils/telegramAuth');

// /login, /telegram, /telegram/link — үшеуі де сонында дәл осы пішінде
// JWT + user объектісін қайтарады, сондықтан ортақ функцияға шығарылды.
function buildAuthResponse(user) {
  const role = user.role || (user.username === 'admin' ? 'admin' : 'curator');
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role,
      subject: user.subject,
      streamId: user.stream_id,
      fullName: user.full_name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role,
      subject: user.subject,
      streamId: user.stream_id,
      studentsCount: user.students_count || '0',
      avatarUrl: user.avatar_url,
      firstName: user.first_name,
      lastName: user.last_name,
      department: user.department
    }
  };
}

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

    res.json(buildAuthResponse(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1b. Telegram Mini App: бұрын байланыстырылған telegram_id арқылы кіру
router.post('/telegram', async (req, res) => {
  try {
    const tgUser = verifyInitData(req.body.initData, process.env.TELEGRAM_BOT_TOKEN);

    const userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [tgUser.id]);
    if (userRes.rows.length === 0) {
      return res.json({ linked: false });
    }

    const user = userRes.rows[0];
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    res.json({ linked: true, ...buildAuthResponse(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 1c. Telegram Mini App: бір реттік привязка — бар логин/парольмен
// расталады да, сол users жолына telegram_id жазылады.
router.post('/telegram/link', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Логин мен парольді толық енгізіңіз' });
  }

  try {
    const tgUser = verifyInitData(req.body.initData, process.env.TELEGRAM_BOT_TOKEN);

    const cleanLogin = username.toString().toLowerCase().trim();
    const userRes = await pool.query('SELECT * FROM users WHERE LOWER(username) = $1', [cleanLogin]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'Логин немесе пароль қате' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Логин немесе пароль қате' });
    }

    const updated = await pool.query(
      'UPDATE users SET telegram_id = $1, last_login = NOW() WHERE id = $2 RETURNING *',
      [tgUser.id, user.id]
    );

    res.json(buildAuthResponse(updated.rows[0]));
  } catch (err) {
    if (err.code === '23505') { // unique_violation — бұл telegram_id басқа аккаунтқа байланысты
      return res.status(400).json({ error: 'Бұл Telegram аккаунты басқа қолданушыға байланыстырылған' });
    }
    res.status(400).json({ error: err.message });
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