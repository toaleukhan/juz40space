import { useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Сайттың өз модальды терезесі (браузердің «www… says» терезесінің орнына).
// Esc — жабу, Tab терезенің ішінде айналады, жабылғанда фокус бұрынғы
// орнына қайтады. Бастапқы фокус — autoFocus қойылған элементте, болмаса
// бірінші батырмада. Стиль — .qz-modal (quiz.css): .qz ішінде салынады,
// сондықтан жарық/қараңғы тема автоматты ілеседі.
export default function Modal({ title, description, onClose, closeOnBackdrop = true, wide = false, children }) {
  const id = useId();
  const cardRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const before = document.activeElement;
    const card = cardRef.current;
    if (!card.contains(document.activeElement)) card.querySelector(FOCUSABLE)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...card.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = card.contains(document.activeElement);
      if (!inside || (e.shiftKey && document.activeElement === first)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, []);

  return (
    <div className="qz-modal" onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}>
      <div
        ref={cardRef}
        className={`qz-modal__card ${wide ? 'qz-modal__card--wide' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={description ? `${id}-d` : undefined}
      >
        <h2 id={`${id}-t`} className="qz-modal__title">{title}</h2>
        {description && <p id={`${id}-d`} className="qz-modal__text">{description}</p>}
        {children}
      </div>
    </div>
  );
}
