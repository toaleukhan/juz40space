import { describe, it, expect, vi } from 'vitest';

const S = require('./scoring');
const { normalizeItem, buildInput } = require('./apify');
const { computeInsights, parseAnalysis, generateAnalysis, buildAnalysisPrompt } = require('./insights');
const { mediaMayAccess } = require('../middleware/auth');
const { _internal: { cleanUsername, validateDept } } = require('../routes/tiktok');

describe('ай мен жұмыс күндері', () => {
  it('ай шекарасы, кібісе ақпан', () => {
    expect(S.monthRange('2026-10')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(S.monthRange('2028-02').end).toBe('2028-02-29');
    expect(() => S.monthRange('2026-13')).toThrow();
  });

  it('тек дүйсенбі–жұма', () => {
    const w = S.workdays('2026-10-01', '2026-10-31');
    expect(w).toHaveLength(22);
    expect(w).not.toContain('2026-10-03'); // сенбі
    expect(w).toContain('2026-10-05'); // дүйсенбі
  });

  it('ағымдағы айда бағалау бүгінге дейін жүреді', () => {
    const win = S.scoringWindow('2026-10', new Date('2026-10-06T08:00:00Z'));
    expect(win.effectiveEnd).toBe('2026-10-06');
    expect(win.workdays).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06']);
    expect(win.isCurrent).toBe(true);
    expect(S.scoringWindow('2026-09', new Date('2026-10-06T08:00:00Z')).workdays).toHaveLength(22);
  });

  it('Алматы уақытымен күн: UTC 20:00 — келесі күн', () => {
    expect(S.almatyDay('2026-10-05T20:30:00Z')).toBe('2026-10-06');
    expect(S.almatyHour('2026-10-05T20:30:00Z')).toBe(1);
  });
});

describe('ұпайлар', () => {
  it('статистика шкаласы', () => {
    expect(S.statScore(0)).toBe(0);
    expect(S.statScore(250)).toBe(2.5);
    expect(S.statScore(500)).toBe(5);
    expect(S.statScore(750)).toBe(7.5);
    expect(S.statScore(5000)).toBe(10);
  });

  it('Juz40_team ұсынысы', () => {
    expect(S.teamAccountSuggestion([])).toBe(0);
    expect(S.teamAccountSuggestion(Array(5).fill({ views: 100 }))).toBe(3.5);
    expect(S.teamAccountSuggestion(Array(10).fill({ views: 1000 }))).toBe(10);
    expect(S.teamAccountSuggestion(Array(10).fill({ views: 500 }))).toBe(8.5);
  });

  it('@белгілерді сипаттамадан да алады', () => {
    expect(S.mentionsOf({ caption: 'бірге түстік @Juz40_Math. мен @juz40_bio', mentions: ['@x_y'] }).sort())
      .toEqual(['juz40_bio', 'juz40_math', 'x_y']);
  });

  const window = S.scoringWindow('2026-09', new Date('2026-10-06T08:00:00Z'));
  const departments = [
    { id: 1, name: 'Физика', username: 'juz40_fiz', teamTag: 'juz40_fizika' },
    { id: 2, name: 'Математика', username: 'juz40_mat', teamTag: null },
  ];
  const v = (o) => ({ isTeam: false, views: 0, likes: 0, comments: 0, shares: 0, hashtags: [], mentions: [], caption: '', ...o });
  const videos = [
    v({ departmentId: 1, postDay: '2026-09-01', views: 1200, likes: 100, hashtags: ['juz40_life'], caption: 'бірге @juz40_mat' }),
    v({ departmentId: 1, postDay: '2026-09-01', views: 800, hashtags: ['juz40_life'] }),
    v({ departmentId: 1, postDay: '2026-09-06', views: 20000 }), // сенбі — тұрақтылыққа кірмейді
    v({ departmentId: 2, postDay: '2026-09-02', views: 300 }),
    v({ departmentId: 3, isTeam: true, postDay: '2026-09-03', views: 900, hashtags: ['juz40_fizika'] }),
  ];

  it('рейтинг: автомат ұпай, ұсыныстар, жюри, орын', () => {
    const rows = S.buildLeaderboard({ departments, videos, window, jury: { 2: { creativity: 9, ethics: 10 } } });
    const fiz = rows.find((r) => r.departmentId === 1);
    const mat = rows.find((r) => r.departmentId === 2);

    expect(fiz.videoCount).toBe(3);
    expect(fiz.postedWorkdays).toBe(1);
    expect(fiz.totalWorkdays).toBe(22);
    expect(fiz.auto.stability).toBe(0.5);
    expect(fiz.auto.statistics).toBe(10);
    expect(fiz.viralCount).toBe(1);
    expect(fiz.crossCount).toBe(1);
    expect(fiz.teamCount).toBe(1);
    expect(fiz.suggestions).toEqual({ crossDept: 2, teamAccount: 0.7, bonus: 3 });
    expect(fiz.total).toBe(10.5);

    expect(mat.suggestions.teamAccount).toBeNull();
    expect(mat.total).toBe(Math.round((0.5 + 3 + 19) * 10) / 10);
    expect(rows.map((r) => r.place)).toEqual([1, 2]);
    expect(rows[0].departmentId).toBe(2);
  });

  it('тең ұпайда орын бірдей', () => {
    const rows = S.buildLeaderboard({ departments, videos: [], window });
    expect(rows.map((r) => r.place)).toEqual([1, 1]);
  });
});

describe('Apify жолын келтіру', () => {
  it('өрістерді алады, кіші әріппен, Алматы күнімен', () => {
    const n = normalizeItem({
      id: '735', authorMeta: { name: 'Juz40_Fiz' }, createTimeISO: '2026-10-05T19:30:00.000Z',
      playCount: 1500, diggCount: 90, commentCount: 4, shareCount: 2,
      videoMeta: { duration: 23 }, musicMeta: { musicOriginal: true, musicName: 'original sound' },
      text: 'сабақтан кейін #Juz40_Life', hashtags: [{ name: 'Juz40_Life' }], mentions: ['@juz40_mat'],
      webVideoUrl: 'https://www.tiktok.com/@juz40_fiz/video/735',
    });
    expect(n).toMatchObject({
      id: '735', username: 'juz40_fiz', postDay: '2026-10-06', views: 1500, likes: 90,
      durationSec: 23, musicOriginal: true, hashtags: ['juz40_life'], mentions: ['juz40_mat'],
    });
  });

  it('жарамсыз жол → null', () => {
    expect(normalizeItem({ id: '1' })).toBeNull();
    expect(normalizeItem(null)).toBeNull();
    expect(normalizeItem({ id: '1', authorMeta: { name: 'a' }, createTimeISO: 'xx' })).toBeNull();
  });

  it('Apify сұранысы күн аралығымен', () => {
    expect(buildInput(['a'], '2026-10-01', '2026-10-06')).toMatchObject({
      profiles: ['a'], oldestPostDateUnified: '2026-10-01', newestPostDate: '2026-10-06', profileSorting: 'latest',
    });
  });
});

describe('инсайттар және ИИ', () => {
  const vids = Array.from({ length: 12 }, (_, i) => ({
    id: String(i), departmentId: 1, isTeam: false, postDay: '2026-09-0' + ((i % 5) + 1),
    postedAt: '2026-09-01T13:00:00Z', views: i < 6 ? 2000 : 300, likes: 10, comments: 1, shares: 0,
    durationSec: i < 6 ? 12 : 45, musicOriginal: i % 2 === 0, hashtags: i < 3 ? ['juz40_life'] : [], mentions: [], caption: 'x',
  }));

  it('белгі бойынша топтайды, ең жақсысын табады', () => {
    const ins = computeInsights(vids);
    expect(ins.overall.count).toBe(12);
    const dur = ins.dimensions.find((d) => d.key === 'duration');
    expect(dur.buckets.map((b) => b.label)).toEqual(['15 сек-қа дейін', '30–60 сек']);
    expect(dur.best).toBe('15 сек-қа дейін');
    expect(ins.top[0].views).toBe(2000);
    expect(ins.bottom[0].views).toBe(300);
  });

  it('ИИ жауабын тазалайды', () => {
    const r = parseAnalysis('```json\n{"summary":"ok","works":["a",""],"weak":[],"departments":[{"name":"Физика","advice":["x"]},{"advice":[]}],"ideas":["i"]}\n```');
    expect(r).toEqual({ summary: 'ok', works: ['a'], weak: [], departments: [{ name: 'Физика', advice: ['x'] }], ideas: ['i'] });
    expect(() => parseAnalysis('жоқ')).toThrow();
  });

  it('Gemini-ге схемамен шақырады', async () => {
    const call = vi.fn().mockResolvedValue('{"summary":"Ай жақсы","works":[],"weak":[],"departments":[],"ideas":[]}');
    const input = {
      month: '2026-09',
      leaderboard: S.buildLeaderboard({ departments: [{ id: 1, name: 'Физика', username: 'f' }], videos: vids, window: S.scoringWindow('2026-09', new Date('2026-10-06')) }),
      insights: computeInsights(vids),
      departmentsById: { 1: { name: 'Физика' } },
    };
    const out = await generateAnalysis(input, { apiKey: 'k', call });
    expect(out.summary).toBe('Ай жақсы');
    expect(call.mock.calls[0][1].responseSchema.required).toContain('ideas');
    expect(buildAnalysisPrompt(input).userText).toContain('Физика');
  });

  it('кілтсіз — қате', async () => {
    await expect(generateAnalysis({}, { apiKey: '' })).rejects.toThrow('GEMINI_API_KEY');
  });
});

describe('media рөлі', () => {
  it('тек TikTok пен auth', () => {
    expect(mediaMayAccess('media', '/api/tiktok/overview?month=2026-10')).toBe(true);
    expect(mediaMayAccess('media', '/api/auth/me')).toBe(true);
    expect(mediaMayAccess('media', '/api/st-recordings')).toBe(false);
    expect(mediaMayAccess('media', '/api/tiktokx')).toBe(false);
    expect(mediaMayAccess('admin', '/api/st-recordings')).toBe(true);
  });

  it('username-ді сілтемеден де алады', () => {
    expect(cleanUsername('https://www.tiktok.com/@Juz40_Fiz?lang=ru')).toBe('juz40_fiz');
    expect(cleanUsername('@juz40.bio')).toBe('juz40.bio');
    expect(validateDept({ name: '', username: 'x y' }).errors).toHaveLength(2);
    expect(validateDept({ isTeamAccount: true, username: 'juz40_team' }).value.name).toBe('Juz40_team');
  });
});
