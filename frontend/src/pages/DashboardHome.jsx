import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { smartScheduleByMonth, juniorScheduleByMonth, SUBJECT_COLORS } from './scheduleData';

import imgAngl  from '../assets/subjects/Английский_Язык.webp';
import imgBio   from '../assets/subjects/Биология.webp';
import imgWHist from '../assets/subjects/Всемирная_История.webp';
import imgGeo   from '../assets/subjects/География.webp';
import imgGeom  from '../assets/subjects/Геометрия.webp';
import imgInfo  from '../assets/subjects/Информатика.webp';
import imgHist  from '../assets/subjects/История_Казахстана.webp';
import imgLit   from '../assets/subjects/Казахская_Литература.webp';
import imgKaz   from '../assets/subjects/Казахский_Язык.webp';
import imgLogic from '../assets/subjects/Логика.webp';
import imgMath  from '../assets/subjects/Математика.webp';
import imgRus   from '../assets/subjects/Русский_Язык.webp';
import imgChem  from '../assets/subjects/Химия.webp';

const SUBJECTS = [
  { code: 'МАТ',   nameKk: 'Математика',          img: imgMath  },
  { code: 'ТІЛ',   nameKk: 'Қазақ тілі',           img: imgKaz   },
  { code: 'БИО',   nameKk: 'Биология',              img: imgBio   },
  { code: 'ИНФО',  nameKk: 'Информатика',           img: imgInfo  },
  { code: 'ГЕО',   nameKk: 'География',             img: imgGeo   },
  { code: 'ТАРИХ', nameKk: 'Қазақстан тарихы',      img: imgHist  },
  { code: 'РУС',   nameKk: 'Орыс тілі',             img: imgRus   },
  { code: 'ГЕОМ',  nameKk: 'Геометрия',             img: imgGeom  },
  { code: 'ХИМ',   nameKk: 'Химия',                 img: imgChem  },
  { code: 'МС',    nameKk: 'Логика / МС',            img: imgLogic },
  { code: 'ӘДЕБ',  nameKk: 'Қазақ әдебиеті',        img: imgLit   },
  { code: 'АНГЛ',  nameKk: 'Ағылшын тілі',           img: imgAngl  },
  { code: 'ДЖТ',   nameKk: 'Дүниежүзі тарихы',      img: imgWHist },
];

function buildSubjectMap() {
  const map = {};
  const process = (days, dir) => {
    (Array.isArray(days) ? days : []).forEach(({ lessons }) => {
      (lessons || []).forEach(({ subject, stream, teachers }) => {
        if (!map[subject]) map[subject] = {};
        (teachers || []).forEach(({ name, times }) => {
          if (!map[subject][name]) map[subject][name] = { streams: new Set(), times: new Set(), dirs: new Set() };
          if (stream) map[subject][name].streams.add(stream);
          times.forEach(t => map[subject][name].times.add(t));
          map[subject][name].dirs.add(dir);
        });
      });
    });
  };
  Object.values(smartScheduleByMonth).forEach(days => process(Array.isArray(days) ? days : [], 'SMART'));
  Object.values(juniorScheduleByMonth).forEach(days => process(Array.isArray(days) ? days : [], 'JUNIOR'));
  const result = {};
  Object.entries(map).forEach(([subj, teachers]) => {
    result[subj] = Object.entries(teachers).map(([name, d]) => ({
      name,
      streams: [...d.streams],
      times: [...d.times].slice(0, 4),
      dirs: [...d.dirs],
    }));
  });
  return result;
}

const SUBJECT_DATA = buildSubjectMap();
const AUTO_MS = 5000;

