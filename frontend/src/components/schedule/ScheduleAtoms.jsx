// ScheduleAtoms.jsx — Сабақ кестесінің кіші, қайта пайдаланылатын компоненттері:
// логотип, пән/бағыт/түр белгілері, сабақ карточкасы, күн блоктары.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SUBJECT_COLORS, SUBJECT_LOGOS } from '../../pages/scheduleData';
import { JUZ, C } from '../../pages/schedule.styles';
import juz40Logo from '../../assets/juz40-logo.png';

export function Logo({ h=26 }) {
  return <img src={juz40Logo} height={h} alt="JUZ40" style={{display:'block'}} />;
}

export function SubjectBadge({ subject, size='md' }) {
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

export function DirBadge({ dir }) {
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
export function KindBadge({ kind }) {
  if (kind === 'additional') {
    return <span className="plus-dot" title="Қосымша сабақ">+</span>;
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
export function LessonCard({ lesson, direction }) {
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

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6,marginBottom:8,flexWrap:'wrap'}}>
        <SubjectBadge subject={lesson.subject} size="sm" />
        <div style={{display:'flex',alignItems:'center',gap:5}}>
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
export function MergedDayBlock({ day, smartBlock, juniorBlock, index=0 }) {
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

export function DayBlock({ dayBlock, direction, index=0 }) {
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
