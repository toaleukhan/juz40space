import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Juz40Logo from '../../components/Juz40Logo';

// Медиа кабинетінің жоғарғы панелі: беттің үстінде қалқып тұратын ақ
// «капсула». Солда — JUZ40 белгісі, ортада — қойындылар (белсендісінің
// астында сызық), «Баптаулар» ашылмалы мәзірі, оңда — профиль мәзірі.
// Тар экранда қойындылар бургер-мәзірге жиналады.
export default function TopBar({ tabs, tab, onTab, settings = [] }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const name = user.fullName || user.username || '';
  const [open, setOpen] = useState(null); // 'settings' | 'profile' | 'mobile' | null
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const pick = (fn) => () => { setOpen(null); fn(); };
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="tb-wrap">
      <header className="tb" ref={ref}>
        <button type="button" className="tb__burger" aria-label="Мәзір" aria-expanded={open === 'mobile'} onClick={() => toggle('mobile')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M3 5h14M3 10h10M3 15h14" />
          </svg>
        </button>

        <a className="tb__brand" href="/tiktok" onClick={(e) => { e.preventDefault(); onTab?.('rating'); }} aria-label="JUZ40 Media — басты бет">
          <Juz40Logo height={17} />
          <span>Media</span>
        </a>

        {tabs && (
          <nav className="tb__nav" aria-label="Бөлімдер">
            {tabs.map((t) => (
              <button key={t.key} type="button" aria-current={tab === t.key ? 'page' : undefined}
                className={tab === t.key ? 'is-on' : ''} onClick={() => onTab(t.key)}>
                {t.label}
              </button>
            ))}
            {settings.length > 0 && (
              <div className="tb__dd">
                <button type="button" aria-haspopup="menu" aria-expanded={open === 'settings'} onClick={() => toggle('settings')}>
                  Баптаулар <Chevron />
                </button>
                {open === 'settings' && (
                  <div className="tb__menu" role="menu">
                    {settings.map((s) => (
                      <button key={s.label} type="button" role="menuitem" onClick={pick(s.onClick)}>
                        <b>{s.label}</b>{s.hint && <small>{s.hint}</small>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        )}

        <div className="tb__right">
          <div className="tb__dd">
            <button type="button" className="tb__avatar" aria-haspopup="menu" aria-expanded={open === 'profile'} aria-label="Профиль" onClick={() => toggle('profile')}>
              {(name.trim()[0] || 'M').toUpperCase()}
            </button>
            {open === 'profile' && (
              <div className="tb__menu tb__menu--right" role="menu">
                <div className="tb__me"><b>{name}</b><small>Media team тимлиді</small></div>
                <button type="button" role="menuitem" onClick={logout}><b>Шығу</b></button>
              </div>
            )}
          </div>
        </div>

        {open === 'mobile' && tabs && (
          <div className="tb__sheet" role="menu">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="menuitem" className={tab === t.key ? 'is-on' : ''} onClick={pick(() => onTab(t.key))}>{t.label}</button>
            ))}
            {settings.map((s) => (
              <button key={s.label} type="button" role="menuitem" onClick={pick(s.onClick)}>{s.label}</button>
            ))}
          </div>
        )}
      </header>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
