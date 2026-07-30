const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { google } = require('googleapis');

// Пән коды (кириллица) -> ортам айнымалысының ASCII жалғауы,
// мыс. GOOGLE_SERVICE_ACCOUNT_JSON_FIZ / GOOGLE_TOKEN_JSON_FIZ
const SUBJECT_ENV_KEY = {
  ФИЗ: 'FIZ', МАТ: 'MAT', ТІЛ: 'TIL', БИО: 'BIO', ИНФО: 'INFO', ГЕО: 'GEO',
  ТАРИХ: 'TARIH', РУС: 'RUS', ХИМ: 'HIM', МС: 'MS', ӘДЕБ: 'ADEB', АНГЛ: 'ANGL', ДЖТ: 'DZHT',
};

const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/drive'];

// Пәннің ӨЗ домен аккаунты болмаса — null қайтарады (алдыңғы нұсқада сапа
// бөлімінің ортақ аккаунтына түсіп кете беретін еді, ол дұрыс емес: сапа
// бөлімінің есептік жазбасы басқа пәннің атынан Мит ашпауы керек).
// Пән өз аккаунтын алғанша, сол пәннің кураторлары "Мит ашу" баса алмайды —
// бұл әдейі істелген тежеу, қате хабарламасы соны түсіндіреді.
function getGoogleAuth(subject) {
  try {
    const envKey = subject && SUBJECT_ENV_KEY[subject];
    if (!envKey) return null;

    const saJson = process.env[`GOOGLE_SERVICE_ACCOUNT_JSON_${envKey}`];
    if (saJson) {
      const sa = JSON.parse(saJson);
      return new google.auth.JWT({
        email: sa.client_email,
        key: sa.private_key,
        scopes: SCOPES,
      });
    }

    const tokenJson = process.env[`GOOGLE_TOKEN_JSON_${envKey}`];
    const credsJson = process.env[`GOOGLE_CREDENTIALS_JSON_${envKey}`];
    if (tokenJson && credsJson) {
      const tokens = JSON.parse(tokenJson);
      const creds = JSON.parse(credsJson);
      if (tokens.token && !tokens.access_token) tokens.access_token = tokens.token;

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
      // curator_id — curators.id-ге сілтейді, ал req.user.id — users.id (JWT).
      // Бұларды тікелей салыстыруға болмайды: curators.user_id арқылы
      // req.user.id-ге сәйкес келетін curators.id жиынын тауып барып салыстырамыз.
      query += ` AND (curator_name = $5 OR curator_id IN (SELECT id FROM curators WHERE user_id = $6))`;
      params.push(req.user.fullName, req.user.id);
    }

    query += ` ORDER BY id ASC`;
    const result = await pool.query(query, params);
    const rows = result.rows;

    // 3. Әр жолға өз bookings-ін (бекітілген уақыттарын) тіркеу — календарь
    // осыны қолданып блок ретінде салады.
    if (rows.length) {
      const ids = rows.map(r => r.id);
      const bookingsRes = await pool.query(
        `SELECT * FROM st_bookings WHERE recording_id = ANY($1::int[]) ORDER BY scheduled_date ASC, start_time ASC`,
        [ids]
      );
      const byRecording = {};
      bookingsRes.rows.forEach(b => {
        (byRecording[b.recording_id] ||= []).push(b);
      });
      rows.forEach(r => { r.bookings = byRecording[r.id] || []; });
    }

    res.json(rows);
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

// 3. Куратор бекіткен уақытқа Google Meet жасау (СТ немесе жеке сөйлесу).
// Бұрынғы бір батырмамен "қазір" Мит ашатын /create-meet-тің орнын алды —
// енді curator таңдаған scheduledDate/startTime/endTime-ге сай event жасалады.
router.post('/:id/bookings', auth, async (req, res) => {
  const recordingId = req.params.id;
  const { meetingType, studentsCount, scheduledDate, startTime, endTime } = req.body;

  if (!scheduledDate || !startTime || !endTime) {
    return res.status(400).json({ error: 'Күн мен уақыт аралығы міндетті' });
  }

  const rec = await pool.query('SELECT * FROM st_recordings WHERE id = $1', [recordingId]);
  if (!rec.rows.length) return res.status(404).json({ error: 'Жол табылмады' });
  const record = rec.rows[0];

  const authClient = getGoogleAuth(record.subject);
  if (!authClient) {
    return res.status(400).json({ error: 'Google авторизация кілттері табылмады' });
  }

  const type = meetingType === 'personal' ? 'personal' : 'st';

  try {
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    // "СТ: <пән> - <куратор аты>" форматы sync-drive-тың Drive іздеуімен
    // сәйкес болуы міндетті (attendance/video файлдарды осы атаумен табады) —
    // өзгертпеу керек. Жеке сөйлесу — бөлек, sync-drive-қа қатысы жоқ.
    const summary = type === 'personal'
      ? `Жеке сөйлесу: ${record.subject} - ${record.curator_name}`
      : `СТ: ${record.subject} - ${record.curator_name}`;

    const event = {
      summary,
      description: 'JUZ40 - Сабақ Тапсыру Миті',
      start: { dateTime: `${scheduledDate}T${startTime}:00` },
      end: { dateTime: `${scheduledDate}T${endTime}:00` },
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

    const inserted = await pool.query(
      `INSERT INTO st_bookings
        (recording_id, meeting_type, students_count, scheduled_date, start_time, end_time, meet_link, meet_code, calendar_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [recordingId, type, type === 'st' ? (studentsCount || '0') : null, scheduledDate, startTime, endTime, meetLink, meetCode, createdEvent.data.id]
    );

    res.json(inserted.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Meet жасау қатесі: ' + err.message });
  }
});

// 3b. Броньды өшіру (Calendar event-ті де өшіруге тырысады — best-effort,
// сәтсіз болса да жол өшіріле береді, куратор оны қайта көрмеуі маңыздырақ)
router.delete('/bookings/:bookingId', auth, async (req, res) => {
  try {
    const bookingRes = await pool.query(
      `SELECT b.*, r.subject FROM st_bookings b
       JOIN st_recordings r ON r.id = b.recording_id
       WHERE b.id = $1`,
      [req.params.bookingId]
    );
    if (!bookingRes.rows.length) return res.status(404).json({ error: 'Бронь табылмады' });
    const booking = bookingRes.rows[0];

    const authClient = getGoogleAuth(booking.subject);
    if (authClient && booking.calendar_event_id) {
      try {
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        await calendar.events.delete({ calendarId: 'primary', eventId: booking.calendar_event_id });
      } catch (calErr) {
        console.error('Calendar event өшіру қатесі:', calErr.message);
      }
    }

    await pool.query('DELETE FROM st_bookings WHERE id = $1', [req.params.bookingId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Драйвтан ВИДЕО мен ОТСЛЕЖКА-ны Табу
router.post('/sync-drive', auth, async (req, res) => {
  const { recordingId } = req.body;

  const rec = await pool.query('SELECT * FROM st_recordings WHERE id = $1', [recordingId]);
  if (!rec.rows.length) return res.status(404).json({ error: 'Жол табылмады' });

  const record = rec.rows[0];

  const authClient = getGoogleAuth(record.subject);
  if (!authClient) {
    return res.status(400).json({ error: 'Google авторизация кілттері табылмады' });
  }

  try {
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Осы куратордың КЕЛЕСІ аптасының жолы бар ма — болса, іздеуді содан
    // бұрынғымен шектейміз, әйтпесе кейінгі апталардың жазбасын да қосып алар едік.
    const nextRow = await pool.query(
      `SELECT created_at FROM st_recordings
       WHERE subject = $1 AND stream_id = $2 AND curator_name = $3
         AND (month_num, week_num) > ($4, $5)
       ORDER BY month_num ASC, week_num ASC LIMIT 1`,
      [record.subject, record.stream_id, record.curator_name, record.month_num, record.week_num]
    );

    // Google Meet жазба/отслежка файлдарын Drive-та Мит кодымен емес,
    // күнтізбе оқиғасының атауымен сақтайды (create-meet-тегі event.summary-мен
    // бірдей: "СТ: <пән> - <куратор аты>"), сондықтан іздеу де сол атау
    // бойынша болады. Датамен шектеу — сол атаумен басқа аптада ашылған
    // Мит-тің жазбасын осы аптаға жаңылыстырып жаппас үшін.
    const searchText = `СТ: ${record.subject} - ${record.curator_name}`.replace(/'/g, "\\'");
    let query = `name contains '${searchText}' and trashed = false and createdTime > '${record.created_at.toISOString()}'`;
    if (nextRow.rows.length) {
      query += ` and createdTime < '${nextRow.rows[0].created_at.toISOString()}'`;
    }

    const driveRes = await drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink, mimeType, createdTime)',
      orderBy: 'createdTime desc'
    });

    const files = driveRes.data.files || [];
    const vLinks = record.video_links || (record.video_link ? [record.video_link] : []);
    const aLinks = record.attendance_links || (record.attendance_link ? [record.attendance_link] : []);
    const newFiles = [];

    // Осы аптада бірнеше Мит ашылған болуы мүмкін (мыс. алғашқысына толық
    // кірмей, "+ Жаңа Мит" басылса) — сондықтан бір ғана емес, осы уақыт
    // аралығында табылған БАРЛЫҚ видео/отслежка файлын жинаймыз.
    //
    // Отслежка — нақты ҚАТЫСУ ЕСЕБІ (Google Sheets), Gemini жасайтын жалпы
    // қорытынды құжат (Google Docs) емес, сондықтан тек spreadsheet-ті
    // санаймыз.
    files.forEach(f => {
      const mime = (f.mimeType || '').toLowerCase();
      const lowerName = (f.name || '').toLowerCase();
      const link = f.webViewLink || '';
      if (!link) return;

      const isVideo = mime.startsWith('video/') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mkv');
      const isAttendance = mime.includes('spreadsheet');

      if (isVideo && !vLinks.includes(link)) { vLinks.push(link); newFiles.push(f); }
      else if (isAttendance && !aLinks.includes(link)) { aLinks.push(link); newFiles.push(f); }
    });

    // Жаңадан табылған файлдар әдепкіде тек оны жасаған Google аккаунтқа
    // ғана көрінеді — сілтемесі барға ашық қыламыз, әйтпесе қолданушылар
    // "Access denied" көреді. Бір файлдың рұқсаты орнамай қалса да қалғаны
    // сақталуы үшін қатені жұтамыз, тек логқа жазамыз.
    for (const f of newFiles) {
      try {
        await drive.permissions.create({
          fileId: f.id,
          requestBody: { role: 'reader', type: 'anyone' },
        });
      } catch (permErr) {
        console.error(`Drive рұқсат қатесі (${f.id}):`, permErr.message);
      }
    }

    const updated = await pool.query(
      `UPDATE st_recordings
       SET video_link = COALESCE($1, video_link),
           attendance_link = COALESCE($2, attendance_link),
           video_links = $3,
           attendance_links = $4,
           updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [vLinks[0] || null, aLinks[0] || null, vLinks, aLinks, recordingId]
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