const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

function getGoogleAuth() {
  const possibleTokenPaths = [
    path.join(__dirname, '../../../sapa_bot/token.json'),
    path.join(process.cwd(), 'token.json'),
    path.join(process.cwd(), 'sapa_bot/token.json')
  ];
  const possibleCredsPaths = [
    path.join(__dirname, '../../../sapa_bot/credentials.json'),
    path.join(process.cwd(), 'credentials.json'),
    path.join(process.cwd(), 'sapa_bot/credentials.json')
  ];

  const tokenPath = possibleTokenPaths.find(p => fs.existsSync(p));
  const credsPath = possibleCredsPaths.find(p => fs.existsSync(p));

  if (tokenPath && credsPath) {
    const tokens = JSON.parse(fs.readFileSync(tokenPath));
    const creds = JSON.parse(fs.readFileSync(credsPath));
    const config = creds.installed || creds.web;
    const { client_id, client_secret, redirect_uris } = config;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
  }
  return null;
}

// 1. Кестені алу
router.get('/', auth, async (req, res) => {
  const { subject, monthId, weekNum } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM st_recordings 
       WHERE subject = $1 AND month_id = $2 AND week_num = $3 
       ORDER BY id ASC`,
      [subject, monthId, parseInt(weekNum) || 1]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Жаңа куратор жолын қосу
router.post('/curator', auth, async (req, res) => {
  const { subject, monthId, weekNum, curatorName } = req.body;
  if (!curatorName || !subject || !monthId) {
    return res.status(400).json({ error: 'Ақпарат толық емес' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO st_recordings (subject, month_id, week_num, curator_name)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [subject, monthId, parseInt(weekNum) || 1, curatorName]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Google Meet Сілтемесін жасау ("Мит ашу")
router.post('/create-meet', auth, async (req, res) => {
  const { recordingId, curatorName, subject } = req.body;
  const authClient = getGoogleAuth();

  if (!authClient) {
    return res.status(400).json({ error: 'Google авторизация файлы (token.json) табылмады' });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + 3600000).toISOString();

    const event = {
      summary: `СТ: ${subject} - ${curatorName}`,
      description: 'JUZ40 - Автоматты жасалған Сабақ Тапсыру Миті',
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

    const updated = await pool.query(
      `UPDATE st_recordings 
       SET meet_link = $1, meet_code = $2, updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [meetLink, meetCode, recordingId]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Meet жасау қатесі: ' + err.message });
  }
});

// 4. Драйвтан видео мен отслежканы автоматты тауып сақтау
router.post('/sync-drive', auth, async (req, res) => {
  const { recordingId, meetCode } = req.body;
  if (!meetCode) return res.status(400).json({ error: 'Мит коды көрсетілмеген' });

  const authClient = getGoogleAuth();
  if (!authClient) {
    return res.status(400).json({ error: 'Google авторизация файлы табылмады' });
  }

  try {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const query = `name contains '${meetCode}' and trashed = false`;

    const driveRes = await drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink)'
    });

    const files = driveRes.data.files || [];
    let videoLink = null;
    let attendanceLink = null;

    files.forEach(f => {
      const lower = f.name.toLowerCase();
      if (lower.includes('расшифровка') || lower.includes('transcript') || lower.includes('отслежка')) {
        attendanceLink = f.webViewLink;
      } else {
        videoLink = f.webViewLink;
      }
    });

    const updated = await pool.query(
      `UPDATE st_recordings 
       SET video_link = COALESCE($1, video_link), 
           attendance_link = COALESCE($2, attendance_link), 
           updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [videoLink, attendanceLink, recordingId]
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