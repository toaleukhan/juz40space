import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import juz40Logo from '../assets/juz40-logo.png';
import { smartScheduleByMonth, juniorScheduleByMonth } from './scheduleData';

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
  { code:'МАТ',   name:'Математика',          img: math   },
  { code:'ТІЛ',   name:'Қазақ тілі',           img: kaz    },
  { code:'БИО',   name:'Биология',              img: bio    },
  { code:'ИНФО',  name:'Информатика',           img: inf    },
  { code:'ГЕО',   name:'География',             img: geo    },
  { code:'ТАРИХ', name:'Қазақстан тарихы',      img: hist   },
  { code:'РУС',   name:'Орыс тілі',             img: rus    },
  { code:'ГЕОМ',  name:'Геометрия',             img: geom   },
  { code:'ХИМ',   name:'Химия',                 img: chem   },
  { code:'МС',    name:'Логика / МС',           img: logic  },
  { code:'ӘДЕБ',  name:'Қазақ әдебиеті',        img: kazLit },
  { code:'АНГЛ',  name:'Ағылшын тілі',          img: eng    },
  { code:'ДЖТ',   name:'Дүниежүзі тарихы',      img: wHist  },
];

// Teacher lookup per subject code, built once from schedule data
function buildSubjectTeachers() {
  const map = {};
  const process = (days) => {
    (days || []).forEach(({ lessons }) => {
      (lessons || []).forEach(({ subject, teachers }) => {
        if (!map[subject]) map[subject] = new Set();
        (teachers || []).forEach(t => map[subject].add(t.name));
      });
    });
  };
  Object.values(smartScheduleByMonth).forEach(process);
  Object.values(juniorScheduleByMonth).forEach(process);
  const result = {};
  Object.entries(map).forEach(([k, set]) => { result[k] = [...set]; });
  return result;
}
const SUBJECT_TEACHERS = buildSubjectTeachers();

const SLIDE_MS = 3200;

