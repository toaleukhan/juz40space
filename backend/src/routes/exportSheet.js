const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Сапа бөлімінің "SMART | СТ ЗАПИСЬ" кестесі осы эндпойнттен оқиды
// (Google Apps Script арқылы). Ол — браузер емес, сондықтан JWT-мен кіре
// алмайды: орнына EXPORT_TOKEN ортам айнымалысындағы тұрақты кілт.
//
// Тек ОҚУ үшін. Кестедегі жолдарды жасамайды да, өзгертпейді де —
// сұралған аптада жазба жоқ болса, жай ғана бос тізім қайтады.

function tokenOk(req) {
  const expected = process.env.EXPORT_TOKEN;
  if (!expected) return false;
  const given = req.get('X-Export-Token') || req.query.token || '';
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  // Ұзындығы әртүрлі болса timingSafeEqual қате лақтырады — алдын аламыз,
  // бірақ салыстырудың өзі әрқашан тұрақты уақытпен жүреді.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

router.get('/st', async (req, res) => {
  if (!process.env.EXPORT_TOKEN) {
    return res.status(503).json({ error: 'Экспорт өшірулі: EXPORT_TOKEN қойылмаған' });
  }
  if (!tokenOk(req)) {
    return res.status(401).json({ error: 'Кілт дұрыс емес' });
  }

  const subject = String(req.query.subject || '').trim();
  const streamId = String(req.query.streamId || '01').trim();
  const monthNum = parseInt(req.query.monthNum, 10);
  const weekNum = parseInt(req.query.weekNum, 10);

  if (!subject || !monthNum || !weekNum) {
    return res.status(400).json({ error: 'subject, monthNum, weekNum міндетті' });
  }

  try {
    const result = await pool.query(
      `SELECT id, curator_name, students_count, notes, video_links, attendance_links,
              video_link, attendance_link
         FROM st_recordings
        WHERE subject = $1 AND (stream_id = $2 OR month_id = $2)
          AND (month_num = $3::int OR month_id = $3::text) AND week_num = $4
        ORDER BY id ASC`,
      [subject, streamId, monthNum, weekNum]
    );

    // Сілтемелер жалпақ тізіммен беріледі: кестеде олар бір ұяшықтың ішінде
    // "запись 1", "запись 2" деп аталған сілтемелерге айналады (ҮЛГІ бетіндегі
    // үлгі бойынша), сондықтан бірінші/қалғаны деп бөлудің қажеті жоқ.
    const rows = result.rows.map(r => {
      const videos = r.video_links?.length ? r.video_links : (r.video_link ? [r.video_link] : []);
      const attendance = r.attendance_links?.length ? r.attendance_links : (r.attendance_link ? [r.attendance_link] : []);
      return {
        curatorName: r.curator_name,
        studentsCount: r.students_count || '',
        notes: r.notes || '',
        videos,
        attendance,
      };
    });

    res.json({ subject, streamId, monthNum, weekNum, rows });
  } catch (err) {
    res.status(500).json({ error: 'База қатесі: ' + err.message });
  }
});

module.exports = router;
