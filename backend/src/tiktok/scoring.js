// TikTok жарысының таза есептері: ай шекарасы, жұмыс күндері, автомат
// ұпайлар (Тұрақтылық, Статистика) және жүйе ұсынатын ұпайлар
// (Бөлімаралық, Juz40_team, Бонус). Желі де, база да жоқ — бәрі сынақпен
// тексеріледі.

const TZ = 'Asia/Almaty';
const TAGS = ['juz40_life', 'juz40_moments'];
const VIEW_TARGET_LOW = 500;
const VIEW_TARGET_HIGH = 1000;
const VIRAL_VIEWS = 15000;
const TEAM_MIN_VIDEOS = 10;

// Жюри толтыратын критерийлер — кесте бағандары мен API кілттері бір жерде.
const JURY_FIELDS = [
  { key: 'creativity', label: 'Креативтілік', max: 10 },
  { key: 'ethics', label: 'Этика', max: 10 },
  { key: 'crossDept', label: 'Бөлімаралық байланыс', max: 10 },
  { key: 'activity', label: 'Команданың белсенділігі', max: 10 },
  { key: 'teamAccount', label: 'Juz40_team аккаунты', max: 10 },
  { key: 'bonus', label: 'Бонус', max: 20 },
];

const isMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));

// Алматы уақытымен YYYY-MM-DD
function almatyDay(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date instanceof Date ? date : new Date(date));
}

function almatyHour(date) {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' })
    .format(date instanceof Date ? date : new Date(date));
  return Number(h);
}

function currentMonth(now = new Date()) {
  return almatyDay(now).slice(0, 7);
}

