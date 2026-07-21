import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { SUBJECT_COLORS, months } from './scheduleData';
import { motion } from 'framer-motion';

import math    from '../assets/subjects/Математика.webp';
import kaz     from '../assets/subjects/Казахский_Язык.webp';
import bio     from '../assets/subjects/Биология.webp';
import inf     from '../assets/subjects/Информатика.webp';
import geo     from '../assets/subjects/География.webp';
import hist    from '../assets/subjects/История_Казахстана.webp';
import rus     from '../assets/subjects/Русский_Язык.webp';
import geom    from '../assets/subjects/Геометрия.webp';
import chem    from '../assets/subjects/Химия.webp';
import logic   from '../assets/subjects/Логика.webp';
import kazLit  from '../assets/subjects/Казахская_Литература.webp';
import eng     from '../assets/subjects/Английский_Язык.webp';
import wHist   from '../assets/subjects/Всемирная_История.webp';

const SUBJECTS = [
  { code:'ФИЗ',   name:'Физика',               img: chem   },
  { code:'МАТ',   name:'Математика',          img: math   },
  { code:'ТІЛ',   name:'Қазақ тілі',           img: kaz    },
  { code:'БИО',   name:'Биология',              img: bio    },
  { code:'ИНФО',  name:'Информатика',           img: inf    },
  { code:'ГЕО',   name:'География',             img: geo    },
  { code:'ТАРИХ', name:'Қазақстан тарихы',      img: hist   },
  { code:'РУС',   name:'Орыс тілі',             img: rus    },
  { code:'ХИМ',   name:'Химия',                 img: chem   },
  { code:'МС',    name:'Логика / МС',           img: logic  },
  { code:'ӘДЕБ',  name:'Қазақ әдебиеті',        img: kazLit },
  { code:'АНГЛ',  name:'Ағылшын тілі',          img: eng    },
  { code:'ДЖТ',   name:'Дүниежүзі тарихы',      img: wHist  },
];

const WEEKS = [
  { id: 1, label: '1-апта' },
  { id: 2, label: '2-апта' },
  { id: 3, label: '3-апта' },
  { id: 4, label: '4-апта' },
];

