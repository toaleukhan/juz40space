import { useMemo } from 'react';
import {
  SUBJECT_COLORS, smartScheduleByMonth, smartAdditionalScheduleByMonth,
  juniorScheduleByMonth, getMonthIdForDate,
} from '../pages/scheduleData';

function countLessons(days) {
  let lessonCount = 0;
  const bySubject = {};
  const byTeacher = {};
  (days || []).forEach(d => (d.lessons || []).forEach(l => {
    lessonCount++;
    bySubject[l.subject] = (bySubject[l.subject] || 0) + 1;
    (l.teachers || []).forEach(t => { byTeacher[t.name] = (byTeacher[t.name] || 0) + 1; });
  }));
  return { lessonCount, bySubject, byTeacher };
}

function topEntry(obj) {
  let bestKey = null, bestVal = 0;
  Object.entries(obj).forEach(([k, v]) => { if (v > bestVal) { bestKey = k; bestVal = v; } });
  return bestKey ? { key: bestKey, count: bestVal } : null;
}

function mergeCounts(...maps) {
  const out = {};
  maps.forEach(m => Object.entries(m).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; }));
  return out;
}

export default function StatsWidget() {
  const stats = useMemo(() => {
    const monthId = getMonthIdForDate(new Date());
    const live = countLessons(smartScheduleByMonth[monthId]);
    const additional = countLessons(smartAdditionalScheduleByMonth[monthId]);
    const junior = countLessons(juniorScheduleByMonth[monthId]);

    const mergedSubject = mergeCounts(live.bySubject, additional.bySubject, junior.bySubject);
    const mergedTeacher = mergeCounts(live.byTeacher, additional.byTeacher, junior.byTeacher);

    const totalLessons = live.lessonCount + additional.lessonCount;
    const livePct = totalLessons ? Math.round((live.lessonCount / totalLessons) * 100) : 0;

    return {
      subjectCount: Object.keys(SUBJECT_COLORS).length,
      teacherCount: Object.keys(mergedTeacher).length,
      livePct, additionalPct: 100 - livePct,
      liveCount: live.lessonCount, additionalCount: additional.lessonCount,
      busiestTeacher: topEntry(mergedTeacher),
      busiestSubject: topEntry(mergedSubject),
    };
  }, []);

  const Stat = ({ label, value }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3, fontWeight: 600 }}>{label}</div>
    </div>
  );

  return (
    <div className="g-card" style={{
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
      boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
        Аналитика (тек admin)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <Stat label="Пәндер" value={stats.subjectCount} />
        <Stat label="Мұғалімдер" value={stats.teacherCount} />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-sub)', fontWeight: 600, marginBottom: 5 }}>
          <span>● LIVE {stats.liveCount}</span>
          <span>➕ ҚОСЫМША {stats.additionalCount}</span>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)' }}>
          <div style={{ width: `${stats.livePct}%`, background: '#ef4444' }} />
          <div style={{ width: `${stats.additionalPct}%`, background: '#f97316' }} />
        </div>
      </div>

      {(stats.busiestTeacher || stats.busiestSubject) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          {stats.busiestTeacher && (
            <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>
              Ең жүктелген мұғалім: <b style={{ color: 'var(--text)' }}>{stats.busiestTeacher.key}</b> ({stats.busiestTeacher.count})
            </div>
          )}
          {stats.busiestSubject && (
            <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>
              Ең жүктелген пән: <b style={{ color: 'var(--text)' }}>{stats.busiestSubject.key}</b> ({stats.busiestSubject.count})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
