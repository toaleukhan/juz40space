const { google } = require('googleapis');
const pool = require('../config/db');
const { getGoogleAuth } = require('../utils/googleAuth');

// Драйвтан бір st_recordings жолы үшін ВИДЕО мен ОТСЛЕЖКА-ны тауып,
// video_links/attendance_links бағандарына қосады. Бұрын /sync-drive
// эндпоинтінде тек қолмен "Синхрондау" батырмасы басылғанда ғана шақырылатын
// — енді осы функцияны scheduler (runAutoSync) те, эндпоинттің өзі де қолданады.
async function syncRecordDrive(record) {
  const authClient = getGoogleAuth(record.subject);
  if (!authClient) return { synced: false, reason: 'no-auth' };

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
    [vLinks[0] || null, aLinks[0] || null, vLinks, aLinks, record.id]
  );

  return { synced: true, foundCount: files.length, record: updated.rows[0] };
}

const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 минут сайын

// Соңғы 3 күнде СТ бекітілген (booking) жолдардың ішінен видео/отслежка әлі
// толық жиналмағандарын таңдап, автоматты синхрондайды. Куратор енді
// "Синхрондау" батырмасын өзі баспайды — жазба Drive-қа шыққан сайын осы
// job оны келесі айналымда (ең көбі 30 мин ішінде) тауып алады.
async function runAutoSync() {
  let candidates;
  try {
    const res = await pool.query(`
      SELECT DISTINCT r.* FROM st_recordings r
      JOIN st_bookings b ON b.recording_id = r.id
      WHERE b.meeting_type = 'st'
        AND b.scheduled_date <= CURRENT_DATE
        AND b.scheduled_date >= CURRENT_DATE - INTERVAL '3 days'
        AND (
          r.video_links IS NULL OR cardinality(r.video_links) = 0
          OR r.attendance_links IS NULL OR cardinality(r.attendance_links) = 0
        )
    `);
    candidates = res.rows;
  } catch (err) {
    console.error('Auto drive-sync: candidates сұрауы қатесі:', err.message);
    return;
  }

  for (const record of candidates) {
    try {
      await syncRecordDrive(record);
    } catch (err) {
      console.error(`Auto drive-sync: жол #${record.id} қатесі:`, err.message);
    }
  }
}

function startAutoSyncScheduler() {
  runAutoSync();
  setInterval(runAutoSync, AUTO_SYNC_INTERVAL_MS);
}

module.exports = { syncRecordDrive, runAutoSync, startAutoSyncScheduler };
