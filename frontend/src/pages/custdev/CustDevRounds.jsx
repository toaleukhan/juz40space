import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Modal from '../../components/common/Modal';
import { custdev, errorText } from '../../services/custdevApi';
import mascotThink from '../../assets/subjects/Логика.webp';
import '../../styles/quiz.css';

const fmtDate = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Ай сайынғы CustDev раундтарының тізімі. Әр раунд — бір айлық сұхбат
// топтамасы (доксындағы «0.1» сияқты нөмірмен), ішінде оқушы/ата-ана/
// куратормен жеке сұхбаттар (транскрипт → AI протокол).
export default function CustDevRounds() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => custdev.rounds()
    .then(setRounds)
    .catch((err) => setError(errorText(err, 'Раундтар тізімін жүктеу мүмкін болмады')));

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    setBusyId(id);
    try {
      await custdev.deleteRound(id);
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(errorText(err, 'Өшіру мүмкін болмады'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="qz">
        <div className="qz-head">
          <div>
            <div className="qz-eyebrow">САПА · CUSTDEV</div>
            <h1 className="qz-title">CustDev раундтары</h1>
          </div>
          <button type="button" className="qz-btn qz-btn--primary" onClick={() => setCreating(true)}>Жаңа раунд</button>
        </div>

        {error && <div className="qz-alert" role="alert">{error}</div>}

        <section className="qz-card" aria-label="Раундтар">
          {rounds === null ? (
            <div className="qz-empty">Жүктелуде…</div>
          ) : rounds.length === 0 ? (
            <div className="qz-empty qz-empty--hero">
              <img src={mascotThink} alt="" />
              <h2>Алғашқы раундты бастаңыз</h2>
              <p>Раунд — бір айлық сұхбат топтамасы. Ішіне оқушы, ата-ана, куратормен жасаған әр сұхбатыңызды қосасыз, транскриптін қоясыз — протоколды сайт жазады.</p>
              <button type="button" className="qz-btn qz-btn--primary" onClick={() => setCreating(true)}>Жаңа раунд</button>
            </div>
          ) : (
            <ul className="qz-list">
              {rounds.map((r) => (
                <li key={r.id} className="qz-row">
                  <div className="qz-row__main">
                    <Link to={`/custdev/${r.id}`} className="qz-row__title">{r.title}</Link>
                    <div className="qz-row__meta">
                      <span>{r.sessionCount} сұхбат</span>
                      {r.sessionCount > 0 && <span>{r.readyCount} / {r.sessionCount} дайын</span>}
                      <span>{fmtDate(r.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="qz-row__actions">
                    <Link to={`/custdev/${r.id}`} className="qz-btn qz-btn--primary">Ашу</Link>
                    {confirmId === r.id ? (
                      <button type="button" className="qz-btn qz-btn--danger" disabled={busyId === r.id} onClick={() => remove(r.id)}>
                        Растау: өшіру
                      </button>
                    ) : (
                      <button type="button" className="qz-btn qz-btn--ghost" onClick={() => { setConfirmId(r.id); setTimeout(() => setConfirmId(null), 3500); }}>
                        Өшіру
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {creating && (
          <NewRoundDialog
            onClose={() => setCreating(false)}
            onCreated={(round) => navigate(`/custdev/${round.id}`)}
          />
        )}
      </main>
    </div>
  );
}

function NewRoundDialog({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Раунд атауын жазыңыз'); return; }
    setBusy(true);
    setError('');
    try {
      const round = await custdev.createRound({ title: title.trim(), note: note.trim() || undefined });
      onCreated(round);
    } catch (err) {
      setError(errorText(err, 'Раунд жасау мүмкін болмады'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Жаңа раунд" description="Мысалы, айдың атауы: «CUSTDEV 0.2 · Қыркүйек»." onClose={onClose}>
      <form onSubmit={submit} className="qz-field" style={{ marginTop: 14 }}>
        <label className="qz-field">
          <span className="qz-label">Атауы</span>
          <input className="qz-titleinput" style={{ fontSize: 18, flex: 'none', width: '100%' }} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus placeholder="CUSTDEV 0.2" />
        </label>
        <label className="qz-field" style={{ marginTop: 10 }}>
          <span className="qz-label">Ескертпе <em>(міндетті емес)</em></span>
          <textarea className="qz-textarea" style={{ fontSize: 13.5, minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="сөйлесу аясы: 3 оқушы, 1 ата-ана, 2 куратор" />
        </label>
        {error && <p className="qz-alert" role="alert" style={{ marginTop: 10 }}>{error}</p>}
        <div className="qz-modal__actions" style={{ marginTop: 16 }}>
          <button type="button" className="qz-btn" onClick={onClose}>Болдырмау</button>
          <button type="submit" className="qz-btn qz-btn--primary" disabled={busy}>{busy ? 'Жасалуда…' : 'Жасау'}</button>
        </div>
      </form>
    </Modal>
  );
}
