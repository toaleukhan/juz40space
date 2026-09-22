const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { ROLES, ROLE_LABEL, questionsFor } = require('../custdev/questions');
const { generateProtocol, GeminiError } = require('../custdev/gemini');
const { exportRoundText } = require('../custdev/export');
const { extractDriveFileId, getDriveAuth, fetchDriveMeta, downloadDriveFile } = require('../custdev/drive');
const { transcribeRecording } = require('../custdev/transcribe');

const MAX_TRANSCRIPT = 60000;
const TITLE_MAX = 120;
const NAME_MAX = 150;
const MAX_RECORDING_BYTES = 300 * 1024 * 1024; // 300 МБ — Node процесінің жадысын сақтау үшін шек

// Тек admin көреді — CustDev сапа менеджерінің ішкі құралы. (owner_id
// арқылы сол ішінде де тек өз раундыңды көресің, admin — бәрін.)
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Тек admin рұқсаты бар' });
  next();
};

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
  console.error('CustDev маршруты қатесі:', err.message);
  res.status(500).json({ error: 'Сервер қатесі: ' + err.message });
});

async function loadRound(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Раунд табылмады' });
  const { rows } = await pool.query('SELECT * FROM custdev_rounds WHERE id = $1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Раунд табылмады' });
  if (rows[0].owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Бұл раунд сізге тиесілі емес' });
  }
  req.round = rows[0];
  next();
}

