// Минималды сызықты иконкалар (Heroicons стилінде, сыртқы тәуелділіксіз)
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconMenu = (p) => (
  <svg {...base} {...p}><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
);
export const IconClose = (p) => (
  <svg {...base} {...p}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
);
export const IconUsers = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3" /><path d="M3 19c1.1-3 3.4-4.5 6-4.5s4.9 1.5 6 4.5" /><circle cx="17" cy="8.5" r="2.3" /><path d="M15.5 14c2 .2 3.5 1.6 4.3 3.6" /></svg>
);
export const IconUser = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5" /></svg>
);
export const IconChart = (p) => (
  <svg {...base} {...p}><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 15v-3M12 15V9M16 15v-5" /></svg>
);
export const IconCalendar = (p) => (
  <svg {...base} {...p}><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>
);
export const IconVideo = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="7" width="12" height="10" rx="2" /><path d="M15.5 10.5l5-2.7v8.4l-5-2.7" /></svg>
);
export const IconFolder = (p) => (
  <svg {...base} {...p}><path d="M4 7a2 2 0 0 1 2-2h4l2 2.2h6a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" /></svg>
);
export const IconLogout = (p) => (
  <svg {...base} {...p}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="M14 15l4-3-4-3" /><line x1="18" y1="12" x2="9" y2="12" /></svg>
);
export const IconDownload = (p) => (
  <svg {...base} {...p}><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><line x1="4" y1="20" x2="20" y2="20" /></svg>
);
export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconAlert = (p) => (
  <svg {...base} {...p}><path d="M12 3.5L21.5 20h-19z" /><line x1="12" y1="9.5" x2="12" y2="14" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></svg>
);
export const IconLink = (p) => (
  <svg {...base} {...p}><path d="M9.5 14.5l5-5" /><path d="M13 6.5l1-1a3.5 3.5 0 0 1 5 5l-1 1" /><path d="M11 17.5l-1 1a3.5 3.5 0 0 1-5-5l1-1" /></svg>
);
export const IconTable = (p) => (
  <svg {...base} {...p}><rect x="4" y="4.5" width="16" height="15" rx="2" /><line x1="4" y1="9.5" x2="20" y2="9.5" /><line x1="10" y1="4.5" x2="10" y2="19.5" /></svg>
);
// Google Meet белгісі — тек камера пиктограммасы, жазусыз (4 түсті стиль)
export const IconMeetLogo = ({ style, ...p }) => (
  <svg viewBox="0 0 36 36" style={{ width: 16, height: 16, flexShrink: 0, ...style }} {...p}>
    <path fill="#00832d" d="M20.5 11.5v6.7l4.9 3.8V15z" />
    <path fill="#0066da" d="M20.5 24.9H8.6a2 2 0 0 1-2-2V15h13.9z" />
    <path fill="#e94235" d="M6.6 15V9.6a2 2 0 0 1 2-2h11.9v7.4z" />
    <path fill="#2684fc" d="M25.4 12.9l-4.9 3.8v3.2l4.9 3.8a1.1 1.1 0 0 0 1.8-.85V13.75a1.1 1.1 0 0 0-1.8-.85z" />
    <path fill="#ffba00" d="M20.5 18l-13.9 3v3.9a2 2 0 0 0 2 2h11.9z" />
    <path fill="#00ac47" d="M20.5 11.5H6.6v6.5h13.9z" />
  </svg>
);

export const IconSettings = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></svg>
);
export const IconPlus = (p) => (
  <svg {...base} {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const IconRefresh = (p) => (
  <svg {...base} {...p}><path d="M4 12a8 8 0 0 1 14-5.3L21 9" /><path d="M21 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L3 15" /><path d="M3 20v-5h5" /></svg>
);
export const IconBolt = (p) => (
  <svg {...base} {...p} fill="currentColor" stroke="none"><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>
);
export const IconClock = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconWrench = (p) => (
  <svg {...base} {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 4.6L4 16.2V20h3.8l5.3-5.3a4 4 0 0 0 4.6-5.4l-2.8 2.8-2-2z" /></svg>
);
export const IconFile = (p) => (
  <svg {...base} {...p}><path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" /><path d="M14 3.5V8h4" /></svg>
);
export const IconBuilding = (p) => (
  <svg {...base} {...p}><rect x="4" y="3.5" width="10" height="17" rx="1" /><path d="M14 9h6v11.5h-6" /><line x1="7" y1="7" x2="7" y2="7.01" /><line x1="11" y1="7" x2="11" y2="7.01" /><line x1="7" y1="11" x2="7" y2="11.01" /><line x1="11" y1="11" x2="11" y2="11.01" /><line x1="7" y1="15" x2="7" y2="15.01" /><line x1="11" y1="15" x2="11" y2="15.01" /></svg>
);
export const IconXCircle = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><line x1="9.2" y1="9.2" x2="14.8" y2="14.8" /><line x1="14.8" y1="9.2" x2="9.2" y2="14.8" /></svg>
);
export const IconCheckCircle = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.3 12.3l2.6 2.6 4.8-5.4" /></svg>
);
// Статус нүктесі — 🟢🟡🔵🔴 эмодзилерін алмастырады. color: CSS түс мәні.
export const IconDot = ({ color = 'currentColor', style, ...p }) => (
  <svg viewBox="0 0 24 24" width={10} height={10} style={{ flexShrink: 0, ...style }} {...p}>
    <circle cx="12" cy="12" r="9" fill={color} />
  </svg>
);
