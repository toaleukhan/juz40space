const crypto = require('crypto');
const pool = require('../config/db');
const C = require('./constants');
const hub = require('./hub');
const views = require('./views');
const { isCorrect, scoreAnswer } = require('./scoring');
const { rankPlayers } = require('./ranking');
const { normalizeNickname, validateChoice } = require('./validate');

// Күй машинасы:
//
//   lobby ──start──► question ──(таймер | бәрі жауап берді | хост)──► reveal
//                        ▲                                              │
//                        │                                            (хост)
//                        │                                              ▼
//                        └────────(хост, келесі сұрақ)──────────── leaderboard
//                                                                       │
//                                                        (хост, соңғы сұрақ)
//                                                                       ▼
//                                                                   finished
//
// Әр өтуде «compare-and-set» қолданылады (UPDATE … WHERE status=… AND
// current_index=…): таймер мен хост бір мезгілде бассақ та, өту бір-ақ
// рет орындалады, ал екіншісі 0 жол өзгертіп, жай өтіп кетеді.

const ms = (d) => (d ? new Date(d).getTime() : 0);
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

class GameError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function normalizeSession(row) {
  return {
    id: row.id,
    quizId: row.quiz_id,
    hostId: row.host_id,
    pin: row.pin,
    title: row.title,
    status: row.status,
    currentIndex: row.current_index,
    startsAtMs: ms(row.question_starts_at),
    endsAtMs: ms(row.question_ends_at),
    locked: row.locked,
    settings: row.settings || {},
    questions: row.questions || [],
    createdAtMs: ms(row.created_at),
    finishedAtMs: ms(row.finished_at),
  };
}

function assertHost(session, user) {
  if (session.hostId !== user.id && user.role !== 'admin') {
    throw new GameError(403, 'Бұл ойын сізге тиесілі емес');
  }
}

// ── оқу ─────────────────────────────────────────────────────────────
async function getSession(sessionId, db = pool) {
  const { rows } = await db.query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
  return rows[0] ? normalizeSession(rows[0]) : null;
}

async function loadModel(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return null;

  const [pRes, aRes] = await Promise.all([
    pool.query(
      'SELECT id, nickname, score, streak, total_ms, kicked, joined_at FROM game_players WHERE session_id = $1',
      [sessionId]
    ),
    session.currentIndex >= 0
      ? pool.query(
        `SELECT player_id, question_index, choice, correct, response_ms, points
         FROM game_answers WHERE session_id = $1 AND question_index = $2`,
        [sessionId, session.currentIndex]
      )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    session,
    players: pRes.rows.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      streak: p.streak,
      totalMs: p.total_ms,
      kicked: p.kicked,
      joinedAtMs: ms(p.joined_at),
    })),
    answers: aRes.rows.map((a) => ({
      playerId: a.player_id,
      questionIndex: a.question_index,
      choice: a.choice,
      correct: a.correct,
      responseMs: a.response_ms,
      points: a.points,
    })),
  };
}

// Сессияны оқиды; таймері өтіп кеткен, бірақ сервер қайта іске қосылғандықтан
// жабылмай қалған сұрақ болса, соны жабады. Осы себепті таймер жоғалса да,
// ойын ешқашан «қатып» қалмайды: кез келген оқу күйді өзі түзетеді.
async function ensureFresh(sessionId) {
  let s = await getSession(sessionId);
  if (!s) return null;
  if (s.status === 'question' && Date.now() >= s.endsAtMs + C.GRACE_MS) {
    await closeQuestion(s.id, s.currentIndex);
    s = await getSession(sessionId);
  }
  hub.arm(s);
  return s;
}

async function hostSnapshot(sessionId, user) {
  const s = await ensureFresh(sessionId);
  if (!s) throw new GameError(404, 'Ойын табылмады');
  assertHost(s, user);
  return views.hostView(await loadModel(sessionId), Date.now());
}

