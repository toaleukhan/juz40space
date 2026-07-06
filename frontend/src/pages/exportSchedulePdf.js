// exportSchedulePdf.js — Сабақ кестесін әдемі, брендтелген PDF файл ретінде экспорттау.
// html2canvas арқылы жасырын DOM-ды растрлап, jsPDF-пен көп бетті PDF-ке жинайды.
// Екі режим бар: тізім (күн бойынша қатарлар) және күнтізбе (күн бағандары, calendar-тәрізді).

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SUBJECT_COLORS } from './scheduleData';
import juz40Logo from '../assets/juz40-logo.png';

const JUZ = { teal: '#1B6E7E', tealDeep: '#0D4A57', tealPale: '#E8F4F6' };

function buildHeader({ monthName, streamName }) {
  const header = document.createElement('div');
  header.style.cssText = `
    display:flex; align-items:center; gap:14px; margin-bottom:6px;
    padding-bottom:16px; border-bottom:3px solid ${JUZ.teal};
  `;
  const logoImg = document.createElement('img');
  logoImg.src = juz40Logo;
  logoImg.style.cssText = 'height:34px;';
  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = `
    <div style="font-size:20px;font-weight:900;color:${JUZ.tealDeep};letter-spacing:-0.3px;">Сабақ кестесі</div>
    <div style="font-size:12px;color:#5a7d86;margin-top:2px;">${monthName} айы · ${streamName} ағыны</div>
  `;
  header.appendChild(logoImg);
  header.appendChild(titleWrap);
  return header;
}

function buildGenerated() {
  const generated = document.createElement('div');
  generated.style.cssText = 'font-size:10px;color:#8aa4ab;margin:8px 0 18px;text-align:right;';
  generated.textContent = `Жасалды: ${new Date().toLocaleString('kk-KZ')}`;
  return generated;
}

function buildFooter() {
  const footer = document.createElement('div');
  footer.style.cssText = `margin-top:20px;padding-top:12px;border-top:1px solid #e0ecee;font-size:10px;color:#8aa4ab;text-align:center;`;
  footer.textContent = '© JUZ40 Online Education';
  return footer;
}

