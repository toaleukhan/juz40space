const { google } = require('googleapis');

// Пән коды (кириллица) -> ортам айнымалысының ASCII жалғауы,
// мыс. GOOGLE_SERVICE_ACCOUNT_JSON_FIZ / GOOGLE_TOKEN_JSON_FIZ
const SUBJECT_ENV_KEY = {
  ФИЗ: 'FIZ', МАТ: 'MAT', ТІЛ: 'TIL', БИО: 'BIO', ИНФО: 'INFO', ГЕО: 'GEO',
  ТАРИХ: 'TARIH', РУС: 'RUS', ХИМ: 'HIM', МС: 'MS', ӘДЕБ: 'ADEB', АНГЛ: 'ANGL', ДЖТ: 'DZHT',
};

const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/drive'];

// Пәннің ӨЗ домен аккаунты болмаса — null қайтарады (алдыңғы нұсқада сапа
// бөлімінің ортақ аккаунтына түсіп кете беретін еді, ол дұрыс емес: сапа
// бөлімінің есептік жазбасы басқа пәннің атынан Мит ашпауы керек).
function getGoogleAuth(subject) {
  try {
    const envKey = subject && SUBJECT_ENV_KEY[subject];
    if (!envKey) return null;

    const saJson = process.env[`GOOGLE_SERVICE_ACCOUNT_JSON_${envKey}`];
    if (saJson) {
      const sa = JSON.parse(saJson);
      return new google.auth.JWT({
        email: sa.client_email,
        key: sa.private_key,
        scopes: SCOPES,
      });
    }

    const tokenJson = process.env[`GOOGLE_TOKEN_JSON_${envKey}`];
    const credsJson = process.env[`GOOGLE_CREDENTIALS_JSON_${envKey}`];
    if (tokenJson && credsJson) {
      const tokens = JSON.parse(tokenJson);
      const creds = JSON.parse(credsJson);
      if (tokens.token && !tokens.access_token) tokens.access_token = tokens.token;

      const config = creds.installed || creds.web;
      const { client_id, client_secret, redirect_uris } = config;
      const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris ? redirect_uris[0] : 'http://localhost'
      );
      oAuth2Client.setCredentials(tokens);
      return oAuth2Client;
    }
  } catch (e) {
    console.error('Google Auth Error:', e.message);
  }
  return null;
}

module.exports = { getGoogleAuth, SUBJECT_ENV_KEY, SCOPES };
