import { useEffect, useState, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { SUBJECT_COLORS, SUBJECT_LOGOS } from './scheduleData';
import { motion } from 'framer-motion';
import { IconCheckCircle, IconAlert } from '../components/icons';

const SUBJECTS = [
  { code:'ФИЗ',   name:'Физика' },
  { code:'МАТ',   name:'Математика' },
  { code:'ТІЛ',   name:'Қазақ тілі' },
  { code:'БИО',   name:'Биология' },
  { code:'ИНФО',  name:'Информатика' },
  { code:'ГЕО',   name:'География' },
  { code:'ТАРИХ', name:'Қазақстан тарихы' },
  { code:'РУС',   name:'Орыс тілі' },
  { code:'ХИМ',   name:'Химия' },
  { code:'МС',    name:'Логика / МС' },
  { code:'ӘДЕБ',  name:'Қазақ әдебиеті' },
  { code:'АНГЛ',  name:'Ағылшын тілі' },
  { code:'ДЖТ',   name:'Дүниежүзі тарихы' },
];

// Ортақ/Орта балл түсіне қарай визуалды белгі (сан болса ғана бояйды)
function scoreColor(v) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return 'var(--text-muted)';
  if (n >= 80) return '#059669';
  if (n >= 60) return '#d97706';
  return '#dc2626';
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSubjectCode = searchParams.get('subject');
  const selectedSubject = SUBJECTS.find(s => s.code === currentSubjectCode) || null;

  const [status, setStatus] = useState({});
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/dashboard/status');
        setStatus(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStatus(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedSubject) return;
    setLoadingData(true);
    setError('');
    setData(null);
    (async () => {
      try {
        const { data } = await api.get(`/dashboard/${selectedSubject.code}/monthly`);
        setData(data);
      } catch (err) {
        setError(err.response?.data?.error || 'Дэшборд деректерін алу қатесі');
      } finally {
        setLoadingData(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSubjectCode]);

  const updateFilters = (newParams) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined) updated.delete(k);
      else updated.set(k, v);
    });
    setSearchParams(updated);
  };

  return (
    <div className="app-shell" style={{ background: 'var(--bg)', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '24px 32px', minWidth: 0, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              JUZ40 · БАСҚАРУ
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: '4px 0 0', letterSpacing: '-0.5px' }}>
              Дэшборд {selectedSubject ? `· ${selectedSubject.name}` : ''}
            </h1>
          </div>
          {selectedSubject && (
            <button onClick={() => updateFilters({ subject: null })}
              style={{ padding: '8px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-sub)', fontWeight: 600, fontSize: 12 }}>
              ← Барлық пәндер
            </button>
          )}
        </div>

        {!selectedSubject ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
            {SUBJECTS.map(s => {
              const col = SUBJECT_COLORS[s.code] || { primary: '#1B6E7E' };
              const svgLogo = SUBJECT_LOGOS[s.code];
              const connected = !!status[s.code];
              return (
                <motion.div
                  key={s.code}
                  whileHover={{ y: -6, boxShadow: `0 16px 32px ${col.primary}30` }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateFilters({ subject: s.code })}
                  className="card"
                  style={{
                    padding: '28px 22px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16,
                    position: 'relative', overflow: 'hidden', opacity: loadingStatus ? 0.6 : 1,
                  }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${col.primary}, ${col.secondary || col.primary})` }} />
                  <div style={{
                    width: 72, height: 72, borderRadius: 22,
                    background: `linear-gradient(135deg, ${col.primary}, ${col.secondary || col.primary})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 10px 24px ${col.primary}40`, padding: 16
                  }}>
                    {svgLogo && (
                      <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        dangerouslySetInnerHTML={{ __html: svgLogo }} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                      fontSize: 11, fontWeight: 700,
                      color: connected ? '#059669' : 'var(--text-muted)',
                    }}>
                      {connected
                        ? <><IconCheckCircle style={{ width: 12, height: 12 }} /> Қосылған</>
                        : <><IconAlert style={{ width: 12, height: 12 }} /> Әлі қосылмаған</>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : loadingData ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Жүктелуде...</div>
        ) : error ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: '#dc2626', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <IconAlert style={{ width: 20, height: 20 }} />
            {error}
          </div>
        ) : data && data.curators.length > 0 ? (
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text-sub)', fontWeight: 700 }}>
                    <th style={{ padding: '12px 16px', position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 1 }}>Куратор</th>
                    <th style={{ padding: '12px 16px' }}>Координатор</th>
                    {data.weeks.map(w => (
                      <th key={w} colSpan={3} style={{ padding: '12px 16px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>{w}</th>
                    ))}
                  </tr>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11 }}>
                    <th style={{ padding: '6px 16px', position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 1 }} />
                    <th />
                    {data.weeks.map(w => (
                      <Fragment key={w}>
                        <th style={{ padding: '6px 10px', borderLeft: '1px solid var(--border)', textAlign: 'center' }}>ПФ</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>СТ</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Орт.</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.curators.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--text)', position: 'sticky', left: 0, background: 'var(--surface)', whiteSpace: 'nowrap' }}>
                        {c.fullName}
                      </td>
                      <td style={{ padding: '11px 16px', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>{c.coordinator || '—'}</td>
                      {c.scores.map((sc, j) => (
                        <Fragment key={j}>
                          <td style={{ padding: '11px 10px', textAlign: 'center', borderLeft: '1px solid var(--border)', color: sc.pf ? 'var(--text)' : 'var(--text-muted)' }}>{sc.pf ?? '—'}</td>
                          <td style={{ padding: '11px 10px', textAlign: 'center', color: sc.st ? 'var(--text)' : 'var(--text-muted)' }}>{sc.st ?? '—'}</td>
                          <td style={{ padding: '11px 10px', textAlign: 'center', fontWeight: 700, color: sc.ortak ? scoreColor(sc.ortak) : 'var(--text-muted)' }}>{sc.ortak ?? '—'}</td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            Бұл кестеде әлі куратор жолдары табылмады
          </div>
        )}
      </main>
    </div>
  );
}
