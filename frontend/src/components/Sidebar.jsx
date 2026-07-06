import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useIsMobile from '../hooks/useIsMobile';
import juz40Logo from '../assets/juz40-logo.png';
import { SUBJECT_COLORS, smartScheduleByMonth, smartAdditionalScheduleByMonth, juniorScheduleByMonth } from '../pages/scheduleData';

const NAV = [
  { id: 'dashboard', label: 'Басты бет',     icon: '⊞', path: '/dashboard',  desc: 'Пәндер & шолу' },
  { id: 'schedule',  label: 'Сабақ кестесі', icon: '📅', path: '/schedule',   desc: 'Апталық кесте' },
];

const SUBJECT_COUNT = Object.keys(SUBJECT_COLORS).length;
const TEACHER_COUNT = (() => {
  const names = new Set();
  const collect = (byMonth) => Object.values(byMonth || {}).forEach(days =>
    (Array.isArray(days) ? days : []).forEach(d =>
      (d.lessons || []).forEach(l => (l.teachers || []).forEach(t => names.add(t.name)))));
  collect(smartScheduleByMonth);
  collect(smartAdditionalScheduleByMonth);
  collect(juniorScheduleByMonth);
  return names.size;
})();

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { curator, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const isActive = (p) => location.pathname === p;
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const go = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {isMobile && (
        <button onClick={() => setMobileOpen(v => !v)} aria-label="Мәзір"
          style={{
            position: 'fixed', top: 14, left: 14, zIndex: 101,
            width: 40, height: 40, borderRadius: 12, border: '1px solid var(--sidebar-border)',
            background: 'var(--sidebar-bg)', backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, cursor: 'pointer', color: 'var(--text)',
          }}>
          {mobileOpen ? '×' : '☰'}
        </button>
      )}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }} />
      )}
      <aside style={{
      width: 220, minHeight: '100vh', height: '100vh',
      background: 'var(--sidebar-bg)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: isMobile ? 'fixed' : 'sticky', top: 0, left: 0, overflowY: 'auto',
      boxShadow: '2px 0 24px rgba(0,0,0,0.06), inset -1px 0 0 rgba(255,255,255,0.5)',
      transition: 'background 0.35s, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      transform: isMobile && !mobileOpen ? 'translateX(-100%)' : 'translateX(0)',
      zIndex: 100,
    }}>
      <style>{`
        /* ── Sidebar nav button ── */
        .sb-btn {
          display: flex; align-items: center; gap: 11px;
          padding: 10px 13px; border-radius: 14px;
          border: 1px solid transparent;
          background: transparent; cursor: pointer;
          width: 100%; text-align: left; font-family: inherit;
          font-size: 13px; color: var(--text-sub); font-weight: 500;
          transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
          margin-bottom: 3px; position: relative;
        }
        .sb-btn:hover {
          background: var(--surface2);
          backdrop-filter: var(--glass-blur-sm);
          -webkit-backdrop-filter: var(--glass-blur-sm);
          border-color: var(--border);
          color: var(--text);
          transform: scale(1.03) translateX(2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .sb-btn.active {
          background: var(--accent-soft);
          backdrop-filter: var(--glass-blur-sm);
          -webkit-backdrop-filter: var(--glass-blur-sm);
          border-color: rgba(27,110,126,0.25);
          color: var(--accent);
          font-weight: 700;
          box-shadow: 0 4px 20px rgba(27,110,126,0.15), inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .sb-icon {
          font-size: 17px; width: 24px; text-align: center;
          flex-shrink: 0; line-height: 1;
        }
        .sb-section-label {
          font-size: 9.5px; font-weight: 800; color: var(--text-muted);
          letter-spacing: 1.4px; text-transform: uppercase;
          padding: 18px 14px 7px; opacity: 0.7;
        }
        .sb-logout {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 13px; border-radius: 12px;
          border: 1px solid transparent; background: transparent;
          cursor: pointer; width: 100%; font-family: inherit;
          font-size: 12.5px; color: var(--text-muted);
          transition: all 0.2s;
        }
        .sb-logout:hover {
          background: rgba(239,68,68,0.10);
          border-color: rgba(239,68,68,0.18);
          color: #dc2626;
          transform: scale(1.02);
        }
        /* Toggle */
        .tog-wrap {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 13px; margin: 0 8px 10px;
          border-radius: 14px;
          background: var(--surface2);
          backdrop-filter: var(--glass-blur-sm);
          -webkit-backdrop-filter: var(--glass-blur-sm);
          border: 1px solid var(--border);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
          cursor: pointer; transition: all 0.2s;
        }
        .tog-wrap:hover { border-color: var(--border2); transform: scale(1.02); }
        .tog-track {
          width: 34px; height: 19px; border-radius: 99px;
          position: relative; transition: background 0.25s; flex-shrink: 0;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.15);
        }
        .tog-thumb {
          position: absolute; top: 2px; width: 15px; height: 15px;
          border-radius: 50%; background: #fff; transition: transform 0.25s;
          box-shadow: 0 1px 5px rgba(0,0,0,0.28);
        }

        /* Divider */
        .sb-divider {
          height: 1px; margin: 6px 12px;
          background: linear-gradient(90deg, transparent, var(--border-dark), transparent);
        }
      `}</style>

      {/* ── Logo ── */}
      <div style={{
        padding: '22px 16px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 11,
        background: 'rgba(255,255,255,0.12)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 11,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-mid))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 14px rgba(27,110,126,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
        }}>
          <img src={juz40Logo} alt="JUZ40" style={{ width: 26, objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.3px' }}>JUZ40</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>Online Education</div>
        </div>
      </div>

      {/* ── Nav ── */}
      <div style={{ flex: 1, padding: '4px 10px' }}>
        <div className="sb-section-label">Бөлімдер</div>
        {NAV.map(item => (
          <button key={item.id}
            className={`sb-btn${isActive(item.path) ? ' active' : ''}`}
            onClick={() => go(item.path)}>
            <span className="sb-icon">{item.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.2 }}>{item.label}</div>
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>{item.desc}</div>
            </div>
            {isActive(item.path) && (
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--accent)', flexShrink: 0,
                boxShadow: '0 0 6px var(--accent)',
              }} />
            )}
          </button>
        ))}

        {/* Stats mini-card (Power BI style) */}
        <div className="sb-divider" style={{ marginTop: 14 }} />
        <div className="sb-section-label">Статистика</div>
        <div style={{
          margin: '0 2px 4px', padding: '12px 14px',
          borderRadius: 16,
          background: 'var(--surface2)',
          backdropFilter: 'var(--glass-blur-sm)',
          WebkitBackdropFilter: 'var(--glass-blur-sm)',
          border: '1px solid var(--border)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Пәндер', val: String(SUBJECT_COUNT) },
              { label: 'Мұғалімдер', val: String(TEACHER_COUNT) },
              { label: 'SMART', val: '●' },
              { label: 'JUNIOR', val: '●' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Theme toggle ── */}
      <div className="tog-wrap" onClick={toggle} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && toggle()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{isDark ? '🌙' : '☀️'}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-sub)' }}>{isDark ? 'Күңгірт' : 'Жарық'}</span>
        </div>
        <div className="tog-track" style={{ background: isDark ? 'var(--accent)' : '#b8d4db' }}>
          <div className="tog-thumb" style={{ transform: isDark ? 'translateX(15px)' : 'translateX(2px)' }} />
        </div>
      </div>

      {/* ── Profile ── */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 10px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 14,
          background: 'var(--surface2)',
          backdropFilter: 'var(--glass-blur-sm)',
          WebkitBackdropFilter: 'var(--glass-blur-sm)',
          border: '1px solid var(--border)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
          marginBottom: 6,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-mid))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(27,110,126,0.3)',
          }}>
            {curator?.name?.charAt(0)?.toUpperCase() || 'А'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {curator?.name || 'Басқарушы'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Басқарушы</div>
          </div>
        </div>
        <button className="sb-logout" onClick={logout}>
          <span style={{ fontSize: 14, width: 22, textAlign: 'center' }}>↩</span>
          <span>Шығу</span>
        </button>
      </div>
    </aside>
    </>
  );
}
