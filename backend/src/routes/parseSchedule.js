const express = require('express');
const router = express.Router();
const AdmZip = require('adm-zip');
const { logAction } = require('../utils/audit');

const DAYS_MAP = {
  'ДҮЙСЕНБІ': 'Дүйсенбі',
  'СЕЙСЕНБІ': 'Сейсенбі',
  'СӘРСЕНБІ': 'Сәрсенбі',
  'БЕЙСЕНБІ': 'Бейсенбі',
  'ЖҰМА':     'Жұма',
  'СЕНБІ':    'Сенбі',
};

// Extract rows from docx XML without external XML parser
function extractTableFromDocx(buffer) {
  const zip = new AdmZip(buffer);
  const xml = zip.readAsText('word/document.xml');

  const rows = [];
  const trRe = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
  const tcRe = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
  const tRe  = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;

  let trMatch;
  while ((trMatch = trRe.exec(xml)) !== null) {
    const row = [];
    let tcMatch;
    const tcLocal = new RegExp(tcRe.source, 'g');
    while ((tcMatch = tcLocal.exec(trMatch[0])) !== null) {
      const lines = [];
      let tMatch;
      const tLocal = new RegExp(tRe.source, 'g');
      while ((tMatch = tLocal.exec(tcMatch[0])) !== null) {
        const t = tMatch[1].trim();
        if (t) lines.push(t);
      }
      // Merge lines that are partial time strings (e.g. "13:00-14:0014:10-15:10")
      const merged = [];
      for (const line of lines) {
        // Split merged times: e.g. "13:00-14:0014:10-15:10"
        const splitTimes = line.replace(/(\d{2}:\d{2})(\d{2}:\d{2})/g, '$1\n$2');
        splitTimes.split('\n').forEach(l => { if (l.trim()) merged.push(l.trim()); });
      }
      row.push(merged);
    }
    rows.push(row);
  }
  return rows;
}

// Detect if a string looks like a stream code: e.g. "Т-01", "МС-01", "МАТ-01"
function isStream(s) {
  return /^[А-ЯӘІҰҮӨҒҚҢШЙa-z]+-\d+$/i.test(s.trim());
}

// Detect if a string is a time slot: "13:00-14:00" or "13:00–14:00"
function isTime(s) {
  return /^\d{1,2}:\d{2}[-–]/.test(s.trim());
}

// Normalize time: "13:00-14:00" → "13:00–14:00"
function normTime(s) {
  return s.replace(/-/g, '–').trim();
}

// Parse cell lines into lessons array
function parseCell(lines, subject) {
  if (!lines || !lines.length) return null;

  // If cell is just "—" or empty dash variants
  const joined = lines.join('').replace(/—|-/g, '').trim();
  if (!joined) return null;

  const lessons = [];
  let curStream = '';
  let curTeacher = null;
  let curTeachers = [];

  const flush = () => {
    if (curTeacher) { curTeachers.push(curTeacher); curTeacher = null; }
    if (curStream || curTeachers.length) {
      lessons.push({ stream: curStream, teachers: curTeachers });
      curTeachers = [];
      curStream = '';
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === '—') continue;

    if (isStream(line)) {
      // New stream block — flush previous
      if (curTeacher) { curTeachers.push(curTeacher); curTeacher = null; }
      if (curTeachers.length || curStream) {
        lessons.push({ stream: curStream, teachers: curTeachers });
        curTeachers = [];
      }
      curStream = line;
    } else if (isTime(line)) {
      if (curTeacher) curTeacher.times.push(normTime(line));
    } else {
      // Teacher name
      if (curTeacher) curTeachers.push(curTeacher);
      curTeacher = { name: line, times: [] };
    }
  }
  flush();

  if (!lessons.length) return null;
  return lessons.map(l => ({ subject, stream: l.stream, teachers: l.teachers }));
}

// Build schedule from table rows
function buildSchedule(rows) {
  if (!rows.length) return [];

  // Row 0: ПӘН | ДҮЙСЕНБІ | СЕЙСЕНБІ | ...
  const header = rows[0];
  const dayNames = header.slice(1).map(cell => DAYS_MAP[cell.join('').toUpperCase()] || cell.join(''));

  // Collect all lessons by day
  const byDay = {};
  dayNames.forEach(d => { byDay[d] = []; });

  for (let ri = 1; ri < rows.length; ri++) {
    const row = rows[ri];
    const subject = row[0]?.join('').trim();
    if (!subject) continue;

    for (let ci = 1; ci < row.length; ci++) {
      const day = dayNames[ci - 1];
      if (!day) continue;
      const lessons = parseCell(row[ci], subject);
      if (lessons) byDay[day].push(...lessons);
    }
  }

  // Build final array, skip empty days
  return Object.entries(byDay)
    .filter(([, lessons]) => lessons.length > 0)
    .map(([day, lessons]) => ({ day, lessons }));
}

// POST /api/parse-schedule
// Body: { base64: string, direction: string, monthId: string }
router.post('/', async (req, res) => {
  const { base64, direction, monthId } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 міндетті' });

  try {
    const buffer = Buffer.from(base64, 'base64');
    const rows   = extractTableFromDocx(buffer);
    const schedule = buildSchedule(rows);

    if (!schedule.length) {
      return res.status(422).json({ error: 'Кесте табылмады — файл форматы қате болуы мүмкін' });
    }

    // Render as JS code string
    const jsCode = renderJS(schedule, direction, monthId);

    const days = schedule.length;
    const teachers = schedule.reduce((a, d) =>
      a + d.lessons.reduce((b, l) => b + l.teachers.length, 0), 0);

    await logAction(req.curatorId, 'schedule_parse', 'parse_schedule', { direction, monthId, days, teachers });
    res.json({ result: jsCode, days, teachers });
  } catch (err) {
    console.error('parseSchedule error:', err);
    res.status(500).json({ error: 'Файл оқылмады: ' + err.message });
  }
});

function qq(s) { return JSON.stringify(s); }

function renderJS(schedule, direction, monthId) {
  const lines = [];
  lines.push(`// JUZ40 — ${direction}, ай: ${monthId}`);
  lines.push(`// scheduleData.js ішіндегі сәйкес айға қойыңыз\n`);
  lines.push(`[`);
  for (const day of schedule) {
    lines.push(`  {`);
    lines.push(`    day: ${qq(day.day)},`);
    lines.push(`    lessons: [`);
    for (const ls of day.lessons) {
      const teachersStr = ls.teachers.map(t => {
        const times = t.times.map(qq).join(', ');
        return `{ name: ${qq(t.name)}, times: [${times}] }`;
      }).join(', ');
      lines.push(`      { subject: ${qq(ls.subject)}, stream: ${qq(ls.stream)}, teachers: [${teachersStr}] },`);
    }
    lines.push(`    ],`);
    lines.push(`  },`);
  }
  lines.push(`]`);
  return lines.join('\n');
}

module.exports = router;
