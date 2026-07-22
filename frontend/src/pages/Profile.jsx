import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

export default function Profile() {
  const localUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [user, setUser] = useState(localUser);
  const [studentsCount, setStudentsCount] = useState(localUser.studentsCount || '0');
  const [avatarUrl, setAvatarUrl] = useState(localUser.avatarUrl || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMessage] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      setStudentsCount(data.students_count || '0');
      setAvatarUrl(data.avatar_url || '');

      const updated = { ...localUser, ...data, avatarUrl: data.avatar_url, studentsCount: data.students_count };
      localStorage.setItem('user', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { data } = await api.put('/auth/profile', {
        studentsCount,
        avatarUrl,
        password: password.trim() ? password : undefined,
      });

      setUser(data);
      const updated = { ...localUser, ...data, avatarUrl: data.avatar_url, studentsCount: data.students_count };
      localStorage.setItem('user', JSON.stringify(updated));

      setPassword('');
      setMessage('✅ Профиль сәтті жаңартылды!');
    } catch (err) {
      setMessage('❌ Жаңартуда қателік: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            JUZ40 · КУРАТОР КАБИНЕТІ
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', margin: '4px 0 0', letterSpacing: '-0.5px' }}>
            👤 Менің профилім
          </h1>
        </div>

        {msg && (
          <div style={{
            padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontWeight: 700, fontSize: 13,
            background: msg.includes('✅') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: msg.includes('✅') ? '#059669' : '#dc2626',
            border: `1px solid ${msg.includes('✅') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
          }}>
            {msg}
          </div>
        )}

        <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: '#8b5cf6', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 28, overflow: 'hidden',
              boxShadow: '0 6px 16px rgba(139,92,246,0.25)'
            }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (user.full_name || user.username || 'K')[0].toUpperCase()
              )}
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
                {user.full_name || user.username}
              </h2>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.12)', color: '#2563eb', fontWeight: 700, fontSize: 11 }}>
                  Пән: {user.subject || '—'}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.12)', color: '#7c3aed', fontWeight: 700, fontSize: 11 }}>
                  Ағым: {user.subject || 'ПӘН'}-{user.stream_id || '01'}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-sub)', marginBottom: 6 }}>
                👨‍🎓 Оқушыларыңыздың жалпы саны:
              </label>
              <input
                type="number"
                value={studentsCount}
                onChange={e => setStudentsCount(e.target.value)}
                placeholder="Мысалы: 25"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, fontWeight: 700
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-sub)', marginBottom: 6 }}>
                🖼 Профиль фотосының сілтемесі (Avatar URL):
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--surface2)', color: 'var(--text)', fontSize: 13
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-sub)', marginBottom: 6 }}>
                🔑 Жаңа құпия сөз (Парольді ауыстырғыңыз келсе ғана жазыңыз):
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Жаңа пароль енгізіңіз..."
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--surface2)', color: 'var(--text)', fontSize: 13
                }}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 10, padding: '12px 24px', borderRadius: 12, background: 'var(--accent)', color: '#fff',
                border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
              {saving ? 'Сақталуда...' : '💾 Өзгерістерді сақтау'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}