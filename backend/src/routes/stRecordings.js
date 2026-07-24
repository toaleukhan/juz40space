const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Пән коды (кириллица) -> ортам айнымалысының ASCII жалғауы,
// мыс. GOOGLE_TOKEN_JSON_FIZ / GOOGLE_CREDENTIALS_JSON_FIZ
const SUBJECT_ENV_KEY = {
  ФИЗ: 'FIZ', МАТ: 'MAT', ТІЛ: 'TIL', БИО: 'BIO', ИНФО: 'INFO', ГЕО: 'GEO',
  ТАРИХ: 'TARIH', РУС: 'RUS', ХИМ: 'HIM', МС: 'MS', ӘДЕБ: 'ADEB', АНГЛ: 'ANGL', ДЖТ: 'DZHT',
};

// subject берілсе, сол пәннің жеке домен аккаунтын (Railway-де
// GOOGLE_TOKEN_JSON_<КОД> / GOOGLE_CREDENTIALS_JSON_<КОД>) іздейді;
// табылмаса — бұрынғыдай ортақ аккаунтқа (GOOGLE_TOKEN_JSON) түседі.
function getGoogleAuth(subject) {
  try {
    let tokens = null;
    let creds = null;

    const envKey = subject && SUBJECT_ENV_KEY[subject];
    if (envKey && process.env[`GOOGLE_TOKEN_JSON_${envKey}`] && process.env[`GOOGLE_CREDENTIALS_JSON_${envKey}`]) {
      tokens = JSON.parse(process.env[`GOOGLE_TOKEN_JSON_${envKey}`]);
      creds = JSON.parse(process.env[`GOOGLE_CREDENTIALS_JSON_${envKey}`]);
    } else if (process.env.GOOGLE_TOKEN_JSON && process.env.GOOGLE_CREDENTIALS_JSON) {
      tokens = JSON.parse(process.env.GOOGLE_TOKEN_JSON);
      creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    } else {
      const tokenPaths = [
        path.join(process.cwd(), 'token.json'),
        path.join(process.cwd(), 'sapa_bot/token.json'),
        path.join(__dirname, '../../../sapa_bot/token.json')
      ];
      const credsPaths = [
        path.join(process.cwd(), 'credentials.json'),
        path.join(process.cwd(), 'sapa_bot/credentials.json'),
        path.join(__dirname, '../../../sapa_bot/credentials.json')
      ];

      const tPath = tokenPaths.find(p => fs.existsSync(p));
      const cPath = credsPaths.find(p => fs.existsSync(p));

      if (tPath && cPath) {
        tokens = JSON.parse(fs.readFileSync(tPath, 'utf8'));
        creds = JSON.parse(fs.readFileSync(cPath, 'utf8'));
      }
    }

    if (tokens && creds) {
      if (tokens.token && !tokens.access_token) {
        tokens.access_token = tokens.token;
      }

      const config = creds.installed || creds.web;
      const { client_id, client_secret, redirect_uris } = config;
      const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris ? redirect_uris[0] : 'http://localhost'
      );
      oAuth2Client.setCredentials(tokens);
      return oAuth2Client;
    }
  } catch (e) {
    console.error('Google Auth Error:', e.message);
  }
  return null;
}

