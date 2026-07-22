// Минималды сызықты иконкалар (Heroicons стилінде, сыртқы тәуелділіксіз)
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconMenu = (p) => (
  <svg {...base} {...p}><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
);
export const IconClose = (p) => (
  <svg {...base} {...p}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
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
export const IconSettings = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></svg>
);
