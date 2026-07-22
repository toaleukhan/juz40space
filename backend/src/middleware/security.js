// backend/src/middleware/security.js
// Rate limiting + security headers middleware

const rateLimit = require('express-rate-limit');

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

// API жалпы: 100 рет / минут
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Тым көп сұраныс. Бір минуттан кейін қайталаңыз.' },
  standardHeaders: true,
  legacyHeaders: false,
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
  if (req.body) req.body = sanitize(req.body);
  next();
};

module.exports = { loginLimiter, apiLimiter, securityHeaders, sanitizeInput };
