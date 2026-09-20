import { describe, it, expect } from 'vitest';

const { isCorrect, streakBonus, scoreAnswer } = require('./scoring');
const { rankPlayers, previousRanks } = require('./ranking');
const { validateQuiz, normalizeNickname, validateChoice, cleanBlock } = require('./validate');
const { derivePhase, hostView, playerView } = require('./views');
const { sanitizeInput } = require('../middleware/security');

// ── ұпай ───────────────────────────────────────────────────────────
describe('scoreAnswer', () => {
  const base = { correct: true, timeLimitMs: 20000, pointsMode: 'standard', streakBefore: 0 };

  it('gives 1000 for an instant correct answer', () => {
    expect(scoreAnswer({ ...base, responseMs: 0 }).points).toBe(1000);
  });

  it('gives 500 for a correct answer at the very last moment', () => {
    expect(scoreAnswer({ ...base, responseMs: 20000 }).points).toBe(500);
  });

  it('scales linearly with speed', () => {
    expect(scoreAnswer({ ...base, responseMs: 10000 }).points).toBe(750);
  });

  it('never goes below 500 even if the response time exceeds the limit', () => {
    expect(scoreAnswer({ ...base, responseMs: 99999 }).points).toBe(500);
  });

  it('treats negative response time as instant', () => {
    expect(scoreAnswer({ ...base, responseMs: -50 }).points).toBe(1000);
  });

  it('gives nothing for a wrong answer, whatever the speed or streak', () => {
    expect(scoreAnswer({ ...base, correct: false, responseMs: 0, streakBefore: 9 }).points).toBe(0);
  });

  it('doubles the base points on a double question', () => {
    expect(scoreAnswer({ ...base, pointsMode: 'double', responseMs: 0 }).points).toBe(2000);
  });

  it('gives nothing on a no-points question, even with a streak', () => {
    expect(scoreAnswer({ ...base, pointsMode: 'none', responseMs: 0, streakBefore: 5 }).points).toBe(0);
  });

  it('adds a streak bonus from the second correct answer on', () => {
    expect(scoreAnswer({ ...base, responseMs: 0, streakBefore: 0 }).bonus).toBe(0);
    expect(scoreAnswer({ ...base, responseMs: 0, streakBefore: 1 }).bonus).toBe(100);
    expect(scoreAnswer({ ...base, responseMs: 0, streakBefore: 3 }).points).toBe(1300);
  });

  it('caps the streak bonus at 500', () => {
    expect(streakBonus(5)).toBe(500);
    expect(streakBonus(50)).toBe(500);
  });

  it('does not double the streak bonus on a double question', () => {
    const r = scoreAnswer({ ...base, pointsMode: 'double', responseMs: 0, streakBefore: 2 });
    expect(r.base).toBe(2000);
    expect(r.bonus).toBe(200);
  });

  it('skips the bonus when streaks are switched off', () => {
    expect(scoreAnswer({ ...base, responseMs: 0, streakBefore: 4, streakBonusOn: false }).points).toBe(1000);
  });

  it('survives garbage input without producing NaN', () => {
    const r = scoreAnswer({ correct: true, responseMs: 'abc', timeLimitMs: 0, pointsMode: 'standard', streakBefore: undefined });
    expect(Number.isFinite(r.points)).toBe(true);
  });
});

describe('isCorrect', () => {
  it('matches a single correct option', () => {
    expect(isCorrect([2], [2])).toBe(true);
    expect(isCorrect([1], [2])).toBe(false);
  });

  it('requires the exact set on multi-answer questions — no partial credit', () => {
    expect(isCorrect([0, 2], [0, 2])).toBe(true);
    expect(isCorrect([2, 0], [0, 2])).toBe(true);
    expect(isCorrect([0], [0, 2])).toBe(false);
    expect(isCorrect([0, 1, 2], [0, 2])).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isCorrect(null, [0])).toBe(false);
    expect(isCorrect([0, 0], [0, 1])).toBe(false);
  });
});

