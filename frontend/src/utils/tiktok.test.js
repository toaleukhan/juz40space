import { describe, it, expect } from 'vitest';
import { monthLabel, shiftMonth, daysOfMonth, postingMatrix, fmtCompact, parseScore, currentMonth } from './tiktok';

describe('tiktok utils', () => {
  it('ай атауы мен ауысуы', () => {
    expect(monthLabel('2026-10')).toBe('Қазан 2026');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(currentMonth(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10');
  });

  it('айдың күндері және демалыс', () => {
    const d = daysOfMonth('2026-10');
    expect(d).toHaveLength(31);
    expect(d[2]).toMatchObject({ iso: '2026-10-03', weekend: true });
    expect(d[4].weekend).toBe(false);
  });

  it('күнтізбе матрицасы', () => {
    const m = postingMatrix([
      { departmentId: 1, postDay: '2026-10-01', views: 10 },
      { departmentId: 1, postDay: '2026-10-01', views: 5 },
      { departmentId: 2, postDay: '2026-10-02', views: 1 },
    ]);
    expect(m[1]['2026-10-01']).toEqual({ count: 2, views: 15 });
    expect(m[2]['2026-10-02'].count).toBe(1);
  });

  it('сандарды қысқарту', () => {
    expect(fmtCompact(950)).toBe('950');
    expect(fmtCompact(1200)).toBe('1,2K');
    expect(fmtCompact(1000)).toBe('1K');
    expect(fmtCompact(15300)).toBe('15K');
    expect(fmtCompact(1250000)).toBe('1,3M');
  });

  it('жюри ұпайы', () => {
    expect(parseScore('')).toBeNull();
    expect(parseScore('7,5')).toBe(7.5);
    expect(Number.isNaN(parseScore('abc'))).toBe(true);
  });
});
