const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const C = require('../games/constants');
const { validateQuiz } = require('../games/validate');

// Викторинаны тек иесі (немесе admin) көре және өзгерте алады.
async function loadOwned(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Викторина табылмады' });
  const { rows } = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Викторина табылмады' });
  if (rows[0].owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Бұл викторина сізге тиесілі емес' });
  }
  req.quiz = rows[0];
  next();
}

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
  console.error('Викторина маршруты қатесі:', err.message);
  res.status(500).json({ error: 'Сервер қатесі: ' + err.message });
});

async function fetchQuestions(quizId, db = pool) {
  const { rows } = await db.query(
    `SELECT kind, prompt, options, correct, time_limit, points_mode
     FROM quiz_questions WHERE quiz_id = $1 ORDER BY position ASC`,
    [quizId]
  );
  return rows.map((r) => ({
    kind: r.kind,
    prompt: r.prompt,
    options: r.options,
    correct: r.correct,
    timeLimit: r.time_limit,
    pointsMode: r.points_mode,
  }));
}

async function writeQuestions(client, quizId, questions) {
  if (!questions.length) return;
  const values = [];
  const params = [];
  questions.forEach((q, i) => {
    const b = params.length;
    values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`);
    params.push(quizId, i, q.kind, q.prompt, JSON.stringify(q.options), JSON.stringify(q.correct), q.timeLimit, q.pointsMode);
  });
  await client.query(
    `INSERT INTO quiz_questions (quiz_id, position, kind, prompt, options, correct, time_limit, points_mode)
     VALUES ${values.join(', ')}`,
    params
  );
}

// ── тізім ───────────────────────────────────────────────────────────
router.get('/', auth, asyncRoute(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { rows } = await pool.query(
    `SELECT q.id, q.title, q.description, q.subject, q.updated_at, q.owner_id,
            u.full_name AS owner_name,
            (SELECT COUNT(*)::int FROM quiz_questions x WHERE x.quiz_id = q.id) AS question_count,
            (SELECT COALESCE(SUM(x.time_limit), 0)::int FROM quiz_questions x WHERE x.quiz_id = q.id) AS total_seconds
     FROM quizzes q JOIN users u ON u.id = q.owner_id
     WHERE ($1::boolean OR q.owner_id = $2)
     ORDER BY q.updated_at DESC`,
    [isAdmin, req.user.id]
  );
  res.json(rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    subject: r.subject,
    updatedAt: r.updated_at,
    questionCount: r.question_count,
    totalSeconds: r.total_seconds,
    ownerName: isAdmin ? r.owner_name : undefined,
  })));
}));

// ── бір викторина (сұрақтарымен, дұрыс жауабымен — тек иесіне) ────────
router.get('/:id', auth, loadOwned, asyncRoute(async (req, res) => {
  const q = req.quiz;
  res.json({
    id: q.id,
    title: q.title,
    description: q.description,
    subject: q.subject,
    updatedAt: q.updated_at,
    questions: await fetchQuestions(q.id),
  });
}));

// ── жасау ───────────────────────────────────────────────────────────
router.post('/', auth, asyncRoute(async (req, res) => {
  const { rows: cnt } = await pool.query('SELECT COUNT(*)::int AS n FROM quizzes WHERE owner_id = $1', [req.user.id]);
  if (cnt[0].n >= C.MAX_QUIZZES_PER_USER) {
    return res.status(409).json({ error: `Викторина саны ${C.MAX_QUIZZES_PER_USER}-ден аспауы керек` });
  }

  const v = validateQuiz(req.body);
  if (!v.ok) return res.status(400).json({ error: v.errors[0].message, errors: v.errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO quizzes (owner_id, title, description, subject) VALUES ($1, $2, $3, $4) RETURNING id, updated_at`,
      [req.user.id, v.value.title, v.value.description, v.value.subject]
    );
    await writeQuestions(client, ins.rows[0].id, v.value.questions);
    await client.query('COMMIT');
    res.status(201).json({ id: ins.rows[0].id, updatedAt: ins.rows[0].updated_at });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}));

// ── жаңарту: сұрақтарды толық ауыстырады ────────────────────────────
router.put('/:id', auth, loadOwned, asyncRoute(async (req, res) => {
  const v = validateQuiz(req.body);
  if (!v.ok) return res.status(400).json({ error: v.errors[0].message, errors: v.errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE quizzes SET title = $2, description = $3, subject = $4, updated_at = NOW()
       WHERE id = $1 RETURNING updated_at`,
      [req.quiz.id, v.value.title, v.value.description, v.value.subject]
    );
    await client.query('DELETE FROM quiz_questions WHERE quiz_id = $1', [req.quiz.id]);
    await writeQuestions(client, req.quiz.id, v.value.questions);
    await client.query('COMMIT');
    res.json({ id: req.quiz.id, updatedAt: upd.rows[0].updated_at });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}));

// ── көшірме ─────────────────────────────────────────────────────────
router.post('/:id/duplicate', auth, loadOwned, asyncRoute(async (req, res) => {
  const questions = await fetchQuestions(req.quiz.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const title = `${req.quiz.title} (көшірме)`.slice(0, C.TITLE_MAX);
    const ins = await client.query(
      `INSERT INTO quizzes (owner_id, title, description, subject) VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.user.id, title, req.quiz.description, req.quiz.subject]
    );
    await writeQuestions(client, ins.rows[0].id, questions);
    await client.query('COMMIT');
    res.status(201).json({ id: ins.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}));

// ── өшіру ───────────────────────────────────────────────────────────
// Ойын тарихы сақталады: game_sessions.quiz_id ON DELETE SET NULL, ал
// сұрақтардың көшірмесі ойынның өзінде тұр.
router.delete('/:id', auth, loadOwned, asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM quizzes WHERE id = $1', [req.quiz.id]);
  res.json({ success: true });
}));

module.exports = router;
