import {
  months, smartScheduleByMonth, smartAdditionalScheduleByMonth, juniorScheduleByMonth,
  buildTeachersIndex, SUBJECT_COLORS, SUBJECT_LOGOS, juniorStreamNames
} from './scheduleData';
import { loadOverrides, saveOverrides, mergeDays, addLessonOverride, getAllTeacherNames } from './scheduleOverrides';
import juz40Logo from '../assets/juz40-logo.png';
import { useState, useMemo, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';

const JUZ = {
  teal:      '#1B6E7E',
  tealMid:   '#155F6E',
  tealDeep:  '#0D4A57',
  tealLight: '#2A8A9E',
  tealPale:  '#E8F4F6',
};
const C = {
  pageBg:     'var(--bg)',
  cardBg:     'var(--surface)',
  text:       'var(--text)',
  textSub:    'var(--text-sub)',
  textMuted:  'var(--text-muted)',
  titleColor: 'var(--text)',
  divider:    'var(--border)',
};

const SUPERVISOR = { login: 'admin', password: 'admin123' };
const MIN_FREE_GAP = 11;

// Merge smartScheduleByMonth (LIVE) and smartAdditionalScheduleByMonth (ҚОСЫМША)
// for a given month, according to which kinds are selected. Each lesson gets
// tagged with `_kind` ('live' | 'additional') so cards/badges can render correctly.
function mergeSmartSchedule(monthId, kinds, overrides) {
  const ov = overrides || { live:{}, additional:{} };
  const showLive = kinds.includes('live');
  const showAdditional = kinds.includes('additional');
  const liveDays = showLive ? mergeDays(smartScheduleByMonth[monthId]||[], ov.live?.[monthId]||[]) : [];
  const addDays  = showAdditional ? mergeDays(smartAdditionalScheduleByMonth[monthId]||[], ov.additional?.[monthId]||[]) : [];

  const dayNames = [...new Set([...liveDays.map(d=>d.day), ...addDays.map(d=>d.day)])];
  const DAY_ORDER_=['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі','Жексенбі'];
  dayNames.sort((a,b)=>DAY_ORDER_.indexOf(a)-DAY_ORDER_.indexOf(b));

  return dayNames.map(day => {
    const lDay = liveDays.find(d=>d.day===day);
    const aDay = addDays.find(d=>d.day===day);
    const lessons = [
      ...((lDay?.lessons)||[]).map(l=>({...l, _kind:'live'})),
      ...((aDay?.lessons)||[]).map(l=>({...l, _kind:'additional'})),
    ];
    return { day, type: lDay?.type || 'live', lessons };
  });
}

// ─── Global CSS ───────────────────────────────────────────────────────────────
const G = `
  @keyframes liveBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }
  .live-dot {
    display:inline-block; width:6px; height:6px; border-radius:50%;
    background:#ef4444; animation: liveBlink 1.2s ease-in-out infinite;
  }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); font-family: 'Inter', system-ui, sans-serif; color: var(--text); }

  .g-panel {
    background: var(--surface);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 0 rgba(255,255,255,0.6), 0 2px 12px rgba(0,0,0,0.05);
  }
  .g-card {
    background: var(--surface);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    border: 1px solid var(--border);
    border-radius: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.85);
    transition: box-shadow 0.25s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s;
  }
  .g-card:hover {
    box-shadow: 0 8px 28px rgba(0,0,0,0.11), inset 0 1px 0 rgba(255,255,255,1);
    transform: translateY(-2px) scale(1.012);
    border-color: var(--border2);
  }

  .lesson-wrap { position: relative; cursor: default; }
  .lesson-wrap:hover .l-tip { opacity: 1; pointer-events: none; }

  .l-tip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%; transform: translateX(-50%);
    background: var(--surface);
    color: var(--text); border-radius: 12px; padding: 12px 16px;
    font-size: 11px; white-space: nowrap; min-width: 170px;
    opacity: 0; transition: opacity 0.15s;
    z-index: 50;
    box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06);
    border: 1px solid var(--border);
    pointer-events: none;
  }
  .l-tip::after {
    content: '';
    position: absolute;
    top: 100%; left: 50%; transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--surface);
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.06));
  }

  .cal-ev {
    position: absolute; overflow: hidden; box-sizing: border-box;
    transition: z-index 0s, box-shadow 0.2s, transform 0.2s;
  }
  .cal-ev:hover { z-index: 10; box-shadow: 0 6px 20px rgba(0,0,0,0.18) !important; transform: scaleX(1.06); }
  .cal-ev:hover .l-tip { opacity: 1; }

  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 14px; border-radius: 10px;
    font-size: 13px; font-weight: 500; cursor: pointer;
    border: none; background: transparent; width: 100%;
    color: #9ab5a5;
    transition: all 0.2s; text-align: left;
  }
  .nav-item:hover { background: #e8f5f8; color: #1a3a2a; }
  .nav-item.active {
    background: #1B6E7E;
    color: #fff; font-weight: 700;
    box-shadow: 0 4px 12px rgba(27,110,126,0.30);
  }

  .subj-badge {
    display: inline-block;
    transition: transform 0.3s;
    cursor: default;
  }
  .subj-badge:hover { transform: scale(1.1); }

  .filter-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 18px; border-radius: 24px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--surface);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    color: var(--text-muted);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
    transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
  }
  .filter-pill:hover {
    border-color: var(--border2);
    color: var(--text);
    transform: scale(1.05);
    box-shadow: 0 4px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1);
  }
  .filter-pill.has-filter {
    border-color: rgba(27,110,126,0.4);
    background: var(--accent-soft);
    color: var(--accent);
    box-shadow: 0 4px 14px rgba(27,110,126,0.12), inset 0 1px 0 rgba(255,255,255,0.8);
  }

  .f-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.32);
    backdrop-filter: blur(14px); z-index: 200;
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 80px;
    animation: fadeIn 0.15s ease;
  }
  .f-modal {
    background: var(--surface);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border2);
    border-radius: 24px; padding: 28px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.9);
    width: 400px; max-width: calc(100vw - 40px);
    animation: slideDown 0.22s cubic-bezier(0.16,1,0.3,1);
    color: var(--text);
  }

  .teacher-card {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    border-radius: 16px; cursor: pointer; text-align: left;
    background: var(--surface);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    border: 1px solid var(--border);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
    transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
    width: 100%;
  }
  .teacher-card:hover {
    border-color: var(--border2);
    box-shadow: 0 6px 20px rgba(27,110,126,0.10), inset 0 1px 0 rgba(255,255,255,1);
    transform: translateY(-2px) scale(1.015);
  }
  .tc-card {
    background: var(--surface);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    border: 1px solid var(--border);
    border-radius: 18px; overflow: hidden;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
    transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
    cursor: pointer;
  }
  .tc-card:hover {
    border-color: var(--border2);
    box-shadow: 0 8px 24px rgba(27,110,126,0.10), inset 0 1px 0 rgba(255,255,255,1);
    transform: translateY(-2px) scale(1.015);
  }

  .tl-block {
    position: absolute; display: flex; align-items: center;
    padding: 0 7px; overflow: hidden; cursor: default;
    transition: transform 0.2s, box-shadow 0.2s, z-index 0s;
    border-radius: 7px;
  }
  .tl-block:hover { transform: scaleY(1.12); z-index: 5; box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important; }
  .tl-block:hover .l-tip { opacity: 1; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(27,110,126,0.30); border-radius: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }

  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes slideDown { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }
  @keyframes spin { to { transform:rotate(360deg) } }
  @keyframes heroGradientShift {
    0%, 100% { background-position: 0% 50% }
    50%       { background-position: 100% 50% }
  }
  @keyframes floatOrb1 {
    0%,100% { transform: translateY(0px) translateX(0px) }
    50% { transform: translateY(-20px) translateX(12px) }
  }
  @keyframes floatOrb2 {
    0%,100% { transform: translateY(0px) }
    50% { transform: translateY(14px) }
  }
  @keyframes floatOrb3 {
    0%,100% { transform: translateY(0px) }
    50% { transform: translateY(-10px) }
  }
  @keyframes meshPulse {
    0%,100% { opacity: 0.2 }
    50% { opacity: 0.4 }
  }
`;

// ─── Utils ────────────────────────────────────────────────────────────────────
function timeToMinutes(t) {
  const clean = t.split(/[–\-]/)[0].trim().replace(/[^\d:]/g,'');
  const [h,m] = clean.split(':').map(Number);
  return h*60+(m||0);
}
function minutesToTime(m) {
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
function computeFreeSlots(allSlots, ws=13*60, we=19*60+30) {
  if (!allSlots.length) return [{ start:ws, end:we, free:true }];
  const sorted=[...allSlots].sort((a,b)=>a.start-b.start);
  const merged=[];
  for (const s of sorted) {
    if (merged.length && s.start-merged[merged.length-1].end<=MIN_FREE_GAP)
      merged[merged.length-1].end=Math.max(merged[merged.length-1].end,s.end);
    else merged.push({...s});
  }
  const result=[]; let cursor=ws;
  for (const s of merged) {
    if (s.start>cursor+MIN_FREE_GAP) result.push({start:cursor,end:s.start,free:true});
    const origs=sorted.filter(x=>x.start>=cursor&&x.end<=s.end&&x.start<s.end);
    if (origs.length>1) origs.forEach(x=>result.push({...x,free:false}));
    else result.push({...s,free:false});
    cursor=Math.max(cursor,s.end);
  }
  if (cursor<we) result.push({start:cursor,end:we,free:true});
  return result;
}
function entriesToSlots(entries) {
  const slots=[];
  entries.forEach(e=>e.times.forEach(t=>{
    const p=t.split(/[–\-]/);
    if (p.length<2) return;
    const s=p[0].trim().replace(/[^\d:]/g,''), en=p[1].trim().replace(/[^\d:]/g,'');
    const [sh,sm]=s.split(':').map(Number),[eh,em]=en.split(':').map(Number);
    if (isNaN(sh)||isNaN(eh)) return;
    slots.push({start:sh*60+(sm||0),end:eh*60+(em||0),direction:e.direction,subject:e.subject,stream:e.stream,timeStr:t});
  }));
  return slots;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Logo({ h=26 }) {
  return <img src={juz40Logo} height={h} alt="JUZ40" style={{display:'block'}} />;
}
function SubjectBadge({ subject, size='md' }) {
  const col = SUBJECT_COLORS[subject] || { primary:JUZ.teal, text:'#fff' };
  const logo = SUBJECT_LOGOS && SUBJECT_LOGOS[subject];
  const sm = size==='sm';
  const iconSize = sm ? 14 : 18;
  return (
    <span className="subj-badge" style={{
      display:'inline-flex', alignItems:'center', gap:sm?3:5,
      fontSize:sm?10:12, padding:sm?'2px 8px':'3px 12px', borderRadius:20,
      background:col.primary, color:col.text, fontWeight:700,
      letterSpacing:'0.3px', boxShadow:`0 2px 8px ${col.primary}45`,
    }}>
      {logo && (
        <span style={{ width:iconSize, height:iconSize, display:'inline-flex', flexShrink:0 }}
          dangerouslySetInnerHTML={{ __html: logo }}
        />
      )}
      {subject}
    </span>
  );
}
function DirBadge({ dir }) {
  const style = dir==='JUNIOR'
    ? { bg:'#ECFDF5', color:'#065f46', border:'#a7f3d0' }
    : { bg:'#EEF2FF', color:'#3730a3', border:'#c7d2fe' };
  return (
    <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:style.bg, color:style.color, fontWeight:700, border:`1px solid ${style.border}` }}>
      {dir}
    </span>
  );
}
// Per-lesson LIVE / ҚОСЫМША indicator (only meaningful for SMART direction)
function KindBadge({ kind }) {
  if (kind === 'additional') {
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9, padding:'2px 7px', borderRadius:20,
        background:'#FFF7ED', color:'#9a3412', fontWeight:700, border:'1px solid #fed7aa' }}>
        ➕ ҚОСЫМША
      </span>
    );
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9, padding:'2px 7px', borderRadius:20,
      background:'#FEF2F2', color:'#b91c1c', fontWeight:700, border:'1px solid #fecaca' }}>
      <span className="live-dot" />
      LIVE
    </span>
  );
}

