const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const hub = require('../games/hub');
const service = require('../games/service');

const { GameError } = service;

// GameError → қазақша қате + сәйкес HTTP коды. Қалғаны — 500.
const handle = (fn) => (req, res) => fn(req, res).catch((err) => {
  if (err instanceof GameError) return res.status(err.status).json({ error: err.message, ...err.extra });
  console.error('Ойын маршруты қатесі:', err.message);
  res.status(500).json({ error: 'Сервер қатесі: ' + err.message });
});

const sid = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new GameError(404, 'Ойын табылмады');
  return id;
};

// ── ойын құру ───────────────────────────────────────────────────────
router.post('/', auth, handle(async (req, res) => {
  const quizId = Number(req.body.quizId);
  if (!Number.isInteger(quizId)) throw new GameError(400, 'Викторинаны таңдаңыз');

  const { rows } = await pool.query('SELECT owner_id FROM quizzes WHERE id = $1', [quizId]);
  if (!rows.length) throw new GameError(404, 'Викторина табылмады');
  if (rows[0].owner_id !== req.user.id && req.user.role !== 'admin') {
    throw new GameError(403, 'Бұл викторина сізге тиесілі емес');
  }

  const game = await service.createGame({ hostId: req.user.id, quizId, settings: req.body.settings });
  res.status(201).json(game);
}));

// ── тарих ───────────────────────────────────────────────────────────
router.get('/', auth, handle(async (req, res) => {
  res.json(await service.listGames(req.user));
}));

// ── хост көрінісі ───────────────────────────────────────────────────
router.get('/:id', auth, handle(async (req, res) => {
  res.json(await service.hostSnapshot(sid(req), req.user));
}));

// SSE: <EventSource> Authorization header жібере алмайды, сондықтан
// токен query арқылы келеді — auth middleware мұны қолдайды.
router.get('/:id/stream', auth, async (req, res) => {
  try {
    const id = sid(req);
    const view = await service.hostSnapshot(id, req.user); // иелік + әзірлік тексеріледі
    hub.open(res);
    hub.addHost(id, res);
    hub.send(res, 'snapshot', view);
  } catch (err) {
    if (err instanceof GameError) return res.status(err.status).json({ error: err.message });
    console.error('Хост stream қатесі:', err.message);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

router.post('/:id/start', auth, handle(async (req, res) => {
  await service.startGame(sid(req), req.user);
  res.json({ success: true });
}));

router.post('/:id/advance', auth, handle(async (req, res) => {
  const expect = req.body?.expect && typeof req.body.expect === 'object'
    ? { status: String(req.body.expect.status), index: Number(req.body.expect.index) }
    : null;
  await service.advance(sid(req), req.user, expect);
  res.json({ success: true });
}));

router.post('/:id/end', auth, handle(async (req, res) => {
  await service.endGame(sid(req), req.user);
  res.json({ success: true });
}));

router.post('/:id/kick', auth, handle(async (req, res) => {
  const playerId = Number(req.body?.playerId);
  if (!Number.isInteger(playerId)) throw new GameError(400, 'Ойыншы көрсетілмеген');
  await service.kickPlayer(sid(req), req.user, playerId);
  res.json({ success: true });
}));

router.post('/:id/lock', auth, handle(async (req, res) => {
  await service.setLocked(sid(req), req.user, !!req.body?.locked);
  res.json({ success: true });
}));

router.get('/:id/results', auth, handle(async (req, res) => {
  res.json(await service.getResults(sid(req), req.user));
}));

router.delete('/:id', auth, handle(async (req, res) => {
  await service.deleteGame(sid(req), req.user);
  res.json({ success: true });
}));

module.exports = router;
