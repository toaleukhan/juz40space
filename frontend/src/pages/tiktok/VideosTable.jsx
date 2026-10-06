import { useMemo, useState } from 'react';
import { fmtInt, fmtDateTime } from '../../utils/tiktok';

const SORTS = {
  date: (a, b) => (a.postedAt < b.postedAt ? 1 : -1),
  views: (a, b) => b.views - a.views,
  likes: (a, b) => b.likes - a.likes,
};

export default function VideosTable({ data }) {
  const [dept, setDept] = useState('all');
  const [sort, setSort] = useState('date');
  const names = useMemo(() => Object.fromEntries(data.departments.map((d) => [d.id, d.name])), [data.departments]);

  const list = useMemo(() => {
    const filtered = data.videos.filter((v) => (dept === 'all' ? true : dept === 'team' ? v.isTeam : String(v.departmentId) === dept));
    return [...filtered].sort(SORTS[sort]);
  }, [data.videos, dept, sort]);

  const hasTeam = data.videos.some((v) => v.isTeam);
  const th = (key, label) => (
    <th className="tt-num">
      <button type="button" className={`tt-sort ${sort === key ? 'is-on' : ''}`} onClick={() => setSort(key)}>
        {label}{sort === key ? ' ↓' : ''}
      </button>
    </th>
  );

  return (
    <section className="qz-card" aria-label="Видеолар">
      <div className="qz-card__head" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2>Видеолар</h2>
          <span className="qz-card__sub">{list.length} видео</span>
        </div>
        <div className="tt-filters">
          <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Бөлім">
            <option value="all">Барлық бөлім</option>
            {data.leaderboard.map((r) => <option key={r.departmentId} value={String(r.departmentId)}>{r.name}</option>)}
            {hasTeam && <option value="team">Juz40_team</option>}
          </select>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="qz-empty">Видео жоқ. «Деректерді жаңарту» батырмасын басыңыз.</div>
      ) : (
        <div className="qz-tablewrap">
          <table className="qz-table">
            <thead>
              <tr>
                <th><button type="button" className={`tt-sort ${sort === 'date' ? 'is-on' : ''}`} onClick={() => setSort('date')}>Күні{sort === 'date' ? ' ↓' : ''}</button></th>
                <th>Бөлім</th>
                <th>Сипаттама</th>
                {th('views', 'Қаралым')}
                {th('likes', 'Лайк')}
                <th className="tt-num">Коммент</th>
                <th className="tt-num">Бөлісу</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(v.postedAt)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {v.isTeam ? <span className="tt-tag tt-tag--team" style={{ marginLeft: 0 }}>Juz40_team</span> : names[v.departmentId]}
                  </td>
                  <td>
                    <div className="tt-caption" title={v.caption}>
                      {v.caption || <span className="tt-pending">сипаттамасыз</span>}
                    </div>
                  </td>
                  <td className="tt-num">
                    <b>{fmtInt(v.views)}</b>
                    {v.views >= 15000 && <span className="tt-tag tt-tag--viral">15K+</span>}
                  </td>
                  <td className="tt-num">{fmtInt(v.likes)}</td>
                  <td className="tt-num">{fmtInt(v.comments)}</td>
                  <td className="tt-num">{fmtInt(v.shares)}</td>
                  <td><a className="qz-link" href={v.url} target="_blank" rel="noopener noreferrer">Ашу ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
