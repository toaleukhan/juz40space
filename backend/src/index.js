require('dotenv').config();
const express = require('express');
const cors = require('cors');
const createTables = require('./config/schema');
const { apiLimiter, loginLimiter, whatsappLimiter, securityHeaders, sanitizeInput } = require('./middleware/security');
const auth = require('./middleware/auth');
const { requireAdmin } = auth;

const app = express();

// Дәл домен/сабдомен тексеру — substring bypass болдырмау үшін
// (мыс. "evil-juz40.space.attacker.com".includes('juz40.space') === true болатын еді)
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
app.use('/api/groups', require('./routes/groups'));
app.use('/api/whatsapp/send', whatsappLimiter);
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/parse-schedule', auth, requireAdmin, require('./routes/parseSchedule'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/tracker', require('./routes/tracker'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

const PORT = process.env.PORT || 3001;

const start = async () => {
  await createTables();
  
  console.log('✅ Backend ready');
  
  app.listen(PORT, () => console.log(`🚀 JUZNOTIFY backend: http://localhost:${PORT}`));
};

start().catch(console.error);
