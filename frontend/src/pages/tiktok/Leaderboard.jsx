import { Fragment, useState } from 'react';
import { tiktok, errorText } from '../../services/tiktokApi';
import { fmtCompact, fmtInt, fmtPct, sumBy, parseScore } from '../../utils/tiktok';

const MAX_TOTAL = 70; // 7 критерий × 10 (бонус үстіне қосылады)

export default function Leaderboard({ data, month, onSaved }) {
  const [openId, setOpenId] = useState(null);
  const rows = data.leaderboard;
  const own = data.videos.filter((v) => !v.isTeam);
  const totalViews = sumBy(own, 'views');
  const viral = own.filter((v) => v.views >= 15000).length;
  const hasData = own.length > 0;

  return (
    <>
      <div className="tt-kpis">
        <Kpi label="Видео" value={fmtInt(own.length)} hint={`${rows.length} бөлім`} />
        <Kpi label="Жалпы қаралым" value={fmtCompact(totalViews)} hint={`лайк: ${fmtCompact(sumBy(own, 'likes'))}`} />
        <Kpi label="Орташа қаралым" value={fmtCompact(own.length ? totalViews / own.length : 0)} hint={`медиана: ${fmtCompact(data.insights.overall.medianViews)}`} />
        <Kpi label="15K+ видео" value={fmtInt(viral)} hint="бонусқа үміткер" />
      </div>

      {hasData && rows.length >= 3 && (
        <div className="tt-podium" aria-label="Үздік үштік">
          {rows.slice(0, 3).map((r, i) => (
            <div key={r.departmentId} className={`tt-step tt-step--${i + 1}`}>
              <span className="tt-step__place">{r.place}</span>
              <div className="tt-step__name">{r.name}</div>
              <div className="tt-step__user">@{r.username}</div>
              <div className="tt-step__total"><b>{r.total}</b><span>балл</span></div>
              <div className="tt-step__meta">
                <span>{r.videoCount} видео</span>
                <span>орт. {fmtCompact(r.avgViews)}</span>
                {r.viralCount > 0 && <span>🔥 {r.viralCount}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="qz-card" aria-label="Рейтинг">
        <div className="qz-card__head">
          <h2>Рейтинг</h2>
          <span className="qz-card__sub">Тұрақтылық пен статистика — автомат; қалғаны — жюри. Бөлімді басып, ұпай қойыңыз.</span>
        </div>
        <div className="qz-tablewrap">
          <table className="qz-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Бөлім</th>
                <th className="tt-num">Видео</th>
                <th>Тұрақтылық</th>
                <th className="tt-num">Орт. қаралым</th>
                <th>Статистика</th>
                <th className="tt-num">Жюри</th>
                <th className="tt-num">Жалпы</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const juryTotal = Object.values(r.jury).reduce((a, x) => a + (Number(x) || 0), 0);
                const open = openId === r.departmentId;
                return (
                  <Fragment key={r.departmentId}>
                    <tr className={`tt-row-btn ${open ? 'is-open' : ''}`} onClick={() => setOpenId(open ? null : r.departmentId)}
                      tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(open ? null : r.departmentId); } }}
                      aria-expanded={open}>
                      <td className="tt-rank">{r.place}</td>
                      <td className="tt-dept"><b>{r.name}</b><small>@{r.username}</small></td>
                      <td className="tt-num">{r.videoCount}</td>
                      <td>
                        <Bar value={r.auto.stability} />
                        <b>{r.auto.stability}</b> <small className="tt-pending">({r.postedWorkdays}/{r.totalWorkdays} күн)</small>
                      </td>
                      <td className="tt-num">{fmtInt(r.avgViews)}</td>
                      <td><Bar value={r.auto.statistics} /><b>{r.auto.statistics}</b></td>
                      <td className="tt-num">
                        {r.juryComplete ? <b>{Math.round(juryTotal * 10) / 10}</b>
                          : juryTotal ? <><b>{Math.round(juryTotal * 10) / 10}</b> <span className="tt-pending">· толық емес</span></>
                            : <span className="tt-pending">қойылмаған</span>}
                      </td>
                      <td className="tt-num tt-total">{r.total}<small className="tt-pending"> / {MAX_TOTAL}</small></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0 }}>
                          <JuryEditor row={r} fields={data.juryFields} month={month} onSaved={onSaved} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div className="tt-kpi">
      <div className="tt-kpi__label">{label}</div>
      <div className="tt-kpi__value">{value}</div>
      {hint && <div className="tt-kpi__hint">{hint}</div>}
    </div>
  );
}

function Bar({ value, max = 10 }) {
  return <span className="tt-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></span>;
}

function hintFor(key, row) {
  const s = row.suggestions;
  if (key === 'crossDept') return { value: s.crossDept, text: `${row.crossCount} бірлескен видео` };
  if (key === 'teamAccount') return s.teamAccount === null
    ? { value: null, text: 'бөлімге хештег берілмеген' }
    : { value: s.teamAccount, text: `Juz40_team-де ${row.teamCount} видео` };
  if (key === 'bonus') return { value: s.bonus, text: `15K+: ${row.viralCount}, хештег: ${fmtPct(row.tagShare)}` };
  return null;
}

function JuryEditor({ row, fields, month, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map((f) => [f.key, row.jury[f.key] ?? ''])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const invalid = (f) => {
    const n = parseScore(form[f.key]);
    return n !== null && (Number.isNaN(n) || n < 0 || n > f.max);
  };
  const anyInvalid = fields.some(invalid);

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const body = Object.fromEntries(fields.map((f) => [f.key, parseScore(form[f.key])]));
      await tiktok.saveScores(month, row.departmentId, body);
      setMsg('Сақталды ✓');
      await onSaved();
    } catch (err) {
      setMsg(errorText(err, 'Сақтау мүмкін болмады'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tt-jury" onClick={(e) => e.stopPropagation()}>
      <div className="tt-jury__grid">
        {fields.map((f) => {
          const h = hintFor(f.key, row);
          return (
            <label key={f.key}>
              {f.label} <span className="tt-hint">(0–{f.max})</span>
              <input inputMode="decimal" value={form[f.key]} aria-invalid={invalid(f)}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} placeholder="—" />
              {h && (
                <span className="tt-hint">
                  {h.text}
                  {h.value !== null && <> · ұсыныс <button type="button" onClick={() => setForm((s) => ({ ...s, [f.key]: String(h.value) }))}>{h.value}</button></>}
                </span>
              )}
            </label>
          );
        })}
      </div>
      <div className="tt-jury__foot">
        <span>
          Автомат: тұрақтылық <b>{row.auto.stability}</b>, статистика <b>{row.auto.statistics}</b> ·
          engagement {fmtPct(row.engagement)} · медиана {fmtInt(row.medianViews)}
        </span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && <span role="status">{msg}</span>}
          <button type="button" className="qz-btn qz-btn--primary" onClick={save} disabled={busy || anyInvalid}>
            {busy ? 'Сақталуда…' : 'Сақтау'}
          </button>
        </span>
      </div>
    </div>
  );
}
