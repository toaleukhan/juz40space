import { useEffect, useRef } from 'react';

// Логин бетінің фоны — бір мұз монолиті.
//
// Метафора: платформаның аты «Space» — шашыраңқы жүрген СТ-лардың бәрі
// сыятын бір кеңістік. Сол кеңістік мұнда бір ғана кристалл түрінде
// көрінеді: сырты қырлы, іші процедуралық түрде «өсірілген» құрылымға
// толы. «Кіру» басылғанда камера сол кристалдың ІШІНЕ кіреді — экран
// аяздың ішінен көрінген жарыққа айналады да, форма соның ішінде ашылады.
//
// Бәрі бір фрагмент-шейдерде raymarching арқылы салынады: ешбір 3D
// кітапхана да, модель де, текстура да жүктелмейді.

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;   // -1..1
uniform float uEnter;   // 0 = сырттан қарау, 1 = кристалдың ішінде
uniform float uQuality; // 1.0 = толық, 0.6 = жеңілдетілген

out vec4 outColor;

// ── шу ──────────────────────────────────────────────────────────────
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}

// Кристаллдың ішкі «өсуі»: жасушалық құрылым — мұздың жарықшақтары.
float cells(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d = 1.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(hash(i + g), hash(i + g + 11.0), hash(i + g + 27.0));
    d = min(d, length(g + o - f));
  }
  return d;
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// ── монолиттің пішіні ───────────────────────────────────────────────
// Созылған октаэдр + бірнеше жазықтықпен қиылған қыр: табиғи мұз
// сынығына ұқсас, әр қыры жарықты бөлек шағылыстырады.
float sdCrystal(vec3 p) {
  p.xz *= rot(uTime * 0.055);
  p.yz *= rot(-0.18);

  // Тік созылған, жіңішке сынық: көлденеңінен қысылған октаэдр.
  vec3 q = p * vec3(1.62, 0.40, 1.62);
  float d = (abs(q.x) + abs(q.y) + abs(q.z) - 1.0) * 0.42;

  // Қырлар — әрқайсысы жарықты бөлек шағылыстырады.
  d = max(d,  dot(p, normalize(vec3( 0.62, 0.22,  0.75))) - 0.52);
  d = max(d,  dot(p, normalize(vec3(-0.80, 0.10,  0.42))) - 0.48);
  d = max(d,  dot(p, normalize(vec3( 0.30, 0.14, -0.88))) - 0.50);
  d = max(d,  dot(p, normalize(vec3( 0.18, -0.9,  0.30))) - 1.30);
  d = max(d,  dot(p, normalize(vec3(-0.30, 0.86, -0.40))) - 1.44);

  // беттегі жеңіл аяз
  d -= fbm(p * 3.4) * 0.012;
  return d;
}

vec3 crystalNormal(vec3 p) {
  vec2 e = vec2(0.0016, 0.0);
  return normalize(vec3(
    sdCrystal(p + e.xyy) - sdCrystal(p - e.xyy),
    sdCrystal(p + e.yxy) - sdCrystal(p - e.yxy),
    sdCrystal(p + e.yyx) - sdCrystal(p - e.yyx)));
}

// ── орта (жалған HDRI) ──────────────────────────────────────────────
// Суық көк-сұр аспан, төменде қараңғылау мұз жазығы, бір жарқын кілт-жарық.
vec3 env(vec3 d) {
  float y = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(vec3(0.176, 0.198, 0.238), vec3(0.784, 0.822, 0.874), pow(y, 1.25));
  col = mix(col, vec3(0.098, 0.113, 0.140), smoothstep(0.46, 0.0, y));

  vec3 key = normalize(vec3(0.38, 0.72, 0.34));
  col += vec3(1.0, 0.98, 0.95) * pow(max(dot(d, key), 0.0), 56.0) * 1.9;
  col += vec3(0.52, 0.66, 0.86) * pow(max(dot(d, normalize(vec3(-0.6, 0.2, -0.7))), 0.0), 10.0) * 0.22;
  return col;
}

