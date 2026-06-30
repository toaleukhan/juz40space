const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [students, todaySent, totalSent, groups] = await Promise.all([
      pool.query(
        `SELECT COUNT(s.id) FROM students s
         JOIN groups g ON s.group_id = g.id
         WHERE g.curator_id = $1`,
        [req.curatorId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(total_sent), 0) FROM messages
         WHERE curator_id = $1 AND sent_at::date = CURRENT_DATE`,
        [req.curatorId]
      ),
      pool.query(
        'SELECT COALESCE(SUM(total_sent), 0) FROM messages WHERE curator_id = $1',
        [req.curatorId]
      ),
      pool.query(
        'SELECT COUNT(id) FROM groups WHERE curator_id = $1',
        [req.curatorId]
      )
    ]);

    res.json({
      students: parseInt(students.rows[0].count),
      todaySent: parseInt(todaySent.rows[0].coalesce),
      totalSent: parseInt(totalSent.rows[0].coalesce),
      groups: parseInt(groups.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

module.exports = router;