// ── рейтинг ────────────────────────────────────────────────────────
describe('rankPlayers', () => {
  const p = (id, score, totalMs, joinedAtMs = id) => ({ id, nickname: `p${id}`, score, totalMs, joinedAtMs });

  it('orders by score, highest first', () => {
    expect(rankPlayers([p(1, 100, 0), p(2, 900, 0), p(3, 500, 0)]).map((x) => x.id)).toEqual([2, 3, 1]);
  });

  it('breaks a score tie by total response time — the faster player wins', () => {
    const ranked = rankPlayers([p(1, 500, 9000), p(2, 500, 4000)]);
    expect(ranked[0].id).toBe(2);
  });

  it('breaks a full tie by who joined first, so ranks are never shared', () => {
    const ranked = rankPlayers([p(1, 500, 1000, 200), p(2, 500, 1000, 100)]);
    expect(ranked.map((x) => x.rank)).toEqual([1, 2]);
    expect(ranked[0].id).toBe(2);
  });

  it('does not mutate its input', () => {
    const input = [p(1, 1, 0), p(2, 9, 0)];
    rankPlayers(input);
    expect(input[0].id).toBe(1);
  });
});

describe('previousRanks', () => {
  it('rewinds this question’s points to find the rank before it', () => {
    const now = [
      { id: 1, score: 1800, totalMs: 4000, joinedAtMs: 1 },
      { id: 2, score: 1500, totalMs: 4000, joinedAtMs: 2 },
    ];
    // 1-ші ойыншы осы сұрақта 1000 алды: онсыз ол 800 болып, 1000 ұпайлы
    // (1500 − 500) 2-шіден төмен тұратын еді, яғни ол 2-орыннан 1-орынға көтерілді.
    const deltas = new Map([[1, { points: 1000, ms: 1000 }], [2, { points: 500, ms: 1000 }]]);
    const prev = previousRanks(now, deltas);
    expect(prev.get(1)).toBe(2);
    expect(prev.get(2)).toBe(1);
  });

  it('keeps the tie-break rule when the rewound scores are equal', () => {
    const now = [
      { id: 1, score: 1800, totalMs: 4000, joinedAtMs: 1 },
      { id: 2, score: 1500, totalMs: 4000, joinedAtMs: 2 },
    ];
    // Екеуі де 800-ге тең түседі, уақыты да тең — ертерек қосылған бірінші.
    const deltas = new Map([[1, { points: 1000, ms: 1000 }], [2, { points: 700, ms: 1000 }]]);
    const prev = previousRanks(now, deltas);
    expect(prev.get(1)).toBe(1);
  });
});

// ── валидация ──────────────────────────────────────────────────────
const goodQuestion = (over = {}) => ({
  kind: 'choice', prompt: 'Жарық жылдамдығы қанша?', options: ['3·10⁸ м/с', '3·10⁶ м/с', '340 м/с'],
  correct: [0], timeLimit: 20, pointsMode: 'standard', ...over,
});

