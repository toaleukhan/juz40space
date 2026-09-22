import { describe, it, expect, vi } from 'vitest';

const { transcribeRecording } = require('./transcribe');
const { GeminiError } = require('./gemini');

function jsonRes(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] || null },
    json: async () => body,
  };
}

describe('transcribeRecording', () => {
  it('GEMINI_API_KEY жоқ болса желіге шықпай тоқтайды', async () => {
    const request = vi.fn();
    await expect(transcribeRecording({ buffer: Buffer.from('x'), mimeType: 'video/mp4', displayName: 'f' }, { apiKey: '', request }))
      .rejects.toMatchObject({ code: 'no_key' });
    expect(request).not.toHaveBeenCalled();
  });

  it('жүктеу → ACTIVE күту → транскрипция → тазалау ретімен жүреді', async () => {
    const calls = [];
    const request = vi.fn(async (url, opts) => {
      calls.push({ url, method: opts?.method });
      if (String(url).includes('/upload/v1beta/files') && opts.headers['X-Goog-Upload-Command'] === 'start') {
        return jsonRes(200, {}, { 'x-goog-upload-url': 'https://upload.example/session123' });
      }
      if (url === 'https://upload.example/session123') {
        return jsonRes(200, { file: { name: 'files/abc123', uri: 'https://gemini/files/abc123', mimeType: 'video/mp4', state: 'PROCESSING' } });
      }
      if (String(url).includes('/v1beta/files/abc123') && opts.method === 'GET') {
        return jsonRes(200, { name: 'files/abc123', uri: 'https://gemini/files/abc123', mimeType: 'video/mp4', state: 'ACTIVE' });
      }
      if (String(url).includes(':generateContent')) {
        return jsonRes(200, { candidates: [{ content: { parts: [{ text: 'Толық транскрипт мәтіні.' }] } }] });
      }
      if (String(url).includes('/v1beta/files/abc123') && opts.method === 'DELETE') {
        return jsonRes(200, {});
      }
      throw new Error('күтпеген сұраныс: ' + url);
    });

    const text = await transcribeRecording(
      { buffer: Buffer.from('видео байттары'), mimeType: 'video/mp4', displayName: 'сұхбат.mp4' },
      { apiKey: 'k', request, wait: { intervalMs: 1 } }
    );

    expect(text).toBe('Толық транскрипт мәтіні.');
    expect(calls.some((c) => c.url.includes('/upload/v1beta/files'))).toBe(true);
    expect(calls.some((c) => c.url === 'https://upload.example/session123')).toBe(true);
    expect(calls.some((c) => c.url.includes(':generateContent'))).toBe(true);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    // тазалау транскрипциядан КЕЙІН шақырылуы керек
    const genIdx = calls.findIndex((c) => c.url.includes(':generateContent'));
    const delIdx = calls.findIndex((c) => c.method === 'DELETE');
    expect(delIdx).toBeGreaterThan(genIdx);
  });

  it('файл PROCESSING күйінде тым ұзақ қалса, timeout қатесімен тоқтайды', async () => {
    const request = vi.fn(async (url, opts) => {
      if (String(url).includes('/upload/v1beta/files') && opts.headers?.['X-Goog-Upload-Command'] === 'start') {
        return jsonRes(200, {}, { 'x-goog-upload-url': 'https://upload.example/s' });
      }
      if (url === 'https://upload.example/s') {
        return jsonRes(200, { file: { name: 'files/x', uri: 'u', mimeType: 'video/mp4', state: 'PROCESSING' } });
      }
      return jsonRes(200, { name: 'files/x', state: 'PROCESSING' }); // ешқашан ACTIVE болмайды
    });

    await expect(transcribeRecording(
      { buffer: Buffer.from('v'), mimeType: 'video/mp4', displayName: 'f' },
      { apiKey: 'k', request, wait: { intervalMs: 1, timeoutMs: 5 } }
    )).rejects.toMatchObject({ code: 'timeout' });
  });

  it('файл FAILED болса, дереу қатемен тоқтайды (күтпейді)', async () => {
    const request = vi.fn(async (url, opts) => {
      if (String(url).includes('/upload/v1beta/files') && opts.headers?.['X-Goog-Upload-Command'] === 'start') {
        return jsonRes(200, {}, { 'x-goog-upload-url': 'https://upload.example/s' });
      }
      if (url === 'https://upload.example/s') {
        return jsonRes(200, { file: { name: 'files/x', uri: 'u', mimeType: 'video/mp4', state: 'PROCESSING' } });
      }
      return jsonRes(200, { name: 'files/x', state: 'FAILED' });
    });

    await expect(transcribeRecording(
      { buffer: Buffer.from('v'), mimeType: 'video/mp4', displayName: 'f' },
      { apiKey: 'k', request, wait: { intervalMs: 1 } }
    )).rejects.toBeInstanceOf(GeminiError);
  });

  it('жүктеу сәтсіз болса — таза GeminiError, дальше жалғаспайды', async () => {
    const request = vi.fn(async () => jsonRes(500, { error: { message: 'server down' } }));
    await expect(transcribeRecording(
      { buffer: Buffer.from('v'), mimeType: 'video/mp4', displayName: 'f' },
      { apiKey: 'k', request }
    )).rejects.toBeInstanceOf(GeminiError);
  });
});
