import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// TikTok маршруттарын нақты Postgres + нақты HTTP арқылы тексереді; Apify
// мен Gemini ауыстырылады (желіге шықпайды, ақша жұмсалмайды).
//   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/juz40_test npx vitest run
const URL_ = process.env.TEST_DATABASE_URL || '';
const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(URL_);

describe.skipIf(!isLocal)('TikTok жарысы — бөлім, синхрон, рейтинг, жюри, анализ', () => {
  let pool, server, base, media, admin, apify, gemini;
  const users = [];
  const realFetch = global.fetch;

  async function api(method, path, { token, body } = {}) {
    const res = await realFetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_;
    const express = require('express');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = require('../config/jwtSecret');
    pool = require('../config/db');
    await require('../config/schema')();
    await pool.query('TRUNCATE tiktok_departments, tiktok_syncs, tiktok_analyses RESTART IDENTITY CASCADE');

    const mk = async (role) => {
      const u = `tt_${role}_${Date.now()}`;
      const { rows } = await pool.query(
        `INSERT INTO users (username, password, full_name, role, subject) VALUES ($1,'x',$1,$2,'MEDIA') RETURNING id`, [u, role]
      );
      users.push(rows[0].id);
      return jwt.sign({ id: rows[0].id, username: u, role }, JWT_SECRET);
    };
    media = await mk('media');
    admin = await mk('admin');

    apify = require('../tiktok/apify');
    gemini = require('../custdev/gemini');

    const app = express();
    app.use(express.json());
    app.use('/api/tiktok', require('./tiktok'));
    app.use('/api/st-recordings', require('./stRecordings'));
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    server?.close();
    await pool.query('TRUNCATE tiktok_departments, tiktok_syncs, tiktok_analyses RESTART IDENTITY CASCADE');
    if (users.length) await pool.query('DELETE FROM users WHERE id = ANY($1)', [users]);
    await pool.end();
  });

  it('admin-ге де, басқа бетке де жол жоқ', async () => {
    expect((await api('GET', '/api/tiktok/overview', { token: admin })).status).toBe(403);
    expect((await api('GET', '/api/st-recordings', { token: media })).status).toBe(403);
  });

  it('толық айналым', async () => {
    const fiz = await api('POST', '/api/tiktok/departments', { token: media, body: { name: 'Физика', username: '@juz40_fiz', teamTag: '#juz40_fizika' } });
    expect(fiz.status).toBe(201);
    expect(fiz.body).toMatchObject({ username: 'juz40_fiz', teamTag: 'juz40_fizika' });
    await api('POST', '/api/tiktok/departments', { token: media, body: { name: 'Математика', username: 'juz40_mat' } });
    const team = await api('POST', '/api/tiktok/departments', { token: media, body: { isTeamAccount: true, username: 'juz40_team' } });
    expect(team.status).toBe(201);
    expect((await api('POST', '/api/tiktok/departments', { token: media, body: { name: 'X', username: 'juz40_mat' } })).status).toBe(400);

    vi.spyOn(apify, 'startRun').mockResolvedValue({ runId: 'run1', datasetId: 'ds1', status: 'READY' });
    const getRun = vi.spyOn(apify, 'getRun').mockResolvedValue({ status: 'RUNNING', datasetId: 'ds1' });
    const item = (id, user, iso, views, extra = {}) => ({
      id, authorMeta: { name: user }, createTimeISO: iso, playCount: views, diggCount: 10, commentCount: 1, shareCount: 1,
      videoMeta: { duration: 20 }, musicMeta: { musicOriginal: false }, text: 'видео', hashtags: [], ...extra,
    });
    vi.spyOn(apify, 'fetchItems').mockResolvedValue([
      item('1', 'juz40_fiz', '2026-09-01T06:00:00Z', 1200, { hashtags: [{ name: 'juz40_life' }], text: 'бірге @juz40_mat' }),
      item('2', 'juz40_fiz', '2026-09-02T06:00:00Z', 600),
      item('2', 'juz40_fiz', '2026-09-02T06:00:00Z', 600), // қайталанған
      item('3', 'juz40_mat', '2026-09-03T06:00:00Z', 300),
      item('4', 'juz40_team', '2026-09-04T06:00:00Z', 5000, { hashtags: [{ name: 'juz40_fizika' }] }),
      item('5', 'juz40_mat', '2026-08-31T06:00:00Z', 9999), // басқа ай
      item('6', 'stranger', '2026-09-05T06:00:00Z', 9999),  // тізімде жоқ
    ]);

    const sync = await api('POST', '/api/tiktok/sync', { token: media, body: { month: '2026-09' } });
    expect(sync.status).toBe(201);
    const [users_, from, to] = apify.startRun.mock.calls[0];
    expect([...users_].sort()).toEqual(['juz40_fiz', 'juz40_mat', 'juz40_team']);
    expect([from, to]).toEqual(['2026-09-01', '2026-09-30']);

    // Қатар басу — жаңа run іске қосылмайды
    const again = await api('POST', '/api/tiktok/sync', { token: media, body: { month: '2026-09' } });
    expect(again.body.id).toBe(sync.body.id);
    expect(apify.startRun).toHaveBeenCalledTimes(1);

    expect((await api('GET', `/api/tiktok/sync/${sync.body.id}`, { token: media })).body.status).toBe('running');
    getRun.mockResolvedValue({ status: 'SUCCEEDED', datasetId: 'ds1' });
    const done = await api('GET', `/api/tiktok/sync/${sync.body.id}`, { token: media });
    expect(done.body).toMatchObject({ status: 'done', videoCount: 4 });

    const score = await api('PUT', '/api/tiktok/scores/2026-09/2', { token: media, body: { creativity: 8, ethics: 10, bonus: '' } });
    expect(score.status).toBe(200);
    expect((await api('PUT', '/api/tiktok/scores/2026-09/2', { token: media, body: { creativity: 11 } })).status).toBe(400);

    const ov = await api('GET', '/api/tiktok/overview?month=2026-09', { token: media });
    expect(ov.status).toBe(200);
    expect(ov.body.videos).toHaveLength(4);
    expect(ov.body.leaderboard).toHaveLength(2);
    const fizRow = ov.body.leaderboard.find((r) => r.name === 'Физика');
    expect(fizRow).toMatchObject({ videoCount: 2, postedWorkdays: 2, crossCount: 1, teamCount: 1 });
    const matRow = ov.body.leaderboard.find((r) => r.name === 'Математика');
    expect(matRow.jury).toMatchObject({ creativity: 8, ethics: 10, bonus: null });
    expect(ov.body.lastSync.status).toBe('done');
    expect(ov.body.videos.find((v) => v.id === '4').isTeam).toBe(true);

    // Анализ — 5 видеодан аз
    expect((await api('POST', '/api/tiktok/analysis', { token: media, body: { month: '2026-09' } })).status).toBe(400);
    for (let i = 10; i < 14; i += 1) {
      await pool.query(
        `INSERT INTO tiktok_videos (id, department_id, username, posted_at, post_day, views) VALUES ($1, 1, 'juz40_fiz', '2026-09-08T06:00:00Z', '2026-09-08', 100)`,
        [String(i)]
      );
    }
    vi.spyOn(gemini, 'callGemini').mockResolvedValue('{"summary":"Қыркүйек жақсы","works":["a"],"weak":[],"departments":[],"ideas":["b"]}');
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test';
    const an = await api('POST', '/api/tiktok/analysis', { token: media, body: { month: '2026-09' } });
    expect(an.status, JSON.stringify(an.body)).toBe(200);
    expect(an.body.summary).toBe('Қыркүйек жақсы');
    expect((await api('GET', '/api/tiktok/overview?month=2026-09', { token: media })).body.analysis.summary).toBe('Қыркүйек жақсы');
  });
});
