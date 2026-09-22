import { describe, it, expect, vi, afterEach } from 'vitest';

const { extractDriveFileId, fetchDriveMeta, downloadDriveFile, getDriveAuth } = require('./drive');

describe('extractDriveFileId', () => {
  it('/file/d/<id>/view пішінінен ID-ды алады', () => {
    expect(extractDriveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234/view?usp=sharing'))
      .toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz01234');
  });
  it('?id=<id> пішінінен ID-ды алады', () => {
    expect(extractDriveFileId('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz01234'))
      .toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz01234');
  });
  it('&id=<id> (басқа парамертрлермен бірге) ID-ды алады', () => {
    expect(extractDriveFileId('https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUvWxYz01234'))
      .toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz01234');
  });
  it('таза ID жіберілсе, соны қайтарады', () => {
    expect(extractDriveFileId('1AbCdEfGhIjKlMnOpQrStUvWxYz01234')).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz01234');
  });
  it('айналасында мәтін (мыс. ескі meet-код жазуы) болса да табады', () => {
    expect(extractDriveFileId('жазба: https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234/view (2026-09-01)'))
      .toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz01234');
  });
  it('бос, null, тым қысқа мәтінге null қайтарады', () => {
    expect(extractDriveFileId('')).toBeNull();
    expect(extractDriveFileId(null)).toBeNull();
    expect(extractDriveFileId('abc-defg-hij')).toBeNull(); // meet код, Drive сілтемесі емес
    expect(extractDriveFileId('2026-08-28 17:57 GMT+5')).toBeNull();
  });
  it('http бар бірақ /d/ де, id= де жоқ мәтінге null қайтарады', () => {
    expect(extractDriveFileId('https://meet.google.com/abc-defg-hij')).toBeNull();
  });
});

describe('getDriveAuth', () => {
  afterEach(() => { delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CUSTDEV; });

  it('GOOGLE_SERVICE_ACCOUNT_JSON_CUSTDEV жоқ болса null қайтарады', () => {
    expect(getDriveAuth()).toBeNull();
  });
  it('бүлінген JSON болса да лақтырмайды, null қайтарады', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CUSTDEV = 'бұл JSON емес';
    expect(getDriveAuth()).toBeNull();
  });
});

describe('fetchDriveMeta / downloadDriveFile (fetch стабталған)', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  const fakeAuth = { getAccessToken: async () => ({ token: 'fake-token' }) };

  it('метадеректі дұрыс сұрайды және қайтарады', async () => {
    let seenUrl, seenAuth;
    global.fetch = async (url, opts) => {
      seenUrl = url; seenAuth = opts.headers.Authorization;
      return { ok: true, json: async () => ({ name: 'жазба.mp4', mimeType: 'video/mp4', createdTime: '2026-09-01T10:00:00Z', size: '12345' }) };
    };
    const meta = await fetchDriveMeta('FILE_ID_123', fakeAuth);
    expect(seenUrl).toContain('FILE_ID_123');
    expect(seenUrl).toContain('fields=');
    expect(seenAuth).toBe('Bearer fake-token');
    expect(meta.createdTime).toBe('2026-09-01T10:00:00Z');
  });

  it('файл табылмаса (404), түсінікті қате лақтырады', async () => {
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: { message: 'File not found' } }) });
    await expect(fetchDriveMeta('X', fakeAuth)).rejects.toMatchObject({ code: 'drive' });
    await expect(fetchDriveMeta('X', fakeAuth)).rejects.toThrow(/бөлісілмеген|табылмады/);
  });

  it('downloadDriveFile буферді дұрыс қайтарады', async () => {
    global.fetch = async (url) => {
      expect(url).toContain('alt=media');
      return { ok: true, arrayBuffer: async () => new TextEncoder().encode('видео байттары').buffer };
    };
    const buf = await downloadDriveFile('FILE_ID_123', fakeAuth);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe('видео байттары');
  });

  it('жүктеу сәтсіз болса қате лақтырады', async () => {
    global.fetch = async () => ({ ok: false, status: 500 });
    await expect(downloadDriveFile('X', fakeAuth)).rejects.toMatchObject({ code: 'drive' });
  });
});
