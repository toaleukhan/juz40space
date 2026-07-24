import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { SUBJECT_COLORS, SUBJECT_LOGOS } from './scheduleData';
import { motion } from 'framer-motion';
import { IconFile, IconClose, IconDot, IconPlus } from '../components/icons';

const SUBJECTS = [
  { code:'ФИЗ',   name:'Физика',           months: 5 },
  { code:'МАТ',   name:'Математика',       months: 6 },
  { code:'ТІЛ',   name:'Қазақ тілі',       months: 3 },
  { code:'БИО',   name:'Биология',         months: 6 },
  { code:'ИНФО',  name:'Информатика',      months: 5 },
  { code:'ГЕО',   name:'География',        months: 6 },
  { code:'ТАРИХ', name:'Қазақстан тарихы', months: 5 },
  { code:'РУС',   name:'Орыс тілі',        months: 4 },
  { code:'ХИМ',   name:'Химия',            months: 6 },
  { code:'МС',    name:'Логика / МС',      months: 3 },
  { code:'ӘДЕБ',  name:'Қазақ әдебиеті',   months: 6 },
  { code:'АНГЛ',  name:'Ағылшын тілі',     months: 5 },
  { code:'ДЖТ',   name:'Дүниежүзі тарихы', months: 6 },
];

const STREAMS = ['01', '11', '21', '31', '41'];

