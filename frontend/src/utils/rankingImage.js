// TikTok жарысының рейтингін сурет (PNG, 1080×1920 — TikTok/Instagram
// story өлшемі) етіп салу. Сыртқы кітапханасыз, Canvas 2D-мен: мәтін мен
// сызық векторлық салынады, сондықтан 2× масштабпен анық шығады.

import { monthLabel, fmtCompact } from './tiktok';

export const IMG_W = 1080;
export const IMG_H = 1920;

const C = {
  bg1: '#07141a', bg2: '#0f2a33',
  card: 'rgba(255,255,255,0.055)', cardLine: 'rgba(255,255,255,0.10)',
  ink: '#f2f8fa', soft: '#a9bec6', faint: '#6f8891',
  gold: '#f2c14e', silver: '#c9d4da', bronze: '#e0915c',
  cyan: '#25f4ee', red: '#fe2c55',
};

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
  return {
    month: monthLabel(data.month),
    status: isCurrent ? `Аралық рейтинг · ${d}.${m}.${y} жағдайы` : 'Айдың қорытындысы',
    winners: rows.filter((r) => r.place === 1),
    rows,
    totals: {
      videos: rows.reduce((a, r) => a + r.videos, 0),
      views: rows.reduce((a, r) => a + r.totalViews, 0),
    },
  };
}

