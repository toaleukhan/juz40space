// scheduleUtils.js — Сабақ кестесіне қатысты таза (pure) көмекші функциялар мен
// сан константалары. JSX жоқ — тек деректерді өңдеу логикасы.

import {
  smartScheduleByMonth, smartAdditionalScheduleByMonth, juniorScheduleByMonth,
} from './scheduleData';
import { mergeDays } from './scheduleOverrides';

export const MIN_FREE_GAP = 11;

// Admin "Жариялау" арқылы DB-ге сақтаған нұсқа сол айға бар болса — соны негіз
// етіп аламыз (толық ауыстырады), болмаса ескі статикалық файл fallback болады.
export function pickBase(monthId, staticByMonth, publishedByMonth) {
  const pub = publishedByMonth?.[monthId];
  return (pub && pub.length) ? pub : (staticByMonth[monthId] || []);
}

// Merge smartScheduleByMonth (LIVE) and smartAdditionalScheduleByMonth (ҚОСЫМША)
// for a given month, according to which kinds are selected. Each lesson gets
// tagged with `_kind` ('live' | 'additional') so cards/badges can render correctly.
export function mergeSmartSchedule(monthId, kinds, overrides, published) {
  const ov = overrides || { live:{}, additional:{} };
  const pub = published || { smart:{}, smartAdditional:{} };
  const showLive = kinds.includes('live');
  const showAdditional = kinds.includes('additional');
  const liveDays = showLive ? mergeDays(pickBase(monthId, smartScheduleByMonth, pub.smart), ov.live?.[monthId]||[]) : [];
  const addDays  = showAdditional ? mergeDays(pickBase(monthId, smartAdditionalScheduleByMonth, pub.smartAdditional), ov.additional?.[monthId]||[]) : [];

  const dayNames = [...new Set([...liveDays.map(d=>d.day), ...addDays.map(d=>d.day)])];
  const DAY_ORDER_=['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі','Жексенбі'];
  dayNames.sort((a,b)=>DAY_ORDER_.indexOf(a)-DAY_ORDER_.indexOf(b));

  return dayNames.map(day => {
    const lDay = liveDays.find(d=>d.day===day);
    const aDay = addDays.find(d=>d.day===day);
    const lessons = [
      ...((lDay?.lessons)||[]).map(l=>({...l, _kind:'live'})),
      ...((aDay?.lessons)||[]).map(l=>({...l, _kind:'additional'})),
    ];
    return { day, type: lDay?.type || 'live', lessons };
  });
}

