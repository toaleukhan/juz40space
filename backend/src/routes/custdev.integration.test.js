import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// CustDev маршруттарын нақты Postgres + нақты HTTP арқылы тексереді.
// Тек TEST_DATABASE_URL ЛОКАЛХОСТҚА қараса ғана жүреді — game.integration.test.js-пен бірдей ереже.
//
//   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/juz40_test npx vitest run
const URL_ = process.env.TEST_DATABASE_URL || '';
const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(URL_);

describe.skipIf(!isLocal)('CustDev — раунд, сұхбат, протокол', () => {
  let express, jwt, pool, JWT_SECRET;
  let server, base;
  let admin, curator, otherAdmin;
  const created = [];
  const realFetch = global.fetch;

  async function api(method, path, { token, body } = {}) {
    const res = await realFetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  async function newUser(role, name) {
    const u = `cd_${name}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const { rows } = await pool.query(
      `INSERT INTO users (username, password, full_name, role, subject, stream_id)
       VALUES ($1, 'x', $2, $3, 'ФИЗ', '01') RETURNING id`,
      [u, name, role]
    );
    created.push(rows[0].id);
    return { id: rows[0].id, token: jwt.sign({ id: rows[0].id, username: u, role, fullName: name }, JWT_SECRET) };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_;
    express = require('express');
    jwt = require('jsonwebtoken');
    JWT_SECRET = require('../config/jwtSecret');
    pool = require('../config/db');

    await require('../config/schema')();

    const app = express();
    app.use(express.json());
    app.use('/api/custdev', require('./custdev'));

    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;

    admin = await newUser('admin', 'sapa');
    otherAdmin = await newUser('admin', 'basqa');
    curator = await newUser('curator', 'kurator');
  }, 30000);

  afterAll(async () => {
    server?.close();
    if (created.length) await pool.query('DELETE FROM users WHERE id = ANY($1)', [created]);
    await pool.end();
  });

  afterEach(() => { global.fetch = realFetch; });

  it('куратор (admin емес) рұқсатсыз — 403', async () => {
    const r = await api('POST', '/api/custdev/rounds', { token: curator.token, body: { title: 'X' } });
    expect(r.status).toBe(403);
  });

  it('токенсіз — 401', async () => {
    const r = await api('GET', '/api/custdev/rounds');
    expect(r.status).toBe(401);
  });

  it('/roles сұрақ банкін рөл бойынша қайтарады', async () => {
    const r = await api('GET', '/api/custdev/roles', { token: admin.token });
    expect(r.status).toBe(200);
    const byId = Object.fromEntries(r.body.map((x) => [x.id, x]));
    expect(byId.student.questions).toHaveLength(10);
    expect(byId.parent.questions).toHaveLength(9);
    expect(byId.curator.questions).toHaveLength(10);
  });

  it('раунд жасайды, атаусыз 400 қайтарады', async () => {
    const bad = await api('POST', '/api/custdev/rounds', { token: admin.token, body: { title: '  ' } });
    expect(bad.status).toBe(400);

    const r = await api('POST', '/api/custdev/rounds', { token: admin.token, body: { title: 'CUSTDEV 0.1', note: 'сөйлесу аясы' } });
    expect(r.status).toBe(201);
    expect(r.body.title).toBe('CUSTDEV 0.1');
    expect(r.body.id).toBeGreaterThan(0);
  });

  it('кез келген admin бәрін көреді (quizzes/games-тегі сияқты ортақ рұқсат)', async () => {
    const mine = await api('POST', '/api/custdev/rounds', { token: admin.token, body: { title: 'Ортақ раунд' } });
    const otherList = await api('GET', '/api/custdev/rounds', { token: otherAdmin.token });
    expect(otherList.body.some((x) => x.id === mine.body.id)).toBe(true);
    // ал куратор (admin емес) тізімге мүлде қатынай алмайды — жоғарыдағы 403 тесті осыны растайды
  });

  it('толық сценарий: раунд → сұхбат → генерация → тексеру → экспорт', async () => {
    const round = await api('POST', '/api/custdev/rounds', { token: admin.token, body: { title: 'CUSTDEV толық сценарий' } });
    expect(round.status).toBe(201);
    const roundId = round.body.id;

    // қате рөл — 400
    const badRole = await api('POST', `/api/custdev/rounds/${roundId}/sessions`, {
      token: admin.token, body: { role: 'director', respondentName: 'Аты' },
    });
    expect(badRole.status).toBe(400);

    const created_ = await api('POST', `/api/custdev/rounds/${roundId}/sessions`, {
      token: admin.token,
      body: {
        role: 'student', respondentName: 'Тест Оқушы', groupCode: 'ФИЗ-01', curatorName: 'Тест Куратор',
        recordingRef: 'abc-defg-hij (2026-09-01 10:00 GMT+5)',
        transcript: 'Оқушы: мен грантқа түсу үшін тіркелдім. Куратор жақсы көмектеседі.',
      },
    });
    expect(created_.status).toBe(201);
    expect(created_.body.status).toBe('draft');
    const sessionId = created_.body.id;

    // Gemini желісін бекітеміз: жауаптар санын дәл 10-ға (оқушы сұрағы) сай береміз.
    global.fetch = async (url) => {
      expect(String(url)).toContain('generativelanguage.googleapis.com');
      const answers = Array.from({ length: 10 }, (_, i) => (i === 0 ? 'Грантқа түсу үшін тіркелген дейді.' : '-'));
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answers }) }] } }] }),
      };
    };
    process.env.GEMINI_API_KEY = 'test-key';

    const gen = await api('POST', `/api/custdev/sessions/${sessionId}/generate`, { token: admin.token });
    expect(gen.status).toBe(200);
    expect(gen.body.status).toBe('ready');
    expect(gen.body.protocol).toHaveLength(10);
    expect(gen.body.protocol[0].answer).toBe('Грантқа түсу үшін тіркелген дейді.');
    expect(gen.body.protocol[9].answer).toBe('-');

    // толық оқу
    const full = await api('GET', `/api/custdev/sessions/${sessionId}`, { token: admin.token });
    expect(full.body.transcript).toContain('грантқа');
    expect(full.body.protocol).toHaveLength(10);

    // раунд тізімінде сұхбат саны мен ready саны көрінеді
    const roundView = await api('GET', `/api/custdev/rounds/${roundId}`, { token: admin.token });
    expect(roundView.body.sessions).toHaveLength(1);
    expect(roundView.body.sessions[0].status).toBe('ready');

    // экспорт мәтінінде N. Сұрақ:/Жауап: пары бар
    const exp = await api('GET', `/api/custdev/rounds/${roundId}/export`, { token: admin.token });
    expect(exp.status).toBe(200);
    expect(exp.body.text).toContain('ОҚУШЫЛАР');
    expect(exp.body.text).toContain('1. Сұрақ:');
    expect(exp.body.text).toContain('Жауап: Грантқа түсу үшін тіркелген дейді.');

    // қолмен түзету
    const patched = await api('PUT', `/api/custdev/sessions/${sessionId}`, {
      token: admin.token,
      body: { protocol: full.body.protocol.map((qa, i) => ({ ...qa, answer: i === 0 ? 'Қолмен түзетілген жауап' : qa.answer })) },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.protocol[0].answer).toBe('Қолмен түзетілген жауап');

    // өшіру
    const del = await api('DELETE', `/api/custdev/sessions/${sessionId}`, { token: admin.token });
    expect(del.status).toBe(200);
    const gone = await api('GET', `/api/custdev/sessions/${sessionId}`, { token: admin.token });
    expect(gone.status).toBe(404);
  });

  it('GEMINI_API_KEY жоқ болса — 503, статус error, транскрипт сақталып қалады', async () => {
    delete process.env.GEMINI_API_KEY;
    const round = await api('POST', '/api/custdev/rounds', { token: admin.token, body: { title: 'Кілтсіз сценарий' } });
    const s = await api('POST', `/api/custdev/rounds/${round.body.id}/sessions`, {
      token: admin.token,
      body: { role: 'parent', respondentName: 'Ата-ана', transcript: 'бір сөз де жеткілікті' },
    });
    const gen = await api('POST', `/api/custdev/sessions/${s.body.id}/generate`, { token: admin.token });
    expect(gen.status).toBe(503);
    const after = await api('GET', `/api/custdev/sessions/${s.body.id}`, { token: admin.token });
    expect(after.body.status).toBe('error');
    expect(after.body.transcript).toBe('бір сөз де жеткілікті');
  });

  it('транскрипт бос болса, генерация желіге шықпай 400 қайтарады', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    let called = false;
    global.fetch = async () => { called = true; throw new Error('шақырылмауы керек'); };
    const round = await api('POST', '/api/custdev/rounds', { token: admin.token, body: { title: 'Бос транскрипт' } });
    const s = await api('POST', `/api/custdev/rounds/${round.body.id}/sessions`, {
      token: admin.token, body: { role: 'curator', respondentName: 'К.' },
    });
    const gen = await api('POST', `/api/custdev/sessions/${s.body.id}/generate`, { token: admin.token });
    expect(gen.status).toBe(400);
    expect(called).toBe(false);
  });

  it('модель JSON емес қайтарса — 502, статус error', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'бұл JSON емес мәтін' }] } }] }),
    });
    const round = await api('POST', '/api/custdev/rounds', { token: admin.token, body: { title: 'Бүлінген жауап' } });
    const s = await api('POST', `/api/custdev/rounds/${round.body.id}/sessions`, {
      token: admin.token, body: { role: 'curator', respondentName: 'К.', transcript: 'транскрипт' },
    });
    const gen = await api('POST', `/api/custdev/sessions/${s.body.id}/generate`, { token: admin.token });
    expect(gen.status).toBe(502);
    const after = await api('GET', `/api/custdev/sessions/${s.body.id}`, { token: admin.token });
    expect(after.body.status).toBe('error');
    expect(after.body.errorMessage).toBeTruthy();
  });

  describe('/fetch-transcript — раундқа/сұхбатқа тәуелсіз', () => {
    it('жазба сілтемесі бос болса — 400', async () => {
      const r = await api('POST', '/api/custdev/fetch-transcript', { token: admin.token, body: {} });
      expect(r.status).toBe(400);
    });

    it('Drive сілтемесі емес мәтінге (мыс. ескі meet-код) — 400', async () => {
      const r = await api('POST', '/api/custdev/fetch-transcript', {
        token: admin.token, body: { recordingRef: 'abc-defg-hij (2026-08-28 17:57 GMT+5)' },
      });
      expect(r.status).toBe(400);
      expect(r.body.error).toMatch(/Drive/);
    });

    it('GOOGLE_SERVICE_ACCOUNT_JSON_CUSTDEV орнатылмаса — 503, Drive-қа шықпайды', async () => {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CUSTDEV;
      let called = false;
      global.fetch = async () => { called = true; throw new Error('шақырылмауы керек'); };
      const r = await api('POST', '/api/custdev/fetch-transcript', {
        token: admin.token, body: { recordingRef: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234/view' },
      });
      expect(r.status).toBe(503);
      expect(called).toBe(false);
    });

    it('куратор (admin емес) — 403', async () => {
      const r = await api('POST', '/api/custdev/fetch-transcript', {
        token: curator.token, body: { recordingRef: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234/view' },
      });
      expect(r.status).toBe(403);
    });
  });
});
