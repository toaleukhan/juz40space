import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import juz40Logo from '../assets/juz40-logo.png';

const JUZ = { teal:'#1B6E7E', tealMid:'#155F6E', tealDeep:'#0D4A57' };
const C = {
  pageBg:'#F0F8FA', cardBg:'#FFFFFF', cardBorder:'rgba(27,110,126,0.15)',
  divider:'rgba(27,110,126,0.1)', text:'#0D4A57', textSub:'#2E7A8A', textMuted:'#6AAAB8', titleColor:'#071E24',
};

const STEPS = ['Жеке мәлімет', 'Кіру деректері', 'Аяқтау'];

export default function Register() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name:'', phone:'', password:'', password2:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const next = () => { setError(''); setStep(s => s+1); };
  const back = () => { setError(''); setStep(s => s-1); };

  const validate = () => {
    if (step===0 && !form.name.trim()) return 'Атыңызды енгізіңіз';
    if (step===1 && !form.phone.trim()) return 'Телефон нөмірін енгізіңіз';
    if (step===1 && !form.password) return 'Пароль енгізіңіз';
    if (step===1 && form.password !== form.password2) return 'Парольдер сәйкес келмейді';
    return '';
  };

  const handleNext = () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (step < 1) { next(); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/auth/register', { name:form.name, phone:form.phone, password:form.password });
      await login(form.phone, form.password);
      setStep(2);
      setTimeout(() => navigate('/curator'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Тіркелу қатесі');
    } finally { setLoading(false); }
  };

  const inp = (placeholder, key, type='text') => (
    <input type={type} placeholder={placeholder} value={form[key]} onChange={e=>upd(key,e.target.value)}
      style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:`1px solid ${C.cardBorder}`, background:C.pageBg, color:C.text, fontSize:14, outline:'none', boxSizing:'border-box' }} />
  );

  return (
    <div style={{ minHeight:'100vh', background:C.pageBg, display:'flex', flexDirection:'column', fontFamily:"'Inter',system-ui,sans-serif" }}>
      <header style={{ background:'rgba(240,248,250,0.96)', backdropFilter:'blur(20px)', borderBottom:`1px solid ${C.divider}`, padding:'0 24px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Link to="/"><img src={juz40Logo} height={24} alt="JUZ40" /></Link>
        <Link to="/schedule" style={{ fontSize:12, color:C.textSub, textDecoration:'none' }}>Сабақ кестесі →</Link>
      </header>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div style={{ width:'100%', maxWidth:420 }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <img src={juz40Logo} height={36} alt="JUZ40" style={{ margin:'0 auto 12px', display:'block' }} />
            <div style={{ fontSize:20, fontWeight:700, color:C.titleColor }}>Куратор тіркелу</div>
            <div style={{ fontSize:13, color:C.textMuted, marginTop:4 }}>JUZ40 Online Edu платформасы</div>
          </div>

          {/* Қадам индикаторы */}
          <div style={{ display:'flex', gap:6, marginBottom:24, alignItems:'center', justifyContent:'center' }}>
            {STEPS.map((s,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600,
                  background: i<=step ? JUZ.teal : 'transparent', border:`2px solid ${i<=step ? JUZ.teal : C.cardBorder}`, color: i<=step ? '#fff' : C.textMuted }}>
                  {i<step ? '✓' : i+1}
                </div>
                <span style={{ fontSize:11, color: i===step ? JUZ.teal : C.textMuted, fontWeight: i===step?600:400 }}>{s}</span>
                {i<STEPS.length-1 && <div style={{ width:24, height:1, background:C.divider, marginLeft:2 }} />}
              </div>
            ))}
          </div>

          <div style={{ background:C.cardBg, border:`1px solid ${C.cardBorder}`, borderRadius:16, padding:'28px 24px', boxShadow:'0 4px 24px rgba(27,110,126,0.08)' }}>
            {step===2 ? (
              <div style={{ textAlign:'center', padding:'16px 0' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:600, color:C.titleColor }}>Тіркелу сәтті!</div>
                <div style={{ fontSize:13, color:C.textMuted, marginTop:6 }}>Куратор кабинетіне өтуде...</div>
              </div>
            ) : (
              <>
                {error && <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#dc2626', fontSize:13, marginBottom:16 }}>{error}</div>}

                <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
                  {step===0 && (
                    <>
                      <div><label style={{ fontSize:12, fontWeight:500, color:C.textSub, display:'block', marginBottom:6 }}>Аты-жөні</label>{inp('Алия Серікова','name')}</div>
                    </>
                  )}
                  {step===1 && (
                    <>
                      <div><label style={{ fontSize:12, fontWeight:500, color:C.textSub, display:'block', marginBottom:6 }}>Телефон</label>{inp('+7 700 000 0000','phone','tel')}</div>
                      <div><label style={{ fontSize:12, fontWeight:500, color:C.textSub, display:'block', marginBottom:6 }}>Пароль</label>{inp('••••••••','password','password')}</div>
                      <div><label style={{ fontSize:12, fontWeight:500, color:C.textSub, display:'block', marginBottom:6 }}>Паролді растау</label>{inp('••••••••','password2','password')}</div>
                    </>
                  )}
                </div>

                <div style={{ display:'flex', gap:8 }}>
                  {step>0 && <button onClick={back} style={{ flex:1, padding:10, borderRadius:8, background:'transparent', border:`1px solid ${C.cardBorder}`, color:C.textSub, fontSize:13, cursor:'pointer' }}>← Артқа</button>}
                  <button onClick={handleNext} disabled={loading}
                    style={{ flex:2, padding:10, borderRadius:8, background:loading?'#6AAAB8':JUZ.teal, border:'none', color:'#fff', fontSize:14, fontWeight:600, cursor:loading?'default':'pointer' }}>
                    {loading ? 'Тіркелуде...' : step===1 ? 'Тіркелу' : 'Жалғастыру →'}
                  </button>
                </div>

                <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${C.divider}`, textAlign:'center' }}>
                  <span style={{ fontSize:12, color:C.textMuted }}>Аккаунтыңыз бар ма? </span>
                  <Link to="/login" style={{ fontSize:12, color:JUZ.teal, fontWeight:500, textDecoration:'none' }}>Кіру</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ background:'#fff', borderTop:'1px solid rgba(27,110,126,0.1)', padding:'28px 40px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:28 }}>
        <div>
          <img src={juz40Logo} height={28} alt="JUZ40" style={{ marginBottom:8, display:'block' }} />
          <div style={{ fontSize:12, fontWeight:600, color:'#2E7A8A', marginBottom:4 }}>JUZ40 ONLINE</div>
          <div style={{ fontSize:11, color:'#6AAAB8' }}>© Барлық құқықтар сақталған</div>
          <div style={{ fontSize:11, color:'#6AAAB8', marginTop:2 }}>Әзірлеуші: Толеухан Жеңіс</div>
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#071E24', marginBottom:10 }}>Адрес</div>
          <div style={{ fontSize:12, color:'#2E7A8A', lineHeight:1.7 }}>микрорайон Мирас, 65/1<br/>Алматы, 050000<br/>Қазақстан</div>
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#071E24', marginBottom:10 }}>Байланыс</div>
          <a href="tel:+77471401404" style={{ fontSize:13, color:'#1B6E7E', textDecoration:'none', fontWeight:500 }}>+7 (747) 140 14 04</a><br/>
          <a href="https://juz40-edu.kz" target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#1B6E7E', textDecoration:'none', marginTop:4, display:'inline-block' }}>juz40-edu.kz</a>
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#071E24', marginBottom:10 }}>Әлеуметтік желілер</div>
          <div style={{ display:'flex', gap:8 }}>
            {[
              { url:'https://www.instagram.com/juz40_online', bg:'#E1306C', label:'IG' },
              { url:'https://www.tiktok.com/@juz40.online',   bg:'#000000', label:'TT' },
              { url:'https://www.youtube.com/@juz40online',   bg:'#FF0000', label:'YT' },
            ].map(s => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer"
                style={{ width:36, height:36, borderRadius:8, background:s.bg+'18', border:`1px solid ${s.bg}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:s.bg, textDecoration:'none' }}>
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
