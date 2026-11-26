// TikTok жарысының рейтингін сурет (PNG, 1080×1920 — TikTok/Instagram
// story өлшемі) етіп салу. Стилі — «журнал мұқабасы»: кремдей қағаз,
// алып «1», жапсырма-стикер, айдың тақырыбы және мазмұн тәрізді тізім.
// Сыртқы кітапханасыз, Canvas 2D-мен, JUZ40 қарпімен.

import { monthLabel, fmtCompact } from './tiktok';
import { LOGO_PATHS, LOGO_VIEWBOX } from './juz40LogoPaths';

export const IMG_W = 1080;
export const IMG_H = 1920;

const C = {
  paper: '#F3EEE4', ink: '#141414', soft: '#4B5563', faint: '#9CA3AF',
  brand: '#1B6E7E', accent: '#E4572E', white: '#FFFFFF',
};
const FONT = "'JUZ40', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const font = (weight, size) => `${weight} ${size}px ${FONT}`;
const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

function countWorkdays(start, end) {
  let n = 0;
  for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
}

// Суретке керек деректер (таза функция — сынақпен тексеріледі)
export function buildImageModel(data) {
  const maxBy = {};
  for (const v of data.videos) {
    if (v.isTeam) continue;
    maxBy[v.departmentId] = Math.max(maxBy[v.departmentId] || 0, v.views || 0);
  }
  const rows = data.leaderboard.map((r) => ({
    place: r.place,
    name: r.name,
    username: r.username,
    videos: r.videoCount,
    maxViews: maxBy[r.departmentId] || 0,
    totalViews: r.totalViews,
    total: r.total,
  }));
  const isCurrent = data.window.isCurrent;
  const [y, m, d] = data.window.effectiveEnd.split('-');
  const winners = rows.filter((r) => r.place === 1);
  const runnerUp = rows.find((r) => r.place > 1) || null;
  const mostActive = rows.reduce((a, r) => (r.videos > (a?.videos || 0) ? r : a), null);
  const daysLeft = isCurrent && data.allDays && data.window.workdays
    ? Math.max(0, countWorkdays(data.allDays.start, data.allDays.end) - data.window.workdays.length)
    : null;
  return {
    month: monthLabel(data.month),
    monthNo: Number(String(data.month).split('-')[1]) || null,
    isCurrent,
    status: isCurrent ? `Аралық рейтинг · ${d}.${m}.${y} жағдайы` : 'Айдың қорытындысы',
    winners,
    gap: winners.length === 1 && runnerUp ? Math.round((winners[0].total - runnerUp.total) * 10) / 10 : null,
    runnerUp: runnerUp?.name || null,
    mostActive: mostActive && mostActive.videos > 0 ? { name: mostActive.name, videos: mostActive.videos } : null,
    daysLeft,
    rows,
    totals: {
      videos: rows.reduce((a, r) => a + r.videos, 0),
      views: rows.reduce((a, r) => a + r.totalViews, 0),
    },
  };
}

/* ───────────── сызу көмекшілері ───────────── */

function spaced(ctx, text, x, y, spacing) {
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    ctx.letterSpacing = '0px';
    return;
  }
  ctx.fillText(text.split('').join(' '), x, y);
}

function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

