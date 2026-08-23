#!/usr/bin/env node
// ФИЗ-11 ағымының аккаунттарын бір реттік құру.
//
// Неге бөлек скрипт: SQL-ді Railway терминалына қолмен қою сенімсіз —
// кириллица жол-жөнекей бұзылады, әрі /app контейнерінің шелі база
// консолі емес. Мұнда бәрі Node арқылы, дәл import-review-doc.js
// сияқты жүреді.
//
// Әдепкі — dry-run, базаға ЕШНӘРСЕ жазбайды. Шынымен жазу үшін:
//   node scripts/create-fiz11.js --apply
//
// Қайта жүргізуге қауіпсіз: бар аккаунт қайта құрылмайды, паролі де
// өзгермейді.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../src/config/db');

const SUBJECT = 'ФИЗ';
const STREAM = '11';
const APPLY = process.argv.includes('--apply');

const CURATORS = [
  'Орынғали Бекарыс',
  'Жолмырза Әбілқасым',
  'Мейрман Саян',
  'Ізбасар Гүлдана',
  'Тасқұл Жәудір',
  'Инаятова Алма',
  'Аманғазы Балнұр',
  'Қорғанбекова Аида',
  'Асем Садық',
  'Тлеубаева Жайна',
  'Болат Айдана',
  'Бекенов Таир',
  'Сексеналина Жансая',
  'Ермекұлы Ерасыл',
  'Абиш Ақниет',
];

const COORDINATOR = 'Тұрарова Аруна';

// Мадина ФИЗ-01-де бұрыннан тіркелген — оған жаңа аккаунт құрылмайды,
// бар аккаунты ФИЗ-11-ге көшіріледі. Логині мен паролі сол күйінде қалады.
const MOVE_FROM_01 = 'Семгалиева Мадина';

