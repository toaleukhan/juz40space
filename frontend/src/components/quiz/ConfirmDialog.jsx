import { useEffect, useId, useRef } from 'react';

// Сайттың өз растау терезесі: браузердің «www… says» терезесінің орнына.
// Қауіпсіз әрекет («қалу») бірден фокуста тұрады, Esc пен фонды басу — бас
// тарту, Tab екі батырма арасында ғана айналады. Стиль .qz-modal (quiz.css) —
// мәзір ішінде салынады, сондықтан жарық/қараңғы тема автоматты ілеседі.
export default function ConfirmDialog({
  title, message, confirmLabel, cancelLabel = 'Қалу', danger = false, onConfirm, onCancel,
}) {
  const id = useId();
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelFn = useRef(onCancel);

  useEffect(() => { cancelFn.current = onCancel; });

  useEffect(() => {
    const before = document.activeElement;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelFn.current();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Екі-ақ батырма бар: Tab та, Shift+Tab та біріне-бірі ауыстырады.
        const other = document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current;
        other?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, []);

  return (
    <div className="qz-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="qz-modal__card" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
        <h2 id={`${id}-t`} className="qz-modal__title">{title}</h2>
        <p id={`${id}-d`} className="qz-modal__text">{message}</p>
        <div className="qz-modal__actions">
          <button type="button" ref={confirmRef} className={`qz-btn ${danger ? 'qz-btn--danger' : 'qz-btn--primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" ref={cancelRef} className="qz-btn qz-btn--primary" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
