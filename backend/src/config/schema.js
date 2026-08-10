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
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(150);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;`);

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

    // curators.user_id: full_name+subject+stream_id жол сәйкестігінің орнына
    // накты FK — есімнің емлесі өзгерсе де (Куандык/Қуандық) байланыс үзілмейді.
    await pool.query(`ALTER TABLE curators ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id);`);
    // Бұрын құрылған, user_id әлі толтырылмаған жолдарды бір рет байланыстыру.
    // Идемпотентті: тек user_id IS NULL жолдарға ғана әсер етеді, қайта іске
    // қосылса да қауіпсіз.
    await pool.query(`
      UPDATE curators c SET user_id = sub.id FROM (
        SELECT DISTINCT ON (full_name, subject, stream_id) id, full_name, subject, stream_id
        FROM users
        ORDER BY full_name, subject, stream_id, id DESC
      ) sub
      WHERE c.user_id IS NULL
        AND c.full_name = sub.full_name AND c.subject = sub.subject AND c.stream_id = sub.stream_id;
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

    // 4. st_bookings кестесі — бір st_recordings жолында (куратордың бір
    // аптасында) бірнеше бекітілген уақыт болуы мүмкін (СТ + жеке сөйлесу,
    // немесе бірнеше СТ) — meet_codes/meet_links массивтерінің орнына
    // әрқайсысының өз түрі, оқушы саны және нақты уақыты сақталады.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS st_bookings (
        id SERIAL PRIMARY KEY,
        recording_id INT NOT NULL REFERENCES st_recordings(id) ON DELETE CASCADE,
        meeting_type VARCHAR(20) NOT NULL DEFAULT 'st',
        students_count VARCHAR(50),
        scheduled_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        meet_link TEXT,
        meet_code VARCHAR(100),
        calendar_event_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. recording_reviews — координатор/тексеруші бір жазбаға жазатын
    // бағалау (Google Doc-та қолмен жазылып жүрген «Ескерту/Ұсыныс»
    // кестесінің орнын алады). Бір st_recordings жолында бір ғана бағалау
    // болады — қайта ашса, соны жаңартады.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recording_reviews (
        id SERIAL PRIMARY KEY,
        recording_id INT NOT NULL UNIQUE REFERENCES st_recordings(id) ON DELETE CASCADE,
        reviewer_id INT REFERENCES users(id),
        no_issues BOOLEAN NOT NULL DEFAULT false,
        recommendation TEXT,
        source VARCHAR(20) NOT NULL DEFAULT 'site',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Ескі жолдарда болмауы мүмкін бағанды бөлек қосамыз — CREATE TABLE
    // IF NOT EXISTS қайта іске қосылғанда жаңа бағанды өзі қоспайды.
    await pool.query(`ALTER TABLE recording_reviews ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'site';`);

    // 6. review_findings — бір бағалаудың ішіндегі, нақты видео сәтіне
    // байланған ескертулер. video_url — сол жазбаның video_links
    // ішіндегі қайсысы екенін білдіреді (бір куратор бір аптада бірнеше
    // рет жазып қоюы мүмкін). timestamp_seconds — «осы сәтті белгіле»
    // батырмасы видео плеерден өзі алатын сан, қолмен теру қажет емес.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS review_findings (
        id SERIAL PRIMARY KEY,
        review_id INT NOT NULL REFERENCES recording_reviews(id) ON DELETE CASCADE,
        video_url TEXT,
        timestamp_seconds INT,
        description TEXT NOT NULL,
        screenshot_url TEXT,
        order_index INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. review_student_notes — «Рейтинг балл сәйкестігі» бөлімінің
    // орны: оқушы бойынша жеке ескерту («талапқа сай» немесе нақты
    // мәселе, мыс. «10,15 есептің жолын жазбаған»).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS review_student_notes (
        id SERIAL PRIMARY KEY,
        review_id INT NOT NULL REFERENCES recording_reviews(id) ON DELETE CASCADE,
        student_name TEXT NOT NULL,
        ok BOOLEAN NOT NULL DEFAULT true,
        note TEXT,
        order_index INT NOT NULL DEFAULT 0
      );
    `);

    console.log('✅ Деректер базасы мен пайдаланушылар толық дайын!');
  } catch (err) {
    console.error('❌ Schema error:', err.message);
  }
};

module.exports = createTables;