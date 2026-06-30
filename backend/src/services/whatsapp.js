const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const pool = require('../config/db');

const sessions = {};
const qrCallbacks = {};
const statusCallbacks = {};

const createClient = (curatorId) => {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `curator_${curatorId}` }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true
    }
  });

  client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    if (qrCallbacks[curatorId]) qrCallbacks[curatorId](qrImage);
  });

  client.on('ready', async () => {
    await pool.query(
      `UPDATE whatsapp_sessions SET is_connected = true, connected_at = NOW(), updated_at = NOW() WHERE curator_id = $1`,
      [curatorId]
    );
    if (statusCallbacks[curatorId]) statusCallbacks[curatorId]('connected');
  });

  client.on('disconnected', async () => {
    await pool.query(
      'UPDATE whatsapp_sessions SET is_connected = false, updated_at = NOW() WHERE curator_id = $1',
      [curatorId]
    );
    delete sessions[curatorId];
    if (statusCallbacks[curatorId]) statusCallbacks[curatorId]('disconnected');
  });

  return client;
};

const startSession = async (curatorId, onQR, onStatus) => {
  if (sessions[curatorId]?.info) {
    onStatus('connected');
    return;
  }

  qrCallbacks[curatorId] = onQR;
  statusCallbacks[curatorId] = onStatus;

  await pool.query(
    `INSERT INTO whatsapp_sessions (curator_id, is_connected)
     VALUES ($1, false)
     ON CONFLICT (curator_id) DO UPDATE SET updated_at = NOW()`,
    [curatorId]
  );

  const client = createClient(curatorId);
  sessions[curatorId] = client;
  client.initialize().catch(err => console.log('WA init error:', err.message));
};

const getStatus = async (curatorId) => {
  const client = sessions[curatorId];
  return client?.info?.wid ? true : false;
};

const sendMessage = async (curatorId, phone, message) => {
  const client = sessions[curatorId];
  if (!client?.info) throw new Error('WhatsApp қосылмаған');
  const formatted = phone.replace(/\D/g, '') + '@c.us';
  await client.sendMessage(formatted, message);
};

const sendBulk = async (curatorId, students, message, onProgress) => {
  const results = { sent: 0, failed: 0, errors: [] };
  for (const student of students) {
    try {
      await sendMessage(curatorId, student.phone, message);
      results.sent++;
      if (onProgress) onProgress({ studentId: student.id, status: 'sent' });
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    } catch (err) {
      results.failed++;
      results.errors.push({ student: student.name, error: err.message });
      if (onProgress) onProgress({ studentId: student.id, status: 'failed' });
    }
  }
  return results;
};

const disconnectSession = async (curatorId) => {
  if (sessions[curatorId]) {
    await sessions[curatorId].destroy();
    delete sessions[curatorId];
  }
};

module.exports = { startSession, getStatus, sendMessage, sendBulk, disconnectSession };
