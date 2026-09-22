import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/quiz/ConfirmDialog';
import { custdev, errorText } from '../../services/custdevApi';
import '../../styles/quiz.css';

const fmtDate = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const SECTION_ORDER = ['student', 'parent', 'curator'];
const SECTION_TITLE = { student: 'ОҚУШЫЛАР', parent: 'АТА-АНА', curator: 'КУРАТОРЛАР' };

const STATUS_CHIP = {
  draft: { label: 'Транскрипт қана', cls: '' },
  ready: { label: 'Дайын', cls: 'qz-chip--good' },
  error: { label: 'Қате', cls: 'qz-chip--bad' },
};

export default function CustDevRound() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [round, setRound] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(null); // null | 'loading' | string(text)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => custdev.round(id)
    .then(setRound)
    .catch((err) => setError(errorText(err, 'Раунд табылмады')));

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- load id-ды жаба тұтады, әр рендерде жаңа

  const openExport = async () => {
    setExporting('loading');
    try {
      const { text } = await custdev.exportRound(id);
      setExporting(text);
    } catch (err) {
      setError(errorText(err, 'Экспорт мүмкін болмады'));
      setExporting(null);
    }
  };

  const removeRound = async () => {
    try {
      await custdev.deleteRound(id);
      navigate('/custdev');
    } catch (err) {
      setError(errorText(err, 'Өшіру мүмкін болмады'));
    }
  };

  const removeSession = async (sessionId) => {
    setDeletingId(sessionId);
    try {
      await custdev.deleteSession(sessionId);
      await load();
    } catch (err) {
      setError(errorText(err, 'Сұхбатты өшіру мүмкін болмады'));
    } finally {
      setDeletingId(null);
    }
  };

  if (error && !round) {
    return (
      <div className="app-shell"><Sidebar />
        <main className="qz">
          <div className="qz-alert" role="alert">{error}</div>
          <Link to="/custdev" className="qz-btn">Раундтарға оралу</Link>
        </main>
      </div>
    );
  }
  if (!round) {
    return <div className="app-shell"><Sidebar /><main className="qz"><div className="qz-empty">Жүктелуде…</div></main></div>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="qz">
        <div className="qz-head">
          <div>
            <Link to="/custdev" className="qz-link" style={{ display: 'inline-block', marginBottom: 6 }}>← Раундтар</Link>
            <div className="qz-eyebrow">САПА · CUSTDEV</div>
            <h1 className="qz-title">{round.title}</h1>
            {round.note && <div className="qz-row__meta" style={{ marginTop: 4 }}><span>{round.note}</span></div>}
          </div>
          <div className="qz-head__actions">
            <button type="button" className="qz-btn" onClick={() => setEditing(true)}>Өңдеу</button>
            <button type="button" className="qz-btn" onClick={openExport} disabled={round.sessions.length === 0}>Экспорт (мәтін)</button>
            <button type="button" className="qz-btn qz-btn--primary" onClick={() => setAdding(true)}>+ Сұхбат қосу</button>
          </div>
        </div>

        {error && <div className="qz-alert" role="alert">{error}</div>}

        {round.sessions.length === 0 ? (
          <section className="qz-card"><div className="qz-empty">Бұл раундта әлі сұхбат жоқ. «Сұхбат қосу» батырмасын басыңыз.</div></section>
        ) : SECTION_ORDER.map((role) => {
          const list = round.sessions.filter((s) => s.role === role);
          if (!list.length) return null;
          return (
            <section key={role} className="qz-card qz-card--spaced" aria-label={SECTION_TITLE[role]}>
              <div className="qz-card__head"><h2>{SECTION_TITLE[role]}</h2><span className="qz-card__sub">{list.length}</span></div>
              <ul className="qz-list">
                {list.map((s) => {
                  const chip = STATUS_CHIP[s.status] || STATUS_CHIP.draft;
                  return (
                    <li key={s.id} className="qz-row">
                      <div className="qz-row__main">
                        <Link to={`/custdev/sessions/${s.id}`} className="qz-row__title">{s.respondentName}</Link>
                        <div className="qz-row__meta">
                          {s.groupCode && <span>{s.groupCode}</span>}
                          {s.role === 'student' && s.curatorName && <span>куратор: {s.curatorName}</span>}
                          <span className={`qz-chip ${chip.cls}`}>{chip.label}</span>
                          <span>{fmtDate(s.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="qz-row__actions">
                        <Link to={`/custdev/sessions/${s.id}`} className="qz-btn qz-btn--primary">Ашу</Link>
                        <button type="button" className="qz-btn qz-btn--ghost" disabled={deletingId === s.id} onClick={() => removeSession(s.id)}>
                          {deletingId === s.id ? '…' : 'Өшіру'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <div className="qz-actions" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="qz-btn qz-btn--ghost" onClick={() => setConfirmDelete(true)}>Раундты өшіру</button>
        </div>

        {adding && (
          <AddSessionDialog
            roundId={round.id}
            onClose={() => setAdding(false)}
            onDone={async () => { setAdding(false); await load(); }}
          />
        )}

        {editing && (
          <EditRoundDialog
            round={round}
            onClose={() => setEditing(false)}
            onSaved={async () => { setEditing(false); await load(); }}
          />
        )}

        {exporting !== null && (
          <ExportDialog text={exporting === 'loading' ? '' : exporting} loading={exporting === 'loading'} onClose={() => setExporting(null)} />
        )}

        {confirmDelete && (
          <ConfirmDialog
            title="Раундты өшіру"
            message={`«${round.title}» раунды және ішіндегі барлық сұхбат пен протокол өшеді. Бұл әрекетті болдырмау мүмкін емес.`}
            confirmLabel="Өшіру"
            cancelLabel="Қалу"
            danger
            onConfirm={removeRound}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </main>
    </div>
  );
}

// ── сұхбат қосу: метадеректер + транскрипт → жасау → автоматты протокол ──
const ROLE_OPTIONS = [
  { id: 'student', label: 'Оқушы' },
  { id: 'parent', label: 'Ата-ана' },
  { id: 'curator', label: 'Куратор' },
];

function AddSessionDialog({ roundId, onClose, onDone }) {
  const [role, setRole] = useState('student');
  const [respondentName, setRespondentName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [curatorName, setCuratorName] = useState('');
  const [meetTimeLabel, setMeetTimeLabel] = useState('');
  const [recordingRef, setRecordingRef] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [stage, setStage] = useState('form'); // form | saving | generating

  const submit = async (e) => {
    e.preventDefault();
    if (!respondentName.trim()) { setError('Аты-жөнін жазыңыз'); return; }
    setError('');
    setStage('saving');
    try {
      const session = await custdev.createSession(roundId, {
        role, respondentName: respondentName.trim(), groupCode: groupCode.trim() || undefined,
        curatorName: role === 'student' ? (curatorName.trim() || undefined) : undefined,
        meetTimeLabel: meetTimeLabel.trim() || undefined, recordingRef: recordingRef.trim() || undefined,
        transcript,
      });
      if (transcript.trim()) {
        setStage('generating');
        try {
          await custdev.generate(session.id);
        } catch {
          // Протокол сәтсіз болса да сұхбат сақталған — раунд бетінде "Қате" деп
          // көрінеді, пайдаланушы сол жерден "Қайта жасау" басады.
        }
      }
      onDone();
    } catch (err) {
      setError(errorText(err, 'Сұхбат жасау мүмкін болмады'));
      setStage('form');
    }
  };

  const busy = stage !== 'form';

  return (
    <Modal wide closeOnBackdrop={!busy} title="Сұхбат қосу" description="Метадеректерді толтырып, транскриптті қойыңыз — протоколды сайт өзі жазады." onClose={busy ? () => {} : onClose}>
      <form onSubmit={submit}>
        <fieldset className="qz-fs" style={{ marginTop: 4 }}>
          <legend>Рөлі</legend>
          <div className="qz-seg" role="radiogroup">
            {ROLE_OPTIONS.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={role === o.id} className={role === o.id ? 'is-on' : ''} disabled={busy} onClick={() => setRole(o.id)}>{o.label}</button>
            ))}
          </div>
        </fieldset>

        <div className="qz-settings" style={{ marginTop: 14, paddingTop: 0, borderTop: 'none' }}>
          <label className="qz-field">
            <span className="qz-label">Аты-жөні</span>
            <input className="qz-select" style={{ width: 220 }} value={respondentName} onChange={(e) => setRespondentName(e.target.value)} maxLength={150} disabled={busy} autoFocus placeholder={role === 'parent' ? 'Баланың аты-жөні' : 'Аты-жөні'} />
          </label>
          <label className="qz-field">
            <span className="qz-label">Тобы <em>(міндетті емес)</em></span>
            <input className="qz-select" style={{ width: 140 }} value={groupCode} onChange={(e) => setGroupCode(e.target.value)} maxLength={50} disabled={busy} placeholder="ФИЗ-01" />
          </label>
          {role === 'student' && (
            <label className="qz-field">
              <span className="qz-label">Кураторы <em>(міндетті емес)</em></span>
              <input className="qz-select" style={{ width: 180 }} value={curatorName} onChange={(e) => setCuratorName(e.target.value)} maxLength={150} disabled={busy} placeholder="Аяжан апай" />
            </label>
          )}
          <label className="qz-field">
            <span className="qz-label">Уақыты <em>(міндетті емес)</em></span>
            <input className="qz-select" style={{ width: 140 }} value={meetTimeLabel} onChange={(e) => setMeetTimeLabel(e.target.value)} maxLength={100} disabled={busy} placeholder="16:00-16:20" />
          </label>
          <label className="qz-field">
            <span className="qz-label">Жазба сілтемесі <em>(міндетті емес)</em></span>
            <input className="qz-select" style={{ width: 220 }} value={recordingRef} onChange={(e) => setRecordingRef(e.target.value)} maxLength={300} disabled={busy} placeholder="abc-defg-hij немесе «Ата-ана»" />
          </label>
        </div>

        <label className="qz-field" style={{ marginTop: 14 }}>
          <span className="qz-label">Транскрипт <em>(Gemini-ден алған мәтінді осында қойыңыз)</em></span>
          <textarea className="qz-textarea" style={{ minHeight: 220, fontSize: 13.5 }} value={transcript} onChange={(e) => setTranscript(e.target.value)} disabled={busy} placeholder="Транскриптті осында қойыңыз…" />
        </label>

        {error && <p className="qz-alert" role="alert" style={{ marginTop: 10 }}>{error}</p>}

        <div className="qz-modal__actions" style={{ marginTop: 16 }}>
          <button type="button" className="qz-btn" onClick={onClose} disabled={busy}>Болдырмау</button>
          <button type="submit" className="qz-btn qz-btn--primary" disabled={busy}>
            {stage === 'saving' ? 'Сақталуда…' : stage === 'generating' ? 'Протокол жасалуда…' : 'Қосу'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditRoundDialog({ round, onClose, onSaved }) {
  const [title, setTitle] = useState(round.title);
  const [note, setNote] = useState(round.note || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Раунд атауын жазыңыз'); return; }
    setBusy(true);
    try {
      await custdev.updateRound(round.id, { title: title.trim(), note: note.trim() || undefined });
      onSaved();
    } catch (err) {
      setError(errorText(err, 'Сақтау мүмкін болмады'));
      setBusy(false);
    }
  };

  return (
    <Modal title="Раундты өңдеу" onClose={onClose}>
      <form onSubmit={submit} style={{ marginTop: 14 }}>
        <label className="qz-field">
          <span className="qz-label">Атауы</span>
          <input className="qz-titleinput" style={{ fontSize: 18, flex: 'none', width: '100%' }} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus />
        </label>
        <label className="qz-field" style={{ marginTop: 10 }}>
          <span className="qz-label">Ескертпе</span>
          <textarea className="qz-textarea" style={{ fontSize: 13.5, minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </label>
        {error && <p className="qz-alert" role="alert" style={{ marginTop: 10 }}>{error}</p>}
        <div className="qz-modal__actions" style={{ marginTop: 16 }}>
          <button type="button" className="qz-btn" onClick={onClose}>Болдырмау</button>
          <button type="submit" className="qz-btn qz-btn--primary" disabled={busy}>{busy ? 'Сақталуда…' : 'Сақтау'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ExportDialog({ text, loading, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* қолжетімсіз — қолмен көшіруге болады */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Modal wide title="Мәтін экспорты" description="Google Doc-қа тікелей қоюға болатын пішінде." onClose={onClose}>
      {loading ? (
        <div className="qz-empty">Дайындалуда…</div>
      ) : (
        <>
          <textarea className="qz-textarea" style={{ minHeight: 320, fontSize: 12.5, fontFamily: 'monospace', marginTop: 10 }} value={text} readOnly onFocus={(e) => e.target.select()} />
          <div className="qz-modal__actions" style={{ marginTop: 14 }}>
            <button type="button" className="qz-btn" onClick={onClose}>Жабу</button>
            <button type="button" className="qz-btn qz-btn--primary" onClick={copy}>{copied ? 'Көшірілді' : 'Көшіру'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
