// LessonEntryModal.jsx — "➕ Енгізу" арқылы жаңа сабақты қолмен қосу формасы

import { useState } from 'react';
import { months, SUBJECT_COLORS } from '../../pages/scheduleData';
import { JUZ, C } from '../../pages/schedule.styles';
import { WEEKDAYS, NEW_TEACHER } from '../../pages/scheduleUtils';

export function LessonEntryModal({ month, onClose, onSubmit, teacherNames }) {
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
