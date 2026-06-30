require('dotenv').config();
const express = require('express');
const cors = require('cors');
const createTables = require('./config/schema');

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.includes('vercel.app') || origin.includes('localhost') || origin.includes('juz40.space')) {
      callback(null, true);
    } else {
      callback(new Error('CORS error'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/parse-schedule', require('./routes/parseSchedule'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

const PORT = process.env.PORT || 3001;

const start = async () => {
  await createTables();
  
  console.log('✅ Backend ready');
  
  app.listen(PORT, () => console.log(`🚀 JUZNOTIFY backend: http://localhost:${PORT}`));
};

start().catch(console.error);
