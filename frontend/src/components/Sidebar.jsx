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

  return (
    <aside style={{
      width: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100vh', sticky: 'top', position: 'sticky', top: 0, padding: 20
    }}>
      {/* Логотип */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16
        }}>
          Z
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px' }}>JUZ40</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
            {isCurator ? 'Куратор кабинеті' : 'Online Education'}
          </div>
        </div>
      </div>

      {/* Менюлар тізімі */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {isCurator ? (
          /* 👤 КУРАТОРҒА АРНАЛҒАН ТЕК 3 БӨЛІМ */
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', padding: '8px 12px 4px', textTransform: 'uppercase' }}>
              Жеке Кабинет
            </div>

            <NavLink to="/profile" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
              color: isActive ? '#fff' : 'var(--text-sub)', background: isActive ? 'var(--accent)' : 'transparent',
              fontWeight: isActive ? 700 : 600, textDecoration: 'none', fontSize: 13
            })}>
              👤 Менің профилім
            </NavLink>

            <NavLink to={`/st-recordings?subject=${user.subject || 'ФИЗ'}&stream=${user.streamId || '01'}&month=1&week=1`} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
              color: isActive ? '#fff' : 'var(--text-sub)', background: isActive ? 'var(--accent)' : 'transparent',
              fontWeight: isActive ? 700 : 600, textDecoration: 'none', fontSize: 13
            })}>
              📹 СТ запись
            </NavLink>

            <NavLink to="/my-recordings" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
              color: isActive ? '#fff' : 'var(--text-sub)', background: isActive ? 'var(--accent)' : 'transparent',
              fontWeight: isActive ? 700 : 600, textDecoration: 'none', fontSize: 13
            })}>
              📂 Менің записьтерім
            </NavLink>
          </>
        ) : (
          /* 👑 БАСҚАРУШЫҒА (ADMIN) АРНАЛҒАН БАРЛЫҚ МЕНЮЛАР */
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', padding: '8px 12px 4px', textTransform: 'uppercase' }}>
              Бөлімдер
            </div>

            <NavLink to="/dashboard" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
              color: isActive ? '#fff' : 'var(--text-sub)', background: isActive ? 'var(--accent)' : 'transparent',
              fontWeight: isActive ? 700 : 600, textDecoration: 'none', fontSize: 13
            })}>
              📊 Басты бет
            </NavLink>

            <NavLink to="/schedule" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
              color: isActive ? '#fff' : 'var(--text-sub)', background: isActive ? 'var(--accent)' : 'transparent',
              fontWeight: isActive ? 700 : 600, textDecoration: 'none', fontSize: 13
            })}>
              📅 Сабақ кестесі
            </NavLink>

            <NavLink to="/st-recordings" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
              color: isActive ? '#fff' : 'var(--text-sub)', background: isActive ? 'var(--accent)' : 'transparent',
              fontWeight: isActive ? 700 : 600, textDecoration: 'none', fontSize: 13
            })}>
              📹 СТ запись
            </NavLink>
          </>
        )}
      </nav>

      {/* Астындағы Пайдаланушы ақпараты */}
      <div style={{ borderTop: '1px solid var(--border)', pt: 16, paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: isCurator ? '#8b5cf6' : '#10b981', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, overflow: 'hidden'
          }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (user.fullName || user.username || 'A')[0].toUpperCase()
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.fullName || user.username}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {isCurator ? `${user.subject || ''} · ${user.streamId || '01'} ағым` : 'Басқарушы (Admin)'}
            </div>
          </div>
        </div>

        <button onClick={handleLogout} style={{
          width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444',
          border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
          ↳ Шығу
        </button>
      </div>
    </aside>
  );
}