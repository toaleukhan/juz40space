const { google } = require('googleapis');
const { getGoogleAuth } = require('./googleAuth');

const HEADERS = ['Куратор аты-жөні', 'СТ тапсырды', 'Запись сілтемелері', 'Отслежка сілтемелері', 'Ескеру керек жағдайлар'];

// Бір ұяшыққа бірнеше атаулы гиперсілтеме саламыз: "запись 1  запись 2" —
// docs/sheets-apps-script.gs-тегі linkedCell функциясымен бірдей көрініс
// үшін (сапа бөлімі екі форматты да таныс күйде көреді).
function linkCell(urls, label) {
  if (!urls || !urls.length) return { userEnteredValue: { stringValue: '' } };
  const SEP = '  ';
  const parts = urls.map((_, i) => `${label} ${i + 1}`);
  let pos = 0;
  const runs = parts.map((p, i) => {
    const run = { startIndex: pos, format: { link: { uri: urls[i] }, foregroundColor: { red: 0.05, green: 0.4, blue: 0.85 }, underline: true } };
    pos += p.length + SEP.length;
    return run;
  });
  return { userEnteredValue: { stringValue: parts.join(SEP) }, textFormatRuns: runs };
}

function textCell(value, bold) {
  return {
    userEnteredValue: { stringValue: value === null || value === undefined ? '' : String(value) },
    ...(bold ? { userEnteredFormat: { textFormat: { bold: true } } } : {}),
  };
}

// Координатор/админ "Экспорт" батырмасын басқанда: экрандағы аптаның
// деректерін жаңа Google Sheet-ке жазады (пәннің өз Google аккаунтында)
// және сілтемесі барға оқу рұқсатын береді — SMART | СТ ЗАПИСЬ кестесіне
// қолмен енгізудің орнына тез бөлісуге арналған дербес көшірме.
async function createExportSheet({ subject, streamId, monthNum, weekNum, rows }) {
  const authClient = getGoogleAuth(subject);
  if (!authClient) {
    const err = new Error('Бұл пән үшін Google аккаунт қосылмаған');
    err.code = 'NO_AUTH';
    throw err;
  }

  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const drive = google.drive({ version: 'v3', auth: authClient });

  const title = `СТ · ${subject}-${streamId} · ${monthNum}-ай ${weekNum}-апта · ${new Date().toLocaleDateString('kk-KZ')}`;

  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: 'СТ Жазба', gridProperties: { frozenRowCount: 1 } } }],
    },
  });
  const spreadsheetId = created.data.spreadsheetId;
  const sheetId = created.data.sheets[0].properties.sheetId;

  const dataRows = rows.map(r => {
    const videos = r.video_links?.length ? r.video_links : (r.video_link ? [r.video_link] : []);
    const attendance = r.attendance_links?.length ? r.attendance_links : (r.attendance_link ? [r.attendance_link] : []);
    return {
      values: [
        textCell(r.curator_name),
        textCell(r.students_count),
        linkCell(videos, 'запись'),
        linkCell(attendance, 'отслежка'),
        textCell(r.notes),
      ],
    };
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            rows: [{ values: HEADERS.map(h => textCell(h, true)) }, ...dataRows],
            fields: 'userEnteredValue,userEnteredFormat.textFormat,textFormatRuns',
            start: { sheetId, rowIndex: 0, columnIndex: 0 },
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: HEADERS.length },
            properties: { pixelSize: 240 },
            fields: 'pixelSize',
          },
        },
      ],
    },
  });

  // Тек оқуға сілтемесі бар кез келген адамға — команда мүшелерінің
  // Google логині осы пән аккаунтымен бірдей болуы міндетті емес.
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return { url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, spreadsheetId };
}

module.exports = { createExportSheet };
