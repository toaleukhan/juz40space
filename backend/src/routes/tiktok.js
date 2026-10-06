// 🎬 TikTok жарысы — тек «media» рөлі (Media team тимлиді).
//
//   GET    /api/tiktok/overview?month=YYYY-MM   рейтинг + күнтізбе + видеолар + анализ
//   GET    /api/tiktok/departments              бөлімдер тізімі
//   POST   /api/tiktok/departments              бөлім қосу
//   PUT    /api/tiktok/departments/:id          өзгерту
//   DELETE /api/tiktok/departments/:id          өшіру (видеоларымен бірге)
//   POST   /api/tiktok/sync {month}             Apify-ды іске қосу
//   GET    /api/tiktok/sync/:id                 күйін тексеру (дайын болса — базаға жазады)
//   PUT    /api/tiktok/scores/:month/:deptId    жюри ұпайлары
//   POST   /api/tiktok/analysis {month}         Gemini анализі (айына сақталады)

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const S = require('../tiktok/scoring');
const apify = require('../tiktok/apify');
const { computeInsights, generateAnalysis } = require('../tiktok/insights');
const { GeminiError } = require('../custdev/gemini');

const RUN_STALE_MS = 20 * 60 * 1000; // одан ұзақ «running» болса — қайта іске қосуға рұқсат

const requireMedia = (req, res, next) => {
  if (req.user?.role !== 'media') return res.status(403).json({ error: 'Тек Media team тимлидіне рұқсат' });
  next();
};

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
  if (err instanceof apify.ApifyError) {
    const msg = err.code === 'limit'
      ? 'Apify лимиті таусылды — келесі есеп кезеңін күтіңіз немесе тарифті жаңартыңыз.'
      : err.message;
    return res.status(err.code === 'no_token' ? 503 : 502).json({ error: msg, code: err.code });
  }
  if (err instanceof GeminiError) {
    return res.status(err.code === 'no_key' ? 503 : 502).json({ error: err.message });
  }
  console.error('TikTok маршруты қатесі:', err.message);
  res.status(500).json({ error: 'Сервер қатесі: ' + err.message });
});

router.use(auth, requireMedia);

/* ───────────── Бөлімдер ───────────── */

