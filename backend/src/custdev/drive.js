// CustDev жазбаларын Drive-тан алу: recording_ref өрісіне бекітілген
// қалта жоқ — сапа менеджер әр сұхбаттың Drive сілтемесін тікелей
// қояды. Осы файл сол сілтемеден файл ID-ін тауып, метадеректі
// (күні) және мазмұнын (протокол емес, шикі байт) алады.
//
// Авторизация — recordingReviews.js-тегі getGoogleAuth(subject) дәл
// сол үлгісімен, бірақ бөлек: CustDev-тің қызметтік аккаунты басқа
// пәндердің Мит-теріне тиіспеуі керек (googleAuth.js-тегі ескертпе).

const GeminiError = require('./gemini').GeminiError;

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

// https://drive.google.com/file/d/<id>/view , ?id=<id> , бәрі — не бос
// жол ішінде жазылған текст, не таза ID-дің өзі.
function extractDriveFileId(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const byPath = /\/d\/([a-zA-Z0-9_-]{10,})/.exec(s);
  if (byPath) return byPath[1];
  const byQuery = /[?&]id=([a-zA-Z0-9_-]{10,})/.exec(s);
  if (byQuery) return byQuery[1];
  // Сілтеме емес, өзі ID сияқты («/» жоқ, «http» жоқ, жеткілікті ұзын).
  // Ескерту: Meet кездесу коды да "abc-defg-hij" (12 таңба) болады —
  // нағыз Drive ID әрдайым әлдеқайда ұзын (әдетте 28+), сондықтан
  // шектеуді жоғары қоямыз, кездейсоқ meet-кодты Drive ID деп қабылдамайық.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s) && !s.includes('http')) return s;
  return null;
}

function getDriveAuth() {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CUSTDEV;
  if (!saJson) return null;
  try {
    const { google } = require('googleapis');
    const sa = JSON.parse(saJson);
    return new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  } catch (e) {
    console.error('CustDev Drive auth қатесі:', e.message);
    return null;
  }
}

// { name, mimeType, createdTime, size } — createdTime сұхбат күнін өзі
// анықтау үшін керек (қолмен жазбайсың).
async function fetchDriveMeta(fileId, authClient) {
  const { token } = await authClient.getAccessToken();
  const res = await fetch(`${DRIVE_API}/${fileId}?fields=name,mimeType,createdTime,size`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error?.message || `HTTP ${res.status}`;
    throw new GeminiError(
      res.status === 404 ? 'Бұл сілтеме бойынша файл табылмады немесе қызметтік аккаунтқа бөлісілмеген' : `Drive қатесі: ${msg}`,
      'drive'
    );
  }
  return res.json();
}

async function downloadDriveFile(fileId, authClient) {
  const { token } = await authClient.getAccessToken();
  const res = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new GeminiError(`Drive-тан жүктеу сәтсіз аяқталды: HTTP ${res.status}`, 'drive');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

module.exports = { extractDriveFileId, getDriveAuth, fetchDriveMeta, downloadDriveFile };