export default function DashboardHome() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dir, setDir] = useState(1); // 1 = forward, -1 = backward (for slide direction)

  useEffect(() => {
    SUBJECTS.forEach(s => { const img = new Image(); img.src = s.img; });
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setDir(1);
      setIdx(i => (i + 1) % SUBJECTS.length);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [paused]);

  const go = (delta) => {
    setPaused(true);
    setDir(delta);
    setIdx(i => (i + delta + SUBJECTS.length) % SUBJECTS.length);
  };

  const subj = SUBJECTS[idx];
  const teachers = SUBJECT_DATA[subj.code] || [];
  const col = SUBJECT_COLORS[subj.code] || { primary: '#1B6E7E' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',system-ui,sans-serif", background: 'var(--bg)' }}>
      <Sidebar />

      <main
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(160deg, #c8e8ee 0%, #a8d8e2 40%, #90cdd9 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>

        {/* Soft bg circles */}
        <div style={{ position:'absolute', width:420, height:420, borderRadius:'50%', background:'rgba(255,255,255,0.20)', top:-100, right:-100 }} />
        <div style={{ position:'absolute', width:280, height:280, borderRadius:'50%', background:'rgba(255,255,255,0.15)', bottom:-60, left:-60 }} />

        {/* Header */}
        <div style={{ position:'absolute', top:32, left:40, zIndex:3 }}>
          <h1 style={{ fontSize:24, fontWeight:900, color:'#0D4A57', margin:0, letterSpacing:'-0.6px' }}>Пәндер</h1>
          <p style={{ fontSize:12.5, color:'rgba(13,74,87,0.65)', margin:'5px 0 0' }}>
            Көрсеткілерді басып пәндер арасында ауысыңыз
          </p>
        </div>

        {/* Prev / Next arrow buttons — fixed at the edges */}
        <button onClick={() => go(-1)} aria-label="Алдыңғы пән" style={{
          position:'absolute', left:28, top:'50%', transform:'translateY(-50%)', zIndex:4,
          width:52, height:52, borderRadius:'50%', cursor:'pointer',
          border:'1px solid rgba(255,255,255,0.80)',
          background:'rgba(255,255,255,0.70)',
          backdropFilter:'blur(20px) saturate(180%)',
          WebkitBackdropFilter:'blur(20px) saturate(180%)',
          boxShadow:'0 6px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,1)',
          fontSize:22, color:'#0D4A57', display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-50%) scale(1.15)';e.currentTarget.style.boxShadow='0 10px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,1)';}}
          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(-50%) scale(1)';e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,1)';}}
        >‹</button>
        <button onClick={() => go(1)} aria-label="Келесі пән" style={{
          position:'absolute', right:28, top:'50%', transform:'translateY(-50%)', zIndex:4,
          width:52, height:52, borderRadius:'50%', cursor:'pointer',
          border:'1px solid rgba(255,255,255,0.80)',
          background:'rgba(255,255,255,0.70)',
          backdropFilter:'blur(20px) saturate(180%)',
          WebkitBackdropFilter:'blur(20px) saturate(180%)',
          boxShadow:'0 6px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,1)',
          fontSize:22, color:'#0D4A57', display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-50%) scale(1.15)';e.currentTarget.style.boxShadow='0 10px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,1)';}}
          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(-50%) scale(1)';e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,1)';}}
        >›</button>

        {/* Big icon */}
        <div style={{ position:'relative', width:'min(56vh, 42vw, 560px)', aspectRatio:'1/1', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.img
              key={idx}
              src={subj.img} alt={subj.nameKk}
              custom={dir}
              initial={{ opacity:0, x: dir>0?90:-90, scale:0.92 }}
              animate={{ opacity:1, x:0, scale:1 }}
              exit={{ opacity:0, x: dir>0?-90:90, scale:0.92 }}
              transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}
              style={{ width:'100%', height:'100%', objectFit:'contain', filter:'drop-shadow(0 18px 36px rgba(0,0,0,0.18))' }}
            />
          </AnimatePresence>
        </div>

        {/* Info card: subject name + teachers */}
        <div style={{
          position:'relative', zIndex:3, width:'min(640px, 90%)',
          background:'rgba(255,255,255,0.72)',
          backdropFilter:'blur(28px) saturate(180%)',
          WebkitBackdropFilter:'blur(28px) saturate(180%)',
          borderRadius:24, padding:'22px 28px', marginTop:8,
          border:'1px solid rgba(255,255,255,0.85)',
          boxShadow:'0 16px 48px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)',
        }}>
          <AnimatePresence mode="wait">
            <motion.div key={idx}
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
              transition={{ duration:0.3 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: teachers.length?14:0 }}>
                <div>
                  <div style={{ fontSize:19, fontWeight:800, color:'#0D4A57' }}>{subj.nameKk}</div>
                  <div style={{ fontSize:11.5, fontWeight:600, color: col.primary, marginTop:2 }}>
                    {teachers.length ? `${teachers.length} мұғалім` : 'Деректер жоқ'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {[...new Set(teachers.flatMap(t=>t.streams))].slice(0,3).map(s=>(
                    <span key={s} style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${col.primary}18`, color:col.primary }}>{s}</span>
                  ))}
                </div>
              </div>

              {teachers.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:170, overflowY:'auto' }}>
                  {teachers.map((t,ti)=>(
                    <div key={ti} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderTop: ti>0 ? '1px solid rgba(13,74,87,0.10)' : 'none' }}>
                      <div style={{
                        width:30, height:30, borderRadius:'50%', flexShrink:0,
                        background:`linear-gradient(135deg, ${col.primary}, ${col.primary}99)`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, fontWeight:800, color:'#fff',
                      }}>{t.name.charAt(0)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12.5, fontWeight:700, color:'#0D4A57' }}>{t.name}</div>
                        {t.times.length > 0 && (
                          <div style={{ fontSize:10.5, color:'rgba(13,74,87,0.65)', marginTop:2, lineHeight:1.5 }}>
                            {t.times.join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:18, position:'relative', zIndex:3 }}>
          {SUBJECTS.map((s,i)=>(
            <button key={i} type="button"
              onClick={()=>{ setPaused(true); setDir(i>idx?1:-1); setIdx(i); }}
              aria-label={s.nameKk}
              style={{
                width: i===idx ? 18 : 7, height:7, borderRadius:4,
                border:'none', cursor:'pointer', padding:0,
                background: i===idx ? '#0D4A57' : 'rgba(13,74,87,0.25)',
                transition:'all 0.25s',
              }}/>
          ))}
        </div>

      </main>
    </div>
  );
}
