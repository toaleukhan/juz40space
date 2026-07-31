import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getTelegramInitData } from '../utils/telegram';
import juz40Logo from '../assets/juz40-logo.png';
import { IconAlert } from './icons';

// Telegram Mini App ішінде ашылғанда Login.jsx-тің орнына осы рендерленеді:
// тар WebView-ге сыятын компакт форма. Алдымен telegram_id бойынша
// автоматты кіруді байқап көреді ("checking"), табылмаса — бір реттік
// логин/пароль сұрап, привязка жасайды ("link").
export default function TelegramLinkForm() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking | link | linking
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const finishLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    navigate('/st-recordings', { replace: true });
  };

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    (async () => {
      try {
        const { data } = await api.post('/auth/telegram', { initData: getTelegramInitData() });
        if (data.linked) finishLogin(data);
        else setStatus('link');
      } catch (err) {
        setError(err.response?.data?.error || 'Telegram-мен байланыста қателік');
        setStatus('link');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('linking');
    setError('');
    try {
      const { data } = await api.post('/auth/telegram/link', {
        initData: getTelegramInitData(),
        username: form.username,
        password: form.password,
      });
      finishLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Логин немесе пароль қате');
      setStatus('link');
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
    border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)',
    fontSize: 15, outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', fontFamily: "'Inter',system-ui,sans-serif", padding: 24, boxSizing: 'border-box',
    }}>
      <img src={juz40Logo} alt="JUZ40" style={{ height: 40, marginBottom: 20 }} />

      {status === 'checking' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-block', width: 24, height: 24,
            border: '3px solid var(--border)', borderTop: '3px solid var(--accent)',
            borderRadius: '50%', animation: 'tgspin 0.7s linear infinite',
          }} />
          <style>{'@keyframes tgspin { to { transform: rotate(360deg); } }'}</style>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>Telegram арқылы кіру тексерілуде...</div>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
              Аккаунтыңызды байланыстырыңыз
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-sub)', margin: 0 }}>
              Бір рет логин/парольмен кіріңіз — келесі жолдан бастап Telegram өзі таниды
            </p>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
              color: '#dc2626', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <IconAlert style={{ width: 14, height: 14, flexShrink: 0 }} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text" placeholder="Логин" autoComplete="username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              style={inputStyle}
            />
            <input
              type="password" placeholder="Пароль" autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={status === 'linking'}
              style={{
                padding: 13, borderRadius: 12, marginTop: 4,
                background: status === 'linking' ? '#9ab5a5' : '#1B6E7E',
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: status === 'linking' ? 'default' : 'pointer',
              }}
            >
              {status === 'linking' ? 'Кіруде...' : 'Байланыстыру'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
