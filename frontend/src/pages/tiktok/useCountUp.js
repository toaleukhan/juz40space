import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Сан алдыңғы мәнінен жаңасына дейін «санап» жетеді (ease-out).
// Бет ашылғанда 0-ден, деректер жаңарғанда ескі мәннен бастайды.
export default function useCountUp(target, duration = 1100) {
  const [still] = useState(reduced); // қозғалыс өшірілген болса — бірден мәнін көрсетеміз
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (still) return undefined;
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (now) => {
      const k = Math.min(1, (now - start) / duration);
      const v = a + (target - a) * (1 - (1 - k) ** 3);
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, duration, still]);

  return still ? target : value;
}
