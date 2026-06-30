const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const whatsapp = require('../services/whatsapp');
const pool = require('../config/db');

// SSE арқылы QR кодын жіберу
router.get('/qr', auth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  const curatorId = req.curatorId;

  await whatsapp.startSession(
    curatorId,
    (qrImage) => {
      res.write(`data: ${JSON.stringify({ type: 'qr', qr: qrImage })}\n\n`);
    },
    (status) => {
      res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
      if (status === 'connected') res.end();
    }
  );

  req.on('close', () => {
    console.log(`SSE closed for curator ${curatorId}`);
  });
});

// WhatsApp статусы
router.get('/status', auth, async (req, res) => {
  try {
    const connected = await whatsapp.getStatus(req.curatorId);
    res.json({ connected });
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Хабарлама жіберу (топқа немесе барлығына)
router.post('/send', auth, async (req, res) => {
  const { groupId, message } = req.body;
  if (!message) return res.status(400).json({ error: 'Хабарлама бос' });

  try {
    // Оқушыларды алу
    let studentsQuery;
    let params;

    if (groupId) {
      // Белгілі бір топқа
      studentsQuery = `
        SELECT s.* FROM students s
        JOIN groups g ON s.group_id = g.id
        WHERE s.group_id = $1 AND g.curator_id = $2
      `;
      params = [groupId, req.curatorId];
    } else {
      // Барлық оқушыларға
      studentsQuery = `
        SELECT s.* FROM students s
        JOIN groups g ON s.group_id = g.id
        WHERE g.curator_id = $1
      `;
      params = [req.curatorId];
    }

    const studentsResult = await pool.query(studentsQuery, params);
    const students = studentsResult.rows;

    if (!students.length) return res.status(400).json({ error: 'Оқушылар табылмады' });

    // Message логын жасау
    const msgResult = await pool.query(
      'INSERT INTO messages (curator_id, group_id, message_text) VALUES ($1, $2, $3) RETURNING id',
      [req.curatorId, groupId || null, message]
    );
    const messageId = msgResult.rows[0].id;

    // Pending логтар жасау
    const logValues = students.map((_, i) => `($1, $${i + 2}, 'pending')`).join(',');
    await pool.query(
      `INSERT INTO message_logs (message_id, student_id, status) VALUES ${logValues}`,
      [messageId, ...students.map(s => s.id)]
    );

    // Жіберуді бастау (фонда)
    res.json({ success: true, total: students.length, messageId });

    // Фондық жіберу
    whatsapp.sendBulk(req.curatorId, students, message, async ({ studentId, status }) => {
      await pool.query(
        'UPDATE message_logs SET status = $1, sent_at = NOW() WHERE message_id = $2 AND student_id = $3',
        [status, messageId, studentId]
      );
      // Жалпы санақты жаңарту
      if (status === 'sent') {
        await pool.query('UPDATE messages SET total_sent = total_sent + 1 WHERE id = $1', [messageId]);
      } else {
        await pool.query('UPDATE messages SET total_failed = total_failed + 1 WHERE id = $1', [messageId]);
      }
    }).catch(console.error);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Сервер қатесі' });
  }
});

// Хабарлама тарихы
router.get('/history', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, g.name as group_name FROM messages m
       LEFT JOIN groups g ON m.group_id = g.id
       WHERE m.curator_id = $1
       ORDER BY m.sent_at DESC LIMIT 50`,
      [req.curatorId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// WhatsApp-тан шығу
router.post('/disconnect', auth, async (req, res) => {
  try {
    await whatsapp.disconnectSession(req.curatorId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

module.exports = router;
