import { useId, useMemo, useState } from 'react';
import Modal from './Modal';
import { CheckIcon } from './shapes';
import { parseQuizText } from '../../utils/quizImport';

const TIMES = [10, 20, 30, 60, 90];
const LETTERS = ['A', 'B', 'C', 'D'];

const EXAMPLE = `1. Қазақстанның астанасы?
A) Алматы
B) Астана ✓
C) Шымкент
D) Қарағанды

2. Жер жұмыр.
A) Дұрыс *
B) Бұрыс`;

// Мәтіннен сұрақ қосу — екі қадам:
//   1) мәтінді қою (дұрыс жауапты ✓ / * / «Жауап: B» / соңғы кілтпен белгілеуге болады, болмаса да болады)
//   2) тексеру: барлық сұрақ көрінеді, дұрыс жауап белгіленбегендерін басып таңдайды.
// Сондықтан пернетақтада ✓ жоқ болса да, ештеңе жазбай көшіріп қойып, нұсқаны басу жеткілікті.
// room — викторинаға тағы қанша сұрақ сияды (жалпы шегі бар).
export default function ImportDialog({ room, onImport, onClose }) {
  const id = useId();
  const [step, setStep] = useState('paste');
  const [text, setText] = useState('');
  const [time, setTime] = useState(30);
  const [items, setItems] = useState([]);
  const parsed = useMemo(() => parseQuizText(text), [text]);

  const count = Math.min(parsed.questions.length, room);
  const cut = parsed.questions.length - count;
  const needAnswer = parsed.questions.slice(0, count).filter((q) => q.needsAnswer).length;

  const goReview = () => {
    setItems(parsed.questions.slice(0, count).map((q) => ({ ...q })));
    setStep('review');
  };

  // ── 2-қадам: дұрыс жауапты басып таңдау ──
  const pick = (i, k) => setItems((list) => list.map((q, n) => {
    if (n !== i) return q;
    if (!q.multi) return { ...q, correct: [k], needsAnswer: false };
    const has = q.correct.includes(k);
    const next = has ? q.correct.filter((x) => x !== k) : [...q.correct, k].sort((a, b) => a - b);
    if (next.length >= q.options.length) return q; // барлығы дұрыс болуы мүмкін емес
    return { ...q, correct: next, needsAnswer: false };
  }));

  const toggleMulti = (i) => setItems((list) => list.map((q, n) => {
    if (n !== i) return q;
    return { ...q, multi: !q.multi, correct: q.multi ? q.correct.slice(0, 1) : q.correct };
  }));

  const open = items.map((q, i) => (q.correct.length === 0 ? i : -1)).filter((i) => i >= 0);
  const jumpToOpen = () => document.getElementById(`${id}-q${open[0]}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });

  if (step === 'review') {
    return (
      <Modal
        wide
        closeOnBackdrop={false}
        title={`Тексеру: ${items.length} сұрақ`}
        description="Дұрыс жауапты басып белгілеңіз. Жасыл — дұрыс жауап."
        onClose={onClose}
      >
        <ul className="qz-rv">
          {items.map((q, i) => (
            <li key={q.number + '-' + i} id={`${id}-q${i}`} className={`qz-rv__q ${q.correct.length === 0 ? 'is-open' : ''}`}>
              <div className="qz-rv__head">
                <span className="qz-rv__n">{q.number}</span>
                <p className="qz-rv__prompt">{q.prompt}</p>
              </div>
              <div className="qz-rv__opts" role="group" aria-label={`${q.number}-сұрақтың нұсқалары`}>
                {q.options.map((o, k) => {
                  const on = q.correct.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`qz-rv__opt ${on ? 'is-on' : ''}`}
                      aria-pressed={on}
                      autoFocus={i === (open[0] ?? 0) && k === 0}
                      onClick={() => pick(i, k)}
                    >
                      <span className="qz-rv__ltr">{LETTERS[k]}</span>
                      <span className="qz-rv__txt">{o}</span>
                      {on && <CheckIcon size={14} />}
                    </button>
                  );
                })}
              </div>
              <div className="qz-rv__foot">
                {q.correct.length === 0 && <span className="qz-rv__warn">Дұрыс жауапты таңдаңыз</span>}
                <button type="button" className="qz-linkbtn qz-rv__multi" aria-pressed={q.multi} onClick={() => toggleMulti(i)}>
                  {q.multi ? 'Бірнеше дұрыс жауап: қосулы' : 'Бірнеше дұрыс жауап бар'}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="qz-import__foot">
          <div className="qz-import__status" role="status" aria-live="polite">
            {open.length > 0 ? (
              <p className="qz-import__none">
                {open.length} сұраққа дұрыс жауап таңдау керек{' '}
                <button type="button" className="qz-linkbtn" onClick={jumpToOpen}>Көрсету</button>
              </p>
            ) : (
              <p className="qz-import__ok">Барлық сұраққа дұрыс жауап бар</p>
            )}
          </div>
          <div className="qz-modal__actions qz-import__actions">
            <button type="button" className="qz-btn" onClick={() => setStep('paste')}>← Мәтінге оралу</button>
            <button
              type="button"
              className="qz-btn qz-btn--primary"
              disabled={open.length > 0 || items.length === 0}
              autoFocus={open.length === 0}
              onClick={() => onImport(items.map(({ kind, prompt, options, correct, multi }) => ({ kind, prompt, options, correct, multi })), time)}
            >
              {items.length} сұрақты қосу
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // ── 1-қадам: мәтінді қою ──
  return (
    <Modal
      wide
      closeOnBackdrop={false}
      title="Мәтіннен сұрақтар қосу"
      description="Сұрақтарды Word-тан, Telegram-нан не ChatGPT-ден көшіріп қойыңыз. Дұрыс жауапты келесі қадамда басып таңдауға болады."
      onClose={onClose}
    >
      <textarea
        className="qz-textarea qz-import__text"
        autoFocus
        rows={10}
        spellCheck={false}
        aria-label="Сұрақтар мәтіні"
        placeholder={EXAMPLE}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="qz-import__status" role="status" aria-live="polite">
        {!text.trim() && (
          <p className="qz-import__hint">
            Пішім: нөмір мен сұрақ, содан кейін A) B) C) D) нұсқалары. Дұрыс жауапты белгілеудің жолдары:
            нұсқаның соңына ✓ немесе * қою; сұрақтан кейін «Жауап: B»; мәтін соңына «Жауаптар: 1-B, 2-A».
            Ештеңе жазбасаңыз да болады — келесі қадамда өзіңіз басып таңдайсыз.
          </p>
        )}
        {text.trim() && (
          <p className={count > 0 ? 'qz-import__ok' : 'qz-import__none'}>
            {count > 0 ? `${count} сұрақ табылды` : 'Сұрақ табылмады'}
            {count > 0 && needAnswer > 0 && ` · ${needAnswer}-іне дұрыс жауап белгіленбеген: келесі қадамда таңдайсыз`}
            {cut > 0 && ` · викторинада орын жоқ: ${cut} сұрақ қосылмайды`}
          </p>
        )}
        {parsed.problems.length > 0 && (
          <div className="qz-import__problems">
            <p>Өткізіледі — {parsed.problems.length} сұрақта қате бар:</p>
            <ul>
              {parsed.problems.map((p) => <li key={p.number}>№{p.number}: {p.message}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="qz-import__foot">
        <label className="qz-import__time">
          <span>Әр сұраққа уақыт</span>
          <select className="qz-select" value={time} onChange={(e) => setTime(Number(e.target.value))}>
            {TIMES.map((t) => <option key={t} value={t}>{t} с</option>)}
          </select>
        </label>
        <div className="qz-modal__actions qz-import__actions">
          <button type="button" className="qz-btn" onClick={onClose}>Болдырмау</button>
          <button type="button" className="qz-btn qz-btn--primary" disabled={count === 0} onClick={goReview}>
            {count > 0 ? `Әрі қарай: ${count} сұрақ` : 'Әрі қарай'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
