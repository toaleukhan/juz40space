#!/usr/bin/env node
// Бір реттік импорт: "SMART | СТ ЗАПИСЬ" Google Doc-та қолмен жазылған
// тарихи бағалауларды recording_reviews/review_findings/review_student_notes
// кестелеріне көшіреді.
//
// Қауіпсіздік үшін dry-run әдепкі — тек нәтижені консольге басып шығарады,
// базаға ЕШНӘРСЕ жазбайды. Шынымен жазу үшін:
//   node backend/scripts/import-review-doc.js --apply
//
// Railway-да орындау: railway run node backend/scripts/import-review-doc.js

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const SUBJECT = 'ФИЗ';
const STREAM_ID = '01';
const APPLY = process.argv.includes('--apply');

function unescapeMd(s) {
  return String(s)
    .replace(/&#10;/g, '\n')
    .replace(/\\+([*_\-.!\[\]()#])/g, '$1');
}

const LETTER_FOLD = { 'қ': 'к', 'ғ': 'г', 'ұ': 'у', 'ү': 'у', 'і': 'и', 'ң': 'н', 'ә': 'а', 'ө': 'о', 'һ': 'х' };
function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[қғұүіңәөһ]/g, (c) => LETTER_FOLD[c] || c)
    .replace(/[^a-zа-я\s]/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}
// Есімдердің сөз тәртібі (Аты Жөні / Жөні Аты), тегі-аты арасындағы
// ымыралар (толық атаулы vs қысқа) ескеріледі — sheets-apps-script.gs-тегі
// логикамен бірдей.
function sameName(a, b) {
  const na = normalizeName(a).split(' ').filter(Boolean);
  const nb = normalizeName(b).split(' ').filter(Boolean);
  if (!na.length || !nb.length) return false;
  const shared = na.filter((w) => nb.includes(w));
  return shared.length >= 2 || (shared.length >= 1 && Math.min(na.length, nb.length) === 1);
}

function driveFileId(url) {
  const m = String(url || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function parseDoc(raw) {
  const weeks = [];
  const headerRe = /^# (\d+)-АЙ\s+(\d+)-АПТА\s*$/gm;
  const matches = [...raw.matchAll(headerRe)];
  for (let i = 0; i < matches.length; i++) {
    const monthNum = Number(matches[i][1]);
    const weekNum = Number(matches[i][2]);
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    weeks.push({ monthNum, weekNum, curators: parseWeekSection(raw.slice(start, end)) });
  }
  return weeks;
}

function splitRow(line) {
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

function parseWeekSection(section) {
  const lines = section.split('\n').filter((l) => l.trim().startsWith('|'));
  const curators = [];
  for (const line of lines) {
    const cells = splitRow(line);
    if (cells.length < 2) continue;
    if (/^:-:$/.test(cells[0])) continue;
    const nameCell = unescapeMd(cells[0]);
    if (!nameCell || nameCell === '**АТЫ-ЖӨНІ**') continue;
    const middle = unescapeMd(cells[1] || '');
    if (!middle.includes('ағым:')) continue;
    curators.push({ name: nameCell, ...parseMiddleCell(middle) });
  }
  return curators;
}

// Бөлім атаулары "**Ұсыныс:**" секілді жуан қаріппен қоршалуы мүмкін —
// шекараны қоршаған "**" таңбаларымен бірге табу керек, әйтпесе алдыңғы
// бөлімнің соңында "**" қалып қояды. Кейбір жолдарда "Ұсыныс:" мүлде
// түсіп қалған (докта қолмен толтырылған қате) — сол жағдайда келесі
// табылған маркерге дейін кесеміз, әйтпесе келесі бөлімнің мәтіні
// (мыс. "ескерту жоқ") осы бөлімге сіңіп кетеді.
function findMarker(text, keyword) {
  const m = text.match(new RegExp('\\*{0,2}' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\*{0,2}'));
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

function parseMiddleCell(middle) {
  const agym = findMarker(middle, 'ағым:');
  const usynys = findMarker(middle, 'Ұсыныс:');
  const reyting = findMarker(middle, 'Рейтинг балл сәйкестігі:');
  const agymEnd = usynys ? usynys.start : (reyting ? reyting.start : middle.length);
  const usynysEnd = reyting ? reyting.start : middle.length;

  const agymText = agym ? middle.slice(agym.end, agymEnd) : '';
  const usynysText = usynys ? middle.slice(usynys.end, usynysEnd) : '';
  const reytingText = reyting ? middle.slice(reyting.end) : '';

  return {
    noIssues: /Ескерту жоқ/i.test(agymText),
    findings: parseFindings(agymText),
    videoUrls: parseVideoUrls(agymText),
    recommendation: cleanBlock(usynysText),
    students: parseStudents(reytingText),
  };
}

// "ағым:" бөлігінде кездескен БАРЛЫҚ Drive сілтемелерін жинайды — тақырып
// сілтемесі (findings-ке кірмейтін, тек "N. [text](url)" емес) де осыда
// табылады. Ескі апталардың st_recordings.video_links-і бос болғандықтан
// (Drive автосинхрондау сол кездерде болмаған), осы сілтемелер кейін
// базаға backfill етіледі — докта адам қолмен жазған, растығы белгілі.
function parseVideoUrls(text) {
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  const seen = new Set();
  const urls = [];
  let m;
  while ((m = re.exec(text))) {
    const id = driveFileId(m[1]);
    if (id && !seen.has(id)) { seen.add(id); urls.push(m[1]); }
  }
  return urls;
}

// Сақталатын мәтін өрістерінде markdown жуан қаріп синтаксисі (**) қалмауы
// керек — сирек жағдайда докта қосарланған "****" кездеседі.
function stripStars(s) {
  return String(s || '').replace(/\*+/g, '').trim();
}

function cleanBlock(s) {
  const t = stripStars(s);
  if (!t || t === '-' || /^1\.?$/.test(t)) return null;
  return t;
}

// "1.  [сілтеме мәтіні](url) сипаттама\n2.  [...](url) сипаттама" —
// нөмірленген тізім, сипаттама келесі "N." басталғанша созылады.
function parseFindings(text) {
  const re = /(\d+)\.\s*\[[^\]]*\]\(([^)]+)\)\s*/g;
  const starts = [];
  let m;
  while ((m = re.exec(text))) starts.push({ idx: m.index, contentStart: re.lastIndex, url: m[2] });

  const items = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].idx : text.length;
    const description = stripStars(text.slice(s.contentStart, end).replace(/\n+/g, ' '));
    if (!description) continue;
    const tMatch = s.url.match(/[?&]t=([\d.]+)/);
    items.push({
      url: s.url,
      timestampSeconds: tMatch ? Math.round(parseFloat(tMatch[1])) : null,
      description,
    });
  }
  return items;
}

// "1.  Аты Жөні - ескерту жоқ!\n2.  **Аты Жөні** мәтін..." түрін бөледі.
function parseStudents(text) {
  const re = /(\d+)\.\s*/g;
  const starts = [];
  let m;
  while ((m = re.exec(text))) starts.push({ idx: m.index, contentStart: re.lastIndex });

  const items = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].idx : text.length;
    const chunk = text.slice(s.contentStart, end).replace(/\n+/g, ' ').trim();
    if (!chunk) continue;

    let name, note, ok;
    const dashMatch = chunk.match(/^(.+?)\s*[-–]\s*(.+)$/);
    const boldMatch = chunk.match(/^\*+(.+?)\*+\s*(.*)$/);
    if (dashMatch) {
      name = stripStars(dashMatch[1]);
      const rest = dashMatch[2].trim();
      ok = /ескерту жоқ|талапқа сай/i.test(rest);
      note = ok ? null : stripStars(rest);
    } else if (boldMatch) {
      name = stripStars(boldMatch[1]);
      note = stripStars(boldMatch[2]) || null;
      ok = false;
    } else {
      name = stripStars(chunk);
      note = null;
      ok = true;
    }
    if (!name) continue;
    items.push({ name, ok, note });
  }
  return items;
}

async function run() {
  const raw = fs.readFileSync(path.join(__dirname, 'data/review-doc-raw.md'), 'utf8');
  const weeks = parseDoc(raw);

  let totalRows = 0, skippedEmpty = 0, matched = 0;
  let findingsInserted = 0, studentsInserted = 0, videoUnmatched = 0, videoLinksBackfilled = 0;
  const unmatchedList = [];

  for (const week of weeks) {
    const { rows: recordings } = await pool.query(
      'SELECT * FROM st_recordings WHERE subject = $1 AND stream_id = $2 AND month_num = $3 AND week_num = $4',
      [SUBJECT, STREAM_ID, week.monthNum, week.weekNum]
    );

    for (const c of week.curators) {
      totalRows++;
      const hasContent = c.noIssues || c.findings.length || c.recommendation || c.students.length;
      if (!hasContent) { skippedEmpty++; continue; }

      const rec = recordings.find((r) => sameName(r.curator_name, c.name));
      if (!rec) {
        unmatchedList.push(`${week.monthNum}-ай ${week.weekNum}-апта: "${c.name}" сайттан табылмады`);
        continue;
      }
      matched++;

      let recVideoLinks = rec.video_links?.length ? rec.video_links : (rec.video_link ? [rec.video_link] : []);
      const knownIds = new Set(recVideoLinks.map(driveFileId));
      const newUrls = c.videoUrls.filter((u) => !knownIds.has(driveFileId(u)));

      console.log(`\n[${week.monthNum}-${week.weekNum}] ${c.name} -> recording #${rec.id} (${rec.curator_name})`);
      console.log(`  no_issues=${c.noIssues} findings=${c.findings.length} students=${c.students.length} recommendation=${c.recommendation ? 'бар' : 'жоқ'}`);
      if (newUrls.length) {
        console.log(`  video_links толықтырылады (backfill): ${newUrls.length} жаңа сілтеме`);
      }

      if (!APPLY) continue;

      if (newUrls.length) {
        await pool.query(
          `UPDATE st_recordings SET video_links = COALESCE(video_links, '{}') || $1::text[] WHERE id = $2`,
          [newUrls, rec.id]
        );
        recVideoLinks = recVideoLinks.concat(newUrls);
        videoLinksBackfilled += newUrls.length;
      }

      await pool.query(
        `INSERT INTO recording_reviews (recording_id, no_issues, recommendation, source)
         VALUES ($1, $2, $3, 'doc-import')
         ON CONFLICT (recording_id) DO UPDATE
           SET no_issues = $2, recommendation = $3, source = 'doc-import', updated_at = NOW()`,
        [rec.id, c.noIssues, c.recommendation]
      );
      const { rows: [{ id: reviewId }] } = await pool.query(
        'SELECT id FROM recording_reviews WHERE recording_id = $1', [rec.id]
      );

      // Қайта импорттағанда қосарланбас үшін ескі doc-import жазбаларын тазалаймыз.
      await pool.query('DELETE FROM review_findings WHERE review_id = $1', [reviewId]);
      await pool.query('DELETE FROM review_student_notes WHERE review_id = $1', [reviewId]);

      let order = 0;
      for (const f of c.findings) {
        const fileId = driveFileId(f.url);
        const matchedUrl = recVideoLinks.find((u) => driveFileId(u) === fileId) || null;
        if (!matchedUrl) videoUnmatched++;
        await pool.query(
          `INSERT INTO review_findings (review_id, video_url, timestamp_seconds, description, order_index)
           VALUES ($1, $2, $3, $4, $5)`,
          [reviewId, matchedUrl, f.timestampSeconds, f.description, order++]
        );
        findingsInserted++;
      }

      order = 0;
      for (const s of c.students) {
        await pool.query(
          `INSERT INTO review_student_notes (review_id, student_name, ok, note, order_index)
           VALUES ($1, $2, $3, $4, $5)`,
          [reviewId, s.name, s.ok, s.note, order++]
        );
        studentsInserted++;
      }
    }
  }

  console.log('\n──────────────────────────────────────');
  console.log(`Докта жол: ${totalRows}, бос (өткізілді): ${skippedEmpty}, сәйкес табылды: ${matched}, табылмады: ${unmatchedList.length}`);
  if (unmatchedList.length) {
    console.log('\nСайттан табылмаған кураторлар:');
    unmatchedList.forEach((u) => console.log('  - ' + u));
  }
  if (APPLY) {
    console.log(`\nЖазылды: findings=${findingsInserted}, students=${studentsInserted}, video_links backfill=${videoLinksBackfilled}`);
    if (videoUnmatched) {
      console.log(`Ескерту: ${videoUnmatched} finding видео сілтемесі сол recording-тың video_links-імен сәйкес келмеді (видеосы жоқ, тек мәтіні сақталды).`);
    }
  } else {
    console.log('\n(Бұл dry-run — база өзгерген жоқ. Шынымен жазу үшін: node backend/scripts/import-review-doc.js --apply)');
  }
  await pool.end();
}

run().catch((err) => { console.error(err); process.exit(1); });