// 1. СТ Кестесін алу (КУРАТОРҒА ТЕК ӨЗ ДЕРЕКТЕРІ КӨРІНЕДІ)
router.get('/', auth, async (req, res) => {
  const { subject, streamId, monthNum, weekNum } = req.query;

  // Егер куратор болса, оның өз пәні мен ағымын аламыз
  const isCurator = req.user.role === 'curator';
  const subj = isCurator ? req.user.subject : (subject || 'ФИЗ');
  const strId = isCurator ? req.user.streamId : (streamId || '01');
  const mNum = parseInt(monthNum) || 1;
  const wNum = parseInt(weekNum) || 1;

  try {
    // 1. Ағымдағы белсенді кураторларды СТ-ға авто-синхронизация жасау
    const activeCurators = await pool.query(
      `SELECT * FROM curators 
       WHERE subject = $1 AND (stream_id = $2 OR stream_id IS NULL OR stream_id = '') AND status = 'active'`,
      [subj, strId]
    );

    const existingSt = await pool.query(
      `SELECT curator_name FROM st_recordings 
       WHERE subject = $1 AND (stream_id = $2 OR month_id = $2) AND (month_num = $3::int OR month_id = $3::text) AND week_num = $4`,
      [subj, strId, mNum, wNum]
    );
    const existingNames = existingSt.rows.map(r => r.curator_name);

    for (const cur of activeCurators.rows) {
      if (cur.full_name && !existingNames.includes(cur.full_name)) {
        await pool.query(
          `INSERT INTO st_recordings (curator_id, subject, stream_id, month_num, month_id, week_num, curator_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [cur.id, subj, strId, mNum, strId, wNum, cur.full_name]
        );
      }
    }

    // 2. Сұранысты жіберу: Куратор болса ТЕК ӨЗІНІҢ атымен сүзеді!
    let query = `SELECT * FROM st_recordings WHERE subject = $1 AND (stream_id = $2 OR month_id = $2) AND (month_num = $3::int OR month_id = $3::text) AND week_num = $4`;
    let params = [subj, strId, mNum, wNum];

    if (isCurator) {
      query += ` AND (curator_name = $5 OR curator_id = $6)`;
      params.push(req.user.fullName, req.user.id);
    }

    query += ` ORDER BY id ASC`;
    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'База қатесі: ' + err.message });
  }
});

// 2. Жаңа куратор қосу
router.post('/curator', auth, async (req, res) => {
  const { subject, streamId, monthNum, weekNum, curatorName } = req.body;
  if (!curatorName || !subject) {
    return res.status(400).json({ error: 'Ақпарат толық емес' });
  }
  try {
    const strId = streamId || '01';

    const curCheck = await pool.query(
      `SELECT id FROM curators WHERE full_name = $1 AND subject = $2 AND stream_id = $3`,
      [curatorName, subject, strId]
    );

    let curId;
    if (curCheck.rows.length === 0) {
      const curRes = await pool.query(
        `INSERT INTO curators (full_name, subject, stream_id, status)
         VALUES ($1, $2, $3, 'active') RETURNING *`,
        [curatorName, subject, strId]
      );
      curId = curRes.rows[0].id;
    } else {
      curId = curCheck.rows[0].id;
    }

    const result = await pool.query(
      `INSERT INTO st_recordings (curator_id, subject, stream_id, month_num, month_id, week_num, curator_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [curId, subject, strId, parseInt(monthNum) || 1, strId, parseInt(weekNum) || 1, curatorName]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Қосу қатесі: ' + err.message });
  }
});

// 3. Google Meet Сілтемесін жасау
router.post('/create-meet', auth, async (req, res) => {
  const { recordingId, curatorName, subject } = req.body;
  const authClient = getGoogleAuth(subject);

  if (!authClient) {
    return res.status(400).json({ error: 'Google авторизация кілттері табылмады' });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + 3600000).toISOString();

    const event = {
      summary: `СТ: ${subject || 'ПӘН'} - ${curatorName || ''}`,
      description: 'JUZ40 - Сабақ Тапсыру Миті',
      start: { dateTime: startTime },
      end: { dateTime: endTime },
      conferenceData: {
        createRequest: {
          requestId: `st-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    const createdEvent = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1
    });

    const meetLink = createdEvent.data.hangoutLink;
    const meetCode = meetLink ? meetLink.split('/').pop() : null;

    const rec = await pool.query('SELECT * FROM st_recordings WHERE id = $1', [recordingId]);
    const current = rec.rows[0];

    const meetCodes = current.meet_codes || (current.meet_code ? [current.meet_code] : []);
    const meetLinks = current.meet_links || (current.meet_link ? [current.meet_link] : []);

    meetCodes.push(meetCode);
    meetLinks.push(meetLink);

    const updated = await pool.query(
      `UPDATE st_recordings 
       SET meet_link = $1, meet_code = $2, 
           meet_codes = $3, meet_links = $4, 
           updated_at = NOW() 
       WHERE id = $5 RETURNING *`,
      [meetLink, meetCode, meetCodes, meetLinks, recordingId]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Meet жасау қатесі: ' + err.message });
  }
});

// 4. Драйвтан ВИДЕО мен ОТСЛЕЖКА-ны Табу
router.post('/sync-drive', auth, async (req, res) => {
  const { recordingId, meetCode } = req.body;

  const rec = await pool.query('SELECT * FROM st_recordings WHERE id = $1', [recordingId]);
  if (!rec.rows.length) return res.status(404).json({ error: 'Жол табылмады' });

  const record = rec.rows[0];
  const targetCode = meetCode || record.meet_code;

  const authClient = getGoogleAuth(record.subject);
  if (!authClient) {
    return res.status(400).json({ error: 'Google авторизация кілттері табылмады' });
  }

  try {
    const drive = google.drive({ version: 'v3', auth: authClient });

    const query = `name contains '${targetCode}' and trashed = false`;

    const driveRes = await drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink, mimeType, createdTime)',
      orderBy: 'createdTime desc'
    });

    const files = driveRes.data.files || [];
    let videoLink = null;
    let attendanceLink = null;

    files.forEach(f => {
      const lowerName = (f.name || '').toLowerCase();
      const mime = (f.mimeType || '').toLowerCase();
      const link = f.webViewLink || '';

      const isVideo = mime.startsWith('video/') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mkv');
      const isAttendance = mime.includes('spreadsheet') || mime.includes('document') || mime.includes('pdf') || lowerName.includes('расшифровка') || lowerName.includes('отслежка');

      if (isVideo) videoLink = link;
      else if (isAttendance) attendanceLink = link;
    });

    const vLinks = record.video_links || (record.video_link ? [record.video_link] : []);
    const aLinks = record.attendance_links || (record.attendance_link ? [record.attendance_link] : []);

    if (videoLink && !vLinks.includes(videoLink)) vLinks.push(videoLink);
    if (attendanceLink && !aLinks.includes(attendanceLink)) aLinks.push(attendanceLink);

    const updated = await pool.query(
      `UPDATE st_recordings 
       SET video_link = COALESCE($1, video_link), 
           attendance_link = COALESCE($2, attendance_link), 
           video_links = $3, 
           attendance_links = $4, 
           updated_at = NOW() 
       WHERE id = $5 RETURNING *`,
      [videoLink, attendanceLink, vLinks, aLinks, recordingId]
    );

    res.json({ success: true, record: updated.rows[0], foundCount: files.length });
  } catch (err) {
    res.status(500).json({ error: 'Драйв іздеу қатесі: ' + err.message });
  }
});

// 5. Өрістерді жаңарту
router.put('/:id', auth, async (req, res) => {
  const { studentsCount, notes } = req.body;
  try {
    const updated = await pool.query(
      `UPDATE st_recordings 
       SET students_count = COALESCE($1, students_count), 
           notes = COALESCE($2, notes), 
           updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [studentsCount, notes, req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Өшіру
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM st_recordings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;