import { useMemo, useRef, useState } from 'react';
import { tiktok, errorText } from '../../services/tiktokApi';
import { parseScore, fmtPct } from '../../utils/tiktok';
import DeptAvatar from './DeptAvatar';

// Автомат ұсыныс (тек кеңес — жюри өзі шешеді)
function hint(key, r) {
  const s = r.suggestions || {};
  if (key === 'crossDept') return `${r.crossCount} бірлескен видео · ұсыныс ${s.crossDept}`;
  if (key === 'teamAccount') return s.teamAccount === null ? 'бөлімге хештег берілмеген' : `Juz40_team-де ${r.teamCount} видео · ұсыныс ${s.teamAccount}`;
  if (key === 'bonus') return `15K+: ${r.viralCount}, хештег: ${fmtPct(r.tagShare)} · ұсыныс ${s.bonus}`;
  return undefined;
}

// Ұяшықтың түсі — балдың өз шегіне қатынасы бойынша
function tone(value, max, key) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (key === 'bonus') return value > 0 ? 'is-bonus' : ''; // бонус — қосымша, «төмен» болмайды
  const p = value / max;
  if (p >= 0.8) return 'is-high';
  if (p >= 0.5) return 'is-mid';
  return 'is-low';
}

// «Бағалау» — жюри ұпайлары кестесі. Координаторларды бағалағандай: ұяшыққа
// жазып, келесісіне өткенде (blur) жол автомат сақталады. Тұрақтылық пен
// Статистиканы жүйе өзі есептейді (ұяшықта сұр болып тұрады); тимлид керек
// болса үстінен жазып түзетеді, ↺ — автомат мәнге қайтару.
const AUTO_FIELDS = [
  { key: 'stabilityOverride', auto: 'stability', label: 'Тұрақтылық', max: 10 },
  { key: 'statisticsOverride', auto: 'statistics', label: 'Статистика', max: 10 },
];
const fmtNum = (n) => String(n).replace('.', ',');
export default function Grading({ data, month, onSaved }) {
  const fields = data.juryFields;
  // Тізім ретін атау бойынша бекітеміз — балл жазып жатқанда жол секірмесін
  const rows = useMemo(() => [...data.leaderboard].sort((a, b) => a.name.localeCompare(b.name, 'kk')), [data.leaderboard]);
  const [form, setForm] = useState(() => Object.fromEntries(rows.map((r) => [
    r.departmentId, {
      ...Object.fromEntries(fields.map((f) => [f.key, r.jury[f.key] ?? ''])),
      ...Object.fromEntries(AUTO_FIELDS.map((f) => [f.key, r.override?.[f.auto] ?? ''])),
    },
  ])));
  const allFields = [...AUTO_FIELDS, ...fields];
  const [state, setState] = useState({}); // deptId → 'saving' | 'saved' | қате мәтіні
  const lastSent = useRef(Object.fromEntries(rows.map((r) => [r.departmentId, JSON.stringify(form[r.departmentId])])));

  const value = (id, key) => parseScore(form[id]?.[key]);
  const invalid = (id, f) => {
    const n = value(id, f.key);
    return n !== null && (Number.isNaN(n) || n < 0 || n > f.max);
  };

  // row — жаңа күй (↺ басқанда setForm әлі қолданылмаған болады)
  const saveRow = async (id, row = form[id]) => {
    const snap = JSON.stringify(row);
    if (snap === lastSent.current[id]) return;
    const val = (key) => parseScore(row?.[key]);
    if (allFields.some((f) => { const n = val(f.key); return n !== null && (Number.isNaN(n) || n < 0 || n > f.max); })) {
      setState((s) => ({ ...s, [id]: 'Шектен тыс балл бар — түзетіңіз' }));
      return;
    }
    lastSent.current[id] = snap;
    setState((s) => ({ ...s, [id]: 'saving' }));
    try {
      const body = Object.fromEntries(allFields.map((f) => [f.key, val(f.key)]));
      await tiktok.saveScores(month, id, body);
      setState((s) => ({ ...s, [id]: 'saved' }));
      onSaved();
    } catch (err) {
      lastSent.current[id] = null;
      setState((s) => ({ ...s, [id]: errorText(err, 'Сақтау мүмкін болмады') }));
    }
  };

  const resetAuto = (id, key) => {
    const row = { ...form[id], [key]: '' };
    setForm((s) => ({ ...s, [id]: row }));
    saveRow(id, row);
  };

  const done = rows.filter((r) => fields.every((f) => f.key === 'bonus' || value(r.departmentId, f.key) !== null)).length;

  return (
    <section className="ov-card tg" aria-label="Жюри бағалауы">
      <div className="tg-head">
        <div>
          <h2>Бағалау</h2>
          <span>Ұяшыққа балл жазыңыз — келесісіне өткенде автомат сақталады. Тұрақтылық пен Статистиканы жүйе есептейді, керек болса үстінен жазып түзетіңіз.</span>
        </div>
        <div className="tg-progress" aria-label="Бағаланған бөлімдер">
          <b>{done}/{rows.length}</b> бөлім бағаланды
          <span><i style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%` }} /></span>
        </div>
      </div>
      <div className="tg-wrap">
        <table className="tg-table">
          <thead>
            <tr>
              <th scope="col">Бөлім</th>
              {AUTO_FIELDS.map((f) => <th key={f.key} scope="col" className="tg-auto">{f.label}<small>0–{f.max} · жүйе</small></th>)}
              {fields.map((f) => <th key={f.key} scope="col">{f.label}<small>0–{f.max}</small></th>)}
              <th scope="col" className="tg-total">Жалпы</th>
              <th scope="col"><span className="sr-only">Күйі</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const id = r.departmentId;
              const jury = fields.reduce((a, f) => {
                const n = value(id, f.key);
                return a + (n !== null && !Number.isNaN(n) ? n : 0);
              }, 0);
              const eff = (f) => { const n = value(id, f.key); return n !== null && !Number.isNaN(n) ? n : r.auto[f.auto]; };
              const total = Math.round((eff(AUTO_FIELDS[0]) + eff(AUTO_FIELDS[1]) + jury) * 10) / 10;
              const st = state[id];
              return (
                <tr key={id} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) saveRow(id); }}>
                  <th scope="row" className="tg-dept"><DeptAvatar id={id} name={r.name} size={30} /><span><b>{r.name}</b><small>@{r.username}</small></span></th>
                  {AUTO_FIELDS.map((f) => {
                    const manual = value(id, f.key) !== null;
                    return (
                      <td key={f.key} className="tg-autocell">
                        <input
                          className={`tg-cell ${manual ? `is-manual ${tone(value(id, f.key), f.max)}` : 'is-auto'}`}
                          inputMode="decimal"
                          value={form[id]?.[f.key] ?? ''}
                          placeholder={fmtNum(r.auto[f.auto])}
                          aria-label={`${r.name} — ${f.label} (жүйе есебі ${r.auto[f.auto]})`}
                          title={`Жүйе есебі: ${r.auto[f.auto]}. Түзету үшін үстінен жазыңыз.`}
                          aria-invalid={invalid(id, f)}
                          onChange={(e) => setForm((s) => ({ ...s, [id]: { ...s[id], [f.key]: e.target.value } }))}
                        />
                        {manual && (
                          <button type="button" className="tg-reset" title={`Жүйе есебіне қайтару (${r.auto[f.auto]})`}
                            aria-label={`${f.label}: жүйе есебіне қайтару`}
                            onClick={() => resetAuto(id, f.key)}>
                            ↺ {fmtNum(r.auto[f.auto])}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  {fields.map((f) => (
                    <td key={f.key}>
                      <input
                        className={`tg-cell ${tone(value(id, f.key), f.max, f.key)}`}
                        inputMode="decimal"
                        value={form[id]?.[f.key] ?? ''}
                        placeholder="—"
                        aria-label={`${r.name} — ${f.label}`}
                        title={hint(f.key, r)}
                        aria-invalid={invalid(id, f)}
                        onChange={(e) => setForm((s) => ({ ...s, [id]: { ...s[id], [f.key]: e.target.value } }))}
                      />
                    </td>
                  ))}
                  <td className="tg-total"><b>{total}</b><small>/70</small></td>
                  <td className="tg-state" aria-live="polite">
                    {st === 'saving' ? <span className="tt-spin" aria-label="Сақталуда" />
                      : st === 'saved' ? <span className="tg-ok">✓</span>
                        : st ? <span className="tg-err">{st}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="qz-note">Сұр сан — жүйе есебі. Қолмен түзетілген ұяшық қою болып, астында ↺ шығады — оны басса жүйе есебіне қайтады. Бонус 0–20 (15K+ видео мен хэштег үшін). Бос ұяшық = әлі қойылмаған.</p>
    </section>
  );
}
