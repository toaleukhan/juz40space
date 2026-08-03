// Куратордың өз аптасының Google Calendar-тәрізді уақыт кестесі: бос
// уақытты басса — жаңа бронь (СТ немесе жеке сөйлесу) жасауға модал ашылады,
// бар броньдар түрлі-түсті блок ретінде көрінеді.
import { IconMeetLogo, IconUsers } from './icons';

// СТ аптасы бейсенбіден басталып, келесі сәрсенбіде бітеді — сондықтан
// бағандар да сол реттен басталады (төмендегі FILTER_WEEK_START_OFFSET-ті
// қараңыз).
const DAY_LABELS = ['Бейсенбі', 'Жұма', 'Сенбі', 'Жексенбі', 'Дүйсенбі', 'Сейсенбі', 'Сәрсенбі'];
const START_HOUR = 8;
const END_HOUR = 22;
// 56px-те 60 минуттық бронь дәл "compact" шегінің астында қалып,
// координатор badge-індегі қатысушылар саны сыймай қалатын — сағат
// биіктігін ұлғайтып, қалыпты (60 мин) бронь толық ("compact" емес)
// күйде, барлық ақпаратымен көрінетіндей еттік.
const HOUR_H = 80;

export function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// СТ аптасы дүйсенбіден емес, БЕЙСЕНБІДЕН басталып, келесі сәрсенбіде
// бітеді. Себебі СТ негізінен дүйсенбі-сәрсенбі аралығында алынады, ал
// сол үш күн аптаның СОҢЫНДА тұруы керек: әйтпесе дүйсенбіде тапсырылған
// СТ келесі аптаға түсіп кетеді.
//
// Сапа бөлімінің "SMART | СТ ЗАПИСЬ" кестесімен тексерілген екі нүкте:
//   1-ай 3-апта → 23.07 (бс) – 29.07 (ср), ішінде СТ күні 27.07
//   1-ай 4-апта → 30.07 (бс) – 05.08 (ср), ішінде СТ күні 03.08
//
// FILTER_ANCHOR_MONDAY — "1-ай 1-апта"-ның дүйсенбісі; аптаның нақты
// басталуы содан үш күн кейін (бейсенбі).
const FILTER_ANCHOR_MONDAY = new Date(2026, 6, 6);
const FILTER_WEEK_START_OFFSET = 3; // дүйсенбі → бейсенбі

export function getFilterWeekStart(monthNum, weekNum) {
  const weekIndex = (monthNum - 1) * 4 + (weekNum - 1);
  const d = new Date(FILTER_ANCHOR_MONDAY);
  d.setDate(d.getDate() + weekIndex * 7 + FILTER_WEEK_START_OFFSET);
  return d;
}

