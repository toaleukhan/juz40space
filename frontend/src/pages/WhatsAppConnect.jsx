import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function WhatsAppConnect() {
  const navigate = useNavigate();
  const [qr, setQr] = useState(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const evtSource = new EventSource(`${apiUrl}/whatsapp/qr?token=${token}`);
    evtSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'qr') { setQr(data.qr); setStatus('waiting'); }
      else if (data.type === 'status' && data.status === 'connected') {
        setStatus('connected');
        evtSource.close();
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    };
    evtSource.onerror = () => {};
    return () => evtSource.close();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
      <div className="bg-blobs">
        <div className="blob" style={{ width: 400, height: 400, background: 'rgba(124,58,237,0.15)', top: '-80px', left: '-80px' }} />
        <div className="blob" style={{ width: 300, height: 300, background: 'rgba(34,197,94,0.1)', bottom: '-60px', right: '-60px' }} />
      </div>
      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px' }}>
            <span style={{ color: '#a78bfa' }}>JUZ</span>
            <span style={{ color: 'rgba(255,255,255,0.9)' }}>NOTIFY</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: 6, fontSize: 14 }}>WhatsApp номеріңізді қосыңыз</p>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {['1. Тіркелу', '2. WhatsApp', '3. Басты бет'].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 10, fontSize: 11, fontWeight: 600,
              background: i === 0 ? 'rgba(34,197,94,0.15)' : i === 1 ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.3)' : i === 1 ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color: i === 0 ? '#4ade80' : i === 1 ? '#a78bfa' : 'rgba(255,255,255,0.2)' }}>{s}</div>
          ))}
        </div>

        <div className="glass" style={{ padding: 32, textAlign: 'center' }}>
          {status === 'connected' ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <p style={{ fontWeight: 600, color: '#4ade80', fontSize: 16 }}>WhatsApp қосылды!</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: 8, fontSize: 13 }}>Басты бетке өтуде...</p>
            </div>
          ) : qr ? (
            <>
              <div style={{ background: 'white', borderRadius: 16, padding: 16, display: 'inline-block', marginBottom: 20 }}>
                <img src={qr} alt="QR" style={{ width: 200, height: 200, display: 'block' }} />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>QR кодты сканерлеңіз</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
                WhatsApp → Байланылған құрылғылар<br />→ Құрылғы қосу
              </p>
              <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '8px 16px', borderRadius: 999 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                <span style={{ fontSize: 12, color: '#4ade80' }}>Байланыс күтілуде...</span>
              </div>
            </>
          ) : (
            <div style={{ padding: '20px 0' }}>
              <div style={{ width: 44, height: 44, border: '3px solid rgba(124,58,237,0.6)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>QR жүктелуде...</p>
            </div>
          )}
          <button className="ios btn-g" onClick={() => navigate('/dashboard')} style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}>
            Кейін тіркеймін
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
