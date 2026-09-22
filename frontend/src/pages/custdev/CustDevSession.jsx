import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import ConfirmDialog from '../../components/quiz/ConfirmDialog';
import { custdev, errorText } from '../../services/custdevApi';
import '../../styles/quiz.css';

const ROLE_LABEL = { student: 'Оқушы', parent: 'Ата-ана', curator: 'Куратор' };
const STATUS_TEXT = { draft: 'Транскрипт қана, протокол әлі жоқ', ready: 'Протокол дайын', error: 'Протокол жасалмады' };

// Бір сұхбаттың толық протоколы: әр жауапты қолмен түзетуге болады
// (AI шығарғанды бірден шындыққа қабылдамай, өзің тексеріп жібересің),
// транскриптті өзгертіп «Қайта жасау» басуға да болады.
export default function CustDevSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [meta, setMeta] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = () => custdev.session(id)
    .then((data) => {
      setS(data);
      setMeta({
        respondentName: data.respondentName, groupCode: data.groupCode || '', curatorName: data.curatorName || '',
        meetTimeLabel: data.meetTimeLabel || '', recordingRef: data.recordingRef || '', transcript: data.transcript || '',
      });
      setAnswers((data.protocol || []).map((qa) => qa.answer));
    })
    .catch((err) => setError(errorText(err, 'Сұхбат табылмады')));

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- load id-ды жаба тұтады, әр рендерде жаңа

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const protocol = s.protocol ? s.protocol.map((qa, i) => ({ question: qa.question, answer: answers[i] })) : undefined;
      const updated = await custdev.updateSession(id, { ...meta, ...(protocol ? { protocol } : {}) });
      setS(updated);
      setAnswers((updated.protocol || []).map((qa) => qa.answer));
      setNotice('Сақталды');
      setTimeout(() => setNotice(''), 1800);
    } catch (err) {
      setError(errorText(err, 'Сақтау мүмкін болмады'));
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    setConfirmRegen(false);
    setGenerating(true);
    setError('');
    try {
      // Транскрипт өзгертілген болса, алдымен соны сақтаймыз — қайта жасау сол мәтінге сүйенеді.
      await custdev.updateSession(id, meta);
      const updated = await custdev.generate(id);
      setS(updated);
      setAnswers((updated.protocol || []).map((qa) => qa.answer));
    } catch (err) {
      setError(errorText(err, 'Протокол жасау сәтсіз аяқталды'));
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const removeSession = async () => {
    try {
      await custdev.deleteSession(id);
      navigate(s ? `/custdev/${s.roundId}` : '/custdev');
    } catch (err) {
      setError(errorText(err, 'Өшіру мүмкін болмады'));
    }
  };

  if (error && !s) {
    return (
      <div className="app-shell"><Sidebar />
        <main className="qz">
          <div className="qz-alert" role="alert">{error}</div>
          <Link to="/custdev" className="qz-btn">Раундтарға оралу</Link>
        </main>
      </div>
    );
  }
  if (!s || !meta) return <div className="app-shell"><Sidebar /><main className="qz"><div className="qz-empty">Жүктелуде…</div></main></div>;

  const busy = saving || generating;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="qz">
        <div className="qz-head">
          <div>
            <Link to={`/custdev/${s.roundId}`} className="qz-link" style={{ display: 'inline-block', marginBottom: 6 }}>← Раундқа оралу</Link>
            <div className="qz-eyebrow">{ROLE_LABEL[s.role]?.toUpperCase()} · СҰХБАТ</div>
            <h1 className="qz-title">{s.respondentName}</h1>
          </div>
          <div className="qz-head__actions">
            <button type="button" className="qz-btn qz-btn--ghost" onClick={() => setConfirmDelete(true)}>Өшіру</button>
            <button type="button" className="qz-btn" disabled={busy || !meta.transcript.trim()} onClick={() => (s.status === 'ready' ? setConfirmRegen(true) : regenerate())}>
              {generating ? 'Жасалуда…' : s.status === 'ready' ? 'Қайта жасау' : 'Протокол жасау'}
            </button>
            <button type="button" className="qz-btn qz-btn--primary" disabled={busy} onClick={save}>{saving ? 'Сақталуда…' : 'Сақтау'}</button>
          </div>
        </div>

        {error && <div className="qz-alert" role="alert">{error}</div>}
        {notice && <div className="qz-insight" role="status">{notice}</div>}
        {s.status === 'error' && s.errorMessage && (
          <div className="qz-alert" role="alert">{s.errorMessage}</div>
        )}

        <section className="qz-card">
          <div className="qz-card__head"><h2>Сұхбат туралы</h2><span className="qz-card__sub">{STATUS_TEXT[s.status]}</span></div>
          <div className="qz-settings" style={{ padding: '14px 16px' }}>
            <label className="qz-field">
              <span className="qz-label">Аты-жөні</span>
              <input className="qz-select" style={{ width: 200 }} value={meta.respondentName} onChange={(e) => setMeta((m) => ({ ...m, respondentName: e.target.value }))} maxLength={150} />
            </label>
            <label className="qz-field">
              <span className="qz-label">Тобы</span>
              <input className="qz-select" style={{ width: 130 }} value={meta.groupCode} onChange={(e) => setMeta((m) => ({ ...m, groupCode: e.target.value }))} maxLength={50} />
            </label>
            {s.role === 'student' && (
              <label className="qz-field">
                <span className="qz-label">Кураторы</span>
                <input className="qz-select" style={{ width: 180 }} value={meta.curatorName} onChange={(e) => setMeta((m) => ({ ...m, curatorName: e.target.value }))} maxLength={150} />
              </label>
            )}
            <label className="qz-field">
              <span className="qz-label">Уақыты</span>
              <input className="qz-select" style={{ width: 130 }} value={meta.meetTimeLabel} onChange={(e) => setMeta((m) => ({ ...m, meetTimeLabel: e.target.value }))} maxLength={100} />
            </label>
            <label className="qz-field">
              <span className="qz-label">Жазба сілтемесі</span>
              <input className="qz-select" style={{ width: 220 }} value={meta.recordingRef} onChange={(e) => setMeta((m) => ({ ...m, recordingRef: e.target.value }))} maxLength={300} />
            </label>
          </div>
        </section>

        <section className="qz-card qz-card--spaced">
          <div className="qz-card__head">
            <h2>Транскрипт</h2>
            <button type="button" className="qz-linkbtn" onClick={() => setShowTranscript((v) => !v)}>{showTranscript ? 'Жасыру' : 'Көрсету / өңдеу'}</button>
          </div>
          {showTranscript && (
            <div style={{ padding: '0 16px 16px' }}>
              <textarea className="qz-textarea" style={{ minHeight: 240, fontSize: 13.5 }} value={meta.transcript} onChange={(e) => setMeta((m) => ({ ...m, transcript: e.target.value }))} />
            </div>
          )}
        </section>

        <section className="qz-card qz-card--spaced">
          <div className="qz-card__head"><h2>Протокол</h2></div>
          {!s.protocol || s.protocol.length === 0 ? (
            <div className="qz-empty">
              Әлі протокол жоқ. Транскриптті қойып, «Протокол жасау» басыңыз{s.status === 'error' ? ' (алдыңғы әрекет сәтсіз аяқталды)' : ''}.
            </div>
          ) : (
            <ol className="qz-rv" style={{ margin: '14px 16px', maxHeight: 'none' }}>
              {s.protocol.map((qa, i) => (
                <li key={i} className="qz-rv__q" style={{ cursor: 'default' }}>
                  <div className="qz-rv__head">
                    <span className="qz-rv__n">{i + 1}</span>
                    <p className="qz-rv__prompt">{qa.question}</p>
                  </div>
                  <textarea
                    className="qz-textarea"
                    style={{ marginTop: 10, minHeight: 64, fontSize: 13.5 }}
                    value={answers[i] ?? ''}
                    onChange={(e) => setAnswers((list) => list.map((a, k) => (k === i ? e.target.value : a)))}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>

        {confirmRegen && (
          <ConfirmDialog
            title="Протоколды қайта жасау"
            message="Қазіргі жауаптардың (соның ішінде қолмен түзетілгендердің) орнына жаңасы жазылады. Транскрипт өзгертілген болса, алдымен сол сақталады."
            confirmLabel="Қайта жасау"
            cancelLabel="Қалу"
            danger
            onConfirm={regenerate}
            onCancel={() => setConfirmRegen(false)}
          />
        )}
        {confirmDelete && (
          <ConfirmDialog
            title="Сұхбатты өшіру"
            message={`«${s.respondentName}» сұхбаты мен протоколы өшеді. Бұл әрекетті болдырмау мүмкін емес.`}
            confirmLabel="Өшіру"
            cancelLabel="Қалу"
            danger
            onConfirm={removeSession}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </main>
    </div>
  );
}
