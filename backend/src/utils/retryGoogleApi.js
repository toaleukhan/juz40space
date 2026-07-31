// Бір пәннің домен аккаунты бір мезгілде көп куратордан Calendar API
// сұранысын алса (мыс. барлығы дерлік бірдей сәтте "Мит ашу" басса),
// Google уақытша rate-limit/quota қатесін қайтаруы мүмкін. Мұндай
// қателер өтпелі — сәл күтіп қайталасақ, әдетте өтеді. Басқа қателерді
// (жарамсыз деректер, авторизация жоқ) қайталаудың мағынасы жоқ, дереу
// лақтырамыз.
function isRetryableGoogleError(err) {
  const status = err.code || err.response?.status;
  if (status === 429) return true;
  if (status === 403) {
    const reason = err.errors?.[0]?.reason || '';
    const msg = String(err.message || '');
    return /rate|quota|limit/i.test(reason) || /rate|quota/i.test(msg);
  }
  return typeof status === 'number' && status >= 500 && status < 600;
}

async function retryGoogleApi(fn, { retries = 3, baseDelayMs = 500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryableGoogleError(err)) throw err;
      // Экспоненциалды кідіріс + jitter — бірнеше сұраныс бір мезгілде
      // throttled болса, бәрі дәл сол секундта қайта ұмтылмас үшін.
      const delay = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

module.exports = { retryGoogleApi, isRetryableGoogleError };
