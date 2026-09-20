import { motion, useReducedMotion } from 'framer-motion';
import { ShapeIcon, FlameIcon, CheckIcon } from './shapes';
import { ANSWER_META, formatScore } from './answerMeta';

// ── жауап нұсқасы ───────────────────────────────────────────────────
// state: undefined | 'correct' | 'dim' | 'wrong'. onClick болса — батырма
// (ойыншы), болмаса — жай блок (хостың экраны).
export function OptionTile({ index, text, state, pressed, onClick, disabled, count, share }) {
  const meta = ANSWER_META[index];
  const cls = ['qg-tile', `qg-tile--${meta.key}`, state ? `is-${state}` : '', pressed ? 'is-pressed' : ''].filter(Boolean).join(' ');
  const body = (
    <>
      {share !== undefined && <span className="qg-tile__share" style={{ transform: `scaleX(${share})` }} aria-hidden="true" />}
      <span className="qg-tile__shape"><ShapeIcon index={index} size={28} /></span>
      <span className="qg-tile__text">{text}</span>
      {count !== undefined && <span className="qg-tile__count" aria-label={`${count} ойыншы`}>{count}</span>}
      {state === 'correct' && <span className="qg-tile__mark" aria-label="Дұрыс жауап"><CheckIcon size={22} /></span>}
    </>
  );
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-label={`${meta.name}: ${text}`}
    >
      {body}
    </button>
  );
}

// ── таймер ──────────────────────────────────────────────────────────
// Көрінетін жолақ + сан. Экран оқығышқа әр секундты айтпаймыз (ол шу
// болар еді), тек 10 және 5 секунд қалғанда және уақыт біткенде.
export function TimerBar({ startsAt, endsAt, now }) {
  const total = Math.max(endsAt - startsAt, 1);
  const remaining = now ? Math.max(endsAt - now, 0) : total;
  const frac = Math.min(remaining / total, 1);
  const secs = Math.ceil(remaining / 1000);
  const say = !now ? '' : secs === 0 ? 'Уақыт бітті' : (secs === 10 || secs === 5) ? `${secs} секунд қалды` : '';
  const urgent = frac < 0.25;
  return (
    <div className={`qg-timer ${urgent ? 'is-urgent' : ''}`}>
      <div className="qg-timer__track" aria-hidden="true">
        <div className="qg-timer__fill" style={{ transform: `scaleX(${frac})` }} />
      </div>
      <div className="qg-timer__secs" aria-hidden="true">{now ? secs : ''}</div>
      <div className="qg-sr" role="status" aria-live="polite" aria-atomic="true">{say}</div>
    </div>
  );
}

// ── қозғалыс: ▲2 / ▼1 / — ───────────────────────────────────────────
export function Movement({ prev, cur }) {
  if (prev === undefined || prev === null) return null; // салыстыратын алдыңғы орын жоқ
  if (prev === cur) return <span className="qg-move is-flat" aria-label="Орны өзгерген жоқ">—</span>;
  const up = prev > cur;
  return (
    <span className={`qg-move ${up ? 'is-up' : 'is-down'}`} aria-label={up ? `${prev - cur} орынға көтерілді` : `${cur - prev} орынға түсті`}>
      {up ? '▲' : '▼'} {Math.abs(prev - cur)}
    </span>
  );
}

export function StreakChip({ streak }) {
  if (!streak || streak < 2) return null;
  return <span className="qg-streak" title="Қатарынан дұрыс жауап"><FlameIcon /> ×{streak}</span>;
}

// ── рейтинг тізімі (әр сұрақтан кейін) ─────────────────────────────
export function LeaderboardList({ entries, meId }) {
  const reduced = useReducedMotion();
  return (
    <ol className="qg-board">
      {entries.map((e) => (
        <motion.li
          key={e.id}
          layout={!reduced}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className={`qg-board__row ${e.id === meId ? 'is-me' : ''}`}
        >
          <span className="qg-board__rank">{e.rank}</span>
          <span className="qg-board__name">{e.nickname}</span>
          <StreakChip streak={e.streak} />
          <Movement prev={e.prevRank} cur={e.rank} />
          {e.delta > 0 && <span className="qg-board__delta">+{formatScore(e.delta)}</span>}
          <span className="qg-board__score">{formatScore(e.score)}</span>
        </motion.li>
      ))}
    </ol>
  );
}

// ── подиум ──────────────────────────────────────────────────────────
// Көрсету тәртібі: 2-орын, 1-орын, 3-орын — ортадағы ең биік.
export function Podium({ players }) {
  const reduced = useReducedMotion();
  const top = players.slice(0, 3);
  if (top.length === 0) return null;
  const order = [1, 0, 2].map((i) => top[i]).filter(Boolean);
  return (
    <div className="qg-podium" role="list" aria-label="Жеңімпаздар">
      {order.map((p) => (
        <motion.div
          key={p.id}
          role="listitem"
          className={`qg-podium__col is-r${p.rank}`}
          initial={reduced ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : (p.rank === 1 ? 0.5 : p.rank === 2 ? 0.25 : 0), duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <div className="qg-podium__who">
            <span className="qg-podium__avatar" aria-hidden="true">{[...p.nickname][0]?.toUpperCase()}</span>
            <span className="qg-podium__name">{p.nickname}</span>
            <span className="qg-podium__score">{formatScore(p.score)}</span>
          </div>
          <div className="qg-podium__block"><span>{p.rank}</span></div>
        </motion.div>
      ))}
    </div>
  );
}

// «Байланыс үзілді» жолағы: EventSource өзі қайта қосылып жатқанда.
export function ConnectionBanner({ conn }) {
  if (conn === 'open' || conn === 'connecting') return null;
  return (
    <div className="qg-conn" role="status">
      {conn === 'lost' ? 'Байланыс үзілді. Қайта қосылып жатыр…' : 'Байланыс жабылды. Бетті жаңартыңыз.'}
    </div>
  );
}
