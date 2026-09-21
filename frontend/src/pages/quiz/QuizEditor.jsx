import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';
import { errorText } from '../../services/gameApi';
import { ShapeIcon, CheckIcon } from '../../components/quiz/shapes';
import { ANSWER_META } from '../../components/quiz/answerMeta';
import ConfirmDialog from '../../components/quiz/ConfirmDialog';
import ImportDialog from '../../components/quiz/ImportDialog';
import '../../styles/quiz.css';

const SUBJECTS = ['ФИЗ', 'МАТ', 'ТІЛ', 'БИО', 'ИНФО', 'ГЕО', 'ТАРИХ', 'РУС', 'ХИМ', 'МС', 'ӘДЕБ', 'АНГЛ', 'ДЖТ'];
const TIMES = [5, 10, 20, 30, 60, 90, 120];
const POINTS = [
  { id: 'standard', label: 'Қалыпты' },
  { id: 'double', label: 'Екі есе' },
  { id: 'none', label: 'Ұпайсыз' },
];

let seq = 0;
const nextKey = () => `q${Date.now()}-${++seq}`;

const blankQuestion = (kind = 'choice') => (kind === 'truefalse'
  ? { _key: nextKey(), kind, prompt: '', options: ['Дұрыс', 'Бұрыс'], correct: [0], timeLimit: 10, pointsMode: 'standard', multi: false }
  : { _key: nextKey(), kind: 'choice', prompt: '', options: ['', '', '', ''], correct: [0], timeLimit: 20, pointsMode: 'standard', multi: false });

const fromServer = (q) => ({ ...q, _key: nextKey(), multi: q.correct.length > 1 });

// Сақтамас бұрын бірден көрінетін тексеру. Сервер де сол ережемен
// тексереді, бірақ мұнда қате бірден, дұрыс сұрақтың өзінде көрінеді.
function issuesOf(q) {
  const out = [];
  if (!q.prompt.trim()) out.push('Сұрақ мәтінін жазыңыз');
  if (q.kind === 'choice') {
    if (q.options.some((o) => !o.trim())) out.push('Барлық жауап нұсқасын толтырыңыз');
  }
  if (q.correct.length === 0) out.push('Дұрыс жауапты белгілеңіз');
  else if (q.options.length > 1 && q.correct.length >= q.options.length) out.push('Барлық нұсқаны дұрыс деп белгілеуге болмайды');
  return out;
}

