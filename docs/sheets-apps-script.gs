/**
 * JUZ40 — "SMART | СТ ЗАПИСЬ" кестесіне арналған Apps Script.
 *
 * Не істейді: ашық тұрған беттің (мыс. ФИЗ-01) ішінен таңдалған аптаның
 * тақырып жолын ("1-ай 4-апта") тауып, астындағы кураторлардың жолдарын
 * сайттағы деректермен толтырады.
 *
 * Қалай орнату керек:
 *   1. Кестені ашып: Кеңейтімдер → Apps Script
 *   2. Осы файлдың бүкіл мазмұнын сол жерге қойып, сақтаңыз
 *   3. Төмендегі EXPORT_TOKEN-ді Railway-дегі мәнмен ауыстырыңыз
 *   4. Кестені жаңартыңыз — жоғарыда "JUZ40" мәзірі пайда болады
 *
 * Ескерту: скрипт тек C–H бағандарын ғана жазады, басқасына тимейді.
 * Куратор аты (A бағаны) сайттағы жазылуымен дәл сәйкес келуі керек.
 */

// API_BASE — Railway-дегі backend мекенжайы. Дәл қандай екенін Railway →
// juz40space сервисі → Settings → Domains бөлімінен көріңіз, соңына /api
// қосылады. Сайттың Vercel-дегі VITE_API_URL айнымалысында да сол тұр.
var API_BASE = 'https://juz40space-production.up.railway.app/api';
var EXPORT_TOKEN = 'МҰНДА_RAILWAY-ДЕГІ_EXPORT_TOKEN';

// Кестедегі бағандар (1 = A)
var COL = {
  name: 1,            // A  АТЫ-ЖӨНІ
  submitted: 3,       // C  СТ ТАПСЫРДЫ
  video: 4,           // D  ЗАПИСЬ СІЛТЕМЕСІ
  attendance: 5,      // E  ОТСЛЕЖКА СІЛТЕМЕСІ
  notes: 6,           // F  ЕСКЕРУ КЕРЕК ЖАҒДАЙЛАР
  videoExtra: 7,      // G  ТОЛЫҚТЫРАТЫН ЗАПИСЬ
  attendanceExtra: 8, // H  ТОЛЫҚТЫРАТЫН ОТСЛЕЖКА
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('JUZ40')
    .addItem('Осы аптаны тарту…', 'promptAndFill')
    .addToUi();
}

function promptAndFill() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'JUZ40 — тарту',
    'Қай апта? Мысалы: 1-ай 4-апта деп "1 4" жазыңыз',
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
    var filled = fillWeek(monthNum, weekNum);
    ui.alert('Дайын: ' + filled + ' куратор толтырылды.');
  } catch (e) {
    ui.alert('Қателік: ' + e.message);
  }
}

/**
 * Ашық тұрған беттің атынан пән мен ағынды алады: "ФИЗ-01" → ФИЗ, 01
 */
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
  if (code !== 200) {
    throw new Error('Сервер ' + code + ': ' + text.slice(0, 200));
  }
  return JSON.parse(text);
}

/**
 * "1-ай 4-апта" тақырып жолын тауып, оның астындағы кураторлар блогының
 * жол аралығын қайтарады (келесі тақырыпқа немесе беттің соңына дейін).
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
    if (anyHeader.test(String(names[j][0]))) { end = j; break; }  // келесі тақырып
  }
  return { start: start, end: end };
}

function fillWeek(monthNum, weekNum) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var parsed = parseSheetName(sheet.getName());
  var data = fetchWeek(parsed.subject, parsed.streamId, monthNum, weekNum);

  var byName = {};
  data.rows.forEach(function (r) { byName[String(r.curatorName).trim()] = r; });

  var block = findWeekBlock(sheet, monthNum, weekNum);
  if (block.end < block.start) return 0;

  var count = block.end - block.start + 1;
  var nameCells = sheet.getRange(block.start, COL.name, count, 1).getValues();
  var filled = 0;

  for (var i = 0; i < count; i++) {
    var name = String(nameCells[i][0]).trim();
    if (!name) continue;
    var row = byName[name];
    if (!row) continue;

    var r = block.start + i;
    if (row.studentsCount !== '') sheet.getRange(r, COL.submitted).setValue(row.studentsCount);
    if (row.video) sheet.getRange(r, COL.video).setValue(row.video);
    if (row.attendance) sheet.getRange(r, COL.attendance).setValue(row.attendance);
    if (row.notes) sheet.getRange(r, COL.notes).setValue(row.notes);
    if (row.videoExtra.length) sheet.getRange(r, COL.videoExtra).setValue(row.videoExtra.join('\n'));
    if (row.attendanceExtra.length) sheet.getRange(r, COL.attendanceExtra).setValue(row.attendanceExtra.join('\n'));
    filled++;
  }
  return filled;
}