async function loadSession(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Сұхбат табылмады' });
  const { rows } = await pool.query(
    `SELECT s.*, r.owner_id FROM custdev_sessions s JOIN custdev_rounds r ON r.id = s.round_id WHERE s.id = $1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Сұхбат табылмады' });
  if (rows[0].owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Бұл сұхбат сізге тиесілі емес' });
  }
  req.session_ = rows[0];
  next();
}

const roundOut = (r) => ({ id: r.id, title: r.title, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at });

const sessionOut = (s, { full = false } = {}) => ({
  id: s.id,
  roundId: s.round_id,
  role: s.role,
  roleLabel: ROLE_LABEL[s.role],
  respondentName: s.respondent_name,
  groupCode: s.group_code,
  curatorName: s.curator_name,
  meetTimeLabel: s.meet_time_label,
  recordingRef: s.recording_ref,
  status: s.status,
  errorMessage: s.error_message,
  updatedAt: s.updated_at,
  ...(full ? { transcript: s.transcript, protocol: s.protocol } : {}),
});

function validateSessionInput(body) {
  const errors = [];
  const role = String(body.role || '');
  if (!ROLES.includes(role)) errors.push('Рөл дұрыс емес');
  const respondentName = String(body.respondentName || '').trim();
  if (!respondentName) errors.push('Аты-жөнін жазыңыз');
  else if (respondentName.length > NAME_MAX) errors.push(`Аты-жөні ${NAME_MAX} таңбадан аспауы керек`);
  const transcript = String(body.transcript || '');
  if (transcript.length > MAX_TRANSCRIPT) errors.push(`Транскрипт ${MAX_TRANSCRIPT} таңбадан аспауы керек`);
  const groupCode = body.groupCode ? String(body.groupCode).trim().slice(0, 50) : null;
  const curatorName = body.curatorName ? String(body.curatorName).trim().slice(0, NAME_MAX) : null;
  const meetTimeLabel = body.meetTimeLabel ? String(body.meetTimeLabel).trim().slice(0, 100) : null;
  const recordingRef = body.recordingRef ? String(body.recordingRef).trim().slice(0, 300) : null;
  return { errors, value: { role, respondentName, transcript, groupCode, curatorName, meetTimeLabel, recordingRef } };
}

// ── сұрақ банкі (frontend соны формада көрсетеді, соны сұрайды) ──────
router.get('/roles', auth, requireAdmin, (req, res) => {
  res.json(ROLES.map((id) => ({ id, label: ROLE_LABEL[id], questions: questionsFor(id) })));
});

// ── жазбадан транскрипт алу ───────────────────────────────────────
// Раундқа/сұхбатқа тәуелсіз: аты-жөнін толтырмас бұрын да, дайын
// сұхбатты кейін де сынап көруге болады — сессия жасаудың қажеті жоқ.
// Уақыты (recordedAt) Drive-тың файл метадеректерінен өзі анықталады,
// сапа менеджер қолмен жазбайды.
router.post('/fetch-transcript', auth, requireAdmin, asyncRoute(async (req, res) => {
  const ref = String(req.body?.recordingRef || '').trim();
  if (!ref) return res.status(400).json({ error: 'Жазба сілтемесін қойыңыз' });

  const fileId = extractDriveFileId(ref);
  if (!fileId) {
    return res.status(400).json({ error: 'Бұл жерден Drive файл сілтемесін таба алмадым. Файлдың Drive сілтемесін қойыңыз (drive.google.com/file/d/... түрінде)' });
  }

  const authClient = getDriveAuth();
  if (!authClient) return res.status(503).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON_CUSTDEV орнатылмаған' });

  try {
    const meta = await fetchDriveMeta(fileId, authClient);
    const size = Number(meta.size || 0);
    if (size > MAX_RECORDING_BYTES) {
      return res.status(413).json({ error: `Файл тым үлкен (${Math.round(size / 1e6)} МБ, шегі — ${MAX_RECORDING_BYTES / 1e6} МБ)` });
    }
    const buffer = await downloadDriveFile(fileId, authClient);
    const transcript = await transcribeRecording({ buffer, mimeType: meta.mimeType, displayName: meta.name || 'жазба' });
    res.json({ transcript, recordedAt: meta.createdTime || null, fileName: meta.name || null });
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : 'Транскрипт алу сәтсіз аяқталды: ' + err.message;
    const status = err instanceof GeminiError && err.code === 'no_key' ? 503 : 502;
    res.status(status).json({ error: message });
  }
}));

// ── раундтар ───────────────────────────────────────────────────────
router.get('/rounds', auth, requireAdmin, asyncRoute(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { rows } = await pool.query(
    `SELECT r.*,
            (SELECT COUNT(*)::int FROM custdev_sessions x WHERE x.round_id = r.id) AS session_count,
            (SELECT COUNT(*)::int FROM custdev_sessions x WHERE x.round_id = r.id AND x.status = 'ready') AS ready_count
     FROM custdev_rounds r
     WHERE ($1::boolean OR r.owner_id = $2)
     ORDER BY r.created_at DESC`,
    [isAdmin, req.user.id]
  );
  res.json(rows.map((r) => ({ ...roundOut(r), sessionCount: r.session_count, readyCount: r.ready_count })));
}));

router.post('/rounds', auth, requireAdmin, asyncRoute(async (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Раунд атауын жазыңыз' });
  if (title.length > TITLE_MAX) return res.status(400).json({ error: `Атау ${TITLE_MAX} таңбадан аспауы керек` });
  const note = req.body?.note ? String(req.body.note).trim().slice(0, 500) : null;
  const { rows } = await pool.query(
    `INSERT INTO custdev_rounds (owner_id, title, note) VALUES ($1, $2, $3) RETURNING *`,
    [req.user.id, title, note]
  );
  res.status(201).json(roundOut(rows[0]));
}));

router.get('/rounds/:id', auth, requireAdmin, loadRound, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM custdev_sessions WHERE round_id = $1 ORDER BY created_at ASC`,
    [req.round.id]
  );
  res.json({ ...roundOut(req.round), sessions: rows.map((s) => sessionOut(s)) });
}));

router.put('/rounds/:id', auth, requireAdmin, loadRound, asyncRoute(async (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Раунд атауын жазыңыз' });
  if (title.length > TITLE_MAX) return res.status(400).json({ error: `Атау ${TITLE_MAX} таңбадан аспауы керек` });
  const note = req.body?.note ? String(req.body.note).trim().slice(0, 500) : null;
  const { rows } = await pool.query(
    `UPDATE custdev_rounds SET title = $2, note = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [req.round.id, title, note]
  );
  res.json(roundOut(rows[0]));
}));

router.delete('/rounds/:id', auth, requireAdmin, loadRound, asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM custdev_rounds WHERE id = $1', [req.round.id]);
  res.json({ success: true });
}));

router.get('/rounds/:id/export', auth, requireAdmin, loadRound, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM custdev_sessions WHERE round_id = $1 ORDER BY created_at ASC`,
    [req.round.id]
  );
  const sessions = rows.map((s) => ({
    role: s.role,
    respondentName: s.respondent_name,
    groupCode: s.group_code,
    curatorName: s.curator_name,
    meetTimeLabel: s.meet_time_label,
    recordingRef: s.recording_ref,
    protocol: s.protocol,
  }));
  res.json({ text: exportRoundText(roundOut(req.round), sessions) });
}));

