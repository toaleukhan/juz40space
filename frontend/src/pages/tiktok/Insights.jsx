import { useState } from 'react';
import { tiktok, errorText } from '../../services/tiktokApi';
import { fmtCompact, fmtDateTime } from '../../utils/tiktok';

// «Не көбірек өтеді?» — сандық салыстыру (медиана қаралым) және Gemini
// жазған айлық қорытынды.
export default function Insights({ data, month, onAnalysis }) {
  const { overall, dimensions } = data.insights;
  return (
    <>
      <section className="qz-card" aria-label="Не көбірек өтеді">
        <div className="qz-card__head">
          <h2>Қандай видео көбірек өтеді?</h2>
          <span className="qz-card__sub">
            {overall.count} видео · медиана қаралым {fmtCompact(overall.medianViews)} — бір вирусты видео нәтижені бұрмаламас үшін медианамен салыстырамыз
          </span>
        </div>
        {dimensions.length === 0 ? (
          <div className="qz-empty">Салыстыруға видео әлі аз. Деректерді жаңартыңыз.</div>
        ) : (
          <div className="tt-insights">
            {dimensions.map((d) => <Dimension key={d.key} dim={d} />)}
          </div>
        )}
      </section>

      <AiAnalysis analysis={data.analysis} month={month} videoCount={overall.count} onAnalysis={onAnalysis} />
    </>
  );
}

function Dimension({ dim }) {
  const max = Math.max(1, ...dim.buckets.map((b) => b.medianViews));
  // Айырма 15%-дан аз болса, «ең үздік» деп белгілемейміз — кездейсоқ болуы мүмкін
  const best = dim.lift && dim.lift >= 1.15 ? dim.best : null;
  return (
    <div className="tt-ins">
      <h3>{dim.label}</h3>
      {dim.buckets.map((b) => (
        <div key={b.label} className={`tt-ins__row ${best === b.label ? 'is-best' : ''}`}>
          <span className="tt-ins__label" title={b.label}>{b.label}</span>
          <span className="tt-ins__track"><i style={{ width: `${(b.medianViews / max) * 100}%` }} /></span>
          <span className="tt-ins__val">{fmtCompact(b.medianViews)} <small>· {b.count}</small></span>
        </div>
      ))}
      {best && (
        <div className="tt-ins__note">«{best}» — жалпы медианадан {dim.lift.toFixed(1).replace('.', ',')} есе жоғары</div>
      )}
    </div>
  );
}

function AiAnalysis({ analysis, month, videoCount, onAnalysis }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      onAnalysis(await tiktok.analyze(month));
    } catch (err) {
      setError(errorText(err, 'Анализ жасау мүмкін болмады'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="qz-card qz-card--spaced" aria-label="ИИ анализі">
      <div className="qz-card__head" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2>ИИ анализі</h2>
          <span className="qz-card__sub">Gemini видеоның өзін көрмейді — сипаттамасы мен статистикасына сүйенеді</span>
        </div>
        <button type="button" className="qz-btn qz-btn--primary" onClick={run} disabled={busy || videoCount < 5}>
          {busy ? 'Талдап жатыр…' : analysis ? 'Қайта жасау' : 'Анализ жасау'}
        </button>
      </div>

      {error && <div className="qz-alert" role="alert" style={{ margin: '14px 16px 0' }}>{error}</div>}

      {busy ? (
        <div className="tt-loading"><span className="tt-spin" />Gemini айдың видеоларын талдап жатыр — 20–60 секунд…</div>
      ) : !analysis ? (
        <div className="qz-empty">
          {videoCount < 5 ? 'Анализге кемінде 5 видео керек.' : 'Бір батырмамен: не жақсы өтті, не өтпеді, әр бөлімге ұсыныс және келесі айға идеялар.'}
        </div>
      ) : (
        <div className="tt-ai">
          <p className="tt-ai__summary">{analysis.summary}</p>
          <div className="tt-ai__cols">
            <List title="Жақсы өтті" items={analysis.works} cls="tt-ai__good" />
            <List title="Назар аудару керек" items={analysis.weak} cls="tt-ai__bad" />
            <List title="Келесі айға идеялар" items={analysis.ideas} cls="tt-ai__ideas" />
          </div>
          {analysis.departments?.length > 0 && (
            <div>
              <h3>Бөлімдерге ұсыныс</h3>
              <div className="tt-ai__cols">
                {analysis.departments.map((d) => (
                  <div key={d.name} className="tt-ai__dept">
                    <b>{d.name}</b>
                    <ul>{d.advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="tt-ai__foot">Жасалған: {fmtDateTime(analysis.createdAt)} · {analysis.videoCount} видео бойынша</div>
        </div>
      )}
    </section>
  );
}

function List({ title, items, cls }) {
  if (!items?.length) return null;
  return (
    <div className={cls}>
      <h3>{title}</h3>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}
