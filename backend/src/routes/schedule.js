const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireAdmin } = auth;
const pool = require('../config/db');
const { logAction } = require('../utils/audit');

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
router.put('/overrides', auth, requireAdmin, async (req, res) => {
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
    await logAction(req.curatorId, 'schedule_override_update', 'schedule_overrides', data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Жарияланған (published=true) кестелерді frontend күтетін пішінде қайтару:
// { smart: {monthId: dayBlocks}, smartAdditional: {monthId: dayBlocks}, junior: {monthId: dayBlocks} }
router.get('/published', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (direction, month_id, kind) direction, month_id, kind, data
       FROM schedules WHERE published = true
       ORDER BY direction, month_id, kind, updated_at DESC`
    );
    const out = { smart: {}, smartAdditional: {}, junior: {} };
    result.rows.forEach(row => {
      if (row.direction === 'JUNIOR') out.junior[row.month_id] = row.data;
      else if (row.kind === 'additional') out.smartAdditional[row.month_id] = row.data;
      else out.smart[row.month_id] = row.data;
    });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Парсингленген кестені жариялау — сол (direction, month_id, kind) бойынша
// бұрынғы жарияланған нұсқаны алмастырады
router.post('/:id/publish', auth, requireAdmin, async (req, res) => {
  try {
    const draft = await pool.query('SELECT * FROM schedules WHERE id = $1', [req.params.id]);
    if (!draft.rows.length) return res.status(404).json({ error: 'Кесте табылмады' });
    const { direction, month_id, kind } = draft.rows[0];

    await pool.query(
      'UPDATE schedules SET published = false WHERE direction = $1 AND month_id = $2 AND kind = $3',
      [direction, month_id, kind]
    );
    await pool.query('UPDATE schedules SET published = true, updated_at = NOW() WHERE id = $1', [req.params.id]);

    await logAction(req.curatorId, 'schedule_publish', 'schedules', { id: Number(req.params.id), direction, month_id, kind });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

module.exports = router;
