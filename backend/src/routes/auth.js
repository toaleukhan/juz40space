const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

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
