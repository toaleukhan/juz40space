import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  API_BASE, playApi, playerSession, errorText, errorCode,
} from '../../services/gameApi';
import { useGameStream, useServerNow } from '../../hooks/useGameStream';
import {
  OptionTile, TimerBar, LeaderboardList, Podium, ConnectionBanner, StreakChip, Movement,
  Backdrop, Confetti, Countdown, CountUp, Dots, PlayerBadge,
} from '../../components/quiz/GameParts';
import { ShapeIcon, CheckIcon, CrossIcon, ClockIcon } from '../../components/quiz/shapes';
import { ANSWER_META, formatScore } from '../../components/quiz/answerMeta';
import juz40Logo from '../../assets/juz40-logo.png';
import { mascotFor, winnerMascot } from '../../utils/subjectMascot';
import '../../styles/game.css';

// Ойыншы аккаунтсыз: PIN + лақап ат. Сессиясы (құпия токен) localStorage-та
// сақталады, сондықтан бет жаңарса не телефон ұйықтап қалса да ойынға қайта
// кіреді.
export default function PlayGame() {
  const [params] = useSearchParams();
  const linkPin = (params.get('pin') || '').replace(/\D/g, '').slice(0, 6);
  const [session, setSession] = useState(() => {
    const saved = playerSession.get();
    // Жаңа PIN-мен келген сілтеме алдыңғы (аяқталған) ойынды ауыстыруы керек;
    // сол PIN болса — бет жаңарғаны, сессияны сақтаймыз.
    if (saved && linkPin.length === 6 && saved.pin !== linkPin) {
      playerSession.clear();
      return null;
    }
    return saved;
  });
  const [notice, setNotice] = useState('');

  const leave = (message = '') => {
    playerSession.clear();
    setNotice(message);
    setSession(null);
  };

  if (!session) {
    return (
      <JoinFlow
        notice={notice}
        onJoined={(s) => { playerSession.set(s); setNotice(''); setSession(s); }}
      />
    );
  }
  return <Play session={session} onLeave={leave} />;
}