// Қазақ-кирилл → латын, тек логин құрау үшін.
const TRANSLIT = {
  а: 'a', ә: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'i', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', ң: 'n', о: 'o',
  ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ұ: 'u', ү: 'u', ф: 'f', х: 'h',
  һ: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', і: 'i', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

const translit = (s) => s.toLowerCase().split('')
  .map((c) => (TRANSLIT[c] !== undefined ? TRANSLIT[c] : /[a-z0-9]/.test(c) ? c : ''))
  .join('');

// Логин ағыммен ажыратылады: бір тек басқа ағымда да кездесуі мүмкін,
// ал users.username бірегей болуға тиіс.
const baseUsername = (fullName) => `fiz${STREAM}_${translit(fullName.trim().split(/\s+/)[0])}`;

// Ауызша айтуға да, теруге де ыңғайлы, бірақ болжауға келмейтін пароль.
// Шатасатын таңбалар (l, o, 0, 1) әдейі алынып тасталған.
const ALPHA = 'abcdefghijkmnpqrstuvwxyz';
const DIGIT = '23456789';
const pick = (set) => set[crypto.randomInt(set.length)];
const makePassword = () =>
  Array.from({ length: 4 }, () => pick(ALPHA)).join('') +
  Array.from({ length: 3 }, () => pick(DIGIT)).join('');

async function freeUsername(fullName) {
  const base = baseUsername(fullName);
  let name = base;
  for (let i = 2; i < 50; i++) {
    const { rows } = await pool.query('SELECT 1 FROM users WHERE username = $1', [name]);
    if (!rows.length) return name;
    name = `${base}${i}`;
  }
  throw new Error(`Бос логин табылмады: ${base}`);
}

async function ensureAccount(fullName, role, created, skipped) {
  const existing = await pool.query(
    'SELECT id, username FROM users WHERE full_name = $1 AND subject = $2 AND stream_id = $3',
    [fullName, SUBJECT, STREAM]
  );
  if (existing.rows.length) {
    skipped.push({ fullName, username: existing.rows[0].username, why: 'бұрыннан бар' });
    return;
  }

  const username = await freeUsername(fullName);
  const password = makePassword();
  created.push({ fullName, username, password, role });
  if (!APPLY) return;

  const hash = await bcrypt.hash(password, 10);
  const { rows: [user] } = await pool.query(
    `INSERT INTO users (username, password, full_name, role, subject, stream_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [username, hash, fullName, role, SUBJECT, STREAM]
  );

  // curators кестесі — СТ-жазбаларының авто-синхрондауы соны қолданады.
  // Координатор бұл кестеге кірмейді.
  if (role !== 'curator') return;
  const cur = await pool.query(
    'SELECT id FROM curators WHERE full_name = $1 AND subject = $2 AND stream_id = $3',
    [fullName, SUBJECT, STREAM]
  );
  if (cur.rows.length) {
    await pool.query('UPDATE curators SET user_id = $1 WHERE id = $2', [user.id, cur.rows[0].id]);
  } else {
    await pool.query(
      `INSERT INTO curators (full_name, subject, stream_id, status, user_id)
       VALUES ($1, $2, $3, 'active', $4)`,
      [fullName, SUBJECT, STREAM, user.id]
    );
  }
}

// Бар аккаунтты ағымнан ағымға көшіру. Ескі СТ-жазбалары әдейі
// қозғалмайды: ол жұмыс ФИЗ-01-де істелген, сапа кестесінің ФИЗ-01
// табы соларға сілтейді.
async function moveStream(fullName, notes) {
  const { rows } = await pool.query(
    'SELECT id, username, stream_id FROM users WHERE full_name = $1 AND subject = $2',
    [fullName, SUBJECT]
  );
  if (!rows.length) {
    notes.push(`⚠️  "${fullName}" ФИЗ бойынша табылмады — қолмен тексеру керек.`);
    return;
  }
  if (rows.length > 1) {
    notes.push(`⚠️  "${fullName}" бойынша ${rows.length} аккаунт бар (${rows.map(r => `${r.username}:${r.stream_id}`).join(', ')}) — қолмен шешу керек.`);
    return;
  }

  const user = rows[0];
  if (user.stream_id === STREAM) {
    notes.push(`• "${fullName}" (${user.username}) — ФИЗ-${STREAM}-де тұр, өзгеріс керек емес.`);
    return;
  }

  notes.push(`• "${fullName}" (${user.username}) — ФИЗ-${user.stream_id} → ФИЗ-${STREAM}. Логин мен пароль өзгермейді.`);
  if (!APPLY) return;

  await pool.query('UPDATE users SET stream_id = $1 WHERE id = $2', [STREAM, user.id]);
  await pool.query(
    'UPDATE curators SET stream_id = $1 WHERE user_id = $2',
    [STREAM, user.id]
  );
}

async function run() {
  const created = [], skipped = [], notes = [];

  for (const name of CURATORS) await ensureAccount(name, 'curator', created, skipped);
  await ensureAccount(COORDINATOR, 'coordinator', created, skipped);
  await moveStream(MOVE_FROM_01, notes);

  if (notes.length) {
    console.log('\n── Ағым ауыстыру ──');
    notes.forEach((n) => console.log(n));
  }

  if (skipped.length) {
    console.log('\n── Өткізілді (бұрыннан бар) ──');
    skipped.forEach((s) => console.log(`• ${s.fullName} — ${s.username} (${s.why})`));
  }

  console.log(`\n── ${APPLY ? 'Құрылды' : 'Құрылатын'} аккаунттар: ${created.length} ──\n`);
  if (created.length) {
    const pad = (s, n) => String(s).padEnd(n, ' ');
    console.log(pad('АТЫ-ЖӨНІ', 24), pad('ЛОГИН', 22), pad('ПАРОЛЬ', 10), 'РӨЛ');
    console.log('-'.repeat(70));
    created.forEach((c) => console.log(
      pad(c.fullName, 24), pad(c.username, 22), pad(c.password, 10),
      c.role === 'coordinator' ? 'координатор' : 'куратор'
    ));
  }

  if (!APPLY) {
    console.log('\n(Бұл dry-run — база өзгерген жоқ. Жазу үшін: node scripts/create-fiz11.js --apply)');
    console.log('ЕСКЕРТУ: --apply кезінде парольдер ҚАЙТА генерацияланады, сондықтан');
    console.log('жоғарыдағы парольдерді емес, --apply шығарған тізімді таратыңыз.');
  } else {
    console.log('\nПарольдер тек осы жерде көрсетіледі — базада хэш түрінде сақталады.');
    console.log('Кураторларға жеке жіберіп, кірген соң профильден өзгертуін айтыңыз.');
  }

  await pool.end();
}

run().catch((err) => { console.error('Қате:', err.message); process.exit(1); });
