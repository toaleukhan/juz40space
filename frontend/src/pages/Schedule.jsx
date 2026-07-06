import {
  months, smartScheduleByMonth, smartAdditionalScheduleByMonth, juniorScheduleByMonth,
  buildTeachersIndex, juniorStreamNames,
} from './scheduleData';
import { loadOverrides, saveOverrides, mergeDays, addLessonOverride, getAllTeacherNames, EMPTY_OVERRIDES } from './scheduleOverrides';
import { loadPublishedSchedules, EMPTY_PUBLISHED } from './scheduleDb';
import { exportScheduleToPdf } from './exportSchedulePdf';
import { mergeSmartSchedule, timeToMinutes, pickBase } from './scheduleUtils';
import { JUZ, C, G } from './schedule.styles';
import { useState, useMemo, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo, MergedDayBlock, DayBlock } from '../components/schedule/ScheduleAtoms';
import { CalendarView } from '../components/schedule/CalendarView';
import { FilterModal } from '../components/schedule/FilterModal';
import { TeachersView } from '../components/schedule/TeachersView';
import { SupervisorDashboard } from '../components/schedule/SupervisorDashboard';
import { LessonEntryModal } from '../components/schedule/LessonEntryModal';

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Schedule({ onGoToCabinet }) {
  const [view, setView]             = useState('calendar');
  const [supervisorMode, setSM]     = useState(false);
  const [supervisorAuth, setSA]     = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showEntry, setShowEntry]   = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [overrides, setOverrides] = useState(EMPTY_OVERRIDES);
  useEffect(()=>{ loadOverrides().then(setOverrides); }, []);

  const [published, setPublished] = useState(EMPTY_PUBLISHED);
  useEffect(()=>{ loadPublishedSchedules().then(setPublished); }, []);

  const [filters, setFilters] = useState({
    dir:'Барлығы', subjects:[], month:'01',
    timeFrom:'13:00', timeTo:'19:00', kinds:['live','additional'],
  });

  const juniorMergedByMonth = useMemo(()=>({
    [filters.month]: mergeDays(pickBase(filters.month, juniorScheduleByMonth, published.junior), overrides.junior?.[filters.month]||[])
  }),[filters.month, overrides.junior, published.junior]);

  const allSubjects = useMemo(()=>{
    const smartDays = mergeSmartSchedule(filters.month, filters.kinds, overrides, published);
    const days=[...smartDays,...(juniorMergedByMonth[filters.month]||[])];
    const set=new Set(); days.forEach(d=>d.lessons.forEach(l=>set.add(l.subject)));
    return ['Барлығы',...Array.from(set)];
  },[filters.month,filters.dir,filters.kinds,overrides,published,juniorMergedByMonth]);

  const DAY_ORDER=['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі'];

  const filteredDays = useMemo(()=>{
    const fromMin=timeToMinutes(filters.timeFrom);
    const toMin=timeToMinutes(filters.timeTo);
    const smartSrcDays = mergeSmartSchedule(filters.month, filters.kinds, overrides, published);
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
  },[filters,overrides,published,juniorMergedByMonth]);

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
    setOverrides(prev => {
      const next = addLessonOverride(prev, entry);
      saveOverrides(next);
      return next;
    });
    setShowEntry(false);
  };

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const flatDays = filteredDays.map(d => d._merged
        ? { day: d.day, lessons: [...(d.smartBlock?.lessons||[]), ...(d.juniorBlock?.lessons||[])] }
        : { day: d.day, lessons: d.lessons }
      );
      await exportScheduleToPdf({ days: flatDays, monthName: activeMonthName, streamName });
    } finally {
      setExportingPdf(false);
    }
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

  if (supervisorMode) return <SupervisorDashboard onLogout={()=>{setSM(false);setSA(false);}} onBack={()=>setSM(false)}/>;

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
          <button onClick={()=>{setSM(true);setSA(true);}}
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
            {months.filter(m=>m.id==='01'
              ||smartScheduleByMonth[m.id]||juniorScheduleByMonth[m.id]
              ||published.smart[m.id]||published.smartAdditional[m.id]||published.junior[m.id]
            ).map(m=>(
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
      <div style={{ padding:'20px 28px' }}>

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
            {view==='schedule'&&(
              <button onClick={handleExportPdf} disabled={exportingPdf}
                style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:24,
                  fontSize:12,fontWeight:600,cursor:exportingPdf?'not-allowed':'pointer',
                  border:'1px solid rgba(27,110,126,0.30)',background:'rgba(27,110,126,0.06)',
                  color:JUZ.teal,marginLeft:'auto'}}>
                {exportingPdf?'Дайындалуда...':'⬇️ PDF экспорт'}
              </button>
            )}
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
                <CalendarView filters={filters} overrides={overrides} published={published}/>
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
