const pool = require('../config/db');

async function logAction(curatorId, action, entity, details) {
  try {
    await pool.query(
      'INSERT INTO audit_log (curator_id, action, entity, details) VALUES ($1, $2, $3, $4)',
      [curatorId, action, entity, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('audit_log жазу қатесі:', err.message);
  }
}

module.exports = { logAction };
