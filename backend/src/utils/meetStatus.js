const { getGoogleAuth } = require('./googleAuth');

// Google Meet REST API-дан бір Мит-тың "қазір жүріп жатыр ма" статусын және
// қатысушылар санын сұрайды. Тек ФИЗ секілді Meet API scope-ы (
// meetings.space.readonly) бар пәндерде жұмыс істейді — scope жоқ немесе
// Google қате қайтарса, лайв=null (белгісіз) деп үнсіз қайтарамыз: бұл
// куратордың Мит ашуына/жабуына ешбір әсер етпейді, тек координатор
// экранындағы badge көрінбей қалады.
const CACHE_TTL_MS = 15000;
const cache = new Map(); // meetCode -> { data, expiresAt }

async function fetchAccessToken(subject) {
  const authClient = getGoogleAuth(subject);
  if (!authClient) return null;
  const { token } = await authClient.getAccessToken();
  return token || null;
}

async function countActiveParticipants(accessToken, conferenceRecordName) {
  let count = 0;
  let pageToken;
  do {
    const url = new URL(`https://meet.googleapis.com/v2/${conferenceRecordName}/participants`);
    url.searchParams.set('pageSize', '250');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) break;
    const body = await res.json();
    count += (body.participants || []).filter(p => !p.latestEndTime).length;
    pageToken = body.nextPageToken;
  } while (pageToken);
  return count;
}

async function getMeetStatus(subject, meetCode) {
  if (!meetCode) return { live: null };

  const cached = cache.get(meetCode);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  let data = { live: null };
  try {
    const accessToken = await fetchAccessToken(subject);
    if (accessToken) {
      const spaceRes = await fetch(`https://meet.googleapis.com/v2/spaces/${meetCode}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (spaceRes.ok) {
        const space = await spaceRes.json();
        const conferenceRecord = space.activeConference?.conferenceRecord;
        if (!conferenceRecord) {
          data = { live: false };
        } else {
          const participantCount = await countActiveParticipants(accessToken, conferenceRecord);
          data = { live: true, participantCount };
        }
      }
    }
  } catch (e) {
    data = { live: null };
  }

  cache.set(meetCode, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

module.exports = { getMeetStatus };
