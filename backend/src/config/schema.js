const pool = require('./db');
const bcrypt = require('bcryptjs');

const createTables = async () => {
  try {
    // 1. users кестесі
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

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'curator';`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subject VARCHAR(50);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_id VARCHAR(50) DEFAULT '01';`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS students_count VARCHAR(50) DEFAULT '0';`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;`);

    // 👑 ADMIN АКТИВАЦИЯСЫ: admin / admin123
    const adminCheck = await pool.query(`SELECT id FROM users WHERE username = 'admin'`);
    if (adminCheck.rows.length === 0) {
      const adminPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        `INSERT INTO users (username, password, full_name, role, subject, stream_id)
         VALUES ('admin', $1, 'Басқарушы Admin', 'admin', 'ALL', '01')`,
        [adminPassword]
      );
      console.log('👑 Admin аккаунты автоматты жасалды: admin / admin123');
    } else {
      await pool.query(`UPDATE users SET role = 'admin' WHERE username = 'admin'`);
    }

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

    console.log('✅ Деректер базасы мен пайдаланушылар толық дайын!');
  } catch (err) {
    console.error('❌ Schema error:', err.message);
  }
};

module.exports = createTables;