// Айдың бірінші және соңғы күні (YYYY-MM-DD)
function monthRange(month) {
  if (!isMonth(month)) throw new Error('Ай форматы YYYY-MM болуы керек');
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` };
}

// Күн тізбегі [start..end], тек дүйсенбі–жұма. Күндерді UTC түнімен
// жүргіземіз, сонда сервердің уақыт белдеуі нәтижеге әсер етпейді.
function workdays(start, end) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Бағалау кезеңі: ағымдағы ай болса — бүгінге дейін (аралық рейтинг әділ
// болсын, әлі келмеген күндер «видео жоқ» болып саналмасын).
function scoringWindow(month, now = new Date()) {
  const { start, end } = monthRange(month);
  const today = almatyDay(now);
  const effectiveEnd = today < end ? today : end;
  const days = effectiveEnd < start ? [] : workdays(start, effectiveEnd);
  return { start, end, effectiveEnd, workdays: days, isCurrent: today >= start && today <= end };
}

const round1 = (x) => Math.round(x * 10) / 10;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Орташа қаралым: 1000+ → 10, 500–1000 → 5..10, 0–500 → 0..5
function statScore(avg) {
  if (avg >= VIEW_TARGET_HIGH) return 10;
  if (avg >= VIEW_TARGET_LOW) return 5 + 5 * (avg - VIEW_TARGET_LOW) / (VIEW_TARGET_HIGH - VIEW_TARGET_LOW);
  return 5 * Math.max(0, avg) / VIEW_TARGET_LOW;
}

function stabilityScore(postedWorkdays, totalWorkdays) {
  if (!totalWorkdays) return 0;
  return clamp(postedWorkdays / totalWorkdays * 10, 0, 10);
}

// Juz40_team: кемінде 10 видео + жоғары қаралым. 10-ға жетпесе — әр видеоға
// 0,7; жетсе — 7 + орташа қаралымға қарай 3-ке дейін.
function teamAccountSuggestion(videos) {
  const n = videos.length;
  if (!n) return 0;
  if (n < TEAM_MIN_VIDEOS) return round1(n * 0.7);
  const avg = videos.reduce((a, v) => a + (v.views || 0), 0) / n;
  return round1(7 + 3 * clamp(avg / VIEW_TARGET_HIGH, 0, 1));
}

// Бөлімаралық: басқа бөлімді белгілеген әр видео — 2 балл, 10-ға дейін.
function crossDeptSuggestion(count) {
  return clamp(count * 2, 0, 10);
}

// Бонус: 15K+ әр видеоға 3 балл (10-ға дейін) + хештег тұрақты болса
// (видеолардың кемінде 80%-ында) 5 балл.
function bonusSuggestion(viralCount, tagShare) {
  return clamp(viralCount * 3, 0, 10) + (tagShare >= 0.8 ? 5 : 0);
}

const hasCompetitionTag = (v) => (v.hashtags || []).some((t) => TAGS.includes(String(t).toLowerCase()));

// Видеодағы @белгілер (сипаттамадан да, Apify-дың mentions өрісінен де)
function mentionsOf(v) {
  const set = new Set((v.mentions || []).map((m) => String(m).replace(/^@/, '').toLowerCase()));
  const re = /@([a-z0-9._]{2,32})/gi;
  let m;
  while ((m = re.exec(String(v.caption || ''))) !== null) set.add(m[1].toLowerCase().replace(/\.$/, ''));
  return [...set];
}

/**
 * Бір айдың рейтингі.
 * departments: [{id, name, username, teamTag}]
 * videos: [{departmentId, isTeam, postDay, views, likes, comments, shares, hashtags, mentions, caption}]
 * jury: { [departmentId]: {creativity, ethics, crossDept, activity, teamAccount, bonus} }
 */
function buildLeaderboard({ departments, videos, jury = {}, window }) {
  const workSet = new Set(window.workdays);
  const deptUsers = new Map(departments.map((d) => [String(d.username).toLowerCase(), d.id]));

  const rows = departments.map((d) => {
    const own = videos.filter((v) => !v.isTeam && v.departmentId === d.id);
    const views = own.map((v) => v.views || 0);
    const total = views.reduce((a, b) => a + b, 0);
    const avg = own.length ? total / own.length : 0;
    const postedDays = new Set(own.map((v) => v.postDay).filter((x) => workSet.has(x)));
    const likes = own.reduce((a, v) => a + (v.likes || 0), 0);
    const comments = own.reduce((a, v) => a + (v.comments || 0), 0);
    const shares = own.reduce((a, v) => a + (v.shares || 0), 0);
    const viral = own.filter((v) => (v.views || 0) >= VIRAL_VIEWS).length;
    const tagShare = own.length ? own.filter(hasCompetitionTag).length / own.length : 0;

    const crossVideos = own.filter((v) => mentionsOf(v).some((u) => deptUsers.has(u) && deptUsers.get(u) !== d.id));
    const tag = d.teamTag ? String(d.teamTag).replace(/^#/, '').toLowerCase() : '';
    const teamVideos = tag
      ? videos.filter((v) => v.isTeam && (v.hashtags || []).some((t) => String(t).toLowerCase() === tag))
      : [];

    const stability = round1(stabilityScore(postedDays.size, window.workdays.length));
    const statistics = round1(statScore(avg));

    const j = jury[d.id] || {};
    const juryValues = Object.fromEntries(JURY_FIELDS.map((f) => [f.key, j[f.key] ?? null]));
    const juryTotal = JURY_FIELDS.reduce((a, f) => a + (Number(juryValues[f.key]) || 0), 0);

    return {
      departmentId: d.id,
      name: d.name,
      username: d.username,
      videoCount: own.length,
      postedWorkdays: postedDays.size,
      totalWorkdays: window.workdays.length,
      totalViews: total,
      avgViews: Math.round(avg),
      medianViews: Math.round(median(views)),
      share500: own.length ? own.filter((v) => (v.views || 0) >= VIEW_TARGET_LOW).length / own.length : 0,
      engagement: total ? (likes + comments + shares) / total : 0,
      likes, comments, shares,
      viralCount: viral,
      tagShare,
      crossCount: crossVideos.length,
      teamCount: teamVideos.length,
      auto: { stability, statistics },
      suggestions: {
        crossDept: crossDeptSuggestion(crossVideos.length),
        teamAccount: tag ? teamAccountSuggestion(teamVideos) : null,
        bonus: bonusSuggestion(viral, tagShare),
      },
      jury: juryValues,
      juryComplete: JURY_FIELDS.every((f) => f.key === 'bonus' || juryValues[f.key] !== null),
      total: round1(stability + statistics + juryTotal),
    };
  });

  rows.sort((a, b) => b.total - a.total || b.totalViews - a.totalViews || a.name.localeCompare(b.name));
  let place = 0;
  rows.forEach((r, i) => {
    if (i === 0 || r.total !== rows[i - 1].total) place = i + 1;
    r.place = place;
  });
  return rows;
}

module.exports = {
  TZ, TAGS, JURY_FIELDS, VIRAL_VIEWS,
  isMonth, almatyDay, almatyHour, currentMonth, monthRange, workdays, scoringWindow,
  median, statScore, stabilityScore, teamAccountSuggestion, crossDeptSuggestion, bonusSuggestion,
  hasCompetitionTag, mentionsOf, buildLeaderboard,
};
