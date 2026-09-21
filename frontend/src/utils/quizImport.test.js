import { describe, it, expect } from 'vitest';
import { parseQuizText } from './quizImport';

// Нақты мұғалім жіберген 20 сұрақ (Өзбекәлі Жәнібеков / Ғани Мұратбаев): сөзбе-сөз.
const REAL = `
1. Өзбекәлі 1965 жылы неге қол қоймай, ерлікпен қарсы тұрды?
A) Қыз-келіншектерден трактор бригадасы құруға ✓
B) Комсомол мүшелігін көбейтуге
C) Жаңа кеңсе салуға
D) Жалақы көбейтуге

2. "Онсыз да қойшы болады ғой" деп Өзбекәлі кімдерге тиіспеуді өтінген?
A) Ер балаларға
B) Қыздарға ✓
C) Мұғалімдерге
D) Кәрі адамдарға

3. Бауыржан Момышұлы пойызда кездескен "герой" неге ие болды?
A) Жүз биеден жүз құлын алғаны үшін ✓
B) Соғыста ерлік көрсеткені үшін
C) Ғылыми жаңалық ашқаны үшін
D) Кітап жазғаны үшін

4. Ғани Мұратбаев неше жасында дүние салды?
A) 19 жасында
B) 23 жасында ✓
C) 34 жасында
D) 45 жасында

5. Ғани өлген күні (1925, 15 сәуір) тарихта тағы не болды?
A) Алаш Орда құрылды
B) Қазақ халқы "қазақ" деген атауын қайтарды ✓
C) Кеңес одағы құрылды
D) Алматы астана болды

6. Гани Мұратбаев Тәшкенде кімдерді жинап, интернатқа орналастырды?
A) Жетім қыздарды
B) Қаңғыбас, ұрлықпен айналысатын балаларды ✓
C) Ауру адамдарды
D) Соғыс ардагерлерін

7. Ғани қандай әнді Затаевичке ыңылдап беріп, тарихқа қалдырды?
A) "Сәулем-ай"
B) "Дудар-ай" ✓
C) "Қаражорға"
D) "Балқия"

8. Құрманбек Жандарбеков Ғаниға ескерткіш үшін концерт өткізгенде не болды?
A) Ол дауысынан айырылды ✓
B) Концерт сәтсіз аяқталды
C) Ешкім келмеді
D) Ақша жетіп артылды

9. Ғанидың мүсінін жасаған мүсінші кімнің дене тұрқын өлшеп алды?
A) Ғанидың немере інісінің
B) Өзбекәлінің өзінің ✓
C) Нұртас Оңдасыновтың
D) Автордың

10. И.Макаров Ғанидың мүсінін неше жыл қоймада ұстады?
A) 3 жыл
B) 6 жыл ✓
C) 10 жыл
D) 1 жыл

11. Ғанидың мүсінін соңында қалай орнатты?
A) Ресми салтанатпен Алматыда
B) Ливенцовқа білдірместен жасырын түрде ✓
C) Мәскеуде
D) Мүлде орнатпады

12. М.Соломенцев Ғаниды кемсіткеннен кейін не болды?
A) Марапатталды
B) Некесіз байланыста ұсталып, масқараланды ✓
C) Президент болды
D) Ешқандай өзгеріс болмады

13. Автор Өзбекәлі жайлы алғаш эфирін қай платформада өткізді?
A) YouTube
B) Instagram ✓
C) TikTok
D) Facebook

14. Нұрбах Рүстемов қай елде елші болып қызмет еткен қалада тұрды?
A) Мәскеу
B) Бухарест ✓
C) Пекин
D) Лондон

15. Сергей Терещенко сұхбат беруге келіскеннен кейін не болды?
A) Сұхбат берді
B) 10 күннен соң қайтыс болды ✓
C) Елден кетіп қалды
D) Сұхбаттан бас тартты

16. "Қой бағу" ұраны қай облыста, қай жылы басталды?
A) Семей, 1963 ✓
B) Шымкент, 1956
C) Алматы, 1970
D) Қостанай, 1957

17. Григорий Рогинец Батраковқа қарсы шыққанда қандай статистиканы келтірді?
A) Трактор айдаған әйелдердің 30%-дан астамы бала көтере алмай қалған ✓
B) Қыздардың 50%-ы қалаға көшкен
C) Барлық трактор бұзылған
D) Ешқандай сан келтірмеді

18. Ілияс Омаров Өзбекәліге қандай тапсырма берген?
A) Ескерткішті бұзу
B) Олжас Сүлейменов сияқты жас таланттарға қамқор болу ✓
C) Комсомолды тарату
D) Қой бағуды ұйымдастыру

19. Автор "мәңгілік БОЛМЫС" ұғымын не үшін пайдаланады?
A) Тек Гани мен Өзбекәлінің дене бітімін сипаттау үшін
B) Борышын адал арқалаған адамның рухани мәртебесін көрсету үшін ✓
C) Кеңес идеологиясын мадақтау үшін
D) Ешқандай мағынасы жоқ

20. Виктор Прокопенко Ғанидың мүсінін не деп "ұрлады" деп әзілдеген?
A) Мүсінді шынымен біреу алып кеткен
B) Мүсінді жасырын түрде совхозға апарып қойғанын ✓
C) Мүсіннің қола нұсқасы жоғалған
D) Ешқандай оқиға болмаған
`;

