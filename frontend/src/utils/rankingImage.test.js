import { describe, it, expect } from 'vitest';
import { buildImageModel } from './rankingImage';

describe('рейтинг суретінің деректері', () => {
  const data = {
    month: '2026-10',
    window: { isCurrent: true, effectiveEnd: '2026-10-06' },
    leaderboard: [
      { departmentId: 1, place: 1, name: 'САПА', username: 'juz40_sapa', videoCount: 3, totalViews: 900, total: 20 },
      { departmentId: 2, place: 2, name: 'IT', username: 'juz40.it', videoCount: 1, totalViews: 16000, total: 15 },
    ],
    videos: [
      { departmentId: 1, views: 100 }, { departmentId: 1, views: 700 }, { departmentId: 1, views: 100 },
      { departmentId: 2, views: 16000 }, { departmentId: 9, isTeam: true, views: 99999 },
    ],
  };

  it('ең көп қаралым, жеңімпаз, жиынтық', () => {
    const m = buildImageModel(data);
    expect(m.month).toBe('Қазан 2026');
    expect(m.status).toContain('06.10.2026');
    expect(m.winners.map((w) => w.name)).toEqual(['САПА']);
    expect(m.rows.map((r) => r.maxViews)).toEqual([700, 16000]);
    expect(m.totals).toEqual({ videos: 4, views: 16900 });
    expect(m.gap).toBe(5);
    expect(m.runnerUp).toBe('IT');
    expect(m.mostActive).toEqual({ name: 'САПА', videos: 3 });
    expect(m.monthNo).toBe(10);
  });

  it('тең ұпай және қалған жұмыс күндері', () => {
    const tie = { ...data,
      leaderboard: data.leaderboard.map((r) => ({ ...r, place: 1, total: 20 })),
      allDays: { start: '2026-10-01', end: '2026-10-31' },
      window: { isCurrent: true, effectiveEnd: '2026-10-06', workdays: ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'] } };
    const m = buildImageModel(tie);
    expect(m.winners).toHaveLength(2);
    expect(m.gap).toBeNull();
    expect(m.daysLeft).toBe(22 - 4);
  });

  it('аяқталған ай — қорытынды', () => {
    expect(buildImageModel({ ...data, window: { isCurrent: false, effectiveEnd: '2026-09-30' } }).status).toBe('Айдың қорытындысы');
  });
});
