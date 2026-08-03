import { describe, it, expect } from 'vitest';
import {
  getFilterWeekStart,
  toLocalISODate,
  isoDateOfDay,
  minutesToTime,
  layoutDayBookings,
} from './WeekBookingCalendar';

// СТ аптасы бейсенбіден келесі сәрсенбіге дейін созылады, сондықтан
// дүйсенбі-сәрсенбіде алынған СТ аптаның СОҢЫНА түседі. Сапа бөлімінің
// "SMART | СТ ЗАПИСЬ" кестесімен тексерілген нүктелер: 1-ай/3-аптада СТ
// 27.07-де, 1-ай/4-аптада 03.08-де алынған.
describe('getFilterWeekStart', () => {
  it('starts month 1 / week 1 on a Thursday', () => {
    const d = getFilterWeekStart(1, 1);
    expect(toLocalISODate(d)).toBe('2026-07-09');
    expect(d.getDay()).toBe(4); // бейсенбі
  });

  it('advances by 7 days per week within the same month', () => {
    expect(toLocalISODate(getFilterWeekStart(1, 3))).toBe('2026-07-23');
    expect(toLocalISODate(getFilterWeekStart(1, 4))).toBe('2026-07-30');
  });

  it('rolls over into the next month after 4 weeks', () => {
    expect(toLocalISODate(getFilterWeekStart(2, 1))).toBe('2026-08-06');
  });

  // Ең маңызды тексеріс: кестедегі СТ күні дәл сол аптаның ішіне түсуі керек.
  it.each([
    [1, 3, '2026-07-27'],
    [1, 4, '2026-08-03'],
  ])('week %i/%i contains the sheet\'s СТ Monday %s', (month, week, stDate) => {
    const start = getFilterWeekStart(month, week);
    const days = Array.from({ length: 7 }, (_, i) => isoDateOfDay(start, i));
    expect(days).toContain(stDate);
  });
});

describe('toLocalISODate', () => {
  it('formats using local getters, not toISOString (avoids UTC day-shift)', () => {
    // GMT+5-те түн ортасы жергілікті уақыт — toISOString() қолданса,
    // UTC-ге ауысып, бір күн артқа сырғып кетер еді.
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('zero-pads single-digit month and day', () => {
    expect(toLocalISODate(new Date(2026, 8, 3))).toBe('2026-09-03');
  });
});

describe('isoDateOfDay', () => {
  it('returns the week start itself at dayIndex 0', () => {
    const start = getFilterWeekStart(1, 4);
    expect(isoDateOfDay(start, 0)).toBe('2026-07-30');
  });

  it('rolls over the month boundary correctly at dayIndex 6 (last day)', () => {
    const start = getFilterWeekStart(1, 4);
    expect(isoDateOfDay(start, 6)).toBe('2026-08-05');
  });
});

describe('minutesToTime', () => {
  it.each([
    [0, '00:00'],
    [90, '01:30'],
    [600, '10:00'],
    [1439, '23:59'],
  ])('converts %i minutes to %s', (min, expected) => {
    expect(minutesToTime(min)).toBe(expected);
  });
});

describe('layoutDayBookings', () => {
  const booking = (id, start, end) => ({ id, start_time: start, end_time: end });

  it('gives a single booking the full column', () => {
    const [b] = layoutDayBookings([booking(1, '09:00', '10:00')]);
    expect(b._cf).toBe(0);
    expect(b._wf).toBe(1);
  });

  it('gives non-overlapping bookings the full column each', () => {
    const result = layoutDayBookings([
      booking(1, '09:00', '10:00'),
      booking(2, '11:00', '12:00'),
    ]);
    expect(result.every(b => b._wf === 1 && b._cf === 0)).toBe(true);
  });

  it('splits two time-overlapping bookings into two side-by-side columns', () => {
    const result = layoutDayBookings([
      booking(1, '13:00', '14:00'),
      booking(2, '13:30', '14:30'),
    ]);
    const wfs = result.map(b => b._wf).sort();
    const cfs = result.map(b => b._cf).sort((a, b) => a - b);
    expect(wfs).toEqual([0.5, 0.5]);
    expect(cfs).toEqual([0, 0.5]);
  });

  it('splits a three-way overlap into three equal columns', () => {
    const result = layoutDayBookings([
      booking(1, '15:00', '16:00'),
      booking(2, '15:05', '16:05'),
      booking(3, '15:10', '16:10'),
    ]);
    result.forEach(b => expect(b._wf).toBeCloseTo(1 / 3));
    const cfs = result.map(b => b._cf).sort((a, b) => a - b);
    expect(cfs).toEqual([0, 1 / 3, 2 / 3]);
  });

  it('does not treat back-to-back bookings (end === next start) as overlapping', () => {
    const result = layoutDayBookings([
      booking(1, '09:00', '10:00'),
      booking(2, '10:00', '11:00'),
    ]);
    expect(result.every(b => b._wf === 1)).toBe(true);
  });
});
