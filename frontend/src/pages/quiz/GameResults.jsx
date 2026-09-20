import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';
import { errorText } from '../../services/gameApi';
import { exportResultsXlsx } from '../../utils/quizExport';
import { ShapeIcon } from '../../components/quiz/shapes';
import { ANSWER_META } from '../../components/quiz/answerMeta';
import '../../styles/quiz.css';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');
const sec = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} с`);

// Ойынның толық нәтижесі: рейтинг, сұрақ бойынша талдау және әр оқушының
// әр сұраққа жауабы. Оқытушыға «қай тақырыпты қайталау керек» деген
// сұраққа жауап: дұрыс % ең төмен сұрақтар жоғарыда бөлектеледі.
export default function GameResults() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/games/${id}/results`)
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(errorText(err, 'Нәтиже табылмады')));
  }, [id]);

  if (error) {
    return (
      <div className="app-shell"><Sidebar />
        <main className="qz">
          <div className="qz-alert" role="alert">{error}</div>
          <Link to="/quizzes" className="qz-btn">Викториналарға оралу</Link>
        </main>
      </div>
    );
  }
  if (!data) {
    return <div className="app-shell"><Sidebar /><main className="qz"><div className="qz-empty">Жүктелуде…</div></main></div>;
  }

  const { game, players, questions } = data;
  const played = Math.max(game.played, 1);
  const pct = (q) => {
    const total = q.answeredCount + q.noAnswer;
    return total ? Math.round((q.correctCount / total) * 100) : 0;
  };
  const weakest = [...questions].sort((a, b) => pct(a) - pct(b))[0];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="qz">
        <div className="qz-head">
          <div>
            <div className="qz-eyebrow">JUZ40 · ВИКТОРИНА · НӘТИЖЕ</div>
            <h1 className="qz-title">{game.title}</h1>
            <div className="qz-row__meta">
              <span>{new Date(game.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span>{players.length} ойыншы</span>
              <span>{game.played} / {game.totalQuestions} сұрақ ойналды</span>
            </div>
          </div>
          <div className="qz-head__actions">
            <Link to="/quizzes" className="qz-btn qz-btn--ghost">← Викториналар</Link>
            <button type="button" className="qz-btn qz-btn--primary" disabled={players.length === 0} onClick={() => exportResultsXlsx(data)}>
              Excel-ге жүктеу
            </button>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="qz-card"><div className="qz-empty">Бұл ойында ойыншы болмады.</div></div>
        ) : (
          <>
            {weakest && questions.length > 1 && pct(weakest) < 60 && (
              <div className="qz-insight" role="note">
                Ең қиын сұрақ: <b>№{weakest.index + 1}</b> — дұрыс жауап берген {pct(weakest)}%. Осы тақырыпты қайталау керек болуы мүмкін.
              </div>
            )}

            <section className="qz-card" aria-label="Рейтинг">
              <div className="qz-card__head"><h2>Рейтинг</h2></div>
              <div className="qz-tablewrap">
                <table className="qz-table">
                  <thead><tr><th>Орын</th><th>Ойыншы</th><th>Ұпай</th><th>Дұрыс</th><th>Дәлдік</th><th>Орташа уақыт</th></tr></thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id}>
                        <td className="is-name">{p.rank}</td>
                        <td className="is-name">{p.nickname}</td>
                        <td>{fmt(p.score)}</td>
                        <td>{p.correctCount} / {game.played}</td>
                        <td>{Math.round((p.correctCount / played) * 100)}%</td>
                        <td>{sec(p.avgMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="qz-card qz-card--spaced" aria-label="Сұрақтар бойынша талдау">
              <div className="qz-card__head"><h2>Сұрақтар бойынша</h2></div>
              <div className="qz-tablewrap">
                <table className="qz-table">
                  <thead><tr><th>№</th><th>Сұрақ</th><th>Дұрыс жауап</th><th>Дұрыс</th><th>Таңдалған нұсқалар</th><th>Уақыт</th></tr></thead>
                  <tbody>
                    {questions.map((q) => {
                      const p = pct(q);
                      const max = Math.max(...q.counts, 1);
                      return (
                        <tr key={q.index}>
                          <td className="is-name">{q.index + 1}</td>
                          <td className="qz-cell-wrap">{q.prompt}</td>
                          <td className="qz-cell-wrap">{q.correct.map((i) => q.options[i]).join(' / ')}</td>
                          <td>
                            <span className={`qz-chip ${p < 50 ? 'qz-chip--bad' : p >= 80 ? 'qz-chip--good' : ''}`}>{p}%</span>
                          </td>
                          <td>
                            <div className="qz-dist" aria-label={q.options.map((o, i) => `${o}: ${q.counts[i]}`).join(', ')}>
                              {q.options.map((o, i) => (
                                <span key={i} className={`qz-dist__bar qz-opt--${ANSWER_META[i].key} ${q.correct.includes(i) ? 'is-correct' : ''}`} title={`${o}: ${q.counts[i]}`}>
                                  <ShapeIcon index={i} size={11} />
                                  <i style={{ width: `${(q.counts[i] / max) * 100}%` }} />
                                  <b>{q.counts[i]}</b>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>{sec(q.avgMs)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="qz-card qz-card--spaced" aria-label="Жауаптар">
              <div className="qz-card__head"><h2>Кім не жауап берді</h2><span className="qz-card__sub">✓ дұрыс · ✗ қате · — жауап жоқ</span></div>
              <div className="qz-tablewrap">
                <table className="qz-table qz-table--matrix">
                  <thead>
                    <tr>
                      <th>Ойыншы</th>
                      {questions.map((q) => <th key={q.index} className="is-c">{q.index + 1}</th>)}
                      <th className="is-c">Ұпай</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id}>
                        <td className="is-name">{p.nickname}</td>
                        {p.answers.map((a, i) => (
                          <td key={i} className={`is-c qz-mx ${a ? (a.correct ? 'is-ok' : 'is-no') : 'is-none'}`} title={a ? `${a.points} ұпай · ${sec(a.ms)}` : 'Жауап жоқ'}>
                            {a ? (a.correct ? '✓' : '✗') : '—'}
                          </td>
                        ))}
                        <td className="is-c">{fmt(p.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
