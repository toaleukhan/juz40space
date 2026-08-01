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

// Жазба (recording) кімде-кім "Record" басқанда ғана пайда болады —
// state: 'STARTED' болса әлі жазылып жатыр, 'ENDED'/'FILE_GENERATED' болса
// тоқтаған. autoRecordingGeneration өшірулі болса (әдепкі), ешкім баспаса
// мүлде жазба ресурсы болмайды — бос тізім қалыпты жағдай.
async function isRecordingActive(accessToken, conferenceRecordName) {
  const res = await fetch(`https://meet.googleapis.com/v2/${conferenceRecordName}/recordings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return false;
  const body = await res.json();
  return (body.recordings || []).some(r => r.state === 'STARTED');
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
          const [participantCount, recording] = await Promise.all([
            countActiveParticipants(accessToken, conferenceRecord),
            isRecordingActive(accessToken, conferenceRecord),
          ]);
          data = { live: true, participantCount, recording };
        }
      }
    }
  } catch (e) {
    data = { live: null };
  }

  cache.set(meetCode, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

// Space-тың ішкі resource атын (spaces/{spaceId}) тауып, соған сай ЕҢ СОҢҒЫ
// conferenceRecord-ты қайтарады: әлі жүріп жатса — activeConference-тен,
// аяқталған болса — сол space-қа тиесілі жазбалардың ішінен ең жаңасын
// (conferenceRecords.list бойынша сүзіп) алады.
async function resolveConferenceRecord(accessToken, meetCode) {
  const spaceRes = await fetch(`https://meet.googleapis.com/v2/spaces/${meetCode}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!spaceRes.ok) return null;
  const space = await spaceRes.json();
  if (space.activeConference?.conferenceRecord) return space.activeConference.conferenceRecord;

  const listRes = await fetch('https://meet.googleapis.com/v2/conferenceRecords?pageSize=50', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) return null;
  const list = await listRes.json();
  const matches = (list.conferenceRecords || []).filter(cr => cr.space === space.name);
  if (!matches.length) return null;
  matches.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  return matches[0].name;
}

function participantDisplayName(p) {
  return p.signedinUser?.displayName || p.anonymousUser?.displayName || p.phoneUser?.displayName || 'Белгісіз';
}

// Бір Мит-тың қатысушылар журналы: кім қашан кірді/қашан шықты. ЕСКЕРТУ:
// бір адам бірнеше рет кіріп-шықса (қайта қосылса), Participant ресурсы
// тек ЕҢ БІРІНШІ кіру мен ЕҢ СОҢҒЫ шығуды береді (аралық сессияларды
// participantSessions сұрауы керек еді — 40 оқушыға дейін N+1 сұраныс
// болғандықтан, MVP үшін әдейі қосқан жоқпыз).
async function getMeetJournal(subject, meetCode) {
  if (!meetCode) return [];

  const accessToken = await fetchAccessToken(subject);
  if (!accessToken) return [];

  const conferenceRecord = await resolveConferenceRecord(accessToken, meetCode);
  if (!conferenceRecord) return [];

  const participants = [];
  let pageToken;
  do {
    const url = new URL(`https://meet.googleapis.com/v2/${conferenceRecord}/participants`);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) break;
    const body = await res.json();
    participants.push(
      ...(body.participants || []).map((p) => ({
        name: participantDisplayName(p),
        joinedAt: p.earliestStartTime || null,
        leftAt: p.latestEndTime || null,
      }))
    );
    pageToken = body.nextPageToken;
  } while (pageToken);

  participants.sort((a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0));
  return participants;
}

module.exports = { getMeetStatus, getMeetJournal };
