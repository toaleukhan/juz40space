const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { requireQuality } = auth;
const { logAction } = require('../utils/audit');

// Ағымдағы кезеңдегі барлық куратор + олардың трекер жазбасы (болса)
router.get('/', auth, requireQuality, async (req, res) => {
  const { period } = req.query;
  if (!period) return res.status(400).json({ error: 'period параметрі міндетті' });
  try {
    const curators = await pool.query(
      `SELECT id, name, phone FROM curators WHERE role = 'curator' ORDER BY name`
    );
    const entries = await pool.query(
      `SELECT * FROM curator_tracker WHERE period = $1`,
      [period]
    );
    const byCurator = {};
    entries.rows.forEach(e => { byCurator[e.curator_id] = e; });
    res.json(curators.rows.map(c => ({ curator: c, entry: byCurator[c.id] || null })));
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Бір куратор бойынша осы кезеңдегі жазбаны сақтау/жаңарту
router.put('/:curatorId', auth, requireQuality, async (req, res) => {
  const { period, status, score, notes, sheetLink } = req.body;
  if (!period) return res.status(400).json({ error: 'period міндетті' });
  try {
    const result = await pool.query(
      `INSERT INTO curator_tracker (curator_id, reviewer_id, period, status, score, notes, sheet_link, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (curator_id, period) DO UPDATE SET
         reviewer_id = $2, status = $4, score = $5, notes = $6, sheet_link = $7, updated_at = NOW()
       RETURNING *`,
      [req.params.curatorId, req.curatorId, period, status || 'done', score || null, notes || null, sheetLink || null]
    );
    await logAction(req.curatorId, 'tracker_update', 'curator_tracker', {
      curatorId: Number(req.params.curatorId), period, status,
    });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

module.exports = router;
