const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { makeUsername, makePassword, hashPassword } = require('../utils/credentials');

// Мұғалім — куратор да, координатор да емес: сабақ кестесіндегі адам.
// Кестенің өзі фронттағы статикалық scheduleData.js-те тұрғандықтан,
// аккаунттың кестемен байланысы full_name арқылы жүреді — сол себепті
// full_name кестедегі жазылуымен ДӘЛ сәйкес келуі керек.

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Тек admin рұқсаты бар' });
  next();
};

// 1. Мұғалім аккаунттарының тізімі — фронтта "аккаунты бар/жоқ" деп
// белгілеу үшін координаторға да ашық.
router.get('/', auth, async (req, res) => {
  if (!['admin', 'coordinator'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Рұқсат жоқ' });
  }
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, subject, last_login FROM users
       WHERE role = 'teacher' ORDER BY full_name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Базадан оқу қатесі: ' + err.message });
  }
});

// 2. Жаңа мұғалім аккаунты — логин/пароль дереу жасалады
router.post('/', auth, requireAdmin, async (req, res) => {
  const { fullName, subject } = req.body;
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'Аты-жөні міндетті' });
  }
  const name = fullName.trim();
  try {
    const dup = await pool.query(
      `SELECT id FROM users WHERE role = 'teacher' AND full_name = $1`, [name]
    );
    if (dup.rows.length) {
      return res.status(409).json({ error: 'Бұл мұғалімнің аккаунты бұрыннан бар' });
    }

    const username = await makeUsername(name, pool);
    const password = makePassword();
    const hash = await hashPassword(password);
    const userRes = await pool.query(
      `INSERT INTO users (username, password, full_name, role, subject)
       VALUES ($1, $2, $3, 'teacher', $4)
       RETURNING id, username, full_name, subject`,
      [username, hash, name, subject || null]
    );
    res.json({ ...userRes.rows[0], password });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Өшіру
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1 AND role = 'teacher'`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