// ─── Уақыт utils ──────────────────────────────────────────────────────────────
export function timeToMinutes(t) {
  const clean = t.split(/[–\-]/)[0].trim().replace(/[^\d:]/g,'');
  const [h,m] = clean.split(':').map(Number);
  return h*60+(m||0);
}
export function minutesToTime(m) {
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
export function computeFreeSlots(allSlots, ws=13*60, we=19*60+30) {
  if (!allSlots.length) return [{ start:ws, end:we, free:true }];
  const sorted=[...allSlots].sort((a,b)=>a.start-b.start);
  const merged=[];
  for (const s of sorted) {
    if (merged.length && s.start-merged[merged.length-1].end<=MIN_FREE_GAP)
      merged[merged.length-1].end=Math.max(merged[merged.length-1].end,s.end);
    else merged.push({...s});
  }
  const result=[]; let cursor=ws;
  for (const s of merged) {
    if (s.start>cursor+MIN_FREE_GAP) result.push({start:cursor,end:s.start,free:true});
    const origs=sorted.filter(x=>x.start>=cursor&&x.end<=s.end&&x.start<s.end);
    if (origs.length>1) origs.forEach(x=>result.push({...x,free:false}));
    else result.push({...s,free:false});
    cursor=Math.max(cursor,s.end);
  }
  if (cursor<we) result.push({start:cursor,end:we,free:true});
  return result;
}
export function entriesToSlots(entries) {
  const slots=[];
  entries.forEach(e=>e.times.forEach(t=>{
    const p=t.split(/[–\-]/);
    if (p.length<2) return;
    const s=p[0].trim().replace(/[^\d:]/g,''), en=p[1].trim().replace(/[^\d:]/g,'');
    const [sh,sm]=s.split(':').map(Number),[eh,em]=en.split(':').map(Number);
    if (isNaN(sh)||isNaN(eh)) return;
    slots.push({start:sh*60+(sm||0),end:eh*60+(em||0),direction:e.direction,subject:e.subject,stream:e.stream,timeStr:t});
  }));
  return slots;
}

// ─── Calendar View utils ──────────────────────────────────────────────────────
export const CAL_DAYS  = ['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі'];
export const CAL_SHORT = ['ДҮЙ','СЕЙ','СӘР','БЕЙ','ЖҰМ','СЕН'];
export const SCHED_SET = new Set(['Сәрсенбі','Бейсенбі','Жұма']);
export const HOUR_H    = 92;
export const W_START   = 11;
export const W_END     = 20;
export const DAY_MIN_W = 168; // minimum width per day column so events never get crushed

export function parseTime(ts) {
  const pp = ts.split(/[–\-]/);
  if (pp.length < 2) return null;
  const clean = s => s.trim().replace(/[^\d:]/g,'');
  const toMin = s => { const [h,m] = s.split(':').map(Number); return isNaN(h) ? null : h*60+(m||0); };
  const start = toMin(clean(pp[0])), end = toMin(clean(pp[1]));
  if (start === null || end === null) return null;
  return { start, end };
}

// One card per individual time-block (each entry in a teacher's `times`
// array) instead of merging a teacher's whole day into one min→max span.
// This matters because consecutive blocks can belong to different
// subgroups (e.g. "13:00–14:30 (гум)" vs "16:20–17:50 (тех)").
export function buildCalEvents(filters, overrides, published) {
  const out = [];
  const ov = overrides || { live:{}, additional:{}, junior:{} };
  const pub = published || { smart:{}, smartAdditional:{}, junior:{} };

  const process = (sched, dir, kindTag) => {
    (sched[filters.month]||[]).forEach(db => {
      db.lessons.forEach(ls => {
        if (filters.dir !== 'Барлығы' && filters.dir !== dir) return;
        if (filters.subjects.length && !filters.subjects.includes(ls.subject)) return;
        const stream = ls.stream || db.stream || '';
        ls.teachers.forEach(tc => {
          tc.times.forEach(ts => {
            const p = parseTime(ts);
            if (!p) return;
            const note = ts.replace(/^[^(]*\(([^)]+)\).*$/, '$1');
            const hasNote = note !== ts;
            out.push({
              day: db.day, subject: ls.subject, stream, direction: dir, kind: kindTag,
              teachers: [tc.name], note: hasNote ? note : '',
              startMin: p.start, endMin: p.end,
            });
          });
        });
      });
    });
  };
  const kinds = filters.kinds || ['live','additional'];
  const liveMerged       = { [filters.month]: mergeDays(pickBase(filters.month, smartScheduleByMonth, pub.smart),           ov.live?.[filters.month]||[]) };
  const additionalMerged = { [filters.month]: mergeDays(pickBase(filters.month, smartAdditionalScheduleByMonth, pub.smartAdditional), ov.additional?.[filters.month]||[]) };
  const juniorMerged     = { [filters.month]: mergeDays(pickBase(filters.month, juniorScheduleByMonth, pub.junior),          ov.junior?.[filters.month]||[]) };
  if (filters.dir === 'SMART'  || filters.dir === 'Барлығы') {
    if (kinds.includes('live'))       process(liveMerged,       'SMART', 'live');
    if (kinds.includes('additional')) process(additionalMerged, 'SMART', 'additional');
  }
  if (filters.dir === 'JUNIOR' || filters.dir === 'Барлығы') process(juniorMerged, 'JUNIOR', 'live');

  // group by day
  const byDay = {}; CAL_DAYS.forEach(d => { byDay[d] = []; });
  out.forEach(ev => { byDay[ev.day]?.push(ev); });
  return byDay;
}

// ─── Teacher Weekly Visual Timeline utils ────────────────────────────────────
export const TL_START_MIN = 13 * 60;       // 780
export const TL_END_MIN   = 19 * 60 + 30;  // 1170
export const TL_RANGE     = TL_END_MIN - TL_START_MIN; // 390

export function toMin(s) {
  const c = s.trim().replace(/[^\d:]/g,'');
  const [h,m] = c.split(':').map(Number);
  return h*60+(m||0);
}

// ─── Lesson Entry Modal ───────────────────────────────────────────────────────
export const WEEKDAYS = ['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі','Жексенбі'];
export const NEW_TEACHER = '__new__';
