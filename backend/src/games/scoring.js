const { MAX_POINTS, STREAK_STEP, STREAK_CAP } = require('./constants');

// Дұрыс жауап — таңдалған нұсқалар жиыны дұрыс нұсқалар жиынымен ДӘЛ
// сәйкес келгенде ғана (бірнеше дұрыс жауабы бар сұрақта жартылай балл жоқ).
function isCorrect(choice, correct) {
  if (!Array.isArray(choice) || !Array.isArray(correct)) return false;
  if (choice.length !== correct.length) return false;
  const want = new Set(correct);
  return choice.every((c) => want.has(c)) && new Set(choice).size === choice.length;
}

// Қатарынан дұрыс жауап бергені үшін үстеме: 2-шісінен бастап +100,
// 6-шысынан бастап +500 (шегі). streakBefore — ОСЫ жауапқа дейінгі серия.
function streakBonus(streakBefore) {
  const n = Math.min(Math.max(Math.floor(streakBefore) || 0, 0), STREAK_CAP);
  return n * STREAK_STEP;
}

// Ұпайды есептеу.
//   • қате жауап немесе ұпайсыз сұрақ — 0
//   • дұрыс: 1000 · (1 − (жауап уақыты / шек) / 2) — яғни бірден жауап
//     берсе 1000, соңғы мүмкін сәтте 500
//   • «double» сұрақта базалық ұпай екі есе (үстеме екі еселенбейді)
function scoreAnswer({ correct, responseMs, timeLimitMs, pointsMode, streakBefore, streakBonusOn = true }) {
  if (!correct || pointsMode === 'none') return { points: 0, base: 0, bonus: 0 };

  const limit = Math.max(Number(timeLimitMs) || 1, 1);
  const ratio = Math.min(Math.max(Number(responseMs) || 0, 0) / limit, 1);

  let base = Math.round(MAX_POINTS * (1 - ratio / 2));
  if (pointsMode === 'double') base *= 2;

  const bonus = streakBonusOn ? streakBonus(streakBefore) : 0;
  return { points: base + bonus, base, bonus };
}

module.exports = { isCorrect, streakBonus, scoreAnswer };
