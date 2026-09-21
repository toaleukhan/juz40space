import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ShapeIcon, FlameIcon, CheckIcon, CrownIcon } from './shapes';
import { ANSWER_META, formatScore } from './answerMeta';
import { badgeFor, pseudo, useCountUp } from './gameFx';

// ── фон: баяу жүзетін ▲◆●■ ─────────────────────────────────────────
// Күту залы, кері санақ, рейтинг, финал үшін. Сұрақ экранында қойылмайды —
// назар тек сұрақта болсын.
const BG = [
  { s: 0, x: 5, y: 12, z: 66, c: 'a', d: 0, t: 14 }, { s: 2, x: 15, y: 68, z: 46, c: 'c', d: -3, t: 11 },
  { s: 3, x: 27, y: 34, z: 30, c: 'd', d: -6, t: 16 }, { s: 1, x: 43, y: 6, z: 52, c: 'b', d: -2, t: 13 },
  { s: 0, x: 57, y: 82, z: 40, c: 'c', d: -8, t: 12 }, { s: 2, x: 71, y: 20, z: 28, c: 'a', d: -4, t: 15 },
  { s: 3, x: 83, y: 60, z: 60, c: 'b', d: -1, t: 10 }, { s: 1, x: 93, y: 9, z: 38, c: 'd', d: -7, t: 17 },
  { s: 0, x: 90, y: 86, z: 48, c: 'd', d: -5, t: 13 }, { s: 2, x: 3, y: 90, z: 34, c: 'b', d: -9, t: 12 },
  { s: 1, x: 36, y: 88, z: 26, c: 'a', d: -10, t: 15 }, { s: 3, x: 64, y: 48, z: 22, c: 'c', d: -11, t: 18 },
];

export function Backdrop() {
  return (
    <div className="qg-bg" aria-hidden="true">
      {BG.map((b, i) => (
        <span
          key={i}
          className={`qg-bg__s qg-bg__s--${b.c}`}
          style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.z, height: b.z, '--d': `${b.d}s`, '--t': `${b.t}s` }}
        >
          <ShapeIcon index={b.s} size={b.z} />
        </span>
      ))}
    </div>
  );
}

// ── конфетти: жеңіс сәтінде ────────────────────────────────────────
export function Confetti({ count = 46 }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div className="qg-confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          className={`qg-confetti__p qg-confetti__p--${i % 6}`}
          style={{
            left: `${pseudo(i, 1) * 100}%`,
            width: 7 + pseudo(i, 6) * 7,
            height: 10 + pseudo(i, 7) * 10,
            '--dx': `${(pseudo(i, 2) - 0.5) * 240}px`,
            '--rot': `${(pseudo(i, 3) - 0.5) * 1080}deg`,
            '--delay': `${pseudo(i, 4) * 0.9}s`,
            '--dur': `${2.6 + pseudo(i, 5) * 2.2}s`,
          }}
        />
      ))}
    </div>
  );
}

// Сан біртіндеп өседі.
export function CountUp({ to, from = 0, ms = 700 }) {
  return <>{formatScore(useCountUp(to, from, ms))}</>;
}

// «···» — күтіп тұр.
export function Dots() {
  return <span className="qg-dots" aria-hidden="true"><i /><i /><i /></span>;
}

// Ойыншының белгісі: аты бойынша түс + пішін.
export function PlayerBadge({ name, size = 30 }) {
  const b = badgeFor(name);
  return (
    <span className={`qg-badge qg-badge--${b.key}`} style={{ width: size, height: size }} aria-hidden="true">
      <ShapeIcon index={b.shape} size={Math.round(size * 0.5)} />
    </span>
  );
}