// Кристалдың ішінен өткен жол: неғұрлым ұзақ жүрсе, соғұрлым сүттене
// түседі — мұздың ішіндегі майда көпіршіктер мен жарықшақтар осылай.
vec3 interior(vec3 p0, vec3 rd, float dist) {
  // Кристалдың ішіндегі «өсу»: жасуша шекаралары — жұқа, өткір
  // жарықшақ жазықтары, оның үстіне ірілеу қабат-қабат өсу сызықтары.
  float veins = 0.0, layers = 0.0;
  for (int i = 0; i < 6; i++) {
    vec3 sp = p0 + rd * (dist * (float(i) + 0.5) / 6.0);
    float c = cells(sp * 5.2 + vec3(0.0, uTime * 0.02, 0.0));
    veins += smoothstep(0.09, 0.0, c);                       // жіңішке жарықшақ
    layers += smoothstep(0.55, 0.14, cells(sp * 1.5));       // ірі құрылым
  }
  veins /= 6.0; layers /= 6.0;

  vec3 col = mix(vec3(0.16, 0.21, 0.29), vec3(0.42, 0.50, 0.62), layers);
  col += vec3(0.92, 0.97, 1.0) * veins * 1.05;               // жарқыраған қырлар
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  // Камера: сырттан баяу жақындап, кіргенде кристалдың ішіне өтеді.
  float e = uEnter * uEnter * (3.0 - 2.0 * uEnter);
  vec3 ro = vec3(0.0, 0.0, mix(6.10, 0.26, e));
  ro.xy += uMouse * (0.28 * (1.0 - e));

  vec3 rd = normalize(vec3(uv * 1.05, -1.55));
  rd.xy += uMouse * 0.035 * (1.0 - e);
  rd = normalize(rd);

  vec3 col = env(rd);

  // ── сыртқы марш ──
  float t = 0.0;
  bool hit = false;
  int steps = int(mix(48.0, 92.0, uQuality));
  for (int i = 0; i < 92; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    float d = sdCrystal(p);
    if (d < 0.0016) { hit = true; break; }
    if (t > 8.0) break;
    t += d * 0.85;
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = crystalNormal(p);

    float fres = pow(1.0 - max(dot(-rd, n), 0.0), 4.0);
    fres = mix(0.06, 1.0, fres);

    // Сыну — үш арнаға сәл өзге көрсеткішпен: хроматикалық аберрация.
    vec3 refr = refract(rd, n, 1.0 / 1.31);
    vec3 inPos = p + refr * 0.012;

    float it = 0.0;
    for (int i = 0; i < 40; i++) {
      vec3 q = inPos + refr * it;
      float d = -sdCrystal(q);
      if (d < 0.0016) break;
      if (it > 5.0) break;
      it += max(d * 0.85, 0.006);
    }

    vec3 exitP = inPos + refr * it;
    vec3 exitN = -crystalNormal(exitP);
    vec3 outDir = refract(refr, exitN, 1.31 / 1.0);
    if (dot(outDir, outDir) < 0.001) outDir = reflect(refr, exitN);

    vec3 disp = normalize(cross(outDir, vec3(0.0, 1.0, 0.0))) * 0.020;
    vec3 tint = vec3(
      env(normalize(outDir + disp)).r,
      env(outDir).g,
      env(normalize(outDir - disp)).b);

    vec3 inner = interior(inPos, refr, it);
    vec3 refl = env(reflect(rd, n));

    // Қырлардың жиегі жарқырайды — мұздың сынған беті осылай көрінеді.
    float edge = pow(1.0 - abs(dot(n, -rd)), 6.0);

    col = mix(tint * 0.72 + inner * 0.62, refl, fres);
    col += vec3(0.88, 0.95, 1.0) * edge * 0.85;
  }

  // Кристалдың ішіне кіргенде экран аяздың ішінен көрінген жарыққа
  // айналады — форма соның үстінде оқылады.
  float frost = smoothstep(0.55, 1.0, uEnter);
  if (frost > 0.0) {
    vec3 p = vec3(uv * 2.2, uTime * 0.05);
    float f = fbm(p * 2.4) * 0.5 + cells(p * 3.4) * 0.5;
    vec3 ice = mix(vec3(0.64, 0.70, 0.78), vec3(0.90, 0.94, 0.98), f);
    // Толық жауып тастамаймыз — кристалдың ішінде тұрғанымыз көрініп
    // тұрсын; форманың оқылуын оның өз аязды алаңы қамтамасыз етеді.
    col = mix(col, ice, frost * 0.55);
  }

  // Контраст қисығы — жалпақ сұрдың орнына тереңдік береді.
  col = pow(max(col, 0.0), vec3(1.18)) * 1.16;

  // Шеттерін қарайтатын виньетка.
  col *= 1.0 - 0.62 * pow(length(uv * vec2(0.80, 1.0)), 2.0);

  // Аздаған дән — тегіс градиенттегі жолақтарды жасырады.
  col += (hash(vec3(gl_FragCoord.xy, floor(uTime * 24.0))) - 0.5) * 0.016;

  outColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function CrystalField({ entering = false, style }) {
  const ref = useRef(null);
  // Анимация React render циклінен тыс жүреді — 60fps-ті әр кадрда
  // қайта render жасамай, тікелей шейдерде айдаған дұрыс.
  const stateRef = useRef({ entering: false, e: 0, mx: 0, my: 0, tmx: 0, tmy: 0 });

  useEffect(() => { stateRef.current.entering = entering; }, [entering]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, powerPreference: 'high-performance',
    });
    // WebGL2 жоқ болса — бет CSS фонымен жұмысын жалғастырады.
    if (!gl) return;

    const st = stateRef.current;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // Экранды толық жабатын бір үшбұрыш.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uEnter = gl.getUniformLocation(prog, 'uEnter');
    const uQuality = gl.getUniformLocation(prog, 'uQuality');

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, W = 0, H = 0, quality = 1;

    const size = () => {
      // Raymarching пиксель санына тікелей тәуелді — сондықтан DPR
      // шектеледі, әйтпесе Retina экранда төрт есе жұмыс болады.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      quality = canvas.width * canvas.height > 2200000 ? 0.55 : 1.0;
    };

    const t0 = performance.now();
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (!W || !H) return;

      const target = st.entering ? 1 : 0;
      st.e += (target - st.e) * 0.035;
      st.mx += (st.tmx - st.mx) * 0.06;
      st.my += (st.tmy - st.my) * 0.06;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduced ? 0 : (now - t0) / 1000);
      gl.uniform2f(uMouse, st.mx, st.my);
      gl.uniform1f(uEnter, st.e);
      gl.uniform1f(uQuality, quality);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const onMove = (ev) => {
      st.tmx = (ev.clientX / window.innerWidth) * 2 - 1;
      st.tmy = -((ev.clientY / window.innerHeight) * 2 - 1);
    };

    size();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', size);
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', onMove);
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteBuffer(buf);
    };
  }, []);

  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%', ...style }} />;
}
