import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { SUBJECT_COLORS, SUBJECT_LOGOS } from './scheduleData';
import { motion } from 'framer-motion';
import { SHEETS_LOGO } from '../components/brandLogos';
import { IconMeetLogo, IconBolt, IconVideo, IconClock, IconClose, IconTable } from '../components/icons';
import WeekBookingCalendar, { getFilterMonday, minutesToTime, toLocalISODate } from '../components/WeekBookingCalendar';
import BookingModal from '../components/BookingModal';

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

export default function StRecordings() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isCurator = currentUser.role === 'curator';
  const isCoordinator = currentUser.role === 'coordinator';

  const [searchParams, setSearchParams] = useSearchParams();

  const currentSubjectCode = searchParams.get('subject') || ((isCurator || isCoordinator) ? currentUser.subject : null);
  const currentStream = searchParams.get('stream') || ((isCurator || isCoordinator) ? (currentUser.streamId || '01') : '01');
  const currentMonth = parseInt(searchParams.get('month') || '1', 10);
  const currentWeek = parseInt(searchParams.get('week') || '1', 10);

  const selectedSubject = SUBJECTS.find(s => s.code === currentSubjectCode) || null;
  const availableMonths = Array.from({ length: selectedSubject ? selectedSubject.months : 5 }, (_, i) => i + 1);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCurator, setNewCurator] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [modalSlot, setModalSlot] = useState(null); // { date, startTime } | null
  const [bookingLoading, setBookingLoading] = useState(false);
  const [coordinatorView, setCoordinatorView] = useState('calendar'); // 'calendar' | 'table'
  const monday = getFilterMonday(currentMonth, currentWeek);

  useEffect(() => {
    if (selectedSubject) loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSubjectCode, currentStream, currentMonth, currentWeek]);

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

  const handleAddCurator = async () => {
    if (!newCurator.trim()) return;
    try {
      const { data } = await api.post('/st-recordings/curator', {
        subject: currentSubjectCode,
        streamId: currentStream,
        monthNum: currentMonth,
        weekNum: currentWeek,
        curatorName: newCurator.trim(),
      });
      setRows(prev => [...prev, data]);
      setNewCurator('');
    } catch (err) {
      alert('Қателік: ' + (err.response?.data?.error || err.message));
    }
  };

  // Куратордың осы аптаға (абстрактілі "1-ай/1-апта") жазбасы әлі жоқ болса,
  // бронь жасамас бұрын алдымен соны жасайды.
  const ensureRecordingRow = async () => {
    if (rows[0]) return rows[0].id;
    const { data } = await api.post('/st-recordings/curator', {
      subject: currentSubjectCode,
      streamId: currentStream,
      monthNum: currentMonth,
      weekNum: currentWeek,
      curatorName: currentUser.fullName,
    });
    setRows([data]);
    return data.id;
  };

  // Куратордың календарынан: слот белгілі, жол болмаса лезде жасалады.
  const handleSlotClick = (date, startMin) => {
    setModalSlot({ date, startTime: minutesToTime(startMin), recordingId: rows[0]?.id ?? null });
  };

  // Admin кестесінен: жол әрдайым бар (rows.map-тен келеді), уақыт әдепкіде "қазір".
  const handleOpenBookingForRow = (row) => {
    const now = new Date();
    setModalSlot({
      date: toLocalISODate(now),
      startTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      recordingId: row.id,
    });
  };

  const handleCreateBooking = async (payload) => {
    setBookingLoading(true);
    try {
      const recordingId = modalSlot.recordingId || await ensureRecordingRow();
      const { data: booking } = await api.post(`/st-recordings/${recordingId}/bookings`, payload);
      setRows(prev => prev.map(r => r.id === recordingId ? { ...r, bookings: [...(r.bookings || []), booking] } : r));
      setModalSlot(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Мит жасауда қателік');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (!confirm('Бұл броньды өшіруге сенімдісіз бе?')) return;
    try {
      await api.delete(`/st-recordings/bookings/${bookingId}`);
      setRows(prev => prev.map(r => ({ ...r, bookings: (r.bookings || []).filter(b => b.id !== bookingId) })));
    } catch (err) {
      alert(err.response?.data?.error || 'Өшіруде қателік');
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
    if (!confirm('Өшіруге сенімдісіз бе?')) return;
    try {
      await api.delete(`/st-recordings/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
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
              СТ Жүйесі {selectedSubject ? `· ${selectedSubject.name}` : ''}
            </h1>
          </div>
          {selectedSubject && !isCurator && !isCoordinator && (
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
              return (
                <motion.div
                  key={s.code}
                  whileHover={{ y: -6, boxShadow: `0 16px 32px ${col.primary}30` }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateFilters({ subject: s.code, stream: '01', month: '1', week: '1' })}
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
            <div style={{ position: 'relative', display: 'flex' }}>
              <button onClick={() => setShowFilter(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 20,
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-sub)',
                  fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                }}>
                <IconBolt style={{ width: 13, height: 13, color: '#f59e0b' }} /> {selectedSubject.code}-{currentStream} · {currentMonth}-ай · {currentWeek}-апта
                <span style={{ opacity: 0.6, fontSize: 11 }}>▾</span>
              </button>

              {showFilter && (
                <>
                  <div onClick={() => setShowFilter(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
                  <div className="card" style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 40,
                    padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, width: 'max-content', maxWidth: '90vw',
                  }}>
                    {!isCurator && !isCoordinator && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', width: 60 }}>АҒЫМ:</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', width: 60 }}>АЙ:</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                </>
              )}
            </div>

            {isCurator ? (
              // ── Куратордың өз Мит-календары: бос уақытты басып, СТ немесе
              // жеке сөйлесу бекітеді — Мит сол сәтте, сол уақытпен жасалады ──
              loading ? (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Жүктелуде...</div>
              ) : (() => {
                const row = rows[0];
                const bookings = row?.bookings || [];
                const videoLinks = row?.video_links || (row?.video_link ? [row.video_link] : []);
                const attendanceLinks = row?.attendance_links || (row?.attendance_link ? [row.attendance_link] : []);
                const hasSt = bookings.some(b => b.meeting_type === 'st');
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {row && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Ескеру керек жағдай:</label>
                        <input
                          defaultValue={row.notes || ''}
                          placeholder="Мыс: ауырып тұр..."
                          onBlur={(e) => handleUpdateRow(row.id, 'notes', e.target.value)}
                          style={{ flex: 1, minWidth: 120, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5 }}
                        />
                      </div>
                    )}

                    <WeekBookingCalendar
                      monday={monday}
                      bookings={bookings}
                      onSlotClick={handleSlotClick}
                      onDeleteBooking={(b) => handleDeleteBooking(b.id)}
                    />

                    {hasSt && (
                      <div className="card" style={{ padding: 18, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Видео жазба</div>
                          {videoLinks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {videoLinks.map((v, idx) => (
                                <a key={idx} href={v} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', fontWeight: 600, textDecoration: 'none', fontSize: 12.5 }}>
                                  <IconVideo style={{ width: 13, height: 13 }} /> Запись {videoLinks.length > 1 ? idx + 1 : ''}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#d97706', fontSize: 11.5, fontWeight: 600 }}>
                              <IconClock style={{ width: 12, height: 12 }} /> Әлі дайын емес — автоматты түрде табылады
                            </span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Отслежка</div>
                          {attendanceLinks.length > 0 ? (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {attendanceLinks.map((a, idx) => (
                                <a key={idx} href={a} target="_blank" rel="noreferrer" title="Отслежка">
                                  {SHEETS_LOGO
                                    ? <img src={SHEETS_LOGO} alt="Отслежка" style={{ width: 20, height: 20 }} />
                                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 600, fontSize: 12.5 }}><IconTable style={{ width: 13, height: 13 }} /> Отслежка {attendanceLinks.length > 1 ? idx + 1 : ''}</span>}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#d97706', fontSize: 11.5, fontWeight: 600 }}>
                              <IconClock style={{ width: 12, height: 12 }} /> Әлі дайын емес — автоматты түрде табылады
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : isCoordinator ? (
              // ── Координатордың аггрегат-көрінісі: сол ағымдағы барлық
              // куратордың деректері, тек оқу үшін. Күнтізбе немесе
              // админдікіндей кесте түрінде таңдап қарауға болады. ──
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--surface2)', width: 'fit-content' }}>
                  {[{ id: 'calendar', label: 'Күнтізбе' }, { id: 'table', label: 'Кесте' }].map(v => (
                    <button key={v.id} onClick={() => setCoordinatorView(v.id)}
                      style={{
                        padding: '7px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: coordinatorView === v.id ? '#f59e0b' : 'transparent',
                        color: coordinatorView === v.id ? '#fff' : 'var(--text-sub)',
                      }}>
                      {v.label}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Жүктелуде...</div>
                ) : coordinatorView === 'calendar' ? (
                  <WeekBookingCalendar
                    monday={monday}
                    bookings={rows.flatMap(r => (r.bookings || []).map(b => ({ ...b, curator_name: r.curator_name })))}
                    readOnly
                  />
                ) : (
                  <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                    <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5, minWidth: 700 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text-sub)', fontWeight: 700 }}>
                          <th style={{ padding: '14px 16px' }}>Куратор аты-жөні</th>
                          <th style={{ padding: '14px 12px', width: 110 }}>СТ тапсырды</th>
                          <th style={{ padding: '14px 12px' }}>Запись сілтемелері</th>
                          <th style={{ padding: '14px 12px' }}>Отслежка сілтемелері</th>
                          <th style={{ padding: '14px 12px' }}>Ескеру керек жағдайлар</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Кураторлар қосылмаған</td></tr>
                        ) : rows.map((row) => {
                          const videoLinks = row.video_links || (row.video_link ? [row.video_link] : []);
                          const attendanceLinks = row.attendance_links || (row.attendance_link ? [row.attendance_link] : []);
                          const bookings = row.bookings || [];
                          return (
                            <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>{row.curator_name}</td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>{row.students_count || '0'}</td>
                              <td style={{ padding: '12px' }}>
                                {videoLinks.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {videoLinks.map((v, idx) => (
                                      <a key={idx} href={v} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#2563eb', fontWeight: 600, textDecoration: 'none', fontSize: 11.5 }}>
                                        <IconVideo style={{ width: 12, height: 12 }} /> Запись {videoLinks.length > 1 ? idx + 1 : ''}
                                      </a>
                                    ))}
                                  </div>
                                ) : bookings.length > 0 ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#d97706', fontSize: 11, fontWeight: 600 }}><IconClock style={{ width: 12, height: 12 }} /> Жазба дайындалуда</span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '12px' }}>
                                {attendanceLinks.length > 0 ? (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {attendanceLinks.map((a, idx) => (
                                      <a key={idx} href={a} target="_blank" rel="noreferrer" title="Отслежка">
                                        {SHEETS_LOGO
                                          ? <img src={SHEETS_LOGO} alt="Отслежка" style={{ width: 18, height: 18 }} />
                                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#059669', fontWeight: 600, fontSize: 11.5 }}><IconTable style={{ width: 12, height: 12 }} /> Отслежка {attendanceLinks.length > 1 ? idx + 1 : ''}</span>}
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '12px', color: 'var(--text-sub)' }}>{row.notes || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input placeholder="Жаңа куратор қосу..." value={newCurator} onChange={e => setNewCurator(e.target.value)}
                style={{ width: 260, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
              <button onClick={handleAddCurator}
                style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                + Қосу
              </button>
              <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--text-sub)' }}>
                Осы аптада: <span style={{ color: 'var(--text)' }}>{rows.length}</span> куратор
              </div>
            </div>

            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5, minWidth: 760 }}>
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
                    const bookings = row.bookings || [];

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
                                <a key={idx} href={v} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#2563eb', fontWeight: 600, textDecoration: 'none', fontSize: 11.5 }}>
                                  <IconVideo style={{ width: 12, height: 12 }} /> Запись {videoLinks.length > 1 ? idx + 1 : ''}
                                </a>
                              ))}
                            </div>
                          ) : bookings.length > 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#d97706', fontSize: 11, fontWeight: 600 }}><IconClock style={{ width: 12, height: 12 }} /> Жазба дайындалуда</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '12px' }}>
                          {attendanceLinks.length > 0 ? (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {attendanceLinks.map((a, idx) => (
                                <a key={idx} href={a} target="_blank" rel="noreferrer" title="Отслежка">
                                  {SHEETS_LOGO
                                    ? <img src={SHEETS_LOGO} alt="Отслежка" style={{ width: 18, height: 18 }} />
                                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#059669', fontWeight: 600, fontSize: 11.5 }}><IconTable style={{ width: 12, height: 12 }} /> Отслежка {attendanceLinks.length > 1 ? idx + 1 : ''}</span>}
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
                            <button onClick={() => handleOpenBookingForRow(row)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                              <IconMeetLogo style={{ width: 14, height: 14 }} />
                              {bookings.length > 0 ? '+ Жаңа Мит' : 'Мит ашу'}
                            </button>

                            {bookings.map((b) => (
                              <a key={b.id} href={b.meet_link} target="_blank" rel="noreferrer" title={`${b.meeting_type === 'st' ? 'СТ' : 'Жеке'} · ${String(b.scheduled_date).slice(0,10)} ${b.start_time.slice(0,5)}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 6px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700, fontSize: 10, textDecoration: 'none' }}>
                                <IconMeetLogo style={{ width: 12, height: 12 }} />
                                {b.start_time.slice(0, 5)}
                              </a>
                            ))}

                            <button onClick={() => handleDeleteRow(row.id)}
                              style={{ display: 'flex', padding: '5px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: 'none', fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}>
                              <IconClose style={{ width: 12, height: 12 }} />
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
            </>
            )}
          </div>
        )}
      </main>

      {modalSlot && (
        <BookingModal
          initialDate={modalSlot.date}
          initialStartTime={modalSlot.startTime}
          onClose={() => setModalSlot(null)}
          onSubmit={handleCreateBooking}
          loading={bookingLoading}
        />
      )}
    </div>
  );
}