// ── ойынды құру ─────────────────────────────────────────────────────
async function createGame({ hostId, quizId, settings }) {
  const { rows: qz } = await pool.query('SELECT id, title, subject FROM quizzes WHERE id = $1', [quizId]);
  if (!qz.length) throw new GameError(404, 'Викторина табылмады');

  const { rows } = await pool.query(
    `SELECT kind, prompt, options, correct, time_limit, points_mode
     FROM quiz_questions WHERE quiz_id = $1 ORDER BY position ASC`,
    [quizId]
  );
  if (!rows.length) throw new GameError(400, 'Викторинада сұрақ жоқ');

  // Көшірме: викторинаны кейін өңдеп жатса да, бұл ойын өзгермейді.
  const questions = rows.map((r) => ({
    kind: r.kind,
    prompt: r.prompt,
    options: r.options,
    correct: r.correct,
    timeLimit: r.time_limit,
    pointsMode: r.points_mode,
  }));

  // Пән экранда сол пәннің маскотын көрсету үшін ғана керек (ойын логикасына әсері жоқ).
  const clean = { streakBonus: settings?.streakBonus !== false, subject: qz[0].subject || null };

  for (let attempt = 0; attempt < 25; attempt++) {
    const pin = String(crypto.randomInt(100000, 1000000));
    try {
      const ins = await pool.query(
        `INSERT INTO game_sessions (quiz_id, host_id, pin, title, questions, settings)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, pin`,
        [quizId, hostId, pin, qz[0].title, JSON.stringify(questions), JSON.stringify(clean)]
      );
      return ins.rows[0];
    } catch (err) {
      if (err.code === '23505') continue; // PIN бос емес — басқасын аламыз
      throw err;
    }
  }
  throw new GameError(503, 'PIN табу мүмкін болмады. Қайталап көріңіз.');
}

