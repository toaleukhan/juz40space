import Modal from './Modal';

// Сайттың өз растау терезесі. Қауіпсіз әрекет («қалу») бірден фокуста тұрады.
export default function ConfirmDialog({
  title, message, confirmLabel, cancelLabel = 'Қалу', danger = false, onConfirm, onCancel,
}) {
  return (
    <Modal title={title} description={message} onClose={onCancel}>
      <div className="qz-modal__actions">
        <button type="button" className={`qz-btn ${danger ? 'qz-btn--danger' : 'qz-btn--primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="qz-btn qz-btn--primary" onClick={onCancel} autoFocus>
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}
