// Мәтіннен викторина сұрақтарын оқу. Мұғалім сұрақтарын Word-тан, Telegram-нан
// не ChatGPT-ден көшіріп қояды, ол өзі сұрақ пен нұсқаларға айналады:
//
//   1. Қазақстанның астанасы?
//   A) Алматы
//   B) Астана ✓
//   C) Шымкент
//
// Дұрыс жауапты белгілеудің бірнеше жолы бар — пернетақтада ✓ жоқ болса да:
//   • нұсқаның соңында ✓ ✔️ ✅ ☑️, не * , не « +», не (дұрыс);  «*B) …» — алдында да болады
//   • сұрақтан кейін жеке жол:   Жауап: B
//   • мәтіннің соңында кілт:      Жауаптар: 1-B, 2-A, 3-C   (не әр жолға бір-бірден)
//   • ештеңе жазбаса — сұрақ «жауапсыз» болып келеді де, келесі қадамда өзі басып таңдалады
// Латын A–D да, кирилл А В С Д да қабылданады.
//
// Тек таза функциялар: браузерде де, тестте де бірдей істейді.

export const IMPORT_LIMITS = { maxQuestions: 80, maxPrompt: 500, maxOption: 150, minOptions: 2, maxOptions: 4 };

const TRUE_FALSE = ['Дұрыс', 'Бұрыс'];

const LETTER = 'A-Da-dАВСДавсд'; // латын A–D және оларға ұқсас кирилл А, В, С (+ Д)
const LETTER_INDEX = { a: 0, b: 1, c: 2, d: 3, 'а': 0, 'в': 1, 'с': 2, 'д': 3 };
const indexOfLetter = (ch) => LETTER_INDEX[ch.toLowerCase()];

// ✔️ мен ☑️ — iPhone эмодзи пернетақтасынан келгенде артында көрінбейтін
// U+FE0F тұрады; оны ескермесек, белгі танылмай қалады.
const MARK = '(?:[✓✔✅☑√]\\uFE0F?|\\*+|\\(\\s*[+✓✔]\\s*\\)|\\[\\s*[xXхХ✓✔]\\s*\\]|\\(\\s*(?:дұрыс|правильно|true)\\s*\\))';
// Жалғыз «+» тек бос орыннан кейін: «C++» немесе «a+b» белгі емес.
const CHECK_TAIL = new RegExp(`(?:\\s*${MARK}|\\s+\\+)\\s*$`, 'iu');
const LEAD_MARK = '(?:[✓✔✅☑√]\\uFE0F?|\\*+|\\+)';

const OPTION_LINE = new RegExp(`^(?:(${LEAD_MARK})\\s*)?([${LETTER}])\\s*[.):]\\s*(.*)$`, 'u');
// «1.5 кг…» жаңа сұрақ емес: нүктеден кейін бос орын немесе әріп болуы керек.
const QUESTION_LINE = /^(\d{1,3})\s*[.)](?:\s+|(?=\D)|$)(.*)$/u;
const ANSWER_LINE = new RegExp(`^(?:дұрыс\\s+жауап|жауап|ответ|answer)\\s*[:\\-–]\\s*([${LETTER}](?:\\s*[,;/]\\s*[${LETTER}])*)\\s*$`, 'iu');

// Мәтін соңындағы кілт: «Жауаптар: 1-B, 2-A» (тақырып тек «:»-мен не жалғыз тұрса).
const KEY_HEADER = /^(?:жауаптар(?:ы)?|жауап\s+кілті|кілттер|кілт|ответы|answers?|key)(?:\s*:\s*(.*)|\s*)$/iu;
const KEY_ITEM = new RegExp(`(\\d{1,3})\\s*[-–.):]?\\s*([${LETTER}](?:\\s*[,;/]\\s*[${LETTER}])*)(?![A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі])`, 'gu');

function splitMark(text) {
  const t = text.trim();
  return CHECK_TAIL.test(t) ? { text: t.replace(CHECK_TAIL, '').trim(), marked: true } : { text: t, marked: false };
}