// ── сұхбаттар ─────────────────────────────────────────────────────
router.post('/rounds/:id/sessions', auth, requireAdmin, loadRound, asyncRoute(async (req, res) => {
  const v = validateSessionInput(req.body || {});
  if (v.errors.length) return res.status(400).json({ error: v.errors[0], errors: v.errors });

  const { rows } = await pool.query(
    `INSERT INTO custdev_sessions
       (round_id, role, respondent_name, group_code, curator_name, meet_time_label, recording_ref, transcript)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [req.round.id, v.value.role, v.value.respondentName, v.value.groupCode, v.value.curatorName,
      v.value.meetTimeLabel, v.value.recordingRef, v.value.transcript]
  );
  res.status(201).json(sessionOut(rows[0], { full: true }));
}));

router.get('/sessions/:id', auth, requireAdmin, loadSession, asyncRoute(async (req, res) => {
  res.json(sessionOut(req.session_, { full: true }));
}));

router.put('/sessions/:id', auth, requireAdmin, loadSession, asyncRoute(async (req, res) => {
  const b = req.body || {};
  const s = req.session_;
  const v = validateSessionInput({
    role: s.role, // рөлі өзгермейді — өзгерсе сұрақ банкі басқа болып, протокол сай келмей қалады
    respondentName: b.respondentName ?? s.respondent_name,
    groupCode: b.groupCode ?? s.group_code,
    curatorName: b.curatorName ?? s.curator_name,
    meetTimeLabel: b.meetTimeLabel ?? s.meet_time_label,
    recordingRef: b.recordingRef ?? s.recording_ref,
    transcript: b.transcript ?? s.transcript,
  });
  if (v.errors.length) return res.status(400).json({ error: v.errors[0], errors: v.errors });

  let protocol = req.session_.protocol;
  if (Array.isArray(b.protocol)) {
    const questions = questionsFor(req.session_.role);
    if (b.protocol.length !== questions.length) {
      return res.status(400).json({ error: `Протоколда дәл ${questions.length} жауап болуы керек` });
    }
    protocol = questions.map((q, i) => ({ question: q, answer: String(b.protocol[i]?.answer ?? '-').trim() || '-' }));
  }

  const { rows } = await pool.query(
    `UPDATE custdev_sessions
     SET respondent_name = $2, group_code = $3, curator_name = $4, meet_time_label = $5,
         recording_ref = $6, transcript = $7, protocol = $8, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.session_.id, v.value.respondentName, v.value.groupCode, v.value.curatorName, v.value.meetTimeLabel,
      v.value.recordingRef, v.value.transcript, JSON.stringify(protocol)]
  );
  res.json(sessionOut(rows[0], { full: true }));
}));

router.delete('/sessions/:id', auth, requireAdmin, loadSession, asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM custdev_sessions WHERE id = $1', [req.session_.id]);
  res.json({ success: true });
}));

// ── AI-мен протокол жасау ─────────────────────────────────────────
// Транскрипт бойынша Gemini шақырады, ұзақ жүруі мүмкін (30 мин жазба).
// Сәтті болса status='ready', сервер/кілт қатесінде status='error' —
// транскрипт жоғалмайды, "Қайта жасау" батырмасымен қайта көруге болады.
router.post('/sessions/:id/generate', auth, requireAdmin, loadSession, asyncRoute(async (req, res) => {
  if (!req.session_.transcript.trim()) return res.status(400).json({ error: 'Алдымен транскриптті қойыңыз' });

  try {
    const protocol = await generateProtocol({ role: req.session_.role, transcript: req.session_.transcript });
    const { rows } = await pool.query(
      `UPDATE custdev_sessions SET protocol = $2, status = 'ready', error_message = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.session_.id, JSON.stringify(protocol)]
    );
    res.json(sessionOut(rows[0], { full: true }));
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : 'Протокол жасау сәтсіз аяқталды: ' + err.message;
    await pool.query(
      `UPDATE custdev_sessions SET status = 'error', error_message = $2, updated_at = NOW() WHERE id = $1`,
      [req.session_.id, message]
    );
    res.status(err instanceof GeminiError && err.code === 'no_key' ? 503 : 502).json({ error: message });
  }
}));

module.exports = router;
