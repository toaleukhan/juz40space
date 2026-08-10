const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { google } = require('googleapis');

// Пән коды -> ортам айнымалысының ASCII жалғауы (stRecordings.js-тегімен бірдей)
const SUBJECT_ENV_KEY = {
  ФИЗ: 'FIZ', МАТ: 'MAT', ТІЛ: 'TIL', БИО: 'BIO', ИНФО: 'INFO', ГЕО: 'GEO',
  ТАРИХ: 'TARIH', РУС: 'RUS', ХИМ: 'HIM', МС: 'MS', ӘДЕБ: 'ADEB', АНГЛ: 'ANGL', ДЖТ: 'DZHT',
};

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// Мит/Драйв — пән доменінің өз ісі, ал Sheets/дэшборд деректерімен жұмыс
// толығымен Сапа бөлімінің құзырында. Сондықтан пәнге қарамастан барлық
// дэшборд-кестені БІР ҒАНА Сапа бөлімінің сервис-аккаунты (GOOGLE_SERVICE_
// ACCOUNT_JSON_SAPA) оқиды — әр пәннің дэшборд-кестесіне осы аккаунттың
// email-ін Viewer ретінде қосу керек, пән доменінің аккаунтын емес.
function getSapaAuth() {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_SAPA;
  if (!saJson) return null;
  try {
    const sa = JSON.parse(saJson);
    return new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: SCOPES });
  } catch (e) {
    console.error('Sheets Auth Error:', e.message);
    return null;
  }
}

function getSheetId(subject) {
  const envKey = subject && SUBJECT_ENV_KEY[subject];
  if (!envKey) return null;
  return process.env[`DASHBOARD_SHEET_ID_${envKey}`] || null;
}

const isBlank = (v) => {
  const s = (v === undefined || v === null) ? '' : v.toString().trim();
  return !s || s === '-' || s.startsWith('#');
};

// "АЙЛЫҚ КӨРСЕТКІШТЕР" парағын кураторлар бойынша құрылымдалған JSON-ға
// айналдырады. Апта-блоктардың саны бекітілмеген (сынақ кестесінде 3 болды,
// нақты кестеде көбірек болуы мүмкін) — 2-жолдағы (ПФ/СТ/ОРТАҚ) тақырыпшалар
// таусылғанша D бағанынан бастап 3 баған сайын динамикалық оқылады.
function parseMonthlySheet(rows) {
  if (!rows || rows.length < 3) return { weeks: [], curators: [] };

  const weekHeaderRow = rows[0] || [];
  const subHeaderRow = rows[1] || [];

  const weeks = [];
  for (let col = 3; col < Math.max(weekHeaderRow.length, subHeaderRow.length); col += 3) {
    const hasSub = subHeaderRow[col] || subHeaderRow[col + 1] || subHeaderRow[col + 2];
    const label = (weekHeaderRow[col] || weekHeaderRow[col - 1] || weekHeaderRow[col - 2] || '').toString().trim();
    if (!label && !hasSub) break;
    weeks.push({ label: label || `${weeks.length + 1}-апта`, col });
  }

  const curators = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] || [];
    const fullName = (row[1] || '').toString().trim();
    if (!fullName) continue;
    const coordinator = (row[0] || '').toString().trim();
    const streamCode = (row[2] || '').toString().trim();
    const scores = weeks.map(w => ({
      label: w.label,
      pf: isBlank(row[w.col]) ? null : row[w.col],
      st: isBlank(row[w.col + 1]) ? null : row[w.col + 1],
      ortak: isBlank(row[w.col + 2]) ? null : row[w.col + 2],
    }));
    curators.push({ coordinator, fullName, streamCode, scores });
  }

  return { weeks: weeks.map(w => w.label), curators };
}

// 1. Қай пәндерге дэшборд қосылғанын білу (frontend subject-grid осыған қарап
//    "қосылмаған" деп белгілейді)
router.get('/status', auth, async (req, res) => {
  const status = {};
  Object.keys(SUBJECT_ENV_KEY).forEach(subject => {
    status[subject] = !!getSheetId(subject);
  });
  res.json(status);
});

const EVALUATION_SHEET_ID = process.env.EVALUATION_SHEET_ID;

function normalizeCriteriaValue(v) {
  const s = (v ?? '').toString().trim().toUpperCase();
  if (s === 'TRUE') return true;
  if (s === 'FALSE') return false;
  return null;
}