// ── ойыншы қосылуы ──────────────────────────────────────────────────
async function checkPin(pin) {
  if (!/^\d{6}$/.test(String(pin || ''))) throw new GameError(404, 'Мұндай PIN-мен белсенді ойын жоқ');
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.locked, s.settings->>'subject' AS subject,
            (SELECT COUNT(*)::int FROM game_players p WHERE p.session_id = s.id AND NOT p.kicked) AS players
     FROM game_sessions s WHERE s.pin = $1 AND s.status <> 'finished'`,
    [String(pin)]
  );
  if (!rows.length) throw new GameError(404, 'Мұндай PIN-мен белсенді ойын жоқ');
  if (rows[0].locked) throw new GameError(403, 'Бұл ойынға кіру жабылған');
  return { title: rows[0].title, players: rows[0].players, subject: rows[0].subject || null };
}

async function joinGame({ pin, nickname }) {
  const nick = normalizeNickname(nickname);
  if (!nick.ok) throw new GameError(400, nick.error);

  if (!/^\d{6}$/.test(String(pin || ''))) throw new GameError(404, 'Мұндай PIN-мен белсенді ойын жоқ');
  const { rows } = await pool.query(
    `SELECT * FROM game_sessions WHERE pin = $1 AND status <> 'finished'`,
    [String(pin)]
  );
  if (!rows.length) throw new GameError(404, 'Мұндай PIN-мен белсенді ойын жоқ');
  const session = normalizeSession(rows[0]);
  if (session.locked) throw new GameError(403, 'Бұл ойынға кіру жабылған');

  const { rows: cnt } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM game_players WHERE session_id = $1 AND NOT kicked',
    [session.id]
  );
  if (cnt[0].n >= C.MAX_PLAYERS) throw new GameError(409, 'Ойын толы');

  const token = crypto.randomBytes(24).toString('hex');
  try {
    const ins = await pool.query(
      `INSERT INTO game_players (session_id, nickname, token_hash)
       VALUES ($1, $2, $3) RETURNING id, nickname`,
      [session.id, nick.value, hashToken(token)]
    );
    // Күту залында ойыншылар қосылып жатса, ойын «тастап кеткен» болып
    // есептелмеуі үшін белсенділікті жаңартамыз.
    pool.query('UPDATE game_sessions SET updated_at = NOW() WHERE id = $1', [session.id]).catch(() => {});
    hub.pokeHost(session.id);
    return { token, player: ins.rows[0], game: { id: session.id, title: session.title } };
  } catch (err) {
    if (err.code === '23505') throw new GameError(409, 'Бұл лақап ат бос емес. Басқасын таңдаңыз.', { code: 'nick_taken' });
    throw err;
  }
}

async function playerByToken(token) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 128) return null;
  const { rows } = await pool.query(
    'SELECT id, session_id, nickname, kicked FROM game_players WHERE token_hash = $1',
    [hashToken(token)]
  );
  return rows[0] || null;
}

async function playerSnapshot(token) {
  const player = await playerByToken(token);
  if (!player) throw new GameError(404, 'Ойыншы табылмады', { code: 'unknown_player' });
  const s = await ensureFresh(player.session_id);
  if (!s) throw new GameError(404, 'Ойын табылмады', { code: 'unknown_player' });
  const model = await loadModel(player.session_id);
  return { player, view: views.playerView(model, player.id, Date.now()) };
}

// ── жауап беру ──────────────────────────────────────────────────────
async function submitAnswer({ token, questionIndex, choice }) {
  const player = await playerByToken(token);
  if (!player) throw new GameError(404, 'Ойыншы табылмады', { code: 'unknown_player' });
  if (player.kicked) throw new GameError(403, 'Сіз ойыннан шығарылдыңыз', { code: 'kicked' });

  const client = await pool.connect();
  let sessionId = player.session_id;
  try {
    await client.query('BEGIN');

    // FOR SHARE: сұрақты жабатын UPDATE (closeQuestion) осы транзакция
    // біткенше күтеді. Сондықтан жабылу сәтінде жүріп жатқан жауап немесе
    // толық есептеледі, немесе мүлде қабылданбайды — жартылай күй болмайды.
    const { rows } = await client.query('SELECT * FROM game_sessions WHERE id = $1 FOR SHARE', [sessionId]);
    if (!rows.length) throw new GameError(404, 'Ойын табылмады');
    const s = normalizeSession(rows[0]);
    const now = Date.now();

    if (s.status !== 'question' || s.currentIndex !== questionIndex) {
      throw new GameError(409, 'Бұл сұраққа жауап беру уақыты өтті', { code: 'closed' });
    }
    if (now < s.startsAtMs) throw new GameError(409, 'Сұрақ әлі ашылған жоқ', { code: 'early' });
    if (now > s.endsAtMs + C.GRACE_MS) throw new GameError(409, 'Уақыт бітті', { code: 'late' });

    const q = s.questions[s.currentIndex];
    const v = validateChoice(q, choice);
    if (!v.ok) throw new GameError(400, v.error);

    // Серия ойыншы жолында ТҰРАДЫ, бірақ сұрақ жабылғанша өзгермейді, сондықтан
    // мұнда оқу — осы сұраққа дейінгі серия.
    const { rows: pr } = await client.query('SELECT streak, kicked FROM game_players WHERE id = $1', [player.id]);
    if (!pr.length || pr[0].kicked) throw new GameError(403, 'Сіз ойыннан шығарылдыңыз', { code: 'kicked' });

    const limitMs = q.timeLimit * 1000;
    const responseMs = Math.min(Math.max(now - s.startsAtMs, 0), limitMs);
    const correct = isCorrect(v.value, q.correct);
    const { points } = scoreAnswer({
      correct,
      responseMs,
      timeLimitMs: limitMs,
      pointsMode: q.pointsMode,
      streakBefore: pr[0].streak,
      streakBonusOn: s.settings.streakBonus !== false,
    });

    const ins = await client.query(
      `INSERT INTO game_answers (session_id, player_id, question_index, choice, correct, response_ms, points)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (player_id, question_index) DO NOTHING
       RETURNING id`,
      [sessionId, player.id, s.currentIndex, JSON.stringify(v.value), correct, responseMs, points]
    );
    if (!ins.rows.length) throw new GameError(409, 'Жауабыңыз қабылданып қойған', { code: 'duplicate' });

    await client.query('COMMIT');
    hub.pokeHost(sessionId);
    closeIfEveryoneAnswered(sessionId, s.currentIndex).catch((err) => console.error('Ерте жабу қатесі:', err.message));
    // Дұрыс/қате екенін ЖАУАПТА айтпаймыз — ол тек reveal кезінде білінеді.
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Барлық белсенді ойыншы жауап берсе, таймерді күтпей сұрақты жабамыз.
async function closeIfEveryoneAnswered(sessionId, index) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM game_players WHERE session_id = $1 AND NOT kicked) AS players,
       (SELECT COUNT(*)::int FROM game_answers a JOIN game_players p ON p.id = a.player_id
         WHERE a.session_id = $1 AND a.question_index = $2 AND NOT p.kicked) AS answered`,
    [sessionId, index]
  );
  const { players, answered } = rows[0];
  if (players > 0 && answered >= players) await closeQuestion(sessionId, index);
}