const cleanUsername = (u) => String(u || '').trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();
const cleanTag = (t) => String(t || '').trim().replace(/^#/, '').toLowerCase();

const deptOut = (d) => ({
  id: d.id, name: d.name, username: d.username, teamTag: d.team_tag || '',
  isTeamAccount: d.is_team_account, active: d.active,
});

function validateDept(body) {
  const errors = [];
  const name = String(body.name || '').trim();
  const username = cleanUsername(body.username);
  const teamTag = cleanTag(body.teamTag);
  const isTeamAccount = Boolean(body.isTeamAccount);
  if (!isTeamAccount && (!name || name.length > 120)) errors.push('Бөлім атауын жазыңыз (120 таңбаға дейін)');
  if (!/^[a-z0-9._]{2,32}$/.test(username)) errors.push('TikTok username дұрыс емес (мыс: juz40_fizika)');
  if (teamTag && !/^[\p{L}\p{N}_]{2,60}$/u.test(teamTag)) errors.push('Хештег дұрыс емес (бос орынсыз, мыс: juz40_fizika)');
  return { errors, value: { name: name || 'Juz40_team', username, teamTag: teamTag || null, isTeamAccount } };
}

async function listDepartments() {
  const { rows } = await pool.query('SELECT * FROM tiktok_departments ORDER BY is_team_account, name');
  return rows;
}

router.get('/departments', asyncRoute(async (req, res) => {
  res.json((await listDepartments()).map(deptOut));
}));

router.post('/departments', asyncRoute(async (req, res) => {
  const v = validateDept(req.body);
  if (v.errors.length) return res.status(400).json({ error: v.errors.join('; ') });
  if (v.value.isTeamAccount) {
    const { rows } = await pool.query('SELECT id FROM tiktok_departments WHERE is_team_account');
    if (rows.length) return res.status(400).json({ error: 'Juz40_team аккаунты бұрыннан қосылған' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO tiktok_departments (name, username, team_tag, is_team_account) VALUES ($1,$2,$3,$4) RETURNING *`,
      [v.value.name, v.value.username, v.value.teamTag, v.value.isTeamAccount]
    );
    res.status(201).json(deptOut(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Бұл аккаунт бұрыннан тізімде бар' });
    throw err;
  }
}));

router.put('/departments/:id', asyncRoute(async (req, res) => {
  const { rows: cur } = await pool.query('SELECT * FROM tiktok_departments WHERE id = $1', [Number(req.params.id) || 0]);
  if (!cur.length) return res.status(404).json({ error: 'Бөлім табылмады' });
  const v = validateDept({ ...deptOut(cur[0]), ...req.body, isTeamAccount: cur[0].is_team_account });
  if (v.errors.length) return res.status(400).json({ error: v.errors.join('; ') });
  const active = req.body.active === undefined ? cur[0].active : Boolean(req.body.active);
  try {
    const { rows } = await pool.query(
      `UPDATE tiktok_departments SET name=$1, username=$2, team_tag=$3, active=$4 WHERE id=$5 RETURNING *`,
      [v.value.name, v.value.username, v.value.teamTag, active, cur[0].id]
    );
    res.json(deptOut(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Бұл аккаунт бұрыннан тізімде бар' });
    throw err;
  }
}));

router.delete('/departments/:id', asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM tiktok_departments WHERE id = $1', [Number(req.params.id) || 0]);
  res.json({ ok: true });
}));

/* ───────────── Синхрон (Apify) ───────────── */

const syncOut = (s) => s && ({
  id: s.id, month: s.month.trim(), status: s.status, videoCount: s.video_count,
  error: s.error_message, startedAt: s.started_at, finishedAt: s.finished_at,
});

router.post('/sync', asyncRoute(async (req, res) => {
  const month = String(req.body.month || S.currentMonth());
  if (!S.isMonth(month)) return res.status(400).json({ error: 'Ай форматы YYYY-MM' });
  const win = S.scoringWindow(month);
  if (win.effectiveEnd < win.start) return res.status(400).json({ error: 'Бұл ай әлі басталған жоқ' });

  // Бір айға бір уақытта бір ғана run — қос басу екі есе төлетпесін.
  const { rows: running } = await pool.query(
    `SELECT * FROM tiktok_syncs WHERE month=$1 AND status IN ('running','ingesting') AND started_at > NOW() - ($2 || ' milliseconds')::interval
     ORDER BY id DESC LIMIT 1`, [month, String(RUN_STALE_MS)]
  );
  if (running.length) return res.json(syncOut(running[0]));

  const depts = (await listDepartments()).filter((d) => d.active);
  if (!depts.length) return res.status(400).json({ error: 'Алдымен бөлімдердің TikTok аккаунттарын қосыңыз' });

  const run = await apify.startRun(depts.map((d) => d.username), win.start, win.effectiveEnd);
  const { rows } = await pool.query(
    `INSERT INTO tiktok_syncs (month, run_id, dataset_id, started_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [month, run.runId, run.datasetId, req.user.id]
  );
  res.status(201).json(syncOut(rows[0]));
}));

async function ingest(sync, datasetId) {
  const items = await apify.fetchItems(datasetId);
  const { start, end } = S.monthRange(sync.month.trim());
  const depts = await listDepartments();
  const byUser = new Map(depts.map((d) => [d.username, d.id]));
  const seen = new Set();
  let n = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const raw of Array.isArray(items) ? items : []) {
      const v = apify.normalizeItem(raw);
      if (!v || seen.has(v.id) || !byUser.has(v.username) || v.postDay < start || v.postDay > end) continue;
      seen.add(v.id);
      await client.query(
        `INSERT INTO tiktok_videos (id, department_id, username, posted_at, post_day, views, likes, comments, shares,
           duration_sec, music_original, music_name, caption, hashtags, mentions, url, fetched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
         ON CONFLICT (id) DO UPDATE SET department_id=EXCLUDED.department_id, views=EXCLUDED.views, likes=EXCLUDED.likes,
           comments=EXCLUDED.comments, shares=EXCLUDED.shares, caption=EXCLUDED.caption, hashtags=EXCLUDED.hashtags,
           mentions=EXCLUDED.mentions, duration_sec=EXCLUDED.duration_sec, music_original=EXCLUDED.music_original,
           music_name=EXCLUDED.music_name, fetched_at=NOW()`,
        [v.id, byUser.get(v.username), v.username, v.postedAt, v.postDay, v.views, v.likes, v.comments, v.shares,
          v.durationSec || null, v.musicOriginal, v.musicName, v.caption, v.hashtags, v.mentions, v.url]
      );
      n += 1;
    }
    await client.query(
      `UPDATE tiktok_syncs SET status='done', video_count=$1, finished_at=NOW() WHERE id=$2`, [n, sync.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

router.get('/sync/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tiktok_syncs WHERE id = $1', [Number(req.params.id) || 0]);
  if (!rows.length) return res.status(404).json({ error: 'Синхрон табылмады' });
  const sync = rows[0];
  if (sync.status !== 'running') return res.json(syncOut(sync));

  const run = await apify.getRun(sync.run_id);
  if (['READY', 'RUNNING'].includes(run.status)) return res.json(syncOut(sync));

  if (run.status !== 'SUCCEEDED') {
    const { rows: upd } = await pool.query(
      `UPDATE tiktok_syncs SET status='failed', error_message=$1, finished_at=NOW() WHERE id=$2 RETURNING *`,
      [`Apify жұмысы аяқталмады: ${run.status}`, sync.id]
    );
    return res.json(syncOut(upd[0]));
  }

  // Бір сұраныс қана жазсын: running → ingesting ауысуын атомды түрде аламыз.
  const { rows: claimed } = await pool.query(
    `UPDATE tiktok_syncs SET status='ingesting' WHERE id=$1 AND status='running' RETURNING *`, [sync.id]
  );
  if (!claimed.length) {
    const { rows: now } = await pool.query('SELECT * FROM tiktok_syncs WHERE id = $1', [sync.id]);
    return res.json(syncOut(now[0]));
  }
  try {
    await ingest(claimed[0], run.datasetId || sync.dataset_id);
  } catch (err) {
    await pool.query(
      `UPDATE tiktok_syncs SET status='failed', error_message=$1, finished_at=NOW() WHERE id=$2`,
      [String(err.message).slice(0, 480), sync.id]
    );
    throw err;
  }
  const { rows: done } = await pool.query('SELECT * FROM tiktok_syncs WHERE id = $1', [sync.id]);
  res.json(syncOut(done[0]));
}));

/* ───────────── Шолу ───────────── */

const videoOut = (v, teamIds) => ({
  id: v.id,
  departmentId: v.department_id,
  isTeam: teamIds.has(v.department_id),
  username: v.username,
  postedAt: v.posted_at,
  postDay: v.day, // SQL-де ::text — node-pg DATE-ті жергілікті уақыт белдеуімен Date-ке айналдырмасын
  views: Number(v.views), likes: Number(v.likes), comments: Number(v.comments), shares: Number(v.shares),
  durationSec: v.duration_sec, musicOriginal: v.music_original, musicName: v.music_name,
  caption: v.caption, hashtags: v.hashtags || [], mentions: v.mentions || [], url: v.url,
});

const JURY_COLUMNS = { creativity: 'creativity', ethics: 'ethics', crossDept: 'cross_dept', activity: 'activity', teamAccount: 'team_account', bonus: 'bonus' };

async function loadMonth(month) {
  const { start, end } = S.monthRange(month);
  const depts = await listDepartments();
  const teamIds = new Set(depts.filter((d) => d.is_team_account).map((d) => d.id));
  const { rows: vrows } = await pool.query(
    `SELECT id, department_id, username, posted_at, post_day::text AS day, views, likes, comments, shares,
            duration_sec, music_original, music_name, caption, hashtags, mentions, url
     FROM tiktok_videos WHERE post_day BETWEEN $1 AND $2 ORDER BY posted_at`, [start, end]
  );
  const videos = vrows.map((v) => videoOut(v, teamIds));
  const { rows: srows } = await pool.query('SELECT * FROM tiktok_scores WHERE month = $1', [month]);
  const jury = {};
  srows.forEach((s) => {
    jury[s.department_id] = Object.fromEntries(Object.entries(JURY_COLUMNS)
      .map(([k, col]) => [k, s[col] === null ? null : Number(s[col])]));
  });
  return { depts, videos, jury, teamIds };
}

router.get('/overview', asyncRoute(async (req, res) => {
  const month = String(req.query.month || S.currentMonth());
  if (!S.isMonth(month)) return res.status(400).json({ error: 'Ай форматы YYYY-MM' });
  const window = S.scoringWindow(month);
  const { depts, videos, jury } = await loadMonth(month);

  const competing = depts.filter((d) => !d.is_team_account && d.active)
    .map((d) => ({ id: d.id, name: d.name, username: d.username, teamTag: d.team_tag }));
  const leaderboard = S.buildLeaderboard({ departments: competing, videos, jury, window });
  const insights = computeInsights(videos.filter((v) => competing.some((d) => d.id === v.departmentId)));

  const [{ rows: syncRows }, { rows: analysisRows }] = await Promise.all([
    pool.query('SELECT * FROM tiktok_syncs WHERE month = $1 ORDER BY id DESC LIMIT 1', [month]),
    pool.query('SELECT * FROM tiktok_analyses WHERE month = $1', [month]),
  ]);

  res.json({
    month,
    window: { start: window.start, end: window.end, effectiveEnd: window.effectiveEnd, workdays: window.workdays, isCurrent: window.isCurrent },
    allDays: S.monthRange(month),
    departments: depts.map(deptOut),
    leaderboard,
    juryFields: S.JURY_FIELDS,
    videos,
    insights: { overall: insights.overall, dimensions: insights.dimensions },
    lastSync: syncOut(syncRows[0]) || null,
    analysis: analysisRows[0]
      ? { ...analysisRows[0].content, createdAt: analysisRows[0].created_at, videoCount: analysisRows[0].video_count }
      : null,
  });
}));

/* ───────────── Жюри ───────────── */

router.put('/scores/:month/:deptId', asyncRoute(async (req, res) => {
  const month = String(req.params.month);
  const deptId = Number(req.params.deptId);
  if (!S.isMonth(month)) return res.status(400).json({ error: 'Ай форматы YYYY-MM' });
  const { rows: d } = await pool.query('SELECT id FROM tiktok_departments WHERE id=$1 AND NOT is_team_account', [deptId || 0]);
  if (!d.length) return res.status(404).json({ error: 'Бөлім табылмады' });

  const values = {};
  for (const f of S.JURY_FIELDS) {
    const raw = req.body[f.key];
    if (raw === null || raw === '' || raw === undefined) { values[f.key] = null; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > f.max) {
      return res.status(400).json({ error: `«${f.label}» 0–${f.max} аралығында болуы керек` });
    }
    values[f.key] = Math.round(n * 10) / 10;
  }
  await pool.query(
    `INSERT INTO tiktok_scores (month, department_id, creativity, ethics, cross_dept, activity, team_account, bonus, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (month, department_id) DO UPDATE SET creativity=EXCLUDED.creativity, ethics=EXCLUDED.ethics,
       cross_dept=EXCLUDED.cross_dept, activity=EXCLUDED.activity, team_account=EXCLUDED.team_account,
       bonus=EXCLUDED.bonus, updated_by=EXCLUDED.updated_by, updated_at=NOW()`,
    [month, deptId, values.creativity, values.ethics, values.crossDept, values.activity, values.teamAccount, values.bonus, req.user.id]
  );
  res.json({ ok: true, jury: values });
}));

/* ───────────── ИИ анализі ───────────── */

router.post('/analysis', asyncRoute(async (req, res) => {
  const month = String(req.body.month || S.currentMonth());
  if (!S.isMonth(month)) return res.status(400).json({ error: 'Ай форматы YYYY-MM' });
  const window = S.scoringWindow(month);
  const { depts, videos, jury } = await loadMonth(month);
  const competing = depts.filter((d) => !d.is_team_account && d.active)
    .map((d) => ({ id: d.id, name: d.name, username: d.username, teamTag: d.team_tag }));
  const own = videos.filter((v) => competing.some((d) => d.id === v.departmentId));
  if (own.length < 5) return res.status(400).json({ error: 'Анализге кемінде 5 видео керек — алдымен деректерді жаңартыңыз' });

  const leaderboard = S.buildLeaderboard({ departments: competing, videos, jury, window });
  const insights = computeInsights(own);
  const departmentsById = Object.fromEntries(competing.map((d) => [d.id, d]));
  const content = await generateAnalysis({ month, leaderboard, insights, departmentsById });

  const { rows } = await pool.query(
    `INSERT INTO tiktok_analyses (month, content, video_count, created_at) VALUES ($1,$2,$3,NOW())
     ON CONFLICT (month) DO UPDATE SET content=EXCLUDED.content, video_count=EXCLUDED.video_count, created_at=NOW()
     RETURNING *`,
    [month, JSON.stringify(content), own.length]
  );
  res.json({ ...rows[0].content, createdAt: rows[0].created_at, videoCount: rows[0].video_count });
}));

module.exports = router;
module.exports._internal = { cleanUsername, validateDept };
