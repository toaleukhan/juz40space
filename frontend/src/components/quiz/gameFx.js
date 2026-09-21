import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const KEYS = ['a', 'b', 'c', 'd'];

// Ойыншының белгісі: аты бойынша тұрақты түс + пішін. Хостың күту залындағы
// «шипта» да, ойыншының телефонындағы белгіде де БІРДЕЙ шығады — оқушы
// өз атын экраннан бірден табады.
export function badgeFor(name) {
  let h = 0;
  for (const ch of String(name).toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return { key: KEYS[h % 4], shape: Math.floor(h / 4) % 4 };
}

// Тұрақты «кездейсоқ»: render кезінде Math.random қолданбау үшін (конфетти,
// фон пішіндері әр рендерде бірдей болады).
export function pseudo(i, k) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Санның біртіндеп өсуі (ұпай, санауыш). Қозғалыс өшірулі болса — бірден соңғы мән.
export function useCountUp(to, from = 0, ms = 700) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (reduced || from === to) {
      const t = setTimeout(() => setValue(to), 0);
      return () => clearTimeout(t);
    }
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / ms, 1);
      setValue(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
      if (p >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [to, from, ms, reduced]);
  return reduced ? to : value;
}
