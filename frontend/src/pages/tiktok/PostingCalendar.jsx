import { useMemo } from 'react';
import { daysOfMonth, postingMatrix, fmtInt, WEEKDAYS_SHORT } from '../../utils/tiktok';

// Бөлім × күн торы: видео шыққан күн — жасыл (саны жазылады), жұмыс күні
// өтіп кетсе де видео жоқ — ақшыл қызыл, демалыс — үзік жиек.
export default function PostingCalendar({ data }) {
  const days = useMemo(() => daysOfMonth(data.month), [data.month]);
  const matrix = useMemo(() => postingMatrix(data.videos.filter((v) => !v.isTeam)), [data.videos]);
  const today = data.window.effectiveEnd;
  const max = Math.max(1, ...Object.values(matrix).flatMap((row) => Object.values(row).map((c) => c.count)));

  return (
    <section className="qz-card" aria-label="Тұрақтылық күнтізбесі">
      <div className="qz-card__head">
        <h2>Тұрақтылық күнтізбесі</h2>
        <span className="qz-card__sub">Ұпай: видео шыққан жұмыс күні ÷ өткен жұмыс күні × 10</span>
      </div>
      <div className="tt-cal-wrap" style={{ padding: '10px 12px 4px' }}>
        <table className="tt-cal">
          <thead>
            <tr>
              <th className="tt-cal__name" />
              {days.map((d) => (
                <th key={d.iso} className={d.weekend ? 'is-weekend' : ''} title={WEEKDAYS_SHORT[d.weekday]}>
                  <div>{WEEKDAYS_SHORT[d.weekday]}</div>
                  <div>{d.day}</div>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.map((r) => (
              <tr key={r.departmentId}>
                <th className="tt-cal__name" scope="row">{r.name}</th>
                {days.map((d) => {
                  const cell = matrix[r.departmentId]?.[d.iso];
                  const future = d.iso > today;
                  const cls = ['tt-cell'];
                  if (d.weekend && !cell) cls.push('is-weekend');
                  if (future) cls.push('is-future');
                  if (!cell && !d.weekend && !future) cls.push('is-miss');
                  const alpha = cell ? 0.4 + 0.6 * (cell.count / max) : 0;
                  return (
                    <td key={d.iso} className={cls.join(' ')}
                      style={cell ? { background: `rgba(var(--tt-heat), ${alpha})` } : undefined}
                      title={cell ? `${d.iso}: ${cell.count} видео, ${fmtInt(cell.views)} қаралым` : `${d.iso}: видео жоқ`}>
                      {cell ? cell.count : ''}
                    </td>
                  );
                })}
                <td className="tt-cal__score">{r.auto.stability} <small className="tt-pending">({r.postedWorkdays}/{r.totalWorkdays})</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tt-legend">
        <span><i style={{ background: 'rgba(var(--tt-heat), .7)' }} />видео шықты (сан — нешеу)</span>
        <span><i style={{ background: 'var(--qz-bad-bg)' }} />жұмыс күні, видео жоқ</span>
        <span><i style={{ outline: '1px dashed var(--qz-line)', outlineOffset: -1 }} />демалыс (есепке кірмейді)</span>
      </div>
    </section>
  );
}
