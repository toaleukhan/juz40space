const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');

// 1. Барлық кураторларды алу
router.get('/', auth, async (req, res) => {
  const { subject, streamId } = req.query;
  try {
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
    res.status(500).json({ error: err.message });
  }
});

// 2. Жаңа куратор қосу
router.post('/', auth, async (req, res) => {
  const { fullName, subject, streamId, status } = req.body;
  if (!fullName || !subject) {
    return res.status(400).json({ error: 'Куратор аты мен пәні міндетті' });
  }
  try {
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

// 3. БҰРЫНҒЫ 22 КУРАТОРДЫ АВТОМАТТЫ ТАУЫП ҚОСУ (SYNC)
router.post('/sync-old', auth, async (req, res) => {
  try {
    const oldCurators = await pool.query(`SELECT DISTINCT curator_name, subject FROM st_recordings WHERE curator_name IS NOT NULL`);
    let addedCount = 0;

    for (const cur of oldCurators.rows) {
      // Бұл куратор базада бар ма тексеру
      const exists = await pool.query(`SELECT id FROM curators WHERE full_name = $1 AND subject = $2`, [cur.curator_name, cur.subject]);
      
      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO curators (full_name, subject, stream_id, status) VALUES ($1, $2, '01', 'active')`,
          [cur.curator_name, cur.subject]
        );
        addedCount++;
      }
    }
    res.json({ success: true, addedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Куратор статусын, ағымын немесе пәнін өзгерту
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