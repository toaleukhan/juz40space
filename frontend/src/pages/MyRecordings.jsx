import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

export default function MyRecordings() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyRecordings();
  }, []);

  const loadMyRecordings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/st-recordings?subject=${user.subject || 'ФИЗ'}&streamId=${user.streamId || '01'}`);
      setRecordings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '32px 40px', minWidth: 0, overflowY: 'auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            JUZ40 · ЖЕКЕ АРХИВ
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', margin: '4px 0 0', letterSpacing: '-0.5px' }}>
            📂 Менің записьтерім & Есептерім
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
            Барлық ашқан Миттеріңіз бен тапсырған СТ видео-есептеріңіздің ресми архиві.
          </p>
        </div>

        <div className="card" style={{ overflow: 'hidden', padding: 0, borderRadius: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text-sub)', fontWeight: 800 }}>
                <th style={{ padding: '14px 16px' }}>Ай / Апта</th>
                <th style={{ padding: '14px 16px' }}>Оқушы саны</th>
                <th style={{ padding: '14px 16px' }}>Мит Кодтары</th>
                <th style={{ padding: '14px 16px' }}>Видео Записьтер</th>
                <th style={{ padding: '14px 16px' }}>Отслежка сілтемелері</th>
                <th style={{ padding: '14px 16px' }}>Ескертулер</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Жүктелуде...</td></tr>
              ) : recordings.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Сізде әлі жазбалар жоқ</td></tr>
              ) : recordings.map((row) => {
                const videoLinks = row.video_links || (row.video_link ? [row.video_link] : []);
                const attendanceLinks = row.attendance_links || (row.attendance_link ? [row.attendance_link] : []);
                const meetCodes = row.meet_codes || (row.meet_code ? [row.meet_code] : []);

                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text)' }}>
                      📅 {row.month_num}-ай · {row.week_num}-апта
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                      👨‍🎓 {row.students_count || 0}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {meetCodes.length > 0 ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {meetCodes.map((code, i) => (
                            <span key={i} style={{ padding: '3px 7px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#059669', fontWeight: 700, fontSize: 11 }}>
                              🔗 {code}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {videoLinks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {videoLinks.map((v, i) => (
                            <a key={i} href={v} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none', fontSize: 12 }}>
                              🎬 Запись {videoLinks.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {attendanceLinks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {attendanceLinks.map((a, i) => (
                            <a key={i} href={a} target="_blank" rel="noreferrer" style={{ color: '#059669', fontWeight: 700, textDecoration: 'none', fontSize: 12 }}>
                              📊 Отслежка {attendanceLinks.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-sub)', fontSize: 12 }}>
                      {row.notes || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}