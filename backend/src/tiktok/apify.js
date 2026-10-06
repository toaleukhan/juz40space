// Apify (clockworks/tiktok-scraper) арқылы профильдердің видеоларын алу.
// Жұмыс екі қадамда: startRun іске қосады да run id береді, кейін
// getRun / fetchItems күйін тексереді. Ұзақ сұранысты ұстап тұрмаймыз —
// фронтенд күйін сұрап тұрады, сервер қайта қосылса да ештеңе жоғалмайды.

const { almatyDay } = require('./scoring');

const API = 'https://api.apify.com/v2';
const ACTOR = 'clockworks~tiktok-scraper';
// Бір профильге ең көп видео — шығынды шектеу үшін (айына 22 жұмыс күні,
// күніне бірнеше видео болса да 150 жетеді).
const MAX_PER_PROFILE = Number(process.env.TIKTOK_MAX_PER_PROFILE) || 150;

class ApifyError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code; // 'no_token' | 'http' | 'limit'
  }
}

function token() {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new ApifyError('APIFY_TOKEN орнатылмаған (Railway → Variables)', 'no_token');
  return t;
}

async function call(path, { method = 'GET', body, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    // Тегін лимит біткенде Apify 402/403 қайтарады
    const code = res.status === 402 || /limit|usage|exceed/i.test(msg) ? 'limit' : 'http';
    throw new ApifyError(`Apify: ${msg}`, code);
  }
  return data;
}

function buildInput(usernames, start, end) {
  return {
    profiles: usernames,
    profileScrapeSections: ['videos'],
    profileSorting: 'latest',
    resultsPerPage: MAX_PER_PROFILE,
    oldestPostDateUnified: start,
    newestPostDate: end,
  };
}

async function startRun(usernames, start, end, deps = {}) {
  const data = await call(`/acts/${ACTOR}/runs`, { method: 'POST', body: buildInput(usernames, start, end), ...deps });
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId, status: data.data.status };
}

async function getRun(runId, deps = {}) {
  const data = await call(`/actor-runs/${encodeURIComponent(runId)}`, deps);
  return { status: data.data.status, datasetId: data.data.defaultDatasetId };
}

async function fetchItems(datasetId, deps = {}) {
  return call(`/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`, deps);
}

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// Apify жолын біздің кестеге сай пішінге келтіреді. Жарамсыз жол → null.
function normalizeItem(it) {
  if (!it || typeof it !== 'object') return null;
  const username = String(it.authorMeta?.name || '').toLowerCase();
  const iso = it.createTimeISO || (it.createTime ? new Date(Number(it.createTime) * 1000).toISOString() : null);
  const id = String(it.id || '').trim();
  if (!username || !iso || !id || Number.isNaN(new Date(iso).getTime())) return null;
  return {
    id,
    username,
    postedAt: new Date(iso).toISOString(),
    postDay: almatyDay(iso),
    views: num(it.playCount),
    likes: num(it.diggCount),
    comments: num(it.commentCount),
    shares: num(it.shareCount),
    durationSec: num(it.videoMeta?.duration),
    musicOriginal: it.musicMeta ? Boolean(it.musicMeta.musicOriginal) : null,
    musicName: it.musicMeta?.musicName ? String(it.musicMeta.musicName).slice(0, 200) : null,
    caption: String(it.text || '').slice(0, 2200),
    hashtags: (it.hashtags || []).map((h) => String(h?.name || h || '').toLowerCase()).filter(Boolean),
    mentions: (it.mentions || []).map((m) => String(m).replace(/^@/, '').toLowerCase()).filter(Boolean),
    url: it.webVideoUrl || `https://www.tiktok.com/@${username}/video/${id}`,
    cover: it.videoMeta?.coverUrl || null,
  };
}

module.exports = { ApifyError, MAX_PER_PROFILE, buildInput, startRun, getRun, fetchItems, normalizeItem };
