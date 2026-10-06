// «Қандай видео көбірек өтеді?» — айдың видеоларын белгілер бойынша
// топтап (ұзақтығы, күні, сағаты, дыбысы, хештегі, бірлескен видео,
// сипаттама ұзындығы) орташа/медиана қаралымды салыстырады. Бұл — сандық
// факт; Gemini анализі осы кестені және ең үздік/әлсіз видеоларды алады.

const { median, almatyHour, hasCompetitionTag, mentionsOf } = require('./scoring');
const gemini = require('../custdev/gemini');

const { GeminiError } = gemini;

const WEEKDAYS = ['Жексенбі', 'Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі'];
const MIN_BUCKET = 3; // одан аз видеосы бар топ «ең үздік» деп саналмайды

const DIMENSIONS = [
  {
    key: 'duration', label: 'Ұзақтығы',
    order: ['15 сек-қа дейін', '15–30 сек', '30–60 сек', '1 мин+'],
    of: (v) => {
      const d = v.durationSec || 0;
      if (!d) return null;
      if (d < 15) return '15 сек-қа дейін';
      if (d < 30) return '15–30 сек';
      if (d < 60) return '30–60 сек';
      return '1 мин+';
    },
  },
  {
    key: 'weekday', label: 'Апта күні',
    order: WEEKDAYS.slice(1).concat(WEEKDAYS[0]),
    of: (v) => WEEKDAYS[new Date(`${v.postDay}T00:00:00Z`).getUTCDay()],
  },
  {
    key: 'hour', label: 'Жариялау уақыты',
    order: ['Таң (06–10)', 'Түске дейін (10–13)', 'Түстен кейін (13–17)', 'Кеш (17–20)', 'Түн (20–24)', 'Түнгі (00–06)'],
    of: (v) => {
      if (!v.postedAt) return null;
      const h = almatyHour(v.postedAt);
      if (h < 6) return 'Түнгі (00–06)';
      if (h < 10) return 'Таң (06–10)';
      if (h < 13) return 'Түске дейін (10–13)';
      if (h < 17) return 'Түстен кейін (13–17)';
      if (h < 20) return 'Кеш (17–20)';
      return 'Түн (20–24)';
    },
  },
  {
    key: 'music', label: 'Дыбыс',
    order: ['Дайын дыбыс', 'Өз дыбысы'],
    of: (v) => (v.musicOriginal === null || v.musicOriginal === undefined ? null
      : v.musicOriginal ? 'Өз дыбысы' : 'Дайын дыбыс'),
  },
  {
    key: 'tag', label: '#Juz40_life / #Juz40_moments',
    order: ['Хештег бар', 'Хештег жоқ'],
    of: (v) => (hasCompetitionTag(v) ? 'Хештег бар' : 'Хештег жоқ'),
  },
  {
    key: 'collab', label: 'Бірлескен видео (@белгі)',
    order: ['Біреу белгіленген', 'Белгі жоқ'],
    of: (v) => (mentionsOf(v).length ? 'Біреу белгіленген' : 'Белгі жоқ'),
  },
  {
    key: 'caption', label: 'Сипаттама',
    order: ['Қысқа (60 таңбаға дейін)', 'Ұзын (60+)'],
    of: (v) => (String(v.caption || '').replace(/#\S+/g, '').trim().length < 60 ? 'Қысқа (60 таңбаға дейін)' : 'Ұзын (60+)'),
  },
];

function bucketStats(list) {
  const views = list.map((v) => v.views || 0);
  const total = views.reduce((a, b) => a + b, 0);
  const inter = list.reduce((a, v) => a + (v.likes || 0) + (v.comments || 0) + (v.shares || 0), 0);
  return {
    count: list.length,
    avgViews: list.length ? Math.round(total / list.length) : 0,
    medianViews: Math.round(median(views)),
    engagement: total ? inter / total : 0,
  };
}

function computeInsights(videos) {
  const own = videos.filter((v) => !v.isTeam);
  const overall = bucketStats(own);
  const dimensions = DIMENSIONS.map((dim) => {
    const groups = new Map();
    own.forEach((v) => {
      const k = dim.of(v);
      if (!k) return;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(v);
    });
    const buckets = dim.order.filter((k) => groups.has(k)).map((k) => ({ label: k, ...bucketStats(groups.get(k)) }));
    // Медиана бойынша салыстырамыз: бір вирусты видео орташаны бұрмалайды.
    const eligible = buckets.filter((b) => b.count >= MIN_BUCKET);
    const best = eligible.length > 1 ? eligible.reduce((a, b) => (b.medianViews > a.medianViews ? b : a)) : null;
    const lift = best && overall.medianViews ? best.medianViews / overall.medianViews : null;
    return { key: dim.key, label: dim.label, buckets, best: best ? best.label : null, lift };
  }).filter((d) => d.buckets.length > 1);

  const sorted = [...own].sort((a, b) => (b.views || 0) - (a.views || 0));
  return { overall, dimensions, top: sorted.slice(0, 10), bottom: sorted.slice(-10).reverse() };
}

/* ───────────── Gemini ───────────── */

const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    works: { type: 'ARRAY', items: { type: 'STRING' } },
    weak: { type: 'ARRAY', items: { type: 'STRING' } },
    departments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, advice: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['name', 'advice'],
      },
    },
    ideas: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['summary', 'works', 'weak', 'departments', 'ideas'],
};

