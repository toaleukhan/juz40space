import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';
import juz40Logo from '../assets/juz40-logo.png';
import { IconMenu, IconClose, IconUser, IconCalendar, IconVideo, IconUsers, IconLogout, IconChart } from './icons';

export const RAIL_WIDTH = 68;
export const RAIL_WIDTH_EXPANDED = 236;

// Hover/active күйлерін inline style жаза алмайды, сондықтан осы шағын
// парақша. Белсенді сілтеме — қанық градиент емес, жай ғана баса көрсететін
// жұмсақ фон: көз шаршатпайды әрі қай бетте тұрғаныңыз бірден оқылады.
const SIDEBAR_CSS = `
  .sb-link {
    display: flex; align-items: center; gap: 11px;
    border-radius: 10px; text-decoration: none;
    font-size: 13.5px; font-weight: 500; line-height: 1;
    color: var(--text-sub); background: transparent;
    white-space: nowrap; overflow: hidden;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .sb-link:hover { background: var(--surface2); color: var(--text); }
  .sb-link.is-active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  .sb-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .sb-logout {
    display: flex; align-items: center; gap: 11px;
    width: 100%; border: none; background: transparent; cursor: pointer;
    border-radius: 10px; font-family: inherit;
    font-size: 13px; font-weight: 500; color: var(--text-muted);
    white-space: nowrap; overflow: hidden;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .sb-logout:hover { background: rgba(239,68,68,0.10); color: #dc2626; }
  .sb-logout:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .sb-icon-btn {
    display: flex; align-items: center; justify-content: center;
    border-radius: 9px; border: 1px solid var(--border);
    background: var(--surface2); color: var(--text-sub); cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .sb-icon-btn:hover { background: var(--surface); color: var(--text); }
`;

function SidebarContent({ collapsed, onNavigate }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isCurator = user.role === 'curator';
  const isCoordinator = user.role === 'coordinator';
  const isTeacher = user.role === 'teacher';

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
  const coordinatorLinks = [
    { to: '/profile', label: 'Менің профилім', Icon: IconUser },
    { to: `/st-recordings?subject=${user.subject || 'ФИЗ'}&stream=${user.streamId || '01'}&month=1&week=1`, label: 'СТ жазбалар', Icon: IconVideo },
    { to: '/schedule', label: 'Сабақ кестесі', Icon: IconCalendar },
  ];
  const adminLinks = [
    { to: '/schedule', label: 'Сабақ кестесі', Icon: IconCalendar },
    { to: '/st-recordings', label: 'СТ жазбалар', Icon: IconVideo },
    { to: '/curators', label: 'Кураторлар базасы', Icon: IconUsers },
    { to: '/dashboard', label: 'Дэшборд', Icon: IconChart },
  ];
  // Мұғалім — сабақ беретін адам, СТ жүйесіне қатысы жоқ: оған тек өз
  // апталық кестесі көрінеді.
  const teacherLinks = [
    { to: '/my-schedule', label: 'Менің кестем', Icon: IconCalendar },
  ];
  const links = isCurator ? curatorLinks
    : isCoordinator ? coordinatorLinks
    : isTeacher ? teacherLinks
    : adminLinks;

  const roleLine = isTeacher ? 'Мұғалім'
    : isCurator ? 'Куратор'
    : isCoordinator ? 'Координатор'
    : 'Басқарушы';

  const rowPad = collapsed ? { padding: '11px 0', justifyContent: 'center' } : { padding: '10px 12px' };

  return (
    <>
      <style>{SIDEBAR_CSS}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 30, marginBottom: 22,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <img src={juz40Logo} alt="JUZ40" style={{ height: 26, width: 26, objectFit: 'contain', flexShrink: 0 }} />
        {!collapsed && (
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
            JUZ40
          </span>
        )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) => (isActive ? 'sb-link is-active' : 'sb-link')}
            style={rowPad}
          >
            <Icon style={{ flexShrink: 0, width: 17, height: 17 }} />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 11, marginBottom: 4,
          padding: collapsed ? '8px 0' : '8px 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: 'var(--accent-soft)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12,
          }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (user.fullName || user.username || 'A')[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.fullName || user.username}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {roleLine}
              </div>
            </div>
          )}
        </div>

        <button onClick={handleLogout} className="sb-logout" title={collapsed ? 'Шығу' : undefined} style={rowPad}>
          <IconLogout style={{ flexShrink: 0, width: 17, height: 17 }} /> {!collapsed && 'Шығу'}
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
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', height: '100vh',
          position: 'fixed', top: 0, left: 0, padding: '20px 12px', zIndex: 60,
          overflow: 'hidden', transition: 'width 0.18s ease, box-shadow 0.18s ease',
          boxShadow: expanded ? '1px 0 24px rgba(0,0,0,0.06)' : 'none',
        }}>
        <SidebarContent collapsed={!expanded} />
      </aside>
    );
  }

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 60, height: 54, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
        background: 'var(--header-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <style>{SIDEBAR_CSS}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src={juz40Logo} alt="JUZ40" style={{ height: 24, width: 24, objectFit: 'contain' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>JUZ40</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Меню" className="sb-icon-btn" style={{ width: 36, height: 36 }}>
          <IconMenu />
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
          <aside style={{
            position: 'relative', width: 'min(80vw, 272px)', height: '100%',
            background: 'var(--surface-solid, var(--surface))',
            display: 'flex', flexDirection: 'column', padding: '16px 14px',
            boxShadow: '1px 0 32px rgba(0,0,0,0.16)', overflow: 'hidden',
          }}>
            <button onClick={() => setOpen(false)} aria-label="Жабу" className="sb-icon-btn"
              style={{ alignSelf: 'flex-end', width: 30, height: 30, marginBottom: 8 }}>
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
