// backend/src/middleware/security.js
// Rate limiting + security headers middleware

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwtSecret');

// ── Rate limiters ──────────────────────────────────────────────────────────────

// Login: 10 рет / 15 минут (IP бойынша)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Тым көп кіру әрекеті. 15 минуттан кейін қайталаңыз.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // сәтті кірулер есептелмейді
});

// Токеннен пайдаланушы id-ін алады (аутентификацияланбаса — null).
// apiLimiter `auth` middleware-ден БҰРЫН орындалады, сондықтан req.user
// әлі жоқ — токенді осында өзіміз оқимыз.
function authenticatedUserKey(req) {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return null;
  try {
    return String(jwt.verify(token, JWT_SECRET).id);
  } catch {
    return null;
  }
}

// API жалпы: 100 рет / минут. Бір мектеп/ғимарат бір ортақ IP-мен
// шықса, барлық кураторы бір "себетке" түсіп қалмас үшін, авторизация
// бар сұраныстарды IP емес, нақты пайдаланушы id-і бойынша шектейміз —
// әркімнің өз лимиті болады. Токен жоқ/жарамсыз сұраныстар ғана IP
// бойынша шектеледі (мыс. логинге дейінгі сұраныстар).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Тым көп сұраныс. Бір минуттан кейін қайталаңыз.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Тірі викторина ойыншылары аккаунтсыз, сондықтан бұл лимит оларға
  // жарамайды: бір сынып бір мектеп wifi-ымен бір IP болып көрінеді де,
  // 40 оқушы бірінші сұрақтың өзінде минутына 100-ді толтырып жіберер еді.
  // Оларға төменде өз лимиттері бар.
  skip: (req) => req.originalUrl.startsWith('/api/play'),
  keyGenerator: (req) => {
    const userKey = authenticatedUserKey(req);
    return userKey ? `user:${userKey}` : ipKeyGenerator(req.ip);
  },
});

// ── Викторина ойыншыларына арналған лимиттер ────────────────────────────
// Ойыншылар ортақ IP-мен келетіндіктен, лимиттер IP-ге емес, мүмкіндігінше
// ойыншының өз токеніне байланған.

// Қосылу: бір IP-ден минутына 300 (бір сынып бір мезгілде кіреді).
const playJoinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Тым көп әрекет. Бір минуттан кейін қайталаңыз.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// PIN болжауға қарсы: тек сәтсіз сұраныстар (жалған PIN, бос емес ат)
// есептеледі. Сыныптағы бәрі қатесіз-ақ кіре алады, ал PIN іріктеген
// адам 10 минутта 120 рет қана қателесе алады.
const playPinFailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  skipSuccessfulRequests: true,
  message: { error: 'Тым көп қате әрекет. Бірнеше минуттан кейін қайталаңыз.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Ойын ішіндегі әрекеттер: ойыншының өз токені бойынша.
const playActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Тым көп сұраныс. Бір минуттан кейін қайталаңыз.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = req.get('x-player-token') || req.query.p;
    return token ? `player:${token}` : ipKeyGenerator(req.ip);
  },
});

// Токенді ауыстырып жүріп лимитті айналып өтуге қарсы IP-дегі жалпы төбе.
// Ол бір сыныптың қалыпты жүктемесінен әлдеқайда жоғары.
const playFloodLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3000,
  message: { error: 'Тым көп сұраныс. Бір минуттан кейін қайталаңыз.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// ── Security headers ──────────────────────────────────────────────────────────
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Production-да HTTPS міндетті
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  next();
};

// ── Input санитизация ─────────────────────────────────────────────────────────
const sanitizeInput = (req, res, next) => {
  const cleanString = (val) => val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
  const sanitize = (val) => {
    if (typeof val === 'string') return cleanString(val);
    if (Array.isArray(val)) return val.map(sanitize);
    if (typeof val === 'object' && val !== null) {
      const clean = {};
      for (const [key, v] of Object.entries(val)) clean[key] = sanitize(v);
      return clean;
    }
    return val;
  };
  // Викторина мәтіні — қолданушының еркін мәтіні, ал ондағы «=» мен латын
  // әріптері («ionization = …», «constant = 5») бұл сүзгіге «on…=» оқиға
  // өңдеушісі болып көріндіріп, мәтінді үнсіз бұзады. Оны шығарғанда React
  // өзі экрандайды (HTML ретінде салынбайды), сондықтан бұл маршрут үшін
  // сүзгінің қажеті жоқ; құрылымын өз валидаторы тексереді.
  if (req.body && !req.originalUrl.startsWith('/api/quizzes')) req.body = sanitize(req.body);
  next();
};

module.exports = {
  loginLimiter, apiLimiter, securityHeaders, sanitizeInput, authenticatedUserKey,
  playJoinLimiter, playPinFailLimiter, playActionLimiter, playFloodLimiter,
};
