/**
 * JUZ40 — "SMART | СТ ЗАПИСЬ" кестесіне арналған Apps Script.
 *
 * Не істейді: ашық тұрған беттің (мыс. ФИЗ-01) ішінен таңдалған аптаның
 * тақырып жолын ("1-ай 4-апта") тауып, астындағы кураторлардың жолдарын
 * сайттағы деректермен толтырады.
 *
 * Сілтемелер ҮЛГІ бетіндегідей жазылады: бір ұяшықтың ішінде
 * "запись 1  запись 2" деп аталған, әрқайсысы өз мекенжайына сілтейтін
 * гиперсілтемелер. Ұзын URL көрінбейді.
 *
 * Тек мына бағандарды жазады: C (СТ тапсырды), D (запись), E (отслежка),
 * F (ескеру керек жағдайлар). A мен B-ға тимейді.
 *
 * Куратордың аты-жөні (A бағаны) сайттағыдан сәл өзгеше жазылса да табылады:
 * әкесінің аты артық болса да, қазақша/орысша әріп айырмасы болса да.
 */

// ─── БАПТАУ ──────────────────────────────────────────────────────────────
// Railway → juz40space сервисі → Settings → Domains бөліміндегі мекенжай,
// соңына /api қосылады.
var API_BASE = 'https://juz40space-production.up.railway.app/api';
// Railway → juz40space → Variables → EXPORT_TOKEN мәні.
var EXPORT_TOKEN = 'МҰНДА_RAILWAY-ДЕГІ_EXPORT_TOKEN';
// ─────────────────────────────────────────────────────────────────────────

// Кестедегі бағандар (1 = A)
var COL = {
  name: 1,        // A  АТЫ-ЖӨНІ
  submitted: 3,   // C  СТ ТАПСЫРДЫ
  video: 4,       // D  ЗАПИСЬ СІЛТЕМЕСІ
  attendance: 5,  // E  ОТСЛЕЖКА СІЛТЕМЕСІ
  notes: 6,       // F  ЕСКЕРУ КЕРЕК ЖАҒДАЙЛАР
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('JUZ40')
    .addItem('Аптаны тарту…', 'promptAndFill')
    .addToUi();
}

function promptAndFill() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'JUZ40 — тарту',
    'Қай апта? "1-ай 4-апта" үшін "1 4" деп жазыңыз.',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;

  var parts = res.getResponseText().trim().split(/\s+/);
  var monthNum = parseInt(parts[0], 10);
  var weekNum = parseInt(parts[1], 10);
  if (!monthNum || !weekNum) {
    ui.alert('Түсінбедім. Екі сан керек, мысалы: 1 4');
    return;
  }

  try {
    var r = fillWeek(monthNum, weekNum);
    var msg = 'Толтырылды: ' + r.filled + ' куратор';
    if (r.missing.length) {
      msg += '\n\nСайтта табылмады (' + r.missing.length + '):\n' + r.missing.join(', ');
    }
    if (r.ambiguous.length) {
      msg += '\n\nЕкі кураторға бірдей келді, қолмен қараңыз (' + r.ambiguous.length + '):\n' + r.ambiguous.join('\n');
    }
    if (!r.missing.length && !r.ambiguous.length) msg += '\n\nБарлық куратор сәйкес келді.';
    ui.alert('Дайын.\n\n' + msg);
  } catch (e) {
    ui.alert('Қателік: ' + e.message);
  }
}

/** Ашық тұрған беттің атынан пән мен ағынды алады: "ФИЗ-01" → ФИЗ, 01 */
function parseSheetName(name) {
  var m = String(name).trim().match(/^(.+)-(\d{2})$/);
  if (!m) throw new Error('Бет атауы "ПӘН-АҒЫМ" түрінде болуы керек, мыс. ФИЗ-01. Қазір: ' + name);
  return { subject: m[1].trim(), streamId: m[2] };
}

function fetchWeek(subject, streamId, monthNum, weekNum) {
  var url = API_BASE + '/export/st'
    + '?subject=' + encodeURIComponent(subject)
    + '&streamId=' + encodeURIComponent(streamId)
    + '&monthNum=' + monthNum
    + '&weekNum=' + weekNum;

  var response = UrlFetchApp.fetch(url, {
    headers: { 'X-Export-Token': EXPORT_TOKEN },
    muteHttpExceptions: true,
  });
  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code !== 200) throw new Error('Сервер ' + code + ': ' + text.slice(0, 200));
  return JSON.parse(text);
}

/**
 * "1-ай 4-апта" тақырып жолын тауып, астындағы кураторлар блогының жол
 * аралығын қайтарады (келесі тақырыпқа немесе беттің соңына дейін).
 */
