import { useEffect, useMemo, useRef, useState } from 'react';
import Zet from './Zet';
import useCountUp from './useCountUp';
import { fmtCompact, fmtInt, sumBy } from '../../utils/tiktok';

const ROW_H = 60;
const CONFETTI_COLORS = ['#F59E0B', '#2DD4BF', '#FCD34D', '#FFFFFF', '#F472B6'];

// «Тірі» рейтинг: жаңалықтар лентасы, көшбасшы картасы (Зет кейіпкерімен),
// санап шығатын көрсеткіштер, орын ауыстыратын жарыс жолы, хит видеолар
// және хэштегтер. Барлығы /overview деректерінен есептеледі.
export default function LiveRating({ data }) {
  const own = useMemo(() => data.videos.filter((v) => !v.isTeam), [data.videos]);
  const rows = data.leaderboard;
  const deptName = useMemo(() => Object.fromEntries(data.departments.map((d) => [d.id, d.name])), [data.departments]);
  const facts = useMemo(() => buildFacts(data, own, deptName), [data, own, deptName]);
  const hasData = own.length > 0 && rows.length > 0;

  return (
    <div className="tl">
      {facts.length > 0 && <Ticker facts={facts} />}
      <div className="tl-hero">
        {hasData && <LeaderCard rows={rows} own={own} />}
        <Kpis own={own} rows={rows} />
      </div>
      <Race rows={rows} />
      {hasData && (
        <div className="tl-split">
          <Hits own={own} deptName={deptName} />
          <Hashtags own={own} />
        </div>
      )}
    </div>
  );
}

