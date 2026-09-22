import { describe, it, expect } from 'vitest';

const { exportRoundText } = require('./export');

describe('exportRoundText', () => {
  const round = { title: 'CUSTDEV 0.1', note: 'сөйлесу аясы: 1 оқушы' };

  it('рөлдерді ОҚУШЫЛАР → АТА-АНА → КУРАТОРЛАР тәртібімен, тек барын топтайды', () => {
    const sessions = [
      { role: 'curator', respondentName: 'Ислам Х.', groupCode: 'ФИЗ-01', meetTimeLabel: '16:00-16:20', recordingRef: 'abc-defg-hij (2026-08-28)', protocol: [{ question: 'С1?', answer: 'Ж1' }] },
      { role: 'student', respondentName: 'Берік Б.', groupCode: 'ФИЗ-01', curatorName: 'Аяжан апай', recordingRef: 'xyz-1234-abc (2026-08-28)', protocol: [{ question: 'С1?', answer: 'Ж1' }] },
    ];
    const text = exportRoundText(round, sessions);
    const studentIdx = text.indexOf('ОҚУШЫЛАР');
    const curatorIdx = text.indexOf('КУРАТОРЛАР');
    expect(studentIdx).toBeGreaterThan(-1);
    expect(curatorIdx).toBeGreaterThan(studentIdx);
    expect(text).not.toContain('АТА-АНА'); // сол рөлден сұхбат жоқ — бөлім шықпайды
  });

  it('оқушыда куратор аты жақшамен шығады, куратордың өзінде шықпайды', () => {
    const sessions = [
      { role: 'student', respondentName: 'Берік Б.', groupCode: 'ФИЗ-01', curatorName: 'Аяжан апай', recordingRef: 'r', protocol: [] },
      { role: 'curator', respondentName: 'Аяжан апай', groupCode: 'ФИЗ-01', recordingRef: 'r', protocol: [] },
    ];
    const text = exportRoundText(round, sessions);
    expect(text).toContain('Берік Б. - ФИЗ-01\n(Аяжан апай)');
    // куратор блогында "(Аяжан апай)" қайталанып шықпайды (жақшамен емес, тікелей тақырып ретінде)
    const curatorBlock = text.slice(text.indexOf('КУРАТОРЛАР'));
    expect(curatorBlock).not.toMatch(/\(Аяжан апай\)/);
  });

  it('N. Сұрақ: / Жауап: қатарларын дәл сол пішінде шығарады', () => {
    const sessions = [{ role: 'parent', respondentName: 'Рахман Б.', groupCode: 'ФИЗ-01', recordingRef: 'Ата-ана', protocol: [
      { question: 'Бірінші сұрақ?', answer: 'Бірінші жауап' },
      { question: 'Екінші сұрақ?', answer: '-' },
    ] }];
    const text = exportRoundText(round, sessions);
    expect(text).toContain('1. Сұрақ: Бірінші сұрақ?\nЖауап: Бірінші жауап');
    expect(text).toContain('2. Сұрақ: Екінші сұрақ?\nЖауап: -');
  });

  it('протоколы жоқ сұхбатта орынтолтырғыш көрсетеді, қатесіз', () => {
    const sessions = [{ role: 'student', respondentName: 'Жаңа', groupCode: null, recordingRef: null, protocol: null }];
    const text = exportRoundText(round, sessions);
    expect(text).toContain('(протокол әлі дайын емес)');
    expect(text).toContain('Запись сілтемесі: —');
  });

  it('сұхбат мүлде жоқ раундта тек тақырып пен ескертпе қалады', () => {
    const text = exportRoundText(round, []);
    expect(text).toBe('CUSTDEV 0.1\nсөйлесу аясы: 1 оқушы\n');
  });
});
