import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import api from '../../services/api';
import { API_BASE, errorText } from '../../services/gameApi';
import { useGameStream, useServerNow } from '../../hooks/useGameStream';
import {
  OptionTile, TimerBar, LeaderboardList, Podium, ConnectionBanner, StreakChip,
  Backdrop, Confetti, Countdown, Dots, PlayerBadge,
} from '../../components/quiz/GameParts';
import { badgeFor } from '../../components/quiz/gameFx';
import { formatScore } from '../../components/quiz/answerMeta';
import { exportResultsXlsx } from '../../utils/quizExport';
import { mascotFor, winnerMascot } from '../../utils/subjectMascot';
import juz40Logo from '../../assets/juz40-logo.png';
import '../../styles/game.css';

// Хостың экраны: Meet-те бөлісіледі. Сондықтан бұл жерде «дұрыс жауап»
// сұрақ жүріп жатқанда мүлде жоқ — сервер оны reveal-ге дейін жібермейді.
export default function HostGame() {
  const { id } = useParams();
  const reduced = useReducedMotion();
  const token = localStorage.getItem('token') || '';
  const url = `${API_BASE}/games/${id}/stream?token=${encodeURIComponent(token)}`;

  const { view, conn, offset } = useGameStream(url);
  const ticking = !!view && (view.status === 'countdown' || view.status === 'question');
  const now = useServerNow(offset, ticking);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [exporting, setExporting] = useState(false);

  const act = useCallback(async (path, body) => {
    setBusy(true);
    setNotice('');
    try {
      await api.post(`/games/${id}/${path}`, body);
    } catch (err) {
      // «stale» — таймер бізден бұрын өткен, келесі snapshot экранды өзі түзетеді.
      if (err.response?.data?.code !== 'stale') setNotice(errorText(err, 'Әрекет орындалмады'));
    } finally {
      setBusy(false);
    }
  }, [id]);

  const next = useCallback(() => {
    if (!view) return;
    act('advance', { expect: { status: view.status, index: view.index } });
  }, [view, act]);

  // Бос орын / Enter — «Келесі». Пернетақтамен жүргізу — сыныпта қолайлы.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' && e.key !== 'Enter') return;
      if (/^(INPUT|TEXTAREA|BUTTON|A|SELECT)$/.test(e.target?.tagName || '')) return;
      if (!view || busy || !['question', 'reveal', 'leaderboard'].includes(view.status)) return;
      e.preventDefault();
      next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, busy, next]);

  // Аяқтау: екі қадам — кездейсоқ басып кетпеу үшін.
  useEffect(() => {
    if (!confirmEnd) return undefined;
    const t = setTimeout(() => setConfirmEnd(false), 3500);
    return () => clearTimeout(t);
  }, [confirmEnd]);

  const copyLink = async () => {
    const link = `${window.location.origin}/play?pin=${view.pin}`;
    try { await navigator.clipboard.writeText(link); } catch { /* қолжетімсіз — төменде сілтеме көрінеді */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const { data } = await api.get(`/games/${id}/results`);
      exportResultsXlsx(data);
    } catch (err) {
      setNotice(errorText(err, 'Нәтижені жүктеу мүмкін болмады'));
    } finally {
      setExporting(false);
    }
  };

  // ── бастапқы күй ────────────────────────────────────────────────
  if (!view) {
    return (
      <div className="qg qg--center">
        <Backdrop />
        {conn === 'closed' ? (
          <div className="qg-msg">
            <h1>Ойын табылмады</h1>
            <p>Ол жойылған немесе сізге тиесілі емес.</p>
            <Link className="qg-btn qg-btn--gold" to="/quizzes">Викториналарға оралу</Link>
          </div>
        ) : (
          <p className="qg-dim">Ойын жүктелуде<Dots /></p>
        )}
      </div>
    );
  }

  const q = view.question;
  const last = view.index + 1 >= view.total;
  const countdownSecs = now ? Math.max(Math.ceil((view.startsAt - now) / 1000), 1) : 0;
  const joinHost = window.location.host;
  const mascot = mascotFor(view.subject);
  const scene = ['lobby', 'countdown', 'leaderboard', 'finished'].includes(view.status);
  const bump = reduced ? false : { scale: 1.45, y: -6 };

  const nextLabel = view.status === 'question' ? 'Сұрақты аяқтау'
    : view.status === 'reveal' ? 'Рейтинг'
    : last ? 'Нәтижені көру' : 'Келесі сұрақ';

  return (
    <div className="qg">
      {scene && <Backdrop />}
      <ConnectionBanner conn={conn} />

      <header className="qg-top">
        <Link to="/quizzes" className="qg-brand" aria-label="Викториналарға оралу">
          <img src={juz40Logo} alt="" />
          <span>JUZ40</span>
        </Link>
        <div className="qg-top__title">{view.title}</div>
        <div className="qg-top__right">
          {view.index >= 0 && view.status !== 'finished' && (
            <span className="qg-pill">Сұрақ {view.index + 1} / {view.total}</span>
          )}
          {view.status !== 'finished' && (
            <button
              type="button"
              className={`qg-btn qg-btn--sm ${confirmEnd ? 'qg-btn--danger' : 'qg-btn--ghost'}`}
              onClick={() => (confirmEnd ? act('end') : setConfirmEnd(true))}
            >
              {confirmEnd ? 'Растау: аяқтау' : 'Ойынды аяқтау'}
            </button>
          )}
        </div>
      </header>

      {notice && <div className="qg-notice" role="alert">{notice}</div>}

      <main className="qg-main">
        {/* ── КҮТУ ЗАЛЫ ─────────────────────────────────────────── */}
        {view.status === 'lobby' && (
          <div className="qg-lobby">
            <section className="qg-joincard" aria-label="Қосылу">
              <span className={`qg-joincard__live ${view.locked ? 'is-locked' : ''}`}>
                <span className="qg-live" />
                {view.locked ? 'Кіру жабық' : 'Ойын ашық: қосылуға болады'}
              </span>
              <p className="qg-step"><span className="qg-step__n">1</span>Телефоннан ашыңыз</p>
              <p className="qg-joincard__url">{joinHost}/play</p>
              <p className="qg-step"><span className="qg-step__n">2</span>PIN-кодты енгізіңіз</p>
              <div className="qg-pin" aria-label={`PIN ${view.pin.split('').join(' ')}`}>
                {view.pin.split('').map((d, i) => (
                  <motion.span
                    key={i}
                    className="qg-pin__d"
                    initial={reduced ? false : { y: 30, opacity: 0, scale: 0.6 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.1 + i * 0.07 }}
                  >
                    {d}
                  </motion.span>
                ))}
              </div>
              <div className="qg-joincard__actions">
                <button type="button" className="qg-btn qg-btn--soft qg-btn--sm" onClick={copyLink}>
                  {copied ? 'Көшірілді' : 'Сілтемені көшіру'}
                </button>
                <button
                  type="button"
                  className="qg-btn qg-btn--soft qg-btn--sm"
                  aria-pressed={view.locked}
                  onClick={() => act('lock', { locked: !view.locked })}
                >
                  {view.locked ? 'Кіруді ашу' : 'Кіруді жабу'}
                </button>
              </div>
            </section>

            <section className="qg-crowd" aria-label="Ойыншылар">
              <header className="qg-crowd__head">
                <h2>
                  <motion.span key={view.playerCount} className="qg-crowd__n" initial={bump} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 16 }}>
                    {view.playerCount}
                  </motion.span>
                  <span>ойыншы</span>
                </h2>
                <button
                  type="button"
                  className={`qg-btn qg-btn--gold qg-btn--go ${view.playerCount > 0 && !busy ? 'is-ready' : ''}`}
                  disabled={view.playerCount < 1 || busy}
                  onClick={() => act('start')}
                >
                  Бастау
                </button>
              </header>

              {view.playerCount === 0 ? (
                <div className="qg-empty">
                  <p>Ойыншыларды күтудеміз<Dots /></p>
                  <span className="qg-dim">Экрандағы PIN-ді жазып беріңіз немесе сілтемені жіберіңіз</span>
                </div>
              ) : (
                <ul className="qg-chips">
                  <AnimatePresence>
                    {view.players.map((p) => (
                      <motion.li
                        key={p.id}
                        className={`qg-chip qg-chip--${badgeFor(p.nickname).key}`}
                        layout={!reduced}
                        initial={reduced ? false : { opacity: 0, scale: 0.4, y: 18, rotate: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                      >
                        <PlayerBadge name={p.nickname} size={32} />
                        <span>{p.nickname}</span>
                        <button
                          type="button"
                          className="qg-chip__x"
                          aria-label={`${p.nickname} ойыншыны шығару`}
                          onClick={() => act('kick', { playerId: p.id })}
                        >
                          ×
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
              <img className="qg-crowd__mascot qg-mascot" src={mascot} alt="" />
            </section>
          </div>
        )}

        {/* ── КЕРІ САНАҚ ────────────────────────────────────────── */}
        {view.status === 'countdown' && (
          <div className="qg-stage qg-stage--center">
            <p className="qg-eyebrow">Сұрақ {view.index + 1} / {view.total}</p>
            <Countdown secs={countdownSecs} />
            <p className="qg-lead">Дайын болыңыз</p>
          </div>
        )}

        {/* ── СҰРАҚ → НӘТИЖЕ ───────────────────────────────────────
            Бір блок: плиткалар орнында қалады, нәтиже кезінде күйі жайлап
            ауысады (дұрысы үлкейіп жарқырайды, қалғаны сөнеді). */}
        {(view.status === 'question' || (view.status === 'reveal' && view.distribution)) && q && (() => {
          const revealed = view.status === 'reveal';
          const dist = view.distribution;
          const max = revealed ? Math.max(...dist.counts, 1) : 1;
          return (
            <div className="qg-stage">
              <div className="qg-stage__meta">
                {revealed ? (
                  <>
                    <span className="qg-pill">Дұрыс жауап берген: {dist.correctCount} / {dist.total}</span>
                    {dist.noAnswer > 0 && <span className="qg-pill">Жауап бермеген: {dist.noAnswer}</span>}
                  </>
                ) : (
                  <>
                    <span className="qg-pill" role="status">
                      <motion.b key={view.answeredCount} style={{ display: 'inline-block' }} initial={bump} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 16 }}>
                        {view.answeredCount}
                      </motion.b>
                      {' '}/ {view.playerCount} жауап берді
                    </span>
                    {q.multi && <span className="qg-pill qg-pill--gold">Бірнеше дұрыс жауап</span>}
                    {q.pointsMode === 'double' && <span className="qg-pill qg-pill--gold">Екі есе ұпай</span>}
                    {q.pointsMode === 'none' && <span className="qg-pill">Ұпайсыз</span>}
                  </>
                )}
              </div>
              <h1 className="qg-prompt">{q.prompt}</h1>
              {!revealed && <TimerBar startsAt={view.startsAt} endsAt={view.endsAt} now={now} />}
              <div className={`qg-tiles ${q.options.length === 2 ? 'is-two' : ''}`}>
                {q.options.map((text, i) => (
                  <OptionTile
                    key={i}
                    index={i}
                    text={text}
                    {...(revealed ? {
                      state: q.correct.includes(i) ? 'correct' : 'dim',
                      count: dist.counts[i],
                      share: dist.counts[i] / max,
                    } : {})}
                  />
                ))}
              </div>
              <div className="qg-actions">
                <button type="button" className={`qg-btn ${revealed ? 'qg-btn--gold' : 'qg-btn--ghost'}`} disabled={busy} onClick={next}>{nextLabel}</button>
              </div>
            </div>
          );
        })()}

        {/* ── РЕЙТИНГ ──────────────────────────────────────────── */}
        {view.status === 'leaderboard' && view.leaderboard && (
          <div className="qg-stage qg-stage--narrow">
            <p className="qg-eyebrow">Рейтинг · {view.index + 1} / {view.total}</p>
            <h1 className="qg-title">Көшбасшылар</h1>
            <LeaderboardList entries={view.leaderboard} />
            <div className="qg-actions">
              <button type="button" className="qg-btn qg-btn--gold" disabled={busy} onClick={next}>{nextLabel}</button>
            </div>
          </div>
        )}

        {/* ── ФИНАЛ ────────────────────────────────────────────── */}
        {view.status === 'finished' && (
          <div className="qg-final">
            {view.players.length > 0 && <Confetti />}
            <div className="qg-final__stage">
              <img className="qg-final__mascot qg-mascot" src={winnerMascot} alt="" />
              <div className="qg-final__podium">
                <p className="qg-eyebrow">Ойын аяқталды</p>
                <h1 className="qg-title">{view.players.length ? 'Жеңімпаздар' : 'Ойыншы болмады'}</h1>
                <Podium players={view.players} />
              </div>
            </div>

            {view.players.length > 3 && (
              <ol className="qg-table" start={4}>
                {view.players.slice(3).map((p) => (
                  <li key={p.id} className="qg-table__row">
                    <span className="qg-board__rank">{p.rank}</span>
                    <PlayerBadge name={p.nickname} size={30} />
                    <span className="qg-board__name">{p.nickname}</span>
                    <StreakChip streak={p.streak} />
                    <span className="qg-board__score">{formatScore(p.score)}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="qg-actions qg-actions--row">
              <button type="button" className="qg-btn qg-btn--gold" disabled={exporting || view.players.length === 0} onClick={exportXlsx}>
                {exporting ? 'Дайындалуда…' : 'Нәтижені жүктеу (.xlsx)'}
              </button>
              <Link className="qg-btn qg-btn--ghost" to={`/games/${id}/results`}>Толық нәтиже</Link>
              <Link className="qg-btn qg-btn--ghost" to="/quizzes">Викториналарға оралу</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
