import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { IconUser, IconTable, IconVideo, IconLink, IconCheck, IconAlert, IconMeetLogo, IconChart } from '../components/icons';
import { SHEETS_LOGO } from '../components/brandLogos';
import ScoreTrendChart from '../components/ScoreTrendChart';

// Куратордың жеке кабинеті: профиль ақпараты + өз СТ-жазбаларының тарихы бір бетте.
export default function CuratorCabinet() {
  const localUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [user, setUser] = useState(localUser);
  const [studentsCount, setStudentsCount] = useState(localUser.studentsCount || '0');
  const [avatarUrl, setAvatarUrl] = useState(localUser.avatarUrl || '');
  const [firstName, setFirstName] = useState(localUser.firstName || '');
  const [lastName, setLastName] = useState(localUser.lastName || '');
  const [department, setDepartment] = useState(localUser.department || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMessage] = useState('');

  const [recordings, setRecordings] = useState([]);
  const [loadingRecordings, setLoadingRecordings] = useState(true);

  const [evaluation, setEvaluation] = useState(null);
  const [loadingEvaluation, setLoadingEvaluation] = useState(true);

  useEffect(() => {
    fetchProfile();
    loadMyRecordings();
    loadEvaluation();
  }, []);

  const loadEvaluation = () => {
    setLoadingEvaluation(true);
    api.get(`/dashboard/${localUser.subject || 'ФИЗ'}/evaluation`)
      .then(({ data }) => setEvaluation(data))
      .catch((err) => setEvaluation({ connected: false, error: err.response?.data?.error }))
      .finally(() => setLoadingEvaluation(false));
  };

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      setStudentsCount(data.students_count || '0');
      setAvatarUrl(data.avatar_url || '');
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setDepartment(data.department || '');
      const updated = {
        ...localUser, ...data, avatarUrl: data.avatar_url, studentsCount: data.students_count,
        firstName: data.first_name, lastName: data.last_name, department: data.department,
      };
      localStorage.setItem('user', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  const loadMyRecordings = async () => {
    setLoadingRecordings(true);
    try {
      const { data } = await api.get(`/st-recordings?subject=${localUser.subject || 'ФИЗ'}&streamId=${localUser.streamId || '01'}`);
      setRecordings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRecordings(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { data } = await api.put('/auth/profile', {
        studentsCount,
        avatarUrl,
        firstName,
        lastName,
        department,
        password: password.trim() ? password : undefined,
      });
      setUser(data);
      const updated = {
        ...localUser, ...data, avatarUrl: data.avatar_url, studentsCount: data.students_count,
        firstName: data.first_name, lastName: data.last_name, department: data.department,
      };
      localStorage.setItem('user', JSON.stringify(updated));
      setPassword('');
      setMessage('success:Профиль сәтті жаңартылды!');
    } catch (err) {
      setMessage('error:' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const isError = msg.startsWith('error:');
  const msgText = msg.includes(':') ? msg.slice(msg.indexOf(':') + 1) : msg;

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
  };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 7 };

  return (
    <div className="app-shell" style={{ background: 'var(--bg)', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, minWidth: 0, padding: '32px clamp(16px, 4vw, 48px)', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            JUZ40 · КУРАТОР КАБИНЕТІ
          </div>
          <h1 style={{ fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 900, color: 'var(--text)', margin: '4px 0 0', letterSpacing: '-0.4px' }}>
            Менің кабинетім
          </h1>
        </div>

        {msg && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontWeight: 600, fontSize: 13,
            background: isError ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.10)',
            color: isError ? '#dc2626' : '#059669',
            border: `1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
          }}>
            {isError ? <IconAlert /> : <IconCheck />} {msgText}
          </div>
        )}

        {/* ── Profile card ── */}
        <section className="card" style={{ padding: 'clamp(20px, 4vw, 32px)', marginBottom: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
            paddingBottom: 24, borderBottom: '1px solid var(--border)', marginBottom: 24,
          }}>
            <div style={{
              width: 76, height: 76, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 28, overflow: 'hidden',
              boxShadow: '0 8px 20px rgba(139,92,246,0.28)',
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <IconUser style={{ width: 32, height: 32 }} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>
                {user.full_name || user.username}
              </h2>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(59,130,246,0.10)', color: '#1d4ed8', fontWeight: 700, fontSize: 11.5 }}>
                  Пән: {user.subject || '—'}
                </span>
                <span style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(139,92,246,0.10)', color: '#6d28d9', fontWeight: 700, fontSize: 11.5 }}>
                  Ағым: {user.stream_id || '01'}
                </span>
                {user.department && (
                  <span style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(16,185,129,0.10)', color: '#059669', fontWeight: 700, fontSize: 11.5 }}>
                    Бөлім: {user.department}
                  </span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
              <div>
                <label style={labelStyle}>Аты</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Мысалы: Меруерт" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Тегі</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Мысалы: Орынбек" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
              <div>
                <label style={labelStyle}>Бөлім</label>
                <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                  placeholder="Мысалы: Сапа бөлімі" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Оқушыларыңыздың жалпы саны</label>
                <input type="number" className="no-spinner" value={studentsCount} onChange={e => setStudentsCount(e.target.value)}
                  placeholder="Мысалы: 25" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
              <div>
                <label style={labelStyle}>Профиль фотосының сілтемесі</label>
                <input type="text" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://..." style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Жаңа құпия сөз (өзгертпесеңіз, бос қалдырыңыз)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Жаңа пароль" style={inputStyle} />
            </div>
            <button type="submit" disabled={saving} style={{
              alignSelf: 'flex-start', marginTop: 4, padding: '11px 26px', borderRadius: 12,
              background: saving ? 'var(--text-muted)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'default' : 'pointer',
              boxShadow: '0 6px 18px rgba(16,185,129,0.28)', transition: 'opacity 0.2s',
            }}>
              {saving ? 'Сақталуда...' : 'Өзгерістерді сақтау'}
            </button>
          </form>
        </section>

        {/* ── Прогресс дэшборды: СТ БАҒАЛАУ кестесінен live оқылады ── */}
        {!loadingEvaluation && evaluation?.connected && evaluation.weeks?.length > 0 && (() => {
          const weeks = evaluation.weeks;
          const points = weeks.map((w) => ({ label: `${w.monthNum}-${w.weekNum}`, score: w.score }));
          const criteriaLabels = [];
          weeks.forEach((w) => Object.keys(w.criteria || {}).forEach((k) => {
            if (!criteriaLabels.includes(k)) criteriaLabels.push(k);
          }));

          return (
            <section className="card" style={{ padding: 'clamp(16px, 3vw, 24px)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <IconChart />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Менің прогресім</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                    Апта сайынғы СТ-бағалау баллы мен критерий бойынша сәйкестік
                  </div>
                </div>
              </div>

              <div style={{ padding: '4px 4px 0' }}>
                <ScoreTrendChart points={points} />
              </div>

              {criteriaLabels.length > 0 && (
                <div style={{ overflowX: 'auto', marginTop: 24 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5, minWidth: 480 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '9px 10px', fontWeight: 700 }}>Критерий</th>
                        {weeks.map((w, i) => (
                          <th key={i} style={{ padding: '9px 8px', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {w.monthNum}-{w.weekNum}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {criteriaLabels.map((label) => (
                        <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '9px 10px', color: 'var(--text)' }}>{label}</td>
                          {weeks.map((w, i) => {
                            const v = w.criteria?.[label];
                            return (
                              <td key={i} style={{ padding: '9px 8px', textAlign: 'center' }}>
                                {v === true ? <span style={{ color: '#059669', fontWeight: 800 }}>✓</span>
                                  : v === false ? <span style={{ color: '#dc2626', fontWeight: 800 }}>✗</span>
                                  : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })()}

        {/* ── ST-recordings history ── */}
        <section className="card" style={{ padding: 'clamp(16px, 3vw, 24px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <IconTable />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Менің СТ-жазбаларым</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                Барлық ашқан Миттеріңіз бен тапсырған видео-есептеріңіздің архиві
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Ай / Апта</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Оқушы саны</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Мит кодтары</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Видео</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Отслежка</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Ескертулер</th>
                </tr>
              </thead>
              <tbody>
                {loadingRecordings ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>Жүктелуде...</td></tr>
                ) : recordings.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>Сізде әлі жазбалар жоқ</td></tr>
                ) : recordings.map((row) => {
                  const videoLinks = row.video_links || (row.video_link ? [row.video_link] : []);
                  const attendanceLinks = row.attendance_links || (row.attendance_link ? [row.attendance_link] : []);
                  const meetCodes = row.meet_codes || (row.meet_code ? [row.meet_code] : []);
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--text)' }}>
                        {row.month_num}-ай · {row.week_num}-апта
                      </td>
                      <td style={{ padding: '11px 12px' }}>{row.students_count || 0}</td>
                      <td style={{ padding: '11px 12px' }}>
                        {meetCodes.length > 0 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {meetCodes.map((code, i) => (
                              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 8, background: 'rgba(16,185,129,0.10)', color: '#059669', fontWeight: 600, fontSize: 11 }}>
                                <IconMeetLogo style={{ width: 13, height: 13 }} />
                                {code}
                              </span>
                            ))}
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        {videoLinks.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {videoLinks.map((v, i) => (
                              <a key={i} href={v} target="_blank" rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#2563eb', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}>
                                <IconVideo style={{ width: 14, height: 14 }} /> Запись {videoLinks.length > 1 ? i + 1 : ''}
                              </a>
                            ))}
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        {attendanceLinks.length > 0 ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {attendanceLinks.map((a, i) => (
                              <a key={i} href={a} target="_blank" rel="noreferrer" title="Отслежка">
                                {SHEETS_LOGO
                                  ? <img src={SHEETS_LOGO} alt="Отслежка" style={{ width: 18, height: 18 }} />
                                  : <IconLink style={{ width: 14, height: 14, color: '#059669' }} />}
                              </a>
                            ))}
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-sub)', fontSize: 12 }}>{row.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
