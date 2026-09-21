import { useMemo, useState } from 'react';
import Modal from './Modal';
import { parseQuizText } from '../../utils/quizImport';

const TIMES = [10, 20, 30, 60, 90];

const EXAMPLE = `1. Қазақстанның астанасы?
A) Алматы
B) Астана ✓
C) Шымкент
D) Қарағанды

2. Жер жұмыр.
A) Дұрыс ✓
B) Бұрыс`;

// Мәтіннен сұрақ қосу: көшіріп қойса — өзі сұрақ пен дұрыс жауапқа айналады.
// room — викторинаға тағы қанша сұрақ сияды (жалпы шегі бар).
export default function ImportDialog({ room, onImport, onClose }) {
  const [text, setText] = useState('');
  const [time, setTime] = useState(30);
  const parsed = useMemo(() => parseQuizText(text), [text]);

  const count = Math.min(parsed.questions.length, room);
  const cut = parsed.questions.length - count;

  return (
    <Modal
      wide
      closeOnBackdrop={false}
      title="Мәтіннен сұрақтар қосу"
      description="Сұрақтарды Word-тан, Telegram-нан не ChatGPT-ден көшіріп қойыңыз. Дұрыс жауаптың соңына ✓ қойыңыз."
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
            Пішім: нөмір мен сұрақ, содан кейін A) B) C) D) нұсқалары. Дұрыс жауап — соңында ✓ (немесе жеке жол:
            «Жауап: B»). Бір сұраққа 2–4 нұсқа.
          </p>
        )}
        {text.trim() && (
          <p className={count > 0 ? 'qz-import__ok' : 'qz-import__none'}>
            {count > 0 ? `${count} сұрақ қосылады` : 'Сұрақ табылмады'}
            {cut > 0 && ` (викторинада орын жоқ: ${cut} сұрақ қосылмайды)`}
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
          <button
            type="button"
            className="qz-btn qz-btn--primary"
            disabled={count === 0}
            onClick={() => onImport(parsed.questions.slice(0, count), time)}
          >
            {count > 0 ? `${count} сұрақты қосу` : 'Қосу'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
