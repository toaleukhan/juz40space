// Әр бөлімнің тұрақты түсі (id бойынша) — рейтингте, күнтізбеде,
// бағалауда, видеолар кестесінде бір бөлім әрқашан бір түспен көрінеді.
const PALETTE = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#65a30d', '#c026d3', '#0d9488', '#ea580c', '#4f46e5', '#0284c7', '#be123c'];

export const deptColor = (id) => PALETTE[(((Number(id) || 1) - 1) % PALETTE.length + PALETTE.length) % PALETTE.length];

export function initials(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}
