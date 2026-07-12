// QualityTracker.jsx — Сапа менеджерінің әр куратор бойынша 2 айлық тексеру трекері.
// Толық рубрика (ЧАТ/СТ регламенттерінің әр тармағы) орнына жеңіл нұсқа: тексерілді/жоқ белгісі,
// балл, ескертпе және сыртқы Google Sheet-ке сілтеме — сапа менеджерінің қазіргі жұмыс үрдісін қайталайды.

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import useIsMobile from '../hooks/useIsMobile';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getPeriodId, getPeriodLabel } from './trackerPeriod';

function shiftPeriod(periodId, dir) {
  const [y, m] = periodId.split('-').map(Number);
  let newM = m + dir * 2;
  let newY = y;
  if (newM < 1) { newM = 11; newY -= 1; }
  if (newM > 11) { newM = 1; newY += 1; }
  return `${newY}-${String(newM).padStart(2, '0')}`;
}

function EditModal({ row, period, onClose, onSaved }) {
  const [status, setStatus] = useState(row.entry?.status || 'done');
  const [score, setScore] = useState(row.entry?.score || '');
  const [notes, setNotes] = useState(row.entry?.notes || '');
  const [sheetLink, setSheetLink] = useState(row.entry?.sheet_link || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      const { data } = await api.put(`/tracker/${row.curator.id}`, { period, status, score, notes, sheetLink });
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Сервер қатесі');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13,
    border: '1px solid var(--border-dark)', background: 'var(--surface-solid)',
    color: 'var(--text)', fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} className="card card-lg" style={{
        width: 'min(420px, 100%)', padding: 22, background: 'var(--surface-solid)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{row.curator.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: -8 }}>{getPeriodLabel(period)}</div>

        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 4, display: 'block' }}>Мәртебе</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="pending">Тексерілмеген</option>
            <option value="done">Тексерілді</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 4, display: 'block' }}>Балл / рейтинг</label>
          <input value={score} onChange={e => setScore(e.target.value)} placeholder="мыс. 92%" style={inputStyle} />
        </div>

        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 4, display: 'block' }}>Google Sheet сілтемесі</label>
          <input value={sheetLink} onChange={e => setSheetLink(e.target.value)} placeholder="https://docs.google.com/..." style={inputStyle} />
        </div>

        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 4, display: 'block' }}>Ескертпе</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border-dark)',
            background: 'transparent', color: 'var(--text-sub)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>Бас тарту</button>
          <button onClick={save} disabled={saving} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13,
            cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>{saving ? 'Сақталуда...' : 'Сақтау'}</button>
        </div>
      </div>
    </div>
  );
}

export default function QualityTracker() {
  const { curator } = useAuth();
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState(getPeriodId());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editRow, setEditRow] = useState(null);

  const canAccess = curator?.role === 'admin' || curator?.role === 'quality_manager';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/tracker', { params: { period } });
      setRows(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Сервер қатесі');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { if (canAccess) load(); }, [canAccess, load]);

  if (!canAccess) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Бұл бетке рұқсатыңыз жоқ
        </main>
      </div>
    );
  }

  const doneCount = rows.filter(r => r.entry?.status === 'done').length;
  const pct = rows.length ? Math.round((doneCount / rows.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',system-ui,sans-serif", background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: isMobile ? '64px 16px 24px' : '32px 40px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.5px' }}>Сапа трекері</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '5px 0 0' }}>
              Әр куратор бойынша 2 айлық тексеру — кезеңде 100% толтырылуы тиіс
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setPeriod(p => shiftPeriod(p, -1))} className="glass-pill" style={{
              width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontSize: 16, color: 'var(--text)',
            }}>‹</button>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 150, textAlign: 'center' }}>
              {getPeriodLabel(period)}
            </div>
            <button onClick={() => setPeriod(p => shiftPeriod(p, 1))} className="glass-pill" style={{
              width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontSize: 16, color: 'var(--text)',
            }}>›</button>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            {doneCount}/{rows.length} тексерілді
          </div>
          <div style={{ flex: 1, height: 8, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#16a34a' : 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? '#16a34a' : 'var(--accent)' }}>{pct}%</div>
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Жүктелуде...</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {rows.map((row, i) => {
              const done = row.entry?.status === 'done';
              return (
                <div key={row.curator.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                  borderTop: i ? '1px solid var(--border-dark)' : 'none', flexWrap: 'wrap',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: done ? '#16a34a' : '#f59e0b',
                  }} />
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{row.curator.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.curator.phone}</div>
                  </div>
                  {row.entry?.score && (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>{row.entry.score}</div>
                  )}
                  {row.entry?.sheet_link && (
                    <a href={row.entry.sheet_link} target="_blank" rel="noreferrer" style={{ fontSize: 16, textDecoration: 'none' }} title="Google Sheet">🔗</a>
                  )}
                  <button onClick={() => setEditRow(row)} style={{
                    padding: '7px 14px', borderRadius: 9, border: '1px solid var(--border-dark)',
                    background: done ? 'transparent' : 'var(--accent-soft)', color: 'var(--accent)',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>{done ? 'Өзгерту' : 'Толтыру'}</button>
                </div>
              );
            })}
            {!rows.length && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Куратор табылмады</div>
            )}
          </div>
        )}
      </main>

      {editRow && (
        <EditModal
          row={editRow}
          period={period}
          onClose={() => setEditRow(null)}
          onSaved={(entry) => setRows(rs => rs.map(r => r.curator.id === editRow.curator.id ? { ...r, entry } : r))}
        />
      )}
    </div>
  );
}
