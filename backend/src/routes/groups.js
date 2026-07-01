const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, COUNT(s.id) as student_count
       FROM groups g
       LEFT JOIN students s ON s.group_id = g.id
       WHERE g.curator_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [req.curatorId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Сервер қатесі' }); }
});

router.post('/', auth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Топ атауын енгізіңіз' });
  try {
    const result = await pool.query(
      'INSERT INTO groups (curator_id, name) VALUES ($1, $2) RETURNING *',
      [req.curatorId, name]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Сервер қатесі' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM groups WHERE id = $1 AND curator_id = $2', [req.params.id, req.curatorId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Сервер қатесі' }); }
});

router.get('/:id/students', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.* FROM students s
       JOIN groups g ON s.group_id = g.id
       WHERE s.group_id = $1 AND g.curator_id = $2
       ORDER BY s.name`,
      [req.params.id, req.curatorId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Сервер қатесі' }); }
});

router.post('/:id/students', auth, async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Аты мен нөмірді енгізіңіз' });
  try {
    const group = await pool.query('SELECT id FROM groups WHERE id = $1 AND curator_id = $2', [req.params.id, req.curatorId]);
    if (!group.rows.length) return res.status(403).json({ error: 'Рұқсат жоқ' });
    const result = await pool.query(
      'INSERT INTO students (group_id, name, phone) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, name, phone]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Сервер қатесі' }); }
});

router.post('/:id/students/bulk', auth, async (req, res) => {
  const { students } = req.body;
  if (!students?.length) return res.status(400).json({ error: 'Оқушылар тізімі бос' });
  try {
    const group = await pool.query('SELECT id FROM groups WHERE id = $1 AND curator_id = $2', [req.params.id, req.curatorId]);
    if (!group.rows.length) return res.status(403).json({ error: 'Рұқсат жоқ' });

    const values = [];
    const placeholders = students.map((s, i) => {
      const n = i * 3;
      values.push(req.params.id, s.name, s.phone);
      return `($${n+1}, $${n+2}, $${n+3})`;
    }).join(',');
    await pool.query(`INSERT INTO students (group_id, name, phone) VALUES ${placeholders}`, values);

    res.json({ success: true, count: students.length });
  } catch (err) { res.status(500).json({ error: 'Сервер қатесі' }); }
});

router.delete('/:groupId/students/:studentId', auth, async (req, res) => {
  try {
    const group = await pool.query('SELECT id FROM groups WHERE id = $1 AND curator_id = $2', [req.params.groupId, req.curatorId]);
    if (!group.rows.length) return res.status(403).json({ error: 'Рұқсат жоқ' });
    await pool.query('DELETE FROM students WHERE id = $1 AND group_id = $2', [req.params.studentId, req.params.groupId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Сервер қатесі' }); }
});

module.exports = router;
