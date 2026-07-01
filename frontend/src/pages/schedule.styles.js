// schedule.styles.js — Сабақ кестесі беттерінің ортақ түс палитрасы мен глобал CSS-і

export const JUZ = {
  teal:      '#1B6E7E',
  tealMid:   '#155F6E',
  tealDeep:  '#0D4A57',
  tealLight: '#2A8A9E',
  tealPale:  '#E8F4F6',
};

export const C = {
  pageBg:     'var(--bg)',
  cardBg:     'var(--surface)',
  text:       'var(--text)',
  textSub:    'var(--text-sub)',
  textMuted:  'var(--text-muted)',
  titleColor: 'var(--text)',
  divider:    'var(--border)',
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
export const G = `
  @keyframes liveBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }
  .live-dot {
    display:inline-block; width:6px; height:6px; border-radius:50%;
    background:#ef4444; animation: liveBlink 1.2s ease-in-out infinite;
  }
  @keyframes plusPulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(249,115,22,0.35); }
    50% { transform: scale(1.18); box-shadow: 0 0 0 3px rgba(249,115,22,0); }
  }
  .plus-dot {
    display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;
    width:15px; height:15px; border-radius:50%; background:#f97316; color:#fff;
    font-size:11px; font-weight:800; line-height:1;
    animation: plusPulse 1.4s ease-in-out infinite;
  }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); font-family: 'Inter', system-ui, sans-serif; color: var(--text); }

  .g-panel {
    background: var(--surface);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 0 rgba(255,255,255,0.6), 0 2px 12px rgba(0,0,0,0.05);
  }
  .g-card {
    background: var(--surface);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    border: 1px solid var(--border);
    border-radius: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.85);
    transition: box-shadow 0.25s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s;
  }
  .g-card:hover {
    box-shadow: 0 8px 28px rgba(0,0,0,0.11), inset 0 1px 0 rgba(255,255,255,1);
    transform: translateY(-2px) scale(1.012);
    border-color: var(--border2);
  }

  .lesson-wrap { position: relative; cursor: default; }
  .lesson-wrap:hover .l-tip { opacity: 1; pointer-events: none; }

  .l-tip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%; transform: translateX(-50%);
    background: var(--surface);
    color: var(--text); border-radius: 12px; padding: 12px 16px;
    font-size: 11px; white-space: nowrap; min-width: 170px;
    opacity: 0; transition: opacity 0.15s;
    z-index: 50;
    box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06);
    border: 1px solid var(--border);
    pointer-events: none;
  }
  .l-tip::after {
    content: '';
    position: absolute;
    top: 100%; left: 50%; transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--surface);
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.06));
  }

  .cal-ev {
    position: absolute; overflow: hidden; box-sizing: border-box;
    transition: z-index 0s, box-shadow 0.2s, transform 0.2s;
  }
  .cal-ev:hover { z-index: 10; box-shadow: 0 6px 20px rgba(0,0,0,0.18) !important; transform: scaleX(1.06); }
  .cal-ev:hover .l-tip { opacity: 1; }

  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 14px; border-radius: 10px;
    font-size: 13px; font-weight: 500; cursor: pointer;
    border: none; background: transparent; width: 100%;
    color: #9ab5a5;
    transition: all 0.2s; text-align: left;
  }
  .nav-item:hover { background: #e8f5f8; color: #1a3a2a; }
  .nav-item.active {
    background: #1B6E7E;
    color: #fff; font-weight: 700;
    box-shadow: 0 4px 12px rgba(27,110,126,0.30);
  }

  .subj-badge {
    display: inline-block;
    transition: transform 0.3s;
    cursor: default;
  }
  .subj-badge:hover { transform: scale(1.1); }

  .filter-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 18px; border-radius: 24px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--surface);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    color: var(--text-muted);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
    transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
  }
  .filter-pill:hover {
    border-color: var(--border2);
    color: var(--text);
    transform: scale(1.05);
    box-shadow: 0 4px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1);
  }
  .filter-pill.has-filter {
    border-color: rgba(27,110,126,0.4);
    background: var(--accent-soft);
    color: var(--accent);
    box-shadow: 0 4px 14px rgba(27,110,126,0.12), inset 0 1px 0 rgba(255,255,255,0.8);
  }

  .f-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.32);
    backdrop-filter: blur(14px); z-index: 200;
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 80px;
    animation: fadeIn 0.15s ease;
  }
  .f-modal {
    background: var(--surface);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border2);
    border-radius: 24px; padding: 28px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.9);
    width: 400px; max-width: calc(100vw - 40px);
    animation: slideDown 0.22s cubic-bezier(0.16,1,0.3,1);
    color: var(--text);
  }

  .teacher-card {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    border-radius: 16px; cursor: pointer; text-align: left;
    background: var(--surface);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    border: 1px solid var(--border);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
    transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
    width: 100%;
  }
  .teacher-card:hover {
    border-color: var(--border2);
    box-shadow: 0 6px 20px rgba(27,110,126,0.10), inset 0 1px 0 rgba(255,255,255,1);
    transform: translateY(-2px) scale(1.015);
  }
  .tc-card {
    background: var(--surface);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    border: 1px solid var(--border);
    border-radius: 18px; overflow: hidden;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
    transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
    cursor: pointer;
  }
  .tc-card:hover {
    border-color: var(--border2);
    box-shadow: 0 8px 24px rgba(27,110,126,0.10), inset 0 1px 0 rgba(255,255,255,1);
    transform: translateY(-2px) scale(1.015);
  }

  .tl-block {
    position: absolute; display: flex; align-items: center;
    padding: 0 7px; overflow: hidden; cursor: default;
    transition: transform 0.2s, box-shadow 0.2s, z-index 0s;
    border-radius: 7px;
  }
  .tl-block:hover { transform: scaleY(1.12); z-index: 5; box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important; }
  .tl-block:hover .l-tip { opacity: 1; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(27,110,126,0.30); border-radius: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }

  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes slideDown { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }
  @keyframes spin { to { transform:rotate(360deg) } }
  @keyframes heroGradientShift {
    0%, 100% { background-position: 0% 50% }
    50%       { background-position: 100% 50% }
  }
  @keyframes floatOrb1 {
    0%,100% { transform: translateY(0px) translateX(0px) }
    50% { transform: translateY(-20px) translateX(12px) }
  }
  @keyframes floatOrb2 {
    0%,100% { transform: translateY(0px) }
    50% { transform: translateY(14px) }
  }
  @keyframes floatOrb3 {
    0%,100% { transform: translateY(0px) }
    50% { transform: translateY(-10px) }
  }
  @keyframes meshPulse {
    0%,100% { opacity: 0.2 }
    50% { opacity: 0.4 }
  }
`;