function IllustrationPanel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    SUBJECTS.forEach(s => { const img = new Image(); img.src = s.img; });
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx(i => (i + 1) % SUBJECTS.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [paused]);

  const subj = SUBJECTS[idx];
  const teachers = SUBJECT_TEACHERS[subj.code] || [];

  const handleMouseMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: px * 14, y: py * -10 });
  };

  const sparkles = useMemo(() => (
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: Math.round(Math.random() * 96) + 2,
      top: Math.round(Math.random() * 92) + 2,
      size: 3 + Math.round(Math.random() * 5),
      dur: 3 + Math.random() * 4,
      delay: Math.random() * 4,
    }))
  ), []);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false); setTilt({ x:0, y:0 }); }}
      onMouseMove={handleMouseMove}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #c8e8ee 0%, #a8d8e2 40%, #90cdd9 100%)',
        borderRadius: 24, position: 'relative', overflow: 'hidden', minHeight: 480,
      }}>
      <style>{`
        @keyframes blobDrift1 { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(-24px,18px) scale(1.08); } }
        @keyframes blobDrift2 { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(20px,-16px) scale(1.05); } }
        @keyframes mascotFloat { 0%,100% { transform:translateY(0) rotate(-1.2deg); } 50% { transform:translateY(-14px) rotate(1.2deg); } }
        @keyframes glowPulse { 0%,100% { opacity:0.35; transform:scale(1); } 50% { opacity:0.6; transform:scale(1.12); } }
        @keyframes sparkleTwinkle { 0%,100% { opacity:0; transform:scale(0.4) rotate(0deg); } 50% { opacity:0.9; transform:scale(1) rotate(90deg); } }
      `}</style>

      {/* Soft bg circles, drifting slowly */}
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,0.25)', top:-60, right:-60, animation:'blobDrift1 9s ease-in-out infinite' }} />
      <div style={{ position:'absolute', width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.18)', bottom:-40, left:-40, animation:'blobDrift2 11s ease-in-out infinite' }} />

      {/* Sparkle particles */}
      {sparkles.map(s => (
        <div key={s.id} style={{
          position:'absolute', left:`${s.left}%`, top:`${s.top}%`,
          width:s.size, height:s.size, borderRadius:'50%',
          background:'#ffffff',
          animation:`sparkleTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          pointerEvents:'none', zIndex:2,
        }} />
      ))}

      {/* Small fixed logo badge, top-left */}
      <div style={{
        position:'absolute', top:24, left:24, zIndex:3,
        width:44, height:44, borderRadius:12,
        background:'rgba(255,255,255,0.92)',
        boxShadow:'0 4px 14px rgba(0,0,0,0.10)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <img src={juz40Logo} alt="JUZ40" style={{ width:30, height:'auto', display:'block' }} />
      </div>

      {/* Big slideshow icon — fills most of the panel */}
      <div style={{
        position:'relative', width:'100%', maxWidth:'min(70vh, 60vw, 760px)', aspectRatio:'1/1',
        display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
        transform:`translate(${tilt.x}px, ${tilt.y}px)`, transition:'transform 0.25s ease-out',
      }}>
        {/* Glow behind mascot */}
        <div style={{
          position:'absolute', width:'58%', height:'58%', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 70%)',
          animation:'glowPulse 4s ease-in-out infinite', zIndex:0,
        }} />
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity:0, x:90, scale:0.92 }}
            animate={{ opacity:1, x:0, scale:1 }}
            exit={{ opacity:0, x:-90, scale:0.92 }}
            transition={{ duration:0.5, ease:[0.16,1,0.3,1] }}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:18,
              width:'100%', height:'100%', position:'relative', zIndex:1,
            }}>
            <img
              src={subj.img} alt={subj.name}
              style={{
                width:'100%', height:'100%', objectFit:'contain',
                filter:'drop-shadow(0 18px 36px rgba(0,0,0,0.18))',
                animation:'mascotFloat 4.2s ease-in-out infinite',
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Subject name + teacher info, also slides with the icon */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        padding:'16px 26px 22px',
        background:'rgba(255,255,255,0.85)', backdropFilter:'blur(6px)',
        borderTop:'1px solid rgba(255,255,255,0.5)',
        textAlign:'center',
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity:0, y:8 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-8 }}
            transition={{ duration:0.35 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#0D4A57', marginBottom:4 }}>
              {subj.name}
            </div>
            <div style={{ fontSize:11.5, color:'rgba(13,74,87,0.75)', lineHeight:1.5 }}>
              {teachers.length
                ? `${teachers.length} мұғалім: ${teachers.slice(0,3).join(', ')}${teachers.length>3?` және т.б.`:''}`
                : 'Бұл пән бойынша деректер жоқ'}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:12 }}>
          {SUBJECTS.map((s,i)=>(
            <button key={i} type="button" onClick={()=>setIdx(i)}
              aria-label={s.name}
              style={{
                width: i===idx ? 16 : 6, height:6, borderRadius:3,
                border:'none', cursor:'pointer', padding:0,
                background: i===idx ? '#1B6E7E' : 'rgba(13,74,87,0.25)',
                transition:'all 0.25s',
              }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]   = useState({ phone:'', password:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState('');

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

  const inp = (field) => ({
    width:'100%', padding:'12px 14px', borderRadius:12, boxSizing:'border-box',
    border:`1.5px solid ${focused===field ? 'var(--accent)' : 'var(--border)'}`,
    background: focused===field ? 'var(--surface)' : 'var(--surface2)',
    color:'var(--text)', fontSize:14, outline:'none', transition:'all 0.2s', fontFamily:'inherit',
    boxShadow: focused===field ? '0 0 0 3px rgba(27,110,126,0.15)' : 'none',
  });

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg)',
      fontFamily:"'Inter',system-ui,sans-serif", padding:0,
    }}>
      <style>{`
        @keyframes logoBob {
          0%,100% { transform:translate(-50%,-50%) translateY(0px); }
          50%      { transform:translate(-50%,-50%) translateY(-10px); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes spin14 { to { transform:rotate(360deg); } }
        .login-btn:hover:not(:disabled) {
          background:#0f5a6a !important;
          transform:translateY(-1px);
          box-shadow:0 8px 20px rgba(27,110,126,0.4) !important;
        }
        .login-btn:active:not(:disabled) { transform:translateY(0); }
        .show-btn:hover { color:#1B6E7E !important; }
        @media (max-width: 860px) {
          .login-row { flex-direction: column !important; height: auto !important; }
          .login-form-col { flex: 1 1 auto !important; min-height: auto !important; border-right: none !important; padding: 36px 24px !important; }
          .login-illustration-col { display: none; }
        }
      `}</style>

      <div className="login-row" style={{
        display:'flex', width:'100%', height:'100vh',
        animation:'slideUp 0.45s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {/* ── Left: Form ── */}
        <div className="login-form-col" style={{
          flex:'0 0 460px', background:'var(--surface)', padding:'52px 48px', display:'flex',
          flexDirection:'column', justifyContent:'center', minHeight:'100vh',
          borderRight:'1px solid var(--border)',
        }}>
          {/* Logo */}
          <div style={{ marginBottom:32, display:'flex', justifyContent:'center' }}>
            <img src={juz40Logo} alt="JUZ40" style={{ height:36, display:'block' }} />
          </div>

          <div style={{ textAlign:'center', marginBottom:32 }}>
            <h1 style={{ fontSize:26, fontWeight:800, color:'var(--text)', marginBottom:6, letterSpacing:'-0.5px' }}>
              Қош келдіңіз!
            </h1>
            <p style={{ fontSize:13, color:'var(--text-sub)', margin:0 }}>
              Жүйеге кіріп, жұмысты жалғастырыңыз
            </p>
          </div>

          {error && (
            <div style={{
              padding:'10px 14px', borderRadius:10, marginBottom:18,
              background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)',
              color:'#dc2626', fontSize:13, display:'flex', alignItems:'center', gap:8,
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-sub)', display:'block', marginBottom:6 }}>
                Телефон немесе логин
              </label>
              <input
                type="text" placeholder="Телефон немесе логин"
                value={form.phone}
                onChange={e => setForm(f=>({...f, phone:e.target.value}))}
                onFocus={() => setFocused('phone')}
                onBlur={() => setFocused('')}
                style={inp('phone')}
              />
            </div>

            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-sub)', display:'block', marginBottom:6 }}>
                Пароль
              </label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f=>({...f, password:e.target.value}))}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused('')}
                  style={{ ...inp('pass'), paddingRight:52 }}
                />
                <button
                  type="button"
                  className="show-btn"
                  onClick={() => setShowPass(v=>!v)}
                  style={{
                    position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', cursor:'pointer',
                    fontSize:12, fontWeight:600, color:'var(--text-muted)', transition:'color 0.2s',
                  }}
                >
                  {showPass ? 'Жасыру' : 'Көрсету'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
              style={{
                padding:'13px', borderRadius:12, marginTop:6,
                background: loading ? '#9ab5a5' : '#1B6E7E',
                border:'none', color:'#fff', fontSize:14, fontWeight:700,
                cursor: loading ? 'default' : 'pointer',
                transition:'all 0.2s',
                boxShadow:'0 4px 14px rgba(27,110,126,0.3)',
              }}
            >
              {loading
                ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    <span style={{ display:'inline-block', width:14, height:14,
                      border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff',
                      borderRadius:'50%', animation:'spin14 0.7s linear infinite' }} />
                    Кіруде...
                  </span>
                : 'Кіру →'
              }
            </button>
          </form>

          <div style={{ marginTop:28, paddingTop:20, borderTop:'1px solid var(--border)', textAlign:'center' }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>
              Аккаунт жоқ па? Администраторға хабарласыңыз
            </span>
          </div>

          <div style={{ textAlign:'center', marginTop:16 }}>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>
              © 2026 JUZ40 Online Edu · Толеухан Жеңіс
            </span>
          </div>
        </div>

        {/* ── Right: Illustration ── */}
        <div className="login-illustration-col" style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          <IllustrationPanel />
        </div>
      </div>
    </div>
  );
}