// Сөздерді жолға бөледі (ең көбі maxLines жол)
function wrap(ctx, text, maxW, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = fit(ctx, `${cut[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, maxW);
    return cut;
  }
  return lines;
}

function drawLogo(ctx, x, y, height, color) {
  const s = height / LOGO_VIEWBOX.h;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  LOGO_PATHS.forEach((d) => ctx.fill(new Path2D(d)));
  ctx.restore();
  return LOGO_VIEWBOX.w * s;
}

function rule(ctx, x1, x2, y, w) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(x1, y, x2 - x1, w);
}

// Қағаз текстурасы — нүктелі ұсақ шу (тұрақты, кездейсоқ емес)
function paperGrain(ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,20,20,0.035)';
  let s = 42;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i += 1) ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
  ctx.restore();
}

/* ───────────── сурет ───────────── */

export function drawRanking(ctx, model) {
  const W = IMG_W;
  const H = IMG_H;
  const PAD = 70;

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  paperGrain(ctx, W, H);
  ctx.textBaseline = 'alphabetic';

  // Бас жазу (masthead)
  drawLogo(ctx, PAD, 72, 90, C.ink);
  ctx.fillStyle = C.ink; ctx.font = font(500, 32); ctx.textAlign = 'right';
  ctx.fillText('TikTok жарысы', W - PAD, 158);
  ctx.textAlign = 'left';
  rule(ctx, PAD, W - PAD, 192, 6);

  // Шығарылым жолы
  ctx.font = font(500, 26); ctx.fillStyle = C.ink;
  spaced(ctx, model.month.toUpperCase(), PAD, 250, 4);
  const issue = model.isCurrent ? 'АРАЛЫҚ НӘТИЖЕ' : 'АЙ ҚОРЫТЫНДЫСЫ';
  ctx.textAlign = 'right';
  spaced(ctx, model.monthNo ? `${issue} · №${model.monthNo}` : issue, W - PAD, 250, 4);
  ctx.textAlign = 'left';

  // Алып «1» және «ОРЫН»
  ctx.fillStyle = C.brand; ctx.font = font(700, 600);
  ctx.fillText('1', 30, 800);
  ctx.font = font(700, 44);
  spaced(ctx, 'ОРЫН', PAD + 6, 880, 14);

  // Жеңімпаз(дар)
  const names = model.winners.slice(0, 3).map((w) => w.name);
  const more = model.winners.length - names.length;
  const nameSize = names.length > 1 ? 74 : 96;
  ctx.textAlign = 'right'; ctx.fillStyle = C.ink; ctx.font = font(700, nameSize);
  let ny = 380;
  names.forEach((n) => {
    wrap(ctx, n, 500, 2).forEach((line) => { ctx.fillText(line, W - PAD, ny); ny += nameSize * 0.98; });
  });
  if (more > 0) { ctx.font = font(700, 44); ctx.fillText(`+${more} бөлім`, W - PAD, ny); ny += 50; }

  const note = model.winners.length > 1
    ? `${model.winners.length} бөлім бір сатыда`
    : model.gap !== null && model.runnerUp
      ? `${model.runnerUp} бөлімінен ${r1(model.gap)} ұпай алда`
      : 'Айдың көшбасшысы';
  const tail = model.isCurrent && model.daysLeft !== null
    ? (model.daysLeft > 0 ? ` — ай соңына ${model.daysLeft} жұмыс күні қалды` : ' — бүгін соңғы жұмыс күні')
    : '';
  ctx.font = font(400, 30); ctx.fillStyle = C.soft;
  wrap(ctx, note + tail, 470, 3).forEach((line, i) => ctx.fillText(line, W - PAD, ny + 24 + i * 40));
  ctx.textAlign = 'left';

  // Жапсырма-стикер
  const top = model.winners[0];
  if (top) {
    ctx.save();
    ctx.translate(W - 230, 820);
    ctx.rotate(-12 * Math.PI / 180);
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.arc(0, 0, 118, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([10, 9]);
    ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.white; ctx.textAlign = 'center';
    ctx.font = font(700, 78); ctx.fillText(r1(top.total), 0, 18);
    ctx.font = font(700, 32); ctx.fillText('ұпай', 0, 60);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  // Айдың тақырыбы
  rule(ctx, PAD, W - PAD, 980, 3);
  if (model.mostActive) {
    ctx.font = font(700, 60);
    const head = `${model.mostActive.name} — ${model.mostActive.videos} видео, ең белсенді бөлім`;
    const lines = wrap(ctx, head, W - PAD * 2, 2);
    const hl = `${model.mostActive.videos} видео`;
    lines.forEach((line, i) => {
      const y = 1056 + i * 64;
      const at = line.indexOf(hl);
      if (at < 0) { ctx.fillStyle = C.ink; ctx.fillText(line, PAD, y); return; }
      const before = line.slice(0, at);
      ctx.fillStyle = C.ink; ctx.fillText(before, PAD, y);
      const x2 = PAD + ctx.measureText(before).width;
      ctx.fillStyle = C.accent; ctx.fillText(hl, x2, y);
      ctx.fillStyle = C.ink; ctx.fillText(line.slice(at + hl.length), x2 + ctx.measureText(hl).width, y);
    });
  }

  // Мазмұн тәрізді тізім: екі баған
  const rows = model.rows;
  const perCol = Math.ceil(rows.length / 2);
  const listTop = 1215;
  const listBottom = H - 150;
  const rowH = Math.min(74, (listBottom - listTop) / Math.max(perCol, 1));
  const colW = (W - PAD * 2 - 60) / 2;
  const size = Math.min(34, Math.round(rowH * 0.5));
  rows.forEach((r, i) => {
    const col = i < perCol ? 0 : 1;
    const x = PAD + col * (colW + 60);
    const y = listTop + (i % perCol) * rowH + rowH * 0.72;
    ctx.font = font(700, size); ctx.fillStyle = C.brand; ctx.textAlign = 'left';
    ctx.fillText(String(r.place), x, y);
    const score = r1(r.total);
    const sw = ctx.measureText(score).width;
    ctx.font = font(400, size); ctx.fillStyle = C.ink;
    const nameX = x + size * 1.6;
    const name = fit(ctx, r.name, colW - (nameX - x) - sw - 40);
    ctx.fillText(name, nameX, y);
    const nw = ctx.measureText(name).width;
    // нүктелі сызық
    ctx.fillStyle = C.faint;
    for (let dx = nameX + nw + 14; dx < x + colW - sw - 14; dx += 12) ctx.fillRect(dx, y - 6, 4, 4);
    ctx.font = font(700, size); ctx.fillStyle = C.ink; ctx.textAlign = 'right';
    ctx.fillText(score, x + colW, y);
    ctx.textAlign = 'left';
  });

  // Төменгі жол
  rule(ctx, PAD, W - PAD, H - 108, 3);
  ctx.font = font(500, 26); ctx.fillStyle = C.ink;
  ctx.fillText(`${model.totals.videos} видео · ${fmtCompact(model.totals.views)} қаралым`, PAD, H - 62);
  ctx.textAlign = 'right';
  ctx.fillText('#juz40_life · juz40.space', W - PAD, H - 62);
  ctx.textAlign = 'left';
}

// Браузерде: JUZ40 қарпі жүктелгенін күтіп, PNG Blob қайтарады.
export async function renderRankingPng(model, scale = 2) {
  try {
    await Promise.all([400, 500, 700].map((w) => document.fonts?.load(`${w} 40px JUZ40`, 'ҚазанӘіңғүұқөһ1')));
  } catch { /* қаріп жүктелмесе — жүйелік қаріппен салынады */ }
  const canvas = document.createElement('canvas');
  canvas.width = IMG_W * scale;
  canvas.height = IMG_H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  drawRanking(ctx, model);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
