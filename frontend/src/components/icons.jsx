// Минималды сызықты иконкалар (Heroicons стилінде, сыртқы тәуелділіксіз)
import { useId } from 'react';

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
// Google Meet белгісі — ресми логотип (2026 стилі). Бір бетте бірнеше рет
// қатар шығуы мүмкін болғандықтан, ішкі градиент/маска id-лерін useId()
// арқылы әр data-instance үшін бірегей етеміз (әйтпесе inline SVG-лер бір
// DOM-да болғанда id қақтығысып, түстер бұзылады).
export const IconMeetLogo = ({ style, ...p }) => {
  const uid = useId();
  const gradA = `meet-a${uid}`, gradF = `meet-f${uid}`, gradB = `meet-b${uid}`;
  const filterC = `meet-c${uid}`, maskE = `meet-e${uid}`;
  return (
    <svg viewBox="0 0 192 192" style={{ width: 16, height: 16, flexShrink: 0, ...style }} {...p}>
      <path fill={`url(#${gradA})`} d="M110.015 108.88c-6.829-4.718-6.921-14.778-.179-19.62L165 49.643c7.94-5.701 19-.038 19 9.737v77.755c0 9.675-10.861 15.359-18.821 9.859z" />
      <path fill={`url(#${gradB})`} d="M8 71c0-24.3 19.7-44 44-44h64c11.046 0 20 8.954 20 20v98c0 11.046-8.954 20-20 20H28c-11.046 0-20-8.954-20-20z" />
      <mask id={maskE} width="129" height="138" x="8" y="27" maskUnits="userSpaceOnUse" style={{ maskType: 'luminance' }}>
        <path fill="#fff" d="M8 71c0-24.3 19.7-44 44-44h64c11.046 0 20 8.954 20 20v98c0 11.046-8.954 20-20 20H28c-11.046 0-20-8.954-20-20z" />
      </mask>
      <g filter={`url(#${filterC})`} mask={`url(#${maskE})`}>
        <path fill={`url(#${gradF})`} d="m73.906 99.198 110-63.198v124z" />
      </g>
      <circle cx="38" cy="135" r="14" fill="#fff" />
      <defs>
        <linearGradient id={gradA} x1="128.8" x2="227.2" y1="104.44" y2="104.44" gradientUnits="userSpaceOnUse"><stop stopColor="#f6a100" /><stop offset="1" stopColor="#ffbe00" /></linearGradient>
        <linearGradient id={gradF} x1="136.22" x2="78.5" y1="91.32" y2="91.19" gradientUnits="userSpaceOnUse"><stop offset=".15" stopColor="#ffb5e8" /><stop offset="1" stopColor="#ffdbf5" stopOpacity="0" /></linearGradient>
        <radialGradient id={gradB} cx="0" cy="0" r="1" gradientTransform="matrix(-159.725 0 0 -135.852 160.325 96)" gradientUnits="userSpaceOnUse"><stop offset=".15" stopColor="#ffe921" /><stop offset="1" stopColor="#fec700" /></radialGradient>
        <filter id={filterC} width="166" height="180" x="45.91" y="8" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur result="effect1_foregroundBlur_37584_9338" stdDeviation="14" />
        </filter>
      </defs>
    </svg>
  );
};

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