function Ticker({ facts }) {
  const items = [...facts, ...facts]; // үздіксіз айналу үшін екі рет
  return (
    <div className="tl-ticker" aria-label="Соңғы оқиғалар">
      <span className="tl-ticker__tag"><span />ЖАҢАЛЫҚ</span>
      <div className="tl-ticker__viewport">
        <div className="tl-ticker__track" style={{ animationDuration: `${Math.max(24, facts.length * 7)}s` }}>
          {items.map((f, i) => (
            <span key={i} className="tl-ticker__item" aria-hidden={i >= facts.length}>
              <b>{f.who}</b> {f.what}<i>◆</i>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeaderCard({ rows, own }) {
  const leader = rows[0];
  const second = rows[1];
  const score = useCountUp(leader.total);
  const [burst, setBurst] = useState(0);
  const prevLeader = useRef(leader.departmentId);
  const [newLeader, setNewLeader] = useState(false);

  // Көшбасшы ауысса — Зет хабарлайды, конфетти шашылады
  useEffect(() => {
    if (prevLeader.current !== leader.departmentId) {
      prevLeader.current = leader.departmentId;
      setNewLeader(true);
      setBurst((b) => b + 1);
    }
  }, [leader.departmentId]);

  useEffect(() => {
    if (!burst) return undefined;
    const t = setTimeout(() => setBurst(0), 1600);
    return () => clearTimeout(t);
  }, [burst]);

  const gap = second ? Math.round((leader.total - second.total) * 10) / 10 : null;
  const top = own.reduce((a, v) => (v.views > (a?.views || 0) ? v : a), null);
  const messages = [
    newLeader ? `Жаңа көшбасшы — ${leader.name}!` : `${leader.name} көш бастап тұр!`,
    second && `${second.name} небәрі ${gap} ұпай артта`,
    top && `Айдың ең көп қаралған видеосы — ${fmtCompact(top.views)}`,
    'Бүгін видео салдыңыз ба?',
    'Картаны басып, құттықтаңыз',
  ].filter(Boolean);

  return (
    <section className="tl-leader" aria-label="Айдың көшбасшысы">
      <button type="button" className="tl-leader__hit" onClick={() => setBurst((b) => b + 1)} aria-label={`${leader.name} бөлімін құттықтау`} />
      <svg className="tl-leader__orn" aria-hidden="true" width="220" height="220" viewBox="0 0 100 100" fill="none">
        <path d="M50 90 C50 60 30 60 30 45 C30 32 45 30 47 40 C49 48 40 50 38 45" />
        <path d="M50 90 C50 60 70 60 70 45 C70 32 55 30 53 40 C51 48 60 50 62 45" />
        <path d="M50 70 C40 70 20 72 14 60 C9 50 20 44 24 52" />
        <path d="M50 70 C60 70 80 72 86 60 C91 50 80 44 76 52" />
      </svg>
      <div className="tl-leader__text">
        <span className="tl-leader__badge">АЙДЫҢ КӨШБАСШЫСЫ</span>
        <span className="tl-leader__name">{leader.name}</span>
        <span className="tl-leader__meta">@{leader.username} · {leader.videoCount} видео</span>
        <span className="tl-leader__score"><b>{score.toFixed(1)}</b> / 70 балл</span>
        {second && <span className="tl-leader__meta">{second.name} {gap} ұпай артта</span>}
      </div>
      <Zet messages={messages} />
      {burst > 0 && (
        <div className="tl-confetti" aria-hidden="true" key={burst}>
          {Array.from({ length: 28 }, (_, i) => {
            const a = (i / 28) * Math.PI * 2;
            const dist = 140 + (i % 5) * 30;
            return (
              <span key={i} style={{
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                '--dx': `${Math.round(Math.cos(a) * dist)}px`,
                '--dy': `${Math.round(Math.sin(a) * dist - 60)}px`,
                '--r': `${i * 47}deg`,
                animationDelay: `${(i % 4) * 0.03}s`,
              }} />
            );
          })}
        </div>
      )}
    </section>
  );
}

function Kpis({ own, rows }) {
  const views = sumBy(own, 'views');
  const top = own.reduce((a, v) => (v.views > (a?.views || 0) ? v : a), null);
  const viral = own.filter((v) => v.views >= 15000).length;
  const topDept = top ? rows.find((r) => r.departmentId === top.departmentId)?.name : null;
  return (
    <div className="tl-kpis">
      <Kpi label="Видео саны" value={own.length} fmt={fmtInt} hint={`${rows.filter((r) => r.videoCount > 0).length} бөлім салды`} tint="#CCFBF1" />
      <Kpi label="Жалпы қаралым" value={views} fmt={fmtCompact} hint={`лайк: ${fmtCompact(sumBy(own, 'likes'))}`} tint="#FEF3C7" />
      <Kpi label="Ең көп қаралым" value={top?.views || 0} fmt={fmtCompact} hint={topDept || '—'} tint="#FCE7F3" />
      <Kpi label="15K+ видео" value={viral} fmt={fmtInt} hint="бонусқа үміткер" tint="#E0E7FF" />
    </div>
  );
}

function Kpi({ label, value, fmt, hint, tint }) {
  const v = useCountUp(value);
  return (
    <div className="tl-kpi">
      <span className="tl-kpi__label">{label}<i style={{ background: tint }} /></span>
      <span className="tl-kpi__value">{fmt(v)}</span>
      <span className="tl-kpi__hint">{hint}</span>
    </div>
  );
}

// Жарыс жолы: қатарлар бөлім бойынша тұрақты, тек орны (translateY)
// өзгереді — сондықтан ұпай өзгергенде бөлімдер бір-бірін басып озады.
function Race({ rows }) {
  const prev = useRef(null);
  const [deltas, setDeltas] = useState({});

  useEffect(() => {
    const now = Object.fromEntries(rows.map((r, i) => [r.departmentId, i]));
    if (prev.current) {
      const d = {};
      rows.forEach((r, i) => {
        const was = prev.current[r.departmentId];
        if (was !== undefined && was !== i) d[r.departmentId] = was - i;
      });
      if (Object.keys(d).length) setDeltas(d);
    }
    prev.current = now;
    const t = setTimeout(() => setDeltas({}), 5000);
    return () => clearTimeout(t);
  }, [rows]);

  const stable = useMemo(() => [...rows].sort((a, b) => a.departmentId - b.departmentId), [rows]);
  const rankOf = Object.fromEntries(rows.map((r, i) => [r.departmentId, i]));
  const scale = Math.max(20, ...rows.map((r) => r.total)) * 1.1;

  return (
    <section className="tl-card tl-race" aria-label="Бөлімдер жарысы">
      <div className="tl-card__head">
        <div>
          <h2>Жарыс жолы</h2>
          <span>Ұпай өзгергенде бөлімдер орын ауыстырады</span>
        </div>
        <div className="tl-legend">
          <span><i style={{ background: '#2DD4BF' }} />Тұрақтылық</span>
          <span><i style={{ background: '#0F766E' }} />Статистика</span>
          <span><i style={{ background: '#F59E0B' }} />Жюри</span>
        </div>
      </div>
      <ol className="tl-race__list" style={{ height: rows.length * ROW_H }}>
        {stable.map((r) => {
          const k = rankOf[r.departmentId];
          const jury = Object.values(r.jury).reduce((a, x) => a + (Number(x) || 0), 0);
          const d = deltas[r.departmentId];
          return (
            <li key={r.departmentId} className="tl-race__row" style={{ transform: `translateY(${k * ROW_H}px)` }}>
              <span className={`tl-rank tl-rank--${Math.min(k + 1, 4)}`}>{r.place}</span>
              <span className="tl-race__name"><b>{r.name}</b><small>{r.videoCount} видео</small></span>
              <span className="tl-race__bar" title={`Тұрақтылық ${r.auto.stability} · Статистика ${r.auto.statistics} · Жюри ${Math.round(jury * 10) / 10}`}>
                <i style={{ width: `${(r.auto.stability / scale) * 100}%`, background: '#2DD4BF' }} />
                <i style={{ width: `${(r.auto.statistics / scale) * 100}%`, background: '#0F766E' }} />
                <i style={{ width: `${(jury / scale) * 100}%`, background: '#F59E0B' }} />
              </span>
              <span className="tl-race__total">
                {d ? <em className={d > 0 ? 'is-up' : 'is-down'}>{d > 0 ? `▲${d}` : `▼${-d}`}</em> : null}
                <b>{r.total}</b>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const HIT_TONES = [['#0F766E', '#FFFFFF'], ['#10262F', '#FFFFFF'], ['#FCD34D', '#422006'], ['#CCFBF1', '#0F766E']];

function Hits({ own, deptName }) {
  const hits = [...own].sort((a, b) => b.views - a.views).slice(0, 4);
  return (
    <section id="hits" className="tl-card" aria-label="Айдың хиттері">
      <div className="tl-card__head"><div><h2>Айдың хиттері</h2><span>Ең көп қаралған видеолар</span></div></div>
      <div className="tl-hits">
        {hits.map((v, i) => (
          <a key={v.id} className="tl-hit" href={v.url} target="_blank" rel="noreferrer">
            <span className="tl-hit__tile" style={{ background: HIT_TONES[i][0], color: HIT_TONES[i][1] }}>
              <span className="tl-hit__rank">{i + 1}</span>
              <span className="tl-hit__cap">{(v.caption || '').slice(0, 70) || 'Видео'}</span>
              <span className="tl-hit__views">{fmtCompact(v.views)}</span>
            </span>
            <b>{deptName[v.departmentId] || `@${v.username}`}</b>
          </a>
        ))}
      </div>
    </section>
  );
}

function Hashtags({ own }) {
  const counts = new Map();
  own.forEach((v) => (v.hashtags || []).forEach((t) => {
    const k = String(t).toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  }));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return (
    <section className="tl-card" aria-label="Хэштегтер">
      <div className="tl-card__head"><div><h2>Хэштегтер</h2><span>Видеоларда жиі қолданылғаны</span></div></div>
      {top.length ? (
        <div className="tl-tags">
          {top.map(([tag, n], i) => <span key={tag} className={`tl-tag tl-tag--${i % 3}`}>#{tag} <b>{n}</b></span>)}
        </div>
      ) : <p className="qz-note">Хэштег әлі жоқ</p>}
    </section>
  );
}

function ago(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} мин бұрын`;
  if (min < 60 * 24) return `${Math.round(min / 60)} сағ бұрын`;
  return `${Math.round(min / 60 / 24)} күн бұрын`;
}

// Лентадағы фактілер — тек нақты деректерден
function buildFacts(data, own, deptName) {
  const rows = data.leaderboard;
  const out = [];
  if (!own.length) return out;
  const name = (v) => deptName[v.departmentId] || `@${v.username}`;

  const latest = own.reduce((a, v) => (new Date(v.postedAt) > new Date(a.postedAt) ? v : a));
  if (data.window.isCurrent) out.push({ who: name(latest), what: `жаңа видео салды · ${ago(latest.postedAt)}` });

  const top = own.reduce((a, v) => (v.views > a.views ? v : a));
  out.push({ who: name(top), what: `видеосы ${fmtCompact(top.views)} қаралым жинады` });

  const most = [...rows].sort((a, b) => b.videoCount - a.videoCount)[0];
  if (most?.videoCount) out.push({ who: most.name, what: `айда ${most.videoCount} видео салды — ең көп` });

  const best = rows.filter((r) => r.videoCount >= 3).sort((a, b) => b.avgViews - a.avgViews)[0];
  if (best) out.push({ who: best.name, what: `орташа ${fmtInt(best.avgViews)} қаралым — ең жоғары` });

  const viral = own.filter((v) => v.views >= 15000).length;
  if (viral) out.push({ who: `${viral} видео`, what: '15K қаралымнан асты' });

  const steady = [...rows].sort((a, b) => b.postedWorkdays - a.postedWorkdays)[0];
  if (steady?.postedWorkdays) out.push({ who: steady.name, what: `${steady.postedWorkdays}/${steady.totalWorkdays} жұмыс күні видео салды` });

  const silent = rows.filter((r) => r.videoCount === 0).map((r) => r.name);
  if (silent.length) out.push({ who: silent.slice(0, 3).join(', '), what: 'әлі видео салған жоқ' });
  return out;
}
