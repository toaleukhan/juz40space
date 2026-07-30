// Куратордың өз аптасының Google Calendar-тәрізді уақыт кестесі: бос
// уақытты басса — жаңа бронь (СТ немесе жеке сөйлесу) жасауға модал ашылады,
// бар броньдар түрлі-түсті блок ретінде көрінеді.
const DAY_LABELS = ['Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі', 'Жексенбі'];
const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_H = 56;

// Ағымдағы нақты аптаның дүйсенбісі — куратордың "1-ай/1-апта" секілді
// абстрактілі жол таңдауына қарамастан, календарь әрдайым нақты бүгінгі
// аптаны көрсетеді (Мит нақты күн-уақытпен жасалады ғой).
export function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// toISOString() әрдайым UTC-ге айналдырады — GMT+5 секілді белдеуде жергілікті
// түн ортасы кешкі уақытта алдыңғы күнге "сырғып" кетеді (мыс. Дүйсенбі
// 07-27 → 07-26 болып шығады). Сондықтан жергілікті жыл/ай/күннен қолмен
// құрастырамыз.
export function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoDateOfDay(monday, dayIndex) {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayIndex);
  return toLocalISODate(d);
}

export function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minutesFromMidnight(timeStr) {
  const [h, m] = String(timeStr).slice(0, 5).split(':').map(Number);
  return h * 60 + (m || 0);
}

export default function WeekBookingCalendar({ monday, bookings, onSlotClick, onBookingClick }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const totalH = (END_HOUR - START_HOUR) * HOUR_H;

  const byDate = {};
  bookings.forEach(b => {
    const key = String(b.scheduled_date).slice(0, 10);
    (byDate[key] ||= []).push(b);
  });

  const handleColumnClick = (e, dayIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromTop = (y / HOUR_H) * 60;
    const maxMin = (END_HOUR - START_HOUR) * 60 - 30;
    const clamped = Math.max(0, Math.min(maxMin, Math.round(minutesFromTop / 5) * 5));
    onSlotClick(isoDateOfDay(monday, dayIndex), START_HOUR * 60 + clamped);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 64 + 7 * 118, display: 'grid', gridTemplateColumns: '64px repeat(7, minmax(118px, 1fr))' }}>
          <div style={{ borderBottom: '1px solid var(--border)' }} />
          {DAY_LABELS.map((label, i) => (
            <div key={label} style={{ padding: '10px 8px', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{isoDateOfDay(monday, i).slice(5)}</div>
            </div>
          ))}

          <div style={{ position: 'relative', height: totalH + HOUR_H / 2 }}>
            {hours.map(h => (
              <div key={h} style={{ position: 'absolute', top: (h - START_HOUR) * HOUR_H - 6, right: 8, fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {DAY_LABELS.map((_, dayIndex) => {
            const dateKey = isoDateOfDay(monday, dayIndex);
            const dayBookings = byDate[dateKey] || [];
            return (
              <div
                key={dayIndex}
                onClick={(e) => handleColumnClick(e, dayIndex)}
                style={{ position: 'relative', height: totalH + HOUR_H / 2, borderLeft: '1px solid var(--border)', cursor: 'pointer' }}
              >
                {hours.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h - START_HOUR) * HOUR_H, left: 0, right: 0, height: 1, background: 'var(--border)', opacity: 0.6 }} />
                ))}
                {dayBookings.map(b => {
                  const startMin = minutesFromMidnight(b.start_time);
                  const endMin = minutesFromMidnight(b.end_time);
                  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_H;
                  const height = Math.max(22, ((endMin - startMin) / 60) * HOUR_H);
                  const isSt = b.meeting_type === 'st';
                  return (
                    <div
                      key={b.id}
                      onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
                      style={{
                        position: 'absolute', top, height, left: 3, right: 3, borderRadius: 8, padding: '4px 6px',
                        background: isSt ? 'var(--accent-soft)' : 'rgba(139,92,246,0.12)',
                        border: `1px solid ${isSt ? 'var(--accent)' : '#8b5cf6'}`,
                        color: isSt ? 'var(--accent)' : '#8b5cf6',
                        fontSize: 10.5, fontWeight: 700, overflow: 'hidden', cursor: 'pointer', lineHeight: 1.3,
                      }}
                    >
                      {isSt ? 'СТ' : 'Жеке'} · {b.start_time.slice(0, 5)}
                      {isSt && b.students_count ? ` · ${b.students_count} оқ.` : ''}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