describe('validateQuiz', () => {
  it('accepts a well-formed quiz and normalises it', () => {
    const r = validateQuiz({ title: '  Оптика  ', questions: [goodQuestion()] });
    expect(r.ok).toBe(true);
    expect(r.value.title).toBe('Оптика');
    expect(r.value.questions[0].correct).toEqual([0]);
  });

  it('requires a title and at least one question', () => {
    const r = validateQuiz({ title: '', questions: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['title', 'questions']));
  });

  it('reports errors against the exact question, in Kazakh', () => {
    const r = validateQuiz({ title: 'x', questions: [goodQuestion(), goodQuestion({ prompt: '' })] });
    expect(r.errors[0].field).toBe('questions[1].prompt');
    expect(r.errors[0].message).toContain('2-сұрақ');
  });

  it('rejects a question with no correct answer', () => {
    expect(validateQuiz({ title: 'x', questions: [goodQuestion({ correct: [] })] }).ok).toBe(false);
  });

  it('rejects a correct index that does not exist', () => {
    expect(validateQuiz({ title: 'x', questions: [goodQuestion({ correct: [7] })] }).ok).toBe(false);
  });

  it('rejects marking every option correct', () => {
    expect(validateQuiz({ title: 'x', questions: [goodQuestion({ correct: [0, 1, 2] })] }).ok).toBe(false);
  });

  it('allows several correct answers when not all are correct', () => {
    expect(validateQuiz({ title: 'x', questions: [goodQuestion({ correct: [0, 2] })] }).ok).toBe(true);
  });

  it('rejects blank options and too few options', () => {
    expect(validateQuiz({ title: 'x', questions: [goodQuestion({ options: ['a', ''] })] }).ok).toBe(false);
    expect(validateQuiz({ title: 'x', questions: [goodQuestion({ options: ['a'], correct: [0] })] }).ok).toBe(false);
  });

  it('caps options at four', () => {
    const r = validateQuiz({ title: 'x', questions: [goodQuestion({ options: ['a', 'b', 'c', 'd', 'e'], correct: [0] })] });
    expect(r.value.questions[0].options).toHaveLength(4);
  });

  it('forces the fixed options on a true/false question and needs exactly one answer', () => {
    const ok = validateQuiz({ title: 'x', questions: [{ kind: 'truefalse', prompt: 'Жер жалпақ', correct: [1], timeLimit: 10 }] });
    expect(ok.ok).toBe(true);
    expect(ok.value.questions[0].options).toEqual(['Дұрыс', 'Бұрыс']);
    const bad = validateQuiz({ title: 'x', questions: [{ kind: 'truefalse', prompt: 'x', correct: [0, 1], timeLimit: 10 }] });
    expect(bad.ok).toBe(false);
  });

  it('rejects out-of-range time limits', () => {
    expect(validateQuiz({ title: 'x', questions: [goodQuestion({ timeLimit: 2 })] }).ok).toBe(false);
    expect(validateQuiz({ title: 'x', questions: [goodQuestion({ timeLimit: 999 })] }).ok).toBe(false);
    expect(validateQuiz({ title: 'x', questions: [goodQuestion({ timeLimit: 20.5 })] }).ok).toBe(false);
  });

  it('falls back to safe defaults for unknown kind / points mode', () => {
    const r = validateQuiz({ title: 'x', questions: [goodQuestion({ kind: 'hack', pointsMode: 'free' })] });
    expect(r.value.questions[0].kind).toBe('choice');
    expect(r.value.questions[0].pointsMode).toBe('standard');
  });

  it('keeps line breaks in a prompt (problem statements need them) but caps blank runs', () => {
    expect(cleanBlock('Берілген:\n\n\n\nm = 2 кг', 500)).toBe('Берілген:\n\nm = 2 кг');
  });

  it('refuses a quiz over the question limit', () => {
    const many = Array.from({ length: 81 }, () => goodQuestion());
    expect(validateQuiz({ title: 'x', questions: many }).ok).toBe(false);
  });
});

describe('normalizeNickname', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeNickname('  Ерасыл   Қ  ').value).toBe('Ерасыл Қ');
  });

  it('accepts Kazakh letters, digits and emoji', () => {
    expect(normalizeNickname('Ғалымжан_07').ok).toBe(true);
    expect(normalizeNickname('Аружан 😎').ok).toBe(true);
  });

  it('rejects too short and too long', () => {
    expect(normalizeNickname('а').ok).toBe(false);
    expect(normalizeNickname('а'.repeat(21)).ok).toBe(false);
  });

  it('rejects markup and punctuation-only names', () => {
    expect(normalizeNickname('<script>').ok).toBe(false);
    expect(normalizeNickname('...').ok).toBe(false);
  });

  it('strips invisible characters so two lookalike names cannot coexist', () => {
    expect(normalizeNickname('Ая​н').value).toBe('Аян');
  });
});

describe('validateChoice', () => {
  const single = { options: ['a', 'b', 'c'], correct: [1] };
  const multi = { options: ['a', 'b', 'c', 'd'], correct: [0, 2] };

  it('needs exactly one pick on a single-answer question', () => {
    expect(validateChoice(single, [1]).ok).toBe(true);
    expect(validateChoice(single, [0, 1]).ok).toBe(false);
  });

  it('allows any number of picks on a multi-answer question', () => {
    expect(validateChoice(multi, [0]).ok).toBe(true);
    expect(validateChoice(multi, [3, 0, 2]).value).toEqual([0, 2, 3]);
  });

  it('rejects empty, out-of-range, duplicate and non-integer picks', () => {
    expect(validateChoice(single, []).ok).toBe(false);
    expect(validateChoice(single, [9]).ok).toBe(false);
    expect(validateChoice(multi, [1, 1]).ok).toBe(false);
    expect(validateChoice(single, ['1']).ok).toBe(false);
    expect(validateChoice(single, null).ok).toBe(false);
  });
});

