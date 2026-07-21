import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { SUBJECT_COLORS, SUBJECT_LOGOS } from './scheduleData';
import { motion } from 'framer-motion';

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
const WEEKS = [1, 2, 3, 4];

const STATUS_MAP = {
  active: { label: '🟢 Жұмыста', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  stream_changed: { label: '🟡 Ағым ауысты', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  subject_changed: { label: '🔵 Пән ауысты', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  fired: { label: '🔴 Жұмыстан шықты', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

export default function StRecordings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('st');

  const currentSubjectCode = searchParams.get('subject');
  const currentStream = searchParams.get('stream') || '01';
  const currentMonth = parseInt(searchParams.get('month') || '1');
  const currentWeek = parseInt(searchParams.get('week') || '1');

  const selectedSubject = SUBJECTS.find(s => s.code === currentSubjectCode) || null;
  const availableMonths = Array.from({ length: selectedSubject ? selectedSubject.months : 5 }, (_, i) => i + 1);

  const [rows, setRows] = useState([]);
  const [curatorsList, setCuratorsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCurator, setNewCurator] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    if (selectedSubject) {
      if (activeTab === 'st') loadTable();
      else loadCuratorsBase();
    }
  }, [currentSubjectCode, currentStream, currentMonth, currentWeek, activeTab]);

  const updateFilters = (newParams) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined) updated.delete(k);
      else updated.set(k, v);
    });
    setSearchParams(updated);
  };

  const loadTable = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/st-recordings?subject=${currentSubjectCode}&streamId=${currentStream}&monthNum=${currentMonth}&weekNum=${currentWeek}`
      );
      setRows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
      if (activeTab === 'st') {
        const { data } = await api.post('/st-recordings/curator', {
          subject: currentSubjectCode,
          streamId: currentStream,
          monthNum: currentMonth,
          weekNum: currentWeek,
          curatorName: newCurator.trim(),
        });
        setRows(prev => [...prev, data]);
      } else {
        const { data } = await api.post('/curators', {
          fullName: newCurator.trim(),
          subject: currentSubjectCode,
          streamId: currentStream,
          status: 'active'
        });
        setCuratorsList(prev => [...prev, data]);
      }
      setNewCurator('');
    } catch (err) {
      alert('Қателік орын алды');
    }
  };

  // 💡 БҰРЫНҒЫ КУРАТОРЛАРДЫ БАЗАДАН ТАРТУ (АВТОМАТТЫ)
  const handleSyncOldCurators = async () => {
    try {
      const { data } = await api.post('/curators/sync-old');
      alert(`Қалпына келтірілді! Бұрынғы ${data.addedCount} куратор орталық базаға қосылды.`);
      if (activeTab === 'st') loadTable();
      else loadCuratorsBase();
    } catch (err) {
      alert('Қателік: ' + err.message);
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

  const handleCreateMeet = async (rowId, curatorName) => {
    setActionLoading(prev => ({ ...prev, [rowId]: 'meet' }));
    try {
      const { data } = await api.post('/st-recordings/create-meet', {
        recordingId: rowId,
        curatorName,
        subject: currentSubjectCode,
      });
      setRows(prev => prev.map(r => r.id === rowId ? data : r));
    } catch (err) {
      alert(err.response?.data?.error || 'Мит ашуда қателік');
    } finally {
      setActionLoading(prev => ({ ...prev, [rowId]: null }));
    }
  };

  const handleSyncDrive = async (rowId, meetCode) => {
    setActionLoading(prev => ({ ...prev, [rowId]: 'drive' }));
    try {
      const { data } = await api.post('/st-recordings/sync-drive', { recordingId: rowId, meetCode });
      if (data.foundCount === 0) alert('Драйвтан осы Мит кодымен файлдар әлі табылмады.');
      else setRows(prev => prev.map(r => r.id === rowId ? data.record : r));
    } catch (err) {
      alert(err.response?.data?.error || 'Драйв іздеуде қателік');
    } finally {
      setActionLoading(prev => ({ ...prev, [rowId]: null }));
    }
  };

  const handleUpdateRow = async (id, field, value) => {
    try {
      await api.put(`/st-recordings/${id}`, { [field]: value });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRow = async (id) => {
    if (!confirm('Кураторды өшіруге сенімдісіз бе?')) return;
    try {
      await api.delete(`/st-recordings/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Өшіруде қателік орын алды');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '24px 32px', minWidth: 0, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>JUZ40 · САПА БӨЛІМІ</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: '4px 0 0', letterSpacing: '-0.5px' }}>
              📹 СТ Жүйесі {selectedSubject ? `· ${selectedSubject.name}` : ''}
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
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button onClick={() => setActiveTab('st')}
              style={{
                padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer',
                background: activeTab === 'st' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'st' ? '#fff' : 'var(--text-sub)',
                boxShadow: activeTab === 'st' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
              }}>
              📹 СТ Есептері & Записьтер
            </button>
            <button onClick={() => setActiveTab('curators')}
              style={{
                padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer',
                background: activeTab === 'curators' ? '#8b5cf6' : 'var(--surface)',
                color: activeTab === 'curators' ? '#fff' : 'var(--text-sub)',
                boxShadow: activeTab === 'curators' ? '0 4px 12px rgba(139,92,246,0.2)' : 'none'
              }}>
              👥 Кураторлар Базасы (Басқару)
            </button>

            {/* 💡 ЖОҒАЛҒАН 22 КУРАТОРДЫ ҚАЙТАРУ БАТЫРМАСЫ */}
            <button onClick={handleSyncOldCurators}
              style={{
                padding: '10px 20px', marginLeft: 'auto', borderRadius: 12, fontWeight: 800, fontSize: 12, border: '1px solid #10b981', cursor: 'pointer',
                background: 'rgba(16,185,129,0.1)', color: '#10b981',
              }}>
              🛠 Бұрынғы кураторларды қалпына келтіру
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
                  whileHover={{ scale: 1.03, y: -4 }}
                  onClick={() => updateFilters({ subject: s.code, stream: '01', month: '1', week: '1' })}
                  className="card"
                  style={{
                    padding: '24px 20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14,
                    borderTop: `4px solid ${col.primary}`,
                  }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${col.primary}, ${col.secondary || col.primary})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 8px 20px ${col.primary}40`, padding: 14
                  }}>
                    {svgLogo && (
                      <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        dangerouslySetInnerHTML={{ __html: svgLogo }} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: col.primary, fontWeight: 700, marginTop: 3 }}>
                      {s.code}-01 · ({s.months} ай)
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : activeTab === 'st' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', width: 60 }}>АҒЫМ:</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {STREAMS.map(str => (
                    <button key={str} onClick={() => updateFilters({ stream: str })}
                      style={{
                        padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: currentStream === str ? 800 : 500,
                        background: currentStream === str ? 'var(--accent)' : 'var(--surface2)',
                        color: currentStream === str ? '#fff' : 'var(--text)', border: 'none', cursor: 'pointer',
                      }}>
                      {selectedSubject.code}-{str}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', width: 60 }}>АЙ:</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {availableMonths.map(m => (
                    <button key={m} onClick={() => updateFilters({ month: m })}
                      style={{
                        padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: currentMonth === m ? 800 : 500,
                        background: currentMonth === m ? '#10b981' : 'var(--surface2)',
                        color: currentMonth === m ? '#fff' : 'var(--text)', border: 'none', cursor: 'pointer',
                      }}>
                      {m}-ай
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', width: 60 }}>АПТА:</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {WEEKS.map(w => (
                    <button key={w} onClick={() => updateFilters({ week: w })}
                      style={{
                        padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: currentWeek === w ? 800 : 500,
                        background: currentWeek === w ? '#3b82f6' : 'var(--surface2)',
                        color: currentWeek === w ? '#fff' : 'var(--text)', border: 'none', cursor: 'pointer',
                      }}>
                      {w}-апта
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Жаңа куратор қосу..." value={newCurator} onChange={e => setNewCurator(e.target.value)}
                style={{ width: 260, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
              <button onClick={handleAddCurator}
                style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                + Қосу
              </button>
            </div>

            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text-sub)', fontWeight: 700 }}>
                    <th style={{ padding: '14px 16px' }}>Куратор аты-жөні</th>
                    <th style={{ padding: '14px 12px', width: 110 }}>СТ тапсырды</th>
                    <th style={{ padding: '14px 12px' }}>Запись сілтемелері</th>
                    <th style={{ padding: '14px 12px' }}>Отслежка сілтемелері</th>
                    <th style={{ padding: '14px 12px' }}>Ескеру керек жағдайлар</th>
                    <th style={{ padding: '14px 16px', width: 200 }}>Автоматика</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Жүктелуде...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Кураторлар қосылмаған</td></tr>
                  ) : rows.map((row) => {
                    const videoLinks = row.video_links || (row.video_link ? [row.video_link] : []);
                    const attendanceLinks = row.attendance_links || (row.attendance_link ? [row.attendance_link] : []);
                    const meetCodes = row.meet_codes || (row.meet_code ? [row.meet_code] : []);
                    const meetLinks = row.meet_links || (row.meet_link ? [row.meet_link] : []);

                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                          {row.curator_name}
                        </td>

                        <td style={{ padding: '12px' }}>
                          <input
                            defaultValue={row.students_count || '0'}
                            onBlur={(e) => handleUpdateRow(row.id, 'studentsCount', e.target.value)}
                            style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', textAlign: 'center' }}
                          />
                        </td>

                        <td style={{ padding: '12px' }}>
                          {videoLinks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {videoLinks.map((v, idx) => (
                                <a key={idx} href={v} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none', fontSize: 11.5 }}>
                                  🎬 Запись {videoLinks.length > 1 ? idx + 1 : ''}
                                </a>
                              ))}
                            </div>
                          ) : meetLinks.length > 0 ? (
                            <span style={{ color: '#d97706', fontSize: 11, fontWeight: 600 }}>⏳ Жазба дайындалуда</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '12px' }}>
                          {attendanceLinks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {attendanceLinks.map((a, idx) => (
                                <a key={idx} href={a} target="_blank" rel="noreferrer" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none', fontSize: 11.5 }}>
                                  📊 Отслежка {attendanceLinks.length > 1 ? idx + 1 : ''}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '12px' }}>
                          <input
                            defaultValue={row.notes || ''}
                            placeholder="Мыс: ауырып тұр..."
                            onBlur={(e) => handleUpdateRow(row.id, 'notes', e.target.value)}
                            style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 11.5 }}
                          />
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={() => handleCreateMeet(row.id, row.curator_name)} disabled={actionLoading[row.id] === 'meet'}
                              style={{ padding: '6px 10px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                              {actionLoading[row.id] === 'meet' ? '...' : meetCodes.length > 0 ? '+ Жаңа Мит' : '🎥 Мит ашу'}
                            </button>

                            {meetCodes.map((code, idx) => (
                              <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <a href={meetLinks[idx]} target="_blank" rel="noreferrer"
                                  style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700, fontSize: 10, textDecoration: 'none' }}>
                                  🔗 {code}
                                </a>
                                <button onClick={() => handleSyncDrive(row.id, code)} disabled={actionLoading[row.id] === 'drive'}
                                  style={{ padding: '4px 6px', borderRadius: 6, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
                                  🔄
                                </button>
                              </div>
                            ))}

                            <button onClick={() => handleDeleteRow(row.id)}
                              style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: 'none', fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}>
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>АҒЫМ СҮЗГІСІ:</span>
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

            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Орталық базаға куратор аты-жөнін қосу..." value={newCurator} onChange={e => setNewCurator(e.target.value)}
                style={{ width: 320, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
              <button onClick={handleAddCurator}
                style={{ padding: '9px 18px', borderRadius: 10, background: '#8b5cf6', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                + Базаға қосу
              </button>
            </div>

            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text-sub)', fontWeight: 700 }}>
                    <th style={{ padding: '14px 16px' }}>Куратор аты-жөні</th>
                    <th style={{ padding: '14px 16px' }}>Пәні</th>
                    <th style={{ padding: '14px 16px' }}>Ағымы</th>
                    <th style={{ padding: '14px 16px' }}>Жұмыс Статусы</th>
                    <th style={{ padding: '14px 16px', width: 80 }}>Әрекет</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Жүктелуде...</td></tr>
                  ) : curatorsList.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Кураторлар табылмады</td></tr>
                  ) : curatorsList.map((cur) => {
                    const stInfo = STATUS_MAP[cur.status] || STATUS_MAP.active;
                    return (
                      <tr key={cur.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text)' }}>
                          {cur.full_name}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {cur.subject}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <select value={cur.stream_id || '01'} onChange={(e) => handleUpdateCuratorStream(cur.id, e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600 }}>
                            {STREAMS.map(s => <option key={s} value={s}>{selectedSubject.code}-{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <select value={cur.status || 'active'} onChange={(e) => handleUpdateCuratorStatus(cur.id, e.target.value)}
                            style={{
                              padding: '6px 12px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                              background: stInfo.bg, color: stInfo.color
                            }}>
                            <option value="active">🟢 Жұмыста</option>
                            <option value="stream_changed">🟡 Ағым ауысты</option>
                            <option value="subject_changed">🔵 Пән ауысты</option>
                            <option value="fired">🔴 Жұмыстан шықты</option>
                          </select>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button onClick={async () => {
                            if (confirm('Базадан өшіруге сенімдісіз бе?')) {
                              await api.delete(`/curators/${cur.id}`);
                              setCuratorsList(prev => prev.filter(c => c.id !== cur.id));
                            }
                          }} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}