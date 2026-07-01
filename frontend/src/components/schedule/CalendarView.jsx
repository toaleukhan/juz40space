// CalendarView.jsx — Күнтізбе көрінісі (event карточкалары) және мұғалімнің
// апталық визуалды таймлайны.

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { SUBJECT_COLORS } from '../../pages/scheduleData';
import { JUZ, C } from '../../pages/schedule.styles';
import {
  buildCalEvents, CAL_DAYS, SCHED_SET, HOUR_H, W_START, W_END, DAY_MIN_W,
  TL_START_MIN, TL_RANGE, toMin,
} from '../../pages/scheduleUtils';
import { KindBadge, DirBadge, SubjectBadge } from './ScheduleAtoms';

export function CalEventCard({ ev }) {
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

export function CalendarView({ filters, overrides }) {
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
export function TeacherWeeklyTimeline({ entries }) {
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