async function rasterizeAndSave(container, { orientation = 'portrait', fileName }) {
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 1.5, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let heightLeft = imgH;
    let position = 0;
    const imgData = canvas.toDataURL('image/jpeg', 0.82);

    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

// ─── Тізім (List) ────────────────────────────────────────────────────────────
function buildLessonRow(lesson) {
  const col = SUBJECT_COLORS[lesson.subject] || { primary: JUZ.teal, text: '#fff' };
  const row = document.createElement('div');
  row.style.cssText = `
    display:flex; gap:10px; padding:8px 12px; margin-bottom:6px;
    border-radius:8px; border-left:4px solid ${col.primary};
    background:${col.primary}12; break-inside:avoid;
  `;
  const badge = document.createElement('div');
  badge.textContent = lesson.subject + (lesson.stream ? ` · ${lesson.stream}` : '');
  badge.style.cssText = `
    flex-shrink:0; min-width:120px; font-weight:700; font-size:11px;
    color:#fff; background:${col.primary}; border-radius:14px;
    padding:3px 10px; align-self:flex-start;
  `;
  const teachers = document.createElement('div');
  teachers.style.cssText = 'flex:1; font-size:11px; color:#1a2a30; line-height:1.6;';
  teachers.innerHTML = (lesson.teachers || []).map(t =>
    `<div><b>${t.name}</b> — ${t.times.join(', ')}</div>`
  ).join('');
  row.appendChild(badge);
  row.appendChild(teachers);
  return row;
}

function buildDayBlock(day) {
  const block = document.createElement('div');
  block.style.cssText = 'margin-bottom:16px; break-inside:avoid;';
  const title = document.createElement('div');
  title.textContent = `${day.day}${day.lessons?.length ? ` · ${day.lessons.length} пән` : ''}`;
  title.style.cssText = `
    font-weight:800; font-size:14px; color:${JUZ.tealDeep};
    padding:6px 0; margin-bottom:8px; border-bottom:2px solid ${JUZ.teal};
  `;
  block.appendChild(title);
  (day.lessons || []).forEach(l => block.appendChild(buildLessonRow(l)));
  return block;
}

export async function exportScheduleToPdf({ days, monthName, streamName }) {
  const container = document.createElement('div');
  container.style.cssText = `
    position:fixed; top:0; left:-9999px; width:780px;
    background:#ffffff; padding:32px; font-family:'Inter',system-ui,sans-serif;
  `;
  container.appendChild(buildHeader({ monthName, streamName }));
  container.appendChild(buildGenerated());

  if (!days.length) {
    const empty = document.createElement('div');
    empty.textContent = 'Сабақ табылмады';
    empty.style.cssText = 'text-align:center;color:#8aa4ab;padding:40px;';
    container.appendChild(empty);
  } else {
    days.forEach(d => container.appendChild(buildDayBlock(d)));
  }

  container.appendChild(buildFooter());

  const fileName = `JUZ40_тізім_${monthName}_${streamName}.pdf`.replace(/\s+/g, '_');
  await rasterizeAndSave(container, { orientation: 'portrait', fileName });
}

// ─── Күнтізбе (Calendar) — күн бағандары ─────────────────────────────────────
function timeLabel(ev) {
  const fmt = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  return `${fmt(ev.startMin)}–${fmt(ev.endMin)}`;
}

function buildEventChip(ev) {
  const col = SUBJECT_COLORS[ev.subject] || { primary: JUZ.teal };
  const chip = document.createElement('div');
  const isAdditional = ev.kind === 'additional';
  chip.style.cssText = `
    margin-bottom:6px; padding:6px 8px; border-radius:7px; break-inside:avoid;
    background:${col.primary}14; border-left:3px solid ${col.primary};
    ${isAdditional ? `border-style:dashed;` : ''}
  `;
  chip.innerHTML = `
    <div style="font-size:9.5px;font-weight:800;color:#fff;background:${col.primary};display:inline-block;
      padding:1px 7px;border-radius:10px;margin-bottom:3px;">${ev.subject}${ev.stream?` · ${ev.stream}`:''}</div>
    <div style="font-size:9.5px;font-weight:700;color:${JUZ.tealDeep};">${timeLabel(ev)}</div>
    <div style="font-size:9.5px;color:#33484f;line-height:1.4;">${(ev.teachers||[]).join(', ')}</div>
  `;
  return chip;
}

function buildDayColumn(day, events) {
  const col = document.createElement('div');
  col.style.cssText = 'flex:1; min-width:150px; break-inside:avoid;';
  const title = document.createElement('div');
  title.textContent = day;
  title.style.cssText = `
    font-weight:800; font-size:12.5px; color:#fff; background:${JUZ.teal};
    padding:6px 0; margin-bottom:8px; border-radius:8px; text-align:center;
  `;
  col.appendChild(title);
  const sorted = [...events].sort((a,b) => a.startMin - b.startMin);
  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.textContent = 'сабақ жоқ';
    empty.style.cssText = 'font-size:10px;color:#b7c6ca;text-align:center;padding:10px 0;';
    col.appendChild(empty);
  } else {
    sorted.forEach(ev => col.appendChild(buildEventChip(ev)));
  }
  return col;
}

export async function exportCalendarToPdf({ byDay, days, monthName, streamName }) {
  const container = document.createElement('div');
  container.style.cssText = `
    position:fixed; top:0; left:-9999px; width:1080px;
    background:#ffffff; padding:32px; font-family:'Inter',system-ui,sans-serif;
  `;
  container.appendChild(buildHeader({ monthName, streamName }));
  container.appendChild(buildGenerated());

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex; gap:10px; align-items:flex-start;';
  days.forEach(day => grid.appendChild(buildDayColumn(day, byDay[day] || [])));
  container.appendChild(grid);

  container.appendChild(buildFooter());

  const fileName = `JUZ40_күнтізбе_${monthName}_${streamName}.pdf`.replace(/\s+/g, '_');
  await rasterizeAndSave(container, { orientation: 'landscape', fileName });
}