// ─── Lesson Card ──────────────────────────────────────────────────────────────
function LessonCard({ lesson, direction }) {
  const [hovered, setHovered] = useState(false);
  const col = SUBJECT_COLORS[lesson.subject] || { primary:JUZ.teal, secondary:JUZ.tealMid, tertiary:JUZ.tealPale, text:'#fff' };

  return (
    <motion.div
      className="lesson-wrap"
      onHoverStart={()=>setHovered(true)}
      onHoverEnd={()=>setHovered(false)}
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 340, damping: 22 }}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${col.primary}28`,
        borderLeft: `4px solid ${col.primary}`,
        borderRadius: 12, padding: '11px 13px',
        boxShadow: hovered
          ? `0 8px 28px rgba(0,0,0,0.10), 0 0 0 1px ${col.primary}20`
          : `0 2px 8px rgba(0,0,0,0.05)`,
        transition: 'box-shadow 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

      <div className="l-tip">
        <div style={{fontWeight:700,fontSize:11,color:col.primary,marginBottom:5}}>
          {lesson.subject}{lesson.stream?` · ${lesson.stream}`:''}
        </div>
        {lesson.teachers.map((t,i)=>(
          <div key={i} style={{marginBottom:i<lesson.teachers.length-1?4:0}}>
            <div style={{color:'var(--text)',fontSize:10,fontWeight:600}}>{t.name}</div>
            <div style={{color:'var(--text-muted)',fontSize:9,marginTop:1}}>{t.times.join(' · ')}</div>
          </div>
        ))}
        <div style={{marginTop:5,paddingTop:4,borderTop:'1px solid var(--border)',fontSize:9,color:'var(--text-muted)'}}>
          {direction==='SMART'?(lesson._kind==='additional'?'ҚОСЫМША':'LIVE'):direction}{lesson.stream?` · ${lesson.stream}`:''}
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <SubjectBadge subject={lesson.subject} size="sm" />
        <div style={{display:'flex',gap:3}}>
          {lesson.stream&&<span style={{fontSize:9,padding:'2px 7px',borderRadius:20,background:`${col.primary}18`,color:col.primary,fontWeight:600}}>{lesson.stream}</span>}
          {direction==='SMART' ? <KindBadge kind={lesson._kind||'live'} /> : <DirBadge dir={direction} />}
        </div>
      </div>

      {lesson.teachers.map((t,k)=>(
        <div key={k} style={{borderTop:k>0?`1px solid #f0f2f5`:'none',paddingTop:k>0?7:0,marginTop:k>0?7:0}}>
          <div style={{fontSize:12,color:'var(--text)',fontWeight:600,marginBottom:3,letterSpacing:'-0.1px'}}>{t.name}</div>
          {t.times.map((tm,l)=>(
            <div key={l} style={{fontSize:10,color:col.primary,fontWeight:600,display:'flex',alignItems:'center',gap:4}}>
              <span style={{width:4,height:4,borderRadius:'50%',background:col.primary,display:'inline-block',flexShrink:0}}/>
              {tm}
            </div>
          ))}
        </div>
      ))}
    </motion.div>
  );
}

