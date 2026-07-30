import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';
import juz40Logo from '../assets/juz40-logo.png';
import { IconMenu, IconClose, IconUser, IconCalendar, IconVideo, IconUsers, IconLogout, IconChart } from './icons';

export const RAIL_WIDTH = 76;
export const RAIL_WIDTH_EXPANDED = 252;

const navStyle = (collapsed) => ({ isActive }) => ({
  display: 'flex', alignItems: 'center', gap: 12,
  padding: collapsed ? '12px' : '10px 14px',
  justifyContent: collapsed ? 'center' : 'flex-start',
  borderRadius: 10,
  color: isActive ? 'var(--accent)' : 'var(--text-sub)',
  background: isActive ? 'var(--accent-soft)' : 'transparent',
  fontWeight: isActive ? 700 : 500, textDecoration: 'none', fontSize: 13.5,
  border: '1px solid transparent',
  transition: 'background 0.15s, color 0.15s',
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
    { to: '/dashboard', label: 'Дэшборд', Icon: IconChart },
  ];
  const links = isCurator ? curatorLinks : adminLinks;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 30, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <img src={juz40Logo} alt="JUZ40" style={{ height: 34, width: 34, borderRadius: 9, objectFit: 'contain', flexShrink: 0 }} />
        {!collapsed && (
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div className="font-display" style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>JUZ40 Space</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>
              {isCurator ? 'Куратор кабинеті' : 'Басқару'}
            </div>
          </div>
        )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {!collapsed && (
          <div className="eyebrow" style={{ padding: '0 12px 8px', whiteSpace: 'nowrap' }}>
            {isCurator ? 'Жеке кабинет' : 'Навигация'}
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
          display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '8px' : '9px 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 8,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: isCurator ? 'var(--gold)' : 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, overflow: 'hidden', flexShrink: 0,
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
          width: '100%', padding: '9px', borderRadius: 9, background: 'var(--danger-soft)', color: 'var(--danger)',
          border: '1px solid transparent', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s', whiteSpace: 'nowrap', overflow: 'hidden',
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
          flexShrink: 0, background: 'var(--sidebar-bg)',
          backdropFilter: 'var(--glass-blur-sm)', WebkitBackdropFilter: 'var(--glass-blur-sm)',
          borderRight: '1px solid var(--sidebar-border)',
          display: 'flex', flexDirection: 'column', height: '100vh',
          position: 'fixed', top: 0, left: 0, padding: '20px 14px', zIndex: 60,
          overflow: 'hidden', transition: 'width 0.18s ease',
          boxShadow: expanded ? '10px 0 28px rgba(0,0,0,0.10)' : 'none',
        }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        background: 'var(--header-bg)', backdropFilter: 'var(--glass-blur-sm)', WebkitBackdropFilter: 'var(--glass-blur-sm)',
        borderBottom: '1px solid var(--sidebar-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src={juz40Logo} alt="JUZ40" style={{ height: 26, width: 26, borderRadius: 7, objectFit: 'contain' }} />
          <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>JUZ40 Space</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Меню"
          style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconMenu />
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <aside style={{
            position: 'relative', width: 'min(82vw, 300px)', height: '100%', background: 'var(--surface-solid)',
            display: 'flex', flexDirection: 'column', padding: '18px 16px', boxShadow: '8px 0 32px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            <button onClick={() => setOpen(false)} aria-label="Жабу"
              style={{ alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 10 }}>
              <IconClose />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <SidebarContent collapsed={false} onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
