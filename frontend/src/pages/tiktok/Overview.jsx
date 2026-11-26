import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtCompact, fmtInt, sumBy } from '../../utils/tiktok';
import { deptColor } from '../../utils/deptColor';
import Avatar from './DeptAvatar';
import DeptCard from './DeptCard';
import BadgeIcon from './BadgeIcon';
import { BADGES } from './badges';
import { Movement, Streak, MiniBadges } from './LiveBits';

// Рейтинг қойындысы. Басты сұрақ — «кім алда, кім артта?», сондықтан:
// 1) бір сөйлеммен қорытынды, 2) үздік үштік, 3) қалған бөлімдердің
// анық тізімі (басқанда толығырақ ашылады), 4) айдың хит видеолары.
// Әр бөлімнің өз түсі бар — тізімде, үштікте, хиттерде бірдей.

// Негізгі шек: Тұрақтылық 10 + Статистика 10 + жюридің 5 критерийі × 10 = 70.
// Бонус (0–20) — осыдан тыс қосымша ұпай.
const MAX_TOTAL = 70;

function monthWorkdays(range) {
  if (!range) return 0;
  let n = 0;
  for (let d = new Date(`${range.start}T00:00:00Z`); d <= new Date(`${range.end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
}

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
      <Summary rows={rows} own={own} window={data.window} monthDays={monthWorkdays(data.allDays)} />
      <Podium rows={rows.slice(0, 3)} />
      <BadgeShelf rows={rows} />
      <Ranking rows={rows} workdays={data.window.workdays} own={own} />
      {own.length > 0 && <Hits own={own} deptName={deptName} />}
    </div>
  );
}

/* ── 1. Қорытынды ── */
function Summary({ rows, own, window: win, monthDays }) {
  const [a] = rows;
  const c = deptColor(a.departmentId);
  const views = sumBy(own, 'views');
  return (
    <section className="ov-sum" style={{ '--c': c }}>
      <div className="ov-sum__main">
        <span className="ov-sum__eyebrow">{win.isCurrent ? 'Аралық нәтиже' : 'Ай қорытындысы'}</span>
        <h2>
          <Avatar id={a.departmentId} name={a.name} size={44} live={a.postedToday} />
          <span><b>{a.name}</b> {win.isCurrent ? 'көш бастап тұр' : 'айдың жеңімпазы'}</span>
        </h2>
      </div>
      <div className="ov-sum__side">
        <dl className="ov-sum__stats">
          <div><dt>Видео</dt><dd>{fmtInt(own.length)}</dd></div>
          <div><dt>Қаралым</dt><dd>{fmtCompact(views)}</dd></div>
          <div><dt>15K+ хит</dt><dd>{own.filter((v) => v.views >= 15000).length}</dd></div>
        </dl>
        {win.isCurrent && monthDays > 0 && (
          <div className="ov-sum__progress" title="Айдың өткен жұмыс күндері">
            <span>Ай барысы</span>
            <i><b style={{ width: `${Math.min(100, (win.workdays.length / monthDays) * 100)}%` }} /></i>
            <span>{win.workdays.length}/{monthDays} күн</span>
          </div>
        )}
      </div>
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
              <Avatar id={r.departmentId} name={r.name} size={36} live={r.postedToday} />
              <div className="ov-pod__who"><b>{r.name} <Movement row={r} /></b><small>@{r.username}</small></div>
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

/* ── Айдың жетістіктері ── */
function BadgeShelf({ rows }) {
  const earned = BADGES.map((b) => ({ ...b, who: rows.filter((r) => (r.badges || []).includes(b.key)) }))
    .filter((b) => b.who.length);
  if (!earned.length) return null;
  return (
    <section className="ov-card">
      <header className="ov-card__head"><h3>Айдың жетістіктері</h3></header>
      <div className="lv-shelf">
        {earned.map((b) => (
          <div key={b.key} className="lv-bdg" style={{ '--b': b.color }}>
            <span className="lv-medal"><BadgeIcon name={b.key} size={26} /></span>
            <b>{b.label}</b>
            <small>{b.desc}</small>
            <span className="lv-bdg__who">
              {b.who.slice(0, 3).map((r) => r.name).join(' · ')}{b.who.length > 3 ? ` +${b.who.length - 3}` : ''}
              {b.key === 'record' && b.who[0].recordViews ? ` · ${fmtCompact(b.who[0].recordViews)}` : ''}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── 3. Бөлімдер тізімі ── */
function Ranking({ rows, workdays, own }) {
  const [open, setOpen] = useState(null);
  const [peek, setPeek] = useState(null);
  const timer = useRef(null);
  // Тінтуір бір сәт тоқтағанда ғана ашамыз — тізім бойымен жүгіргенде жыпылықтамасын
  const enter = (id) => { clearTimeout(timer.current); timer.current = setTimeout(() => setPeek(id), 220); };
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setPeek(null), 120); };
  useEffect(() => () => clearTimeout(timer.current), []);
  const byDept = useMemo(() => {
    const m = {};
    own.forEach((v) => { (m[v.departmentId] ||= []).push(v); });
    return m;
  }, [own]);
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
            <li key={r.departmentId} className={`${isOpen ? 'is-open' : ''} ${peek === r.departmentId && !isOpen ? 'is-peek' : ''}`} style={{ '--c': c }}>
              <button type="button" className="ov-rank__row" onClick={() => setOpen(isOpen ? null : r.departmentId)} aria-expanded={isOpen}>
                <span className="ov-rank__n">{r.place}</span>
                <span className="ov-rank__who" onMouseEnter={() => enter(r.departmentId)} onMouseLeave={leave}>
                  <Avatar id={r.departmentId} name={r.name} size={32} live={r.postedToday} />
                  <span className="ov-rank__name">
                    <b>{r.name}<Movement row={r} /><MiniBadges keys={r.badges} /></b>
                    <small>{r.videoCount} видео · {fmtCompact(r.totalViews)} қаралым</small>
                  </span>
                </span>
                <span className="ov-rank__bar"><span style={{ width: `${(r.total / leader) * 100}%` }} /></span>
                <span className="ov-rank__streak"><Streak value={r.streak || 0} /></span>
                <span className="ov-rank__total" title={behind > 0 ? `Көшбасшыдан ${r1(behind)} ұпай артта` : 'Көшбасшы'}>{r1(r.total)}</span>
                <span className="ov-rank__chev" aria-hidden="true">›</span>
              </button>
              {peek === r.departmentId && !isOpen && (
                <div className="lv-card-pos" onMouseEnter={() => enter(r.departmentId)} onMouseLeave={leave}>
                  <DeptCard row={r} videos={byDept[r.departmentId] || []} days={workdays} />
                </div>
              )}
              {isOpen && (
                <div className="ov-rank__more">
                  <div className="ov-parts">
                    <Part label="Тұрақтылық" value={r.scores?.stability ?? r.auto.stability} max={10} hint="видео салған жұмыс күндері" />
                    <Part label="Статистика" value={r.scores?.statistics ?? r.auto.statistics} max={10} hint={`орташа ${fmtInt(r.avgViews)} қаралым`} />
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