// ── көріністер: дұрыс жауап жасырын болуы ─────────────────────────
describe('views never leak the answer early', () => {
  const questions = [
    { kind: 'choice', prompt: 'Q1', options: ['a', 'b', 'c'], correct: [1], timeLimit: 20, pointsMode: 'standard' },
    { kind: 'choice', prompt: 'Q2', options: ['a', 'b', 'c'], correct: [0, 2], timeLimit: 20, pointsMode: 'standard' },
  ];
  const mk = (status, over = {}) => ({
    session: {
      id: 1, pin: '123456', title: 'T', status, currentIndex: 0, locked: false,
      startsAtMs: 10_000, endsAtMs: 30_000, questions, settings: {}, ...over,
    },
    players: [
      { id: 1, nickname: 'Аян', score: 1000, streak: 1, totalMs: 2000, kicked: false, joinedAtMs: 1 },
      { id: 2, nickname: 'Бек', score: 0, streak: 0, totalMs: 20000, kicked: false, joinedAtMs: 2 },
      { id: 3, nickname: 'Кик', score: 999, streak: 0, totalMs: 1, kicked: true, joinedAtMs: 3 },
    ],
    answers: [{ playerId: 1, questionIndex: 0, choice: [1], correct: true, responseMs: 2000, points: 1000 }],
  });

  it('derives a countdown phase before the question opens', () => {
    expect(derivePhase(mk('question').session, 5_000)).toBe('countdown');
    expect(derivePhase(mk('question').session, 12_000)).toBe('question');
    expect(derivePhase(mk('reveal').session, 12_000)).toBe('reveal');
  });

  it('hides the question text during the countdown — for the host and the player', () => {
    expect(hostView(mk('question'), 5_000).question).toBeNull();
    expect(playerView(mk('question'), 1, 5_000).question).toBeNull();
  });

  it('withholds the correct answer from the host while the question is open', () => {
    const v = hostView(mk('question'), 12_000);
    expect(v.question.prompt).toBe('Q1');
    expect(v.question).not.toHaveProperty('correct');
    expect(v).not.toHaveProperty('distribution');
  });

  it('never tells a player whether they were right while the question is open', () => {
    const v = playerView(mk('question'), 1, 12_000);
    expect(v.answered).toBe(true);
    expect(v).not.toHaveProperty('result');
    expect(JSON.stringify(v)).not.toContain('"correct"');
  });

  it('only says a question has several correct answers, not which', () => {
    const v = playerView(mk('question', { currentIndex: 1 }), 2, 12_000);
    expect(v.question.multi).toBe(true);
    expect(v.question).not.toHaveProperty('correct');
  });

  it('reveals the correct answer and distribution only at reveal', () => {
    const v = hostView(mk('reveal'), 40_000);
    expect(v.question.correct).toEqual([1]);
    expect(v.distribution.counts).toEqual([0, 1, 0]);
    expect(v.distribution.noAnswer).toBe(1);
  });

  it('gives each player their own result at reveal', () => {
    const right = playerView(mk('reveal'), 1, 40_000).result;
    expect(right.correct).toBe(true);
    expect(right.points).toBe(1000);
    const silent = playerView(mk('reveal'), 2, 40_000).result;
    expect(silent.answered).toBe(false);
    expect(silent.correct).toBe(false);
  });

  it('excludes kicked players everywhere and tells them they are out', () => {
    expect(hostView(mk('reveal'), 40_000).players.map((p) => p.id)).toEqual([1, 2]);
    expect(playerView(mk('reveal'), 3, 40_000).status).toBe('kicked');
  });

  it('ranks the leaderboard and shows movement', () => {
    const v = hostView(mk('leaderboard'), 40_000);
    expect(v.leaderboard[0]).toMatchObject({ nickname: 'Аян', rank: 1 });
    expect(v.leaderboard[0].delta).toBe(1000);
  });
});

// ── санитайзер: викторина мәтіні бұзылмайды ───────────────────────
describe('sanitizeInput', () => {
  const run = (url, body) => {
    const req = { originalUrl: url, body };
    sanitizeInput(req, {}, () => {});
    return req.body;
  };

  it('still scrubs ordinary routes', () => {
    expect(run('/api/auth/profile', { a: '<script>x</script>hi' }).a).toBe('hi');
  });

  it('would mangle physics text on ordinary routes — which is why quizzes are exempt', () => {
    expect(run('/api/other', { a: 'ionization = 5' }).a).not.toBe('ionization = 5');
  });

  it('leaves quiz text untouched', () => {
    const body = { title: 'Оптика', questions: [{ prompt: 'constant = 5, ionization = 2' }] };
    expect(run('/api/quizzes', body).questions[0].prompt).toBe('constant = 5, ionization = 2');
    expect(run('/api/quizzes/12', body).questions[0].prompt).toBe('constant = 5, ionization = 2');
  });
});