// ── өтулер ──────────────────────────────────────────────────────────
// Ұпай мен серия ТЕК ОСЫ СӘТТЕ, phase өзгерісімен бір транзакцияда
// қосылады. Артықшылығы: сұрақ жүріп жатқанда база ешкімнің ұпайын
// өзгертпейді, сондықтан хостың (Meet-те көрсетілетін) экранына да
// «кім дұрыс жауап берді» білінбейді.
const APPLY_SCORES_SQL = `
  UPDATE game_players p
  SET score    = p.score + COALESCE(a.points, 0),
      total_ms = p.total_ms + COALESCE(a.response_ms, $4::int),
      streak   = CASE
                   WHEN $3::text = 'none' THEN p.streak
                   WHEN a.correct IS TRUE THEN p.streak + 1
                   ELSE 0
                 END
  FROM game_players src
  LEFT JOIN game_answers a
    ON a.player_id = src.id AND a.session_id = $1 AND a.question_index = $2
  WHERE p.id = src.id AND p.session_id = $1 AND p.kicked = false
`;

async function closeQuestion(sessionId, index) {
  const client = await pool.connect();
  let closed = null;
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE game_sessions SET status = 'reveal', updated_at = NOW()
       WHERE id = $1 AND status = 'question' AND current_index = $2
       RETURNING *`,
      [sessionId, index]
    );
    if (!upd.rows.length) { await client.query('ROLLBACK'); return false; } // біреу бұрын жапты

    const s = normalizeSession(upd.rows[0]);
    const q = s.questions[index];
    await client.query(APPLY_SCORES_SQL, [sessionId, index, q.pointsMode, q.timeLimit * 1000]);
    await client.query('COMMIT');
    closed = s;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  hub.arm(closed);
  hub.broadcast(sessionId);
  return true;
}

async function transition(sessionId, from, to, index) {
  const { rows } = await pool.query(
    `UPDATE game_sessions SET status = $3, updated_at = NOW()
     WHERE id = $1 AND status = $2 AND current_index = $4 RETURNING *`,
    [sessionId, from, to, index]
  );
  if (!rows.length) return null;
  const s = normalizeSession(rows[0]);
  hub.arm(s);
  hub.broadcast(sessionId);
  return s;
}

async function openQuestion(session, index, fromStatus, fromIndex) {
  const q = session.questions[index];
  const starts = new Date(Date.now() + C.LEAD_MS);
  const ends = new Date(starts.getTime() + q.timeLimit * 1000);

  const { rows } = await pool.query(
    `UPDATE game_sessions
     SET status = 'question', current_index = $1, question_starts_at = $2, question_ends_at = $3, updated_at = NOW()
     WHERE id = $4 AND status = $5 AND current_index = $6
     RETURNING *`,
    [index, starts, ends, session.id, fromStatus, fromIndex]
  );
  if (!rows.length) return null;
  const s = normalizeSession(rows[0]);
  hub.arm(s);
  hub.broadcast(session.id);
  return s;
}

async function finishGame(sessionId) {
  const { rows } = await pool.query(
    `UPDATE game_sessions SET status = 'finished', finished_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status <> 'finished' RETURNING *`,
    [sessionId]
  );
  if (!rows.length) return null;
  const s = normalizeSession(rows[0]);
  hub.arm(s); // таймерлерді тазалайды
  hub.broadcast(sessionId);
  return s;
}

// ── хост әрекеттері ─────────────────────────────────────────────────
async function startGame(sessionId, user) {
  const s = await ensureFresh(sessionId);
  if (!s) throw new GameError(404, 'Ойын табылмады');
  assertHost(s, user);
  if (s.status !== 'lobby') throw new GameError(409, 'Ойын басталып кеткен');

  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM game_players WHERE session_id = $1 AND NOT kicked',
    [sessionId]
  );
  if (rows[0].n < 1) throw new GameError(409, 'Кемінде бір ойыншы қосылуы керек');

  const opened = await openQuestion(s, 0, 'lobby', -1);
  if (!opened) throw new GameError(409, 'Ойын күйі өзгерген', { code: 'stale' });
}

// «Келесі» батырмасы. expect — хосттың экраны қандай күйде екенін айтады:
// таймер сол сәтте өтіп кетсе, хост бейхабар «Келесі» басып, reveal
// экранын өткізіп жібермеуі үшін күй сәйкес келмесе, 409 қайтарамыз.
async function advance(sessionId, user, expect) {
  const s = await ensureFresh(sessionId);
  if (!s) throw new GameError(404, 'Ойын табылмады');
  assertHost(s, user);

  const group = (st) => (st === 'countdown' ? 'question' : st);
  const current = group(views.derivePhase(s, Date.now()));
  if (expect && (group(expect.status) !== current || expect.index !== s.currentIndex)) {
    throw new GameError(409, 'Ойын күйі өзгерген', { code: 'stale' });
  }

  switch (s.status) {
    case 'lobby':
      throw new GameError(409, 'Алдымен ойынды бастаңыз');
    case 'question':
      await closeQuestion(s.id, s.currentIndex); // ерте аяқтау / өткізіп жіберу
      break;
    case 'reveal':
      await transition(s.id, 'reveal', 'leaderboard', s.currentIndex);
      break;
    case 'leaderboard':
      if (s.currentIndex + 1 < s.questions.length) {
        await openQuestion(s, s.currentIndex + 1, 'leaderboard', s.currentIndex);
      } else {
        await finishGame(s.id);
      }
      break;
    default:
      break;
  }
}

// Ойынды мерзімінен бұрын аяқтау. Сұрақ жүріп жатса, алдымен оны жабамыз —
// сонда сол сұрақтың ұпайы да есепке кіреді.
async function endGame(sessionId, user) {
  const s = await ensureFresh(sessionId);
  if (!s) throw new GameError(404, 'Ойын табылмады');
  assertHost(s, user);
  if (s.status === 'question') await closeQuestion(s.id, s.currentIndex);
  await finishGame(s.id);
}

async function kickPlayer(sessionId, user, playerId) {
  const s = await getSession(sessionId);
  if (!s) throw new GameError(404, 'Ойын табылмады');
  assertHost(s, user);
  const { rowCount } = await pool.query(
    'UPDATE game_players SET kicked = true WHERE id = $1 AND session_id = $2 AND kicked = false',
    [playerId, sessionId]
  );
  if (!rowCount) throw new GameError(404, 'Ойыншы табылмады');
  hub.broadcast(sessionId);
  // Соңғы күтіп тұрған ойыншы шығарылса, сұрақ ерте жабылуы мүмкін.
  if (s.status === 'question') closeIfEveryoneAnswered(sessionId, s.currentIndex).catch(() => {});
}

async function setLocked(sessionId, user, locked) {
  const s = await getSession(sessionId);
  if (!s) throw new GameError(404, 'Ойын табылмады');
  assertHost(s, user);
  await pool.query('UPDATE game_sessions SET locked = $2, updated_at = NOW() WHERE id = $1', [sessionId, !!locked]);
  hub.broadcast(sessionId, { hostOnly: true });
}

// ── тарих пен нәтиже ────────────────────────────────────────────────
async function listGames(user) {
  const isAdmin = user.role === 'admin';
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.status, s.pin, s.created_at, s.finished_at,
            jsonb_array_length(s.questions) AS question_count,
            (SELECT COUNT(*)::int FROM game_players p WHERE p.session_id = s.id AND NOT p.kicked) AS players,
            (SELECT p.nickname FROM game_players p WHERE p.session_id = s.id AND NOT p.kicked
              ORDER BY p.score DESC, p.total_ms ASC, p.joined_at ASC LIMIT 1) AS winner,
            (SELECT p.score FROM game_players p WHERE p.session_id = s.id AND NOT p.kicked
              ORDER BY p.score DESC, p.total_ms ASC, p.joined_at ASC LIMIT 1) AS winner_score
     FROM game_sessions s
     WHERE ($1::boolean OR s.host_id = $2)
     ORDER BY s.created_at DESC
     LIMIT 50`,
    [isAdmin, user.id]
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    pin: r.status === 'finished' ? null : r.pin,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
    questionCount: r.question_count,
    players: r.players,
    winner: r.winner,
    winnerScore: r.winner_score,
  }));
}

