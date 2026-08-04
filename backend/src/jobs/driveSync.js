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

  // Іздеу шекарасы — МИТ АШЫЛҒАН нақты уақыт (st_bookings.created_at), жолдың
  // өз created_at-ы емес. st_recordings жолдары кесте беті ашылған сәтте
  // автоматты жасалады, сондықтан куратор/әкімші келесі апталарды бір рет
  // қарап шықса, сол апталардың жолдары ерте жасалып қалады да, "келесі жол"
  // шекарасы осы аптаның жазбасын кесіп тастайтын. Мит ашылған уақыт —
  // шынайы хронология, оны бет ашу бұзбайды.
  const bounds = await pool.query(
    `SELECT
       (SELECT MIN(created_at) FROM st_bookings
         WHERE recording_id = $6 AND meeting_type = 'st') AS lower_at,
       (SELECT MIN(b.created_at) FROM st_bookings b
          JOIN st_recordings r2 ON r2.id = b.recording_id
         WHERE r2.subject = $1 AND r2.stream_id = $2 AND r2.curator_name = $3
           AND (r2.month_num, r2.week_num) > ($4, $5)
           AND b.meeting_type = 'st') AS upper_at`,
    [record.subject, record.stream_id, record.curator_name, record.month_num, record.week_num, record.id]
  );
  const { lower_at: lowerAt, upper_at: upperAt } = bounds.rows[0];

  // Мит әлі ашылмаған болса, жолдың жасалу уақытына қайта түсеміз.
  let from = lowerAt || record.created_at;

  // Жүйе іске қосылғанға дейінгі сынақ жазбалары Drive-та жатыр. Жолда
  // бронь болмаса, жоғарыдағы қайта түсу оларға дейін жетіп қалады —
  // сондықтан ешқашан осы күннен ары қарамаймыз.
  if (process.env.DRIVE_SYNC_NOT_BEFORE) {
    const floor = new Date(process.env.DRIVE_SYNC_NOT_BEFORE);
    if (!isNaN(floor) && floor > from) from = floor;
  }

  // Мит календарь оқиғасынан ашылса, жазба оқиға атымен ("СТ: ФИЗ - Аты")
  // сақталады. Ал куратор сол сілтемеге кейін бөлек кіріп жазса, Google оны
  // Мит КОДЫМЕН атайды: "zym-uyzm-sen (2026-08-03 19:40 GMT+5)". Тек атауды
  // іздесек, бір Миттің екінші-үшінші жазбасы табылмай қалады — сондықтан
  // осы жолдың барлық meet_code-ы да іздеуге қосылады.
  const codesRes = await pool.query(
    `SELECT DISTINCT meet_code FROM st_bookings
      WHERE recording_id = $1 AND meet_code IS NOT NULL AND meet_code <> ''`,
    [record.id]
  );
  const esc = (s) => String(s).replace(/'/g, "\\'");
  const nameClauses = [`name contains '${esc(`СТ: ${record.subject} - ${record.curator_name}`)}'`]
    .concat(codesRes.rows.map(r => `name contains '${esc(r.meet_code)}'`));

  let query = `(${nameClauses.join(' or ')}) and trashed = false and createdTime > '${from.toISOString()}'`;
  if (upperAt) {
    query += ` and createdTime < '${upperAt.toISOString()}'`;
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

// Мит ашылғанына 14 күн болмаған, бірақ видео/отслежкасы әлі толық
// жиналмаған жолдарды автоматты синхрондайды. Куратор "Синхрондау"
// батырмасын өзі баспайды — жазба Drive-қа шыққан сайын осы job оны келесі
// айналымда (ең көбі 30 мин ішінде) тауып алады.
//
// Шарт booking-тің scheduled_date-іне ЕМЕС, created_at-іне қойылады.
// scheduled_date "1-ай 2-апта" деген абстракт фильтрден шығады да, нақты
// күнтізбемен байланыспайды: болашақ аптаға бекітілген Мит бүгін өтуі де,
// өткен аптаның Миті кеше өтуі де мүмкін. Күнге қарасақ, ондай жолдар
// ешқашан кезекке ілікпейді — жазба Drive-та тұрса да сайтта шықпайды.
const AUTO_SYNC_LOOKBACK = '14 days';

async function runAutoSync() {
  let candidates;
  try {
    const res = await pool.query(`
      SELECT DISTINCT r.* FROM st_recordings r
      JOIN st_bookings b ON b.recording_id = r.id
      WHERE b.meeting_type = 'st'
        AND b.created_at >= NOW() - INTERVAL '${AUTO_SYNC_LOOKBACK}'
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