function parseScore(v) {
  const n = parseFloat((v ?? '').toString().trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Есімдерді салыстыру — import-review-doc.js / sheets-apps-script.gs-тегі
// логикамен бірдей (тегі-аты ретін, қазақ-кирилл әріп вариантын ескереді).
const LETTER_FOLD = { 'қ': 'к', 'ғ': 'г', 'ұ': 'у', 'ү': 'у', 'і': 'и', 'ң': 'н', 'ә': 'а', 'ө': 'о', 'һ': 'х' };
function normalizeName(name) {
  return String(name || '').toLowerCase()
    .replace(/[қғұүіңәөһ]/g, (c) => LETTER_FOLD[c] || c)
    .replace(/[^a-zа-я\s]/gi, '')
    .split(/\s+/).filter(Boolean).sort().join(' ');
}
function sameName(a, b) {
  const na = normalizeName(a).split(' ').filter(Boolean);
  const nb = normalizeName(b).split(' ').filter(Boolean);
  if (!na.length || !nb.length) return false;
  const shared = na.filter((w) => nb.includes(w));
  return shared.length >= 2 || (shared.length >= 1 && Math.min(na.length, nb.length) === 1);
}

// "СТ БАҒАЛАУ" кестесінің бір таб-ын (мыс. "ФИЗ-01") апта-блоктарға бөліп,
// әр куратордың критерий бойынша (TRUE/FALSE) және "Бағалау" баллын алады.
// Баған саны/атаулары апта сайын өзгеруі мүмкін (тарихи эволюция), сондықтан
// "АТЫ-ЖӨНІ" деген жол кезіккен сайын активті header жаңартылады.
function parseEvaluationTab(rows) {
  const weeks = [];
  let header = null;
  let current = null;

  for (const row of rows) {
    const col0 = (row[0] || '').toString().trim();
    if (col0 === 'АТЫ-ЖӨНІ') { header = row; continue; }

    const weekMatch = col0.match(/^(\d+)-АЙ\s+(\d+)-АПТА/i);
    if (weekMatch) {
      current = { monthNum: Number(weekMatch[1]), weekNum: Number(weekMatch[2]), curators: [] };
      weeks.push(current);
      continue;
    }

    if (!col0 || col0 === 'Ескерту саны' || !current || !header) continue;

    const entry = { name: col0, score: null, criteria: {}, metrics: {} };
    for (let i = 1; i < header.length - 1; i++) {
      const label = (header[i] || '').toString().trim();
      if (!label) continue;
      const raw = row[i];
      const bool = normalizeCriteriaValue(raw);
      if (bool !== null) { entry.criteria[label] = bool; continue; }
      if (label === 'Бағалау') { entry.score = parseScore(raw); continue; }
      if (raw !== undefined && raw !== '') entry.metrics[label] = raw;
    }
    current.curators.push(entry);
  }

  return weeks;
}

// 2ә. Куратордың өз СТ-бағалау прогресі: апта сайынғы балл + критерий
// бойынша сәйкестік. Куратор — тек өзінікін, координатор/admin — кез
// келген куратордың атын ?curatorName= арқылы сұрай алады.
router.get('/:subject/evaluation', auth, async (req, res) => {
  const { subject } = req.params;
  if (!EVALUATION_SHEET_ID) {
    return res.status(404).json({ error: 'Бағалау кестесі қосылмаған', connected: false });
  }

  let curatorName, streamId;
  if (req.user.role === 'curator') {
    curatorName = req.user.fullName;
    streamId = req.user.streamId || '01';
  } else if (['coordinator', 'admin'].includes(req.user.role)) {
    curatorName = (req.query.curatorName || '').toString().trim();
    streamId = (req.query.streamId || '01').toString();
    if (!curatorName) return res.status(400).json({ error: 'curatorName міндетті' });
    if (req.user.role === 'coordinator' && req.user.subject !== subject) {
      return res.status(403).json({ error: 'Бұл пән сіздің ағымыңызда емес' });
    }
  } else {
    return res.status(403).json({ error: 'Рұқсат жоқ' });
  }

  const authClient = getSapaAuth();
  if (!authClient) {
    return res.status(400).json({ error: 'Сапа бөлімінің Google авторизация кілттері табылмады', connected: false });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: EVALUATION_SHEET_ID,
      range: `${subject}-${streamId}!A1:ZZ2000`,
    });
    const weeks = parseEvaluationTab(result.data.values || []);

    const curatorWeeks = weeks
      .map((w) => {
        const row = w.curators.find((c) => sameName(c.name, curatorName));
        return row ? { monthNum: w.monthNum, weekNum: w.weekNum, score: row.score, criteria: row.criteria, metrics: row.metrics } : null;
      })
      .filter(Boolean);

    res.json({ connected: true, subject, streamId, curatorName, weeks: curatorWeeks });
  } catch (err) {
    res.status(500).json({ error: 'Google Sheets оқу қатесі: ' + err.message, connected: false });
  }
});

// 2. Пән бойынша айлық рейтинг кестесін алу (Google Sheets-тен тікелей оқиды)
router.get('/:subject/monthly', auth, async (req, res) => {
  const { subject } = req.params;
  const sheetId = getSheetId(subject);
  if (!sheetId) {
    return res.status(404).json({ error: 'Бұл пән үшін дэшборд кестесі әлі қосылмаған', connected: false });
  }
  const authClient = getSapaAuth();
  if (!authClient) {
    return res.status(400).json({ error: 'Сапа бөлімінің Google авторизация кілттері табылмады', connected: false });
  }
  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'АЙЛЫҚ КӨРСЕТКІШТЕР!A1:ZZ500',
    });
    const parsed = parseMonthlySheet(result.data.values || []);
    res.json({ connected: true, ...parsed });
  } catch (err) {
    res.status(500).json({ error: 'Google Sheets оқу қатесі: ' + err.message, connected: false });
  }
});

module.exports = router;