// ── кері санақ: сақина әр секундта босайды, сан секіріп ауысады ─────
export function Countdown({ secs }) {
  const reduced = useReducedMotion();
  if (!secs) return <div className="qg-count" />;
  return (
    <div className="qg-count">
      <svg className="qg-count__ring" viewBox="0 0 200 200" aria-hidden="true">
        <circle className="qg-count__track" cx="100" cy="100" r="88" />
        <circle key={secs} className="qg-count__arc" cx="100" cy="100" r="88" />
      </svg>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={secs}
          className="qg-count__n"
          initial={reduced ? false : { scale: 1.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 24 }}
        >
          {secs}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── жауап нұсқасы ───────────────────────────────────────────────────
// state: undefined | 'correct' | 'dim' | 'wrong'. onClick болса — батырма
// (ойыншы), болмаса — жай блок (хостың экраны). Сұрақтан нәтижеге өткенде
// плиткалар орнында қалады да, күйі жайлап ауысады (дұрысы үлкейеді, қалғаны сөнеді).
export function OptionTile({ index, text, state, pressed, onClick, disabled, count, share }) {
  const reduced = useReducedMotion();
  const meta = ANSWER_META[index];
  const cls = ['qg-tile', `qg-tile--${meta.key}`, state ? `is-${state}` : '', pressed ? 'is-pressed' : ''].filter(Boolean).join(' ');
  const to = state === 'dim' ? { opacity: 0.62, scale: 0.97, y: 0 }
    : state === 'correct' ? { opacity: 1, scale: 1.03, y: 0 }
    : { opacity: 1, scale: 1, y: 0 };
  const motionProps = {
    initial: reduced ? false : { opacity: 0, y: 36, scale: 0.94 },
    animate: to,
    transition: { delay: state ? 0 : 0.06 * index, type: 'spring', stiffness: 380, damping: 26 },
  };
  const body = (
    <>
      {share !== undefined && (
        <motion.span
          className="qg-tile__share"
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: share }}
          transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
          aria-hidden="true"
        />
      )}
      <span className="qg-tile__shape"><ShapeIcon index={index} size={28} /></span>
      <span className="qg-tile__text">{text}</span>
      {count !== undefined && <span className="qg-tile__count" aria-label={`${count} ойыншы`}><CountUp to={count} ms={600} /></span>}
      {state === 'correct' && (
        <motion.span
          className="qg-tile__mark"
          aria-label="Дұрыс жауап"
          initial={reduced ? false : { scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 16, delay: 0.15 }}
        >
          <CheckIcon size={22} />
        </motion.span>
      )}
    </>
  );
  if (!onClick) return <motion.div className={cls} {...motionProps}>{body}</motion.div>;
  return (
    <motion.button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-label={`${meta.name}: ${text}`}
      whileTap={reduced || disabled ? undefined : { scale: 0.97, y: 3 }}
      {...motionProps}
    >
      {body}
    </motion.button>
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
// Орын ауысқанда қатарлар жайлап орнын ауыстырады, ұпай алдыңғы мәннен өседі.
export function LeaderboardList({ entries, meId }) {
  const reduced = useReducedMotion();
  return (
    <ol className="qg-board">
      {entries.map((e, i) => (
        <motion.li
          key={e.id}
          layout={!reduced}
          initial={reduced ? false : { opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32, delay: reduced ? 0 : i * 0.07 }}
          className={`qg-board__row ${e.id === meId ? 'is-me' : ''}`}
        >
          <span className="qg-board__rank">{e.rank}</span>
          <PlayerBadge name={e.nickname} size={34} />
          <span className="qg-board__name">{e.nickname}</span>
          <StreakChip streak={e.streak} />
          <Movement prev={e.prevRank} cur={e.rank} />
          {e.delta > 0 && <span className="qg-board__delta">+{formatScore(e.delta)}</span>}
          <span className="qg-board__score"><CountUp from={Math.max(e.score - (e.delta || 0), 0)} to={e.score} /></span>
        </motion.li>
      ))}
    </ol>
  );
}

// ── подиум ──────────────────────────────────────────────────────────
// Көрсету тәртібі: 2-орын, 1-орын, 3-орын — ортадағы ең биік. Тұғырлар
// төменнен өседі (3 → 2 → 1), 1-орынның үстінде тәж.
export function Podium({ players }) {
  const reduced = useReducedMotion();
  const top = players.slice(0, 3);
  if (top.length === 0) return null;
  const order = [1, 0, 2].map((i) => top[i]).filter(Boolean);
  const wait = (rank) => (reduced ? 0 : rank === 3 ? 0.1 : rank === 2 ? 0.45 : 0.9);
  return (
    <div className="qg-podium" role="list" aria-label="Жеңімпаздар">
      {order.map((p) => (
        <div key={p.id} role="listitem" className={`qg-podium__col is-r${p.rank}`}>
          <motion.div
            className="qg-podium__who"
            initial={reduced ? false : { opacity: 0, y: 30, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20, delay: wait(p.rank) + 0.35 }}
          >
            {p.rank === 1 && <span className="qg-podium__crown"><CrownIcon size={34} /></span>}
            <PlayerBadge name={p.nickname} size={58} />
            <span className="qg-podium__name">{p.nickname}</span>
            <span className="qg-podium__score"><CountUp to={p.score} ms={1100} /></span>
          </motion.div>
          <motion.div
            className="qg-podium__block"
            initial={reduced ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ type: 'spring', stiffness: 170, damping: 18, delay: wait(p.rank) }}
          >
            <span>{p.rank}</span>
          </motion.div>
        </div>
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
