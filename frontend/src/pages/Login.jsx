import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconAlert } from '../components/icons';
import CrystalField from '../components/CrystalField';
import TelegramLinkForm from '../components/TelegramLinkForm';
import { isTelegramWebApp } from '../utils/telegram';

// Логин беті бір ғана ишараға құрылған: экранда бір мұз монолиті тұр —
// платформаның өзі, ішінде барлық СТ сыйған кеңістік. «Кіру» басылғанда
// камера сол кристалдың ішіне кіреді де, форма аяздың ішінде ашылады.
//
// Палитра осы бетте жабық: суық көк-сұр, жалғыз ақ акцент. Ешқандай
// карточка, көлеңке жоқ — бәрі мұздың бетінде қалқиды.

const SCRAMBLE = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЫЭЮЯ0123456789';

// Тақырып әріптері бірінен соң бірі «орнына түседі» — igloo.inc-тегі
// SDF-scramble әсерінің DOM-дағы арзан баламасы.
const randChar = () => SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Әр кадрда жолдың ҰЗЫНДЫҒЫ өзгермеуі керек — әйтпесе тақырыптың ені
// секіріп, астындағы блоктар да қозғалып кетеді. Сондықтан әлі ашылмаған
// орындар бос қалмай, кездейсоқ таңбамен толтырылады.
const scrambleTo = (text, settled) =>
  text.split('').map((ch, i) => (ch === ' ' || i < settled ? ch : randChar())).join('');