// getFilterWeekStart-тың кері амалы: бүгінгі күн қай ай/аптаға түсетінін
// табады. Куратор сілтемені басқанда дәл сол аптаға түсуі керек — әйтпесе
// әдепкі 1-ай/1-апта болып қалады да, бүгін ашылған Мит бір айдан ертерек
// тұрған аптаға тіркеліп, кейін ешкім таба алмайды.
export function getCurrentFilter(today = new Date(), maxMonths = 12) {
  const first = new Date(FILTER_ANCHOR_MONDAY);
  first.setDate(first.getDate() + FILTER_WEEK_START_OFFSET);
  first.setHours(0, 0, 0, 0);

  const d = new Date(today);
  d.setHours(0, 0, 0, 0);

  const weekIndex = Math.floor((d - first) / (7 * 24 * 60 * 60 * 1000));
  // Оқу жылы басталмай тұрып (немесе жоспардан асып кеткенде) шектен
  // шықпаймыз — фильтр әрқашан бар аптаны көрсетуі керек.
  const clamped = Math.max(0, Math.min(weekIndex, maxMonths * 4 - 1));
  return {
    monthNum: Math.floor(clamped / 4) + 1,
    weekNum: (clamped % 4) + 1,
  };
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

export function isoDateOfDay(weekStart, dayIndex) {
  const d = new Date(weekStart);
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

// Бір күнде бір уақытта бірнеше бронь болуы мүмкін (координатордың
// аггрегат-календарында — әр түрлі кураторлар) — Schedule.jsx-тегі
// CalendarView-дың layout() алгоритмімен бірдей: қиылысатын броньдарды
// қатар тұратын бағандарға бөледі, әйтпесе бәрі бір-бірінің үстіне
// түсіп, оқылмай қалады.
export function layoutDayBookings(dayBookings) {
  const withMin = dayBookings.map(b => ({
    ...b,
    _startMin: minutesFromMidnight(b.start_time),
    _endMin: minutesFromMidnight(b.end_time),
  }));
  const sorted = [...withMin].sort((a, b) => a._startMin - b._startMin || b._endMin - a._endMin);
  const cols = [];
  const result = [];
  sorted.forEach(b => {
    let ci = 0;
    while (cols[ci] && cols[ci].some(c => c._startMin < b._endMin && c._endMin > b._startMin)) ci++;
    if (!cols[ci]) cols[ci] = [];
    cols[ci].push(b);
    result.push({ ...b, _ci: ci });
  });
  const totalCols = cols.length || 1;
  return result.map(b => ({ ...b, _cf: b._ci / totalCols, _wf: 1 / totalCols }));
}

// Броньның scheduled_date/start_time/end_time-ін ағымдағы уақытпен
// салыстырып, liveStatus (Google Meet API-дан келген {live, participantCount})
// болмаса да "Жоспарда/Аяқталды" деп шамалап көрсетеді.
function resolveMeetBadge(booking, liveStatus) {
  const status = liveStatus?.[booking.meet_code];
  const now = Date.now();
  const start = new Date(`${String(booking.scheduled_date).slice(0, 10)}T${booking.start_time}`).getTime();
  const end = new Date(`${String(booking.scheduled_date).slice(0, 10)}T${booking.end_time}`).getTime();

  if (status?.live) {
    return {
      label: `Жүріп жатыр · ${status.participantCount ?? 0} адам${status.recording ? ' · ЖАЗЫЛУДА' : ''}`,
      color: '#10b981', pulse: true, recording: !!status.recording,
    };
  }
  if (now > end) return { label: 'Аяқталды', color: 'var(--text-muted)', pulse: false };
  if (now >= start) return { label: 'Әлі кірмеді', color: '#d97706', pulse: false };
  return null;
}

export default function WeekBookingCalendar({ weekStart, bookings, onSlotClick, onDeleteBooking, readOnly, liveStatus, onOpenJournal }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const totalH = (END_HOUR - START_HOUR) * HOUR_H;

  const byDate = {};
  bookings.forEach(b => {
    const key = String(b.scheduled_date).slice(0, 10);
    (byDate[key] ||= []).push(b);
  });

  // Күн бағанының ені: әдепкіде DAY_MIN_W, бірақ сол күнде қатар тұратын
  // (уақыты қиылысатын) броньдар көбейген сайын кеңейеді — Schedule.jsx-тегі
  // мұғалімдер кестесіндегідей: әр карточка әрқашан ЫҢҒАЙЛЫ, оқуға жеткілікті
  // ені сақтайды (тарылтып, майдалап жібермейміз), керек болса бүкіл
  // календарь жанына қарай айналдырылады — картаны сығып, ақпаратты
  // жасырғаннан гөрі, скролл жасаған әлдеқайда "аккуратно" көрінеді.
  const EVENT_COL_W = 130;
  const DAY_MIN_W = 130;
  const dayLayouts = DAY_LABELS.map((_, dayIndex) => layoutDayBookings(byDate[isoDateOfDay(weekStart, dayIndex)] || []));
  const dayWidths = dayLayouts.map(laid => {
    const maxCols = laid.reduce((m, b) => Math.max(m, Math.round(1 / b._wf)), 1);
    return Math.max(DAY_MIN_W, maxCols * EVENT_COL_W);
  });
  const totalDayWidth = dayWidths.reduce((s, w) => s + w, 0);
  const gridTemplate = `64px ${dayWidths.map(w => `${w}px`).join(' ')}`;

  const handleColumnClick = (e, dayIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromTop = (y / HOUR_H) * 60;
    const maxMin = (END_HOUR - START_HOUR) * 60 - 30;
    const clamped = Math.max(0, Math.min(maxMin, Math.round(minutesFromTop / 5) * 5));
    onSlotClick(isoDateOfDay(weekStart, dayIndex), START_HOUR * 60 + clamped);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 64 + totalDayWidth, display: 'grid', gridTemplateColumns: gridTemplate }}>
          <div style={{ borderBottom: '1px solid var(--border)' }} />
          {DAY_LABELS.map((label, i) => (
            <div key={label} style={{ padding: '10px 8px', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{isoDateOfDay(weekStart, i).slice(5)}</div>
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
            const dayBookings = dayLayouts[dayIndex];
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
                  const top = ((b._startMin - START_HOUR * 60) / 60) * HOUR_H;
                  const height = Math.max(24, ((b._endMin - b._startMin) / 60) * HOUR_H);
                  const isSt = b.meeting_type === 'st';
                  const primary = isSt ? 'var(--accent)' : '#8b5cf6';
                  const tertiary = isSt ? 'var(--accent-soft)' : 'rgba(139,92,246,0.12)';
                  const compact = height < 58;
                  const tiny = height < 38;
                  return (
                    // Сыртқы <div> — тек орналасу контейнері (absolute top/height,
                    // қиылысатын броньдар үшін cf/wf бойынша баған да осында).
                    // Нақты басылатын беті — толық <a href> сілтеме: window.open()
                    // емес, нағыз anchor қолданамыз, себебі кейбір браузерлер
                    // JS window.open()-ды popup-блокатормен тоқтата алады, ал
                    // <a target="_blank"> ешқашан бұғатталмайды.
                    <div key={b.id} className="wbc-slot" style={{
                      position: 'absolute', top, height,
                      left: `calc(${b._cf * 100}% + 3px)`,
                      width: `calc(${b._wf * 100}% - 6px)`,
                    }}>
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
                        {(() => {
                          const badge = readOnly && liveStatus ? resolveMeetBadge(b, liveStatus) : null;
                          return (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              fontSize: tiny ? 9.5 : 11, fontWeight: 800, color: primary, lineHeight: 1.25,
                              overflow: 'hidden', whiteSpace: 'nowrap', paddingRight: 16,
                            }}>
                              <IconMeetLogo style={{ width: tiny ? 10 : 12, height: tiny ? 10 : 12, flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isSt ? 'СТ' : 'Жеке сөйлесу'}{isSt && b.students_count ? ` · ${b.students_count} оқ.` : ''}
                              </span>
                              {/* Тар карточкада есімге орын қалмаса да, куратордың
                                  атын жоғалтпау үшін статус — түсті нүкте ретінде
                                  осында, тақырып жанында қалады (hover-де толық
                                  жазуы title атрибутынан көрінеді). */}
                              {badge && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                                  {badge.recording && (
                                    <span
                                      className="wbc-live-dot"
                                      title="Жазылып жатыр"
                                      style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }}
                                    />
                                  )}
                                  <span
                                    className={badge.pulse ? 'wbc-live-dot' : undefined}
                                    title={badge.label}
                                    style={{ width: 6, height: 6, borderRadius: '50%', background: badge.color, flexShrink: 0 }}
                                  />
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {!tiny && b.curator_name && (
                          <div style={{
                            fontSize: 9.5, fontWeight: 600, color: primary, opacity: 0.75,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {b.curator_name}
                          </div>
                        )}
                        {!tiny && !compact && (() => {
                          const badge = readOnly && liveStatus ? resolveMeetBadge(b, liveStatus) : null;
                          return badge ? (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              fontSize: 9, fontWeight: 700, color: badge.color,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {badge.pulse && (
                                <span className="wbc-live-dot" style={{
                                  width: 6, height: 6, borderRadius: '50%', background: badge.color, flexShrink: 0,
                                }} />
                              )}
                              {badge.label}
                            </div>
                          ) : null;
                        })()}
                        {!tiny && (
                          <span style={{
                            alignSelf: 'flex-start', marginTop: 'auto', fontSize: 9, color: '#fff', background: primary,
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
                      {readOnly && b.meet_code && onOpenJournal && (
                        <button
                          className="wbc-del"
                          title="Қатысушылар журналы"
                          onClick={(e) => { e.stopPropagation(); onOpenJournal(b); }}
                          style={{
                            position: 'absolute', top: 3, right: 3, zIndex: 2, width: 16, height: 16, borderRadius: '50%',
                            border: 'none', background: 'rgba(0,0,0,0.14)', color: primary, fontSize: 11, lineHeight: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                          }}
                        ><IconUsers style={{ width: 9, height: 9 }} /></button>
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