describe('parseQuizText — нақты 20 сұрақ', () => {
  const out = parseQuizText(REAL);

  it('барлық 20 сұрақты қатесіз оқиды', () => {
    expect(out.found).toBe(20);
    expect(out.problems).toEqual([]);
    expect(out.questions).toHaveLength(20);
  });

  it('дұрыс жауаптар ✓ белгісіне сәйкес (A=0 … D=3)', () => {
    expect(out.questions.map((q) => q.correct)).toEqual([
      [0], [1], [0], [1], [1], [1], [1], [0], [1], [1],
      [1], [1], [1], [1], [1], [0], [0], [1], [1], [1],
    ]);
  });

  it('✓ белгісі нұсқа мәтініне кірмейді, әр сұраққа 4 нұсқа', () => {
    out.questions.forEach((q) => {
      expect(q.options).toHaveLength(4);
      q.options.forEach((o) => expect(o).not.toMatch(/✓/));
      expect(q.kind).toBe('choice');
      expect(q.multi).toBe(false);
    });
    expect(out.questions[0].prompt).toBe('Өзбекәлі 1965 жылы неге қол қоймай, ерлікпен қарсы тұрды?');
    expect(out.questions[0].options[0]).toBe('Қыз-келіншектерден трактор бригадасы құруға');
  });

  it('тырнақша, жақша, пайыз, латын сөздер бүлінбейді', () => {
    expect(out.questions[1].prompt).toContain('"Онсыз да қойшы болады ғой"');
    expect(out.questions[4].prompt).toContain('(1925, 15 сәуір)');
    expect(out.questions[16].options[0]).toContain('30%-дан');
    expect(out.questions[12].options).toEqual(['YouTube', 'Instagram', 'TikTok', 'Facebook']);
  });

  it('сұрақ мәтініндегі жыл мен нұсқадағы сан жаңа сұрақ болып кетпейді', () => {
    // «1965 жылы …», «19 жасында», «3 жыл» — бәрі өз сұрағының ішінде
    expect(out.found).toBe(20);
    expect(out.questions[3].options).toEqual(['19 жасында', '23 жасында', '34 жасында', '45 жасында']);
  });
});

