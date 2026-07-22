const pool = require('./db');

const createTables = async () => {
  try {
    // 1. curators кестесі
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

    // curators кестесіне жетіспейтін бағандарды мәжбүрлі қосу
    await pool.query(`ALTER TABLE curators ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);`);
    await pool.query(`ALTER TABLE curators ADD COLUMN IF NOT EXISTS stream_id VARCHAR(50) DEFAULT '01';`);
    await pool.query(`ALTER TABLE curators ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';`);

    // 2. st_recordings кестесі
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

    // st_recordings кестесіне жетіспейтін бағандарды мәжбүрлі қосу
    await pool.query(`ALTER TABLE st_recordings ADD COLUMN IF NOT EXISTS curator_id INT;`);
    await pool.query(`ALTER TABLE st_recordings ADD COLUMN IF NOT EXISTS stream_id VARCHAR(50) DEFAULT '01';`);
    await pool.query(`ALTER TABLE st_recordings ADD COLUMN IF NOT EXISTS month_num INT DEFAULT 1;`);
    await pool.query(`ALTER TABLE st_recordings ADD COLUMN IF NOT EXISTS video_links TEXT[];`);
    await pool.query(`ALTER TABLE st_recordings ADD COLUMN IF NOT EXISTS attendance_links TEXT[];`);
    await pool.query(`ALTER TABLE st_recordings ADD COLUMN IF NOT EXISTS meet_codes TEXT[];`);
    await pool.query(`ALTER TABLE st_recordings ADD COLUMN IF NOT EXISTS meet_links TEXT[];`);

    console.log('✅ Деректер базасының БАРЛЫҚ кестелері мен бағандары 100% жаңартылды!');
  } catch (err) {
    console.error('❌ Таблица жасауда қателік:', err.message);
  }
};

module.exports = createTables;