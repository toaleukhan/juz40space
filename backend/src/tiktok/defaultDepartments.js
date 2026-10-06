// JUZ40 бөлімдерінің TikTok парақшалары (2026-10, Media team тізімі).
// Сервер іске қосылғанда tiktok_departments-те әлі жоқ аккаунттар ғана
// қосылады: тимлид сайттан өзгерткен/өшірген жолдарға тиіспейміз —
// бір рет қосылғаны белгі ретінде tiktok_settings-те сақталады.
const DEFAULT_DEPARTMENTS = [
  { name: 'CEO TEAM', username: 'juz40ceo.team' },
  { name: 'ҚАРЖЫ', username: 'juz40_finance' },
  { name: 'SMART', username: 'smart_team.juz40' },
  { name: 'JUNIOR', username: 'juniorteam_juz40' },
  { name: 'ӘДІСТЕМЕ', username: 'juz40_methodology' },
  { name: 'СЫРТҚЫ САТУ', username: 'juz40_satu' },
  { name: 'IT', username: 'juz40.it' },
  { name: 'МАРКЕТИНГ', username: 'juz40_marketing' },
  { name: 'PR', username: 'juz40.pr' },
  { name: 'ДИЗАЙН', username: 'juz40_design' },
  { name: 'СЕРВИС', username: 'service_bolimi' },
  { name: 'САПА', username: 'juz40_sapa' },
  { name: 'COMMUNITY', username: 'juz40_community_t' },
];

const TEAM_ACCOUNT = { name: 'Juz40_team', username: 'juz40.team' };

const SEED_KEY = 'departments_seed_2026_10';

// Бір реттік: белгі қойылса — қайта қоспаймыз (тимлид бірін өшірсе, қайта пайда болмасын).
async function seedDefaultDepartments(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_settings (key VARCHAR(64) PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const { rowCount } = await pool.query(
    `INSERT INTO tiktok_settings (key, value) VALUES ($1, 'done') ON CONFLICT (key) DO NOTHING`, [SEED_KEY]
  );
  if (!rowCount) return 0;

  let added = 0;
  for (const d of DEFAULT_DEPARTMENTS) {
    const r = await pool.query(
      `INSERT INTO tiktok_departments (name, username) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING`, [d.name, d.username]
    );
    added += r.rowCount;
  }
  const { rows } = await pool.query('SELECT 1 FROM tiktok_departments WHERE is_team_account');
  if (!rows.length) {
    const r = await pool.query(
      `INSERT INTO tiktok_departments (name, username, is_team_account) VALUES ($1, $2, TRUE) ON CONFLICT (username) DO NOTHING`,
      [TEAM_ACCOUNT.name, TEAM_ACCOUNT.username]
    );
    added += r.rowCount;
  }
  return added;
}

module.exports = { DEFAULT_DEPARTMENTS, TEAM_ACCOUNT, seedDefaultDepartments };
