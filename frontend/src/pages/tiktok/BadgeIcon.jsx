// Бейдж белгілері (24×24, currentColor)
const PATHS = {
  hit: <path fill="currentColor" d="M12 2s6 5 6 11a6 6 0 0 1-12 0c0-3.6 2.8-5.3 2.8-5.3s.4 3 2.7 3C11.5 7 12 2 12 2z" />,
  steady: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M8.5 15l2.2 2.2L15.5 13" /></g>,
  team: <g fill="currentColor"><circle cx="8" cy="8" r="3.5" /><circle cx="16.5" cy="9" r="3" /><path d="M1.5 20c.8-4 3.5-6 6.5-6s5.7 2 6.5 6zM14 14.5c3.2-.6 6.6 1 7.5 5.5h-5.2" /></g>,
  record: <path fill="currentColor" d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" />,
  comeback: <path fill="currentColor" d="M14 3c4-1 7 0 7 0s1 3 0 7c-1 3.5-5 7-5 7l-2 4-3-3-3-3-3-3 4-2s3.5-4 7-5zM15.5 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15c-2 1-3 4-3 6 2 0 5-1 6-3z" />,
};

export default function BadgeIcon({ name, size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{PATHS[name]}</svg>;
}
