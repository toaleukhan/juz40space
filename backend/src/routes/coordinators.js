const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { makeUsername, makePassword, hashPassword } = require('../utils/credentials');

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Тек admin рұқсаты бар' });
  next();
};

// Координатор — куратор ЕМЕС (сабақ бермейді, curators кестесіне жазылмайды),
// тек users-те role='coordinator' жолы: сол ағымдағы барлық куратордың
// СТ-календарын тек оқу үшін қарайды (GET /api/st-recordings-те C1
// өзгерісі арқылы ФИЛЬТРСІЗ, бірақ ӨЗ subject/stream-іне құлыпталған).

// 1. Осы ағымдағы координаторлар тізімі
router.get('/', auth, requireAdmin, async (req, res) => {
  const { subject, streamId } = req.query;
  try {
    let query = `SELECT id, username, full_name, subject, stream_id, last_login FROM users WHERE role = 'coordinator'`;
    let params = [];
    let idx = 1;
    if (subject) { query += ` AND subject = $${idx++}`; params.push(subject); }
    if (streamId) { query += ` AND stream_id = $${idx++}`; params.push(streamId); }
    query += ` ORDER BY id ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Базадан оқу қатесі: ' + err.message });
  }
});

// 2. Жаңа координатор қосу + логин/пароль дереу жасалады
router.post('/', auth, requireAdmin, async (req, res) => {
  const { fullName, subject, streamId } = req.body;
  if (!fullName || !subject) {
    return res.status(400).json({ error: 'Аты-жөні мен пәні міндетті' });
  }
  try {
    const strId = streamId || '01';
    const username = await makeUsername(fullName, pool);
    const password = makePassword();
    const hash = await hashPassword(password);
    const userRes = await pool.query(
      `INSERT INTO users (username, password, full_name, role, subject, stream_id)
       VALUES ($1, $2, $3, 'coordinator', $4, $5) RETURNING id, username, full_name, subject, stream_id`,
      [username, hash, fullName, subject, strId]
    );
    res.json({ ...userRes.rows[0], password });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Өшіру
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1 AND role = 'coordinator'`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
