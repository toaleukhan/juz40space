import { useMemo } from 'react';
import { fmtCompact, fmtInt } from '../../utils/tiktok';
import { deptColor } from '../../utils/deptColor';
import { coverUrl } from './avatarContext';
import DeptAvatar from './DeptAvatar';

const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

// Бөлімнің шағын картасы (рейтингте атына тінтуір апарғанда): соңғы 3
// видеоның мұқабасы, ай ішіндегі күнделікті қаралым, күшті/әлсіз жақтары.
export default function DeptCard({ row, videos, days }) {
  const c = deptColor(row.departmentId);
  const latest = useMemo(() => [...videos].sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1)).slice(0, 3), [videos]);
  const series = useMemo(() => {
    const by = Object.fromEntries(days.map((d) => [d, 0]));
    videos.forEach((v) => { if (v.postDay in by) by[v.postDay] += v.views || 0; });
    return days.map((d) => by[d]);
  }, [videos, days]);

  const ratio = row.totalWorkdays ? row.postedWorkdays / row.totalWorkdays : 0;
  const notes = [
    { tone: ratio >= 0.7 ? 'good' : ratio >= 0.4 ? 'mid' : 'bad', text: `Тұрақтылық — ${row.postedWorkdays}/${row.totalWorkdays} күн` },
    row.videoCount > 0 && {
      tone: row.avgViews >= 1000 ? 'good' : row.avgViews >= 500 ? 'mid' : 'bad',
      text: `Орташа қаралым ${fmtCompact(row.avgViews)} — ${row.avgViews >= 1000 ? 'мақсаттан жоғары' : row.avgViews >= 500 ? '500–1000 аралығында' : '500-ден төмен'}`,
    },
    row.streak >= 3 && { tone: 'good', text: `${row.streak} жұмыс күні қатарынан видео` },
    { tone: row.juryComplete ? 'good' : 'mid', text: row.juryComplete ? 'Жюри бағалады' : 'Жюри әлі бағаламаған' },
  ].filter(Boolean);

  return (
    <div className="lv-card" role="tooltip" style={{ '--c': c }}>
      <div className="lv-card__head">
        <DeptAvatar id={row.departmentId} name={row.name} size={40} live={row.postedToday} />
        <div><b>{row.name}</b><small>@{row.username} · {row.place}-орын</small></div>
        <span className="lv-card__score">{r1(row.total)}</span>
      </div>
      {latest.length > 0 && (
        <div className="lv-thumbs">
          {latest.map((v, i) => (
            <a key={v.id} className="lv-thumb" href={v.url} target="_blank" rel="noreferrer"
              style={{ '--t1': c, '--t2': i % 2 ? '#111827' : '#f59e0b' }}>
              {v.hasCover && <img src={coverUrl(v.id)} alt="" loading="lazy" decoding="async" />}
              <svg className="lv-thumb__play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              <span>{fmtCompact(v.views)}</span>
            </a>
          ))}
        </div>
      )}
      <div className="lv-spark">
        <small>Ай ішіндегі қаралым · барлығы {fmtInt(row.totalViews)}</small>
        <Spark values={series} />
      </div>
      <ul className="lv-notes">
        {notes.map((n) => <li key={n.text} className={`is-${n.tone}`}>{n.text}</li>)}
      </ul>
    </div>
  );
}

function Spark({ values }) {
  const w = 400; const h = 44;
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i * w) / (values.length - 1), h - 3 - (v / max) * (h - 6)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${w},${h} L0,${h}Z`} fill="var(--c)" opacity=".12" />
      <path d={line} fill="none" stroke="var(--c)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
