const pool = require('./db');

const PHYS_CURATORS = [
  'Орынбек Меруерт',
  'Жұбатбек Алия',
  'Мұратқызы Сағыныш',
  'Семгалиева Мадина Нұрлыбековна',
  'Темірхан Нұржас Жандосұлы',
  'Мирзабек Аяулым',
  'Ерғали Айкүміс',
  'Серік Дарын',
  'Амит Алтынай',
  'Сарқытбекова Аяжан',
  'Таубай Аяжан',
  'Нұрат Гүлжаз Ғалымқызы',
  'Халидолла Ислам Арманұлы',
  'Аждаров Аңсар',
  'Қыдырбай Ерасыл',
  'Қалмырзаев Ернар Бимағанбетұлы',
  'Алмасов Данияр',
  'Бегалы Алтынай',
  'Хидирова Фатима',
  'Арайлым Қанафия',
  'Меңлібек Қаракөз',
  'Жансая Қуандық'
];

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS curators (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      curator_id INTEGER REFERENCES curators(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id SERIAL PRIMARY KEY,
      curator_id INTEGER UNIQUE REFERENCES curators(id) ON DELETE CASCADE,
      session_data TEXT,
      is_connected BOOLEAN DEFAULT FALSE,
      connected_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      curator_id INTEGER REFERENCES curators(id),
      group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      message_text TEXT NOT NULL,
      total_sent INTEGER DEFAULT 0,
      total_failed INTEGER DEFAULT 0,
      sent_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id SERIAL PRIMARY KEY,
      message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      sent_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedule_overrides (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS st_recordings (
      id SERIAL PRIMARY KEY,
      subject VARCHAR(50) NOT NULL,
      month_id VARCHAR(10) NOT NULL,
      week_num INTEGER NOT NULL DEFAULT 1,
      curator_name VARCHAR(255) NOT NULL,
      students_count VARCHAR(50) DEFAULT '0',
      meet_code VARCHAR(50),
      meet_link TEXT,
      video_link TEXT,
      attendance_link TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // ФИЗ-01 кураторларын тексеру және жаңарту
  const checkPhys = await pool.query(
    "SELECT COUNT(*) FROM st_recordings WHERE subject = 'ФИЗ' AND month_id = '01' AND week_num = 1"
  );

  const count = parseInt(checkPhys.rows[0].count);
  if (count === 0 || count !== PHYS_CURATORS.length) {
    await pool.query("DELETE FROM st_recordings WHERE subject = 'ФИЗ' AND month_id = '01' AND week_num = 1");
    for (const name of PHYS_CURATORS) {
      await pool.query(
        `INSERT INTO st_recordings (subject, month_id, week_num, curator_name)
         VALUES ('ФИЗ', '01', 1, $1)`,
        [name]
      );
    }
    console.log('✅ ФИЗ-01 ағымының 22 кураторы сәтті қосылды!');
  }

  console.log('✅ Tables created');
};

module.exports = createTables;