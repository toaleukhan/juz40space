import { useMemo, useState } from 'react';
import { fmtCompact, fmtInt, sumBy } from '../../utils/tiktok';
import { deptColor } from '../../utils/deptColor';
import Avatar from './DeptAvatar';

// Рейтинг қойындысы. Басты сұрақ — «кім алда, кім артта?», сондықтан:
// 1) бір сөйлеммен қорытынды, 2) үздік үштік, 3) қалған бөлімдердің
// анық тізімі (басқанда толығырақ ашылады), 4) айдың хит видеолары.
// Әр бөлімнің өз түсі бар — тізімде, үштікте, хиттерде бірдей.

// Негізгі шек: Тұрақтылық 10 + Статистика 10 + жюридің 5 критерийі × 10 = 70.
// Бонус (0–20) — осыдан тыс қосымша ұпай.
const MAX_TOTAL = 70;

const juryOf = (r) => Object.entries(r.jury).reduce((a, [k, x]) => a + (k === 'bonus' ? 0 : Number(x) || 0), 0);
const bonusOf = (r) => Number(r.jury.bonus) || 0;
const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

export default function Overview({ data }) {
  const own = useMemo(() => data.videos.filter((v) => !v.isTeam), [data.videos]);
  const rows = data.leaderboard;
  const deptName = useMemo(() => Object.fromEntries(data.departments.map((d) => [d.id, d.name])), [data.departments]);
  if (!rows.length) return null;

  return (
    <div className="ov">
      <Summary rows={rows} own={own} window={data.window} />
      <Podium rows={rows.slice(0, 3)} />
      <Ranking rows={rows} workdays={data.window.workdays} own={own} />
      {own.length > 0 && <Hits own={own} deptName={deptName} />}
    </div>
  );
}

/* ── 1. Қорытынды ── */
function Summary({ rows, own, window: win }) {
  const [a, b] = rows;
  const c = deptColor(a.departmentId);
  const views = sumBy(own, 'views');
  const gap = b ? a.total - b.total : 0;
  return (
    <section className="ov-sum" style={{ '--c': c }}>
      <div className="ov-sum__main">
        <span className="ov-sum__eyebrow">{win.isCurrent ? 'Аралық нәтиже' : 'Ай қорытындысы'}</span>
        <h2>
          <Avatar id={a.departmentId} name={a.name} size={44} />
          <span><b>{a.name}</b> {win.isCurrent ? 'көш бастап тұр' : 'айдың жеңімпазы'}</span>
        </h2>
        <p>
          {b && (gap > 0
            ? <>{b.name} бөлімінен <b>{r1(gap)} ұпай</b> алда. </>
            : <>{b.name} бөлімімен ұпайы тең. </>)}
          {a.totalWorkdays > 0 && <>{a.totalWorkdays} жұмыс күнінің {a.postedWorkdays} күні видео салды.</>}
        </p>
      </div>
      <dl className="ov-sum__stats">
        <div><dt>Видео</dt><dd>{fmtInt(own.length)}</dd></div>
        <div><dt>Қаралым</dt><dd>{fmtCompact(views)}</dd></div>
        <div><dt>15K+ хит</dt><dd>{own.filter((v) => v.views >= 15000).length}</dd></div>
      </dl>
    </section>
  );
}

