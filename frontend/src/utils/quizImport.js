// Мәтіннен викторина сұрақтарын оқу. Мұғалім сұрақтарын Word-тан, Telegram-нан
// не ChatGPT-ден көшіріп қояды, ол өзі сұрақ пен дұрыс жауапқа айналады:
//
//   1. Қазақстанның астанасы?
//   A) Алматы
//   B) Астана ✓
//   C) Шымкент
//
// Дұрыс жауап — соңында ✓ (бірнеше нұсқада болса, «бірнеше дұрыс жауап»).
// Не жеке жол: «Жауап: B». Латын A–D да, кирилл А В С Д да қабылданады.
//
// Тек таза функциялар: браузерде де, тестте де бірдей істейді.

export const IMPORT_LIMITS = { maxQuestions: 80, maxPrompt: 500, maxOption: 150, minOptions: 2, maxOptions: 4 };

const TRUE_FALSE = ['Дұрыс', 'Бұрыс'];

// Нұсқа әрпі: латын A–D және оларға ұқсас кирилл А, В, С (+ Д): Word пен телефон көбіне кириллді қояды.
const OPTION_LINE = /^([A-Da-dАВСДавсд])\s*[.):]\s*(.*)$/u;
// «1.5 кг…» жаңа сұрақ емес: нүктеден кейін бос орын немесе әріп болуы керек.
const QUESTION_LINE = /^(\d{1,3})\s*[.)](?:\s+|(?=\D)|$)(.*)$/u;
const ANSWER_LINE = /^(?:дұрыс\s+жауап|жауап|ответ|answer)\s*[:\-–]\s*([A-Da-dАВСДавсд](?:\s*[,;/]\s*[A-Da-dАВСДавсд])*)\s*$/iu;
const CHECK_TAIL = /\s*(?:[✓✔✅☑√]|\(\s*дұрыс\s*\))\s*$/iu;

const LETTER_INDEX = { a: 0, b: 1, c: 2, d: 3, 'а': 0, 'в': 1, 'с': 2, 'д': 3 };
const indexOfLetter = (ch) => LETTER_INDEX[ch.toLowerCase()];

function splitMark(text) {
  const t = text.trim();
  return CHECK_TAIL.test(t) ? { text: t.replace(CHECK_TAIL, '').trim(), marked: true } : { text: t, marked: false };
}

// Мәтінді сұрақ блоктарына бөледі (әлі тексерусіз).
function toBlocks(raw) {
  const blocks = [];
  let cur = null;

  for (const line of String(raw).replace(/\r/g, '').split('\n')) {
    const t = line.trim();
    if (!t) continue;

    const q = QUESTION_LINE.exec(t);
    if (q) {
      cur = { number: Number(q[1]), prompt: q[2].trim(), options: [], correct: new Set(), answerLine: null };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue; // бірінші сұрақтан бұрынғы жол (тақырып т.с.с.) — елемейміз

    const a = ANSWER_LINE.exec(t);
    if (a && cur.options.length) {
      cur.answerLine = a[1].split(/[,;/]/).map((s) => indexOfLetter(s.trim())).filter((n) => n !== undefined);
      continue;
    }

    const o = OPTION_LINE.exec(t);
    if (o) {
      const { text, marked } = splitMark(o[2]);
      cur.options.push(text);
      if (marked) cur.correct.add(cur.options.length - 1);
      continue;
    }

    // Келесі жолға ауысқан мәтін: сұрақтың не соңғы нұсқаның жалғасы.
    if (cur.options.length === 0) {
      cur.prompt = `${cur.prompt} ${t}`.trim();
    } else {
      const last = cur.options.length - 1;
      const { text, marked } = splitMark(`${cur.options[last]} ${t}`);
      cur.options[last] = text;
      if (marked) cur.correct.add(last);
    }
  }
  return blocks;
}

// → { questions: [...дұрыстары], problems: [{ number, message }], found }
export function parseQuizText(raw) {
  const L = IMPORT_LIMITS;
  const questions = [];
  const problems = [];
  const blocks = toBlocks(raw);

  blocks.forEach((b, i) => {
    const number = b.number || i + 1;
    const fail = (message) => problems.push({ number, message });

    // «Жауап: B» жолы ✓ белгісінің орнына жүреді (екеуі де болса — бірігеді).
    const correct = new Set(b.correct);
    (b.answerLine || []).forEach((n) => correct.add(n));

    if (!b.prompt) return fail('сұрақ мәтіні жоқ');
    if (b.prompt.length > L.maxPrompt) return fail(`сұрақ ${L.maxPrompt} таңбадан ұзын`);
    if (b.options.length < L.minOptions || b.options.length > L.maxOptions) {
      return fail(`${L.minOptions}–${L.maxOptions} нұсқа керек, табылғаны: ${b.options.length}`);
    }
    if (b.options.some((o) => !o)) return fail('бос жауап нұсқасы бар');
    if (b.options.some((o) => o.length > L.maxOption)) return fail(`нұсқа ${L.maxOption} таңбадан ұзын`);
    if (correct.size === 0) return fail('дұрыс жауап белгіленбеген (соңына ✓ қойыңыз)');
    if ([...correct].some((n) => n >= b.options.length)) return fail('дұрыс жауап көрсетілген нұсқа жоқ');
    if (correct.size >= b.options.length) return fail('барлық нұсқа дұрыс деп белгіленген');

    const isTrueFalse = b.options.length === 2
      && b.options.every((o, k) => o.toLowerCase() === TRUE_FALSE[k].toLowerCase());
    questions.push({
      kind: isTrueFalse ? 'truefalse' : 'choice',
      prompt: b.prompt,
      options: isTrueFalse ? [...TRUE_FALSE] : b.options,
      correct: [...correct].sort((x, y) => x - y),
      multi: correct.size > 1,
    });
  });

  return { questions, problems, found: blocks.length };
}
