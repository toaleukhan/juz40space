// Куратор аккаунтын қолмен жасау (публикалық тіркелу жоқ болғандықтан).
// Қолдану: node scripts/create-curator.js "Аты-жөні" "логин" "құпия_сөз" "Пән" ["Ағым"]
// Мыс:    node scripts/create-curator.js "Асель Ержанова" "asel_math" "kupiya123" "МАТ" "01"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

const [fullName, username, password, subject, streamId] = process.argv.slice(2);

if (!fullName || !username || !password || !subject) {
  console.error('Қолдану: node scripts/create-curator.js "Аты-жөні" "логин" "құпия_сөз" "Пән" ["Ағым"]');
  process.exit(1);
}

const strId = streamId || '01';

(async () => {
  try {
    const cleanUsername = username.toLowerCase().trim();
    const exists = await pool.query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
    if (exists.rows.length) {
      console.error('Бұл логин тіркелген');
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (username, password, full_name, role, subject, stream_id)
       VALUES ($1, $2, $3, 'curator', $4, $5) RETURNING id, username, full_name, subject, stream_id`,
      [cleanUsername, hash, fullName, subject, strId]
    );

    // curators кестесіне де қосамыз — ST-жазба авто-синхронизациясы осы кестені пайдаланады
    const userId = userResult.rows[0].id;
    const curatorCheck = await pool.query(
      'SELECT id FROM curators WHERE full_name = $1 AND subject = $2 AND stream_id = $3',
      [fullName, subject, strId]
    );
    if (curatorCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO curators (full_name, subject, stream_id, status, user_id) VALUES ($1, $2, $3, 'active', $4)`,
        [fullName, subject, strId, userId]
      );
    } else {
      await pool.query('UPDATE curators SET user_id = $1 WHERE id = $2', [userId, curatorCheck.rows[0].id]);
    }

    console.log('✅ Куратор жасалды:', userResult.rows[0]);
  } catch (err) {
    console.error('Қате:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
