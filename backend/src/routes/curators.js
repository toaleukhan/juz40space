const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { makeUsername, makePassword, hashPassword } = require('../utils/credentials');

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Тек admin рұқсаты бар' });
  next();
};

// Куратор роступа + сол атпен логин аккаунт (users) бірге жасайды
async function createCuratorWithLogin({ fullName, subject, streamId }) {
  const strId = streamId || '01';
  const curRes = await pool.query(
    `INSERT INTO curators (full_name, subject, stream_id, status) VALUES ($1, $2, $3, 'active') RETURNING *`,
    [fullName, subject, strId]
  );
  const curator = curRes.rows[0];

  const username = await makeUsername(fullName, pool);
  const password = makePassword();
  const hash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users (username, password, full_name, role, subject, stream_id)
     VALUES ($1, $2, $3, 'curator', $4, $5)`,
    [username, hash, fullName, subject, strId]
  );

  return { ...curator, username, password };
}

// 1. Орталық базадағы кураторларды алу — логин мен соңғы кіру уақытымен қоса
// (users кестесімен аты-жөні+пән+ағым бойынша сәйкестендіріледі)
router.get('/', auth, requireAdmin, async (req, res) => {
  const { subject, streamId } = req.query;
  try {
    let query = `
      SELECT c.*, u.username AS username, u.last_login AS last_login
      FROM curators c
      LEFT JOIN users u
        ON u.full_name = c.full_name AND u.subject = c.subject AND u.stream_id = c.stream_id
      WHERE 1=1`;
    let params = [];
    let idx = 1;

    if (subject) {
      query += ` AND c.subject = $${idx++}`;
      params.push(subject);
    }
    if (streamId) {
      query += ` AND c.stream_id = $${idx++}`;
      params.push(streamId);
    }

    query += ` ORDER BY c.id ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Базадан оқу қатесі: ' + err.message });
  }
});

// 2. 🚀 ТІЗІММЕН МАССОВЫЙ ҚОСУ + әр куратор үшін логин/пароль дереу жасалады
router.post('/bulk', auth, requireAdmin, async (req, res) => {
  const { namesText, subject, streamId } = req.body;
  if (!namesText || !subject) {
    return res.status(400).json({ error: 'Мәтін мен пән көрсетілмеген' });
  }

  const names = namesText
    .split('\n')
    .map(n => n.trim())
    .filter(n => n.length > 0);

  const strId = streamId || '01';

  try {
    const added = [];
    const skipped = [];

    for (const name of names) {
      // 💡 Бұл куратор бұрыннан бар ма?
      const check = await pool.query(
        `SELECT id FROM curators WHERE full_name = $1 AND subject = $2 AND stream_id = $3`,
        [name, subject, strId]
      );

      if (check.rows.length === 0) {
        added.push(await createCuratorWithLogin({ fullName: name, subject, streamId: strId }));
      } else {
        skipped.push(name);
      }
    }

    res.json({
      success: true,
      count: added.length,
      skippedCount: skipped.length,
      added,
      skipped
    });
  } catch (err) {
    console.error('Bulk error:', err);
    res.status(500).json({ error: 'Базаға тізіммен сақтау қатесі: ' + err.message });
  }
});

// 3. Жалғыз куратор қосу + логин/пароль дереу жасалады
router.post('/', auth, requireAdmin, async (req, res) => {
  const { fullName, subject, streamId, status } = req.body;
  if (!fullName || !subject) {
    return res.status(400).json({ error: 'Куратор аты мен пәні міндетті' });
  }
  try {
    const strId = streamId || '01';

    const check = await pool.query(
      `SELECT id FROM curators WHERE full_name = $1 AND subject = $2 AND stream_id = $3`,
      [fullName, subject, strId]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Бұл куратор осы ағымда бар!' });
    }

    const result = await createCuratorWithLogin({ fullName, subject, streamId: strId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Статусын жаңарту
router.put('/:id', auth, requireAdmin, async (req, res) => {
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
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM curators WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;