import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  smartScheduleByMonth, SUBJECT_COLORS,
  LIVE_START_DATE, ADDITIONAL_START_DATE, getMonthIdForDate,
} from '../pages/scheduleData';
import { loadOverrides, mergeDays, DAY_ORDER } from '../pages/scheduleOverrides';

const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 22;

function formatKkDateTime(date) {
  const day = DAY_ORDER[(date.getDay() + 6) % 7];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${day}, ${hh}:${mm}`;
}

// "13:00–14:00" → { start: Date, end: Date } (baseDate-тің күні бойынша)
function parseTimeRange(timeStr, baseDate) {
  const parts = timeStr.split(/[–\-]/).map(s => s.trim());
  if (parts.length < 2) return null;
  const mk = (t) => {
    const clean = t.replace(/[^\d:]/g, '');
    const [h, m] = clean.split(':').map(Number);
    if (Number.isNaN(h)) return null;
    const d = new Date(baseDate);
    d.setHours(h, m || 0, 0, 0);
    return d;
  };
  const start = mk(parts[0]);
  const end = mk(parts[1]);
  if (!start || !end) return null;
  return { start, end };
}

export default function LiveScheduleWidget() {
  const [now, setNow] = useState(new Date());
  const [overrides, setOverrides] = useState(null);

  useEffect(() => { loadOverrides().then(setOverrides); }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const monthId = useMemo(() => getMonthIdForDate(now), [now]);
  const todayName = DAY_ORDER[(now.getDay() + 6) % 7];

  const todayEntries = useMemo(() => {
    const base = smartScheduleByMonth[monthId] || [];
    const overrideDays = overrides?.live?.[monthId] || [];
    const merged = mergeDays(base, overrideDays);
    const dayBlock = merged.find(d => d.day === todayName);
    const entries = [];
    (dayBlock?.lessons || []).forEach(lesson => {
      (lesson.teachers || []).forEach(t => {
        (t.times || []).forEach(timeStr => {
          const range = parseTimeRange(timeStr, now);
          if (range) entries.push({ subject: lesson.subject, teacher: t.name, timeStr, ...range });
        });
      });
    });
    return entries.sort((a, b) => a.start - b.start);
  }, [monthId, todayName, overrides, now]);

  const isBeforeLive = now < LIVE_START_DATE;
  const isAdditionalPending = now < ADDITIONAL_START_DATE;
  const daysUntilLive = Math.max(0, Math.ceil((LIVE_START_DATE - now) / 86400000));

  const currentLesson = !isBeforeLive ? todayEntries.find(e => now >= e.start && now < e.end) : null;
  const nextLesson = !isBeforeLive && !currentLesson ? todayEntries.find(e => e.start > now) : null;

  const dayStart = new Date(now); dayStart.setHours(TIMELINE_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(now); dayEnd.setHours(TIMELINE_END_HOUR, 0, 0, 0);
  const totalMs = dayEnd - dayStart;
  const nowPct = Math.min(100, Math.max(0, ((now - dayStart) / totalMs) * 100));

  return (
    <div className="g-card" style={{
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
      boxShadow: 'var(--card-shadow)', width: '100%', maxWidth: 560,
    }}>
      <style>{`
        @keyframes liveWidgetBlink { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
        .lsw-live-dot {
          display:inline-block; width:7px; height:7px; border-radius:50%;
          background:#ef4444; animation: liveWidgetBlink 1.2s ease-in-out infinite;
        }
      `}</style>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Қазір не болып жатыр</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{formatKkDateTime(now)}</div>
      </div>

      <AnimatePresence mode="wait">
        {isBeforeLive ? (
          <motion.div key="before_live" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 600 }}>
              SMART LIVE сабақтары әлі басталған жоқ
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
              {daysUntilLive} күн қалды
            </div>
          </motion.div>
        ) : currentLesson ? (
          <motion.div key="current" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="lsw-live-dot" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                {currentLesson.subject} · {currentLesson.teacher}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{currentLesson.timeStr}</div>
            </div>
          </motion.div>
        ) : nextLesson ? (
          <motion.div key="next" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 600 }}>
              Келесі сабақ: {nextLesson.timeStr.split(/[–\-]/)[0].trim()} — {nextLesson.subject}
            </div>
          </motion.div>
        ) : (
          <motion.div key="none" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Бүгін сабақ жоқ</div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isBeforeLive && (
        <div style={{ position: 'relative', height: 20, background: 'var(--surface2)', borderRadius: 8, marginTop: 4 }}>
          {todayEntries.map((e, i) => {
            const s = e.start < dayStart ? dayStart : e.start;
            const en = e.end > dayEnd ? dayEnd : e.end;
            if (en <= s) return null;
            const left = ((s - dayStart) / totalMs) * 100;
            const width = ((en - s) / totalMs) * 100;
            const color = SUBJECT_COLORS[e.subject]?.primary || 'var(--accent)';
            return (
              <div key={i} title={`${e.subject} · ${e.teacher} · ${e.timeStr}`}
                style={{
                  position: 'absolute', top: 2, bottom: 2,
                  left: `${left}%`, width: `${Math.max(width, 1)}%`,
                  background: color, borderRadius: 5, opacity: 0.85,
                }} />
            );
          })}
          <div style={{
            position: 'absolute', top: -3, bottom: -3, left: `${nowPct}%`, width: 2,
            background: '#ef4444', boxShadow: '0 0 6px #ef4444', borderRadius: 2,
            transition: 'left 60s linear',
          }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: -14,
            display: 'flex', justifyContent: 'space-between',
            fontSize: 9, color: 'var(--text-muted)', fontWeight: 600,
          }}>
            <span>{TIMELINE_START_HOUR}:00</span>
            <span>{TIMELINE_END_HOUR}:00</span>
          </div>
        </div>
      )}

      {isAdditionalPending && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', paddingTop: !isBeforeLive ? 10 : 0 }}>
          Қосымша сабақтар тамыз айынан басталады
        </div>
      )}
    </div>
  );
}
