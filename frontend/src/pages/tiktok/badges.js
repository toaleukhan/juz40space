// Айдың жетістіктері — backend (scoring.enrichLeaderboard) береді, мұнда
// тек атауы, түсініктемесі мен түсі.
export const BADGES = [
  { key: 'hit', label: 'Хит-мейкер', desc: 'видеосы 15K-нан асты', color: '#ea580c' },
  { key: 'steady', label: 'Тұрақты', desc: 'барлық жұмыс күні видео салды', color: '#059669' },
  { key: 'team', label: 'Командалық', desc: 'басқа бөліммен бірге түсірді', color: '#2563eb' },
  { key: 'record', label: 'Рекорд', desc: 'айдың ең көп қаралған видеосы', color: '#d97706' },
  { key: 'comeback', label: 'Қайта оралу', desc: 'аптада ең көп орынға көтерілді', color: '#7c3aed' },
];
export const badgeMeta = Object.fromEntries(BADGES.map((b) => [b.key, b]));
