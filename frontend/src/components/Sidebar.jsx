import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';
import juz40Logo from '../assets/juz40-logo.png';
import { IconMenu, IconClose, IconUser, IconCalendar, IconVideo, IconUsers, IconLogout } from './icons';
import StarField from './StarField';

export const RAIL_WIDTH = 76;
export const RAIL_WIDTH_EXPANDED = 252;

const navStyle = (collapsed) => ({ isActive }) => ({
  display: 'flex', alignItems: 'center', gap: 12,
  padding: collapsed ? '12px' : '11px 16px',
  justifyContent: collapsed ? 'center' : 'flex-start',
  borderRadius: 14,
  color: isActive ? '#fff' : 'var(--text-sub)',
  background: isActive ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
  fontWeight: isActive ? 700 : 500, textDecoration: 'none', fontSize: 13.5,
  border: '1px solid transparent',
  boxShadow: isActive ? '0 4px 14px rgba(16,185,129,0.28)' : 'none',
  transition: 'background 0.2s, color 0.2s',
  whiteSpace: 'nowrap', overflow: 'hidden',
});

function SidebarContent({ collapsed, onNavigate }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isCurator = user.role === 'curator';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const curatorLinks = [
    { to: '/profile', label: 'Менің профилім', Icon: IconUser },
    { to: `/st-recordings?subject=${user.subject || 'ФИЗ'}&stream=${user.streamId || '01'}&month=1&week=1`, label: 'СТ запись', Icon: IconVideo },
    { to: '/schedule', label: 'Сабақ кестесі', Icon: IconCalendar },
  ];
  const adminLinks = [
    { to: '/schedule', label: 'Сабақ кестесі', Icon: IconCalendar },
    { to: '/st-recordings', label: 'СТ жазбалар', Icon: IconVideo },
    { to: '/curators', label: 'Кураторлар базасы', Icon: IconUsers },
  ];
  const links = isCurator ? curatorLinks : adminLinks;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <img src={juz40Logo} alt="JUZ40" style={{ height: 34, width: 34, objectFit: 'contain', flexShrink: 0 }} />
        {!collapsed && (
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>JUZ40</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
              {isCurator ? 'Куратор Кабинеті' : 'Online Education'}
            </div>
          </div>
        )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {!collapsed && (
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', padding: '0 12px 4px', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
            {isCurator ? 'Жеке кабинет' : 'Басқару'}
          </div>
        )}
        {links.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} style={navStyle(collapsed)} onClick={onNavigate} title={collapsed ? label : undefined}>
            <Icon style={{ flexShrink: 0 }} />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 'auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '8px' : '10px 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 8,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: isCurator ? '#8b5cf6' : '#10b981', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, overflow: 'hidden', flexShrink: 0,
          }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (user.fullName || user.username || 'A')[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.fullName || user.username}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {isCurator ? `${user.subject || ''} · ${user.streamId || '01'} ағым` : 'Басқарушы (Admin)'}
              </div>
            </div>
          )}
        </div>

        <button onClick={handleLogout} title={collapsed ? 'Шығу' : undefined} style={{
          width: '100%', padding: '10px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.08)', color: '#dc2626',
          border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s', whiteSpace: 'nowrap', overflow: 'hidden',
        }}>
          <IconLogout style={{ flexShrink: 0 }} /> {!collapsed && 'Шығу'}
        </button>
      </div>
    </>
  );
}

export default function Sidebar() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (!isMobile) {
    const expanded = hovered;
    return (
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: expanded ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH,
          flexShrink: 0, background: 'var(--surface)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', height: '100vh',
          position: 'fixed', top: 0, left: 0, padding: '22px 14px', zIndex: 60,
          overflow: 'hidden', transition: 'width 0.18s ease',
          boxShadow: expanded ? '8px 0 32px rgba(0,0,0,0.14)' : 'none',
        }}>
        <StarField count={16} color="var(--accent)" maxOpacity={0.45} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <SidebarContent collapsed={!expanded} />
        </div>
      </aside>
    );
  }

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 60, height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
        background: 'var(--surface)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={juz40Logo} alt="JUZ40" style={{ height: 26, width: 26, objectFit: 'contain' }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>JUZ40</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Меню"
          style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconMenu />
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <aside style={{
            position: 'relative', width: 'min(82vw, 300px)', height: '100%', background: 'var(--surface-solid, var(--surface))',
            display: 'flex', flexDirection: 'column', padding: '18px 16px', boxShadow: '8px 0 32px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            <StarField count={14} color="var(--accent)" maxOpacity={0.45} />
            <button onClick={() => setOpen(false)} aria-label="Жабу"
              style={{ position: 'relative', zIndex: 1, alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 10 }}>
              <IconClose />
            </button>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <SidebarContent collapsed={false} onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