function findWeekBlock(sheet, monthNum, weekNum) {
  var lastRow = sheet.getLastRow();
  var names = sheet.getRange(1, COL.name, lastRow, 1).getValues();

  var wanted = new RegExp('^\\s*' + monthNum + '\\s*-\\s*ай\\s+' + weekNum + '\\s*-\\s*апта\\s*$', 'i');
  var anyHeader = /^\s*\d+\s*-\s*ай\s+\d+\s*-\s*апта\s*$/i;

  var start = -1;
  for (var i = 0; i < names.length; i++) {
    if (wanted.test(String(names[i][0]))) { start = i + 2; break; } // тақырыптан кейінгі жол
  }
  if (start < 0) throw new Error(monthNum + '-ай ' + weekNum + '-апта деген жол табылмады');

  var end = lastRow;
  for (var j = start - 1; j < names.length; j++) {
    if (anyHeader.test(String(names[j][0]))) { end = j; break; } // келесі тақырып
  }
  return { start: start, end: end };
}

// ─── Есімдерді сәйкестендіру ─────────────────────────────────────────────
// Кестеде толық аты-жөні (әкесінің атымен) жазылады, сайтта қысқаша: "Темірхан
// Нұржас Жандосұлы" ↔ "Темірхан Нұржас". Оның үстіне қазақша әріптер бірде
// қазақша, бірде орысша теріледі: "Қуандық" ↔ "Куандык". Сондықтан дәл
// салыстыруға болмайды.
var LETTER_MAP = { 'қ':'к', 'ғ':'г', 'ң':'н', 'ә':'а', 'ө':'о', 'ұ':'у', 'ү':'у', 'і':'и', 'һ':'х', 'ё':'е' };

function normalizeName(s) {
  return String(s).toLowerCase()
    .split('').map(function (c) { return LETTER_MAP[c] || c; }).join('')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(s) {
  return normalizeName(s).split(' ').filter(Boolean);
}

/** Екі есім бір адамдікі ме? */
function sameName(a, b) {
  var A = nameTokens(a), B = nameTokens(b);
  if (!A.length || !B.length) return false;
  if (A.join(' ') === B.join(' ')) return true;
  // Бірі екіншісінің басы: "Семгалиева Мадина" ⊂ "Семгалиева Мадина Нұрлыбековна"
  var n = Math.min(A.length, B.length);
  if (A.slice(0, n).join(' ') === B.slice(0, n).join(' ')) return true;
  // Аты мен тегі орын алмасқан: "Жайлаубек Тоғжан" ↔ "Тоғжан Жайлаубек"
  if (n >= 2 && A.slice(0, 2).sort().join(' ') === B.slice(0, 2).sort().join(' ')) return true;
  return false;
}

/**
 * Бір ұяшыққа бірнеше атаулы гиперсілтеме жасайды:
 *   "запись 1  запись 2" — әрқайсысы өз URL-іне сілтейді.
 * ҮЛГІ бетіндегі көріністі осы береді.
 */
function linkedCell(urls, label) {
  var parts = urls.map(function (_, i) { return label + ' ' + (i + 1); });
  var SEP = '  ';
  var builder = SpreadsheetApp.newRichTextValue().setText(parts.join(SEP));
  var pos = 0;
  parts.forEach(function (p, i) {
    builder.setLinkUrl(pos, pos + p.length, urls[i]);
    pos += p.length + SEP.length;
  });
  return builder.build();
}

function fillWeek(monthNum, weekNum) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var parsed = parseSheetName(sheet.getName());
  var data = fetchWeek(parsed.subject, parsed.streamId, monthNum, weekNum);

  var block = findWeekBlock(sheet, monthNum, weekNum);
  if (block.end < block.start) return { filled: 0, missing: [], ambiguous: [] };

  var count = block.end - block.start + 1;
  var nameCells = sheet.getRange(block.start, COL.name, count, 1).getValues();
  var filled = 0;
  var missing = [];
  var ambiguous = [];

  for (var i = 0; i < count; i++) {
    var name = String(nameCells[i][0]).trim();
    if (!name) continue;

    var hits = data.rows.filter(function (cand) { return sameName(name, cand.curatorName); });
    if (hits.length === 0) { missing.push(name); continue; }
    if (hits.length > 1) {
      // Екі кураторға бірдей келсе, қателеспей тұрып тоқтаймыз.
      ambiguous.push(name + ' → ' + hits.map(function (h) { return h.curatorName; }).join(' / '));
      continue;
    }
    var row = hits[0];

    var rowIndex = block.start + i;
    if (row.studentsCount !== '') sheet.getRange(rowIndex, COL.submitted).setValue(row.studentsCount);
    if (row.notes) sheet.getRange(rowIndex, COL.notes).setValue(row.notes);

    if (row.videos && row.videos.length) {
      sheet.getRange(rowIndex, COL.video).setRichTextValue(linkedCell(row.videos, 'запись'));
    }
    if (row.attendance && row.attendance.length) {
      sheet.getRange(rowIndex, COL.attendance).setRichTextValue(linkedCell(row.attendance, 'отслежка'));
    }
    filled++;
  }
  return { filled: filled, missing: missing, ambiguous: ambiguous };
}
