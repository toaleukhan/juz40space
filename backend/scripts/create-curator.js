// Куратор аккаунтын қолмен жасау (публикалық тіркелу жоқ болғандықтан).
// Қолдану: node scripts/create-curator.js "Аты-жөні" "+77001234567" "құпия_сөз" "Топ атауы" [--admin]
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

const args = process.argv.slice(2);
const isAdmin = args.includes('--admin');
const [name, phone, password, groupName] = args.filter(a => a !== '--admin');
const role = isAdmin ? 'admin' : 'curator';

if (!name || !phone || !password || !groupName) {
  console.error('Қолдану: node scripts/create-curator.js "Аты-жөні" "+77001234567" "құпия_сөз" "Топ атауы" [--admin]');
  process.exit(1);
}

(async () => {
  try {
    const exists = await pool.query('SELECT id FROM curators WHERE phone = $1', [phone]);
    if (exists.rows.length) {
      console.error('Бұл нөмір тіркелген');
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO curators (name, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, phone, role',
      [name, phone, hash, role]
    );
    const curator = result.rows[0];

    await pool.query('INSERT INTO groups (curator_id, name) VALUES ($1, $2)', [curator.id, groupName]);

    console.log('✅ Куратор жасалды:', curator);
  } catch (err) {
    console.error('Қате:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
