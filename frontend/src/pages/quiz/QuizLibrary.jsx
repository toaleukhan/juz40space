import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';
import { errorText } from '../../services/gameApi';
import mascotThink from '../../assets/subjects/Логика.webp';
import '../../styles/quiz.css';

const fmtDate = (iso) => new Date(iso).toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

const minutes = (seconds) => Math.max(1, Math.round(seconds / 60));

const STATUS = {
  lobby: 'Күту залы',
  question: 'Жүріп жатыр',
  reveal: 'Жүріп жатыр',
  leaderboard: 'Жүріп жатыр',
  finished: 'Аяқталды',
};

export default function QuizLibrary() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState(null);
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  // Тізім келмесе де бет «Жүктелуде…» деп қатып қалмайды және қызыл дабыл
  // қоспайды: викторина жоқ сияқты таза күй көрінеді, астында сұр ескерту
  // мен «Қайталау». (Сервер тізімді нақты бермеген болса, «викториналарыңыз
  // жоғалды» деп қателеспеу үшін ескерту қалады.)
  const load = () => Promise.all([api.get('/quizzes'), api.get('/games')])
    .then(([q, g]) => { setQuizzes(q.data); setGames(g.data); setLoadFailed(false); })
    .catch(() => { setQuizzes([]); setGames([]); setLoadFailed(true); });

  useEffect(() => { load(); }, []);

  const startGame = async (quiz) => {
    setBusyId(quiz.id);
    setError('');
    try {
      const { data } = await api.post('/games', { quizId: quiz.id });
      navigate(`/host/${data.id}`);
    } catch (err) {
      setError(errorText(err, 'Ойынды бастау мүмкін болмады'));
      setBusyId(null);
    }
  };

  const duplicate = async (quiz) => {
    setBusyId(quiz.id);
    try {
      await api.post(`/quizzes/${quiz.id}/duplicate`);
      await load();
    } catch (err) {
      setError(errorText(err, 'Көшірме жасалмады'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (quiz) => {
    setBusyId(quiz.id);
    try {
      await api.delete(`/quizzes/${quiz.id}`);
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
            <div className="qz-eyebrow">JUZ40 · ВИКТОРИНА</div>
            <h1 className="qz-title">Викториналар</h1>
          </div>
          <Link to="/quizzes/new" className="qz-btn qz-btn--primary">Жаңа викторина</Link>
        </div>

        {error && <div className="qz-alert" role="alert">{error}</div>}

        <section className="qz-card" aria-label="Викториналарым">
          {quizzes === null ? (
            <div className="qz-empty">Жүктелуде…</div>
          ) : quizzes.length === 0 ? (
            <div className="qz-empty qz-empty--hero">
              <img src={mascotThink} alt="" />
              <h2>Алғашқы викторинаңызды жасаңыз</h2>
              <p>Сұрақтарды жазасыз, оқушылар PIN арқылы өз телефонынан қосылып, жарысады.</p>
              <Link to="/quizzes/new" className="qz-btn qz-btn--primary">Жаңа викторина</Link>
              {loadFailed && (
                <p className="qz-note">
                  Тізімді қазір жүктей алмадық.{' '}
                  <button type="button" className="qz-linkbtn" onClick={() => { load(); }}>Қайталау</button>
                </p>
              )}
            </div>
          ) : (
            <ul className="qz-list">
              {quizzes.map((q) => (
                <li key={q.id} className="qz-row">
                  <div className="qz-row__main">
                    <Link to={`/quizzes/${q.id}`} className="qz-row__title">{q.title}</Link>
                    <div className="qz-row__meta">
                      <span>{q.questionCount} сұрақ</span>
                      <span>~{minutes(q.totalSeconds)} мин</span>
                      {q.subject && <span className="qz-chip">{q.subject}</span>}
                      {q.ownerName && <span>{q.ownerName}</span>}
                      <span>{fmtDate(q.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="qz-row__actions">
                    <button
                      type="button"
                      className="qz-btn qz-btn--primary"
                      disabled={busyId === q.id || q.questionCount === 0}
                      onClick={() => startGame(q)}
                    >
                      {busyId === q.id ? 'Ашылуда…' : 'Ойынды бастау'}
                    </button>
                    <Link to={`/quizzes/${q.id}`} className="qz-btn">Өңдеу</Link>
                    <button type="button" className="qz-btn qz-btn--ghost" disabled={busyId === q.id} onClick={() => duplicate(q)}>
                      Көшірме
                    </button>
                    {confirmId === q.id ? (
                      <button type="button" className="qz-btn qz-btn--danger" disabled={busyId === q.id} onClick={() => remove(q)}>
                        Растау: өшіру
                      </button>
                    ) : (
                      <button type="button" className="qz-btn qz-btn--ghost" onClick={() => { setConfirmId(q.id); setTimeout(() => setConfirmId(null), 3500); }}>
                        Өшіру
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {games && games.length > 0 && (
          <section className="qz-card qz-card--spaced" aria-label="Соңғы ойындар">
            <div className="qz-card__head">
              <h2>Соңғы ойындар</h2>
            </div>
            <div className="qz-tablewrap">
              <table className="qz-table qz-table--stack">
                <thead>
                  <tr>
                    <th>Күні</th><th>Викторина</th><th>Ойыншы</th><th>Жеңімпаз</th><th>Күйі</th><th />
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.id}>
                      <td className="is-date">{fmtDate(g.createdAt)}</td>
                      <td className="is-name is-title">{g.title}</td>
                      <td data-label="Ойыншы">{g.players}</td>
                      <td data-label="Жеңімпаз">{g.winner ? `${g.winner} · ${Number(g.winnerScore).toLocaleString('ru-RU')}` : '—'}</td>
                      <td>
                        <span className={`qz-chip ${g.status === 'finished' ? '' : 'qz-chip--live'}`}>{STATUS[g.status] || g.status}</span>
                        {g.pin && <span className="qz-pin"> PIN {g.pin}</span>}
                      </td>
                      <td className="qz-table__act">
                        {g.status === 'finished'
                          ? <Link className="qz-link" to={`/games/${g.id}/results`}>Нәтиже</Link>
                          : <Link className="qz-link" to={`/host/${g.id}`}>Жалғастыру</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
