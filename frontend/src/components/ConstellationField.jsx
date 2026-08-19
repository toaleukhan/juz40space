import { useEffect, useRef } from 'react';

// Логин бетінің тірі фоны — платформаның негізгі метафорасы.
//
// Бастапқыда экранға шашыраған ұсақ үшбұрыштар: әрқайсысы бір СТ.
// Курсор жақындағанда олар соған қарай тартылады — шашыраңқы нәрсені
// бір жерге жинау ишарасы. «Кіру» басылғанда бәрі ортаға жиналып,
// айналасы бос бір сақина — SPACE — құрайды да, форма соның ішінде
// ашылады.
//
// Ешбір сурет жүктелмейді, бәрі canvas-та салынады.

const COLORS = [
  '#8052ff', '#8052ff', '#8052ff',   // Electric Iris басым
  '#ffb829', '#ffb829',              // Saffron Spark
  '#15846e',                         // Deep Verdant
  '#b48cff', '#4a7dff', '#ff6bd6',
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export default function ConstellationField({ gathered = false, style }) {
  const ref = useRef(null);
  // Күй React render циклінен тыс жүреді — 60fps анимацияны әр кадрда
  // қайта render жасамай, тікелей canvas-та жүргізген дұрыс.
  const stateRef = useRef({ gathered: false, k: 0, pointer: { x: -9999, y: -9999, on: false } });

  useEffect(() => { stateRef.current.gathered = gathered; }, [gathered]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const st = stateRef.current;
    let raf = 0, W = 0, H = 0, parts = [];

    const build = () => {
      const rand = rng(9081);
      const n = W < 760 ? 260 : 620;
      parts = [];
      for (let i = 0; i < n; i++) {
        // Жиналған күйдегі орны — ортадағы сақина (SPACE шеңбері).
        const a = rand() * Math.PI * 2;
        const ringR = .30 + Math.pow(rand(), .6) * .12;
        parts.push({
          hx: rand(), hy: rand(),                  // шашыраңқы «үй» орны
          ta: a, tr: ringR,                        // сақинадағы бұрыш/радиус
          x: 0, y: 0,
          size: 2.4 + rand() * 4.4,
          color: COLORS[(rand() * COLORS.length) | 0],
          rot: rand() * Math.PI * 2,
          rotSpeed: (rand() - .5) * .5,
          driftA: rand() * Math.PI * 2,
          driftS: .12 + rand() * .30,
          driftR: 6 + rand() * 18,
          delay: rand() * .35,                     // жиналу кезегі
          alpha: .45 + rand() * .55,
        });
      }
      parts.forEach(p => { p.x = p.hx * W; p.y = p.hy * H; });
    };

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    const tri = (x, y, r, rot, color, alpha) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * .866, r * .5);
      ctx.lineTo(-r * .866, r * .5);
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.15;
      ctx.stroke();
      ctx.restore();
    };

    const t0 = performance.now();
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (!W || !H) return;
      const t = (now - t0) / 1000;

      // Жиналу/тарау коэффициенті — екі бағытта да біркелкі жүреді.
      const target = st.gathered ? 1 : 0;
      st.k += (target - st.k) * .045;
      const K = clamp(st.k, 0, 1);

      ctx.clearRect(0, 0, W, H);

      const cx = W * .5, cy = H * .5;
      const ringBase = Math.min(W, H);

      for (const p of parts) {
        // ── шашыраңқы күй ──
        const dx = Math.cos(p.driftA + t * p.driftS) * p.driftR;
        const dy = Math.sin(p.driftA * 1.3 + t * p.driftS * .8) * p.driftR;
        let ix = p.hx * W + dx;
        let iy = p.hy * H + dy;

        // Курсор тартылысы: жақындағандар соған қарай жылжиды.
        if (st.pointer.on) {
          const vx = st.pointer.x - ix, vy = st.pointer.y - iy;
          const d = Math.hypot(vx, vy);
          const R = Math.min(W, H) * .30;
          if (d < R && d > .001) {
            const pull = Math.pow(1 - d / R, 2) * .55 * (1 - K);
            ix += vx * pull;
            iy += vy * pull;
          }
        }

        // ── жиналған күй: ортадағы сақина ──
        const kk = clamp((K - p.delay) / (1 - p.delay), 0, 1);
        const e = easeInOut(kk);
        // Жиналғанда сақина ақырын айналады — «тірі» көрінеді.
        const ang = p.ta + t * .06;
        const gx = cx + Math.cos(ang) * p.tr * ringBase;
        const gy = cy + Math.sin(ang) * p.tr * ringBase * .78;

        p.x = ix + (gx - ix) * e;
        p.y = iy + (gy - iy) * e;
        p.rot += p.rotSpeed * .016;

        tri(p.x, p.y, p.size, p.rot, p.color, p.alpha * (.55 + e * .45));
      }
      ctx.globalAlpha = 1;

      // Ортадағы жұмсақ көлеңке: мәтін мен форма тұратын жер. Бөлшектер
      // жиналғанда сақина одан тысқары қалады, сондықтан бұл екі күйде де
      // тек бос ортаны ғана басады.
      const scrim = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringBase * .46);
      scrim.addColorStop(0, 'rgba(0,0,0,.92)');
      scrim.addColorStop(.62, 'rgba(0,0,0,.62)');
      scrim.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, W, H);
    };

    const onMove = (ev) => {
      const r = canvas.getBoundingClientRect();
      st.pointer.x = ev.clientX - r.left;
      st.pointer.y = ev.clientY - r.top;
      st.pointer.on = true;
    };
    const onLeave = () => { st.pointer.on = false; };

    size();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', size);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%', ...style }} />;
}