export default function StRecordings() {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('01');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCurator, setNewCurator] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    if (selectedSubject) loadTable();
  }, [selectedSubject, selectedMonth, selectedWeek]);

  const loadTable = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/st-recordings?subject=${selectedSubject.code}&monthId=${selectedMonth}&weekNum=${selectedWeek}`);
      setRows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCurator = async () => {
    if (!newCurator.trim()) return;
    try {
      await api.post('/st-recordings/curator', {
        subject: selectedSubject.code,
        monthId: selectedMonth,
        weekNum: selectedWeek,
        curatorName: newCurator.trim(),
      });
      setNewCurator('');
      loadTable();
    } catch (err) {
      alert('Қате: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateMeet = async (rowId, curatorName) => {
    setActionLoading(prev => ({ ...prev, [rowId]: 'meet' }));
    try {
      const { data } = await api.post('/st-recordings/create-meet', {
        recordingId: rowId,
        curatorName,
        subject: selectedSubject.code,
      });
      setRows(prev => prev.map(r => r.id === rowId ? data : r));
    } catch (err) {
      alert(err.response?.data?.error || 'Мит ашуда қателік');
    } finally {
      setActionLoading(prev => ({ ...prev, [rowId]: null }));
    }
  };

  const handleSyncDrive = async (rowId, meetCode) => {
    if (!meetCode) { alert('Алдымен Мит ашылуы керек!'); return; }
    setActionLoading(prev => ({ ...prev, [rowId]: 'drive' }));
    try {
      const { data } = await api.post('/st-recordings/sync-drive', { recordingId: rowId, meetCode });
      if (data.foundCount === 0) alert('Драйвтан сабақ файлы әлі табылмады. Біраз күтіп қайталаңыз.');
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
    if (!confirm('Бұл куратор жолын өшіруге сенімдісіз бе?')) return;
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
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>JUZ40 · САПА БӨЛІМІ</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: '4px 0 0', letterSpacing: '-0.5px' }}>
              📹 СТ Записьтері
            </h1>
          </div>
          {selectedSubject && (
            <button onClick={() => setSelectedSubject(null)}
              style={{ padding: '8px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-sub)', fontWeight: 600, fontSize: 12 }}>
              ← Барлық пәндер
            </button>
          )}
        </div>

        {/* 1. ПӘНДЕР КАТАЛОГЫ */}
        {!selectedSubject ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {SUBJECTS.map(s => {
              const col = SUBJECT_COLORS[s.code] || { primary: '#1B6E7E' };
              return (
                <motion.div
                  key={s.code}
                  whileHover={{ scale: 1.03, y: -4 }}
                  onClick={() => setSelectedSubject(s)}
                  className="card"
                  style={{
                    padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12,
                    borderTop: `4px solid ${col.primary}`,
                  }}>
                  <img src={s.img} alt={s.name} style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.12))' }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: col.primary, fontWeight: 700, marginTop: 2 }}>{s.code}-01</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* 2. ТАҢДАЛҒАН ПӘННІҢ КЕСТЕСІ */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Ағымдар мен Апталар фильтрі */}
            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              {/* Ай таңдау */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                {months.slice(0, 5).map(m => (
                  <button key={m.id} onClick={() => setSelectedMonth(m.id)}
                    style={{
                      padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: selectedMonth === m.id ? 700 : 500,
                      background: selectedMonth === m.id ? 'var(--accent)' : 'transparent',
                      color: selectedMonth === m.id ? '#fff' : 'var(--text-sub)', border: 'none', cursor: 'pointer',
                    }}>
                    {m.name} ({m.id})
                  </button>
                ))}
              </div>

              {/* Апта таңдау */}
              <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 10, padding: 3, gap: 4 }}>
                {WEEKS.map(w => (
                  <button key={w.id} onClick={() => setSelectedWeek(w.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: selectedWeek === w.id ? 700 : 500,
                      background: selectedWeek === w.id ? '#fff' : 'transparent',
                      color: selectedWeek === w.id ? 'var(--accent)' : 'var(--text-muted)',
                      border: 'none', cursor: 'pointer', boxShadow: selectedWeek === w.id ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    }}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Куратор қосу жолы */}
            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Жаңа куратор аты-жөні..." value={newCurator} onChange={e => setNewCurator(e.target.value)}
                style={{ width: 260, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
              <button onClick={handleAddCurator}
                style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                + Куратор қосу
              </button>
            </div>

            {/* КЕСТЕ */}
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text-sub)', fontWeight: 700 }}>
                    <th style={{ padding: '14px 16px' }}>Куратор аты-жөні</th>
                    <th style={{ padding: '14px 12px', width: 110 }}>СТ тапсырды</th>
                    <th style={{ padding: '14px 12px' }}>Запись сілтемесі</th>
                    <th style={{ padding: '14px 12px' }}>Отслежка сілтемесі</th>
                    <th style={{ padding: '14px 12px' }}>Ескеру керек жағдайлар</th>
                    <th style={{ padding: '14px 16px', width: 170 }}>Автоматика</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Жүктелуде...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Кураторлар қосылмаған</td></tr>
                  ) : rows.map((row) => (
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
                        {row.video_link ? (
                          <a href={row.video_link} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                            🎬 Видеоны көру
                          </a>
                        ) : row.meet_link ? (
                          <span style={{ color: '#d97706', fontSize: 11, fontWeight: 600 }}>⏳ Жазба дайындалуда</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '12px' }}>
                        {row.attendance_link ? (
                          <a href={row.attendance_link} target="_blank" rel="noreferrer" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>
                            📊 Отслежка ашу
                          </a>
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
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {!row.meet_link ? (
                            <button onClick={() => handleCreateMeet(row.id, row.curator_name)} disabled={actionLoading[row.id] === 'meet'}
                              style={{ padding: '6px 10px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                              {actionLoading[row.id] === 'meet' ? '...' : '🎥 Мит ашу'}
                            </button>
                          ) : (
                            <a href={row.meet_link} target="_blank" rel="noreferrer"
                              style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700, fontSize: 10, textDecoration: 'none' }}>
                              🔗 {row.meet_code}
                            </a>
                          )}

                          {row.meet_code && (!row.video_link || !row.attendance_link) && (
                            <button onClick={() => handleSyncDrive(row.id, row.meet_code)} disabled={actionLoading[row.id] === 'drive'}
                              style={{ padding: '6px 8px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                              {actionLoading[row.id] === 'drive' ? '...' : '🔄 Жаңарту'}
                            </button>
                          )}

                          <button onClick={() => handleDeleteRow(row.id)}
                            style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: 'none', fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
