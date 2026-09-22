// Транскриптті дайын сұрақ банкімен біріктіріп, Gemini-ден протокол
// (әр сұраққа бір жауап) алу. Барлық таза функциялар (buildPrompt,
// repairAnswers, assembleProtocol) желісіз тексеріледі; желіге шығатын
// жалғыз жер — callGemini, ол сынақта ауыстырылады.

const { questionsFor, ROLE_LABEL } = require('./questions');

// 2026-09: gemini-2.5-flash жаңа пайдаланушыларға жабылған (Google API-дің
// өзі gemini-3.6-flash-ты айтады). Модель тағы ауысса, Railway-де
// GEMINI_MODEL айнымалысын қою жеткілікті — кодты өзгерту керек емес.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

class GeminiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code; // 'no_key' | 'http' | 'bad_response'
  }
}

// Модельге бір сөйлеммен айтылатын стиль ережесі: транскриптте нақты
// айтылғанды ғана, жанама сөйлеумен (дейді/айтады), 1–3 сөйлем, ойдан
// қосу жоқ. Сұрақ мәтінінің өзін біз құрастырамыз — модельге тек
// жауаптар керек, тәртібі сұрақ санына сай, дәл сол ұзындықта.
function buildPrompt(role, transcript) {
  const questions = questionsFor(role);
  const label = ROLE_LABEL[role] || role;
  const numbered = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

  const systemInstruction = [
    'Сен JUZ40 компаниясының сапа менеджеріне CustDev сұхбатының транскриптін',
    'протоколға айналдыруға көмектесесің. Респондент рөлі: ' + label + '.',
    '',
    'Ережелер:',
    '- Тек транскриптте нақты айтылған ақпаратты қолдан, ештеңе ойдан қосба.',
    '- Жауапты жанама сөйлеммен жаз (мыс: «...дейді», «...айтады», «...атап өтті»),',
    '  сұхбаттасушының нақты сөзін мүмкіндігінше қысқа дәйексөз ретінде («...» ішінде) кіргіз —',
    '  әсіресе бояулы, эмоциялы немесе нақты бір затты сипаттайтын сөйлемдерде.',
    '- Аты-жөнін, санды (топтағы адам саны, балл, жыл, күн) және мекен-жайды дәл сол',
    '  күйінде сақта — дөңгелектеп жалпылама («көп адам» деп) жазба, нақты санын бер.',
    '- Сұхбаттасушы алдымен қысқа/теріс жауап беріп («жоқ», «білмеймін»), сосын нақтылау',
    '  сұрағынан кейін не әңгіменің басқа жерінде НАҚТЫ бір жайтты айтса — сол НАҚТЫ,',
    '  соңғы айтылған жайтты жаз (алғашқы жалпы «жоқ» деген жауапты емес).',
    '- Сұхбаттасушы бұрын бір нәрсені сұрап (мыс: ауысу, өзгерту), бірақ оған бас тартылғанын',
    '  немесе әлі шешілмегенін айтса — бұл ЕҢ МАҢЫЗДЫ дерек, оны міндетті түрде дәл сол',
    '  сұрақтың астында анық жаз, жалпылап өтпе.',
    '- Әр дерек/жайтты дәл БІР сұрақтың астына жаз — сол сұраққа жаңа ештеңе айтылмаса,',
    '  басқа сұрақтың жауабын қайталамай, дәл "-" деп қалдыр.',
    '- Әр жауап 1–3 сөйлем, қысқа әрі нақты болсын — бірақ қысқарту үшін нақты дерек',
    '  (сан, есім, «бас тартылды» деген сияқты нәтиже) құрбан болмасын.',
    '- Егер транскриптте сол сұраққа жауап мүлде болмаса, дәл "-" деп жаз (басқа ешнәрсе емес).',
    '- Бөгде пікір, баға немесе кеңес қоспа — тек транскриптегі мазмұнды құрылымда.',
    '',
    'Сұрақтар (тәртібімен, нөмірленген):',
    numbered,
    '',
    `Жауап саны транскрипт нешеу сұрақты қамтығанына қарамастан дәл ${questions.length} болуы керек —`,
    'әр сұраққа бір жауап, сол тәртіппен.',
  ].join('\n');

  const userText = `ТРАНСКРИПТ:\n${transcript.trim()}`;

  return { systemInstruction, userText, questionCount: questions.length };
}

// Модель кейде code fence-пен ("```json ... ```") қоршап жібереді, кейде
// массивті тікелей, кейде {answers:[...]} деп қайтарады — бәрін көтереміз.
function extractAnswers(raw, expectedCount) {
  let text = String(raw || '').trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1].trim();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GeminiError('Модельдің жауабы JSON емес', 'bad_response');
  }

  const list = Array.isArray(data) ? data : Array.isArray(data?.answers) ? data.answers : null;
  if (!list) throw new GeminiError('Модельдің жауабында "answers" тізімі жоқ', 'bad_response');

  return repairAnswers(list, expectedCount);
}

// Санын дәл сұрақ санына түзейді: жетпесе "-" деп толтырады, артық болса қиып тастайды.
// Бос/тым қысқа жолдарды "-" деп есептейміз — модель кейде "" қайтарады.
function repairAnswers(list, expectedCount) {
  const clean = list.map((a) => {
    const s = String(a ?? '').trim();
    return s.length ? s : '-';
  });
  while (clean.length < expectedCount) clean.push('-');
  return clean.slice(0, expectedCount);
}

function assembleProtocol(role, answers) {
  const questions = questionsFor(role);
  return questions.map((q, i) => ({ question: q, answer: answers[i] ?? '-' }));
}

async function callGemini({ systemInstruction, userText }, { apiKey, model = DEFAULT_MODEL, timeoutMs = 55000 } = {}) {
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { answers: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['answers'],
      },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new GeminiError(`Gemini-ге қосылу мүмкін болмады: ${err.message}`, 'http');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new GeminiError(`Gemini қатесі: ${msg}`, 'http');
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new GeminiError('Gemini бос жауап қайтарды', 'bad_response');
  return text;
}

// role + transcript → [{question, answer}]. deps.call — сынақ үшін ауыстырылады.
async function generateProtocol({ role, transcript }, deps = {}) {
  const apiKey = deps.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError('GEMINI_API_KEY орнатылмаған', 'no_key');
  if (!transcript || !transcript.trim()) throw new GeminiError('Транскрипт бос', 'bad_response');

  const call = deps.call || callGemini;
  const prompt = buildPrompt(role, transcript);
  const raw = await call(prompt, { apiKey, model: deps.model });
  const answers = extractAnswers(raw, prompt.questionCount);
  return assembleProtocol(role, answers);
}

module.exports = {
  GeminiError, buildPrompt, extractAnswers, repairAnswers, assembleProtocol, callGemini, generateProtocol,
};
