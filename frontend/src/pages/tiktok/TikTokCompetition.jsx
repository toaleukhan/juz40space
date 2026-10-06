import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { tiktok, errorText } from '../../services/tiktokApi';
import { monthLabel, shiftMonth, currentMonth, fmtDateTime } from '../../utils/tiktok';
import Leaderboard from './Leaderboard';
import PostingCalendar from './PostingCalendar';
import Insights from './Insights';
import VideosTable from './VideosTable';
import DepartmentsDialog from './DepartmentsDialog';
import '../../styles/quiz.css';
import '../../styles/tiktok.css';

const TABS = [
  { key: 'rating', label: 'Рейтинг' },
  { key: 'calendar', label: 'Тұрақтылық' },
  { key: 'analysis', label: 'Анализ' },
  { key: 'videos', label: 'Видеолар' },
];

const POLL_MS = 8000;

// 🎬 Бөлімдер арасындағы TikTok жарысы: Apify-дан тартылған видеолар
// бойынша автомат ұпайлар, жюри ұпайлары, күнтізбе, «не өтеді» анализі
// және Gemini қорытындысы. Тек Media team тимлидіне (role = media).
export default function TikTokCompetition() {
  const [params, setParams] = useSearchParams();
  const thisMonth = currentMonth();
  const month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : thisMonth;
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'rating';

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  // key={month}: ай ауысқанда бүкіл күй (деректер, синхрон) таза басталады
  return <MonthView key={month} month={month} thisMonth={thisMonth} tab={tab} setParam={setParam} />;
}

function MonthView({ month, thisMonth, tab, setParam }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sync, setSync] = useState(null);
  const [syncId, setSyncId] = useState(null);
  const [deptsOpen, setDeptsOpen] = useState(false);

  const reload = useCallback(() => tiktok.overview(month)
    .then((d) => { setData(d); setError(''); return d; })
    .catch((err) => { setError(errorText(err, 'Деректерді жүктеу мүмкін болмады')); return null; }), [month]);

  useEffect(() => {
    let alive = true;
    tiktok.overview(month)
      .then((d) => {
        if (!alive) return;
        setData(d);
        const s = d.lastSync;
        if (s && (s.status === 'running' || s.status === 'ingesting')) { setSync(s); setSyncId(s.id); }
      })
      .catch((err) => alive && setError(errorText(err, 'Деректерді жүктеу мүмкін болмады')));
    return () => { alive = false; };
  }, [month]);

  // Apify жұмысы біткенше күйін сұрап тұрамыз; біткен соң деректерді қайта аламыз.
  useEffect(() => {
    if (!syncId) return undefined;
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const s = await tiktok.syncStatus(syncId);
        if (!alive) return;
        setSync(s);
        if (s.status === 'running' || s.status === 'ingesting') timer = setTimeout(tick, POLL_MS);
        else { setSyncId(null); reload(); }
      } catch (err) {
        if (!alive) return;
        setSync(null);
        setSyncId(null);
        setError(errorText(err, 'Жаңарту күйін тексеру мүмкін болмады'));
      }
    };
    timer = setTimeout(tick, POLL_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [syncId, reload]);

  const startSync = async () => {
    setError('');
    try {
      const s = await tiktok.startSync(month);
      setSync(s);
      setSyncId(s.id);
    } catch (err) {
      setError(errorText(err, 'Жаңартуды бастау мүмкін болмады'));
    }
  };

  const busy = sync && (sync.status === 'running' || sync.status === 'ingesting');
  const last = data?.lastSync;
  const noDepts = data && data.departments.filter((d) => !d.isTeamAccount).length === 0;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="qz tt">
        <div className="qz-head">
          <div>
            <div className="qz-eyebrow">MEDIA · TIKTOK ЖАРЫСЫ</div>
            <h1 className="qz-title">TikTok үздігі</h1>
          </div>
          <div className="tt-toolbar">
            <div className="tt-month" aria-label="Ай">
              <button type="button" onClick={() => setParam('month', shiftMonth(month, -1))} aria-label="Алдыңғы ай">‹</button>
              <span>{monthLabel(month)}</span>
              <button type="button" onClick={() => setParam('month', shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="Келесі ай">›</button>
            </div>
            <button type="button" className="qz-btn" onClick={() => setDeptsOpen(true)}>Бөлімдер</button>
            <button type="button" className="qz-btn qz-btn--primary" onClick={startSync} disabled={busy || !data || noDepts}>
              {busy ? 'Жаңартылуда…' : 'Деректерді жаңарту'}
            </button>
          </div>
        </div>

        {data && (
          <div className="tt-status" role="status">
            {busy ? (
              <><span className="tt-dot tt-dot--busy" />TikTok-тан видеолар тартылып жатыр — әдетте 1–5 минут. Бетті жаба берсеңіз болады.</>
            ) : (
              <>
                <span className={`tt-dot ${data.window.isCurrent ? 'tt-dot--live' : ''}`} />
                {data.window.isCurrent
                  ? `Аралық рейтинг: ${data.window.workdays.length} / ${countWorkdays(data)} жұмыс күні өтті`
                  : `Қорытынды: ${data.window.workdays.length} жұмыс күні`}
                <span>·</span>
                {last?.status === 'done'
                  ? <span>Соңғы жаңарту: {fmtDateTime(last.finishedAt)} ({last.videoCount} видео)</span>
                  : last?.status === 'failed'
                    ? <span style={{ color: 'var(--qz-bad)' }}>Соңғы жаңарту сәтсіз: {last.error}</span>
                    : <span>Бұл айдың деректері әлі тартылған жоқ</span>}
              </>
            )}
          </div>
        )}

        {error && <div className="qz-alert" role="alert">{error}</div>}

        {!data ? (
          error ? null : <section className="qz-card"><div className="tt-loading"><span className="tt-spin" />Жүктелуде…</div></section>
        ) : noDepts ? (
          <section className="qz-card">
            <div className="qz-empty qz-empty--hero">
              <h2>Бөлімдерді қосудан бастаңыз</h2>
              <p>Әр бөлімнің атауы мен TikTok аккаунтын (@username) енгізіңіз. Juz40_team аккаунтын да қосуға болады — сонда бөлімдердің оған қосқан үлесі есептеледі.</p>
              <button type="button" className="qz-btn qz-btn--primary" onClick={() => setDeptsOpen(true)}>Бөлім қосу</button>
            </div>
          </section>
        ) : (
          <>
            <div className="qz-seg tt-tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                  className={tab === t.key ? 'is-on' : ''} onClick={() => setParam('tab', t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'rating' && <Leaderboard data={data} month={month} onSaved={reload} />}
            {tab === 'calendar' && <PostingCalendar data={data} />}
            {tab === 'analysis' && <Insights data={data} month={month} onAnalysis={(analysis) => setData((d) => ({ ...d, analysis }))} />}
            {tab === 'videos' && <VideosTable data={data} />}
          </>
        )}

        {deptsOpen && (
          <DepartmentsDialog
            onClose={() => setDeptsOpen(false)}
            onChanged={reload}
          />
        )}
      </main>
    </div>
  );
}

// Айдағы барлық жұмыс күні (бүгіннен кейінгілерді қоса)
function countWorkdays(data) {
  const { start, end } = data.allDays;
  let n = 0;
  for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
}