async function getResults(sessionId, user) {
  const s = await ensureFresh(sessionId);
  if (!s) throw new GameError(404, 'Ойын табылмады');
  assertHost(s, user);

  const [pRes, aRes] = await Promise.all([
    pool.query(
      `SELECT id, nickname, score, streak, total_ms, joined_at FROM game_players
       WHERE session_id = $1 AND NOT kicked`,
      [sessionId]
    ),
    pool.query(
      `SELECT a.player_id, a.question_index, a.choice, a.correct, a.response_ms, a.points
       FROM game_answers a JOIN game_players p ON p.id = a.player_id
       WHERE a.session_id = $1 AND NOT p.kicked`,
      [sessionId]
    ),
  ]);

  // Тек ойналған сұрақтар: ойын ерте аяқталса, қалғаны статистикаға кірмейді.
  const played = s.status === 'lobby' ? 0 : Math.min(s.currentIndex + 1, s.questions.length);
  const ranked = rankPlayers(pRes.rows.map((p) => ({
    id: p.id, nickname: p.nickname, score: p.score, streak: p.streak, totalMs: p.total_ms, joinedAtMs: ms(p.joined_at),
  })));

  const byPlayer = new Map();
  const byQuestion = Array.from({ length: played }, () => []);
  aRes.rows.forEach((a) => {
    if (a.question_index >= played) return;
    if (!byPlayer.has(a.player_id)) byPlayer.set(a.player_id, new Map());
    byPlayer.get(a.player_id).set(a.question_index, a);
    byQuestion[a.question_index].push(a);
  });

  const avg = (list) => (list.length ? Math.round(list.reduce((sum, x) => sum + x, 0) / list.length) : null);

  const questions = s.questions.slice(0, played).map((q, i) => {
    const list = byQuestion[i];
    const counts = q.options.map(() => 0);
    list.forEach((a) => a.choice.forEach((c) => { if (counts[c] !== undefined) counts[c] += 1; }));
    return {
      index: i,
      prompt: q.prompt,
      options: q.options,
      correct: q.correct,
      timeLimit: q.timeLimit,
      counts,
      answeredCount: list.length,
      correctCount: list.filter((a) => a.correct).length,
      noAnswer: ranked.length - list.length,
      avgMs: avg(list.map((a) => a.response_ms)),
    };
  });

  const players = ranked.map((p) => {
    const mine = byPlayer.get(p.id) || new Map();
    const list = [...mine.values()];
    return {
      id: p.id,
      rank: p.rank,
      nickname: p.nickname,
      score: p.score,
      correctCount: list.filter((a) => a.correct).length,
      answeredCount: list.length,
      avgMs: avg(list.map((a) => a.response_ms)),
      answers: Array.from({ length: played }, (_, i) => {
        const a = mine.get(i);
        return a ? { choice: a.choice, correct: a.correct, points: a.points, ms: a.response_ms } : null;
      }),
    };
  });

  return {
    game: {
      id: s.id,
      title: s.title,
      status: s.status,
      createdAt: new Date(s.createdAtMs).toISOString(),
      finishedAt: s.finishedAtMs ? new Date(s.finishedAtMs).toISOString() : null,
      totalQuestions: s.questions.length,
      played,
    },
    players,
    questions,
  };
}

