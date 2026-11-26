import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconImage } from '../../components/icons';
import { tiktok, errorText } from '../../services/tiktokApi';
import { monthLabel, shiftMonth, currentMonth } from '../../utils/tiktok';
import Overview from './Overview';
import TopBar from './TopBar';
import { AvatarContext } from './avatarContext';
import Grading from './Grading';
import PostingCalendar from './PostingCalendar';
import Insights from './Insights';
import VideosTable from './VideosTable';
import DepartmentsDialog from './DepartmentsDialog';
import ShareImageDialog from './ShareImageDialog';
import ApifyDialog from './ApifyDialog';
import '../../styles/quiz.css';
import '../../styles/tiktok.css';
import '../../styles/juz40-font.css';
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
  const avatars = useMemo(() => Object.fromEntries((data?.departments || [])
    .filter((d) => d.avatarVersion).map((d) => [d.id, d.avatarVersion])), [data]);
  const last = data?.lastSync;
  const noDepts = data && data.departments.filter((d) => !d.isTeamAccount).length === 0;

  return (
    <AvatarContext.Provider value={avatars}>
    <div className="tt-page">
      <TopBar
        tabs={data && !noDepts ? TABS : null}
        tab={tab}
        onTab={(k) => setParam('tab', k)}
        settings={[
          { label: 'Бөлімдер', hint: 'TikTok аккаунттары мен хештегтер', onClick: () => setDeptsOpen(true) },
          { label: 'Apify токені', hint: 'Деректерді тарту лимиті', onClick: () => setApifyOpen(true) },
        ]}
      />
      <main className="qz tt">
        <div className="qz-head">
          <div>
            <div className="tt-eyebrow">Media · бөлімдер арасындағы жарыс</div>
            <h1 className="qz-title">TikTok жарысы</h1>
          </div>
          <div className="tt-toolbar">
            <div className="tt-month" aria-label="Ай">
              <button type="button" onClick={() => setParam('month', shiftMonth(month, -1))} aria-label="Алдыңғы ай">‹</button>
              <span><IconCal />{monthLabel(month)}</span>
              <button type="button" onClick={() => setParam('month', shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="Келесі ай">›</button>
            </div>
            <button type="button" className="qz-btn" onClick={() => setShareOpen(true)}
              disabled={!data || !data.leaderboard.length} title="Рейтингті сурет етіп жүктеу">
              <IconImage width={16} height={16} /> Сурет
            </button>
            <button type="button" className="qz-btn qz-btn--primary tt-sync" onClick={startSync} disabled={busy || !data || noDepts}>
              <IconRefresh className={busy ? 'is-spinning' : ''} />
              {busy ? 'Жаңартылуда…' : 'Деректерді жаңарту'}
            </button>
          </div>
        </div>

        {busy && (
          <div className="tt-status" role="status">
            <span className="tt-dot tt-dot--busy" />Жиналуда… TikTok-тан видеолар тартылып жатыр, әдетте 1–5 минут.
          </div>
        )}
        {!busy && last?.status === 'failed' && (
          <div className="tt-status" role="status" style={{ color: 'var(--qz-bad)' }}>
            <span className="tt-dot" style={{ background: 'var(--qz-bad)' }} />Соңғы жаңарту сәтсіз: {last.error}
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
          error ? null : <Skeleton />
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
    </AvatarContext.Provider>
  );
}

// Деректер жүктелгенше беттің пішіні (жыпылықтайтын сұр блоктар)
function Skeleton() {
  return (
    <div className="ov sk" aria-busy="true" aria-label="Жүктелуде">
      <div className="sk-block" style={{ height: 150 }} />
      <div className="sk-row">{[0, 1, 2].map((i) => <div key={i} className="sk-block" style={{ height: 170 }} />)}</div>
      <div className="sk-block" style={{ height: 420 }} />
    </div>
  );
}

function IconCal() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

function IconRefresh({ className = '' }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" /><path d="M13.5 2.5v3h-3" />
    </svg>
  );
}

