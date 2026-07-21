const pool = require('./db');

const createTables = async () => {
  try {
    // 1. Орталық Кураторлар Базасы
    await pool.query(`
      CREATE TABLE IF NOT EXISTS curators (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        subject VARCHAR(50) NOT NULL,
        stream_id VARCHAR(50) DEFAULT '01',
        status VARCHAR(50) DEFAULT 'active', 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. СТ Жазбалары Кестесі
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

    console.log('✅ Деректер базасы кестелері сәтті тексерілді/жасалды!');
  } catch (err) {
    console.error('❌ Таблица жасауда қателік:', err.message);
  }
};

module.exports = createTables;