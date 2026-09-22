import { describe, it, expect, vi } from 'vitest';

const {
  GeminiError, buildPrompt, extractAnswers, repairAnswers, assembleProtocol, generateProtocol,
} = require('./gemini');
const { questionsFor } = require('./questions');

describe('buildPrompt', () => {
  it('рөлдің сұрақ санын дәл сол тәртіппен қосады', () => {
    const p = buildPrompt('student', 'Сәлем, мен ...');
    const qs = questionsFor('student');
    expect(p.questionCount).toBe(qs.length);
    qs.forEach((q, i) => expect(p.systemInstruction).toContain(`${i + 1}. ${q}`));
    expect(p.userText).toContain('ТРАНСКРИПТ:');
    expect(p.userText).toContain('Сәлем, мен ...');
  });

  it('транскриптегі бос орындарды қияды', () => {
    const p = buildPrompt('parent', '   мәтін   \n\n');
    expect(p.userText).toBe('ТРАНСКРИПТ:\nмәтін');
  });

  it('белгісіз рөлге қате лақтырады', () => {
    expect(() => buildPrompt('director', 'x')).toThrow();
  });

  // Нақты жазбамен салыстырғанда (қолмен жазылған протоколмен) байқалған
  // кемшіліктерден кейін қосылған ережелер: сандарды/есімдерді сақтау,
  // алдымен «жоқ» деп, кейін мойындалған жайтты қалдырмау, бір дерек екі
  // сұраққа бөлінбеу, бас тартылған сұраныс міндетті түрде жазылу керек.
  it('дәлдік ережелері промптта нақты тұр (сан/есім, қайшылық, қайталанбау, бас тарту)', () => {
    const { systemInstruction: s } = buildPrompt('student', 'x');
    expect(s).toMatch(/санды.*сақта/s);
    expect(s).toMatch(/соңғы айтылған жайтты жаз/);
    expect(s).toMatch(/ЕҢ МАҢЫЗДЫ дерек/);
    expect(s).toMatch(/дәл БІР сұрақтың астына жаз/);
  });
});

describe('repairAnswers', () => {
  it('жетпейтін жауапты "-" деп толтырады', () => {
    expect(repairAnswers(['а', 'б'], 4)).toEqual(['а', 'б', '-', '-']);
  });
  it('артық жауапты қияды', () => {
    expect(repairAnswers(['а', 'б', 'в', 'г', 'д'], 3)).toEqual(['а', 'б', 'в']);
  });
  it('бос жолды "-" деп есептейді', () => {
    expect(repairAnswers(['а', '  ', ''], 3)).toEqual(['а', '-', '-']);
  });
  it('null/undefined элементтерге де төзімді', () => {
    expect(repairAnswers(['а', null, undefined], 3)).toEqual(['а', '-', '-']);
  });
});

describe('extractAnswers', () => {
  it('{answers:[...]} пішінін оқиды', () => {
    expect(extractAnswers('{"answers":["а","б"]}', 2)).toEqual(['а', 'б']);
  });
  it('жалаң массивті де оқиды', () => {
    expect(extractAnswers('["а","б","в"]', 3)).toEqual(['а', 'б', 'в']);
  });
  it('```json ... ``` қоршауын алып тастайды', () => {
    expect(extractAnswers('```json\n{"answers":["а"]}\n```', 1)).toEqual(['а']);
  });
  it('санын дәл сұрақ санына түзейді', () => {
    expect(extractAnswers('{"answers":["а"]}', 3)).toEqual(['а', '-', '-']);
  });
  it('JSON емес мәтінге GeminiError(bad_response) лақтырады', () => {
    try {
      extractAnswers('мен JSON емеспін', 2);
      throw new Error('лақтырылмады');
    } catch (err) {
      expect(err).toBeInstanceOf(GeminiError);
      expect(err.code).toBe('bad_response');
    }
  });
  it('"answers" кілті жоқ объектіге қате лақтырады', () => {
    expect(() => extractAnswers('{"foo":1}', 2)).toThrow(GeminiError);
  });
});

describe('assembleProtocol', () => {
  it('сұрақ мәтінін өзі қосады, жауапты сол ретпен байланыстырады', () => {
    const qs = questionsFor('curator');
    const out = assembleProtocol('curator', qs.map((_, i) => `жауап${i}`));
    expect(out).toHaveLength(qs.length);
    expect(out[0]).toEqual({ question: qs[0], answer: 'жауап0' });
    expect(out[out.length - 1].answer).toBe(`жауап${qs.length - 1}`);
  });
});

describe('generateProtocol', () => {
  it('GEMINI_API_KEY жоқ болса no_key қатесімен бірден тоқтайды (желіге шықпайды)', async () => {
    const call = vi.fn();
    await expect(generateProtocol({ role: 'student', transcript: 'x' }, { apiKey: '', call }))
      .rejects.toMatchObject({ code: 'no_key' });
    expect(call).not.toHaveBeenCalled();
  });

  it('бос транскриптке желіге шықпай-ақ қате қайтарады', async () => {
    const call = vi.fn();
    await expect(generateProtocol({ role: 'student', transcript: '   ' }, { apiKey: 'k', call }))
      .rejects.toBeInstanceOf(GeminiError);
    expect(call).not.toHaveBeenCalled();
  });

  it('call-дың нәтижесін толық протоколға жинайды', async () => {
    const qs = questionsFor('parent');
    const call = vi.fn().mockResolvedValue(JSON.stringify({ answers: qs.map((_, i) => `а${i}`) }));
    const out = await generateProtocol({ role: 'parent', transcript: 'транскрипт мәтіні' }, { apiKey: 'k', call });
    expect(call).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(qs.length);
    expect(out.map((x) => x.answer)).toEqual(qs.map((_, i) => `а${i}`));
  });

  it('call қате лақтырса, GeminiError сол күйінде өтеді', async () => {
    const call = vi.fn().mockRejectedValue(new GeminiError('желі жоқ', 'http'));
    await expect(generateProtocol({ role: 'curator', transcript: 'x' }, { apiKey: 'k', call }))
      .rejects.toMatchObject({ code: 'http' });
  });
});