function Ico({ d, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}
const UP = 'M6 15l6-6 6 6';
const DOWN = 'M6 9l6 6 6-6';
const COPY = 'M9 9h10v10H9zM5 15V5h10';
const TRASH = 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3';

export default function QuizEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState(() => (isNew ? [blankQuestion()] : []));
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  // Қате-ескертулер бос жаңа сұрақта бірден шықпасын: сақтауға тырысқаннан кейін ғана.
  const [checked, setChecked] = useState(false);
  const loadedId = useRef(isNew ? 'new' : null);
  const [leaveTo, setLeaveTo] = useState(null); // сақталмай шығудың мақсатты беті
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isNew || loadedId.current === id) return;
    loadedId.current = id;
    api.get(`/quizzes/${id}`)
      .then(({ data }) => {
        setTitle(data.title);
        setSubject(data.subject || '');
        setDescription(data.description || '');
        setQuestions(data.questions.map(fromServer));
        setLoading(false);
      })
      .catch((err) => { setError(errorText(err, 'Викторина табылмады')); setLoading(false); });
  }, [id, isNew]);

  // Сақталмаған өзгеріспен беттен шығып кетуден қорғау.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Беттің ішіндегі кез келген сілтеме (сайдбар да, «← Викториналар» да)
  // сақталмаған өзгерісті үнсіз жоғалтпасын: алдымен өз тереземіз сұрайды.
  // Жаңарту/жабу үшін браузердің beforeunload ескертуі жоғарыда қалады.
  useEffect(() => {
    if (!dirty) return undefined;
    const intercept = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.origin !== window.location.origin) return;
      const to = a.pathname + a.search + a.hash;
      if (to === window.location.pathname + window.location.search + window.location.hash) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(to);
    };
    document.addEventListener('click', intercept, true);
    return () => document.removeEventListener('click', intercept, true);
  }, [dirty]);

  const touch = () => { setDirty(true); setError(''); };
  const q = questions[selected];
  const allIssues = questions.map(issuesOf);
  const badCount = allIssues.filter((x) => x.length).length;

  const patchQ = (i, patch) => {
    setQuestions((list) => list.map((item, k) => (k === i ? { ...item, ...patch } : item)));
    touch();
  };

  const setOption = (i, k, text) => patchQ(i, { options: questions[i].options.map((o, n) => (n === k ? text : o)) });

  const toggleCorrect = (i, k) => {
    const cur = questions[i];
    let correct;
    if (cur.kind === 'truefalse' || !cur.multi) correct = [k];
    else correct = cur.correct.includes(k) ? cur.correct.filter((x) => x !== k) : [...cur.correct, k].sort((a, b) => a - b);
    patchQ(i, { correct });
  };

  const addOption = (i) => {
    if (questions[i].options.length >= 4) return;
    patchQ(i, { options: [...questions[i].options, ''] });
  };

  const removeOption = (i, k) => {
    const cur = questions[i];
    if (cur.options.length <= 2) return;
    const correct = cur.correct.filter((c) => c !== k).map((c) => (c > k ? c - 1 : c));
    patchQ(i, { options: cur.options.filter((_, n) => n !== k), correct: correct.length ? correct : [0] });
  };

  const setKind = (i, kind) => {
    if (questions[i].kind === kind) return;
    const base = blankQuestion(kind);
    patchQ(i, { kind, options: base.options, correct: [0], timeLimit: questions[i].timeLimit, multi: false });
  };

  const setMulti = (i, multi) => {
    const cur = questions[i];
    patchQ(i, { multi, correct: multi ? cur.correct : cur.correct.slice(0, 1) });
  };

  const addQuestion = (kind) => {
    setQuestions((list) => [...list, blankQuestion(kind)]);
    setSelected(questions.length);
    touch();
  };

  // Мәтіннен қосылған сұрақтар. Жаңа викторинаның бос бірінші сұрағы
  // қалып қоймасын: ол болса, оны ауыстырамыз.
  const onlyBlank = questions.length === 1 && !questions[0].prompt.trim() && questions[0].options.every((o) => !o.trim());
  const room = 80 - (onlyBlank ? 0 : questions.length);

  const importQuestions = (list, timeLimit) => {
    const fresh = list.map((it) => ({ ...it, _key: nextKey(), timeLimit, pointsMode: 'standard' }));
    setSelected(onlyBlank ? 0 : questions.length);
    setQuestions(onlyBlank ? fresh : [...questions, ...fresh]);
    setImporting(false);
    touch();
  };

  const duplicateQuestion = (i) => {
    setQuestions((list) => {
      const copy = { ...list[i], _key: nextKey(), options: [...list[i].options], correct: [...list[i].correct] };
      return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
    });
    setSelected(i + 1);
    touch();
  };

  const removeQuestion = (i) => {
    if (questions.length <= 1) return;
    setQuestions((list) => list.filter((_, k) => k !== i));
    setSelected((s) => Math.min(s > i ? s - 1 : s, questions.length - 2));
    touch();
  };

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    setQuestions((list) => {
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSelected(j);
    touch();
  };

  // Сақтау. Сәтті болса — сақталған викторина id-ін қайтарады.
  const save = async () => {
    if (badCount > 0) {
      setChecked(true);
      setSelected(allIssues.findIndex((x) => x.length));
      setError('Кейбір сұрақтар толық емес — қызыл белгіленген сұрақтарды тексеріңіз');
      return null;
    }
    if (!title.trim()) { setError('Викторинаның атауын жазыңыз'); return null; }

    setSaving(true);
    setError('');
    const payload = {
      title,
      subject: subject || null,
      description: description || null,
      questions: questions.map(({ _key, multi, ...rest }) => { void _key; void multi; return rest; }),
    };
    try {
      let quizId = id;
      if (isNew) {
        const { data } = await api.post('/quizzes', payload);
        quizId = String(data.id);
        loadedId.current = quizId; // жаңа id бойынша қайта жүктемеу үшін
        navigate(`/quizzes/${quizId}`, { replace: true });
      } else {
        await api.put(`/quizzes/${id}`, payload);
      }
      setDirty(false);
      setSavedAt(new Date());
      return quizId;
    } catch (err) {
      const first = err.response?.data?.errors?.[0];
      const m = first && /^questions\[(\d+)\]/.exec(first.field);
      if (m) setSelected(Number(m[1]));
      setError(errorText(err, 'Сақтау мүмкін болмады'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveAndPlay = async () => {
    const quizId = dirty || isNew ? await save() : id;
    if (!quizId) return;
    try {
      const { data } = await api.post('/games', { quizId: Number(quizId) });
      navigate(`/host/${data.id}`);
    } catch (err) {
      setError(errorText(err, 'Ойынды бастау мүмкін болмады'));
    }
  };

  const leaveAnyway = () => {
    const to = leaveTo;
    setDirty(false);
    setLeaveTo(null);
    navigate(to);
  };

  if (loading) {
    return (
      <div className="app-shell"><Sidebar /><main className="qz"><div className="qz-empty">Жүктелуде…</div></main></div>
    );
  }

  if (!q) {
    return (
      <div className="app-shell"><Sidebar />
        <main className="qz">
          <div className="qz-alert" role="alert">{error || 'Викторина табылмады'}</div>
          <Link to="/quizzes" className="qz-btn">Викториналарға оралу</Link>
        </main>
      </div>
    );
  }

  const issues = checked ? allIssues[selected] : [];
  const isTF = q.kind === 'truefalse';

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="qz">
        <div className="qz-editbar">
          <Link to="/quizzes" className="qz-btn qz-btn--ghost">← Викториналар</Link>
          <div className="qz-editbar__status" role="status">
            {saving ? 'Сақталуда…' : dirty ? 'Сақталмаған өзгерістер' : savedAt ? 'Сақталды' : ''}
          </div>
          <button type="button" className="qz-btn" disabled={saving || !dirty} onClick={save}>Сақтау</button>
          <button type="button" className="qz-btn qz-btn--primary" disabled={saving} onClick={saveAndPlay}>Ойынды бастау</button>
        </div>

        <div className="qz-meta">
          <input
            className="qz-titleinput"
            value={title}
            onChange={(e) => { setTitle(e.target.value); touch(); }}
            placeholder="Викторинаның атауы"
            maxLength={120}
            aria-label="Викторинаның атауы"
          />
          <select
            className="qz-select"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); touch(); }}
            aria-label="Пән"
          >
            <option value="">Пәні жоқ</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <textarea
          className="qz-desc"
          value={description}
          onChange={(e) => { setDescription(e.target.value); touch(); }}
          placeholder="Сипаттама (міндетті емес)"
          maxLength={300}
          rows={1}
          aria-label="Сипаттама"
        />

        {error && <div className="qz-alert" role="alert">{error}</div>}

        <div className="qz-editor">
          {/* ── сұрақтар тізімі ─────────────────────────────────── */}
          <aside className="qz-side" aria-label="Сұрақтар">
            <ol className="qz-qlist">
              {questions.map((item, i) => (
                <li key={item._key} className={`qz-qitem ${i === selected ? 'is-on' : ''} ${checked && allIssues[i].length ? 'is-bad' : ''}`}>
                  <button type="button" className="qz-qitem__main" onClick={() => setSelected(i)} aria-current={i === selected ? 'true' : undefined}>
                    <span className="qz-qitem__n">{i + 1}</span>
                    <span className="qz-qitem__text">{item.prompt.trim() || 'Жаңа сұрақ'}</span>
                    <span className="qz-qitem__time">{item.timeLimit} с</span>
                  </button>
                  {i === selected && (
                    <div className="qz-qitem__tools">
                      <button type="button" className="qz-iconbtn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Жоғары жылжыту"><Ico d={UP} /></button>
                      <button type="button" className="qz-iconbtn" onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Төмен жылжыту"><Ico d={DOWN} /></button>
                      <button type="button" className="qz-iconbtn" onClick={() => duplicateQuestion(i)} aria-label="Сұрақтың көшірмесі"><Ico d={COPY} /></button>
                      <button type="button" className="qz-iconbtn qz-iconbtn--danger" onClick={() => removeQuestion(i)} disabled={questions.length <= 1} aria-label="Сұрақты өшіру"><Ico d={TRASH} /></button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <div className="qz-side__add">
              <button type="button" className="qz-btn qz-btn--block" onClick={() => addQuestion('choice')} disabled={questions.length >= 80}>+ Сұрақ</button>
              <button type="button" className="qz-btn qz-btn--ghost qz-btn--block" onClick={() => addQuestion('truefalse')} disabled={questions.length >= 80}>+ Дұрыс / Бұрыс</button>
              <button type="button" className="qz-btn qz-btn--ghost qz-btn--block" onClick={() => setImporting(true)} disabled={room <= 0}>Мәтіннен қосу</button>
            </div>
          </aside>

          {/* ── таңдалған сұрақ ─────────────────────────────────── */}
          <section className="qz-pane" aria-label={`${selected + 1}-сұрақ`}>
            {issues.length > 0 && (
              <ul className="qz-issues" role="status">
                {issues.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}

            <label className="qz-field">
              <span className="qz-label">Сұрақ мәтіні <em>{q.prompt.length}/500</em></span>
              <textarea
                className="qz-textarea"
                value={q.prompt}
                onChange={(e) => patchQ(selected, { prompt: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder="Мысалы: Жарық жылдамдығы қанша?"
              />
            </label>

            <div className="qz-options">
              {q.options.map((text, k) => {
                const on = q.correct.includes(k);
                return (
                  <div key={k} className={`qz-opt qz-opt--${ANSWER_META[k].key} ${on ? 'is-correct' : ''}`}>
                    <span className="qz-opt__shape"><ShapeIcon index={k} size={20} /></span>
                    <input
                      className="qz-opt__input"
                      value={text}
                      disabled={isTF}
                      maxLength={150}
                      placeholder={`${k + 1}-нұсқа`}
                      onChange={(e) => setOption(selected, k, e.target.value)}
                      aria-label={`${k + 1}-жауап нұсқасы`}
                    />
                    <button
                      type="button"
                      className="qz-opt__ok"
                      aria-pressed={on}
                      aria-label={`${k + 1}-нұсқа дұрыс жауап`}
                      onClick={() => toggleCorrect(selected, k)}
                    >
                      {on ? <CheckIcon size={16} /> : null}
                      <span>{on ? 'Дұрыс' : 'Дұрыс па?'}</span>
                    </button>
                    {!isTF && q.options.length > 2 && (
                      <button type="button" className="qz-iconbtn" onClick={() => removeOption(selected, k)} aria-label={`${k + 1}-нұсқаны өшіру`}>
                        <Ico d="M6 6l12 12M18 6L6 18" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!isTF && q.options.length < 4 && (
                <button type="button" className="qz-btn qz-btn--ghost qz-add" onClick={() => addOption(selected)}>+ Нұсқа қосу</button>
              )}
            </div>

            <div className="qz-settings">
              <fieldset className="qz-fs">
                <legend>Түрі</legend>
                <div className="qz-seg" role="radiogroup">
                  {[{ id: 'choice', label: 'Таңдау' }, { id: 'truefalse', label: 'Дұрыс / Бұрыс' }].map((o) => (
                    <button key={o.id} type="button" role="radio" aria-checked={q.kind === o.id} className={q.kind === o.id ? 'is-on' : ''} onClick={() => setKind(selected, o.id)}>{o.label}</button>
                  ))}
                </div>
              </fieldset>

              {!isTF && (
                <fieldset className="qz-fs">
                  <legend>Дұрыс жауап саны</legend>
                  <div className="qz-seg" role="radiogroup">
                    {[{ v: false, label: 'Біреу' }, { v: true, label: 'Бірнеше' }].map((o) => (
                      <button key={o.label} type="button" role="radio" aria-checked={q.multi === o.v} className={q.multi === o.v ? 'is-on' : ''} onClick={() => setMulti(selected, o.v)}>{o.label}</button>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset className="qz-fs">
                <legend>Уақыт</legend>
                <div className="qz-seg" role="radiogroup">
                  {(TIMES.includes(q.timeLimit) ? TIMES : [...TIMES, q.timeLimit].sort((a, b) => a - b)).map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={q.timeLimit === t} className={q.timeLimit === t ? 'is-on' : ''} onClick={() => patchQ(selected, { timeLimit: t })}>{t} с</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="qz-fs">
                <legend>Ұпай</legend>
                <div className="qz-seg" role="radiogroup">
                  {POINTS.map((o) => (
                    <button key={o.id} type="button" role="radio" aria-checked={q.pointsMode === o.id} className={q.pointsMode === o.id ? 'is-on' : ''} onClick={() => patchQ(selected, { pointsMode: o.id })}>{o.label}</button>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>
        </div>
        {importing && <ImportDialog room={room} onImport={importQuestions} onClose={() => setImporting(false)} />}
        {leaveTo && (
          <ConfirmDialog
            title="Сақталмаған өзгерістер бар"
            message="Қазір шықсаңыз, жазғандарыңыз жоғалады."
            confirmLabel="Сақтамай шығу"
            cancelLabel="Осында қалу"
            danger
            onConfirm={leaveAnyway}
            onCancel={() => setLeaveTo(null)}
          />
        )}
      </main>
    </div>
  );
}
