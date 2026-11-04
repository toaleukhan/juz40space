import { useMemo, useRef, useState } from 'react';
import { tiktok, errorText } from '../../services/tiktokApi';
import { parseScore, fmtPct } from '../../utils/tiktok';

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
// статистика Apify-дан келеді, өзгертілмейді.
export default function Grading({ data, month, onSaved }) {
  const fields = data.juryFields;
  // Тізім ретін атау бойынша бекітеміз — балл жазып жатқанда жол секірмесін
  const rows = useMemo(() => [...data.leaderboard].sort((a, b) => a.name.localeCompare(b.name, 'kk')), [data.leaderboard]);
  const [form, setForm] = useState(() => Object.fromEntries(rows.map((r) => [
    r.departmentId, Object.fromEntries(fields.map((f) => [f.key, r.jury[f.key] ?? ''])),
  ])));
  const [state, setState] = useState({}); // deptId → 'saving' | 'saved' | қате мәтіні
  const lastSent = useRef(Object.fromEntries(rows.map((r) => [r.departmentId, JSON.stringify(form[r.departmentId])])));

  const value = (id, key) => parseScore(form[id]?.[key]);
  const invalid = (id, f) => {
    const n = value(id, f.key);
    return n !== null && (Number.isNaN(n) || n < 0 || n > f.max);
  };

  const saveRow = async (id) => {
    const snap = JSON.stringify(form[id]);
    if (snap === lastSent.current[id]) return;
    if (fields.some((f) => invalid(id, f))) {
      setState((s) => ({ ...s, [id]: 'Шектен тыс балл бар — түзетіңіз' }));
      return;
    }
    lastSent.current[id] = snap;
    setState((s) => ({ ...s, [id]: 'saving' }));
    try {
      const body = Object.fromEntries(fields.map((f) => [f.key, value(id, f.key)]));
      await tiktok.saveScores(month, id, body);
      setState((s) => ({ ...s, [id]: 'saved' }));
      onSaved();
    } catch (err) {
      lastSent.current[id] = null;
      setState((s) => ({ ...s, [id]: errorText(err, 'Сақтау мүмкін болмады') }));
    }
  };

  const done = rows.filter((r) => fields.every((f) => f.key === 'bonus' || value(r.departmentId, f.key) !== null)).length;

  return (
    <section className="tl-card tg" aria-label="Жюри бағалауы">
      <div className="tg-head">
        <div>
          <h2>Бағалау</h2>
          <span>Ұяшыққа балл жазыңыз — келесісіне өткенде автомат сақталады. Tab — келесі ұяшық.</span>
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
              <th scope="col" className="tg-auto">Тұрақтылық<small>авто</small></th>
              <th scope="col" className="tg-auto">Статистика<small>авто</small></th>
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
              const total = Math.round((r.auto.stability + r.auto.statistics + jury) * 10) / 10;
              const st = state[id];
              return (
                <tr key={id} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) saveRow(id); }}>
                  <th scope="row" className="tg-dept"><b>{r.name}</b><small>@{r.username}</small></th>
                  <td><span className={`tg-cell tg-cell--ro ${tone(r.auto.stability, 10)}`}>{r.auto.stability}</span></td>
                  <td><span className={`tg-cell tg-cell--ro ${tone(r.auto.statistics, 10)}`}>{r.auto.statistics}</span></td>
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
      <p className="qz-note">Бонус 0–20 (15K+ видео мен хэштег үшін). Бос ұяшық = әлі қойылмаған.</p>
    </section>
  );
}
