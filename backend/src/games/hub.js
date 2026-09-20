const C = require('./constants');
const views = require('./views');

// Нақты уақыттағы тарату (SSE). WebSocket емес, себебі: бағыт біржақты
// (сервер → клиент), ал клиенттен келетін нәрсенің бәрі (жауап, басқару)
// қарапайым POST. SSE — қарапайым HTTPS, ол Vercel CSP-дегі бар
// connect-src ережесіне түседі, браузер өзі қайта қосылады, ал сервер
// қайта қосылғанда клиент толық күйді қайтадан алады.
//
// Хабтың жадындағы деректер тек СОКЕТТЕР мен ТАЙМЕРЛЕР. Ойынның шынайы
// күйі — толығымен базада, сондықтан сервер қайта іске қосылса ештеңе
// жоғалмайды: клиенттер қайта қосылып, күйді базадан оқиды.

// sessionId → { host:Set<res>, players:Map<playerId,Set<res>>, armedKey, openTimer, closeTimer, hostTimer }
const rooms = new Map();

const service = () => require('./service'); // циклдік тәуелділіктен қашу

function room(sessionId) {
  let r = rooms.get(sessionId);
  if (!r) {
    r = { host: new Set(), players: new Map(), armedKey: null, openTimer: null, closeTimer: null, hostTimer: null };
    rooms.set(sessionId, r);
  }
  return r;
}

function prune(sessionId) {
  const r = rooms.get(sessionId);
  if (!r) return;
  const idle = r.host.size === 0 && r.players.size === 0 && !r.openTimer && !r.closeTimer && !r.hostTimer;
  if (idle) rooms.delete(sessionId);
}

// ── SSE ─────────────────────────────────────────────────────────────
function open(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Прокси (Railway/nginx) жауапты буферлеп, оқиғаларды ұстап қалмасын.
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
}

function send(res, event, data) {
  if (res.writableEnded || res.destroyed) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch { /* сокет жабылып қалған — 'close' оқиғасы тазалайды */ }
}

let heartbeat = null;
function ensureHeartbeat() {
  if (heartbeat) return;
  // Бос қосылым жүрсе, прокси оны 60 секундта үзеді — 20 сек сайын
  // түсініктеме жолын жіберіп тірі ұстаймыз.
  heartbeat = setInterval(() => {
    for (const r of rooms.values()) {
      const ping = (res) => { if (!res.writableEnded && !res.destroyed) { try { res.write(': ping\n\n'); } catch { /* жабылған */ } } };
      r.host.forEach(ping);
      r.players.forEach((set) => set.forEach(ping));
    }
  }, 20000);
  if (heartbeat.unref) heartbeat.unref();
}

function addHost(sessionId, res) {
  ensureHeartbeat();
  const r = room(sessionId);
  r.host.add(res);
  res.on('close', () => { r.host.delete(res); prune(sessionId); });
}

function addPlayer(sessionId, playerId, res) {
  ensureHeartbeat();
  const r = room(sessionId);
  if (!r.players.has(playerId)) r.players.set(playerId, new Set());
  r.players.get(playerId).add(res);
  res.on('close', () => {
    const set = r.players.get(playerId);
    if (set) { set.delete(res); if (set.size === 0) r.players.delete(playerId); }
    prune(sessionId);
  });
}

// ── тарату ──────────────────────────────────────────────────────────
// Әр клиентке ӨЗ көрінісі жіберіледі: ойыншыға дұрыс жауап сұрақ біткенге
// дейін бармайды. Күйді базадан бір рет оқып, барлығына сол модельден
// көрініс жасаймыз.
async function broadcast(sessionId, { hostOnly = false } = {}) {
  const r = rooms.get(sessionId);
  if (!r) return;
  if (r.host.size === 0 && (hostOnly || r.players.size === 0)) return;

  try {
    const model = await service().loadModel(sessionId);
    if (!model) return;
    const now = Date.now();

    if (r.host.size) {
      const hv = views.hostView(model, now);
      r.host.forEach((res) => send(res, 'snapshot', hv));
    }
    if (hostOnly) return;

    for (const [playerId, set] of r.players) {
      const pv = views.playerView(model, playerId, now);
      set.forEach((res) => send(res, 'snapshot', pv));
      // Шығарылған ойыншының қосылымын жабамыз — ол қайта қосылмасын.
      if (pv.status === 'kicked') set.forEach((res) => { try { res.end(); } catch { /* жабылған */ } });
    }
  } catch (err) {
    console.error('Викторина broadcast қатесі:', err.message);
  }
}

// Ойыншы қосылғанда/жауап бергенде хостқа жаңарту жіберу. 100 адам бір
// секундта жауап берсе, әрқайсысына бөлек snapshot жібермей, 150 мс
// ішіндегісін біріктіреміз.
function pokeHost(sessionId) {
  const r = rooms.get(sessionId);
  if (!r || r.host.size === 0 || r.hostTimer) return;
  r.hostTimer = setTimeout(() => {
    r.hostTimer = null;
    broadcast(sessionId, { hostOnly: true }).finally(() => prune(sessionId));
  }, 150);
}

// ── таймерлер ───────────────────────────────────────────────────────
function clearTimers(r) {
  if (r.openTimer) { clearTimeout(r.openTimer); r.openTimer = null; }
  if (r.closeTimer) { clearTimeout(r.closeTimer); r.closeTimer = null; }
}

// Сұрақ жүріп жатқанда екі таймер қояды: (1) кері санақ біткенде
// сұрақ мәтінін бәріне жіберу, (2) уақыт біткенде сұрақты жабу.
// session — normalizeSession() нәтижесі. Идемпотентті: сол сұрақ үшін
// қайта шақырса, ештеңе өзгертпейді.
function arm(session) {
  const r = room(session.id);
  const key = session.status === 'question' ? `${session.currentIndex}:q` : null;
  if (r.armedKey === key) return;

  clearTimers(r);
  r.armedKey = key;
  if (!key) { prune(session.id); return; }

  const now = Date.now();
  if (session.startsAtMs > now) {
    r.openTimer = setTimeout(() => { r.openTimer = null; broadcast(session.id); }, session.startsAtMs - now + 25);
  }
  const closeIn = Math.max(0, session.endsAtMs + C.GRACE_MS - now);
  r.closeTimer = setTimeout(() => {
    r.closeTimer = null;
    service().closeQuestion(session.id, session.currentIndex)
      .catch((err) => console.error('Сұрақты жабу қатесі:', err.message))
      .finally(() => prune(session.id));
  }, closeIn);
}

module.exports = { open, send, addHost, addPlayer, broadcast, pokeHost, arm };
