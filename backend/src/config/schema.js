const pool = require('./db');
const bcrypt = require('bcryptjs');

const createTables = async () => {
  try {
    // 1. users кестесі (Кураторлық бағандармен)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'curator',
        subject VARCHAR(50),
        stream_id VARCHAR(50) DEFAULT '01',
        students_count VARCHAR(50) DEFAULT '0',
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Жетіспейтін бағандарды мәжбүрлі қосу
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'curator';`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subject VARCHAR(50);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_id VARCHAR(50) DEFAULT '01';`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS students_count VARCHAR(50) DEFAULT '0';`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);

    // 2. curators кестесі
    await pool.query(`
      CREATE TABLE IF NOT EXISTS curators (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255),
        subject VARCHAR(50) NOT NULL,
        stream_id VARCHAR(50) DEFAULT '01',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. st_recordings кестесі
    await pool.query(`
      CREATE TABLE IF NOT EXISTS st_recordings (
        id SERIAL PRIMARY KEY,
        curator_id INT,
        subject VARCHAR(50) NOT NULL,
        stream_id VARCHAR(50) DEFAULT '01',
        month_num INT DEFAULT 1,
        month_id VARCHAR(50) DEFAULT '01',
        week_num INT DEFAULT 1,
        curator_name VARCHAR(255) NOT NULL,
        students_count VARCHAR(50) DEFAULT '0',
        meet_link TEXT,
        meet_code VARCHAR(100),
        video_link TEXT,
        attendance_link TEXT,
        video_links TEXT[],
        attendance_links TEXT[],
        meet_codes TEXT[],
        meet_links TEXT[],
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 💡 ФИЗИКА КУРАТОРЛАРЫНА АВТОМАТТЫ ЛОГИН/ПАРОЛЬ СИД ЖАСАУ
    const curatorsRes = await pool.query(`SELECT full_name FROM curators WHERE subject = 'ФИЗ'`);
    const defaultPassword = await bcrypt.hash('fiz123456', 10);

    for (const cur of curatorsRes.rows) {
      if (!cur.full_name) continue;
      
      // Логин мысалы: "Амит Алтынай" -> "fiz_altynai" немесе транслит
      const firstName = cur.full_name.split(' ')[0].toLowerCase();
      const username = `fiz_${firstName}`;

      const userCheck = await pool.query(`SELECT id FROM users WHERE full_name = $1 OR username = $2`, [cur.full_name, username]);
      
      if (userCheck.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (username, password, full_name, role, subject, stream_id, students_count)
           VALUES ($1, $2, $3, 'curator', 'ФИЗ', '01', '0')`,
          [username, defaultPassword, cur.full_name]
        );
        console.log(`👤 Куратор аккаунты ашылды: ${username} / fiz123456 (${cur.full_name})`);
      }
    }

    console.log('✅ Кестелер мен Куратор аккаунттары 100% дайын!');
  } catch (err) {
    console.error('❌ Schema setup error:', err.message);
  }
};

module.exports = createTables;