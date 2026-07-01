const pool = require('./db');

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS curators (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'curator',
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Ертеректе жасалған curators кестесінде role бағаны болмауы мүмкін
    ALTER TABLE curators ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'curator';

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

    -- Барлық кураторлар үшін ортақ, "Басқару → Енгізу" арқылы қолмен қосылған сабақтар.
    -- Бір ғана жол (singleton) — бұрын браузердің localStorage-інде ғана сақталушы еді.
    CREATE TABLE IF NOT EXISTS schedule_overrides (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Admin әрекеттерінің тарихы (кесте өзгерту, docx парсинг)
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      curator_id INTEGER REFERENCES curators(id),
      action VARCHAR(50) NOT NULL,
      entity VARCHAR(50) NOT NULL,
      details JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('✅ Tables created');
};

module.exports = createTables;
