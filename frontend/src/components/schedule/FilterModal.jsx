// FilterModal.jsx — Бағыт/пән/ай/уақыт аралығы бойынша фильтр терезесі

import { useRef } from 'react';
import { months } from '../../pages/scheduleData';
import { JUZ, C } from '../../pages/schedule.styles';

export function FilterModal({ filters, onChange, onClose, subjectOptions, view }) {
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
