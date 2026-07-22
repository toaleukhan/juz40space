import { NavLink, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isCurator = user.role === 'curator';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const glassStyle = {
    background: 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRight: '1px solid rgba(255, 255, 255, 0.6)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)',
  };

  return (
    <aside style={{
      width: 250, ...glassStyle,
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, padding: '24px 20px', zIndex: 50
    }}>
      {/* iOS Glass Logo Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 14,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 18, boxShadow: '0 4px 14px rgba(16,185,129,0.35)'
        }}>
          Z
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>JUZ40</div>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {isCurator ? 'Куратор Кабинеті' : 'Online Education'}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {isCurator ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', padding: '0 12px 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Жеке Кабинет
            </div>

            <NavLink to="/profile" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14,
              color: isActive ? '#fff' : '#475569',
              background: isActive ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.4)',
              fontWeight: isActive ? 800 : 600, textDecoration: 'none', fontSize: 13.5,
              backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: isActive ? '0 4px 14px rgba(16,185,129,0.25)' : 'none', transition: 'all 0.2s ease'
            })}>
              👤 Менің профилім
            </NavLink>

            <NavLink to={`/st-recordings?subject=${user.subject || 'ФИЗ'}&stream=${user.streamId || '01'}&month=1&week=1`} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14,
              color: isActive ? '#fff' : '#475569',
              background: isActive ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.4)',
              fontWeight: isActive ? 800 : 600, textDecoration: 'none', fontSize: 13.5,
              backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: isActive ? '0 4px 14px rgba(16,185,129,0.25)' : 'none', transition: 'all 0.2s ease'
            })}>
              📹 СТ запись
            </NavLink>

            <NavLink to="/my-recordings" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14,
              color: isActive ? '#fff' : '#475569',
              background: isActive ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.4)',
              fontWeight: isActive ? 800 : 600, textDecoration: 'none', fontSize: 13.5,
              backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: isActive ? '0 4px 14px rgba(16,185,129,0.25)' : 'none', transition: 'all 0.2s ease'
            })}>
              📂 Менің записьтерім
            </NavLink>
          </>
        ) : (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', padding: '0 12px 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Басқару
            </div>

            <NavLink to="/dashboard" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14,
              color: isActive ? '#fff' : '#475569',
              background: isActive ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.4)',
              fontWeight: isActive ? 800 : 600, textDecoration: 'none', fontSize: 13.5,
              backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: isActive ? '0 4px 14px rgba(16,185,129,0.25)' : 'none', transition: 'all 0.2s ease'
            })}>
              📊 Басты бет
            </NavLink>

            <NavLink to="/schedule" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14,
              color: isActive ? '#fff' : '#475569',
              background: isActive ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.4)',
              fontWeight: isActive ? 800 : 600, textDecoration: 'none', fontSize: 13.5,
              backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: isActive ? '0 4px 14px rgba(16,185,129,0.25)' : 'none', transition: 'all 0.2s ease'
            })}>
              📅 Сабақ кестесі
            </NavLink>

            <NavLink to="/st-recordings" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14,
              color: isActive ? '#fff' : '#475569',
              background: isActive ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.4)',
              fontWeight: isActive ? 800 : 600, textDecoration: 'none', fontSize: 13.5,
              backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: isActive ? '0 4px 14px rgba(16,185,129,0.25)' : 'none', transition: 'all 0.2s ease'
            })}>
              📹 СТ запись
            </NavLink>
          </>
        )}
      </nav>

      {/* User Info iOS Glass Pill */}
      <div style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.6)', paddingTop: 16, marginTop: 'auto'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14,
          background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)', marginBottom: 10
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: isCurator ? '#8b5cf6' : '#10b981', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (user.fullName || user.username || 'A')[0].toUpperCase()
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.fullName || user.username}
            </div>
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
              {isCurator ? `${user.subject || ''} · ${user.streamId || '01'} ағым` : 'Басқарушы (Admin)'}
            </div>
          </div>
        </div>

        <button onClick={handleLogout} style={{
          width: '100%', padding: '10px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626',
          border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 800, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: '0.2s'
        }}>
          ↳ Шығу
        </button>
      </div>
    </aside>
  );
}