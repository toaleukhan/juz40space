const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { google } = require('googleapis');
const { getGoogleAuth } = require('../utils/googleAuth');
const { Readable } = require('stream');

// Бағалауды тек координатор мен админ жаза алады — куратордың өзі оқи
// алады (өз жазбасы), бірақ өзгерте алмайды.
function requireReviewer(req, res, next) {
  if (!['coordinator', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Тек координатор немесе admin жаза алады' });
  }
  next();
}

// Куратор — тек өз жазбасын, координатор — тек өз пән/ағымын, admin —
// бәрін оқи алады. GET /api/st-recordings-тегі ережемен бірдей.
async function loadAccessibleRecording(req, res, next) {
  const rec = await pool.query('SELECT * FROM st_recordings WHERE id = $1', [req.params.recordingId]);
  if (!rec.rows.length) return res.status(404).json({ error: 'Жазба табылмады' });
  const record = rec.rows[0];

  if (req.user.role === 'curator' && record.curator_name !== req.user.fullName) {
    return res.status(403).json({ error: 'Бұл жазба сізге тиесілі емес' });
  }
  if (req.user.role === 'coordinator' &&
      (record.subject !== req.user.subject || record.stream_id !== (req.user.streamId || '01'))) {
    return res.status(403).json({ error: 'Бұл жазба сіздің ағымыңызда емес' });
  }

  req.record = record;
  next();
}

function driveFileId(url) {
  const m = String(url || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// ── Видео proxy: Drive-тағы жазбаны сол origin-нен ағызады ──────────────
// Неге қажет: Google Drive-тың өз ендірілген плеері (iframe) браузерден
// canvas арқылы скриншот алуға тыйым салады (cross-origin). Видеоны осы
// эндпойнт арқылы <video> тегіне бергенде, ол БІЗДІҢ origin-нен келеді
// де, canvas.drawImage тегін, серверде ешбір өңдеусіз (ffmpeg керек
// емес) скриншот алуға мүмкіндік береді.
//
// <video> тегі Authorization header жібере алмайды, сондықтан токен
// query арқылы келеді — auth middleware мұны қолдайды.
router.get('/:recordingId/video', auth, loadAccessibleRecording, async (req, res) => {
  const url = String(req.query.url || '');
  const links = req.record.video_links?.length ? req.record.video_links : (req.record.video_link ? [req.record.video_link] : []);
  if (!links.includes(url)) {
    return res.status(400).json({ error: 'Бұл сілтеме осы жазбаға тиесілі емес' });
  }
  const fileId = driveFileId(url);
  if (!fileId) return res.status(400).json({ error: 'Жарамсыз Drive сілтемесі' });

  const authClient = getGoogleAuth(req.record.subject);
  if (!authClient) return res.status(400).json({ error: 'Google авторизация кілттері табылмады' });

  try {
    const { token } = await authClient.getAccessToken();
    // ӘРҚАШАН Range жіберіледі, клиент сұрамаса да. Себебі: жазбалар
    // бірнеше гигабайт болуы мүмкін (мыс. 3.5 ГБ), ал <video> тегінің
    // БІРІНШІ сұранысы әдетте Range-сіз келеді — егер соны Range-сіз
    // Drive-қа жіберсек, ол 200-мен БҮКІЛ файлды бір демде қайтарады,
    // браузер оны ешқашан жүктеп бітіре алмайды да, видео "ашылмай"
    // қалады. Range-пен сұрасақ, Drive әрдайым 206 қайтарады — сол
    // арқылы браузер бірден "бұл сурьектің Range қолдауы бар" деп
    // біліп, қалғанын өзі бөлшектеп сұрай бастайды.
    const range = req.headers.range || 'bytes=0-';
    const upstream = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}`, Range: range },
    });

    res.status(upstream.status);
    res.setHeader('Accept-Ranges', 'bytes');
    ['content-type', 'content-length', 'content-range'].forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });
    if (!upstream.body) return res.end();
    // Видео үлкен (бірнеше ГБ) болғандықтан, браузер жиі осы ағынды
    // жарты жолда тоқтатып, кішірек Range-пен қайта сұрайды — бұл
    // қалыпты жағдай, дегенмен соны 'error' ретінде ұстамасақ, процесс
    // логында қажетсіз stack trace қалады (крашқа әкелмейді, себебі
    // res.pipe өзі клиент жабылғанда destroy шақырады).
    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', () => {});
    stream.pipe(res);
  } catch (err) {
    res.status(502).json({ error: 'Drive-тан видео алу қатесі: ' + err.message });
  }
});

// ── Жазба туралы негізгі ақпарат (бағалау бетінің тақырыбы үшін) ──────
router.get('/:recordingId', auth, loadAccessibleRecording, (req, res) => {
  res.json(req.record);
});

// ── Бағалауды оқу ─────────────────────────────────────────────────────
router.get('/:recordingId/review', auth, loadAccessibleRecording, async (req, res) => {
  try {
    const reviewRes = await pool.query(
      'SELECT * FROM recording_reviews WHERE recording_id = $1',
      [req.params.recordingId]
    );
    const review = reviewRes.rows[0] || null;
    if (!review) return res.json({ review: null, findings: [], students: [] });

    const [findings, students] = await Promise.all([
      pool.query('SELECT * FROM review_findings WHERE review_id = $1 ORDER BY order_index ASC, id ASC', [review.id]),
      pool.query('SELECT * FROM review_student_notes WHERE review_id = $1 ORDER BY order_index ASC, id ASC', [review.id]),
    ]);
    res.json({ review, findings: findings.rows, students: students.rows });
  } catch (err) {
    res.status(500).json({ error: 'База қатесі: ' + err.message });
  }
});

// ── Бағалауды жасау/жаңарту (no_issues, recommendation) ──────────────
router.put('/:recordingId/review', auth, requireReviewer, loadAccessibleRecording, async (req, res) => {
  const { noIssues, recommendation } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO recording_reviews (recording_id, reviewer_id, no_issues, recommendation)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (recording_id) DO UPDATE
         SET reviewer_id = $2, no_issues = $3, recommendation = $4, updated_at = NOW()
       RETURNING *`,
      [req.params.recordingId, req.user.id, !!noIssues, recommendation || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'База қатесі: ' + err.message });
  }
});

async function ensureReviewId(recordingId, reviewerId) {
  const existing = await pool.query('SELECT id FROM recording_reviews WHERE recording_id = $1', [recordingId]);
  if (existing.rows.length) return existing.rows[0].id;
  const created = await pool.query(
    'INSERT INTO recording_reviews (recording_id, reviewer_id) VALUES ($1, $2) RETURNING id',
    [recordingId, reviewerId]
  );
  return created.rows[0].id;
}

// Скриншотты сол пәннің Drive-ына жүктеп, әркімге оқуға ашық сілтеме
// қайтарады — <img> тегінен тікелей ашылатындай.
async function uploadScreenshot(subject, base64Png, name) {
  const authClient = getGoogleAuth(subject);
  if (!authClient) return null;
  const drive = google.drive({ version: 'v3', auth: authClient });
  const buffer = Buffer.from(base64Png.replace(/^data:image\/\w+;base64,/, ''), 'base64');

  const created = await drive.files.create({
    requestBody: { name },
    media: { mimeType: 'image/png', body: Readable.from(buffer) },
    fields: 'id, webContentLink',
  });
  await drive.permissions.create({
    fileId: created.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  return `https://drive.google.com/uc?id=${created.data.id}`;
}

// ── Ескерту (finding) қосу — уақыт белгісі + скриншот + сипаттама ────
router.post('/:recordingId/review/findings', auth, requireReviewer, loadAccessibleRecording, async (req, res) => {
  const { videoUrl, timestampSeconds, description, screenshotBase64 } = req.body;
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: 'Сипаттама міндетті' });
  }
  try {
    const reviewId = await ensureReviewId(req.params.recordingId, req.user.id);

    let screenshotUrl = null;
    if (screenshotBase64) {
      const name = `Ескерту_${req.record.curator_name}_${Math.round(timestampSeconds || 0)}с.png`;
      screenshotUrl = await uploadScreenshot(req.record.subject, screenshotBase64, name).catch((e) => {
        console.error('Screenshot upload қатесі:', e.message);
        return null;
      });
    }

    const countRes = await pool.query('SELECT COUNT(*)::int AS n FROM review_findings WHERE review_id = $1', [reviewId]);
    const result = await pool.query(
      `INSERT INTO review_findings (review_id, video_url, timestamp_seconds, description, screenshot_url, order_index)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [reviewId, videoUrl || null, timestampSeconds || null, description.trim(), screenshotUrl, countRes.rows[0].n]
    );
    // no_issues=true болса, енді ескерту қосылып тұр — соны автоматты өшіреміз.
    await pool.query('UPDATE recording_reviews SET no_issues = false WHERE id = $1', [reviewId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Сақтау қатесі: ' + err.message });
  }
});

router.delete('/review/findings/:findingId', auth, requireReviewer, async (req, res) => {
  try {
    await pool.query('DELETE FROM review_findings WHERE id = $1', [req.params.findingId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Оқушы бойынша рейтинг ескертуі ────────────────────────────────────
router.post('/:recordingId/review/students', auth, requireReviewer, loadAccessibleRecording, async (req, res) => {
  const { studentName, ok, note } = req.body;
  if (!studentName || !String(studentName).trim()) {
    return res.status(400).json({ error: 'Оқушының аты міндетті' });
  }
  try {
    const reviewId = await ensureReviewId(req.params.recordingId, req.user.id);
    const countRes = await pool.query('SELECT COUNT(*)::int AS n FROM review_student_notes WHERE review_id = $1', [reviewId]);
    const result = await pool.query(
      `INSERT INTO review_student_notes (review_id, student_name, ok, note, order_index)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [reviewId, studentName.trim(), ok !== false, note || null, countRes.rows[0].n]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Сақтау қатесі: ' + err.message });
  }
});

router.delete('/review/students/:noteId', auth, requireReviewer, async (req, res) => {
  try {
    await pool.query('DELETE FROM review_student_notes WHERE id = $1', [req.params.noteId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
