const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');

// Барлық кураторларға ортақ, қолмен қосылған сабақтарды алу
router.get('/overrides', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM schedule_overrides WHERE id = 1');
    res.json(result.rows[0]?.data || {});
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Қолмен қосылған сабақтарды сақтау (толық ауыстыру)
router.put('/overrides', auth, async (req, res) => {
  const data = req.body;
  if (typeof data !== 'object' || data === null) {
    return res.status(400).json({ error: 'Деректер форматы қате' });
  }
  try {
    await pool.query(
      `INSERT INTO schedule_overrides (id, data, updated_at) VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(data)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

module.exports = router;
