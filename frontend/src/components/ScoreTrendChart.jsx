// Апта сайынғы "Бағалау" баллының қарапайым SVG сызықтық графигі. Жаңа
// тәуелділік қоспау үшін дайын кітапхана орнына қолмен салынды.
export default function ScoreTrendChart({ points, height = 160, max = 10 }) {
  if (!points || points.length === 0) return null;

  const width = 100; // viewBox бірлігі — контейнер өзі responsive созады
  const padX = 4;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = 100 - padY * 2;

  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = padX + step * i;
    const v = p.score == null ? null : Math.max(0, Math.min(max, p.score));
    const y = v == null ? null : padY + innerH - (v / max) * innerH;
    return { x, y, ...p };
  });

  const linePath = coords
    .filter((c) => c.y != null)
    .map((c, i, arr) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
    .join(' ');

  const trendUp = (() => {
    const withScore = coords.filter((c) => c.score != null);
    if (withScore.length < 2) return null;
    return withScore[withScore.length - 1].score - withScore[0].score;
  })();

  return (
    <div>
      <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padX} x2={width - padX} y1={padY + innerH * f} y2={padY + innerH * f}
            stroke="var(--border)" strokeWidth="0.3" />
        ))}
        {linePath && (
          <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {coords.map((c, i) => c.y != null && (
          <circle key={i} cx={c.x} cy={c.y} r="1.6" fill="#8b5cf6" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {points.map((p, i) => (
          <div key={i} style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', flex: 1 }}>
            {p.label}
          </div>
        ))}
      </div>
      {trendUp != null && (
        <div style={{
          marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
          borderRadius: 20, fontSize: 11.5, fontWeight: 700,
          background: trendUp > 0 ? 'rgba(16,185,129,0.10)' : trendUp < 0 ? 'rgba(239,68,68,0.10)' : 'rgba(148,163,184,0.12)',
          color: trendUp > 0 ? '#059669' : trendUp < 0 ? '#dc2626' : 'var(--text-muted)',
        }}>
          {trendUp > 0 ? '▲' : trendUp < 0 ? '▼' : '—'} {trendUp > 0 ? '+' : ''}{trendUp.toFixed(1)} осы аралықта
        </div>
      )}
    </div>
  );
}
