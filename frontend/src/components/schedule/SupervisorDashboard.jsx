// SupervisorDashboard.jsx — Басқарушы кабинеті: .docx кестені парсинг жасау

import { useState, useRef } from 'react';
import { months } from '../../pages/scheduleData';
import { JUZ, C, G } from '../../pages/schedule.styles';
import { Logo } from './ScheduleAtoms';

export function SupervisorDashboard({ onLogout, onBack }) {
  const [file,setFile]=useState(null); const [fileName,setFileName]=useState('');
  const [parsing,setParsing]=useState(false); const [parseResult,setParseResult]=useState(null);
  const [preview,setPreview]=useState(''); const [status,setStatus]=useState('');
  const [error,setError]=useState(''); const [targetDir,setTargetDir]=useState('SMART');
  const [targetMonth,setTargetMonth]=useState('01'); const [targetKind,setTargetKind]=useState('live');
  const [draftId,setDraftId]=useState(null); const [publishing,setPublishing]=useState(false);
  const [published,setPublished]=useState(false); const fileRef=useRef();

  const apiBase=import.meta.env.VITE_API_URL||'http://localhost:3001/api';
  const authHeaders=()=>{
    const token=localStorage.getItem('token');
    return token?{Authorization:`Bearer ${token}`}:{};
  };

  const handleFile=(e)=>{
    const f=e.target.files[0]; if(!f) return;
    setFile(f); setFileName(f.name); setParseResult(null); setPreview(''); setStatus(''); setError('');
    setDraftId(null); setPublished(false);
  };
  const handleParse=async()=>{
    if(!file) return; setParsing(true); setError(''); setStatus(''); setParseResult(null); setDraftId(null); setPublished(false);
    try {
      const base64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result.split(',')[1]);
        r.onerror=()=>rej(new Error('Файл оқылмады'));
        r.readAsDataURL(file);
      });
      const monthName=months.find(m=>m.id===targetMonth)?.name||'';
      const response=await fetch(`${apiBase}/parse-schedule`,{
        method:'POST',
        headers:{'Content-Type':'application/json', ...authHeaders()},
        body:JSON.stringify({ base64, direction:targetDir, monthId:targetMonth, monthName, kind:targetKind }),
      });
      if(!response.ok){const err=await response.json();throw new Error(err.error||`Сервер қате: ${response.status}`);}
      const data=await response.json();
      setParseResult({teachers:data.teachers,days:data.days,chars:data.result?.length||0});
      setPreview(data.result||'');
      setDraftId(data.draftId||null);
      setStatus(`✅ Дайын — ${data.days} күн, ${data.teachers} мұғалім. Тексеріп, жариялаңыз.`);
    } catch(err) { setError('❌ '+err.message); } finally { setParsing(false); }
  };
  const handlePublish=async()=>{
    if(!draftId) return; setPublishing(true); setError('');
    try {
      const response=await fetch(`${apiBase}/schedule/${draftId}/publish`,{
        method:'POST', headers:{...authHeaders()},
      });
      if(!response.ok){const err=await response.json();throw new Error(err.error||`Сервер қате: ${response.status}`);}
      setPublished(true);
      setStatus('✅ Жарияланды — сайтта бірден көрінеді.');
    } catch(err) { setError('❌ '+err.message); } finally { setPublishing(false); }
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
          <div style={{fontSize:14,fontWeight:700,color:C.titleColor,marginBottom:10}}>📋 Автоматты парсинг — docx → сайт</div>
          <div style={{fontSize:12,color:C.textSub,lineHeight:2}}>
            <b>1.</b> Бағыт, түрі, ай таңдаңыз &nbsp; <b>2.</b> .docx жүктеңіз &nbsp; <b>3.</b> Оқу &nbsp; <b>4.</b> Тексеріп, «Жариялау» — сайтта бірден көрінеді
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
            {targetDir==='SMART' && (
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Түрі</label>
                <select value={targetKind} onChange={e=>setTargetKind(e.target.value)} style={sel}>
                  <option value="live">● LIVE сабақ</option>
                  <option value="additional">➕ ҚОСЫМША сабақ</option>
                </select>
              </div>
            )}
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
        {draftId && !published && (
          <button onClick={handlePublish} disabled={publishing}
            style={{padding:'12px',borderRadius:10,fontSize:14,fontWeight:700,
              background:publishing?C.textMuted:'#1B6E7E',border:'none',color:'#fff',cursor:publishing?'not-allowed':'pointer',
              boxShadow:'0 4px 14px rgba(27,110,126,0.28)'}}>
            {publishing?'Жариялануда...':'✅ Жариялау — сайтта көрсету'}
          </button>
        )}
        {published && (
          <div style={{padding:'12px 16px',borderRadius:9,background:'rgba(240,255,244,0.9)',border:'1px solid rgba(154,230,180,0.8)',fontSize:13,color:'#276749',fontWeight:600}}>
            ✅ Жарияланды — куратор кабинетінде бірден көрінеді
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
