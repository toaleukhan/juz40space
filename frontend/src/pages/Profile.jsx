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

  const glassCard = {
    background: 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.7)',
    boxShadow: '0 10px 40px 0 rgba(31, 38, 135, 0.06)',
    borderRadius: 24,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg, #f0fdf4)', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '40px 48px', maxWidth: 840, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2px', color: '#64748b', textTransform: 'uppercase' }}>
            JUZ40 · КУРАТОР КАБИНЕТІ
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: '4px 0 0', letterSpacing: '-0.5px' }}>
            👤 Менің профилім
          </h1>
        </div>

        {msg && (
          <div style={{
            padding: '14px 18px', borderRadius: 16, marginBottom: 24, fontWeight: 700, fontSize: 13.5,
            background: msg.includes('✅') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: msg.includes('✅') ? '#047857' : '#b91c1c',
            border: `1px solid ${msg.includes('✅') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            backdropFilter: 'blur(10px)'
          }}>
            {msg}
          </div>
        )}

        <div style={{ ...glassCard, padding: 36 }}>
          {/* iOS Profile Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, paddingBottom: 28, borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
            <div style={{
              width: 90, height: 90, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 32, overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(139,92,246,0.3)', border: '3px solid #fff'
            }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (user.full_name || user.username || 'K')[0].toUpperCase()
              )}
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                {user.full_name || user.username}
              </h2>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '6px 14px', borderRadius: 12, background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', fontWeight: 800, fontSize: 12, border: '1px solid rgba(59,130,246,0.2)' }}>
                  Пән: {user.subject || '—'}
                </span>
                <span style={{ padding: '6px 14px', borderRadius: 12, background: 'rgba(139,92,246,0.12)', color: '#6d28d9', fontWeight: 800, fontSize: 12, border: '1px solid rgba(139,92,246,0.2)' }}>
                  Ағым: {user.subject || 'ПӘН'}-{user.stream_id || '01'}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 28 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 8 }}>
                👨‍🎓 Оқушыларыңыздың жалпы саны:
              </label>
              <input
                type="number"
                value={studentsCount}
                onChange={e => setStudentsCount(e.target.value)}
                placeholder="Мысалы: 25"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 14, border: '1px solid rgba(203,213,225,0.8)',
                  background: 'rgba(255,255,255,0.7)', color: '#0f172a', fontSize: 14, fontWeight: 700, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 8 }}>
                🖼 Профиль фотосының сілтемесі (Avatar URL):
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 14, border: '1px solid rgba(203,213,225,0.8)',
                  background: 'rgba(255,255,255,0.7)', color: '#0f172a', fontSize: 13, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize 12.5, fontWeight: 800, color: '#475569', marginBottom: 8 }}>
                🔑 Жаңа құпия сөз (Парольді ауыстырғыңыз келсе ғана жазыңыз):
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Жаңа пароль енгізіңіз..."
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 14, border: '1px solid rgba(203,213,225,0.8)',
                  background: 'rgba(255,255,255,0.7)', color: '#0f172a', fontSize: 13, outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 12, padding: '14px 28px', borderRadius: 16,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff',
                border: 'none', fontWeight: 800, fontSize: 14.5, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(16,185,129,0.3)', transition: '0.2s'
              }}>
              {saving ? 'Сақталуда...' : '💾 Өзгерістерді сақтау'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}