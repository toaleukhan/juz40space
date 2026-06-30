const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Тіркелу
router.post('/register', async (req, res) => {
  const { name, phone, password, groupName } = req.body;
  if (!name || !phone || !password || !groupName)
    return res.status(400).json({ error: 'Барлық өрістерді толтырыңыз' });

  try {
    const exists = await pool.query('SELECT id FROM curators WHERE phone = $1', [phone]);
    if (exists.rows.length) return res.status(400).json({ error: 'Бұл нөмір тіркелген' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO curators (name, phone, password_hash) VALUES ($1, $2, $3) RETURNING id, name, phone',
      [name, phone, hash]
    );
    const curator = result.rows[0];

    // Бірінші топты жасау
    await pool.query('INSERT INTO groups (curator_id, name) VALUES ($1, $2)', [curator.id, groupName]);

    const token = jwt.sign({ id: curator.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, curator });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Кіру
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM curators WHERE phone = $1', [phone]);
    if (!result.rows.length) return res.status(400).json({ error: 'Нөмір табылмады' });

    const curator = result.rows[0];
    const valid = await bcrypt.compare(password, curator.password_hash);
    if (!valid) return res.status(400).json({ error: 'Құпия сөз қате' });

    const token = jwt.sign({ id: curator.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, curator: { id: curator.id, name: curator.name, phone: curator.phone } });
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

module.exports = router;
