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
  const userRes = await pool.query(
    `INSERT INTO users (username, password, full_name, role, subject, stream_id)
     VALUES ($1, $2, $3, 'curator', $4, $5) RETURNING id`,
    [username, hash, fullName, subject, strId]
  );
  await pool.query(`UPDATE curators SET user_id = $1 WHERE id = $2`, [userRes.rows[0].id, curator.id]);

  return { ...curator, username, password };
}

// 1. Орталық базадағы кураторларды алу — логин мен соңғы кіру уақытымен қоса.
// user_id FK арқылы нақты байланыстырылады (аты-жөннің емле нұсқалары —
// "Куандык"/"Қуандық" — енді дубль-жол тудырмайды, себебі сәйкестендіру
// енді жол-салыстыру емес, тұрақты id бойынша).
router.get('/', auth, requireAdmin, async (req, res) => {
  const { subject, streamId } = req.query;
  try {
    let query = `
      SELECT c.*, u.username AS username, u.last_login AS last_login
      FROM curators c
      LEFT JOIN users u ON u.id = c.user_id
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

// 1b. Бұрыннан роступа қосылған, бірақ логині жоқ куратор үшін логин жасау
router.post('/:id/generate-login', auth, requireAdmin, async (req, res) => {
  try {
    const curRes = await pool.query('SELECT * FROM curators WHERE id = $1', [req.params.id]);
    if (curRes.rows.length === 0) return res.status(404).json({ error: 'Куратор табылмады' });
    const cur = curRes.rows[0];

    if (cur.user_id) {
      return res.status(400).json({ error: 'Бұл куратордың логині бұрыннан бар' });
    }

    const username = await makeUsername(cur.full_name, pool);
    const password = makePassword();
    const hash = await hashPassword(password);
    const userRes = await pool.query(
      `INSERT INTO users (username, password, full_name, role, subject, stream_id)
       VALUES ($1, $2, $3, 'curator', $4, $5) RETURNING id`,
      [username, hash, cur.full_name, cur.subject, cur.stream_id]
    );
    await pool.query(`UPDATE curators SET user_id = $1 WHERE id = $2`, [userRes.rows[0].id, cur.id]);

    res.json({ ...cur, username, password });
  } catch (err) {
    res.status(500).json({ error: 'Логин жасау қатесі: ' + err.message });
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
    const curator = result.rows[0];

    // Аты-жөні st_recordings.curator_name мен users.full_name-де де
    // көшірме түрінде сақталған — солай болмаса ескі СТ жолдары мен
    // куратордың өз кабинеті ескі атпен қалып қояды.
    if (fullName && curator) {
      await pool.query(`UPDATE st_recordings SET curator_name = $1 WHERE curator_id = $2`, [fullName, curator.id]);
      if (curator.user_id) {
        await pool.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [fullName, curator.user_id]);
      }
    }

    res.json(curator);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Өшіру
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    // curator_id денормалды сілтеме болғандықтан, куратор өшкенде байланысты
    // СТ жолдары иесіз болып тізімде қалып қоймас үшін бірге өшіреміз.
    await pool.query('DELETE FROM st_recordings WHERE curator_id = $1', [req.params.id]);
    await pool.query('DELETE FROM curators WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;