const medal = (place) => (place === 1 ? C.gold : place === 2 ? C.silver : place === 3 ? C.bronze : null);
const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const font = (weight, size) => `${weight} ${size}px ${FONT}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Сыймаса — соңын «…» деп қияды
function fitText(ctx, text, maxW) {
  let t = String(text);
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// Кішкентай сызықтық белгілер (видео / көз)
function iconVideo(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.11; ctx.lineJoin = 'round';
  roundRect(ctx, x, y + s * 0.2, s * 0.64, s * 0.6, s * 0.12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + s * 0.66, y + s * 0.42); ctx.lineTo(x + s, y + s * 0.26);
  ctx.lineTo(x + s, y + s * 0.74); ctx.lineTo(x + s * 0.66, y + s * 0.58); ctx.closePath(); ctx.stroke();
  ctx.restore();
}
function iconEye(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.11;
  ctx.beginPath();
  ctx.moveTo(x, y + s / 2);
  ctx.quadraticCurveTo(x + s / 2, y + s * 0.05, x + s, y + s / 2);
  ctx.quadraticCurveTo(x + s / 2, y + s * 0.95, x, y + s / 2);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.16, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function trophy(ctx, cx, cy, s) {
  ctx.save();
  const g = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
  g.addColorStop(0, '#ffe08a'); g.addColorStop(1, '#d99a1e');
  ctx.fillStyle = g; ctx.strokeStyle = g; ctx.lineWidth = s * 0.12;
  // тостаған
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.62, cy - s * 0.8);
  ctx.lineTo(cx + s * 0.62, cy - s * 0.8);
  ctx.quadraticCurveTo(cx + s * 0.62, cy + s * 0.15, cx, cy + s * 0.25);
  ctx.quadraticCurveTo(cx - s * 0.62, cy + s * 0.15, cx - s * 0.62, cy - s * 0.8);
  ctx.fill();
  // құлақтары
  ctx.beginPath(); ctx.arc(cx - s * 0.62, cy - s * 0.45, s * 0.3, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + s * 0.62, cy - s * 0.45, s * 0.3, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
  // аяғы
  ctx.fillRect(cx - s * 0.1, cy + s * 0.2, s * 0.2, s * 0.35);
  roundRect(ctx, cx - s * 0.42, cy + s * 0.55, s * 0.84, s * 0.22, s * 0.06); ctx.fill();
  ctx.restore();
}

/**
 * model — buildImageModel() нәтижесі; logo — жүктелген <img> (міндетті емес).
 * ctx өлшемі IMG_W×IMG_H (немесе scale арқылы үлкейтілген).
 */
export function drawRanking(ctx, model, logo) {
  const W = IMG_W, H = IMG_H, PAD = 72;

  // Фон: қою көкшіл градиент + TikTok-тың екі түсті жұмсақ дақтары
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, C.bg2); bg.addColorStop(1, C.bg1);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  glow(W * 0.92, 160, 520, 'rgba(37,244,238,0.14)');
  glow(W * 0.05, 760, 520, 'rgba(254,44,85,0.11)');

  // Тақырып
  let y = 96;
  if (logo) {
    ctx.save(); roundRect(ctx, PAD, y, 72, 72, 18); ctx.clip();
    ctx.drawImage(logo, PAD, y, 72, 72); ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink; ctx.font = font(800, 40);
  ctx.fillText('JUZ40', PAD + 92, y + 34);
  ctx.fillStyle = C.soft; ctx.font = font(600, 26);
  ctx.fillText('TikTok жарысы', PAD + 92, y + 68);

  // Айы — оң жақта «таблетка»
  ctx.font = font(700, 28);
  const mw = ctx.measureText(model.month).width + 48;
  roundRect(ctx, W - PAD - mw, y + 12, mw, 52, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  ctx.strokeStyle = C.cardLine; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.ink; ctx.textAlign = 'center';
  ctx.fillText(model.month, W - PAD - mw / 2, y + 48);
  ctx.textAlign = 'left';

  // Үлкен тақырып
  y = 270;
  ctx.fillStyle = C.ink; ctx.font = font(900, 76);
  ctx.fillText('TikTok үздігі', PAD, y);
  ctx.fillStyle = C.soft; ctx.font = font(500, 28);
  ctx.fillText(model.status, PAD, y + 50);

  // Жеңімпаз карточкасы
  y = 370;
  const cardH = 360;
  roundRect(ctx, PAD, y, W - PAD * 2, cardH, 36);
  const cg = ctx.createLinearGradient(PAD, y, W - PAD, y + cardH);
  cg.addColorStop(0, 'rgba(242,193,78,0.20)'); cg.addColorStop(1, 'rgba(242,193,78,0.04)');
  ctx.fillStyle = cg; ctx.fill();
  ctx.strokeStyle = 'rgba(242,193,78,0.55)'; ctx.lineWidth = 3; ctx.stroke();

  trophy(ctx, W - PAD - 120, y + 150, 78);

  const win = model.winners[0];
  ctx.fillStyle = C.gold; ctx.font = font(800, 26);
  ctx.fillText(model.winners.length > 1 ? '1-ОРЫН · ТЕҢ ҰПАЙ' : '1-ОРЫН', PAD + 48, y + 70);
  if (win) {
    const names = model.winners.map((w) => w.name).join(' · ');
    ctx.fillStyle = C.ink; ctx.font = font(900, names.length > 14 ? 58 : 76);
    ctx.fillText(fitText(ctx, names, W - PAD * 2 - 300), PAD + 48, y + 160);
    ctx.fillStyle = C.soft; ctx.font = font(500, 28);
    ctx.fillText(fitText(ctx, model.winners.map((w) => '@' + w.username).join('  '), W - PAD * 2 - 300), PAD + 48, y + 204);

    // Жеңімпаздың үш көрсеткіші
    const stats = [
      [String(win.total), 'балл'],
      [String(win.videos), 'видео'],
      [fmtCompact(win.maxViews), 'ең көп қаралым'],
    ];
    let sx = PAD + 48;
    stats.forEach(([v, l]) => {
      ctx.fillStyle = C.ink; ctx.font = font(900, 52);
      ctx.fillText(v, sx, y + 290);
      const vw = ctx.measureText(v).width;
      ctx.fillStyle = C.soft; ctx.font = font(600, 24);
      ctx.fillText(l, sx, y + 326);
      sx += Math.max(vw, ctx.measureText(l).width) + 64;
    });
  } else {
    ctx.fillStyle = C.soft; ctx.font = font(600, 40);
    ctx.fillText('Деректер әлі жоқ', PAD + 48, y + 160);
  }

  // Кесте тақырыбы
  y = 800;
  const colVid = W - PAD - 300;
  const colMax = W - PAD - 24;
  ctx.font = font(700, 22); ctx.fillStyle = C.faint;
  ctx.fillText('ОРЫН · БӨЛІМ', PAD + 24, y);
  ctx.textAlign = 'right';
  ctx.fillText('ВИДЕО', colVid, y);
  ctx.fillText('ЕҢ КӨП ҚАРАЛЫМ', colMax, y);
  ctx.textAlign = 'left';

  // Жолдар — бөлім саны көп болса, биіктігі қысқарады
  const top = y + 24;
  const bottom = H - 150;
  const n = Math.max(1, model.rows.length);
  const gap = 10;
  const rowH = Math.min(84, (bottom - top - gap * (n - 1)) / n);
  const big = rowH >= 64;
  model.rows.forEach((r, i) => {
    const ry = top + i * (rowH + gap);
    const mc = medal(r.place);
    roundRect(ctx, PAD, ry, W - PAD * 2, rowH, Math.min(22, rowH / 3));
    ctx.fillStyle = mc ? 'rgba(255,255,255,0.08)' : C.card; ctx.fill();
    if (mc) { ctx.strokeStyle = mc; ctx.globalAlpha = 0.45; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }

    const mid = ry + rowH / 2;
    // Орын белгісі
    const badge = rowH * 0.56;
    ctx.beginPath(); ctx.arc(PAD + 24 + badge / 2, mid, badge / 2, 0, Math.PI * 2);
    ctx.fillStyle = mc || 'rgba(255,255,255,0.10)'; ctx.fill();
    ctx.fillStyle = mc ? '#10262f' : C.ink; ctx.font = font(900, badge * 0.5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(r.place), PAD + 24 + badge / 2, mid + 1);
    ctx.textAlign = 'left';

    // Атауы
    const nx = PAD + 24 + badge + 22;
    ctx.fillStyle = C.ink; ctx.font = font(700, big ? 31 : Math.max(20, rowH * 0.42));
    ctx.fillText(fitText(ctx, r.name, colVid - 150 - nx), nx, mid + (big ? -1 : 1));
    ctx.textBaseline = 'alphabetic';

    // Видео саны
    const isz = big ? 28 : 22;
    ctx.font = font(800, big ? 32 : 24); ctx.fillStyle = C.ink; ctx.textAlign = 'right';
    const vText = String(r.videos);
    ctx.textBaseline = 'middle';
    ctx.fillText(vText, colVid, mid + 1);
    const vw = ctx.measureText(vText).width;
    iconVideo(ctx, colVid - vw - isz - 12, mid - isz / 2, isz, C.cyan);

    // Ең көп қаралым
    const mText = fmtCompact(r.maxViews);
    ctx.fillStyle = r.maxViews >= 15000 ? C.red : C.ink;
    ctx.fillText(mText, colMax, mid + 1);
    const mw2 = ctx.measureText(mText).width;
    iconEye(ctx, colMax - mw2 - isz - 12, mid - isz / 2, isz, r.maxViews >= 15000 ? C.red : C.soft);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  });

  // Төменгі жол
  ctx.fillStyle = C.soft; ctx.font = font(600, 26);
  ctx.fillText(`Барлығы: ${model.totals.videos} видео · ${fmtCompact(model.totals.views)} қаралым`, PAD, H - 80);
  ctx.fillStyle = C.faint; ctx.font = font(600, 24); ctx.textAlign = 'right';
  ctx.fillText('#Juz40_life  #Juz40_moments', W - PAD, H - 80);
  ctx.textAlign = 'left';
}

// Браузерде: шрифт пен логотип жүктелгенін күтіп, PNG Blob қайтарады.
export async function renderRankingPng(model, logoSrc, scale = 2) {
  try {
    await Promise.all([400, 500, 600, 700, 800, 900].map((w) => document.fonts?.load(`${w} 40px Inter`, 'ҚазанӘіңғүұқөһ')));
  } catch { /* шрифт жүктелмесе — жүйелік шрифтпен салынады */ }
  const logo = await new Promise((resolve) => {
    if (!logoSrc) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = IMG_W * scale;
  canvas.height = IMG_H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  drawRanking(ctx, model, logo);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
