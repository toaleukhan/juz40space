import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconAlert } from '../components/icons';
import ConstellationField from '../components/ConstellationField';
import TelegramLinkForm from '../components/TelegramLinkForm';
import { isTelegramWebApp } from '../utils/telegram';

// Логин беті платформаның атын түсіндіретін бір ишараға құрылған:
// экранға шашыраған ұсақ бөлшектер — бөлек-бөлек жүрген СТ-лар.
// Курсор оларды өзіне тартады, ал «Кіру» басылғанда бәрі ортаға
// жиналып, ішінде форма ашылатын бір кеңістік — SPACE — құрайды.
//
// Палитра осы бетте ғана жабық: таза қара фон, жалғыз күлгін акцент,
// ешқандай карточка, жиек не көлеңке жоқ — бәрі бос кеңістікте қалқиды.

const VIOLET = '#8052ff';
const AMBER = '#ffb829';
const ASH = '#9a9a9a';
const MIST = '#bdbdbd';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);          // форма ашылды ма
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const phoneRef = useRef(null);

  // Бөлшектер жиналып болғанда ғана фокус беріледі — әйтпесе
  // анимация басталмай жатып бет секіріп кетеді.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => phoneRef.current?.focus(), 620);
    return () => clearTimeout(id);
  }, [open]);

  // Telegram Mini App ішінде ашылса — тар WebView-ге сыймайтын
  // desktop-форманың орнына компакт байланыстыру ағыны көрінеді.
  // Барлық hook-тардан КЕЙІН тексерілуі керек (Rules of Hooks).
  if (isTelegramWebApp()) return <TelegramLinkForm />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(form.phone, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Телефон немесе пароль қате');
    } finally { setLoading(false); }
  };

  const input = {
    width: '100%', boxSizing: 'border-box',
    background: 'transparent', border: 0,
    borderBottom: '1px solid rgba(255,255,255,.18)',
    borderRadius: 0, padding: '12px 0',
    color: '#fff', fontSize: 18, fontWeight: 200, fontFamily: 'inherit',
    outline: 'none', transition: 'border-color .25s',
  };

  const label = {
    display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.35px',
    textTransform: 'uppercase', color: ASH, marginBottom: 4,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', color: '#fff', overflow: 'hidden',
      fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes lg-rise { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:none } }
        @keyframes lg-spin { to { transform:rotate(360deg) } }
        .lg-cta { transition: transform .25s cubic-bezier(.22,.61,.36,1), opacity .25s }
        .lg-cta:hover:not(:disabled) { transform: translateY(-2px) }
        .lg-cta:active:not(:disabled) { transform: none }
        .lg-in:focus { border-bottom-color: ${VIOLET} !important }
        .lg-in::placeholder { color: rgba(255,255,255,.24) }
        .lg-ghost { transition: color .2s }
        .lg-ghost:hover { color:#fff !important }
        .lg-stage { animation: lg-rise .55s cubic-bezier(.22,.61,.36,1) both }
        /* Chrome автотолтыруы қара фонды ақ қылып жібермеуі үшін */
        .lg-in:-webkit-autofill, .lg-in:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>

      <ConstellationField gathered={open} style={{ position: 'absolute', inset: 0 }} />

      {/* ── Бренд ── */}
      <div style={{
        position: 'absolute', top: 30, left: 'clamp(20px, 5vw, 60px)', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 0 L16 14 L0 14 Z" fill={VIOLET} />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '.35px', textTransform: 'uppercase' }}>
          JUZ40 <span style={{ color: ASH }}>Space</span>
        </span>
      </div>

      {/* ── Орталық сахна ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'grid', placeItems: 'center',
        padding: 'clamp(20px, 5vw, 60px)', pointerEvents: 'none',
      }}>
        {!open ? (
          <div className="lg-stage" style={{ textAlign: 'center', pointerEvents: 'auto', maxWidth: 780 }}>
            <p style={{
              fontSize: 14, fontWeight: 600, letterSpacing: '.35px', textTransform: 'uppercase',
              color: AMBER, margin: '0 0 24px',
            }}>
              40+ пән-ағым · бір кеңістік
            </p>
            <h1 style={{
              fontSize: 'clamp(46px, 9vw, 113px)', lineHeight: 1.05, fontWeight: 400,
              letterSpacing: '-0.04em', margin: 0,
            }}>
              Шашыраған СТ<br />бір жерге жиналады.
            </h1>
            <p style={{
              fontSize: 18, fontWeight: 200, lineHeight: 1.5, color: MIST,
              margin: '30px auto 0', maxWidth: 520,
            }}>
              Кураторлардың тірі сессиялары, жазбалары мен отслежкалары —
              бәрі өзі жиналып, бір кестеге түседі.
            </p>
            <button
              type="button" className="lg-cta"
              onClick={() => setOpen(true)}
              style={{
                marginTop: 42, padding: '15px 34px', borderRadius: 24, border: 0,
                background: VIOLET, color: '#fff', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, letterSpacing: '.35px',
                textTransform: 'uppercase', fontFamily: 'inherit',
              }}
            >
              Кіру
            </button>
          </div>
        ) : (
          <div className="lg-stage" style={{ pointerEvents: 'auto', width: '100%', maxWidth: 390 }}>
            <h2 style={{
              fontSize: 'clamp(34px, 5vw, 48px)', lineHeight: 1.1, fontWeight: 400,
              letterSpacing: '-0.04em', margin: '0 0 34px', textAlign: 'center',
            }}>
              Кеңістікке кіру
            </h2>

            {error && (
              <div role="alert" style={{
                display: 'flex', alignItems: 'center', gap: 9, marginBottom: 22,
                color: '#ff8a8f', fontSize: 14, fontWeight: 400,
              }}>
                <IconAlert style={{ width: 15, height: 15, flexShrink: 0 }} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
              <div>
                <label htmlFor="lg-phone" style={label}>Телефон немесе логин</label>
                <input
                  id="lg-phone" ref={phoneRef} className="lg-in" type="text"
                  autoComplete="username" placeholder="+7 700 000 00 00"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  style={input}
                />
              </div>

              <div>
                <label htmlFor="lg-pass" style={label}>Құпия сөз</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="lg-pass" className="lg-in" type={showPass ? 'text' : 'password'}
                    autoComplete="current-password" placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{ ...input, paddingRight: 78 }}
                  />
                  <button
                    type="button" className="lg-ghost"
                    onClick={() => setShowPass(v => !v)}
                    style={{
                      position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 0, cursor: 'pointer', padding: '4px 0',
                      fontSize: 14, fontWeight: 400, color: ASH, fontFamily: 'inherit',
                    }}
                  >
                    {showPass ? 'Жасыру' : 'Көрсету'}
                  </button>
                </div>
              </div>

              <button
                type="submit" className="lg-cta" disabled={loading}
                style={{
                  marginTop: 8, padding: '15px 34px', borderRadius: 24, border: 0,
                  background: loading ? '#4b3a86' : VIOLET, color: '#fff',
                  cursor: loading ? 'default' : 'pointer',
                  fontSize: 14, fontWeight: 600, letterSpacing: '.35px',
                  textTransform: 'uppercase', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 13, height: 13, borderRadius: '50%', display: 'inline-block',
                      border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff',
                      animation: 'lg-spin .7s linear infinite',
                    }} />
                    Кіруде…
                  </>
                ) : 'Кіру'}
              </button>
            </form>

            <button
              type="button" className="lg-ghost"
              onClick={() => { setOpen(false); setError(''); }}
              style={{
                display: 'block', margin: '26px auto 0', background: 'none', border: 0,
                cursor: 'pointer', fontSize: 14, fontWeight: 400, color: ASH, fontFamily: 'inherit',
              }}
            >
              ← Артқа
            </button>
          </div>
        )}
      </div>

      {/* ── Төменгі жол ── */}
      <p style={{
        position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', zIndex: 2,
        fontSize: 12, fontWeight: 200, color: '#5c5c5c', margin: 0, pointerEvents: 'none',
      }}>
        Аккаунт жоқ па? Координаторға хабарласыңыз · © 2026 JUZ40 Online Edu
      </p>
    </div>
  );
}
