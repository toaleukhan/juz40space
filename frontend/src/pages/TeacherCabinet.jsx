// Мұғалімнің өз кабинеті: тек ӨЗІНІҢ апталық кестесі — қай уақытта сабағы
// бар, қай уақыт бос. Кесте scheduleData.js-те есім (full_name) бойынша
// сақталатындықтан, аккаунттың аты-жөні кестедегі жазылуымен дәл сәйкес
// келуі керек — сәйкес келмесе, кесте бос көрінеді де, төменде ескерту
// шығады.
import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { months, buildTeachersIndex, SUBJECT_COLORS } from './scheduleData';
import { loadOverrides, EMPTY_OVERRIDES } from './scheduleOverrides';
import { TeacherWeeklyTimeline } from './Schedule';
import { IconAlert } from '../components/icons';

export default function TeacherCabinet() {
  const me = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const [overrides, setOverrides] = useState(EMPTY_OVERRIDES);
  const [monthId, setMonthId] = useState('01');

  useEffect(() => {
    let cancelled = false;
    loadOverrides().then(o => { if (!cancelled) setOverrides(o); });
    return () => { cancelled = true; };
  }, []);

  const teachersIndex = useMemo(() => {
    const extraSmart = [
      ...(overrides.live?.[monthId] || []),
      ...(overrides.additional?.[monthId] || []),
    ];
    return buildTeachersIndex(monthId, 'ALL', {
      smart: extraSmart,
      junior: overrides.junior?.[monthId] || [],
    });
  }, [monthId, overrides]);

  // Кестеде деректері бар айлар ғана — бос айға ауысудың мағынасы жоқ
  const availableMonths = useMemo(() => {
    return months.filter(m => {
      const idx = buildTeachersIndex(m.id, 'ALL');
      return Object.keys(idx).length > 0;
    });
  }, []);

  const entries = teachersIndex[me.fullName] || [];
  const subject = entries[0]?.subject || me.subject;
  const col = SUBJECT_COLORS[subject] || { primary: '#1B6E7E' };
  const initials = (me.fullName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const sessions = entries.reduce((a, e) => a + e.times.length, 0);

  return (
    <div className="app-shell" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, padding: '32px clamp(16px, 4vw, 44px) 60px',
        maxWidth: 1100, margin: '0 auto', width: '100%',
        display: 'flex', flexDirection: 'column', gap: 18 }}>

        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            JUZ40 · Мұғалім кабинеті
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 0', color: 'var(--text)' }}>Менің кестем</h1>
        </div>

        {/* Профиль */}
        <div className="g-card" style={{ padding: '18px 22px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{
            width: 54, height: 54, borderRadius: '50%', background: `${col.primary}22`, color: col.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0,
          }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{me.fullName || me.username}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>{subject || '—'}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: col.primary, fontVariantNumeric: 'tabular-nums' }}>{sessions}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>сессия</div>
          </div>
        </div>

        {/* Ай таңдау */}
        {availableMonths.length > 1 && (
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--surface2)', width: 'fit-content' }}>
            {availableMonths.map(m => (
              <button key={m.id} onClick={() => setMonthId(m.id)}
                style={{
                  padding: '7px 18px', borderRadius: 9, fontSize: 12.5, border: 'none', cursor: 'pointer',
                  fontWeight: monthId === m.id ? 800 : 600,
                  background: monthId === m.id ? '#1B6E7E' : 'transparent',
                  color: monthId === m.id ? '#fff' : 'var(--text-sub)',
                }}>
                {m.name}
              </button>
            ))}
          </div>
        )}

        {entries.length === 0 ? (
          <div className="g-card" style={{ padding: '26px 22px', background: 'var(--surface)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <IconAlert style={{ width: 18, height: 18, color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Бұл айда кестеде сабақ табылмады
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Басқа айды таңдап көріңіз. Егер барлық айда бос болса, аккаунттағы аты-жөніңіз
                («{me.fullName}») кестедегі жазылуымен дәл сәйкес келмеуі мүмкін — администраторға айтыңыз.
              </div>
            </div>
          </div>
        ) : (
          <TeacherWeeklyTimeline entries={entries} />
        )}
      </main>
    </div>
  );
}
