// TeachersView.jsx — Мұғалімдер тізімі, пән бойынша топтастырылған, Excel экспорты бар

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { months, SUBJECT_COLORS } from '../../pages/scheduleData';
import { JUZ, C } from '../../pages/schedule.styles';
import { SubjectBadge, DirBadge } from './ScheduleAtoms';
import { TeacherWeeklyTimeline } from './CalendarView';

export function TeachersView({ teachersIndex, filters }) {
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