// «1-B, 2-A, 3-A,C» → Map(1 → [1], 2 → [0], 3 → [0, 2])
function readKey(text, into) {
  for (const m of text.matchAll(KEY_ITEM)) {
    const n = Number(m[1]);
    if (into.has(n)) continue;
    into.set(n, m[2].split(/[,;/]/).map((s) => indexOfLetter(s.trim())).filter((i) => i !== undefined));
  }
}

// Мәтінді сұрақ блоктарына бөледі (әлі тексерусіз).
function toBlocks(raw) {
  const blocks = [];
  const key = new Map();
  let cur = null;
  let inKey = false;

  for (const line of String(raw).replace(/\r/g, '').split('\n')) {
    const t = line.trim();
    if (!t) continue;

    if (inKey) { readKey(t, key); continue; }
    const kh = KEY_HEADER.exec(t);
    if (kh && !QUESTION_LINE.test(t)) {
      inKey = true;
      if (kh[1]) readKey(kh[1], key);
      continue;
    }

    const q = QUESTION_LINE.exec(t);
    if (q) {
      cur = { number: Number(q[1]), prompt: q[2].trim(), options: [], correct: new Set() };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue; // бірінші сұрақтан бұрынғы жол (тақырып т.с.с.) — елемейміз

    const a = ANSWER_LINE.exec(t);
    if (a && cur.options.length) {
      a[1].split(/[,;/]/).map((s) => indexOfLetter(s.trim())).filter((n) => n !== undefined).forEach((n) => cur.correct.add(n));
      continue;
    }

    const o = OPTION_LINE.exec(t);
    if (o) {
      const { text, marked } = splitMark(o[3]);
      cur.options.push(text);
      if (marked || o[1]) cur.correct.add(cur.options.length - 1);
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
  return { blocks, key };
}

// → { questions, problems, found }
//   questions — оқылғандардың бәрі. Дұрыс жауабы табылмағандарында
//   correct: [] және needsAnswer: true — оны келесі қадамда пайдаланушы өзі таңдайды.
//   problems — сұрақ мүлде жарамсыз болғанда ғана (нұсқа саны, ұзындық) — ол өткізіледі.
export function parseQuizText(raw) {
  const L = IMPORT_LIMITS;
  const questions = [];
  const problems = [];
  const { blocks, key } = toBlocks(raw);

  blocks.forEach((b, i) => {
    const number = b.number || i + 1;
    const fail = (message) => problems.push({ number, message });

    // Кілт тек өз белгісі жоқ сұраққа қолданылады: ✓ бар болса, ол басым.
    const correct = new Set(b.correct);
    if (correct.size === 0 && key.has(number)) key.get(number).forEach((n) => correct.add(n));

    if (!b.prompt) return fail('сұрақ мәтіні жоқ');
    if (b.prompt.length > L.maxPrompt) return fail(`сұрақ ${L.maxPrompt} таңбадан ұзын`);
    if (b.options.length < L.minOptions || b.options.length > L.maxOptions) {
      return fail(`${L.minOptions}–${L.maxOptions} нұсқа керек, табылғаны: ${b.options.length}`);
    }
    if (b.options.some((o) => !o)) return fail('бос жауап нұсқасы бар');
    if (b.options.some((o) => o.length > L.maxOption)) return fail(`нұсқа ${L.maxOption} таңбадан ұзын`);
    if ([...correct].some((n) => n >= b.options.length)) return fail('дұрыс жауап көрсетілген нұсқа жоқ');
    if (correct.size >= b.options.length) return fail('барлық нұсқа дұрыс деп белгіленген');

    const isTrueFalse = b.options.length === 2
      && b.options.every((o, k) => o.toLowerCase() === TRUE_FALSE[k].toLowerCase());
    questions.push({
      number,
      kind: isTrueFalse ? 'truefalse' : 'choice',
      prompt: b.prompt,
      options: isTrueFalse ? [...TRUE_FALSE] : b.options,
      correct: [...correct].sort((x, y) => x - y),
      multi: correct.size > 1,
      needsAnswer: correct.size === 0,
    });
  });

  return { questions, problems, found: blocks.length };
}
