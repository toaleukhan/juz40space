// Жауап нұсқаларының пішіндері (мағыналары answerMeta.js-те).
export function ShapeIcon({ index, size = 26 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, focusable: 'false' };
  switch (index) {
    case 0: return <svg {...common}><polygon points="12,3 22.5,21 1.5,21" /></svg>;
    case 1: return <svg {...common}><polygon points="12,1.5 22.5,12 12,22.5 1.5,12" /></svg>;
    case 2: return <svg {...common}><circle cx="12" cy="12" r="10" /></svg>;
    default: return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2.5" /></svg>;
  }
}

// Lucide «flame» — серияның белгісі (эмодзи емес, түсі мәтінге ілеседі).
export function FlameIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

export function CheckIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 12.500l5 5L20 6.500" />
    </svg>
  );
}

export function CrossIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ClockIcon({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6.500V12l3.500 2" />
    </svg>
  );
}
