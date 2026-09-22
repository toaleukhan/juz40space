// Видео/аудио байтын Gemini-ге жүктеп, толық транскрипт алу. Үш қадам:
// 1) Files API-ге resumable жүктеу, 2) файл өңделіп ACTIVE болғанша
// күту, 3) generateContent-ке сол файлды beрiп транскрипт сұрау.
//
// Желіге шығатын жалғыз жер — deps.request (әдепкі — нақты fetch),
// сынақта ауыстырылады, орындалу реті (жүктеу → күту → сұрау →
// тазалау) осымен желісіз тексеріледі.

const { GeminiError } = require('./gemini');

const UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const FILES_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const TRANSCRIBE_PROMPT = [
  'Бұл — CustDev сұхбатының жазбасы (аудио/видео). Осы жазбаның ТОЛЫҚ, дәл',
  'транскриптін жаз — сөзбе-сөз, ештеңені қысқартпай, өз пікіріңді қоспай.',
  'Сөйлеушілерді ажырата алсаң, әркімнің алдына "Сұхбат алушы:" немесе',
  '"Сұхбаттасушы:" деп қой. Қазақша сөйлесе — қазақша, орысша сөйлесе —',
  'орысша жаз (аудармашы болма, тек естігеніңді дәл жаз).',
].join(' ');

async function defaultRequest(url, opts) {
  return fetch(url, opts);
}

async function uploadFile(buffer, mimeType, displayName, apiKey, request) {
  const start = await request(`${UPLOAD_BASE}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(buffer.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) throw new GeminiError(`Gemini-ге жүктеу басталмады: HTTP ${start.status}`, 'http');
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new GeminiError('Gemini жүктеу сілтемесін қайтармады', 'bad_response');

  const put = await request(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(buffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: buffer,
  });
  if (!put.ok) throw new GeminiError(`Gemini-ге файл жүктеу сәтсіз: HTTP ${put.status}`, 'http');
  const data = await put.json();
  if (!data.file?.name) throw new GeminiError('Gemini жүктелген файлды таппады', 'bad_response');
  return data.file; // { name, uri, mimeType, state }
}

// Видео/аудио дереу ACTIVE болмайды — Gemini өңдеп жатады (PROCESSING).
async function waitUntilActive(fileName, apiKey, request, { intervalMs = 2000, timeoutMs = 120000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(`${FILES_BASE}/${fileName}?key=${encodeURIComponent(apiKey)}`, { method: 'GET' });
    if (!res.ok) throw new GeminiError(`Файл күйін тексеру сәтсіз: HTTP ${res.status}`, 'http');
    const file = await res.json();
    if (file.state === 'ACTIVE') return file;
    if (file.state === 'FAILED') throw new GeminiError('Gemini файлды өңдей алмады (FAILED)', 'bad_response');
    if (Date.now() > deadline) throw new GeminiError('Файл өңделуін тым ұзақ күттік, қайталап көріңіз', 'timeout');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function deleteFile(fileName, apiKey, request) {
  try { await request(`${FILES_BASE}/${fileName}?key=${encodeURIComponent(apiKey)}`, { method: 'DELETE' }); } catch { /* тазалау сәтсіз болса да маңызды емес — Gemini 48 сағаттан соң өзі өшіреді */ }
}

async function transcribeRecording({ buffer, mimeType, displayName }, deps = {}) {
  const apiKey = deps.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError('GEMINI_API_KEY орнатылмаған', 'no_key');
  const model = deps.model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const request = deps.request || defaultRequest;

  const uploaded = await uploadFile(buffer, mimeType, displayName, apiKey, request);
  const active = await waitUntilActive(uploaded.name, apiKey, request, deps.wait);

  let text;
  try {
    const gen = await request(`${MODEL_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ fileData: { fileUri: active.uri, mimeType: active.mimeType } }, { text: TRANSCRIBE_PROMPT }],
        }],
      }),
    });
    if (!gen.ok) {
      const body = await gen.json().catch(() => null);
      throw new GeminiError(`Gemini транскрипция қатесі: ${body?.error?.message || `HTTP ${gen.status}`}`, 'http');
    }
    const data = await gen.json();
    text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    if (!text.trim()) throw new GeminiError('Gemini бос транскрипт қайтарды', 'bad_response');
  } finally {
    deleteFile(uploaded.name, apiKey, request);
  }

  return text.trim();
}

module.exports = { transcribeRecording, uploadFile, waitUntilActive };