/* ── 2. Үздік үштік ── */
function Podium({ rows }) {
  return (
    <div className="ov-podium">
      {rows.map((r) => {
        const c = deptColor(r.departmentId);
        return (
          <article key={r.departmentId} className={`ov-pod ov-pod--${r.place}`} style={{ '--c': c }}>
            <header>
              <Avatar id={r.departmentId} name={r.name} size={36} />
              <div className="ov-pod__who"><b>{r.name}</b><small>@{r.username}</small></div>
              <span className="ov-pod__place">{r.place}-орын</span>
            </header>
            <div className="ov-pod__score"><b>{r1(r.total)}</b><span>/ {MAX_TOTAL}</span></div>
            <div className="ov-bar"><span style={{ width: `${Math.min(100, (r.total / MAX_TOTAL) * 100)}%` }} /></div>
            <footer>
              <span>{r.videoCount} видео</span>
              <span>{fmtCompact(r.totalViews)} қаралым</span>
              <span>{r.postedWorkdays}/{r.totalWorkdays} күн</span>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

/* ── 3. Бөлімдер тізімі ── */
function Ranking({ rows, workdays, own }) {
  const [open, setOpen] = useState(null);
  const leader = rows[0].total || 1;
  const posted = useMemo(() => {
    const m = {};
    own.forEach((v) => { (m[v.departmentId] ||= new Set()).add(v.postDay); });
    return m;
  }, [own]);

  return (
    <section className="ov-card">
      <header className="ov-card__head">
        <h3>Барлық бөлімдер</h3>
        <span>Толығырақ көру үшін бөлімді басыңыз</span>
      </header>
      <ol className="ov-rank">
        {rows.map((r) => {
          const c = deptColor(r.departmentId);
          const isOpen = open === r.departmentId;
          const jury = juryOf(r);
          const behind = rows[0].total - r.total;
          return (
            <li key={r.departmentId} className={isOpen ? 'is-open' : ''} style={{ '--c': c }}>
              <button type="button" className="ov-rank__row" onClick={() => setOpen(isOpen ? null : r.departmentId)} aria-expanded={isOpen}>
                <span className="ov-rank__n">{r.place}</span>
                <Avatar id={r.departmentId} name={r.name} size={32} />
                <span className="ov-rank__name"><b>{r.name}</b><small>{r.videoCount} видео · {fmtCompact(r.totalViews)} қаралым</small></span>
                <span className="ov-rank__bar"><span style={{ width: `${(r.total / leader) * 100}%` }} /></span>
                <span className="ov-rank__gap">{behind > 0 ? `−${r1(behind)}` : 'көшбасшы'}</span>
                <span className="ov-rank__total">{r1(r.total)}</span>
                <span className="ov-rank__chev" aria-hidden="true">›</span>
              </button>
              {isOpen && (
                <div className="ov-rank__more">
                  <div className="ov-parts">
                    <Part label="Тұрақтылық" value={r.auto.stability} max={10} hint="видео салған жұмыс күндері" />
                    <Part label="Статистика" value={r.auto.statistics} max={10} hint={`орташа ${fmtInt(r.avgViews)} қаралым`} />
                    <Part label="Жюри" value={jury} max={50} hint={`${r.juryComplete ? 'бағаланды' : 'әлі толық бағаланбаған'}${bonusOf(r) ? ` · бонус +${r1(bonusOf(r))}` : ''}`} />
                  </div>
                  <div className="ov-days-wrap">
                    <span>Жариялау күндері · {r.postedWorkdays}/{r.totalWorkdays}</span>
                    <div className="ov-days">
                      {workdays.map((d) => <i key={d} className={posted[r.departmentId]?.has(d) ? 'is-on' : ''} title={d} />)}
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Part({ label, value, max, hint }) {
  return (
    <div className="ov-part">
      <div className="ov-part__top"><span>{label}</span><b>{r1(value)}<small> / {max}</small></b></div>
      <div className="ov-bar ov-bar--thin"><span style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
      <small>{hint}</small>
    </div>
  );
}

/* ── 4. Айдың хиттері ── */
function Hits({ own, deptName }) {
  const top = [...own].sort((a, b) => b.views - a.views).slice(0, 4);
  return (
    <section>
      <div className="ov-sec-head"><h3>Айдың хиттері</h3><span>Ең көп қаралған видеолар</span></div>
      <div className="ov-hits">
        {top.map((v, i) => {
          const c = deptColor(v.departmentId);
          const caption = (v.caption || '').replace(/#\S+/g, '').trim() || 'Видео';
          return (
            <a key={v.id} className="ov-hit" href={v.url} target="_blank" rel="noreferrer" style={{ '--c': c }}>
              <span className="ov-hit__top">
                <span className="ov-hit__n">#{i + 1}</span>
                <span className="ov-hit__dept">{deptName[v.departmentId] || `@${v.username}`}</span>
              </span>
              <span className="ov-hit__views">{fmtCompact(v.views)}<small> қаралым</small></span>
              <span className="ov-hit__cap">{caption}</span>
              <span className="ov-hit__meta">{fmtCompact(v.likes)} лайк · {fmtCompact(v.comments)} пікір · {fmtCompact(v.shares)} бөлісу</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