// ── 1. PIN → 2. лақап ат ────────────────────────────────────────────
function JoinFlow({ onJoined, notice }) {
  const [params] = useSearchParams();
  const initialPin = (params.get('pin') || '').replace(/\D/g, '').slice(0, 6);

  const [pin, setPin] = useState(initialPin);
  const [step, setStep] = useState('pin');
  const [game, setGame] = useState(null);
  const [nick, setNick] = useState('');
  const [error, setError] = useState(notice || '');
  const [busy, setBusy] = useState(false);

  // Сілтемемен (?pin=…) келсе, PIN-ді бірден тексереміз.
  useEffect(() => {
    if (initialPin.length !== 6) return;
    playApi.get(`/play/pin/${initialPin}`)
      .then(({ data }) => { setGame(data); setStep('nick'); })
      .catch((err) => setError(errorText(err, '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPin = async (e) => {
    e.preventDefault();
    if (pin.length !== 6) { setError('PIN 6 саннан тұрады'); return; }
    setBusy(true);
    setError('');
    try {
      const { data } = await playApi.get(`/play/pin/${pin}`);
      setGame(data);
      setStep('nick');
    } catch (err) {
      setError(errorText(err, 'Қосылу мүмкін болмады. Интернетті тексеріңіз.'));
    } finally {
      setBusy(false);
    }
  };

  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await playApi.post('/play/join', { pin, nickname: nick });
      onJoined({ token: data.token, nickname: data.player.nickname, title: data.game.title, pin });
    } catch (err) {
      setError(errorText(err, 'Қосылу мүмкін болмады. Интернетті тексеріңіз.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="qg qg--center qg--join">
      <Backdrop />
      <div className="qg-join">
        <div className="qg-join__brand">
          <img src={juz40Logo} alt="" />
          <span>JUZ40</span>
        </div>
        <img className="qg-join__mascot qg-mascot" src={mascotFor(game?.subject)} alt="" />

        {step === 'pin' ? (
          <form onSubmit={checkPin} className="qg-form" noValidate>
            <h1>Ойынға қосылу</h1>
            <label className="qg-field">
              <span>PIN-код</span>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="000000"
                aria-invalid={!!error}
                className="qg-input qg-input--pin"
                autoFocus
              />
            </label>
            {error && <p className="qg-error" role="alert">{error}</p>}
            <button type="submit" className="qg-btn qg-btn--gold qg-btn--block" disabled={busy || pin.length !== 6}>
              {busy ? 'Тексерілуде…' : 'Әрі қарай'}
            </button>
          </form>
        ) : (
          <form onSubmit={join} className="qg-form" noValidate>
            <h1>{game?.title}</h1>
            <label className="qg-field">
              <span>Лақап атыңыз</span>
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                maxLength={24}
                autoComplete="off"
                placeholder="Мысалы: Аружан"
                aria-invalid={!!error}
                className="qg-input"
                autoFocus
              />
            </label>
            {error && <p className="qg-error" role="alert">{error}</p>}
            <button type="submit" className="qg-btn qg-btn--gold qg-btn--block" disabled={busy || nick.trim().length < 2}>
              {busy ? 'Қосылуда…' : 'Қосылу'}
            </button>
            <button type="button" className="qg-btn qg-btn--ghost qg-btn--block" onClick={() => { setStep('pin'); setError(''); }}>
              Басқа PIN
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── ойын ────────────────────────────────────────────────────────────
function Play({ session, onLeave }) {
  const url = `${API_BASE}/play/stream?p=${encodeURIComponent(session.token)}`;
  const { view, conn, offset } = useGameStream(url);
  const ticking = !!view && (view.status === 'countdown' || view.status === 'question');
  const now = useServerNow(offset, ticking);

  // Жауап: сервер ойыншының өз жауабы үшін snapshot жібермейді, сондықтан
  // оны бірден өзіміз көрсетеміз (оптимистік), қате болса қайтарамыз.
  const [sent, setSent] = useState(null);       // { index, choice, state, message }
  const [picked, setPicked] = useState({ index: -1, set: [] }); // көп таңдау
  const reduced = useReducedMotion();

  if (!view) {
    return (
      <div className="qg qg--center">
        <Backdrop />
        {conn === 'closed' ? (
          <div className="qg-msg">
            <h1>Ойын табылмады</h1>
            <p>Ол аяқталған немесе жойылған болуы мүмкін.</p>
            <button type="button" className="qg-btn qg-btn--gold" onClick={() => onLeave()}>Басқа ойынға қосылу</button>
          </div>
        ) : (
          <p className="qg-dim">Қосылуда<Dots /></p>
        )}
      </div>
    );
  }

  if (view.status === 'kicked') {
    return (
      <div className="qg qg--center">
        <Backdrop />
        <div className="qg-msg">
          <h1>Сіз ойыннан шығарылдыңыз</h1>
          <p>Хост сізді ойыннан шығарды.</p>
          <button type="button" className="qg-btn qg-btn--gold" onClick={() => onLeave()}>Басқа ойынға қосылу</button>
        </div>
      </div>
    );
  }

  const q = view.question;
  const me = view.me;

  const submit = async (choice) => {
    setSent({ index: view.index, choice, state: 'sending' });
    try {
      await playApi.post(
        '/play/answer',
        { questionIndex: view.index, choice },
        { headers: { 'X-Player-Token': session.token } },
      );
      setSent({ index: view.index, choice, state: 'sent' });
      if (navigator.vibrate) navigator.vibrate(25);
    } catch (err) {
      const code = errorCode(err);
      if (code === 'duplicate') {
        setSent({ index: view.index, choice, state: 'sent' });
      } else {
        const late = code === 'late' || code === 'closed';
        setSent({
          index: view.index,
          choice: null,
          state: late ? 'late' : 'error',
          message: late ? 'Уақыт өтіп кетті' : errorText(err, 'Жауап жіберілмеді. Қайталап көріңіз.'),
        });
      }
    }
  };

  const mine = sent && sent.index === view.index ? sent : null;
  const myChoice = mine && (mine.state === 'sending' || mine.state === 'sent')
    ? mine.choice
    : (view.answered ? view.myChoice : null);
  const selection = picked.index === view.index ? picked.set : [];

  const toggle = (i) => {
    const set = selection.includes(i) ? selection.filter((x) => x !== i) : [...selection, i].sort((a, b) => a - b);
    setPicked({ index: view.index, set });
  };

  const bar = (
    <header className="qg-ptop">
      <span className="qg-ptop__nick"><PlayerBadge name={me.nickname} size={28} /><span>{me.nickname}</span></span>
      {view.index >= 0 && view.status !== 'finished' && <span>{view.index + 1} / {view.total}</span>}
      <span className="qg-ptop__score">{formatScore(me.score)}</span>
    </header>
  );

  const mascot = mascotFor(view.subject);
  const scene = ['lobby', 'countdown', 'leaderboard', 'finished'].includes(view.status);
  const pop = reduced ? false : { scale: 0.4, opacity: 0, y: 24 };
  const spring = { type: 'spring', stiffness: 420, damping: 16 };

  return (
    <div className="qg qg--player">
      {scene && <Backdrop />}
      <ConnectionBanner conn={conn} />

      {/* ── КҮТУ ────────────────────────────────────────────────── */}
      {view.status === 'lobby' && (
        <div className="qg-pcenter">
          <img className="qg-pmascot qg-mascot" src={mascot} alt="" />
          <h1>Сіз ойындасыз!</h1>
          <motion.div className="qg-nickpill" initial={pop} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.15 }}>
            <PlayerBadge name={me.nickname} size={44} />
            <span>{me.nickname}</span>
          </motion.div>
          <p className="qg-dim">Хост экранынан өз белгіңізді табыңыз</p>
          <p className="qg-dim">Хост бастағанша күтіңіз<Dots /></p>
          <span className="qg-joined">
            Қатысушы:
            <motion.b key={me.playerCount} style={{ display: 'inline-block' }} initial={reduced ? false : { scale: 1.5 }} animate={{ scale: 1 }} transition={spring}>
              {me.playerCount}
            </motion.b>
          </span>
        </div>
      )}

      {/* ── КЕРІ САНАҚ ──────────────────────────────────────────── */}
      {view.status === 'countdown' && (
        <div className="qg-pcenter">
          <p className="qg-eyebrow">Сұрақ {view.index + 1} / {view.total}</p>
          <Countdown secs={now ? Math.max(Math.ceil((view.startsAt - now) / 1000), 1) : 0} />
          <p className="qg-lead">Дайын болыңыз</p>
        </div>
      )}

      {/* ── СҰРАҚ ───────────────────────────────────────────────── */}
      {view.status === 'question' && q && (
        <>
          {bar}
          <TimerBar startsAt={view.startsAt} endsAt={view.endsAt} now={now} />
          {myChoice ? (
            <div className="qg-pcenter">
              {/* Бейтарап белгі: жасыл «галочка» дұрыс жауап деп қабылданып қалмасын */}
              <div className="qg-sent" role="status">
                <ClockIcon size={34} />
              </div>
              <h1>Жауап қабылданды</h1>
              <ul className="qg-mychoice">
                {myChoice.map((i) => (
                  <li key={i} className={`qg-mychoice__item qg-tile--${ANSWER_META[i].key}`}>
                    <ShapeIcon index={i} size={18} /> <span>{q.options[i]}</span>
                  </li>
                ))}
              </ul>
              <p className="qg-dim">Қалғандарды күтіп тұрмыз<Dots /></p>
            </div>
          ) : (
            <div className="qg-pplay">
              <h1 className="qg-prompt qg-prompt--sm">{q.prompt}</h1>
              {q.multi && <p className="qg-hint">Бірнеше дұрыс жауап бар — барлығын таңдаңыз</p>}
              {mine && (mine.state === 'late' || mine.state === 'error') && (
                <p className="qg-error" role="alert">{mine.message}</p>
              )}
              <div className={`qg-tiles qg-tiles--player ${q.options.length === 2 ? 'is-two' : ''}`}>
                {q.options.map((text, i) => (
                  <OptionTile
                    key={i}
                    index={i}
                    text={text}
                    pressed={q.multi ? selection.includes(i) : undefined}
                    disabled={mine?.state === 'sending' || mine?.state === 'late'}
                    onClick={q.multi ? () => toggle(i) : () => submit([i])}
                  />
                ))}
              </div>
              {q.multi && (
                <button
                  type="button"
                  className="qg-btn qg-btn--gold qg-btn--block qg-submit"
                  disabled={selection.length === 0 || mine?.state === 'sending'}
                  onClick={() => submit(selection)}
                >
                  {mine?.state === 'sending' ? 'Жіберілуде…' : 'Жіберу'}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── НӘТИЖЕ ──────────────────────────────────────────────── */}
      {view.status === 'reveal' && view.result && q && (() => {
        const r = view.result;
        const tone = !r.answered ? 'none' : r.correct ? 'good' : 'bad';
        // Бірінші сұрақта «алдыңғы орын» жоқ (бәрі 0-ден бастады).
        const moved = view.index > 0 && r.prevRank && r.prevRank !== me.rank;
        return (
          <div className={`qg-result qg-result--${tone}`}>
            <div className="qg-result__body">
              <motion.div className="qg-result__icon" aria-hidden="true" initial={reduced ? false : { scale: 0, rotate: -35 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 13 }}>
                {tone === 'good' ? <CheckIcon size={50} /> : tone === 'bad' ? <CrossIcon size={50} /> : <ClockIcon size={50} />}
              </motion.div>
              <motion.h1 initial={reduced ? false : { y: 22, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }}>
                {tone === 'good' ? 'Дұрыс!' : tone === 'bad' ? 'Қате' : 'Уақыт бітті'}
              </motion.h1>
              {r.points > 0 && <p className="qg-result__pts">+<CountUp to={r.points} ms={900} /></p>}
              <StreakChip streak={r.streak} />
              {tone !== 'good' && (
                <div className="qg-result__answer">
                  <p>Дұрыс жауап:</p>
                  <ul className="qg-mychoice">
                    {r.correctOptions.map((i) => (
                      <li key={i} className="qg-mychoice__item qg-mychoice__item--plain">
                        <ShapeIcon index={i} size={18} /> <span>{q.options[i]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <footer className="qg-result__foot">
              <span>Орныңыз: <b>№{me.rank}</b>{moved && <Movement prev={r.prevRank} cur={me.rank} />}</span>
              <span><CountUp from={Math.max(me.score - r.points, 0)} to={me.score} ms={900} /> ұпай</span>
            </footer>
          </div>
        );
      })()}

      {/* ── РЕЙТИНГ ─────────────────────────────────────────────── */}
      {view.status === 'leaderboard' && view.top && (
        <div className="qg-pcenter qg-pcenter--top">
          <p className="qg-eyebrow">Рейтинг</p>
          <h1>Сіздің орныңыз: №{me.rank}</h1>
          <p className="qg-dim">{formatScore(me.score)} ұпай</p>
          <LeaderboardList
            entries={view.top.map((t) => ({ ...t, prevRank: undefined, delta: 0, streak: 0 }))}
            meId={view.top.find((t) => t.isMe)?.id}
          />
          {!view.top.some((t) => t.isMe) && (
            <p className="qg-board__you">Сіз: №{me.rank} · {formatScore(me.score)}</p>
          )}
        </div>
      )}

      {/* ── ФИНАЛ ───────────────────────────────────────────────── */}
      {view.status === 'finished' && (
        <div className="qg-pcenter">
          {me.rank <= 3 && me.score > 0 && <Confetti />}
          {me.rank <= 3 && <img className="qg-pmascot qg-mascot" src={winnerMascot} alt="" />}
          <p className="qg-eyebrow">Ойын аяқталды</p>
          <h1>{me.rank <= 3 ? 'Құттықтаймыз!' : me.score > 0 ? 'Жарайсың!' : 'Қатысқаныңыз үшін рахмет!'}</h1>
          <motion.p className="qg-final-rank" initial={reduced ? false : { scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}>
            №{me.rank}
          </motion.p>
          <p className="qg-dim"><CountUp to={me.score} ms={1100} /> ұпай · {me.playerCount} ойыншының ішінде</p>
          {view.top && <Podium players={view.top.slice(0, 3)} />}
          <button type="button" className="qg-btn qg-btn--gold" onClick={() => onLeave()}>Жаңа ойынға қосылу</button>
        </div>
      )}
    </div>
  );
}
