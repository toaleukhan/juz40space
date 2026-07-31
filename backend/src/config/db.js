const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // pg-дің әдепкі max мәні — бар болғаны 10. Көп куратор бір мезгілде
  // сұраныс жіберсе (әрқайсысы бір сұранысқа 2-3 query жасайды), 10
  // қосылым лезде таусылып, қалғандары кезекте тұрып қалады.
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
