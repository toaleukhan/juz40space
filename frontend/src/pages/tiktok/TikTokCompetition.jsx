import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconImage } from '../../components/icons';
import { tiktok, errorText } from '../../services/tiktokApi';
import { monthLabel, shiftMonth, currentMonth, fmtDateTime } from '../../utils/tiktok';
import Overview from './Overview';
import TopBar from './TopBar';
import Grading from './Grading';
import PostingCalendar from './PostingCalendar';
import Insights from './Insights';
import VideosTable from './VideosTable';
import DepartmentsDialog from './DepartmentsDialog';
import ShareImageDialog from './ShareImageDialog';
import ApifyDialog from './ApifyDialog';
import '../../styles/quiz.css';
import '../../styles/tiktok.css';
import '../../styles/overview.css';

const TABS = [
  { key: 'rating', label: 'Рейтинг' },
  { key: 'grading', label: 'Бағалау' },
  { key: 'calendar', label: 'Тұрақтылық' },
  { key: 'analysis', label: 'Анализ' },
  { key: 'videos', label: 'Видеолар' },
];

const POLL_MS = 8000;
const LIVE_MS = 60000; // бет ашық тұрғанда рейтинг өзі жаңарып тұрады

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
  const [shareOpen, setShareOpen] = useState(false);
  const [apifyOpen, setApifyOpen] = useState(false);

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

  // «Тірі» режим: бет көрініп тұрса, минут сайын деректерді тыныш жаңартамыз
  // (жюри ұпайы өзгерсе, жарыс жолы өзі қозғалады).
  useEffect(() => {
    if (tab !== 'rating') return undefined;
    const t = setInterval(() => { if (!document.hidden) reload(); }, LIVE_MS);
    return () => clearInterval(t);
  }, [tab, reload]);

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
    <div className="tt-page">
      <TopBar tabs={data && !noDepts ? TABS : null} tab={tab} onTab={(k) => setParam('tab', k)} />
      <main className="qz tt">
        <div className="qz-head">
          <div>
            <h1 className="qz-title">TikTok жарысы</h1>
          </div>
          <div className="tt-toolbar">
            <div className="tt-month" aria-label="Ай">
              <button type="button" onClick={() => setParam('month', shiftMonth(month, -1))} aria-label="Алдыңғы ай">‹</button>
              <span>{monthLabel(month)}</span>
              <button type="button" onClick={() => setParam('month', shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="Келесі ай">›</button>
            </div>
            <button type="button" className="qz-btn" onClick={() => setShareOpen(true)}
              disabled={!data || !data.leaderboard.length} title="Рейтингті сурет етіп жүктеу">
              <IconImage width={16} height={16} /> Сурет
            </button>
            <button type="button" className="qz-btn" onClick={() => setDeptsOpen(true)}>Бөлімдер</button>
            <button type="button" className="qz-btn" onClick={() => setApifyOpen(true)} title="Apify токені және лимит">Apify</button>
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

        {error && (
          <div className="qz-alert" role="alert">
            {error}
            {/Apify/.test(error) && (
              <> {' '}<button type="button" className="qz-btn qz-btn--ghost" style={{ padding: '2px 8px' }} onClick={() => setApifyOpen(true)}>Токенді ауыстыру</button></>
            )}
          </div>
        )}

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
            {tab === 'rating' && <Overview data={data} month={month} />}
            {tab === 'grading' && <Grading data={data} month={month} onSaved={reload} />}
            {tab === 'calendar' && <PostingCalendar data={data} />}
            {tab === 'analysis' && <Insights data={data} month={month} onAnalysis={(analysis) => setData((d) => ({ ...d, analysis }))} />}
            {tab === 'videos' && <VideosTable data={data} />}
          </>
        )}

        {shareOpen && data && <ShareImageDialog data={data} onClose={() => setShareOpen(false)} />}

        {apifyOpen && <ApifyDialog onClose={() => setApifyOpen(false)} onSaved={() => setError('')} />}

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
