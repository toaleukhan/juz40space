require('dotenv').config();
const express = require('express');
const cors = require('cors');
const createTables = require('./config/schema');
const { apiLimiter, loginLimiter, securityHeaders, sanitizeInput, playFloodLimiter } = require('./middleware/security');
const { startAutoSyncScheduler } = require('./jobs/driveSync');
const { startJanitor: startQuizJanitor } = require('./games/service');

const app = express();

// Railway (және көптеген PaaS) сұраныстарды бір реверс-прокси арқылы жібереді де,
// X-Forwarded-For тақырыбын қосады. Бұл орнатылмаса, express-rate-limit әр сұраныста
// ValidationError лақтырып, сұраныс жауапсыз қалады (логин де осыдан істемей тұрды).
app.set('trust proxy', 1);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === 'vercel.app' || hostname.endsWith('.vercel.app') ||
      hostname === 'juz40.space' || hostname.endsWith('.juz40.space')
    );
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) callback(null, true);
    else callback(new Error('CORS error'));
  },
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(securityHeaders);
app.use(sanitizeInput);
app.use(apiLimiter);

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/parse-schedule', require('./routes/parseSchedule'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/st-recordings', require('./routes/stRecordings'));
app.use('/api/curators', require('./routes/curators'));
app.use('/api/coordinators', require('./routes/coordinators'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/export', require('./routes/exportSheet'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/recordings', require('./routes/recordingReviews'));

// 🎮 Тірі викторина: құрастырушы, хост және аккаунтсыз ойыншылар
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/games', require('./routes/games'));
app.use('/api/play', playFloodLimiter, require('./routes/play'));

// 🎙️ CustDev: сұхбат транскриптін протоколға айналдыру (тек admin)
app.use('/api/custdev', require('./routes/custdev'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

const PORT = process.env.PORT || 3001;

const start = async () => {
  await createTables();

  console.log('✅ Backend ready');

  app.listen(PORT, () => console.log(`🚀 JUZNOTIFY backend: http://localhost:${PORT}`));

  startAutoSyncScheduler();
  startQuizJanitor();
};

start().catch(console.error);
