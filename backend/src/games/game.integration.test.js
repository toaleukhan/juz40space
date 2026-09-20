import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Толық ойынды нақты Postgres + нақты HTTP + нақты SSE арқылы жүргізетін
// тест. Тек TEST_DATABASE_URL ЛОКАЛХОСТҚА қараса ғана жүреді — өндірістік
// базаға кездейсоқ тиіп кетпеуі үшін басқа хостқа мүлде қосылмайды.
//
//   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/juz40_test npx vitest run
const URL_ = process.env.TEST_DATABASE_URL || '';
const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(URL_);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!isLocal)('тірі викторина — толық ойын', () => {
  let express, jwt, pool, C, service, JWT_SECRET;
  let server, base;
  let host, other, admin;           // { id, token }
  const created = [];               // тазалау үшін user id-лер
  const streams = [];

  // ── көмекшілер ───────────────────────────────────────────────────
  async function api(method, path, { token, player, body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(player ? { 'X-Player-Token': player } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  // SSE-ні нақты fetch ағыны арқылы оқиды.
  function openStream(path) {
    const ctrl = new AbortController();
    const s = { events: [], status: null, ended: false, body: null };
    s.done = (async () => {
      const res = await fetch(base + path, { headers: { Accept: 'text/event-stream' }, signal: ctrl.signal });
      s.status = res.status;
      if (!res.ok) { s.body = await res.json().catch(() => null); s.ended = true; return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev = /^event: (.+)$/m.exec(chunk);
          const data = /^data: (.+)$/m.exec(chunk);
          if (ev && data) s.events.push({ event: ev[1], data: JSON.parse(data[1]) });
        }
      }
      s.ended = true;
    })().catch(() => { s.ended = true; });
    s.close = () => ctrl.abort();
    s.latest = () => s.events.filter((e) => e.event === 'snapshot').map((e) => e.data).pop();
    s.waitFor = async (pred, ms = 6000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        const hit = s.events.filter((e) => e.event === 'snapshot').map((e) => e.data).reverse().find(pred);
        if (hit) return hit;
        await wait(15);
      }
      throw new Error('SSE күту уақыты өтті. Соңғы күй: ' + JSON.stringify(s.latest()));
    };
    streams.push(s);
    return s;
  }

  const question = (over = {}) => ({
    kind: 'choice', prompt: 'Жарық жылдамдығы қанша?', options: ['3·10⁸ м/с', '3·10⁶ м/с', '340 м/с', '1 м/с'],
    correct: [0], timeLimit: 20, pointsMode: 'standard', ...over,
  });

  const quizBody = () => ({
    title: 'Оптика',
    subject: 'ФИЗ',
    questions: [
      question(),
      question({ prompt: 'Қайсысы электромагниттік толқын?', options: ['Жарық', 'Дыбыс', 'Радио', 'Толқын'], correct: [0, 2] }),
      { kind: 'truefalse', prompt: 'Вакуумда дыбыс таралады', correct: [1], timeLimit: 10, pointsMode: 'standard' },
    ],
  });

  async function newUser(role, name) {
    const u = `qz_${name}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const { rows } = await pool.query(
      `INSERT INTO users (username, password, full_name, role, subject, stream_id)
       VALUES ($1, 'x', $2, $3, 'ФИЗ', '01') RETURNING id`,
      [u, name, role]
    );
    created.push(rows[0].id);
    return { id: rows[0].id, token: jwt.sign({ id: rows[0].id, username: u, role, fullName: name }, JWT_SECRET) };
  }

  async function makeQuiz(who = host, body = quizBody()) {
    const r = await api('POST', '/api/quizzes', { token: who.token, body });
    expect(r.status).toBe(201);
    return r.body.id;
  }

  async function makeGame(quizId, who = host) {
    const r = await api('POST', '/api/games', { token: who.token, body: { quizId } });
    expect(r.status).toBe(201);
    return r.body; // { id, pin }
  }

  async function join(pin, nickname) {
    const r = await api('POST', '/api/play/join', { body: { pin, nickname } });
    return r;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_;
    express = require('express');
    jwt = require('jsonwebtoken');
    JWT_SECRET = require('../config/jwtSecret');
    pool = require('../config/db');
    C = require('./constants');
    service = require('./service');

    await require('../config/schema')();

    // Уақыттарды қысқартамыз, әйтпесе әр сұрақ 3+ секунд күтеді.
    C.LEAD_MS = 250;
    C.GRACE_MS = 250;

    const app = express();
    app.use(express.json());
    app.use('/api/quizzes', require('../routes/quizzes'));
    app.use('/api/games', require('../routes/games'));
    app.use('/api/play', require('../routes/play'));
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;

    host = await newUser('curator', 'host');
    other = await newUser('curator', 'other');
    admin = await newUser('admin', 'boss');
  });

  afterAll(async () => {
    streams.forEach((s) => s.close());
    if (created.length) await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [created]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  // ── құрастырушы ──────────────────────────────────────────────────
  describe('викторина құрастырушы', () => {
    it('requires a token', async () => {
      expect((await api('GET', '/api/quizzes')).status).toBe(401);
    });

    it('rejects an invalid quiz with a Kazakh, field-specific error', async () => {
      const bad = quizBody();
      bad.questions[1].correct = [];
      const r = await api('POST', '/api/quizzes', { token: host.token, body: bad });
      expect(r.status).toBe(400);
      expect(r.body.errors[0].field).toBe('questions[1].correct');
      expect(r.body.error).toContain('2-сұрақ');
    });

    it('creates, reads back, updates and deletes a quiz', async () => {
      const id = await makeQuiz();
      const got = await api('GET', `/api/quizzes/${id}`, { token: host.token });
      expect(got.body.questions).toHaveLength(3);
      expect(got.body.questions[1].correct).toEqual([0, 2]);

      const upd = quizBody();
      upd.title = 'Оптика 2';
      upd.questions.pop();
      expect((await api('PUT', `/api/quizzes/${id}`, { token: host.token, body: upd })).status).toBe(200);
      const again = await api('GET', `/api/quizzes/${id}`, { token: host.token });
      expect(again.body.title).toBe('Оптика 2');
      expect(again.body.questions).toHaveLength(2);

      expect((await api('DELETE', `/api/quizzes/${id}`, { token: host.token })).status).toBe(200);
      expect((await api('GET', `/api/quizzes/${id}`, { token: host.token })).status).toBe(404);
    });

    it('keeps physics text intact end to end (the global sanitiser would mangle it)', async () => {
      const body = quizBody();
      body.questions[0].prompt = 'Егер constant = 5 болса, ionization = ?';
      const id = await makeQuiz(host, body);
      const got = await api('GET', `/api/quizzes/${id}`, { token: host.token });
      expect(got.body.questions[0].prompt).toBe('Егер constant = 5 болса, ionization = ?');
    });

    it('hides a quiz from other users but not from an admin', async () => {
      const id = await makeQuiz();
      expect((await api('GET', `/api/quizzes/${id}`, { token: other.token })).status).toBe(403);
      expect((await api('PUT', `/api/quizzes/${id}`, { token: other.token, body: quizBody() })).status).toBe(403);
      expect((await api('GET', `/api/quizzes/${id}`, { token: admin.token })).status).toBe(200);
      const list = await api('GET', '/api/quizzes', { token: other.token });
      expect(list.body.find((q) => q.id === id)).toBeUndefined();
    });

    it('duplicates a quiz with its questions', async () => {
      const id = await makeQuiz();
      const dup = await api('POST', `/api/quizzes/${id}/duplicate`, { token: host.token });
      const got = await api('GET', `/api/quizzes/${dup.body.id}`, { token: host.token });
      expect(got.body.title).toContain('көшірме');
      expect(got.body.questions).toHaveLength(3);
    });
  });

  // ── толық ойын ───────────────────────────────────────────────────
  describe('бір ойын басынан аяғына дейін', () => {
    const st = {}; // ортақ күй

    it('creates a game with a 6-digit PIN and refuses to start it empty', async () => {
      st.quizId = await makeQuiz();
      st.game = await makeGame(st.quizId);
      expect(st.game.pin).toMatch(/^\d{6}$/);
      const r = await api('POST', `/api/games/${st.game.id}/start`, { token: host.token });
      expect(r.status).toBe(409);
    });

    it('gives two live games different PINs', async () => {
      const g2 = await makeGame(st.quizId);
      expect(g2.pin).not.toBe(st.game.pin);
      await api('POST', `/api/games/${g2.id}/end`, { token: host.token });
    });

    it('lets only the owner (or an admin) control the game', async () => {
      const id = st.game.id;
      expect((await api('GET', `/api/games/${id}`, { token: other.token })).status).toBe(403);
      expect((await api('POST', `/api/games/${id}/start`, { token: other.token })).status).toBe(403);
      expect((await api('GET', `/api/games/${id}`, { token: admin.token })).status).toBe(200);
    });

    it('validates the PIN and rejects unknown ones without leaking anything', async () => {
      expect((await api('GET', `/api/play/pin/${st.game.pin}`)).body.title).toBe('Оптика');
      expect((await api('GET', '/api/play/pin/000000')).status).toBe(404);
      expect((await api('GET', '/api/play/pin/abc')).status).toBe(404);
    });

    it('joins players, blocks duplicate and invalid nicknames', async () => {
      st.hostStream = openStream(`/api/games/${st.game.id}/stream?token=${host.token}`);
      await st.hostStream.waitFor((v) => v.status === 'lobby');

      const a = await join(st.game.pin, 'Аян');
      const b = await join(st.game.pin, 'Бек');
      const c = await join(st.game.pin, 'Сая');
      expect([a.status, b.status, c.status]).toEqual([201, 201, 201]);
      st.A = a.body.token; st.B = b.body.token; st.C = c.body.token;
      st.idA = a.body.player.id; st.idB = b.body.player.id; st.idC = c.body.player.id;

      // Регистрге тәуелсіз бірегей:
      const dup = await join(st.game.pin, 'аЯн');
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('nick_taken');
      expect((await join(st.game.pin, 'x')).status).toBe(400);
      expect((await join(st.game.pin, '<b>')).status).toBe(400);
      expect((await join('999999', 'Ғалым')).status).toBe(404);

      // Хост оларды тірі көреді (SSE арқылы, сұраусыз):
      const v = await st.hostStream.waitFor((x) => x.playerCount === 3);
      expect(v.players.map((p) => p.nickname).sort()).toEqual(['Аян', 'Бек', 'Сая'].sort());
    });

    it('never exposes the token hash or another player’s token', async () => {
      const v = st.hostStream.latest();
      expect(JSON.stringify(v)).not.toMatch(/token/i);
    });

    it('starts: everyone gets a countdown with NO question text, then the question opens together', async () => {
      st.pA = openStream(`/api/play/stream?p=${st.A}`);
      st.pB = openStream(`/api/play/stream?p=${st.B}`);
      st.pC = openStream(`/api/play/stream?p=${st.C}`);
      await st.pA.waitFor((v) => v.status === 'lobby');

      expect((await api('POST', `/api/games/${st.game.id}/start`, { token: host.token })).status).toBe(200);

      const cd = await st.pA.waitFor((v) => v.status === 'countdown');
      expect(cd.question).toBeNull();
      expect(cd.startsAt).toBeGreaterThan(cd.serverNow);
      expect((await st.hostStream.waitFor((v) => v.status === 'countdown')).question).toBeNull();

      const q = await st.pA.waitFor((v) => v.status === 'question');
      expect(q.question.prompt).toBe('Жарық жылдамдығы қанша?');
      expect(q.question.multi).toBe(false);
      expect(JSON.stringify(q)).not.toContain('"correct"');
      await st.pB.waitFor((v) => v.status === 'question');
      await st.pC.waitFor((v) => v.status === 'question');
      const hq = await st.hostStream.waitFor((v) => v.status === 'question');
      expect(hq.question).not.toHaveProperty('correct');
    });

    it('rejects an answer that arrives during the countdown', async () => {
      // Жаңа ойын: сұрақ әлі ашылмаған кезде жауап беру.
      const id = await makeQuiz();
      const g = await makeGame(id);
      const p = await join(g.pin, 'Ерте');
      await api('POST', `/api/games/${g.id}/start`, { token: host.token });
      const early = await api('POST', '/api/play/answer', { player: p.body.token, body: { questionIndex: 0, choice: [0] } });
      expect(early.status).toBe(409);
      expect(early.body.code).toBe('early');
      await api('POST', `/api/games/${g.id}/end`, { token: host.token });
    });

    it('refuses malformed answers', async () => {
      const ans = (choice, idx = 0) => api('POST', '/api/play/answer', { player: st.A, body: { questionIndex: idx, choice } });
      expect((await ans([0, 1])).status).toBe(400);      // бір дұрыс жауапты сұраққа екі таңдау
      expect((await ans([9])).status).toBe(400);
      expect((await ans([])).status).toBe(400);
      expect((await ans('0')).status).toBe(400);
      expect((await ans([0], 5)).body.code).toBe('closed'); // басқа сұрақ
      const r = await api('POST', '/api/play/answer', { body: { questionIndex: 0, choice: [0] } });
      expect(r.status).toBe(404);                        // токенсіз
    });

    it('accepts answers without revealing whether they were right, and blocks a second answer', async () => {
      const a = await api('POST', '/api/play/answer', { player: st.A, body: { questionIndex: 0, choice: [0] } });
      expect(a.status).toBe(200);
      expect(a.body).toEqual({ ok: true });              // «дұрыс па» деген ешнәрсе жоқ

      const again = await api('POST', '/api/play/answer', { player: st.A, body: { questionIndex: 0, choice: [1] } });
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('duplicate');

      const b = await api('POST', '/api/play/answer', { player: st.B, body: { questionIndex: 0, choice: [2] } });
      expect(b.status).toBe(200);
    });

    it('shows the host a live answered count but does NOT change any score mid-question', async () => {
      const v = await st.hostStream.waitFor((x) => x.status === 'question' && x.answeredCount === 2);
      expect(v.players.every((p) => p.score === 0)).toBe(true);
      expect(v.players.find((p) => p.id === st.idA).answered).toBe(true);
      expect(v.players.find((p) => p.id === st.idC).answered).toBe(false);
      const mine = await api('GET', '/api/play/state', { player: st.A });
      expect(mine.body.me.score).toBe(0);
      expect(mine.body.answered).toBe(true);
      expect(mine.body.myChoice).toEqual([0]);
    });

    it('closes the question the moment the last player answers, and only then awards points', async () => {
      await wait(120); // Сая Аяннан кейін жауап береді
      await api('POST', '/api/play/answer', { player: st.C, body: { questionIndex: 0, choice: [0] } });

      const rev = await st.hostStream.waitFor((v) => v.status === 'reveal');
      expect(rev.question.correct).toEqual([0]);
      expect(rev.distribution.counts).toEqual([2, 0, 1, 0]);
      expect(rev.distribution.correctCount).toBe(2);
      expect(rev.distribution.noAnswer).toBe(0);

      const byId = Object.fromEntries(rev.players.map((p) => [p.nickname, p]));
      expect(byId['Бек'].score).toBe(0);                            // қате жауап
      expect(byId['Аян'].score).toBeGreaterThanOrEqual(990);        // дәл секундтар ішінде
      expect(byId['Аян'].score).toBeLessThanOrEqual(1000);
      expect(byId['Аян'].score).toBeGreaterThanOrEqual(byId['Сая'].score); // ертерек жауап берген
      expect(byId['Аян'].streak).toBe(1);
      expect(byId['Бек'].streak).toBe(0);
    });

    it('tells each player their own result at reveal', async () => {
      const a = await st.pA.waitFor((v) => v.status === 'reveal');
      expect(a.result).toMatchObject({ answered: true, correct: true, correctOptions: [0], streak: 1 });
      const b = await st.pB.waitFor((v) => v.status === 'reveal');
      expect(b.result).toMatchObject({ answered: true, correct: false, points: 0 });
    });

    it('rejects a late answer once the question is closed', async () => {
      const late = await api('POST', '/api/play/answer', { player: st.C, body: { questionIndex: 0, choice: [0] } });
      expect(late.status).toBe(409);
    });

    it('ignores a stale “next” click instead of skipping a screen', async () => {
      const stale = await api('POST', `/api/games/${st.game.id}/advance`, {
        token: host.token, body: { expect: { status: 'question', index: 0 } },
      });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('stale');
      expect(st.hostStream.latest().status).toBe('reveal'); // өзгерген жоқ
    });

    it('survives five simultaneous “next” clicks: exactly one step, never a double skip', async () => {
      const calls = Array.from({ length: 5 }, () => api('POST', `/api/games/${st.game.id}/advance`, {
        token: host.token, body: { expect: { status: 'reveal', index: 0 } },
      }));
      const results = await Promise.all(calls);
      expect(results.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
      const v = await st.hostStream.waitFor((x) => x.status === 'leaderboard');
      expect(v.index).toBe(0);
      await wait(150);
      expect(st.hostStream.latest().status).toBe('leaderboard'); // әлі де бір қадам
    });

    it('builds a ranked leaderboard with movement', async () => {
      const v = st.hostStream.latest();
      expect(v.leaderboard.map((e) => e.rank)).toEqual([1, 2, 3]);
      expect(v.leaderboard[2].nickname).toBe('Бек');
      expect(v.leaderboard[0].delta).toBeGreaterThan(0);
      // Бірінші сұрақта «алдыңғы орын» жоқ: бәрі 0-ден бастады, ▲▼ көрсетілмейді.
      expect(v.leaderboard.every((e) => e.prevRank === null)).toBe(true);
      const me = await st.pB.waitFor((x) => x.status === 'leaderboard');
      expect(me.top.find((t) => t.isMe).nickname).toBe('Бек');
    });

    it('scores multi-answer questions all-or-nothing', async () => {
      await api('POST', `/api/games/${st.game.id}/advance`, {
        token: host.token, body: { expect: { status: 'leaderboard', index: 0 } },
      });
      const q = await st.pA.waitFor((v) => v.status === 'question' && v.index === 1);
      expect(q.question.multi).toBe(true);

      const ok = await api('POST', '/api/play/answer', { player: st.A, body: { questionIndex: 1, choice: [2, 0] } });
      const partial = await api('POST', '/api/play/answer', { player: st.B, body: { questionIndex: 1, choice: [0] } });
      expect([ok.status, partial.status]).toEqual([200, 200]);
    });

    it('lets the host kick a player mid-question, ends their stream, and blocks their answers', async () => {
      await api('POST', `/api/games/${st.game.id}/kick`, { token: host.token, body: { playerId: st.idC } });
      const gone = await st.pC.waitFor((v) => v.status === 'kicked');
      expect(gone.status).toBe('kicked');
      await wait(100);
      expect(st.pC.ended).toBe(true);

      const blocked = await api('POST', '/api/play/answer', { player: st.C, body: { questionIndex: 1, choice: [0] } });
      expect(blocked.status).toBe(403);
      expect((await api('GET', '/api/play/state', { player: st.C })).body.status).toBe('kicked');

      // А және Б жауап берді, Сая шығарылды — сұрақ өзі жабылады.
      const rev = await st.hostStream.waitFor((v) => v.status === 'reveal' && v.index === 1);
      expect(rev.playerCount).toBe(2);
      const byName = Object.fromEntries(rev.players.map((p) => [p.nickname, p]));
      expect(byName['Аян'].streak).toBe(2);                 // қатарынан екінші дұрыс
      expect(byName['Бек'].streak).toBe(0);                 // жартылай жауап — қате
      expect(rev.distribution.correctCount).toBe(1);
    });

    it('awards the streak bonus from the second correct answer', async () => {
      const rev = st.hostStream.latest();
      const ayan = rev.players.find((p) => p.nickname === 'Аян');
      const a = await st.pA.waitFor((v) => v.status === 'reveal' && v.index === 1);
      // 2-сұрақта Аян: базалық ~1000 + серия үстемесі 100.
      expect(a.result.points).toBeGreaterThanOrEqual(1090);
      expect(a.result.points).toBeLessThanOrEqual(1100);
      expect(ayan.score).toBeGreaterThan(2000);
    });

    it('locks the game against new joiners', async () => {
      await api('POST', `/api/games/${st.game.id}/lock`, { token: host.token, body: { locked: true } });
      expect((await join(st.game.pin, 'Кеш')).status).toBe(403);
      expect((await api('GET', `/api/play/pin/${st.game.pin}`)).status).toBe(403);
      await api('POST', `/api/games/${st.game.id}/lock`, { token: host.token, body: { locked: false } });
      const late = await join(st.game.pin, 'Кеш');           // ойын жүріп жатқанда да кіруге болады
      expect(late.status).toBe(201);
      st.D = late.body.token;
    });

    it('lets a latecomer join mid-game and play the next question', async () => {
      await api('POST', `/api/games/${st.game.id}/advance`, { token: host.token, body: { expect: { status: 'reveal', index: 1 } } });
      // Екінші рейтингте алдыңғы орын бар — қозғалыс есептеледі.
      const second = await st.hostStream.waitFor((x) => x.status === 'leaderboard' && x.index === 1);
      expect(second.leaderboard.every((e) => Number.isInteger(e.prevRank))).toBe(true);
      await api('POST', `/api/games/${st.game.id}/advance`, { token: host.token, body: { expect: { status: 'leaderboard', index: 1 } } });
      const q = await st.hostStream.waitFor((v) => v.status === 'question' && v.index === 2);
      expect(q.question.options).toEqual(['Дұрыс', 'Бұрыс']);
      const late = await api('GET', '/api/play/state', { player: st.D });
      expect(late.body.me.score).toBe(0);
      expect(late.body.status === 'countdown' || late.body.status === 'question').toBe(true);
    });

    it('a reconnecting player gets the full current state straight away', async () => {
      st.pA.close();
      const fresh = openStream(`/api/play/stream?p=${st.A}`);
      const v = await fresh.waitFor((x) => x.index === 2);
      expect(v.me.nickname).toBe('Аян');
      expect(v.me.score).toBeGreaterThan(2000);
    });

    it('finishes after the last leaderboard and produces final standings + results', async () => {
      await wait(300);
      await api('POST', '/api/play/answer', { player: st.A, body: { questionIndex: 2, choice: [1] } });
      await api('POST', '/api/play/answer', { player: st.B, body: { questionIndex: 2, choice: [1] } });
      await api('POST', '/api/play/answer', { player: st.D, body: { questionIndex: 2, choice: [0] } });
      await st.hostStream.waitFor((v) => v.status === 'reveal' && v.index === 2);
      await api('POST', `/api/games/${st.game.id}/advance`, { token: host.token, body: { expect: { status: 'reveal', index: 2 } } });
      await st.hostStream.waitFor((v) => v.status === 'leaderboard' && v.index === 2);
      await api('POST', `/api/games/${st.game.id}/advance`, { token: host.token, body: { expect: { status: 'leaderboard', index: 2 } } });

      const fin = await st.hostStream.waitFor((v) => v.status === 'finished');
      expect(fin.players.map((p) => p.rank)).toEqual([1, 2, 3]);
      expect(fin.players[0].nickname).toBe('Аян');
      expect(fin.question).toBeNull();

      const res = await api('GET', `/api/games/${st.game.id}/results`, { token: host.token });
      expect(res.status).toBe(200);
      expect(res.body.game.played).toBe(3);
      expect(res.body.players[0]).toMatchObject({ rank: 1, nickname: 'Аян', correctCount: 3, answeredCount: 3 });
      expect(res.body.players.find((p) => p.nickname === 'Кеш').answeredCount).toBe(1);
      expect(res.body.players.find((p) => p.nickname === 'Сая')).toBeUndefined(); // шығарылған кірмейді
      expect(res.body.questions).toHaveLength(3);
      // 1-сұрақта Аян мен Сая дұрыс, Бек қате жауап берген еді, бірақ Сая
      // шығарылды — оның жауабы статистикаға да кірмейді (ойыншылар тізімі
      // сияқты): қалғаны Аян ✓ және Бек ✗.
      expect(res.body.questions[0]).toMatchObject({ correctCount: 1, answeredCount: 2 });
      expect(res.body.players[0].answers).toHaveLength(3);
    });

    it('lists the game in history and only lets the owner delete a finished game', async () => {
      const list = await api('GET', '/api/games', { token: host.token });
      const row = list.body.find((g) => g.id === st.game.id);
      expect(row).toMatchObject({ status: 'finished', winner: 'Аян', pin: null });
      expect((await api('DELETE', `/api/games/${st.game.id}`, { token: other.token })).status).toBe(403);
      expect((await api('DELETE', `/api/games/${st.game.id}`, { token: host.token })).status).toBe(200);
    });

    it('frees the PIN of a finished game for reuse', async () => {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM pg_indexes WHERE indexname = 'uq_game_active_pin'`);
      expect(rows[0].n).toBe(1);
    });
  });

  // ── таймер өзі жабады ────────────────────────────────────────────
  describe('уақыт бітсе', () => {
    it('closes the question by itself, resets the streak of players who stayed silent', async () => {
      const id = await makeQuiz(host, { title: 'Таймер', questions: [question({ timeLimit: 5 }), question({ timeLimit: 5 })] });
      await pool.query('UPDATE quiz_questions SET time_limit = 1 WHERE quiz_id = $1', [id]);
      const g = await makeGame(id);
      const hs = openStream(`/api/games/${g.id}/stream?token=${host.token}`);
      const p = await join(g.pin, 'Үнсіз');
      await api('POST', `/api/games/${g.id}/start`, { token: host.token });

      const rev = await hs.waitFor((v) => v.status === 'reveal', 5000);
      expect(rev.distribution.noAnswer).toBe(1);
      expect(rev.distribution.answeredCount).toBe(0);
      expect(rev.players[0].score).toBe(0);
      const state = await api('GET', '/api/play/state', { player: p.body.token });
      expect(state.body.result).toMatchObject({ answered: false, correct: false, points: 0 });

      // Жауап бермеген ойыншы толық шекті «жұмсаған» деп есептеледі:
      const { rows } = await pool.query('SELECT total_ms FROM game_players WHERE id = $1', [p.body.player.id]);
      expect(rows[0].total_ms).toBe(1000);
      await api('POST', `/api/games/${g.id}/end`, { token: host.token });
    });

    it('rejects an answer that arrives after the grace period', async () => {
      const id = await makeQuiz(host, { title: 'Кеш', questions: [question({ timeLimit: 5 })] });
      await pool.query('UPDATE quiz_questions SET time_limit = 1 WHERE quiz_id = $1', [id]);
      const g = await makeGame(id);
      const p = await join(g.pin, 'Кешікті');
      const q = await join(g.pin, 'Тыныш');
      const hs = openStream(`/api/games/${g.id}/stream?token=${host.token}`);
      await api('POST', `/api/games/${g.id}/start`, { token: host.token });
      await hs.waitFor((v) => v.status === 'question');
      await wait(1000 + C.GRACE_MS + 150); // шек + жеңілдік өтті, бірақ таймер әлі жаппаған болуы мүмкін
      const r = await api('POST', '/api/play/answer', { player: p.body.token, body: { questionIndex: 0, choice: [0] } });
      expect(r.status).toBe(409);
      expect(['late', 'closed']).toContain(r.body.code);
      void q;
      await api('POST', `/api/games/${g.id}/end`, { token: host.token });
    });

    it('self-heals after a server restart: a stale open question is closed on the next read', async () => {
      const id = await makeQuiz(host, { title: 'Қайта қосу', questions: [question({ timeLimit: 5 }), question({ timeLimit: 5 })] });
      const g = await makeGame(id);
      const p = await join(g.pin, 'Тірі');
      await api('POST', `/api/games/${g.id}/start`, { token: host.token });
      // Сервер құлады делік: таймерсіз, бірақ уақыты баяғыда өтіп кеткен сұрақ базада «question» күйінде қалды.
      await pool.query(
        `UPDATE game_sessions SET question_starts_at = NOW() - INTERVAL '1 minute',
                                  question_ends_at   = NOW() - INTERVAL '30 seconds' WHERE id = $1`,
        [g.id]
      );
      const s = await api('GET', '/api/play/state', { player: p.body.token });
      expect(s.body.status).toBe('reveal');
      await api('POST', `/api/games/${g.id}/end`, { token: host.token });
    });
  });

  // ── жүктеме: бір сынып ───────────────────────────────────────────
  describe('40 ойыншы бір мезгілде', () => {
    it('joins, answers and is scored consistently under concurrency', async () => {
      const id = await makeQuiz(host, { title: 'Сынып', questions: [question({ timeLimit: 30 }), question({ timeLimit: 30 })] });
      const g = await makeGame(id);
      const hs = openStream(`/api/games/${g.id}/stream?token=${host.token}`);
      await hs.waitFor((v) => v.status === 'lobby');

      const N = 40;
      const joins = await Promise.all(Array.from({ length: N }, (_, i) => join(g.pin, `Оқушы ${i + 1}`)));
      expect(joins.every((j) => j.status === 201)).toBe(true);
      const tokens = joins.map((j) => j.body.token);
      await hs.waitFor((v) => v.playerCount === N);

      await api('POST', `/api/games/${g.id}/start`, { token: host.token });
      await hs.waitFor((v) => v.status === 'question');

      // 40 адам бір мезгілде басады: жартысы дұрыс, жартысы қате.
      const answers = await Promise.all(tokens.map((t, i) =>
        api('POST', '/api/play/answer', { player: t, body: { questionIndex: 0, choice: [i % 2 === 0 ? 0 : 1] } })));
      expect(answers.every((a) => a.status === 200)).toBe(true);

      const rev = await hs.waitFor((v) => v.status === 'reveal');
      expect(rev.distribution.answeredCount).toBe(N);
      expect(rev.distribution.correctCount).toBe(N / 2);
      expect(rev.distribution.counts[0]).toBe(N / 2);
      expect(new Set(rev.players.map((p) => p.rank)).size).toBe(N); // бірде-бір ортақ орын жоқ
      expect(rev.players.filter((p) => p.score > 0)).toHaveLength(N / 2);

      // Ұпайлар базада бір рет қана есептелген:
      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS n, SUM(points)::int AS pts FROM game_answers WHERE session_id = $1', [g.id]);
      const { rows: sc } = await pool.query('SELECT SUM(score)::int AS s FROM game_players WHERE session_id = $1', [g.id]);
      expect(rows[0].n).toBe(N);
      expect(sc[0].s).toBe(rows[0].pts);

      await api('POST', `/api/games/${g.id}/end`, { token: host.token });
    }, 30000);

    it('never lets a class of 40 behind one IP trip the global limiter', async () => {
      // /api/play жалпы лимиттен тыс: 40 қосылу + 40 күй сұрауы бір IP-ден өтеді.
      const id = await makeQuiz();
      const g = await makeGame(id);
      const js = await Promise.all(Array.from({ length: 40 }, (_, i) => join(g.pin, `Мектеп ${i + 1}`)));
      const states = await Promise.all(js.map((j) => api('GET', '/api/play/state', { player: j.body.token })));
      expect(js.every((j) => j.status === 201)).toBe(true);
      expect(states.every((s) => s.status === 200)).toBe(true);
      await api('POST', `/api/games/${g.id}/end`, { token: host.token });
    }, 30000);
  });

  // ── жанама жағдайлар ─────────────────────────────────────────────
  describe('жанама жағдайлар', () => {
    it('ends a game mid-question and still counts that question’s points', async () => {
      const id = await makeQuiz();
      const g = await makeGame(id);
      const p = await join(g.pin, 'Соңы');
      await join(g.pin, 'Күтуші');
      const hs = openStream(`/api/games/${g.id}/stream?token=${host.token}`);
      await api('POST', `/api/games/${g.id}/start`, { token: host.token });
      await hs.waitFor((v) => v.status === 'question');
      await api('POST', '/api/play/answer', { player: p.body.token, body: { questionIndex: 0, choice: [0] } });
      await api('POST', `/api/games/${g.id}/end`, { token: host.token });
      const fin = await hs.waitFor((v) => v.status === 'finished');
      expect(fin.players[0]).toMatchObject({ nickname: 'Соңы' });
      expect(fin.players[0].score).toBeGreaterThan(900);
    });

    it('cannot delete a running game', async () => {
      const g = await makeGame(await makeQuiz());
      expect((await api('DELETE', `/api/games/${g.id}`, { token: host.token })).status).toBe(409);
      await api('POST', `/api/games/${g.id}/end`, { token: host.token });
    });

    it('sweeps abandoned games', async () => {
      const g = await makeGame(await makeQuiz());
      await pool.query(`UPDATE game_sessions SET updated_at = NOW() - INTERVAL '7 hours' WHERE id = $1`, [g.id]);
      expect(await service.closeStale()).toBeGreaterThanOrEqual(1);
      const { rows } = await pool.query('SELECT status FROM game_sessions WHERE id = $1', [g.id]);
      expect(rows[0].status).toBe('finished');
    });

    it('keeps a running game unchanged when the quiz is edited or deleted afterwards', async () => {
      const id = await makeQuiz();
      const g = await makeGame(id);
      const p = await join(g.pin, 'Тұрақты');
      await api('DELETE', `/api/quizzes/${id}`, { token: host.token });
      await api('POST', `/api/games/${g.id}/start`, { token: host.token });
      const s = await api('GET', `/api/games/${g.id}`, { token: host.token });
      expect(s.status).toBe(200);
      expect(s.body.total).toBe(3);
      void p;
      await api('POST', `/api/games/${g.id}/end`, { token: host.token });
    });
  });
});
