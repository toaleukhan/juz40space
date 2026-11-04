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

// Токен қайдан алынады: сайттағы баптаудан (базада) немесе Railway-дегі
// APIFY_TOKEN-нен. Маршрут іске қосылғанда setTokenSource арқылы базаны қосады.
let tokenSource = async () => null;
function setTokenSource(fn) { tokenSource = fn; }

async function token() {
  const fromSite = await tokenSource();
  const t = fromSite || process.env.APIFY_TOKEN;
  if (!t) throw new ApifyError('Apify токені қосылмаған — TikTok беті → Apify баптауына жаңа токен енгізіңіз', 'no_token');
  return t;
}

async function call(path, { method = 'GET', body, fetchImpl = fetch, tokenOverride } = {}) {
  const auth = tokenOverride || await token();
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) throw new ApifyError('Apify токені жарамсыз немесе өшірілген', 'bad_token');
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
    // Бекітілген (pinned) ескі видеолар профильдің басында тұрады. Оларды
    // алып тастамасақ, скрейпер «ескі видео басталды» деп сол жерде тоқтайды
    // да, бөлімнің осы айдағы видеолары мүлде келмейді (PR, Маркетинг).
    // Бекітілгендердің өзін buildPinnedInput бөлек run-мен алады.
    excludePinnedPosts: true,
  };
}

// TikTok-та ең көбі 3 видео бекітіледі, олар профильдің ең басында тұрады.
// Күн сүзгісінсіз алғашқы бірнеше видеоны аламыз — бекітілген видео осы айға
// тиесілі болса, ingest оны күні бойынша өзі қалдырады, ескісін тастайды.
const PINNED_PER_PROFILE = 5;

function buildPinnedInput(usernames) {
  return {
    profiles: usernames,
    profileScrapeSections: ['videos'],
    profileSorting: 'latest',
    resultsPerPage: PINNED_PER_PROFILE,
    excludePinnedPosts: false,
  };
}

async function startRun(usernames, start, end, deps = {}) {
  const data = await call(`/acts/${ACTOR}/runs`, { method: 'POST', body: buildInput(usernames, start, end), ...deps });
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId, status: data.data.status };
}

async function startPinnedRun(usernames, deps = {}) {
  const data = await call(`/acts/${ACTOR}/runs`, { method: 'POST', body: buildPinnedInput(usernames), ...deps });
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId, status: data.data.status };
}

async function getRun(runId, deps = {}) {
  const data = await call(`/actor-runs/${encodeURIComponent(runId)}`, deps);
  return { status: data.data.status, datasetId: data.data.defaultDatasetId };
}

async function fetchItems(datasetId, deps = {}) {
  return call(`/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`, deps);
}

// Аккаунт пен айлық шығын — сайдбардағы «қанша қалды» индикаторы үшін.
// Бір токенді сақтамас бұрын тексеру үшін де қолданылады (tokenOverride).
async function accountInfo(deps = {}) {
  const [me, limits] = await Promise.all([
    call('/users/me', deps),
    call('/users/me/limits', deps).catch(() => null),
  ]);
  const l = limits?.data || {};
  const used = Number(l.current?.monthlyUsageUsd);
  const max = Number(l.limits?.maxMonthlyUsageUsd);
  return {
    username: me?.data?.username || null,
    plan: me?.data?.plan?.id || null,
    usedUsd: Number.isFinite(used) ? Math.round(used * 100) / 100 : null,
    limitUsd: Number.isFinite(max) ? Math.round(max * 100) / 100 : null,
    cycleEnd: l.monthlyUsageCycle?.endAt || null,
  };
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

module.exports = { ApifyError, setTokenSource, accountInfo, MAX_PER_PROFILE, buildInput, buildPinnedInput, startRun, startPinnedRun, getRun, fetchItems, normalizeItem };