// ─── Day Blocks ───────────────────────────────────────────────────────────────
function MergedDayBlock({ day, smartBlock, juniorBlock, index=0 }) {
  const smartL  = smartBlock?.lessons  || [];
  const juniorL = juniorBlock?.lessons || [];
  const total   = smartL.length + juniorL.length;
  const smartType = '◆ SMART';

  return (
    <motion.div
      className="g-card"
      initial={{ opacity:0, y:28 }}
      animate={{ opacity:1, y:0 }}
      transition={{ duration:0.45, delay:index*0.1, ease:[0.16,1,0.3,1] }}
      style={{overflow:'hidden',marginBottom:14}}>
      <div style={{padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',
        background:'var(--surface2)',borderBottom:`1px solid ${C.divider}`}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.titleColor}}>{day}</div>
          <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{total} пән</div>
        </div>
        <div style={{display:'flex',gap:6}}>
          {smartL.length>0&&<span style={{fontSize:10,padding:'3px 12px',borderRadius:20,background:'#EEF2FF',color:'#3730a3',fontWeight:700,border:'1px solid #c7d2fe'}}>{smartType}</span>}
          {juniorL.length>0&&<span style={{fontSize:10,padding:'3px 12px',borderRadius:20,background:'#ECFDF5',color:'#065f46',fontWeight:700,border:'1px solid #a7f3d0'}}>● JUNIOR</span>}
        </div>
      </div>

      {smartL.length>0&&(
        <div style={{borderBottom:juniorL.length>0?`1px solid #f0f2f5`:'none'}}>
          {juniorL.length>0&&(
            <div style={{padding:'10px 18px 4px',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:10,fontWeight:700,color:'#4f46e5',letterSpacing:'0.8px'}}>SMART</span>
              <div style={{flex:1,height:1,background:'#eef0f8'}}/>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:10,padding:'8px 14px 14px'}}>
            {smartL.map((l,j)=><LessonCard key={j} lesson={l} direction="SMART"/>)}
          </div>
        </div>
      )}

      {juniorL.length>0&&(
        <div>
          {smartL.length>0&&(
            <div style={{padding:'10px 18px 4px',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:10,fontWeight:700,color:'#059669',letterSpacing:'0.8px'}}>JUNIOR</span>
              <div style={{flex:1,height:1,background:'#ecf9f4'}}/>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:10,padding:'8px 14px 14px'}}>
            {juniorL.map((l,j)=><LessonCard key={j} lesson={l} direction="JUNIOR"/>)}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function DayBlock({ dayBlock, direction, index=0 }) {
  const badge = direction==='JUNIOR'
    ? {bg:'#ECFDF5',border:'#a7f3d0',color:'#065f46',label:'● JUNIOR'}
    : {bg:'#EEF2FF',border:'#c7d2fe',color:'#3730a3',label:'◆ SMART'};
  return (
    <motion.div
      className="g-card"
      initial={{ opacity:0, y:28 }}
      animate={{ opacity:1, y:0 }}
      transition={{ duration:0.45, delay:index*0.1, ease:[0.16,1,0.3,1] }}
      style={{overflow:'hidden',marginBottom:14}}>
      <div style={{padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',
        background:'var(--surface2)',borderBottom:`1px solid ${C.divider}`}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.titleColor}}>{dayBlock.day}</div>
          <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{dayBlock.lessons.length} пән</div>
        </div>
        <span style={{fontSize:10,padding:'3px 12px',borderRadius:20,background:badge.bg,color:badge.color,fontWeight:700,border:`1px solid ${badge.border}`}}>{badge.label}</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:10,padding:'14px 14px 14px'}}>
        {dayBlock.lessons.map((l,j)=><LessonCard key={j} lesson={l} direction={direction}/>)}
      </div>
    </motion.div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────
const CAL_DAYS  = ['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі'];
const CAL_SHORT = ['ДҮЙ','СЕЙ','СӘР','БЕЙ','ЖҰМ','СЕН'];
const SCHED_SET = new Set(['Сәрсенбі','Бейсенбі','Жұма']);
const HOUR_H    = 92;
const W_START   = 11;
const W_END     = 20;
const DAY_MIN_W = 168; // minimum width per day column so events never get crushed

function parseTime(ts) {
  const pp = ts.split(/[–\-]/);
  if (pp.length < 2) return null;
  const clean = s => s.trim().replace(/[^\d:]/g,'');
  const toMin = s => { const [h,m] = s.split(':').map(Number); return isNaN(h) ? null : h*60+(m||0); };
  const start = toMin(clean(pp[0])), end = toMin(clean(pp[1]));
  if (start === null || end === null) return null;
  return { start, end };
}

// One card per individual time-block (each entry in a teacher's `times`
// array) instead of merging a teacher's whole day into one min→max span.
// This matters because consecutive blocks can belong to different
// subgroups (e.g. "13:00–14:30 (гум)" vs "16:20–17:50 (тех)").
function buildCalEvents(filters, overrides) {
  const out = [];
  const ov = overrides || { live:{}, additional:{}, junior:{} };

  const process = (sched, dir, kindTag) => {
    (sched[filters.month]||[]).forEach(db => {
      db.lessons.forEach(ls => {
        if (filters.dir !== 'Барлығы' && filters.dir !== dir) return;
        if (filters.subjects.length && !filters.subjects.includes(ls.subject)) return;
        const stream = ls.stream || db.stream || '';
        ls.teachers.forEach(tc => {
          tc.times.forEach(ts => {
            const p = parseTime(ts);
            if (!p) return;
            const note = ts.replace(/^[^(]*\(([^)]+)\).*$/, '$1');
            const hasNote = note !== ts;
            out.push({
              day: db.day, subject: ls.subject, stream, direction: dir, kind: kindTag,
              teachers: [tc.name], note: hasNote ? note : '',
              startMin: p.start, endMin: p.end,
            });
          });
        });
      });
    });
  };
  const kinds = filters.kinds || ['live','additional'];
  const liveMerged       = { [filters.month]: mergeDays(smartScheduleByMonth[filters.month]||[],           ov.live?.[filters.month]||[]) };
  const additionalMerged = { [filters.month]: mergeDays(smartAdditionalScheduleByMonth[filters.month]||[], ov.additional?.[filters.month]||[]) };
  const juniorMerged     = { [filters.month]: mergeDays(juniorScheduleByMonth[filters.month]||[],          ov.junior?.[filters.month]||[]) };
  if (filters.dir === 'SMART'  || filters.dir === 'Барлығы') {
    if (kinds.includes('live'))       process(liveMerged,       'SMART', 'live');
    if (kinds.includes('additional')) process(additionalMerged, 'SMART', 'additional');
  }
  if (filters.dir === 'JUNIOR' || filters.dir === 'Барлығы') process(juniorMerged, 'JUNIOR', 'live');

  // group by day
  const byDay = {}; CAL_DAYS.forEach(d => { byDay[d] = []; });
  out.forEach(ev => { byDay[ev.day]?.push(ev); });
  return byDay;
}

function CalEventCard({ ev }) {
  const col = SUBJECT_COLORS[ev.subject] || { primary: JUZ.teal, secondary: JUZ.tealLight, tertiary: JUZ.tealPale };
  const isAdditional = ev.kind === 'additional';
  const h = Math.max(34, ev.height - 4);
  const compact = h < 58;
  const tiny = h < 38;
  const startLabel = `${String(Math.floor(ev.startMin/60)).padStart(2,'0')}:${String(ev.startMin%60).padStart(2,'0')}`;
  const endLabel   = `${String(Math.floor(ev.endMin/60)).padStart(2,'0')}:${String(ev.endMin%60).padStart(2,'0')}`;
  const timeLabel  = `${startLabel} – ${endLabel}`;

  return (
    <div className="cal-ev lesson-wrap" style={{
      top: ev.top, height: h,
      left: `calc(${ev.cf*100}% + 3px)`,
      width: `calc(${ev.wf*100}% - 6px)`,
      background: col.tertiary,
      border: isAdditional ? `1.5px dashed ${col.primary}80` : 'none',
      borderRadius: 14,
      padding: tiny ? '4px 8px' : compact ? '7px 10px' : '10px 12px',
      boxShadow: `0 1px 2px rgba(0,0,0,0.04)`,
      overflow: 'hidden',
      cursor: 'default',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      {/* Tooltip */}
      <div className="l-tip" style={{ minWidth: 200 }}>
        <div style={{ fontWeight:800, fontSize:12, color:col.primary, marginBottom:6 }}>{ev.subject}{ev.stream ? ` · ${ev.stream}` : ''}</div>
        {ev.teachers.map((t,i) => (
          <div key={i} style={{ fontSize:10, color:'var(--text)', fontWeight:500, marginBottom:2, display:'flex', alignItems:'center', gap:5 }}>
            <span style={{width:5,height:5,borderRadius:'50%',background:col.primary,flexShrink:0,display:'inline-block'}}/>
            {t}
          </div>
        ))}
        <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:6, fontWeight:600 }}>{timeLabel}</div>
        <div style={{ marginTop:6 }}>
          {ev.direction==='SMART' ? <KindBadge kind={ev.kind} /> : <DirBadge dir={ev.direction} />}
        </div>
      </div>

      {/* Card content */}
      <div style={{ display:'flex', alignItems:'center', gap:5, overflow:'hidden' }}>
        {ev.direction==='SMART' && (isAdditional
          ? <span style={{fontSize:9,lineHeight:1,flexShrink:0}}>➕</span>
          : <span className="live-dot" style={{flexShrink:0}}/>)}
        <div style={{ fontSize: tiny ? 9.5 : compact ? 10.5 : 12, fontWeight:800, color:col.primary, lineHeight:1.25, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
          {ev.subject}{ev.note ? ` · ${ev.note}` : ''}
        </div>
      </div>
      {!tiny && ev.stream && (
        <div style={{ fontSize:9, fontWeight:600, color: col.primary, opacity:0.65, marginTop:-2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ev.stream}</div>
      )}

      {!compact && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:'auto' }}>
          <span style={{ fontSize:9.5, color:'#fff', background:col.primary, borderRadius:20, padding:'3px 9px', fontWeight:700 }}>{startLabel}</span>
          <span style={{ fontSize:9.5, color:col.primary, background:'rgba(255,255,255,0.7)', borderRadius:20, padding:'3px 9px', fontWeight:700 }}>{endLabel}</span>
        </div>
      )}

      {!compact && ev.teachers.length > 0 && (
        <div style={{ fontSize:8.5, fontWeight:600, color: col.primary, opacity:0.7, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {ev.teachers[0]}
        </div>
      )}
    </div>
  );
}

function CalendarView({ filters, overrides }) {
  const totalH = W_END - W_START;

  const byDay = useMemo(() => buildCalEvents(filters, overrides), [filters, overrides]);

  const layout = (evs) => {
    const sorted = [...evs].sort((a,b) => a.startMin - b.startMin || b.endMin - a.endMin);
    const cols = []; const res = [];
    sorted.forEach(ev => {
      let ci = 0;
      while (ci < cols.length && cols[ci].some(c => c.startMin < ev.endMin && c.endMin > ev.startMin)) ci++;
      if (!cols[ci]) cols[ci] = [];
      cols[ci].push(ev); res.push({...ev, _ci: ci});
    });
    const tot = cols.length || 1;
    return res.map(ev => ({
      ...ev,
      top:    ((ev.startMin - W_START*60) / 60) * HOUR_H,
      height: ((ev.endMin - ev.startMin)  / 60) * HOUR_H,
      cf: ev._ci / tot, wf: 1 / tot,
    }));
  };

  const hours = Array.from({length: totalH + 1}, (_, i) => W_START + i);

  // Pre-compute layouts and required column count per day so each event
  // gets a guaranteed minimum width — prevents thin "stick" cards when
  // many subjects overlap at the same time.
  const EVENT_COL_W = 132; // px per concurrent event column
  const dayLayouts = {};
  const dayWidths = {};
  CAL_DAYS.forEach(d => {
    const evs = layout(byDay[d]||[]);
    dayLayouts[d] = evs;
    const maxCols = evs.reduce((m,e) => Math.max(m, Math.round(1/e.wf)), 1);
    dayWidths[d] = Math.max(DAY_MIN_W, maxCols * EVENT_COL_W);
  });
  const totalDayWidth = CAL_DAYS.reduce((s,d) => s + dayWidths[d], 0);
  const gridTemplate = `64px ${CAL_DAYS.map(d => `${dayWidths[d]}px`).join(' ')}`;

  return (
    <motion.div
      initial={{ opacity:0, y:16 }}
      animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3, ease:[0.16,1,0.3,1] }}
      style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden', userSelect:'none', boxShadow:'var(--card-shadow)' }}>

      <div style={{ overflow:'auto', maxHeight:'85vh' }}>
        <div style={{ minWidth: 64 + totalDayWidth }}>

          {/* Day header row */}
          <div style={{ display:'grid', gridTemplateColumns:gridTemplate, borderBottom:'1px solid var(--border)', background:'var(--surface)', position:'sticky', top:0, zIndex:30 }}>
            <div style={{ position:'sticky', left:0, zIndex:31, background:'var(--surface)' }} />
            {CAL_DAYS.map((d, i) => {
              const active = SCHED_SET.has(d);
              const cnt = (byDay[d]||[]).length;
              return (
                <div key={d} style={{
                  padding:'18px 10px',
                  textAlign:'left',
                  borderLeft:'1px solid var(--border)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:700, color: active ? 'var(--text)' : 'var(--text-muted)', letterSpacing:'0.2px' }}>
                      {CAL_DAYS[i]}
                    </span>
                    {active && cnt > 0 && (
                      <span style={{
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        minWidth:20, height:20, padding:'0 6px', borderRadius:10,
                        background:'#1B6E7E', fontSize:10, color:'#fff', fontWeight:800,
                      }}>{cnt}</span>
                    )}
                  </div>
                  {!active && (
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3, fontWeight:500 }}>сабақ жоқ</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grid body */}
          <div style={{ display:'grid', gridTemplateColumns:gridTemplate }}>
            {/* Time axis */}
            <div style={{ position:'sticky', left:0, zIndex:20, background:'var(--surface)', height: totalH*HOUR_H + HOUR_H/2, borderRight:'1px solid var(--border)' }}>
              {hours.map(h => (
                <div key={h} style={{ position:'absolute', top:(h-W_START)*HOUR_H - 7, right:14, fontSize:10.5, color:'var(--text-muted)', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>
                  {String(h).padStart(2,'0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {CAL_DAYS.map(d => {
              const active = SCHED_SET.has(d);
              const evs = dayLayouts[d];
              return (
                <div key={d} style={{
                  position:'relative',
                  height: totalH*HOUR_H + HOUR_H/2,
                  borderLeft:'1px solid var(--border)',
                  background: active ? 'var(--surface)' : 'var(--surface2)',
                }}>
                  {hours.map(h => (
                    <div key={h} style={{
                      position:'absolute', top:(h-W_START)*HOUR_H, left:0, right:0, height:1,
                      background: 'var(--border)', opacity:0.6,
                    }}/>
                  ))}
                  {evs.map((ev,i) => <CalEventCard key={i} ev={ev}/>)}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </motion.div>
  );
}

// ─── Teacher Weekly Visual Timeline ──────────────────────────────────────────
const TL_START_MIN = 13 * 60;       // 780
const TL_END_MIN   = 19 * 60 + 30;  // 1170
const TL_RANGE     = TL_END_MIN - TL_START_MIN; // 390

function toMin(s) {
  const c = s.trim().replace(/[^\d:]/g,'');
  const [h,m] = c.split(':').map(Number);
  return h*60+(m||0);
}

function TeacherWeeklyTimeline({ entries }) {
  const dayOrder = ['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі'];

  const byDay = useMemo(()=>{
    const map = {};
    entries.forEach(entry=>{
      if (!map[entry.day]) map[entry.day] = [];
      entry.times.forEach(timeStr=>{
        const pp = timeStr.split(/[–\-]/);
        if (pp.length < 2) return;
        const startMin = toMin(pp[0]);
        const endMin   = toMin(pp[1]);
        if (isNaN(startMin)||isNaN(endMin)) return;
        map[entry.day].push({ subject:entry.subject, direction:entry.direction, stream:entry.stream, startMin, endMin, timeStr });
      });
    });
    return map;
  },[entries]);

  const activeDays = dayOrder.filter(d => byDay[d]);
  const hourLabels = [13,14,15,16,17,18,19];

  return (
    <div className="g-card" style={{padding:'22px 24px',marginBottom:16,background:'var(--surface)'}}>
      <div style={{fontSize:14,fontWeight:700,color:C.titleColor,marginBottom:18,display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:18}}>📅</span> Апталық кесте
      </div>

      {/* Time header */}
      <div style={{display:'flex',marginLeft:72,marginBottom:6,position:'relative',height:18}}>
        {hourLabels.map(h=>{
          const pct = ((h*60 - TL_START_MIN) / TL_RANGE) * 100;
          return (
            <div key={h} style={{
              position:'absolute', left:`${pct}%`, transform:'translateX(-50%)',
              fontSize:10, color:C.textMuted, fontWeight:600, fontVariantNumeric:'tabular-nums',
            }}>
              {h}:00
            </div>
          );
        })}
        <div style={{
          position:'absolute', left:'100%', transform:'translateX(-50%)',
          fontSize:10, color:C.textMuted, fontWeight:600,
        }}>19:30</div>
      </div>

      {/* Day rows */}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {activeDays.map(day=>{
          const segs = [...byDay[day]].sort((a,b)=>a.startMin-b.startMin);
          return (
            <div key={day} style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:60,fontSize:11,fontWeight:700,color:C.textSub,textAlign:'right',flexShrink:0,letterSpacing:'0.3px'}}>
                {day.slice(0,3)}
              </div>

              <div style={{flex:1,position:'relative',height:42,background:'var(--surface2)',border:'1px solid #eef0f3',borderRadius:10,overflow:'visible'}}>
                {/* Vertical hour guides */}
                {hourLabels.slice(1).map(h=>(
                  <div key={h} style={{
                    position:'absolute',
                    left:`${((h*60-TL_START_MIN)/TL_RANGE)*100}%`,
                    top:0,bottom:0,width:1,background:'rgba(0,0,0,0.08)',
                  }}/>
                ))}

                {/* Segments */}
                {segs.map((seg,i)=>{
                  const col = SUBJECT_COLORS[seg.subject]||{primary:JUZ.teal,tertiary:JUZ.tealPale,text:'#fff'};
                  const leftPct  = Math.max(0, (seg.startMin - TL_START_MIN) / TL_RANGE * 100);
                  const widthPct = Math.min(100 - leftPct, (seg.endMin - seg.startMin) / TL_RANGE * 100);
                  const narrow   = (seg.endMin - seg.startMin) < 45;

                  return (
                    <div key={i} className="tl-block lesson-wrap" style={{
                      left:`${leftPct}%`,
                      width:`${widthPct}%`,
                      top:4, bottom:4,
                      background:`linear-gradient(135deg,${col.primary}ee,${col.primary}99)`,
                      border:`1px solid ${col.primary}`,
                      boxShadow:`0 2px 12px ${col.primary}60, inset 0 1px 0 rgba(255,255,255,0.18)`,
                    }}>
                      {!narrow&&(
                        <span style={{fontSize:10.5,fontWeight:700,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',textShadow:'0 1px 2px rgba(0,0,0,0.18)'}}>
                          {seg.subject}
                        </span>
                      )}
                      <div className="l-tip" style={{minWidth:160}}>
                        <div style={{fontWeight:700,fontSize:11,color:col.tertiary,marginBottom:4}}>
                          {seg.subject}{seg.stream?` · ${seg.stream}`:''}
                        </div>
                        <div style={{color:'rgba(255,255,255,0.52)',fontSize:9,marginBottom:3}}>{seg.timeStr}</div>
                        <DirBadge dir={seg.direction}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {activeDays.length > 0 && (() => {
        const subjects = [...new Set(entries.map(e=>e.subject))];
        return (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16,paddingTop:14,borderTop:`1px solid ${C.divider}`}}>
            {subjects.map(s=><SubjectBadge key={s} subject={s} size="sm"/>)}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────
function FilterModal({ filters, onChange, onClose, subjectOptions, view }) {
  const selStyle = {
    width:'100%',padding:'9px 12px',borderRadius:9,
    border:'1.5px solid #eef0f3',
    background:'var(--surface2)',color:'#1a3a2a',
    fontSize:13,outline:'none',fontFamily:'inherit',
    appearance:'none',cursor:'pointer',
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ab5a5' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat:'no-repeat',backgroundPosition:'right 10px center',paddingRight:30,
  };
  const labelStyle={fontSize:11,fontWeight:600,color:'#9ab5a5',marginBottom:5,display:'block'};
  const TIME_OPTIONS=[];
  for(let h=13;h<=20;h++) TIME_OPTIONS.push(`${String(h).padStart(2,'0')}:00`);
  const overlayRef=useRef();
  const handleOverlay=(e)=>{ if(e.target===overlayRef.current) onClose(); };
  const hasFilter = filters.dir!=='Барлығы'||filters.subjects.length>0;
  const toggleSubject = (s) => onChange({
    ...filters,
    subjects: filters.subjects.includes(s)
      ? filters.subjects.filter(x=>x!==s)
      : [...filters.subjects, s],
  });

  return (
    <div className="f-overlay" ref={overlayRef} onClick={handleOverlay}>
      <div className="f-modal">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.titleColor}}>Фильтрлер</div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Кестені нақтыла</div>
          </div>
          <button onClick={onClose}
            style={{width:32,height:32,borderRadius:8,border:`1px solid rgba(255,255,255,0.12)`,
              background:'rgba(255,255,255,0.08)',cursor:'pointer',fontSize:16,color:'rgba(255,255,255,0.55)',
              display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>
            ×
          </button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={labelStyle}>Бағыт</label>
            <select value={filters.dir} onChange={e=>onChange({...filters,dir:e.target.value,subjects:[]})} style={selStyle}>
              {['Барлығы','SMART','JUNIOR'].map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Пән {filters.subjects.length>0 && `(${filters.subjects.length} таңдалды)`}</label>
            <div style={{
              display:'flex', flexWrap:'wrap', gap:6,
              maxHeight:160, overflowY:'auto',
              padding:'10px', borderRadius:10, background:'var(--surface2)',
            }}>
              {subjectOptions.filter(s=>s!=='Барлығы').map(s=>{
                const active = filters.subjects.includes(s);
                return (
                  <button key={s} type="button" onClick={()=>toggleSubject(s)}
                    style={{
                      padding:'5px 11px', borderRadius:8, fontSize:12, fontWeight:600,
                      cursor:'pointer', fontFamily:'inherit',
                      border: active ? `1px solid ${JUZ.teal}` : '1px solid var(--border)',
                      background: active ? JUZ.teal : 'var(--surface)',
                      color: active ? '#fff' : 'var(--text-sub)',
                      transition:'all 0.15s',
                    }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Ағым</label>
            <select value={filters.month} onChange={e=>onChange({...filters,month:e.target.value})} style={selStyle}>
              {months.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          {view==='schedule'&&(
            <div>
              <label style={labelStyle}>Уақыт аралығы</label>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <select value={filters.timeFrom} onChange={e=>onChange({...filters,timeFrom:e.target.value})} style={{...selStyle,flex:1}}>
                  {TIME_OPTIONS.slice(0,-1).map(h=><option key={h}>{h}</option>)}
                </select>
                <span style={{color:C.textMuted,fontSize:13}}>–</span>
                <select value={filters.timeTo} onChange={e=>onChange({...filters,timeTo:e.target.value})} style={{...selStyle,flex:1}}>
                  {TIME_OPTIONS.slice(1).map(h=><option key={h}>{h}</option>)}
                </select>
              </div>
            </div>
          )}
          {hasFilter&&(
            <button onClick={()=>onChange({...filters,dir:'Барлығы',subjects:[],timeFrom:'13:00',timeTo:'19:00'})}
              style={{padding:'8px',borderRadius:8,border:'1px solid rgba(239,68,68,0.20)',
                background:'rgba(239,68,68,0.04)',color:'#dc2626',fontSize:12,cursor:'pointer',fontWeight:500}}>
              Фильтрлерді тазалау ×
            </button>
          )}
          <button onClick={onClose}
            style={{padding:'10px',borderRadius:10,background:JUZ.teal,border:'none',
              color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',
              boxShadow:'0 4px 14px rgba(27,110,126,0.30)'}}>
            Қолдану
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Teachers View ────────────────────────────────────────────────────────────
function TeachersView({ teachersIndex, filters }) {
  const [activeTeacher, setActiveTeacher] = useState(null);
  const dayOrder = ['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі'];

  const groupedBySubject = useMemo(()=>{
    const res={};
    Object.entries(teachersIndex).forEach(([name,entries])=>{
      const filtered=entries.filter(e=>
        (filters.dir==='Барлығы'||e.direction===filters.dir)&&
        (!filters.subjects.length||filters.subjects.includes(e.subject))
      );
      if (!filtered.length) return;
      filtered.forEach(e=>{
        if(!res[e.subject]) res[e.subject]={};
        if(!res[e.subject][name]) res[e.subject][name]=[];
        res[e.subject][name].push(e);
      });
    });
    return res;
  },[teachersIndex,filters]);

  const handleExport = ()=>{
    const rows=[['Пән','Мұғалім','Бағыт','Ағым','Күн','Уақыт']];
    Object.entries(groupedBySubject).forEach(([subj,teachers])=>{
      Object.entries(teachers).forEach(([name,entries])=>{
        entries.forEach(e=>e.times.forEach(t=>rows.push([subj,name,e.direction,e.stream||'—',e.day,t])));
      });
    });
    const dirLabel=filters.dir==='Барлығы'?'БАРЛЫҒЫ':filters.dir;
    const subLabel=filters.subjects.length?filters.subjects.join('_'):'барлық';
    const mnLabel=months.find(m=>m.id===filters.month)?.name||'';
    const html=`<html><head><meta charset="UTF-8"><style>
      table{border-collapse:collapse;font-family:Arial;font-size:12px}
      th{background:#1B6E7E;color:#fff;padding:8px 12px;border:1px solid #0D4A57}
      td{padding:6px 12px;border:1px solid #ddd}
      tr:nth-child(even) td{background:#F0F8FA}
    </style></head><body><table>
      <thead><tr>${rows[0].map(c=>`<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.slice(1).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></body></html>`;
    const blob=new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url;
    a.download=`JUZ40_${mnLabel}_${dirLabel}_${subLabel}.xls`; a.click();
    URL.revokeObjectURL(url);
  };

  if (activeTeacher) {
    const entries = teachersIndex[activeTeacher];
    const subjs   = [...new Set(entries.map(e=>e.subject))];
    const dirs    = [...new Set(entries.map(e=>e.direction))];
    const col     = SUBJECT_COLORS[subjs[0]] || { primary:JUZ.teal };
    const initials = activeTeacher.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const sortedDays = [...new Set(entries.map(e=>e.day))].sort((a,b)=>dayOrder.indexOf(a)-dayOrder.indexOf(b));

    return (
      <>
        <button onClick={()=>setActiveTeacher(null)}
          style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:10,
            fontSize:12,cursor:'pointer',marginBottom:16,
            background:'var(--surface)',border:'1px solid #eef0f3',color:C.textMuted,
            transition:'all 0.2s'}}>
          ← Артқа
        </button>

        {/* Profile header */}
        <div className="g-card" style={{padding:'20px 24px',marginBottom:16,background:'rgba(255,255,255,0.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:18}}>
            <div style={{
              width:58,height:58,borderRadius:'50%',flexShrink:0,
              background:`linear-gradient(135deg,${col.primary},${col.primary}99)`,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:18,fontWeight:700,color:'#fff',
              boxShadow:`0 4px 16px ${col.primary}45`,
            }}>
              {initials}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:19,fontWeight:700,color:C.titleColor,marginBottom:6}}>{activeTeacher}</div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center',marginBottom:6}}>
                {subjs.map(s=><SubjectBadge key={s} subject={s}/>)}
                {dirs.map(d=><DirBadge key={d} dir={d}/>)}
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {sortedDays.map(d=>(
                  <span key={d} style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                    background:'rgba(27,110,126,0.12)',color:'#1a4a56',
                    border:'1px solid rgba(27,110,126,0.25)',fontWeight:600}}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:26,fontWeight:800,color:JUZ.teal}}>{entries.reduce((a,e)=>a+e.times.length,0)}</div>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:500}}>сессия</div>
            </div>
          </div>
        </div>

        {/* Visual weekly timeline */}
        <TeacherWeeklyTimeline entries={entries} />

        {/* Per-day session breakdown */}
        <div className="g-card" style={{padding:'20px 24px',background:'rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:13,fontWeight:700,color:C.titleColor,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16}}>🕐</span> Сессиялар
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {sortedDays.map(day=>{
              const dayEntries = entries.filter(e=>e.day===day);
              return (
                <div key={day}>
                  <div style={{fontSize:12,fontWeight:700,color:C.textSub,marginBottom:6,
                    display:'flex',alignItems:'center',gap:8}}>
                    <span>{day}</span>
                    <div style={{flex:1,height:1,background:C.divider}}/>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {dayEntries.map((entry,i)=>{
                      const col2=SUBJECT_COLORS[entry.subject]||{primary:JUZ.teal,tertiary:JUZ.tealPale};
                      return (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 12px',
                          borderRadius:9,background:`${col2.primary}18`,border:`1px solid ${col2.primary}40`,
                          borderLeft:`3px solid ${col2.primary}`}}>
                          <SubjectBadge subject={entry.subject} size="sm"/>
                          <div style={{display:'flex',gap:6,flex:1,flexWrap:'wrap'}}>
                            {entry.times.map((t,j)=>(
                              <span key={j} style={{fontSize:11,color:col2.primary,fontWeight:500,filter:'brightness(1.7)'}}>
                                {t}
                              </span>
                            ))}
                          </div>
                          <DirBadge dir={entry.direction}/>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // Teacher list grouped by subject
  return (
    <>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
        <button onClick={handleExport}
          style={{padding:'7px 18px',borderRadius:10,
            background:'linear-gradient(135deg,rgba(27,110,126,0.80),rgba(13,74,87,0.90))',
            border:'1px solid rgba(42,138,158,0.35)',backdropFilter:'blur(8px)',
            color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',
            boxShadow:'0 3px 14px rgba(13,74,87,0.45)',
            transition:'all 0.25s cubic-bezier(0.34,1.56,0.64,1)'}}>
          ↓ Excel экспорт
        </button>
      </div>

      {Object.keys(groupedBySubject).length===0
        ? <div style={{padding:'3rem',textAlign:'center',color:C.textMuted,
            background:'var(--surface)',borderRadius:16,border:`1px solid ${C.divider}`}}>
            Мұғалім табылмады
          </div>
        : Object.entries(groupedBySubject).sort((a,b)=>a[0].localeCompare(b[0])).map(([subj,teachers],si)=>{
          const col=SUBJECT_COLORS[subj]||{primary:JUZ.teal,tertiary:JUZ.tealPale};
          return (
            <motion.div
              key={subj}
              className="g-card"
              initial={{ opacity:0, y:24 }}
              animate={{ opacity:1, y:0 }}
              transition={{ duration:0.4, delay:si*0.08, ease:[0.16,1,0.3,1] }}
              style={{marginBottom:14,overflow:'hidden'}}>
              <div style={{padding:'11px 18px',display:'flex',alignItems:'center',gap:10,
                background:`${col.primary}22`,borderBottom:`1px solid ${col.primary}30`}}>
                <SubjectBadge subject={subj}/>
                <span style={{fontSize:12,color:col.primary,fontWeight:600}}>
                  {Object.keys(teachers).length} мұғалім
                </span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:10,padding:'12px'}}>
                {Object.entries(teachers).map(([name,entries],ti)=>{
                  const DO = ['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі'];
                  const dirs2    = [...new Set(entries.map(e=>e.direction))];
                  const days     = [...new Set(entries.map(e=>e.day))].sort((a,b)=>DO.indexOf(a)-DO.indexOf(b));
                  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

                  // Group by stream → collect unique times
                  const byStream = {};
                  entries.forEach(e=>{
                    const sk = e.stream || '—';
                    if (!byStream[sk]) byStream[sk] = { times:new Set(), direction:e.direction };
                    e.times.forEach(t=>byStream[sk].times.add(t));
                  });

                  return (
                    <div key={name} className="tc-card" onClick={()=>setActiveTeacher(name)}>

                      {/* ── Header: avatar + name + meta */}
                      <div style={{padding:'12px 14px',display:'flex',alignItems:'center',gap:12,
                        borderBottom:Object.keys(byStream).length?`1px solid rgba(255,255,255,0.08)`:'none'}}>
                        <div style={{width:42,height:42,borderRadius:'50%',flexShrink:0,
                          background:`linear-gradient(135deg,${col.primary},${col.primary}99)`,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:13,fontWeight:700,color:'#fff',
                          boxShadow:`0 3px 10px ${col.primary}40`}}>
                          {initials}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:C.titleColor,
                            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:4}}>
                            {name}
                          </div>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                            {days.map(d=>(
                              <span key={d} style={{fontSize:9,padding:'2px 6px',borderRadius:8,
                                background:'rgba(27,110,126,0.12)',color:'#1a4a56',
                                border:'1px solid rgba(27,110,126,0.20)',fontWeight:600}}>
                                {d.slice(0,3)}
                              </span>
                            ))}
                            {dirs2.map(d=><DirBadge key={d} dir={d}/>)}
                          </div>
                        </div>
                      </div>

                      {/* ── Stream sub-cards */}
                      {Object.keys(byStream).length > 0 && (
                        <div style={{padding:'8px 10px',display:'flex',gap:6,flexWrap:'wrap'}}>
                          {Object.entries(byStream).map(([streamKey, streamData])=>(
                            <div key={streamKey} style={{
                              flex:'1 1 auto', minWidth:85,
                              background:`${col.primary}18`,
                              border:`1.5px solid ${col.primary}40`,
                              borderRadius:9, padding:'7px 9px',
                            }}>
                              <div style={{display:'inline-block',fontSize:10,fontWeight:800,
                                padding:'1px 7px',borderRadius:6,marginBottom:5,
                                background:col.primary,color:'#fff',letterSpacing:'0.3px'}}>
                                {streamKey}
                              </div>
                              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                                {[...streamData.times].map((t,i)=>(
                                  <div key={i} style={{fontSize:10,color:col.primary,fontWeight:700,lineHeight:1.4}}>
                                    {t}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })
      }
    </>
  );
}

// ─── Supervisor ───────────────────────────────────────────────────────────────
function SupervisorLogin({ onLogin, onCancel }) {
  const [l,setL]=useState(''); const [p,setP]=useState(''); const [err,setErr]=useState('');
  const submit=()=>{ if(l===SUPERVISOR.login&&p===SUPERVISOR.password) onLogin(); else setErr('Логин немесе пароль қате'); };
  const inputStyle={width:'100%',padding:'10px 14px',borderRadius:9,
    border:'1.5px solid rgba(13,74,87,0.15)',fontSize:13,color:C.text,
    background:'rgba(255,255,255,0.9)',outline:'none',fontFamily:'inherit',boxSizing:'border-box'};
  return (
    <div style={{minHeight:'100vh',background:C.pageBg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <style>{G}</style>
      <div className="g-card" style={{padding:'40px 36px',width:340}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <Logo h={28}/>
          <div style={{fontSize:15,fontWeight:700,color:C.titleColor,marginTop:14}}>Басқарушы кабинеті</div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:4}}>Логин мен пароль керек</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.textSub,display:'block',marginBottom:5}}>Логин</label>
            <input value={l} onChange={e=>setL(e.target.value)} placeholder="admin" autoComplete="off" style={inputStyle}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.textSub,display:'block',marginBottom:5}}>Пароль</label>
            <input value={p} onChange={e=>setP(e.target.value)} type="password" placeholder="••••••••"
              onKeyDown={e=>e.key==='Enter'&&submit()} style={inputStyle}/>
          </div>
          {err&&<div style={{fontSize:12,color:'#dc2626',textAlign:'center',padding:'6px',background:'rgba(239,68,68,0.06)',borderRadius:7}}>{err}</div>}
          <button onClick={submit}
            style={{padding:'10px',borderRadius:9,background:JUZ.teal,border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 14px rgba(27,110,126,0.30)'}}>
            Кіру
          </button>
          <button onClick={onCancel}
            style={{padding:'8px',borderRadius:9,background:'transparent',border:`1px solid ${C.divider}`,color:C.textMuted,fontSize:12,cursor:'pointer'}}>
            ← Кестеге оралу
          </button>
        </div>
      </div>
    </div>
  );
}

function SupervisorDashboard({ onLogout, onBack }) {
  const [file,setFile]=useState(null); const [fileName,setFileName]=useState('');
  const [parsing,setParsing]=useState(false); const [parseResult,setParseResult]=useState(null);
  const [preview,setPreview]=useState(''); const [status,setStatus]=useState('');
  const [error,setError]=useState(''); const [targetDir,setTargetDir]=useState('SMART');
  const [targetMonth,setTargetMonth]=useState('01'); const fileRef=useRef();

  const handleFile=(e)=>{
    const f=e.target.files[0]; if(!f) return;
    setFile(f); setFileName(f.name); setParseResult(null); setPreview(''); setStatus(''); setError('');
  };
  const handleParse=async()=>{
    if(!file) return; setParsing(true); setError(''); setStatus(''); setParseResult(null);
    try {
      const base64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result.split(',')[1]);
        r.onerror=()=>rej(new Error('Файл оқылмады'));
        r.readAsDataURL(file);
      });
      const monthName=months.find(m=>m.id===targetMonth)?.name||'';
      const apiBase=import.meta.env.VITE_API_URL||'http://localhost:3001/api';
      const response=await fetch(`${apiBase}/parse-schedule`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ base64, direction:targetDir, monthId:targetMonth, monthName }),
      });
      if(!response.ok){const err=await response.json();throw new Error(err.error||`Сервер қате: ${response.status}`);}
      const data=await response.json();
      setParseResult({teachers:data.teachers,days:data.days,chars:data.result?.length||0});
      setPreview(data.result||'');
      setStatus(`✅ Дайын — ${data.days} күн, ${data.teachers} мұғалім`);
    } catch(err) { setError('❌ '+err.message); } finally { setParsing(false); }
  };
  const handleDownload=()=>{
    if(!preview) return;
    const note=`// JUZ40 — ${targetDir}, ${months.find(m=>m.id===targetMonth)?.name}\n// scheduleData.js ішіне қойып push жасаңыз\n\n${preview}`;
    const blob=new Blob([note],{type:'text/javascript;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`schedule_${targetDir}_${targetMonth}_parsed.js`; a.click();
    URL.revokeObjectURL(url);
    setStatus('⬇️ Жүктелді. GitHub push жасаңыз.');
  };
  const sel={fontSize:13,padding:'8px 12px',borderRadius:9,border:`1.5px solid ${C.divider}`,
    background:'rgba(255,255,255,0.9)',color:C.text,fontFamily:'inherit',outline:'none',cursor:'pointer'};
  return (
    <div style={{minHeight:'100vh',background:C.pageBg}}>
      <style>{G}</style>
      <header className="g-panel" style={{position:'sticky',top:0,zIndex:50,padding:'0 24px',height:58,
        display:'flex',alignItems:'center',justifyContent:'space-between',borderRadius:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <Logo h={24}/>
          <span style={{fontSize:11,color:C.textSub,fontWeight:500}}>Басқарушы кабинеті</span>
        </div>
        <button onClick={onLogout} style={{padding:'6px 14px',borderRadius:8,fontSize:12,cursor:'pointer',
          background:'transparent',border:`1px solid ${C.divider}`,color:C.textMuted}}>Шығу</button>
      </header>
      <div style={{maxWidth:820,margin:'14px auto 0',padding:'0 24px'}}>
        <button onClick={onBack} style={{padding:'6px 14px',borderRadius:8,fontSize:12,cursor:'pointer',
          background:'transparent',border:`1px solid ${C.divider}`,color:C.textSub,fontWeight:600}}>← Кестеге оралу</button>
      </div>
      <div style={{maxWidth:820,margin:'0 auto',padding:'28px 24px',display:'flex',flexDirection:'column',gap:16}}>
        <div className="g-card" style={{padding:'16px 20px',background:'rgba(232,244,246,0.7)'}}>
          <div style={{fontSize:14,fontWeight:700,color:C.titleColor,marginBottom:10}}>📋 Автоматты парсинг — docx → scheduleData.js</div>
          <div style={{fontSize:12,color:C.textSub,lineHeight:2}}>
            <b>1.</b> Бағыт пен ай таңдаңыз &nbsp; <b>2.</b> .docx жүктеңіз &nbsp; <b>3.</b> Оқу → .js жүктеу &nbsp; <b>4.</b> scheduleData.js-ке қойып, GitHub push
          </div>
        </div>
        <div className="g-card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              <label style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Бағыт</label>
              <select value={targetDir} onChange={e=>setTargetDir(e.target.value)} style={sel}>
                <option>SMART</option><option>JUNIOR</option>
              </select>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              <label style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Ай</label>
              <select value={targetMonth} onChange={e=>setTargetMonth(e.target.value)} style={sel}>
                {months.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="g-card" style={{padding:'24px',textAlign:'center',border:`2px dashed ${C.divider}`}}>
          <input ref={fileRef} type="file" accept=".docx" onChange={handleFile} style={{display:'none'}}/>
          <div style={{fontSize:32,marginBottom:8}}>📄</div>
          <button onClick={()=>fileRef.current?.click()}
            style={{padding:'9px 22px',borderRadius:9,background:JUZ.teal,border:'none',color:'#fff',fontSize:13,cursor:'pointer',fontWeight:700,boxShadow:'0 4px 14px rgba(27,110,126,0.28)'}}>
            .docx файл таңдау
          </button>
          {fileName&&<div style={{marginTop:10,fontSize:13,color:JUZ.teal,fontWeight:500}}>✓ {fileName}</div>}
        </div>
        {file&&(
          <button onClick={handleParse} disabled={parsing}
            style={{padding:'12px',borderRadius:10,fontSize:14,fontWeight:700,
              background:parsing?C.textMuted:JUZ.teal,border:'none',color:'#fff',cursor:parsing?'not-allowed':'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 14px rgba(27,110,126,0.28)'}}>
            {parsing?(<><span style={{display:'inline-block',width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>Оқып жатыр...</>):'📄 Кестені оқу'}
          </button>
        )}
        {error&&<div style={{padding:'12px 16px',borderRadius:9,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.18)',fontSize:13,color:'#dc2626'}}>{error}</div>}
        {parseResult&&(
          <div style={{padding:'14px',borderRadius:10,background:'rgba(240,255,244,0.9)',border:'1px solid rgba(154,230,180,0.8)'}}>
            <div style={{fontSize:13,fontWeight:600,color:'#276749',marginBottom:4}}>Нәтиже:</div>
            <div style={{fontSize:12,color:'#276749',lineHeight:2}}>📅 Күндер: <b>{parseResult.days}</b> &nbsp; 👨‍🏫 Мұғалімдер: <b>{parseResult.teachers}</b></div>
          </div>
        )}
        {status&&<div style={{padding:'12px 16px',borderRadius:9,fontSize:13,
          background:status.startsWith('✅')?'rgba(240,255,244,0.9)':'rgba(232,244,246,0.9)',
          border:`1px solid ${status.startsWith('✅')?'rgba(154,230,180,0.8)':C.divider}`,
          color:status.startsWith('✅')?'#276749':JUZ.teal}}>{status}</div>}
        {preview&&(
          <>
            <button onClick={handleDownload}
              style={{padding:'9px 22px',borderRadius:9,background:JUZ.teal,border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',alignSelf:'flex-end',boxShadow:'0 3px 12px rgba(27,110,126,0.25)'}}>
              ⬇️ .js жүктеу
            </button>
            <details style={{borderRadius:12,border:`1px solid ${C.divider}`,overflow:'hidden'}}>
              <summary style={{padding:'10px 16px',background:'#F8FAFC',fontSize:12,color:C.textSub,cursor:'pointer'}}>
                Нәтиже ({preview.split('\n').length} жол)
              </summary>
              <pre style={{padding:'14px',fontSize:11,overflowX:'auto',margin:0,background:'var(--surface)',color:'#334',maxHeight:400,overflowY:'auto'}}>{preview}</pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Lesson Entry Modal (Енгізу) ────────────────────────────────────────────────
const WEEKDAYS = ['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі','Жексенбі'];
const NEW_TEACHER = '__new__';

function LessonEntryModal({ month, onClose, onSubmit, teacherNames }) {
  const [direction, setDirection] = useState('SMART');
  const [kind, setKind]           = useState('live');
  const [monthId, setMonthId]     = useState(month);
  const [day, setDay]             = useState('Сәрсенбі');
  const [subject, setSubject]     = useState(Object.keys(SUBJECT_COLORS)[0]);
  const [stream, setStream]       = useState(`${Object.keys(SUBJECT_COLORS)[0]}-01`);
  const [teacherSel, setTeacherSel] = useState(teacherNames[0] || NEW_TEACHER);
  const [newTeacher, setNewTeacher] = useState('');
  const [times, setTimes]         = useState('13:00-14:00');
  const [err, setErr]             = useState('');

  const subjects = Object.keys(SUBJECT_COLORS);

  const inputStyle={width:'100%',padding:'9px 12px',borderRadius:8,
    border:`1.5px solid ${C.divider}`,fontSize:13,color:C.text,
    background:'var(--surface)',outline:'none',fontFamily:'inherit',boxSizing:'border-box'};
  const labelStyle={fontSize:11,fontWeight:600,color:C.textSub,display:'block',marginBottom:5};

  const submit = () => {
    const teacherName = teacherSel===NEW_TEACHER ? newTeacher.trim() : teacherSel;
    if (!teacherName) { setErr('Мұғалім атын енгізіңіз'); return; }
    const timesArr = times.split(',').map(t=>t.trim()).filter(Boolean).map(t=>t.replace(/-/g,'–'));
    if (!timesArr.length) { setErr('Кемінде бір уақыт енгізіңіз (мыс. 13:00-14:00)'); return; }

    const lesson = {
      subject,
      ...(stream.trim() ? { stream: stream.trim() } : {}),
      teachers: [{ name: teacherName, times: timesArr }],
    };
    const bucket = direction==='JUNIOR' ? 'junior' : (kind==='additional' ? 'additional' : 'live');
    onSubmit({ bucket, monthId, day, type: kind, lesson });
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(10,20,30,0.45)', zIndex:200,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={onClose}>
      <div className="g-card" style={{ width:440, maxHeight:'88vh', overflowY:'auto', padding:'24px 24px 20px' }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.titleColor }}>➕ Сабақ енгізу</div>
          <span style={{ cursor:'pointer', fontSize:18, color:C.textMuted }} onClick={onClose}>×</span>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ flex:1 }}>
              <label style={labelStyle}>Бағыт</label>
              <select value={direction} onChange={e=>setDirection(e.target.value)} style={inputStyle}>
                <option value="SMART">SMART</option>
                <option value="JUNIOR">JUNIOR</option>
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={labelStyle}>Поток / ай</label>
              <select value={monthId} onChange={e=>setMonthId(e.target.value)} style={inputStyle}>
                {months.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {direction==='SMART' && (
            <div>
              <label style={labelStyle}>Түрі</label>
              <div style={{ display:'flex', gap:8 }}>
                {[{id:'live',label:'● LIVE сабақ'},{id:'additional',label:'➕ ҚОСЫМША сабақ'}].map(k=>(
                  <button key={k.id} type="button" onClick={()=>setKind(k.id)}
                    style={{ flex:1, padding:'8px 10px', borderRadius:8, fontSize:11.5, fontWeight:700, cursor:'pointer',
                      border:`1.5px solid ${kind===k.id?JUZ.teal:C.divider}`,
                      background: kind===k.id ? `${JUZ.teal}12` : 'transparent',
                      color: kind===k.id ? JUZ.teal : C.textMuted }}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Күні</label>
            <select value={day} onChange={e=>setDay(e.target.value)} style={inputStyle}>
              {WEEKDAYS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <div style={{ flex:1 }}>
              <label style={labelStyle}>Пән</label>
              <select value={subject} onChange={e=>{ setSubject(e.target.value); setStream(`${e.target.value}-01`); }} style={inputStyle}>
                {subjects.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={labelStyle}>Поток коды</label>
              <input value={stream} onChange={e=>setStream(e.target.value)} placeholder="МАТ-01" style={inputStyle}/>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Мұғалім</label>
            <select value={teacherSel} onChange={e=>setTeacherSel(e.target.value)} style={inputStyle}>
              {teacherNames.map(n=><option key={n} value={n}>{n}</option>)}
              <option value={NEW_TEACHER}>➕ Жаңа мұғалім қосу...</option>
            </select>
            {teacherSel===NEW_TEACHER && (
              <input value={newTeacher} onChange={e=>setNewTeacher(e.target.value)}
                placeholder="Аты-жөні" style={{...inputStyle, marginTop:8}}/>
            )}
          </div>

          <div>
            <label style={labelStyle}>Уақыттар (үтірмен бөліп жазыңыз)</label>
            <input value={times} onChange={e=>setTimes(e.target.value)} placeholder="13:00-14:00, 14:10-15:10" style={inputStyle}/>
          </div>

          {err && <div style={{fontSize:12,color:'#dc2626',padding:'6px',background:'rgba(239,68,68,0.06)',borderRadius:7,textAlign:'center'}}>{err}</div>}

          <button onClick={submit}
            style={{padding:'11px',borderRadius:9,background:JUZ.teal,border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 14px rgba(27,110,126,0.30)'}}>
            Сақтау
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Schedule({ onGoToCabinet }) {
  const [view, setView]             = useState('calendar');
  const [supervisorMode, setSM]     = useState(false);
  const [supervisorAuth, setSA]     = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showEntry, setShowEntry]   = useState(false);

  const [overrides, setOverrides] = useState(()=>loadOverrides());
  useEffect(()=>{ saveOverrides(overrides); }, [overrides]);

  const [filters, setFilters] = useState({
    dir:'Барлығы', subjects:[], month:'01',
    timeFrom:'13:00', timeTo:'19:00', kinds:['live','additional'],
  });

  const juniorMergedByMonth = useMemo(()=>({
    [filters.month]: mergeDays(juniorScheduleByMonth[filters.month]||[], overrides.junior?.[filters.month]||[])
  }),[filters.month, overrides.junior]);

  const allSubjects = useMemo(()=>{
    const smartDays = mergeSmartSchedule(filters.month, filters.kinds, overrides);
    const days=[...smartDays,...(juniorMergedByMonth[filters.month]||[])];
    const set=new Set(); days.forEach(d=>d.lessons.forEach(l=>set.add(l.subject)));
    return ['Барлығы',...Array.from(set)];
  },[filters.month,filters.dir,filters.kinds,overrides,juniorMergedByMonth]);

  const DAY_ORDER=['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі'];

  const filteredDays = useMemo(()=>{
    const fromMin=timeToMinutes(filters.timeFrom);
    const toMin=timeToMinutes(filters.timeTo);
    const smartSrcDays = mergeSmartSchedule(filters.month, filters.kinds, overrides);
    const smartSrc = { [filters.month]: smartSrcDays };
    if (filters.dir==='Барлығы') {
      const sD=(smartSrc[filters.month]||[]).map(d=>({...d,_dir:'SMART'}));
      const jD=(juniorMergedByMonth[filters.month]||[]).map(d=>({...d,_dir:'JUNIOR'}));
      const allDays=[...new Set([...sD.map(d=>d.day),...jD.map(d=>d.day)])].sort((a,b)=>DAY_ORDER.indexOf(a)-DAY_ORDER.indexOf(b));
      return allDays.map(day=>{
        const sBlock=sD.find(d=>d.day===day);
        const jBlock=jD.find(d=>d.day===day);
        const filt=(lessons)=>(lessons||[]).filter(l=>
          (!filters.subjects.length||filters.subjects.includes(l.subject))&&
          l.teachers.some(t=>t.times.some(tm=>{const p=tm.split(/[–\-]/);if(p.length<2)return true;return timeToMinutes(p[0])<toMin&&timeToMinutes(p[1])>fromMin;}))
        );
        const sF=sBlock?{...sBlock,lessons:filt(sBlock.lessons)}:null;
        const jF=jBlock?{...jBlock,lessons:filt(jBlock.lessons)}:null;
        if((!sF||!sF.lessons.length)&&(!jF||!jF.lessons.length)) return null;
        return {day,smartBlock:sF,juniorBlock:jF,_merged:true};
      }).filter(Boolean);
    }
    const sched=filters.dir==='SMART'?smartSrc:juniorMergedByMonth;
    return (sched[filters.month]||[]).map(d=>({
      ...d,_dir:filters.dir,
      lessons:d.lessons.filter(l=>
        (!filters.subjects.length||filters.subjects.includes(l.subject))&&
        l.teachers.some(t=>t.times.some(tm=>{const p=tm.split(/[–\-]/);if(p.length<2)return true;return timeToMinutes(p[0])<toMin&&timeToMinutes(p[1])>fromMin;}))
      )
    })).filter(d=>d.lessons.length>0);
  },[filters,overrides,juniorMergedByMonth]);

  const teachersIndex=useMemo(()=>{
    const extraSmart = [
      ...(overrides.live?.[filters.month]||[]),
      ...(overrides.additional?.[filters.month]||[]),
    ];
    return buildTeachersIndex(filters.month,'ALL',{ smart: extraSmart, junior: overrides.junior?.[filters.month]||[] });
  },[filters.month,overrides]);

  const allTeacherNames = useMemo(()=>getAllTeacherNames(filters.month, overrides, {
    smart: smartScheduleByMonth, smartAdditional: smartAdditionalScheduleByMonth, junior: juniorScheduleByMonth,
  }),[filters.month,overrides]);

  const handleAddLesson = (entry) => {
    setOverrides(prev => addLessonOverride(prev, entry));
    setShowEntry(false);
  };

  const activeMonthName=months.find(m=>m.id===filters.month)?.name||'';
  const streamName=filters.dir==='JUNIOR'
    ?(juniorStreamNames[filters.month]?juniorStreamNames[filters.month].toUpperCase():'—')
    :filters.dir==='SMART'?'SMART':'SMART + JUNIOR';

  const hasFilter=filters.dir!=='Барлығы'||filters.subjects.length>0;
  const filterLabel=()=>{
    const parts=[];
    if(filters.dir!=='Барлығы') parts.push(filters.dir);
    if(filters.subjects.length===1) parts.push(filters.subjects[0]);
    else if(filters.subjects.length>1) parts.push(`${filters.subjects.length} пән`);
    return parts.length?parts.join(' · '):'Фильтр';
  };

  if (supervisorMode&&!supervisorAuth) return <SupervisorLogin onLogin={()=>{setSA(true);setSM(false);}} onCancel={()=>setSM(false)}/>;
  if (supervisorMode&&supervisorAuth)  return <SupervisorDashboard onLogout={()=>{setSM(false);setSA(false);}} onBack={()=>setSM(false)}/>;

  const NAV_ITEMS=[
    {id:'schedule',icon:'📋',label:'Тізім'},
    {id:'calendar',icon:'📅',label:'Күнтізбе'},
    {id:'teachers',icon:'👨‍🏫',label:'Мұғалімдер'},
  ];

  return (
    <div style={{minHeight:'100vh',background:C.pageBg,color:C.text,position:'relative',display:'flex'}}>
      <style>{G}</style>
      <Sidebar />
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>

      {/* ── Header */}
      <header className="g-panel" style={{
        position:'sticky',top:0,zIndex:50,borderRadius:0,
        padding:'0 24px',height:56,
        display:'flex',alignItems:'center',justifyContent:'space-between',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <Logo h={22}/>
          <div style={{width:1,height:18,background:'#eef0f3'}}/>
          <span style={{fontSize:12,color:C.textMuted,fontWeight:500}}>Сабақ кестесі</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setSM(true)}
            style={{padding:'6px 13px',borderRadius:8,fontSize:11,cursor:'pointer',
              background: supervisorAuth ? '#1B6E7E' : '#f5f7fa',
              border:`1px solid ${supervisorAuth?'#1B6E7E':'#eef0f3'}`,
              color: supervisorAuth ? '#fff' : C.textMuted,
              fontWeight:600, transition:'all 0.2s'}}>
            🔧 Басқару{supervisorAuth?' ✓':''}
          </button>
        </div>
      </header>

      {/* ── Page header */}
      <div style={{ padding:'24px 28px 0', background:'var(--surface)', borderBottom:'1px solid #eef0f3' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'2px', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6 }}>JUZ40 · БІЛІМ БӨЛІМІ</div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'#0a1f2e', margin:0, letterSpacing:'-0.4px' }}>Сабақ кестесі</h1>
            <p style={{ fontSize:12, color:'#90a4ae', margin:'4px 0 0', fontWeight:500 }}>{activeMonthName} айы · {streamName} ағыны</p>
          </div>
          {/* View switcher tabs */}
          <div style={{ display:'flex', background:'#f4f6f8', borderRadius:12, padding:4, gap:2 }}>
            {NAV_ITEMS.map(item => (
              <button key={item.id}
                onClick={() => setView(item.id)}
                style={{
                  display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9,
                  border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600,
                  background: view === item.id ? '#fff' : 'transparent',
                  color: view === item.id ? '#1B6E7E' : '#90a4ae',
                  boxShadow: view === item.id ? '0 1px 6px rgba(0,0,0,0.10)' : 'none',
                  transition:'all 0.15s',
                }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Month bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:0 }}>
            {months.filter(m=>m.id==='01'||smartScheduleByMonth[m.id]||juniorScheduleByMonth[m.id]).map(m=>(
              <button key={m.id} onClick={()=>setFilters(f=>({...f,month:m.id}))}
                style={{
                  padding:'7px 14px', borderRadius:'10px 10px 0 0', fontSize:12, cursor:'pointer',
                  border:'none', fontFamily:'inherit', fontWeight: filters.month===m.id ? 700 : 500,
                  background: filters.month===m.id ? '#1B6E7E' : 'transparent',
                  color: filters.month===m.id ? '#fff' : '#90a4ae',
                  transition:'all 0.15s', whiteSpace:'nowrap', flexShrink:0,
                  borderBottom: filters.month===m.id ? '2px solid #1B6E7E' : '2px solid transparent',
                }}>
                {m.name}
              </button>
            ))}
          </div>

          {filters.dir!=='JUNIOR' && (
            <div style={{ display:'flex', background:'#f4f6f8', borderRadius:10, padding:3, gap:2, marginBottom:6 }}>
              {[
                {id:'live',label:'● LIVE сабақ',activeColor:'#b91c1c'},
                {id:'additional',label:'➕ ҚОСЫМША сабақ',activeColor:'#9a3412'},
              ].map(k=>{
                const active = filters.kinds.includes(k.id);
                return (
                  <button key={k.id}
                    onClick={()=>setFilters(f=>{
                      const has = f.kinds.includes(k.id);
                      const next = has ? f.kinds.filter(x=>x!==k.id) : [...f.kinds, k.id];
                      return { ...f, kinds: next.length ? next : f.kinds }; // keep at least one selected
                    })}
                    style={{
                      display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8,
                      border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:600,
                      background: active ? '#fff' : 'transparent',
                      color: active ? k.activeColor : '#90a4ae',
                      boxShadow: active ? '0 1px 6px rgba(0,0,0,0.10)' : 'none',
                      opacity: active ? 1 : 0.7,
                      transition:'all 0.15s', whiteSpace:'nowrap',
                    }}>
                    {k.label}
                  </button>
                );
              })}
            </div>
          )}

          {supervisorAuth && (
            <div style={{ display:'flex', gap:6, marginBottom:6 }}>
              <button onClick={()=>setShowEntry(true)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 13px', borderRadius:9,
                  border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11.5, fontWeight:700,
                  background:'#1B6E7E', color:'#fff', boxShadow:'0 3px 10px rgba(27,110,126,0.3)' }}>
                ➕ Енгізу
              </button>
              <button onClick={()=>setSM(true)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 13px', borderRadius:9,
                  border:'1px solid #eef0f3', cursor:'pointer', fontFamily:'inherit', fontSize:11.5, fontWeight:600,
                  background:'#f5f7fa', color:C.textMuted }}>
                📋 Docx парсинг
              </button>
            </div>
          )}
        </div>
      </div>

      {showEntry && (
        <LessonEntryModal
          month={filters.month}
          onClose={()=>setShowEntry(false)}
          onSubmit={handleAddLesson}
          teacherNames={allTeacherNames}
        />
      )}

      {/* ── Layout */}
      <div style={{ padding:'20px 28px', display:'flex', gap:16, alignItems:'flex-start' }}>

        {/* ── Filter sidebar */}
        <aside style={{ width:160, flexShrink:0, position:'sticky', top:56 }}>
          <div style={{ background:'var(--surface)', border:'1px solid #eef0f3', borderRadius:14, padding:'10px 8px', marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', padding:'4px 8px 8px' }}>Фильтрлер</div>
            <button className={`filter-pill${hasFilter?' has-filter':''}`} onClick={()=>setShowFilter(true)} style={{ width:'100%', justifyContent:'center', borderRadius:9 }}>
              <span>⚡</span><span>{filterLabel()}</span>
            </button>
            {filters.dir!=='Барлығы'&&(
              <div style={{ marginTop:6, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', borderRadius:8, background:`${JUZ.teal}10`, color:JUZ.teal, fontSize:11, fontWeight:600 }}>
                <span>{filters.dir}</span>
                <span style={{cursor:'pointer'}} onClick={()=>setFilters(f=>({...f,dir:'Барлығы',subjects:[]}))}>×</span>
              </div>
            )}
            {filters.subjects.map(s=>(
              <div key={s} style={{ marginTop:4, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', borderRadius:8, background:`${JUZ.teal}10`, color:JUZ.teal, fontSize:11, fontWeight:600 }}>
                <span>{s}</span>
                <span style={{cursor:'pointer'}} onClick={()=>setFilters(f=>({...f,subjects:f.subjects.filter(x=>x!==s)}))}>×</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main */}
        <main style={{flex:1,minWidth:0}}>
          {/* Filter bar */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18,flexWrap:'wrap'}}>
            <button className={`filter-pill${hasFilter?' has-filter':''}`} onClick={()=>setShowFilter(true)}>
              <span>⚡</span>
              <span>{filterLabel()}</span>
              {hasFilter&&<span style={{marginLeft:2,opacity:0.6,fontSize:11}}>▾</span>}
            </button>
            {filters.dir!=='Барлығы'&&(
              <span style={{display:'inline-flex',alignItems:'center',gap:5,
                padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,
                background:`${JUZ.teal}12`,color:JUZ.teal,border:`1px solid ${JUZ.teal}25`}}>
                {filters.dir}
                <span style={{cursor:'pointer',opacity:0.6,fontSize:12}}
                  onClick={()=>setFilters(f=>({...f,dir:'Барлығы',subjects:[]}))}>×</span>
              </span>
            )}
            {filters.subjects.map(s=>(
              <span key={s} style={{display:'inline-flex',alignItems:'center',gap:5,
                padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,
                background:`${JUZ.teal}12`,color:JUZ.teal,border:`1px solid ${JUZ.teal}25`}}>
                {s}
                <span style={{cursor:'pointer',opacity:0.6,fontSize:12}}
                  onClick={()=>setFilters(f=>({...f,subjects:f.subjects.filter(x=>x!==s)}))}>×</span>
              </span>
            ))}
          </div>

          {showFilter&&(
            <FilterModal filters={filters} onChange={setFilters}
              onClose={()=>setShowFilter(false)} subjectOptions={allSubjects} view={view}/>
          )}

          <AnimatePresence initial={false}>
            {view==='schedule'&&(
              <motion.div key="schedule"
                initial={{ opacity:0 }}
                animate={{ opacity:1 }}
                exit={{ opacity:0 }}
                transition={{ duration:0.20 }}>
                {filteredDays.length===0
                  ? <div style={{padding:'3rem',textAlign:'center',color:C.textMuted,
                      background:'rgba(255,255,255,0.05)',backdropFilter:'blur(12px)',
                      borderRadius:16,border:`1px solid ${C.divider}`}}>
                      Сабақ табылмады
                    </div>
                  : filteredDays.map((d,i)=>
                      d._merged
                        ? <MergedDayBlock key={i} index={i} day={d.day} smartBlock={d.smartBlock} juniorBlock={d.juniorBlock}/>
                        : <DayBlock key={i} index={i} dayBlock={d} direction={d._dir||filters.dir}/>
                    )
                }
              </motion.div>
            )}

            {view==='calendar'&&(
              <motion.div key="calendar"
                initial={{ opacity:0 }}
                animate={{ opacity:1 }}
                exit={{ opacity:0 }}
                transition={{ duration:0.20 }}>
                <CalendarView filters={filters} overrides={overrides}/>
              </motion.div>
            )}

            {view==='teachers'&&(
              <motion.div key="teachers"
                initial={{ opacity:0 }}
                animate={{ opacity:1 }}
                exit={{ opacity:0 }}
                transition={{ duration:0.20 }}>
                <TeachersView teachersIndex={teachersIndex} filters={filters}/>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{marginTop:'2.5rem',paddingTop:'1.5rem',
            borderTop:`1px solid ${C.divider}`,
            display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <Logo h={18}/>
              <span style={{fontSize:11,color:C.textMuted}}>© 2026 JUZ40 Online Edu.</span>
            </div>
            <span style={{fontSize:11,color:C.textMuted}}>Әзірлеуші: Толеухан Жеңіс</span>
          </div>
        </main>
      </div>
      </div>
    </div>
  );
}
