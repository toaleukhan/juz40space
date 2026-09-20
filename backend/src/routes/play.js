const express = require('express');
const router = express.Router();
const hub = require('../games/hub');
const service = require('../games/service');
const { playJoinLimiter, playPinFailLimiter, playActionLimiter } = require('../middleware/security');

const { GameError } = service;

// Ойыншылар аккаунтсыз: олардың жеке идентификаторы — қосылғанда берілген
// құпия токен. Ол POST/GET-те X-Player-Token тақырыбымен, ал SSE-де
// (EventSource тақырып жібере алмайды) ?p= арқылы келеді.
const tokenOf = (req) => String(req.get('x-player-token') || req.query.p || '');

const handle = (fn) => (req, res) => fn(req, res).catch((err) => {
  if (err instanceof GameError) return res.status(err.status).json({ error: err.message, ...err.extra });
  console.error('Ойыншы маршруты қатесі:', err.message);
  res.status(500).json({ error: 'Сервер қатесі. Қайталап көріңіз.' });
});

// PIN-нің бар-жоғын тексеру (қосылу экранының 1-қадамы).
router.get('/pin/:pin', playPinFailLimiter, handle(async (req, res) => {
  res.json(await service.checkPin(req.params.pin));
}));

router.post('/join', playJoinLimiter, playPinFailLimiter, handle(async (req, res) => {
  const out = await service.joinGame({ pin: req.body?.pin, nickname: req.body?.nickname });
  res.status(201).json(out);
}));

// Бет жаңарғанда/қосылым үзілгенде ағымдағы күйді қайта алу.
router.get('/state', playActionLimiter, handle(async (req, res) => {
  const { view } = await service.playerSnapshot(tokenOf(req));
  res.json(view);
}));

router.post('/answer', playActionLimiter, handle(async (req, res) => {
  const out = await service.submitAnswer({
    token: tokenOf(req),
    questionIndex: Number(req.body?.questionIndex),
    choice: req.body?.choice,
  });
  res.json(out);
}));

router.get('/stream', playActionLimiter, async (req, res) => {
  try {
    const { player, view } = await service.playerSnapshot(tokenOf(req));
    if (view.status === 'kicked') return res.status(403).json({ error: 'Сіз ойыннан шығарылдыңыз', code: 'kicked' });
    hub.open(res);
    hub.addPlayer(player.session_id, player.id, res);
    hub.send(res, 'snapshot', view);
  } catch (err) {
    if (err instanceof GameError) return res.status(err.status).json({ error: err.message, ...err.extra });
    console.error('Ойыншы stream қатесі:', err.message);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

module.exports = router;
