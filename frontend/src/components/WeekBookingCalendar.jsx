// Куратордың өз аптасының Google Calendar-тәрізді уақыт кестесі: бос
// уақытты басса — жаңа бронь (СТ немесе жеке сөйлесу) жасауға модал ашылады,
// бар броньдар түрлі-түсті блок ретінде көрінеді.
import { IconMeetLogo } from './icons';

const DAY_LABELS = ['Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі', 'Жексенбі'];
const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_H = 56;

export function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// "1-ай 1-апта" фильтрінің дүйсенбісі (2026-07-06). Әр апта +7 күн, әр ай
// 4 аптадан тұрады деп есептеледі — осыдан кез келген ай/апта таңдауының
// нақты дүйсенбісін шығарамыз (мыс. 1-ай 4-апта → 27.07, 2-ай 1-апта →
// 03.08, яғни келесі апта).
const FILTER_ANCHOR_MONDAY = new Date(2026, 6, 6);
export function getFilterMonday(monthNum, weekNum) {
  const weekIndex = (monthNum - 1) * 4 + (weekNum - 1);
  const d = new Date(FILTER_ANCHOR_MONDAY);
  d.setDate(d.getDate() + weekIndex * 7);
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

export default function WeekBookingCalendar({ monday, bookings, onSlotClick, onDeleteBooking, readOnly }) {
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
                onClick={readOnly ? undefined : (e) => handleColumnClick(e, dayIndex)}
                style={{ position: 'relative', height: totalH + HOUR_H / 2, borderLeft: '1px solid var(--border)', cursor: readOnly ? 'default' : 'pointer' }}
              >
                {hours.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h - START_HOUR) * HOUR_H, left: 0, right: 0, height: 1, background: 'var(--border)', opacity: 0.6 }} />
                ))}
                {dayBookings.map(b => {
                  const startMin = minutesFromMidnight(b.start_time);
                  const endMin = minutesFromMidnight(b.end_time);
                  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_H;
                  const height = Math.max(24, ((endMin - startMin) / 60) * HOUR_H);
                  const isSt = b.meeting_type === 'st';
                  const primary = isSt ? 'var(--accent)' : '#8b5cf6';
                  const tertiary = isSt ? 'var(--accent-soft)' : 'rgba(139,92,246,0.12)';
                  const compact = height < 58;
                  const tiny = height < 38;
                  return (
                    // Сыртқы <div> — тек орналасу контейнері (absolute top/height).
                    // Нақты басылатын беті — толық <a href> сілтеме: window.open()
                    // емес, нағыз anchor қолданамыз, себебі кейбір браузерлер
                    // JS window.open()-ды popup-блокатормен тоқтата алады, ал
                    // <a target="_blank"> ешқашан бұғатталмайды.
                    <div key={b.id} className="wbc-slot" style={{ position: 'absolute', top, height, left: 3, right: 3 }}>
                      <a
                        className="wbc-block"
                        href={b.meet_link}
                        target="_blank"
                        rel="noreferrer"
                        title="Мит-ке кіру үшін бас"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute', inset: 0, borderRadius: 12,
                          padding: tiny ? '3px 6px' : compact ? '5px 7px' : '7px 9px',
                          background: tertiary, boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3,
                          textDecoration: 'none',
                        }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: tiny ? 9.5 : 10.5, fontWeight: 800, color: primary, lineHeight: 1.25,
                          overflow: 'hidden', whiteSpace: 'nowrap', paddingRight: 16,
                        }}>
                          <IconMeetLogo style={{ width: tiny ? 10 : 12, height: tiny ? 10 : 12, flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.curator_name ? `${b.curator_name} · ` : ''}{isSt ? 'СТ' : 'Жеке сөйлесу'}{isSt && b.students_count ? ` · ${b.students_count} оқ.` : ''}
                          </span>
                        </div>
                        {!tiny && (
                          <span style={{
                            alignSelf: 'flex-start', fontSize: 9, color: '#fff', background: primary,
                            borderRadius: 20, padding: '2px 7px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          }}>
                            {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                          </span>
                        )}
                      </a>
                      {!readOnly && (
                        <button
                          className="wbc-del"
                          title="Броньды өшіру"
                          onClick={(e) => { e.stopPropagation(); onDeleteBooking(b); }}
                          style={{
                            position: 'absolute', top: 3, right: 3, zIndex: 2, width: 16, height: 16, borderRadius: '50%',
                            border: 'none', background: 'rgba(0,0,0,0.14)', color: primary, fontSize: 11, lineHeight: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                          }}
                        >×</button>
                      )}
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