function useScramble(text, delay = 0) {
  const [out, setOut] = useState(() => (reducedMotion() ? text : scrambleTo(text, 0)));

  useEffect(() => {
    if (reducedMotion()) return;

    let raf = 0, frame = 0;
    const total = text.length * 2.4 + 20;

    const tick = () => {
      frame++;
      setOut(scrambleTo(text, (frame / total) * text.length));
      if (frame >= total) { setOut(text); return; }
      raf = requestAnimationFrame(tick);
    };

    const startTimer = setTimeout(() => { raf = requestAnimationFrame(tick); }, delay);
    // Бет фонда ашылса requestAnimationFrame мүлде жүрмейді — сондықтан
    // тақырып шатасқан күйінде қалып қоймауын кепілдендіреміз.
    const guard = setTimeout(() => { cancelAnimationFrame(raf); setOut(text); }, delay + 4000);

    return () => { clearTimeout(startTimer); clearTimeout(guard); cancelAnimationFrame(raf); };
  }, [text, delay]);

  return out;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const phoneRef = useRef(null);

  const title = useScramble('JUZ40 SPACE', 260);

  // Камера кристалдың ішіне кіріп болғанда ғана фокус беріледі.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => phoneRef.current?.focus(), 900);
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
    background: 'rgba(255,255,255,.30)', border: '1px solid rgba(255,255,255,.55)',
    borderRadius: 2, padding: '13px 15px',
    color: '#0e141b', fontSize: 15, fontWeight: 400, fontFamily: 'inherit',
    outline: 'none', backdropFilter: 'blur(6px)',
    transition: 'border-color .25s, background .25s',
  };

  const label = {
    display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.16em',
    textTransform: 'uppercase', color: 'rgba(14,20,27,.66)', marginBottom: 8,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      background: 'linear-gradient(180deg,#5d6673 0%,#a0a5b1 100%)',
      fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes cf-rise { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
        @keyframes cf-spin { to { transform:rotate(360deg) } }
        .cf-cta {
          transition: background .3s, color .3s, letter-spacing .3s, border-color .3s;
        }
        .cf-cta:hover:not(:disabled) { background:#12181f; color:#e8edf2; letter-spacing:.22em }
        .cf-in:focus { border-color: rgba(18,24,31,.55) !important; background: rgba(255,255,255,.26) !important }
        .cf-in::placeholder { color: rgba(18,24,31,.34) }
        .cf-ghost { transition: color .2s }
        .cf-ghost:hover { color:#12181f !important }
        .cf-stage { animation: cf-rise .7s cubic-bezier(.22,.61,.36,1) both }
        .cf-in:-webkit-autofill, .cf-in:-webkit-autofill:focus {
          -webkit-text-fill-color:#12181f;
          transition: background-color 9999s ease-in-out 0s;
        }
        @media (prefers-reduced-motion: reduce) {
          .cf-stage { animation:none }
        }
      `}</style>

      <CrystalField entering={open} style={{ position: 'absolute', inset: 0 }} />

      {/* ── Бренд ── */}
      <div style={{
        position: 'absolute', top: 28, left: 'clamp(20px,5vw,56px)', zIndex: 2,
        fontSize: 11, fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase',
        color: open ? 'rgba(18,24,31,.62)' : 'rgba(255,255,255,.72)',
        transition: 'color .6s', fontVariantNumeric: 'tabular-nums',
      }}>
        JUZ40 Space
      </div>

      {/* ── Орталық сахна ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center',
        padding: 'clamp(20px,5vw,56px)', pointerEvents: 'none',
      }}>
        {!open ? (
          <div style={{ textAlign: 'center', pointerEvents: 'auto', maxWidth: 760 }}>
            <h1 style={{
              fontSize: 'clamp(40px,7.6vw,96px)', lineHeight: 1, fontWeight: 500,
              letterSpacing: '.02em', margin: 0, color: '#fff',
              textShadow: '0 2px 40px rgba(10,14,20,.45)',
              fontVariantNumeric: 'tabular-nums', minHeight: '1em',
            }}>
              {title}
            </h1>
            <p className="cf-stage" style={{
              fontSize: 15, fontWeight: 300, lineHeight: 1.65, margin: '26px auto 0',
              maxWidth: 430, color: 'rgba(255,255,255,.80)',
              textShadow: '0 1px 18px rgba(10,14,20,.5)',
            }}>
              Шашыраңқы жүрген жүздеген СТ — бір кеңістіктің ішінде.
              Тірі сессиялар, жазбалар мен отслежкалар өзі жиналып отырады.
            </p>
            <button
              type="button" className="cf-cta cf-stage"
              onClick={() => setOpen(true)}
              style={{
                marginTop: 44, padding: '15px 40px', borderRadius: 2,
                border: '1px solid rgba(255,255,255,.55)', background: 'rgba(255,255,255,.12)',
                color: '#fff', cursor: 'pointer', backdropFilter: 'blur(8px)',
                fontSize: 11.5, fontWeight: 600, letterSpacing: '.18em',
                textTransform: 'uppercase', fontFamily: 'inherit',
              }}
            >
              Кеңістікке кіру
            </button>
          </div>
        ) : (
          // Аяздың ішіндегі мөлдір алаң: форманың оқылуы шейдер дәл сол
          // сәтте нені көрсетіп тұрғанына тәуелді болмауы керек.
          <div className="cf-stage" style={{
            pointerEvents: 'auto', width: '100%', maxWidth: 396,
            padding: 'clamp(26px,3.4vw,38px)',
            background: 'rgba(240,245,250,.44)',
            border: '1px solid rgba(255,255,255,.62)',
            backdropFilter: 'blur(22px) saturate(1.15)',
            WebkitBackdropFilter: 'blur(22px) saturate(1.15)',
            boxShadow: '0 30px 80px rgba(12,18,28,.22)',
          }}>
            <h2 style={{
              fontSize: 12, fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase',
              color: 'rgba(18,24,31,.55)', margin: '0 0 30px', textAlign: 'center',
            }}>
              Аккаунтқа кіру
            </h2>

            {error && (
              <div role="alert" style={{
                display: 'flex', alignItems: 'center', gap: 9, marginBottom: 20,
                padding: '10px 13px', borderRadius: 2,
                background: 'rgba(190,40,45,.10)', border: '1px solid rgba(190,40,45,.32)',
                color: '#8e1f24', fontSize: 13.5,
              }}>
                <IconAlert style={{ width: 15, height: 15, flexShrink: 0 }} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label htmlFor="cf-phone" style={label}>Телефон немесе логин</label>
                <input
                  id="cf-phone" ref={phoneRef} className="cf-in" type="text"
                  autoComplete="username" placeholder="+7 700 000 00 00"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  style={input}
                />
              </div>

              <div>
                <label htmlFor="cf-pass" style={label}>Құпия сөз</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="cf-pass" className="cf-in" type={showPass ? 'text' : 'password'}
                    autoComplete="current-password" placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{ ...input, paddingRight: 80 }}
                  />
                  <button
                    type="button" className="cf-ghost"
                    onClick={() => setShowPass(v => !v)}
                    style={{
                      position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 0, cursor: 'pointer', padding: '4px 0',
                      fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em',
                      textTransform: 'uppercase', color: 'rgba(18,24,31,.48)', fontFamily: 'inherit',
                    }}
                  >
                    {showPass ? 'Жасыру' : 'Көрсету'}
                  </button>
                </div>
              </div>

              <button
                type="submit" className="cf-cta" disabled={loading}
                style={{
                  marginTop: 10, padding: '15px 40px', borderRadius: 2,
                  border: '1px solid rgba(18,24,31,.5)',
                  background: loading ? 'rgba(18,24,31,.12)' : 'rgba(255,255,255,.16)',
                  color: '#12181f', cursor: loading ? 'default' : 'pointer',
                  fontSize: 11.5, fontWeight: 600, letterSpacing: '.18em',
                  textTransform: 'uppercase', fontFamily: 'inherit', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%', display: 'inline-block',
                      border: '2px solid rgba(18,24,31,.25)', borderTopColor: '#12181f',
                      animation: 'cf-spin .7s linear infinite',
                    }} />
                    Кіруде
                  </>
                ) : 'Кіру'}
              </button>
            </form>

            <button
              type="button" className="cf-ghost"
              onClick={() => { setOpen(false); setError(''); }}
              style={{
                display: 'block', margin: '24px auto 0', background: 'none', border: 0,
                cursor: 'pointer', fontSize: 10.5, fontWeight: 600, letterSpacing: '.14em',
                textTransform: 'uppercase', color: 'rgba(18,24,31,.45)', fontFamily: 'inherit',
              }}
            >
              ← Артқа
            </button>
          </div>
        )}
      </div>

      <p style={{
        position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', zIndex: 2,
        fontSize: 10.5, fontWeight: 500, letterSpacing: '.1em', margin: 0, pointerEvents: 'none',
        color: open ? 'rgba(18,24,31,.38)' : 'rgba(255,255,255,.45)', transition: 'color .6s',
      }}>
        Аккаунт жоқ па? Координаторға хабарласыңыз · © 2026 JUZ40 Online Edu
      </p>
    </div>
  );
}
