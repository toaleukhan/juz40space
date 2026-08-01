import { useEffect, useState } from 'react';
import { IconClose } from './icons';
import api from '../services/api';

function fmtTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' });
}

export default function MeetJournalModal({ meetCode, curatorName, onClose }) {
  const [participants, setParticipants] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setParticipants(null);
    setError(false);
    api.get(`/st-recordings/meet-journal?code=${meetCode}`)
      .then(({ data }) => { if (!cancelled) setParticipants(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [meetCode]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div className="card" style={{
        position: 'relative', width: 'min(92vw, 420px)', maxHeight: '80vh',
        padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
            Қатысушылар журналы{curatorName ? ` — ${curatorName}` : ''}
          </div>
          <button onClick={onClose} aria-label="Жабу" style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)',
            color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <IconClose />
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {participants === null && !error && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: 13 }}>Жүктелуде...</div>
          )}
          {error && (
            <div style={{ textAlign: 'center', color: '#d97706', padding: 20, fontSize: 13 }}>
              Журналды алу мүмкін болмады
            </div>
          )}
          {participants?.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: 13 }}>
              Деректер табылмады
            </div>
          )}
          {participants?.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '9px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)',
            }}>
              <span style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.name}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {fmtTime(p.joinedAt)}–{p.leftAt ? fmtTime(p.leftAt) : 'қазір'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
