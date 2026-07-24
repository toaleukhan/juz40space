import { useMemo } from 'react';

// Аккуратты, баяу жүзіп-жарқырайтын жұлдызша қабаты — фонға артқы层
// ретінде қойылады (position:absolute, pointer-events жоқ).
export default function StarField({ count = 22, color = 'currentColor', maxOpacity = 0.5, style }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 100),
    top: Math.round(Math.random() * 100),
    size: 1.5 + Math.random() * 2.5,
    dur: 4 + Math.random() * 5,
    delay: Math.random() * 5,
    drift: 8 + Math.random() * 14,
  })), [count]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0, ...style }}>
      <style>{`
        @keyframes starFieldFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.12; }
          50% { opacity: var(--sf-op); transform: translateY(var(--sf-drift)) scale(1.2); }
        }
      `}</style>
      {stars.map(s => (
        <span
          key={s.id}
          style={{
            position: 'absolute', left: `${s.left}%`, top: `${s.top}%`,
            width: s.size, height: s.size, borderRadius: '50%',
            background: color,
            animation: `starFieldFloat ${s.dur}s ease-in-out ${s.delay}s infinite`,
            '--sf-drift': `-${s.drift}px`,
            '--sf-op': maxOpacity,
          }}
        />
      ))}
    </div>
  );
}
