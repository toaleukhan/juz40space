// TikTok бетінің таза көмекшілері (сынақпен тексеріледі).

export const MONTHS_KK = ['Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым', 'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан'];
export const WEEKDAYS_SHORT = ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'];

export function monthLabel(month) {
  const [y, m] = String(month).split('-').map(Number);
  return `${MONTHS_KK[m - 1]} ${y}`;
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Алматы уақытымен ағымдағы ай
export function currentMonth(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit' }).format(now).slice(0, 7);
}

export function daysOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => {
    const iso = `${month}-${String(i + 1).padStart(2, '0')}`;
    const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return { iso, day: i + 1, weekday: wd, weekend: wd === 0 || wd === 6 };
  });
}

// { [departmentId]: { [YYYY-MM-DD]: {count, views} } }
export function postingMatrix(videos) {
  const out = {};
  for (const v of videos) {
    const row = (out[v.departmentId] ||= {});
    const cell = (row[v.postDay] ||= { count: 0, views: 0 });
    cell.count += 1;
    cell.views += v.views || 0;
  }
  return out;
}

const nf = new Intl.NumberFormat('ru-RU');
export const fmtInt = (n) => nf.format(Math.round(n || 0));

// 1234 → 1,2K; 15300 → 15K; 1200000 → 1,2M
export function fmtCompact(n) {
  const x = Number(n) || 0;
  if (x >= 1e6) return `${(x / 1e6).toFixed(x >= 1e7 ? 0 : 1).replace('.', ',').replace(',0', '')}M`;
  if (x >= 1e4) return `${Math.round(x / 1e3)}K`;
  if (x >= 1e3) return `${(x / 1e3).toFixed(1).replace('.', ',').replace(',0', '')}K`;
  return String(Math.round(x));
}

export const fmtPct = (x) => `${Math.round((x || 0) * 100)}%`;

export function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function sumBy(list, key) {
  return list.reduce((a, x) => a + (Number(x[key]) || 0), 0);
}

// Жюри енгізуі: '' → null, «7,5» → 7.5
export function parseScore(raw) {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
