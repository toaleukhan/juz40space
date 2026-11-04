import { useEffect, useRef, useState } from 'react';

// «Зет» — JUZ40-тың Z әрпінен жасалған кейіпкер. Көзі тінтуірге қарайды,
// анда-санда жыпылықтайды, сөйлеу бұлтында рейтинг туралы фактілер ауысады.
export default function Zet({ messages, size = 130 }) {
  const ref = useRef(null);
  const [eye, setEye] = useState({ x: 0, y: 0 });
  const [i, setI] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.max(1, Math.hypot(dx, dy));
        setEye({ x: (dx / d) * 4, y: (dy / d) * 4 });
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    if (messages.length < 2) return undefined;
    const t = setInterval(() => setI((x) => x + 1), 4200);
    return () => clearInterval(t);
  }, [messages.length]);

  const msg = messages.length ? messages[i % messages.length] : '';

  return (
    <div className="zet" ref={ref} style={{ width: size + 20 }}>
      {msg && <div key={msg} className="zet__bubble" role="status">{msg}</div>}
      <svg className="zet__body" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="JUZ40 кейіпкері — Зет">
        <path d="M22 22 H92 Q100 22 95 29 L40 92 H96 Q102 92 102 98 Q102 104 96 104 H26 Q16 104 23 95 L78 34 H22 Q14 34 14 28 Q14 22 22 22 Z"
          fill="#FCD34D" stroke="#10262F" strokeWidth="4" strokeLinejoin="round" />
        <g className="zet__eyes">
          <ellipse cx="46" cy="56" rx="9" ry="10" fill="#fff" stroke="#10262F" strokeWidth="3" />
          <ellipse cx="70" cy="56" rx="9" ry="10" fill="#fff" stroke="#10262F" strokeWidth="3" />
        </g>
        <g style={{ transform: `translate(${eye.x}px, ${eye.y}px)`, transition: 'transform .15s ease-out' }}>
          <circle cx="46" cy="57" r="4.2" fill="#10262F" />
          <circle cx="70" cy="57" r="4.2" fill="#10262F" />
        </g>
        <path d="M50 72 Q58 80 66 72" fill="none" stroke="#10262F" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