async function deleteGame(sessionId, user) {
  const s = await getSession(sessionId);
  if (!s) throw new GameError(404, 'Ойын табылмады');
  assertHost(s, user);
  if (s.status !== 'finished') throw new GameError(409, 'Алдымен ойынды аяқтаңыз');
  await pool.query('DELETE FROM game_sessions WHERE id = $1', [sessionId]);
}

// ── тастап кеткен ойындарды жабу ────────────────────────────────────
async function closeStale() {
  const { rows } = await pool.query(
    `UPDATE game_sessions SET status = 'finished', finished_at = NOW()
     WHERE status <> 'finished' AND updated_at < NOW() - make_interval(hours => $1::int)
     RETURNING id`,
    [C.STALE_HOURS]
  );
  return rows.length;
}

function startJanitor() {
  const run = () => closeStale()
    .then((n) => { if (n) console.log(`🧹 ${n} тастап кеткен викторина ойыны жабылды`); })
    .catch((err) => console.error('Викторина janitor қатесі:', err.message));
  const first = setTimeout(run, 10 * 1000);
  const every = setInterval(run, 30 * 60 * 1000);
  if (first.unref) first.unref();
  if (every.unref) every.unref();
}

module.exports = {
  GameError,
  normalizeSession,
  loadModel,
  ensureFresh,
  hostSnapshot,
  playerSnapshot,
  playerByToken,
  createGame,
  checkPin,
  joinGame,
  submitAnswer,
  closeQuestion,
  startGame,
  advance,
  endGame,
  kickPlayer,
  setLocked,
  listGames,
  getResults,
  deleteGame,
  closeStale,
  startJanitor,
};
