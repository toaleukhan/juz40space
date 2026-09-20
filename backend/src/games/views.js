const { TOP_N } = require('./constants');
const { rankPlayers, previousRanks } = require('./ranking');

// Клиентке жіберілетін көріністер (snapshot) — таза функциялар, базаға
// тимейді. Ең басты ереже: дұрыс жауап мен ұпай сұрақ жүріп жатқанда
// ешкімге (хостқа да) көрінбейді. Хостың экраны Meet-те көрсетіледі,
// сондықтан оған да «reveal» алдында дұрыс жауапты жібермейміз.
//
// model = { session, players, answers }
//   session.status — ДЕРЕКТЕР ҚОРЫНДАҒЫ күй: lobby | question | reveal | leaderboard | finished
//   answers — тек ағымдағы сұрақтың жауаптары

// Клиентке көрінетін күй. Базада «question» күйінің ішінде екі кезең бар:
// сұрақ ашылғанға дейінгі кері санақ (countdown) және жауап беру (question).
function derivePhase(session, now) {
  if (session.status === 'question') return now < session.startsAtMs ? 'countdown' : 'question';
  return session.status;
}

function publicQuestion(q) {
  return {
    kind: q.kind,
    prompt: q.prompt,
    options: q.options,
    // Бірнеше дұрыс жауабы бар екені ойыншыға алдын ала айтылады (ол
    // «бірнешеуін таңда» интерфейсін көрсетуі керек), қайсысы екені емес.
    multi: q.correct.length > 1,
    timeLimit: q.timeLimit,
    pointsMode: q.pointsMode,
  };
}

const active = (model) => model.players.filter((p) => !p.kicked);

// Ағымдағы сұрақта әр ойыншыға қосылған ұпай мен уақыт. Жауап бермегеннің
// уақыты — сұрақтың толық шегі (базадағы closeQuestion сондай қосады).
function deltasFor(model, question) {
  const byPlayer = new Map(model.answers.map((a) => [a.playerId, a]));
  const limitMs = question.timeLimit * 1000;
  const map = new Map();
  for (const p of active(model)) {
    const a = byPlayer.get(p.id);
    map.set(p.id, a ? { points: a.points, ms: a.responseMs } : { points: 0, ms: limitMs });
  }
  return map;
}

function distribution(model, question) {
  const activeIds = new Set(active(model).map((p) => p.id));
  const answers = model.answers.filter((a) => activeIds.has(a.playerId));
  const counts = question.options.map(() => 0);
  answers.forEach((a) => a.choice.forEach((c) => { if (counts[c] !== undefined) counts[c] += 1; }));
  return {
    counts,
    correctCount: answers.filter((a) => a.correct).length,
    answeredCount: answers.length,
    noAnswer: activeIds.size - answers.length,
    total: activeIds.size,
  };
}

function leaderboardEntries(model, question, ranked) {
  const deltas = deltasFor(model, question);
  const prev = previousRanks(ranked, deltas);
  // Бірінші ұпай алынған сұрақта «алдыңғы орын» деген жоқ (бәрі 0 еді, орын
  // тек қосылу тәртібі): ▲17 сияқты мағынасыз көрсеткіш шықпасын.
  const hadHistory = ranked.some((p) => p.score - (deltas.get(p.id)?.points ?? 0) > 0);
  return ranked.slice(0, TOP_N).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    rank: p.rank,
    prevRank: hadHistory ? (prev.get(p.id) ?? p.rank) : null,
    delta: deltas.get(p.id)?.points ?? 0,
    streak: p.streak,
  }));
}

// ── хост ────────────────────────────────────────────────────────────
function hostView(model, now) {
  const { session } = model;
  const phase = derivePhase(session, now);
  const q = session.currentIndex >= 0 ? session.questions[session.currentIndex] : null;
  const revealed = phase === 'reveal' || phase === 'leaderboard';
  const showQuestion = q && (phase === 'question' || revealed);

  const ranked = rankPlayers(active(model).map((p) => ({ ...p })));
  const answered = new Set(model.answers.map((a) => a.playerId));

  const view = {
    role: 'host',
    id: session.id,
    pin: session.pin,
    title: session.title,
    status: phase,
    index: session.currentIndex,
    total: session.questions.length,
    locked: session.locked,
    serverNow: now,
    startsAt: session.startsAtMs || null,
    endsAt: session.endsAtMs || null,
    playerCount: ranked.length,
    answeredCount: phase === 'question' || revealed ? answered.size : 0,
    question: showQuestion ? { ...publicQuestion(q), ...(revealed ? { correct: q.correct } : {}) } : null,
    players: ranked.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      rank: p.rank,
      streak: p.streak,
      answered: phase === 'question' ? answered.has(p.id) : undefined,
    })),
  };

  if (q && revealed) view.distribution = distribution(model, q);
  if (q && phase === 'leaderboard') view.leaderboard = leaderboardEntries(model, q, ranked);
  return view;
}

// ── ойыншы ──────────────────────────────────────────────────────────
function playerView(model, playerId, now) {
  const { session } = model;
  const me = active(model).find((p) => p.id === playerId);
  if (!me) return { role: 'player', status: 'kicked', serverNow: now };

  const phase = derivePhase(session, now);
  const q = session.currentIndex >= 0 ? session.questions[session.currentIndex] : null;
  const revealed = phase === 'reveal' || phase === 'leaderboard';
  const showQuestion = q && (phase === 'question' || revealed);

  const ranked = rankPlayers(active(model).map((p) => ({ ...p })));
  const meRanked = ranked.find((p) => p.id === playerId);
  const myAnswer = model.answers.find((a) => a.playerId === playerId) || null;

  const view = {
    role: 'player',
    status: phase,
    title: session.title,
    index: session.currentIndex,
    total: session.questions.length,
    serverNow: now,
    startsAt: session.startsAtMs || null,
    endsAt: session.endsAtMs || null,
    question: showQuestion ? publicQuestion(q) : null,
    me: {
      nickname: me.nickname,
      score: me.score,
      rank: meRanked.rank,
      streak: me.streak,
      playerCount: ranked.length,
    },
    answered: phase === 'question' || phase === 'countdown' ? !!myAnswer : false,
    myChoice: myAnswer && phase === 'question' ? myAnswer.choice : null,
  };

  if (q && revealed) {
    const prev = previousRanks(ranked, deltasFor(model, q));
    view.result = {
      answered: !!myAnswer,
      correct: !!myAnswer?.correct,
      points: myAnswer?.points ?? 0,
      choice: myAnswer?.choice ?? null,
      correctOptions: q.correct,
      streak: me.streak,
      prevRank: prev.get(playerId) ?? meRanked.rank,
    };
  }

  if (phase === 'leaderboard' || phase === 'finished') {
    view.top = ranked.slice(0, TOP_N).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      rank: p.rank,
      isMe: p.id === playerId,
    }));
  }
  return view;
}

module.exports = { derivePhase, publicQuestion, hostView, playerView, distribution, deltasFor };
