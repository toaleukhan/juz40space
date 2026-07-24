import { useEffect, useState, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { SUBJECT_COLORS, SUBJECT_LOGOS } from './scheduleData';
import { motion } from 'framer-motion';
import { IconCheckCircle, IconAlert, IconChart, IconUsers, IconTable } from '../components/icons';
import { TrendLine, BarRow, RingStat } from '../components/charts';

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

// Google Sheets қазақстандық локальде ондық үтірмен қайтарады ("8,00") —
// санға айналдырмас бұрын үтірді нүктеге ауыстырамыз.
function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function scoreColorByValue(n) {
  if (n === null) return 'var(--text-muted)';
  if (n >= 80) return '#059669';
  if (n >= 60) return '#d97706';
  return '#dc2626';
}

function scoreColor(v) {
  return scoreColorByValue(toNumber(v));
}

// Куратордың соңғы (ең жаңа) толтырылған "Ортақ" баллын табады — деректер
// сирек толтырылған болса да (аралықта бос апталар болса да) дұрыс жұмыс
// істеу үшін соңынан бастап іздейді.
function latestOrtak(curator) {
  for (let i = curator.scores.length - 1; i >= 0; i--) {
    const n = toNumber(curator.scores[i].ortak);
    if (n !== null) return { value: n, weekLabel: curator.scores[i].label };
  }
  return { value: null, weekLabel: null };
}

function useDashboardAnalytics(data) {
  return useMemo(() => {
    if (!data || !data.curators.length) return null;

    const latestByStudent = data.curators.map(c => ({ curator: c, ...latestOrtak(c) }));
    const withScore = latestByStudent.filter(x => x.value !== null);

    const avg = withScore.length
      ? withScore.reduce((s, x) => s + x.value, 0) / withScore.length
      : null;

    const sorted = [...withScore].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 5);
    const bottom = sorted.length > 5 ? sorted.slice(-5).reverse() : [];

    const buckets = { 'Жақсы (80+)': 0, 'Орта (60-79)': 0, 'Назар аудару (<60)': 0, 'Деректер жоқ': 0 };
    latestByStudent.forEach(x => {
      if (x.value === null) buckets['Деректер жоқ']++;
      else if (x.value >= 80) buckets['Жақсы (80+)']++;
      else if (x.value >= 60) buckets['Орта (60-79)']++;
      else buckets['Назар аудару (<60)']++;
    });

    // Апта сайынғы орташа балл (тренд-график үшін) — деректер жоқ апта — null
    const trend = data.weeks.map(label => {
      const vals = data.curators
        .map(c => toNumber((c.scores.find(s => s.label === label) || {}).ortak))
        .filter(v => v !== null);
      const value = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      return { label, value };
    });

    const filledCells = data.curators.reduce((sum, c) => sum + c.scores.filter(s => toNumber(s.ortak) !== null).length, 0);
    const totalCells = data.curators.length * data.weeks.length;
    const completeness = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

    return { avg, top, bottom, buckets, trend, completeness, totalCurators: data.curators.length, withScoreCount: withScore.length };
  }, [data]);
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
  const [showTable, setShowTable] = useState(false);

  const analytics = useDashboardAnalytics(data);

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
    setShowTable(false);
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

  const kpiCardStyle = {
    padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16,
  };
  const kpiLabelStyle = { fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' };
  const kpiValueStyle = { fontSize: 24, fontWeight: 900, color: 'var(--text)', marginTop: 2 };

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* ── KPI карточкалары ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
              <div className="card" style={kpiCardStyle}>
                <RingStat value={analytics.avg ?? 0} max={100} color={scoreColorByValue(analytics.avg)} />
                <div>
                  <div style={kpiLabelStyle}>Орташа балл (соңғы)</div>
                  <div style={{ ...kpiValueStyle, color: scoreColorByValue(analytics.avg) }}>
                    {analytics.avg !== null ? analytics.avg.toFixed(1) : '—'}
                  </div>
                </div>
              </div>

              <div className="card" style={kpiCardStyle}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconUsers style={{ width: 20, height: 20, color: '#059669' }} />
                </div>
                <div>
                  <div style={kpiLabelStyle}>Балл қойылған куратор</div>
                  <div style={kpiValueStyle}>{analytics.withScoreCount} / {analytics.totalCurators}</div>
                </div>
              </div>

              <div className="card" style={kpiCardStyle}>
                <RingStat value={analytics.completeness} max={100} color="#3b82f6" />
                <div>
                  <div style={kpiLabelStyle}>Кесте толтырылуы</div>
                  <div style={{ ...kpiValueStyle, color: '#3b82f6' }}>{analytics.completeness}%</div>
                </div>
              </div>

              <div className="card" style={kpiCardStyle}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconChart style={{ width: 20, height: 20, color: '#8b5cf6' }} />
                </div>
                <div>
                  <div style={kpiLabelStyle}>Апта саны (кестеде)</div>
                  <div style={kpiValueStyle}>{data.weeks.length}</div>
                </div>
              </div>
            </div>

            {/* ── Тренд + үлестіру ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18 }}>
              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Орташа балл динамикасы</div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 16 }}>Апта сайын барлық кураторлардың орташа "Ортақ" баллы</div>
                <TrendLine points={analytics.trend} color="#1B6E7E" />
              </div>

              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Үлестіру (соңғы белгілі балл)</div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 16 }}>Куратор саны санат бойынша</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <BarRow label="Жақсы" value={analytics.buckets['Жақсы (80+)']} max={analytics.totalCurators} color="#059669" />
                  <BarRow label="Орта" value={analytics.buckets['Орта (60-79)']} max={analytics.totalCurators} color="#d97706" />
                  <BarRow label="Назар аудару" value={analytics.buckets['Назар аудару (<60)']} max={analytics.totalCurators} color="#dc2626" />
                  <BarRow label="Деректер жоқ" value={analytics.buckets['Деректер жоқ']} max={analytics.totalCurators} color="var(--text-muted)" />
                </div>
              </div>
            </div>

            {/* ── Топ / назар аудару керек кураторлар ── */}
            {analytics.top.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>Үздік кураторлар</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analytics.top.map((x, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 22, textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>{i + 1}</div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.curator.fullName}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: scoreColorByValue(x.value) }}>{x.value.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {analytics.bottom.length > 0 && (
                  <div className="card" style={{ padding: 22 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>Назар аудару керек</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {analytics.bottom.map((x, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <IconAlert style={{ width: 14, height: 14, color: scoreColorByValue(x.value), flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.curator.fullName}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: scoreColorByValue(x.value) }}>{x.value.toFixed(1)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Толық кесте (қажет болса ашылады) ── */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button onClick={() => setShowTable(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <IconTable style={{ width: 16, height: 16, color: 'var(--text-sub)' }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Толық кесте (апта-аптасымен)</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{showTable ? 'Жасыру ▴' : 'Көрсету ▾'}</span>
              </button>

              {showTable && (
                <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
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
              )}
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
