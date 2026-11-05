import { useNavigate } from 'react-router-dom';
import juz40Logo from '../../assets/juz40-logo.png';
import { IconLogout } from '../../components/icons';

// TikTok бетінің жоғарғы панелі — сайдбардың орнына. Media тимлидіне тек
// осы бет ашық, сондықтан навигация — беттің өз қойындылары.
export default function TopBar({ tabs, tab, onTab }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const name = user.fullName || user.username || '';

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className="tb">
      <div className="tb__inner">
        <div className="tb__brand">
          <img src={juz40Logo} alt="" width="28" height="28" />
          <span>JUZ40 <b>Media</b></span>
        </div>
        {tabs && (
          <nav className="tb__nav" role="tablist" aria-label="Бөлімдер">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                className={tab === t.key ? 'is-on' : ''} onClick={() => onTab(t.key)}>
                {t.label}
              </button>
            ))}
          </nav>
        )}
        <div className="tb__user">
          <span className="tb__avatar" aria-hidden="true">{(name[0] || 'M').toUpperCase()}</span>
          <span className="tb__name">{name}</span>
          <button type="button" className="tb__logout" onClick={logout} title="Шығу" aria-label="Шығу">
            <IconLogout width={16} height={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
