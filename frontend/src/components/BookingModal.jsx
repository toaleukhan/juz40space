import { useState } from 'react';
import { IconClose, IconMeetLogo } from './icons';

const inputStyle = {
  width: '100%', padding: '9px 10px', borderRadius: 9, boxSizing: 'border-box',
  border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13.5,
};
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 };

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(((total % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
  const mm = ((total % 60) + 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function BookingModal({ initialDate, initialStartTime, onClose, onSubmit, loading }) {
  const [meetingType, setMeetingType] = useState('st');
  const [studentsCount, setStudentsCount] = useState('');
  const [scheduledDate, setScheduledDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(addMinutes(initialStartTime, 60));

  const handleSubmit = () => {
    if (!scheduledDate || !startTime || !endTime) return;
    onSubmit({ meetingType, studentsCount, scheduledDate, startTime, endTime });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div className="card" style={{ position: 'relative', width: 'min(92vw, 420px)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Жаңа уақыт белгілеу</div>
          <button onClick={onClose} aria-label="Жабу"
            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconClose />
          </button>
        </div>

        <div>
          <label style={labelStyle}>Түрі</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMeetingType('st')} style={{
              flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              border: `1.5px solid ${meetingType === 'st' ? 'var(--accent)' : 'var(--border)'}`,
              background: meetingType === 'st' ? 'var(--accent-soft)' : 'var(--surface2)',
              color: meetingType === 'st' ? 'var(--accent)' : 'var(--text-sub)',
            }}>Сабақ тапсыру (СТ)</button>
            <button onClick={() => setMeetingType('personal')} style={{
              flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              border: `1.5px solid ${meetingType === 'personal' ? '#8b5cf6' : 'var(--border)'}`,
              background: meetingType === 'personal' ? 'rgba(139,92,246,0.12)' : 'var(--surface2)',
              color: meetingType === 'personal' ? '#8b5cf6' : 'var(--text-sub)',
            }}>Жеке сөйлесу</button>
          </div>
        </div>

        {meetingType === 'st' && (
          <div>
            <label style={labelStyle}>СТ-ге кіретін оқушы саны</label>
            <input type="number" min="0" className="no-spinner" value={studentsCount} onChange={(e) => setStudentsCount(e.target.value)} style={inputStyle} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1.3 }}>
            <label style={labelStyle}>Күні</label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Басталуы</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Аяқталуы</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <button onClick={handleSubmit} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1.5px solid rgba(16,185,129,0.35)', fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          <IconMeetLogo style={{ width: 18, height: 18 }} />
          {loading ? 'Жасалуда...' : 'Сақтау және Мит жасау'}
        </button>
      </div>
    </div>
  );
}
