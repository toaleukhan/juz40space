// Жеңіл салмақты, сыртқы тәуелділіксіз SVG-график компоненттері.
// (chart.js/recharts секілді кітапхана қосудың орнына — бұл жобаның
// icons.jsx-тегі стиліне сай, тексерілмеген жаңа npm тәуелділігінің
// build-тәуекелін болдырмайды.)

// Аптадан-аптаға орташа баллдың өзгерісі — сызықты график
export function TrendLine({ points, height = 160, color = 'var(--accent)', emptyText = 'Деректер әлі жоқ' }) {
  const valid = points.filter(p => p.value !== null && !Number.isNaN(p.value));
  if (valid.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
        {emptyText}
      </div>
    );
  }

  const width = 100; // viewBox percent-based, responsive via SVG scaling
  const pad = 6;
  const values = points.map(p => (p.value === null ? null : p.value));
  const nums = values.filter(v => v !== null);
  const max = Math.max(...nums, 10);
  const min = Math.min(...nums, 0);
  const span = Math.max(max - min, 1);

  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const coords = values.map((v, i) => {
    if (v === null) return null;
    const x = pad + stepX * i;
    const y = pad + (1 - (v - min) / span) * (100 - pad * 2);
    return { x, y };
  });

  const pathPoints = coords.filter(Boolean);
  const linePath = pathPoints.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = pathPoints.length > 1
    ? `${linePath} L ${pathPoints[pathPoints.length - 1].x} 100 L ${pathPoints[0].x} 100 Z`
    : '';

  return (
    <div style={{ width: '100%', height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {[0, 25, 50, 75, 100].map(y => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--border)" strokeWidth="0.3" />
        ))}
        {areaPath && <path d={areaPath} fill={color} opacity="0.08" stroke="none" />}
        {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
        {coords.map((c, i) => c && (
          <circle key={i} cx={c.x} cy={c.y} r="1.6" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
        <span>{points[0]?.label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)]?.label}</span>}
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

// Санат бойынша үлестіру — көлденең жолақ диаграмма
export function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 90, fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: color, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ width: 26, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: 'var(--text)', flexShrink: 0 }}>{value}</div>
    </div>
  );
}

// Дөңгелек прогресс — KPI-карточкаларда пайыз/орта көрсету үшін
export function RingStat({ value, max = 100, color = 'var(--accent)', size = 64, strokeWidth = 7 }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}
