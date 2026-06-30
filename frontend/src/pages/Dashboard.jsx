import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import * as XLSX from 'xlsx';
import Schedule from './Schedule';
import Sidebar from '../components/Sidebar';

const AVATAR_COLORS = [
  'rgba(124,58,237,0.35)', 'rgba(59,130,246,0.35)', 'rgba(245,158,11,0.35)',
  'rgba(34,197,94,0.25)', 'rgba(239,68,68,0.25)', 'rgba(236,72,153,0.25)'
];
const AVATAR_TEXT = [
  '#a78bfa', '#93c5fd', '#fcd34d', '#4ade80', '#fca5a5', '#f9a8d4'
];

// ─── Навигация бөлімдері ─────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Басты бет', icon: '⊞' },
  { id: 'schedule',  label: 'Сабақ кестесі', icon: '📅' },
];

export default function Dashboard() {
  const { curator, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('dashboard');
  const [stats, setStats] = useState({ students: 0, todaySent: 0, totalSent: 0 });
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [waConnected, setWaConnected] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', phone: '' });
  const [newGroupName, setNewGroupName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if (activeGroup) loadStudents(activeGroup.id); }, [activeGroup]);

  const loadData = async () => {
    try {
      const [statsRes, groupsRes, waRes] = await Promise.all([
        api.get('/stats'), api.get('/groups'), api.get('/whatsapp/status')
      ]);
      setStats(statsRes.data);
      setGroups(groupsRes.data);
      setWaConnected(waRes.data.connected);
      if (groupsRes.data.length && !activeGroup) setActiveGroup(groupsRes.data[0]);
    } catch (err) { console.error(err); }
  };

  const loadStudents = async (groupId) => {
    try {
      const { data } = await api.get(`/groups/${groupId}/students`);
      setStudents(data);
    } catch (err) { console.error(err); }
  };

  const sendMsg = async () => {
    if (!message.trim()) return;
    setSending(true); setSendResult(null);
    try {
      const { data } = await api.post('/whatsapp/send', { groupId: activeGroup?.id, message });
      setSendResult({ success: true, total: data.total });
      setMessage('');
      setTimeout(loadData, 2000);
    } catch (err) {
      setSendResult({ success: false, error: err.response?.data?.error || 'Қате болды' });
    } finally { setSending(false); }
  };

  const addStudent = async () => {
    if (!newStudent.name || !newStudent.phone) return;
    try {
      await api.post(`/groups/${activeGroup.id}/students`, newStudent);
      setNewStudent({ name: '', phone: '' });
      setShowAddStudent(false);
      loadStudents(activeGroup.id); loadData();
    } catch (err) { alert(err.response?.data?.error || 'Қате'); }
  };

  const removeStudent = async (studentId) => {
    if (!confirm('Оқушыны жою?')) return;
    try {
      await api.delete(`/groups/${activeGroup.id}/students/${studentId}`);
      loadStudents(activeGroup.id); loadData();
    } catch (err) { console.error(err); }
  };

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const { data } = await api.post('/groups', { name: newGroupName });
      setGroups(g => [...g, { ...data, student_count: 0 }]);
      setNewGroupName(''); setShowAddGroup(false); setActiveGroup(data);
    } catch (err) { alert(err.response?.data?.error || 'Қате'); }
  };

  const deleteGroup = async (groupId) => {
    if (!confirm('Топты жою? Барлық оқушылар да жойылады.')) return;
    try {
      await api.delete(`/groups/${groupId}`);
      setGroups(g => g.filter(x => x.id !== groupId));
      if (activeGroup?.id === groupId) setActiveGroup(null);
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const students = rows.slice(1).filter(r => r[0] && r[1]).map(r => ({ name: String(r[0]).trim(), phone: String(r[1]).trim() }));
      if (!students.length) { setImportResult({ success: false, error: 'Оқушылар табылмады' }); return; }
      const { data } = await api.post(`/groups/${activeGroup.id}/students/bulk`, { students });
      setImportResult({ success: true, count: data.count });
      loadStudents(activeGroup.id); loadData();
    } catch (err) {
      setImportResult({ success: false, error: 'Excel оқу қатесі' });
    } finally { setImporting(false); e.target.value = ''; }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Аты-жөні', 'Телефон'], ['Алия Серікова', '+77071234567'], ['Бекзат Мұратов', '+77012345678']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Оқушылар');
    XLSX.writeFile(wb, 'juznotify_template.xlsx');
  };

  const getAvatarColor = (name, idx) => AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const getAvatarText  = (name, idx) => AVATAR_TEXT[idx % AVATAR_TEXT.length];
  const getInitials    = (name) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f5f7fa', fontFamily: "'Inter',system-ui,sans-serif" }}>

      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

      {/* ─── Top bar ─────────────────────────────────────────────────────── */}
      <header style={{ background: '#fff', borderBottom: '1px solid #eef0f3', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f2a1a', letterSpacing: '-0.3px' }}>
            Куратор кабинеті
          </h1>
          <nav style={{ display: 'flex', gap: 4 }}>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8, fontSize: 12,
                  fontWeight: activeNav === item.id ? 600 : 400,
                  background: activeNav === item.id ? 'rgba(27,110,126,0.12)' : 'transparent',
                  border: activeNav === item.id ? '1px solid rgba(27,110,126,0.3)' : '1px solid transparent',
                  color: activeNav === item.id ? '#0f5a6a' : '#9ab5a5',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {waConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 999, padding: '5px 12px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>WhatsApp қосылды</span>
            </div>
          ) : (
            <a href="/whatsapp" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 999, padding: '5px 12px', textDecoration: 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
              <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>QR жаңарту</span>
            </a>
          )}
        </div>
      </header>

      {/* ─── Сабақ кестесі беті ──────────────────────────────────────────────── */}
      {activeNav === 'schedule' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Schedule onGoToCabinet={() => setActiveNav('dashboard')} />
        </div>
      )}

      {/* ─── Куратор басты беті ───────────────────────────────────────────── */}
      {activeNav === 'dashboard' && (
        <div style={{ flex: 1, display: 'flex' }}>
          {/* Groups aside */}
          <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #eef0f3', padding: 16, display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#c4cfd4', letterSpacing: '1.5px' }}>ТОПТАР</span>
              <button onClick={() => setShowAddGroup(true)} style={{ background: 'rgba(27,110,126,0.12)', border: '1px solid rgba(27,110,126,0.25)', borderRadius: 8, width: 26, height: 26, color: '#1B6E7E', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</button>
            </div>

            {groups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', borderRadius: 10, background: activeGroup?.id === g.id ? 'rgba(27,110,126,0.1)' : 'transparent', border: activeGroup?.id === g.id ? '1px solid rgba(27,110,126,0.3)' : '1px solid transparent', transition: 'all 0.15s' }}>
                <button onClick={() => { setActiveGroup(g); loadStudents(g.id); }} style={{ flex: 1, padding: '9px 10px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: activeGroup?.id === g.id ? '#0f5a6a' : '#7a9a8a' }}>{g.name}</span>
                  <span style={{ background: activeGroup?.id === g.id ? 'rgba(27,110,126,0.2)' : '#f0f2f4', color: activeGroup?.id === g.id ? '#1B6E7E' : '#9ab5a5', fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600 }}>{g.student_count}</span>
                </button>
                <button className="ios btn-d" onClick={() => deleteGroup(g.id)} style={{ margin: '0 6px', opacity: 0.6 }}>✕</button>
              </div>
            ))}

            {showAddGroup && (
              <div style={{ padding: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafb', borderRadius: 10, border: '1px solid #eef0f3' }}>
                <input className="inp" placeholder="Топ атауы" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} style={{ fontSize: 12, background: '#fff', border: '1px solid #eef0f3', color: '#0f2a1a' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ flex: 1, padding: '7px 8px', fontSize: 12, background: '#1B6E7E', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }} onClick={addGroup}>Қосу</button>
                  <button style={{ flex: 1, padding: '7px 8px', fontSize: 12, background: '#f0f2f4', border: '1px solid #eef0f3', borderRadius: 8, color: '#7a9a8a', cursor: 'pointer' }} onClick={() => setShowAddGroup(false)}>✕</button>
                </div>
              </div>
            )}
          </aside>

          <main style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', background: '#f5f7fa' }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'Оқушылар', value: stats.students, color: '#1B6E7E' },
                { label: 'Бүгін жіберілді', value: stats.todaySent, color: '#3b82f6' },
                { label: 'Барлығы', value: stats.totalSent, color: '#8b5cf6' }
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #eef0f3', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <p style={{ fontSize: 10, color: '#9ab5a5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>{s.label}</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: '-1px' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Message */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #eef0f3' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#c4cfd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Хабарлама жіберу</p>
              <textarea rows={4} placeholder="Хабарлама жазыңыз..." value={message} onChange={e => setMessage(e.target.value)}
                style={{ width: '100%', background: '#f8fafb', border: '1px solid #eef0f3', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#0f2a1a', outline: 'none', resize: 'vertical', marginBottom: 12, fontFamily: 'inherit' }} />
              <button onClick={sendMsg} disabled={sending || !message.trim() || !waConnected}
                style={{ padding: '9px 18px', borderRadius: 10, background: sending ? '#9ab5a5' : '#1B6E7E', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending ? 'default' : 'pointer' }}>
                {sending ? 'Жіберілуде...' : `📱 ${activeGroup ? activeGroup.name + '-ке' : 'Барлығына'} (${students.length || stats.students})`}
              </button>
              {sendResult && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: sendResult.success ? '#e8f5f8' : '#fef2f2', border: `1px solid ${sendResult.success ? '#bbf7d0' : '#fecaca'}`, color: sendResult.success ? '#16a34a' : '#dc2626' }}>
                  {sendResult.success ? `✅ ${sendResult.total} адамға жіберіліп жатыр` : `❌ ${sendResult.error}`}
                </div>
              )}
            </div>

            {/* Students */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #eef0f3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#c4cfd4', textTransform: 'uppercase', letterSpacing: '1px' }}>Оқушылар тізімі</p>
                  <p style={{ fontSize: 13, color: '#7a9a8a', marginTop: 4 }}>{activeGroup?.name || 'Топ таңдаңыз'} — {students.length} оқушы</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={downloadTemplate} style={{ padding: '7px 12px', fontSize: 12, background: '#f0f2f4', border: '1px solid #eef0f3', borderRadius: 8, cursor: 'pointer', color: '#7a9a8a' }}>📥 Үлгі</button>
                  <button onClick={() => fileRef.current.click()} disabled={importing || !activeGroup} style={{ padding: '7px 12px', fontSize: 12, background: '#f0f2f4', border: '1px solid #eef0f3', borderRadius: 8, cursor: 'pointer', color: '#7a9a8a' }}>
                    {importing ? '...' : '📊 Excel'}
                  </button>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelImport} />
                  <button onClick={() => setShowAddStudent(true)} disabled={!activeGroup} style={{ padding: '7px 14px', fontSize: 12, background: '#1B6E7E', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>+ Оқушы</button>
                </div>
              </div>

              {importResult && (
                <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: importResult.success ? '#e8f5f8' : '#fef2f2', border: `1px solid ${importResult.success ? '#bbf7d0' : '#fecaca'}`, color: importResult.success ? '#16a34a' : '#dc2626' }}>
                  {importResult.success ? `✅ ${importResult.count} оқушы қосылды` : `❌ ${importResult.error}`}
                </div>
              )}

              {showAddStudent && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: 12, background: '#f8fafb', borderRadius: 12, border: '1px solid #eef0f3' }}>
                  <input placeholder="Аты-жөні" value={newStudent.name} onChange={e => setNewStudent(s => ({ ...s, name: e.target.value }))}
                    style={{ flex: 1, background: '#fff', border: '1px solid #eef0f3', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#0f2a1a', outline: 'none', fontFamily: 'inherit' }} />
                  <input placeholder="+7 707..." value={newStudent.phone} onChange={e => setNewStudent(s => ({ ...s, phone: e.target.value }))}
                    style={{ flex: 1, background: '#fff', border: '1px solid #eef0f3', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#0f2a1a', outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={addStudent} style={{ padding: '0 16px', background: '#1B6E7E', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>Қосу</button>
                  <button onClick={() => setShowAddStudent(false)} style={{ padding: '0 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', cursor: 'pointer' }}>✕</button>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!activeGroup ? (
                  <p style={{ color: '#c4cfd4', fontSize: 13, textAlign: 'center', padding: 32 }}>Сол жақтан топ таңдаңыз</p>
                ) : students.length === 0 ? (
                  <p style={{ color: '#c4cfd4', fontSize: 13, textAlign: 'center', padding: 32 }}>Оқушы жоқ. Excel немесе қолмен қосыңыз</p>
                ) : students.map((s, idx) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: '#f8fafb', border: '1px solid #eef0f3', gap: 12, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e8f5f8'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafb'}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: getAvatarColor(s.name, idx), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: getAvatarText(s.name, idx), flexShrink: 0 }}>
                      {getInitials(s.name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#0f2a1a' }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: '#9ab5a5' }}>{s.phone}</p>
                    </div>
                    <button className="ios btn-d" onClick={() => removeStudent(s.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      )}
      </div>
    </div>
  );
}
