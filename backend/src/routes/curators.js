const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');

// Бұрынғы стандартты Физика кураторларының тізімі
const DEFAULT_PHYSICS_CURATORS = [
  "Орынбек Меруерт",
  "Жұбатбек Алия",
  "Мұратқызы Сағыныш",
  "Семғалиева Мадина Нұрлыбековна",
  "Темірхан Нұржас Жандосұлы",
  "Мирзабек Аяулым",
  "Ерғали Айкүміс",
  "Серік Дарын",
  "Амит Алтынай",
  "Сарқытбекова Аяжан",
  "Таубай Аяжан",
  "Нұрат Гүлжаз Ғалымқызы",
  "Халидолла Ислам Арманұлы"
];

// Автоматты толтыру функциясы
async function seedDefaultCurators() {
  try {
    const check = await pool.query(`SELECT COUNT(*) FROM curators WHERE subject = 'ФИЗ'`);
    if (parseInt(check.rows[0].count) === 0) {
      for (const name of DEFAULT_PHYSICS_CURATORS) {
        await pool.query(
          `INSERT INTO curators (full_name, subject, stream_id, status) VALUES ($1, 'ФИЗ', '01', 'active')`,
          [name]
        );
      }
      console.log("✅ Физика кураторлары базаға автоматты енгізілді!");
    }
  } catch (e) {
    console.error("Seed error:", e.message);
  }
}

// 1. Орталық базадағы кураторларды алу
router.get('/', auth, async (req, res) => {
  const { subject, streamId } = req.query;
  try {
    await seedDefaultCurators();

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

// 2. Жалғыз куратор қосу
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

// 3. 🚀 ТІЗІММЕН МАССОВЫЙ ҚОСУ (Excel/Word-тан көшіріп қою үшін)
router.post('/bulk', auth, async (req, res) => {
  const { namesText, subject, streamId } = req.body;
  if (!namesText || !subject) {
    return res.status(400).json({ error: 'Мәтін мен пән көрсетілмеген' });
  }

  const names = namesText
    .split('\n')
    .map(n => n.trim())
    .filter(n => n.length > 0);

  try {
    const added = [];
    for (const name of names) {
      const resIns = await pool.query(
        `INSERT INTO curators (full_name, subject, stream_id, status)
         VALUES ($1, $2, $3, 'active') RETURNING *`,
        [name, subject, streamId || '01']
      );
      added.push(resIns.rows[0]);
    }
    res.json({ success: true, count: added.length, added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Қалпына келтіру
router.post('/sync-old', auth, async (req, res) => {
  try {
    await seedDefaultCurators();
    res.json({ success: true, message: 'Автоматты қалпына келтірілді' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Статусын, ағымын, пәнін жаңарту
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

// 6. Өшіру
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM curators WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;