const short = (v, deptName) => ({
  бөлім: deptName(v),
  күні: v.postDay,
  қаралым: v.views, лайк: v.likes, коммент: v.comments, бөлісу: v.shares,
  ұзақтығы_сек: v.durationSec || null,
  өз_дыбысы: v.musicOriginal,
  сипаттама: String(v.caption || '').slice(0, 300),
});

function buildAnalysisPrompt({ month, leaderboard, insights, departmentsById }) {
  const deptName = (v) => departmentsById[v.departmentId]?.name || '—';
  const systemInstruction = [
    'Сен JUZ40 онлайн-білім беру компаниясының медиа-аналитигісің.',
    'Компанияның әр бөлімі өз TikTok парақшасын жүргізеді және бөлімдер өзара жарысады.',
    'Жарыстың мақсаты: жұмыс процесінің қызықты, шынайы, позитивті вайбын, ішкі атмосфераны көрсету.',
    'Критерийлер: тұрақтылық (күнде видео), креативтілік, этика, статистика (орташа 500–1000+ қаралым),',
    'бөлімаралық бірлескен видеолар, команданың белсенділігі, Juz40_team аккаунтына атсалысу;',
    'бонус: 15K+ қаралым, #Juz40_life және #Juz40_moments хештегтері.',
    '',
    'Ережелер:',
    '- Тек берілген деректерге сүйен, сандарды дәл келтір, ойдан факт қоспа.',
    '- Видеоны көрмейсің — тек сипаттамасы мен статистикасын көресің; тақырып туралы',
    '  қорытындыны сипаттамадан шығар және мұны асыра сенімді айтпа.',
    '- Аз видеолы топтан (3-тен аз) қатаң қорытынды жасама.',
    '- Барлығын қазақ тілінде, қысқа әрі нақты жаз: әр пункт 1–2 сөйлем.',
    '- summary: 2–4 сөйлем — айдың басты қорытындысы.',
    '- works: 3–6 пункт — не жақсы өтті (дерекпен).',
    '- weak: 2–5 пункт — не өтпеді / неге назар аудару керек.',
    '- departments: әр бөлімге 2–3 нақты ұсыныс (рейтингтегі барлық бөлім).',
    '- ideas: келесі айға 4–6 видео идеясы — жұмыс процесі мен ішкі атмосфераға сай.',
  ].join('\n');

  const payload = {
    ай: month,
    рейтинг: leaderboard.map((r) => ({
      орын: r.place, бөлім: r.name, видео: r.videoCount,
      видео_шыққан_жұмыс_күні: `${r.postedWorkdays}/${r.totalWorkdays}`,
      орташа_қаралым: r.avgViews, медиана_қаралым: r.medianViews,
      engagement_пайыз: Math.round(r.engagement * 1000) / 10,
      қаралымы_15K_асқан: r.viralCount, хештег_үлесі_пайыз: Math.round(r.tagShare * 100),
      бірлескен_видео: r.crossCount,
    })),
    жалпы: insights.overall,
    белгілер_бойынша: insights.dimensions.map((d) => ({ белгі: d.label, топтар: d.buckets })),
    ең_көп_қаралған: insights.top.map((v) => short(v, deptName)),
    ең_аз_қаралған: insights.bottom.map((v) => short(v, deptName)),
  };

  return { systemInstruction, userText: `ДЕРЕКТЕР (JSON):\n${JSON.stringify(payload)}` };
}

function parseAnalysis(raw) {
  let text = String(raw || '').trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1].trim();
  let data;
  try { data = JSON.parse(text); } catch { throw new GeminiError('Модельдің жауабы JSON емес', 'bad_response'); }
  const list = (x) => (Array.isArray(x) ? x.map((s) => String(s).trim()).filter(Boolean) : []);
  return {
    summary: String(data?.summary || '').trim(),
    works: list(data?.works),
    weak: list(data?.weak),
    departments: Array.isArray(data?.departments)
      ? data.departments.map((d) => ({ name: String(d?.name || '').trim(), advice: list(d?.advice) })).filter((d) => d.name)
      : [],
    ideas: list(data?.ideas),
  };
}

async function generateAnalysis(input, deps = {}) {
  const apiKey = deps.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError('GEMINI_API_KEY орнатылмаған', 'no_key');
  const prompt = buildAnalysisPrompt(input);
  const call = deps.call || gemini.callGemini;
  const raw = await call(prompt, { apiKey, model: deps.model, responseSchema: ANALYSIS_SCHEMA, temperature: 0.4, timeoutMs: 90000 });
  const result = parseAnalysis(raw);
  if (!result.summary) throw new GeminiError('Модель қорытынды жазбады', 'bad_response');
  return result;
}

module.exports = { DIMENSIONS, computeInsights, buildAnalysisPrompt, parseAnalysis, generateAnalysis };
