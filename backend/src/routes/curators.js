const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const createTables = require('../config/schema');

// 1. Орталық базадағы кураторларды алу
router.get('/', auth, async (req, res) => {
  const { subject, streamId } = req.query;
  try {
    await createTables();

    let query = `SELECT * FROM curators WHERE 1=1`;
    let params = [];
    let idx = 1;

    if (subject) {
      query += ` AND subject = $${idx++}`;
      params.push(subject);
    }
    if (streamId) {
      query += ` AND stream_id = $${idx++}`;
      params.push(streamId);
    }

    query += ` ORDER BY id ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Базадан оқу қатесі: ' + err.message });
  }
});

// 2. 🚀 ТІЗІММЕН МАССОВЫЙ ҚОСУ
router.post('/bulk', auth, async (req, res) => {
  const { namesText, subject, streamId, monthNum, weekNum } = req.body;
  if (!namesText || !subject) {
    return res.status(400).json({ error: 'Мәтін мен пән көрсетілмеген' });
  }

  const names = namesText
    .split('\n')
    .map(n => n.trim())
    .filter(n => n.length > 0);

  const mNum = parseInt(monthNum) || 1;
  const wNum = parseInt(weekNum) || 1;
  const strId = streamId || '01';

  try {
    await createTables();
    const added = [];

    for (const name of names) {
      // 1. Орталық кураторлар базасына сақтау
      const resIns = await pool.query(
        `INSERT INTO curators (full_name, subject, stream_id, status)
         VALUES ($1, $2, $3, 'active') RETURNING *`,
        [name, subject, strId]
      );
      const cur = resIns.rows[0];
      added.push(cur);

      // 2. СТ есебі кестесіне де қосу
      await pool.query(
        `INSERT INTO st_recordings (curator_id, subject, stream_id, month_num, month_id, week_num, curator_name)
         VALUES ($1, $2, $3, $4, $3, $5, $6)`,
        [cur.id, subject, strId, mNum, wNum, name]
      );
    }

    res.json({ success: true, count: added.length, added });
  } catch (err) {
    console.error('Bulk error:', err);
    res.status(500).json({ error: 'Базаға тізіммен сақтау қатесі: ' + err.message });
  }
});

// 3. Жалғыз куратор қосу
router.post('/', auth, async (req, res) => {
  const { fullName, subject, streamId, status } = req.body;
  if (!fullName || !subject) {
    return res.status(400).json({ error: 'Куратор аты мен пәні міндетті' });
  }
  try {
    await createTables();
    const result = await pool.query(
      `INSERT INTO curators (full_name, subject, stream_id, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [fullName, subject, streamId || '01', status || 'active']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Статусын жаңарту
router.put('/:id', auth, async (req, res) => {
  const { fullName, subject, streamId, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE curators 
       SET full_name = COALESCE($1, full_name),
           subject = COALESCE($2, subject),
           stream_id = COALESCE($3, stream_id),
           status = COALESCE($4, status)
       WHERE id = $5 RETURNING *`,
      [fullName, subject, streamId, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Өшіру
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM curators WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;