const STATUS_MAP = {
  active: { label: 'Жұмыста', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  stream_changed: { label: 'Ағым ауысты', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  subject_changed: { label: 'Пән ауысты', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  fired: { label: 'Жұмыстан шықты', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

export default function CuratorsDatabase() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSubjectCode = searchParams.get('subject');
  const currentStream = searchParams.get('stream') || '01';
  const selectedSubject = SUBJECTS.find(s => s.code === currentSubjectCode) || null;

  const [curatorsList, setCuratorsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCurator, setNewCurator] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newCreds, setNewCreds] = useState(null);

  useEffect(() => {
    if (selectedSubject) loadCuratorsBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSubjectCode, currentStream]);

  const updateFilters = (newParams) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined) updated.delete(k);
      else updated.set(k, v);
    });
    setSearchParams(updated);
  };

  const loadCuratorsBase = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/curators?subject=${currentSubjectCode}&streamId=${currentStream}`);
      setCuratorsList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCurator = async () => {
    if (!newCurator.trim()) return;
    try {
      const { data } = await api.post('/curators', {
        fullName: newCurator.trim(),
        subject: currentSubjectCode,
        streamId: currentStream,
        status: 'active'
      });
      const { username, password, ...curatorRow } = data;
      setCuratorsList(prev => [...prev, curatorRow]);
      if (username) setNewCreds([{ full_name: curatorRow.full_name, username, password }]);
      setNewCurator('');
    } catch (err) {
      alert('Қателік: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;
    try {
      const { data } = await api.post('/curators/bulk', {
        namesText: bulkText,
        subject: currentSubjectCode,
        streamId: currentStream,
      });
      setBulkText('');
      setShowBulk(false);
      loadCuratorsBase();
      if (data.added?.length) {
        setNewCreds(data.added.map(c => ({ full_name: c.full_name, username: c.username, password: c.password })));
      }
      if (data.skippedCount) alert(`${data.skippedCount} куратор бұрыннан бар болғандықтан өткізіп жіберілді: ${data.skipped.join(', ')}`);
    } catch (err) {
      alert('Қателік орын алды: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateCuratorStatus = async (curatorId, newStatus) => {
    try {
      const { data } = await api.put(`/curators/${curatorId}`, { status: newStatus });
      setCuratorsList(prev => prev.map(c => c.id === curatorId ? data : c));
    } catch (err) {
      alert('Статусты өзгертуде қателік');
    }
  };

  const handleUpdateCuratorStream = async (curatorId, newStream) => {
    try {
      const { data } = await api.put(`/curators/${curatorId}`, { streamId: newStream });
      setCuratorsList(prev => prev.map(c => c.id === curatorId ? data : c));
    } catch (err) {
      alert('Ағымды өзгертуде қателік');
    }
  };

  const handleGenerateLogin = async (curatorId) => {
    try {
      const { data } = await api.post(`/curators/${curatorId}/generate-login`);
      setCuratorsList(prev => prev.map(c => c.id === curatorId ? { ...c, username: data.username } : c));
      setNewCreds([{ full_name: data.full_name, username: data.username, password: data.password }]);
    } catch (err) {
      alert(err.response?.data?.error || 'Логин жасауда қателік');
    }
  };

  const handleDeleteCurator = async (id) => {
    if (!confirm('Өшіруге сенімдісіз бе?')) return;
    try {
      await api.delete(`/curators/${id}`);
      setCuratorsList(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert('Өшіруде қателік орын алды');
    }
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
              Кураторлар базасы {selectedSubject ? `· ${selectedSubject.name}` : ''}
            </h1>
          </div>
          {selectedSubject && (
            <button onClick={() => updateFilters({ subject: null })}
              style={{ padding: '8px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-sub)', fontWeight: 600, fontSize: 12 }}>
              ← Барлық пәндер
            </button>
          )}
        </div>

        {selectedSubject && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {STREAMS.map(str => (
                <button key={str} onClick={() => updateFilters({ stream: str })}
                  style={{
                    padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: currentStream === str ? 800 : 500,
                    background: currentStream === str ? '#8b5cf6' : 'var(--surface2)',
                    color: currentStream === str ? '#fff' : 'var(--text)', border: 'none', cursor: 'pointer',
                  }}>
                  {selectedSubject.code}-{str}
                </button>
              ))}
            </div>
            <button onClick={() => setShowBulk(!showBulk)}
              style={{
                padding: '10px 20px', marginLeft: 'auto', borderRadius: 12, fontWeight: 800, fontSize: 12, border: 'none', cursor: 'pointer',
                background: '#3b82f6', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
              <IconFile style={{ width: 14, height: 14 }} /> Тізіммен кураторларды бірден қосу
            </button>
          </div>
        )}

        {showBulk && selectedSubject && (
          <div className="card" style={{ padding: 20, marginBottom: 20, border: '2px solid #3b82f6' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>
              Тізіммен кураторларды массовый енгізу ({selectedSubject.name} · {selectedSubject.code}-{currentStream})
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Әр куратордың аты-жөнін жаңа жолдан (Enter арқылы) жазыңыз немесе көшіріп алып қойыңыз:
            </p>
            <textarea
              rows={6}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="Орынбек Меруерт&#10;Жұбатбек Алия&#10;Мұратқызы Сағыныш..."
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={handleBulkAdd} style={{ padding: '8px 20px', borderRadius: 10, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                Барлық кураторларды базаға қосу
              </button>
              <button onClick={() => setShowBulk(false)} style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text)', border: 'none', cursor: 'pointer' }}>
                Жабу
              </button>
            </div>
          </div>
        )}

        {newCreds && (
          <div className="card" style={{ padding: 20, marginBottom: 20, border: '2px solid #10b981' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                Жаңа логин/парольдер ({newCreds.length})
              </h3>
              <button onClick={() => setNewCreds(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><IconClose style={{ width: 16, height: 16 }} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Бұл парольдер тек қазір көрсетіледі — жоғалтпас үшін дереу көшіріп, кураторларға жіберіңіз.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 420 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>Аты-жөні</th>
                    <th style={{ padding: '6px 10px' }}>Логин</th>
                    <th style={{ padding: '6px 10px' }}>Құпия сөз</th>
                  </tr>
                </thead>
                <tbody>
                  {newCreds.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px' }}>{c.full_name}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{c.username}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{c.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => {
                const text = newCreds.map(c => `${c.full_name}: логин — ${c.username}, құпия сөз — ${c.password}`).join('\n');
                navigator.clipboard?.writeText(text);
              }}
              style={{ marginTop: 12, padding: '8px 18px', borderRadius: 10, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>
              Барлығын көшіру
            </button>
          </div>
        )}

        {!selectedSubject ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
            {SUBJECTS.map(s => {
              const col = SUBJECT_COLORS[s.code] || { primary: '#1B6E7E' };
              const svgLogo = SUBJECT_LOGOS[s.code];
              return (
                <motion.div
                  key={s.code}
                  whileHover={{ y: -6, boxShadow: `0 16px 32px ${col.primary}30` }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateFilters({ subject: s.code, stream: '01' })}
                  className="card"
                  style={{
                    padding: '28px 22px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16,
                    position: 'relative', overflow: 'hidden',
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
                    <div style={{ fontSize: 11.5, color: col.primary, fontWeight: 700, marginTop: 4 }}>
                      {s.code}-01 · {s.months} ай
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input placeholder="Куратор аты-жөнін қосу..." value={newCurator} onChange={e => setNewCurator(e.target.value)}
                style={{ width: 320, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
              <button onClick={handleAddCurator}
                style={{ padding: '9px 18px', borderRadius: 10, background: '#8b5cf6', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconPlus style={{ width: 14, height: 14 }} /> Базаға қосу
              </button>
              <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--text-sub)' }}>
                Осы ағымда: <span style={{ color: 'var(--text)' }}>{curatorsList.length}</span> куратор
              </div>
            </div>

            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 780 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text-sub)', fontWeight: 700 }}>
                    <th style={{ padding: '14px 16px' }}>Куратор аты-жөні</th>
                    <th style={{ padding: '14px 16px' }}>Пәні</th>
                    <th style={{ padding: '14px 16px' }}>Ағымы</th>
                    <th style={{ padding: '14px 16px' }}>Логин</th>
                    <th style={{ padding: '14px 16px' }}>Соңғы кіру</th>
                    <th style={{ padding: '14px 16px' }}>Жұмыс Статусы</th>
                    <th style={{ padding: '14px 16px', width: 80 }}>Әрекет</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Жүктелуде...</td></tr>
                  ) : curatorsList.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Кураторлар табылмады</td></tr>
                  ) : curatorsList.map((cur) => {
                    const stInfo = STATUS_MAP[cur.status] || STATUS_MAP.active;
                    return (
                      <tr key={cur.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text)' }}>
                          {cur.full_name}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>{cur.subject}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <select value={cur.stream_id || '01'} onChange={(e) => handleUpdateCuratorStream(cur.id, e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600 }}>
                            {STREAMS.map(s => <option key={s} value={s}>{selectedSubject.code}-{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12.5, color: cur.username ? 'var(--text)' : 'var(--text-muted)' }}>
                          {cur.username || (
                            <button onClick={() => handleGenerateLogin(cur.id)}
                              style={{ padding: '4px 10px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                              + Логин жасау
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--text-sub)' }}>
                          {cur.last_login ? new Date(cur.last_login).toLocaleString('kk-KZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Кірген жоқ'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 6px 4px 10px', borderRadius: 8, background: stInfo.bg }}>
                            <IconDot color={stInfo.color} />
                            <select value={cur.status || 'active'} onChange={(e) => handleUpdateCuratorStatus(cur.id, e.target.value)}
                              style={{
                                padding: '2px 4px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                                background: 'transparent', color: stInfo.color
                              }}>
                              <option value="active">Жұмыста</option>
                              <option value="stream_changed">Ағым ауысты</option>
                              <option value="subject_changed">Пән ауысты</option>
                              <option value="fired">Жұмыстан шықты</option>
                            </select>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button onClick={() => handleDeleteCurator(cur.id)}
                            style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex' }}>
                            <IconClose style={{ width: 14, height: 14 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