describe('parseQuizText — пішім нұсқалары', () => {
  it('кирилл А В С Д әріптері мен «А.» / «А:» белгілерін қабылдайды', () => {
    const { questions, problems } = parseQuizText('1. Сұрақ?\nА) бір\nВ. екі ✓\nС: үш\nД) төрт');
    expect(problems).toEqual([]);
    expect(questions[0].options).toEqual(['бір', 'екі', 'үш', 'төрт']);
    expect(questions[0].correct).toEqual([1]);
  });

  it('«Жауап: B» жолымен дұрыс жауапты оқиды (бірнешеу де болады)', () => {
    const one = parseQuizText('1. Сұрақ?\na) бір\nb) екі\nc) үш\nЖауап: C');
    expect(one.questions[0].correct).toEqual([2]);
    const many = parseQuizText('1. Векторлар?\nA) жылдамдық\nB) масса\nC) күш\nD) уақыт\nДұрыс жауап: A, C');
    expect(many.questions[0].correct).toEqual([0, 2]);
    expect(many.questions[0].multi).toBe(true);
  });

  it('бірнеше ✓ — бірнеше дұрыс жауап', () => {
    const { questions } = parseQuizText('1. Қайсысы?\nA) а ✓\nB) б\nC) в ✓\nD) г');
    expect(questions[0].correct).toEqual([0, 2]);
    expect(questions[0].multi).toBe(true);
  });

  it('басқа белгілер: ✔ ✅ ☑ (дұрыс)', () => {
    const { questions } = parseQuizText('1. А?\nA) а ✔\nB) б\n\n2. Б?\nA) а\nB) б ✅\n\n3. В?\nA) а ☑\nB) б\n\n4. Г?\nA) а\nB) б (дұрыс)');
    expect(questions.map((q) => q.correct)).toEqual([[0], [1], [0], [1]]);
  });

  it('«Дұрыс / Бұрыс» нұсқалары true/false сұрағына айналады', () => {
    const { questions } = parseQuizText('1. Жер жұмыр.\nA) Дұрыс ✓\nB) Бұрыс');
    expect(questions[0].kind).toBe('truefalse');
    expect(questions[0].options).toEqual(['Дұрыс', 'Бұрыс']);
    expect(questions[0].correct).toEqual([0]);
  });

  it('екі басқа нұсқа — қарапайым «таңдау» сұрағы', () => {
    const { questions } = parseQuizText('1. Иә ма?\nA) Иә ✓\nB) Жоқ');
    expect(questions[0].kind).toBe('choice');
  });

  it('келесі жолға ауысқан сұрақ пен нұсқа мәтінін біріктіреді', () => {
    const { questions, problems } = parseQuizText('1. Өте ұзын сұрақ\nекінші жолға өтті?\nA) ұзын нұсқа\nжалғасы ✓\nB) қысқа');
    expect(problems).toEqual([]);
    expect(questions[0].prompt).toBe('Өте ұзын сұрақ екінші жолға өтті?');
    expect(questions[0].options).toEqual(['ұзын нұсқа жалғасы', 'қысқа']);
    expect(questions[0].correct).toEqual([0]);
  });

  it('Windows жол аяқтары, артық бос жолдар, «1)» және «1.Мәтін» пішімі', () => {
    const { questions, problems } = parseQuizText('\r\n\r\n1) Бірінші?\r\nA) а ✓\r\nB) б\r\n\r\n\r\n2.Екінші?\r\nA) а\r\nB) б ✓\r\n');
    expect(problems).toEqual([]);
    expect(questions.map((q) => q.prompt)).toEqual(['Бірінші?', 'Екінші?']);
  });

  it('«1.5 кг» сияқты жол жаңа сұрақ емес, сұрақтың жалғасы', () => {
    const { questions, found } = parseQuizText('1. Дененің массасы\n1.5 кг болса, күші?\nA) 15 Н ✓\nB) 1,5 Н');
    expect(found).toBe(1);
    expect(questions[0].prompt).toBe('Дененің массасы 1.5 кг болса, күші?');
  });

  it('бірінші сұрақтан бұрынғы тақырып жолын елемейді', () => {
    const { questions, found } = parseQuizText('Абай жайлы викторина\n\n1. Сұрақ?\nA) а ✓\nB) б');
    expect(found).toBe(1);
    expect(questions).toHaveLength(1);
  });

  it('бос мәтін — ештеңе таппайды', () => {
    expect(parseQuizText('')).toEqual({ questions: [], problems: [], found: 0 });
    expect(parseQuizText('   \n\n  ').found).toBe(0);
  });
});

describe('parseQuizText — қателер (дұрыс сұрақтар өтеді, қате нөмірмен айтылады)', () => {
  it('дұрыс жауап белгіленбесе — сол сұрақ өткізіледі, №-мен айтылады', () => {
    const { questions, problems } = parseQuizText('1. Бірінші?\nA) а ✓\nB) б\n\n2. Екінші?\nA) а\nB) б\n\n3. Үшінші?\nA) а\nB) б ✓');
    expect(questions.map((q) => q.prompt)).toEqual(['Бірінші?', 'Үшінші?']);
    expect(problems).toHaveLength(1);
    expect(problems[0].number).toBe(2);
    expect(problems[0].message).toMatch(/дұрыс жауап/);
  });

  it('нұсқа саны 2–4 емес', () => {
    const one = parseQuizText('1. Бір нұсқа?\nA) а ✓');
    expect(one.questions).toHaveLength(0);
    expect(one.problems[0].message).toMatch(/2–4/);
    const five = parseQuizText('1. Бес?\nA) а ✓\nB) б\nC) в\nD) г\nE) д');
    // E — нұсқа әрпі емес: соңғы жолға «жалғасы» болып қосылады, нұсқа саны 4
    expect(five.questions).toHaveLength(1);
    expect(five.questions[0].options[3]).toBe('г E) д');
  });

  it('барлық нұсқа дұрыс деп белгіленсе — қате', () => {
    const { problems } = parseQuizText('1. Сұрақ?\nA) а ✓\nB) б ✓');
    expect(problems[0].message).toMatch(/барлық нұсқа/);
  });

  it('тым ұзын сұрақ пен нұсқа — қате (сервер де қабылдамайды)', () => {
    const long = 'ж'.repeat(501);
    expect(parseQuizText(`1. ${long}\nA) а ✓\nB) б`).problems[0].message).toMatch(/500/);
    const longOpt = 'ж'.repeat(151);
    expect(parseQuizText(`1. С?\nA) ${longOpt} ✓\nB) б`).problems[0].message).toMatch(/150/);
  });

  it('«Жауап: F» сияқты жоқ әріп — дұрыс жауап табылмады', () => {
    const { problems } = parseQuizText('1. Сұрақ?\nA) а\nB) б\nЖауап: F');
    expect(problems[0].message).toMatch(/дұрыс жауап/);
  });
});
