// Бір пән/ағымдағы кураторлардың логинін ағылшынша форматқа ({аты}_{slug})
// келтіреді — "fiz_амит" секілді ескі кириллица логиндерін Меруерттің
// "meruert_phys" үлгісіне сай қылу үшін. Мақсатты форматта тұрған логиндер
// (slug-пен аяқталатын) өзгертілмей қалады.
// Қолдану: node scripts/relogin-stream.js "ФИЗ" "01" "phys"
require('dotenv').config();
const pool = require('../src/config/db');
const { translit, makePassword, hashPassword } = require('../src/utils/credentials');

const [subject, streamId, slug] = process.argv.slice(2);

if (!subject || !streamId || !slug) {
  console.error('Қолдану: node scripts/relogin-stream.js "ФИЗ" "01" "phys"');
  process.exit(1);
}

(async () => {
  try {
    const res = await pool.query(
      `SELECT c.id AS curator_id, c.full_name, u.id AS user_id, u.username
       FROM curators c
       JOIN users u ON u.id = c.user_id
       WHERE c.subject = $1 AND c.stream_id = $2
       ORDER BY c.full_name ASC`,
      [subject, streamId]
    );

    if (!res.rows.length) {
      console.log('Бұл пән/ағымда логині бар куратор табылмады.');
      return;
    }

    const results = [];
    for (const row of res.rows) {
      if (row.username && row.username.endsWith(`_${slug}`)) {
        results.push({ name: row.full_name, username: row.username, password: '(өзгертілмеді)' });
        continue;
      }

      const firstName = row.full_name.trim().split(/\s+/)[0];
      const base = translit(firstName) || 'curator';
      let candidate = `${base}_${slug}`;
      let n = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const exists = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [candidate, row.user_id]);
        if (exists.rows.length === 0) break;
        n += 1;
        candidate = `${base}${n}_${slug}`;
      }

      const password = makePassword();
      const hash = await hashPassword(password);
      await pool.query('UPDATE users SET username = $1, password = $2 WHERE id = $3', [candidate, hash, row.user_id]);
      results.push({ name: row.full_name, username: candidate, password });
    }

    console.log(`\n${subject}-${streamId} — ${results.length} куратор:\n`);
    console.log('Аты-жөні'.padEnd(28), 'Логин'.padEnd(22), 'Пароль');
    console.log('-'.repeat(70));
    for (const r of results) {
      console.log(r.name.padEnd(28), r.username.padEnd(22), r.password);
    }
    console.log('\nБұл тізімді кураторларға таратыңыз (өзгертілмегендер бұрыннан дұрыс форматта).');
  } catch (err) {
    console.error('Қате:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
