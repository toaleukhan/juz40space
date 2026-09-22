#!/usr/bin/env node
// Сапа менеджері үшін жеке admin аккаунты — бір реттік құру.
// SQL-ды Railway терминалына қолмен қоймай, dbimport-review-doc.js /
// create-fiz11.js сияқты Node арқылы жасаймыз (кириллица бұзылмайды,
// /app контейнерінің шелі база консолі емес).
//
// Әдепкі — dry-run, базаға ЕШНӘРСЕ жазбайды. Шынымен жазу үшін:
//   node scripts/create-custdev-admin.js --apply
//
// Қайта жүргізуге қауіпсіз: логин бұрыннан бар болса, ештеңе өзгермейді.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../src/config/db');

const APPLY = process.argv.includes('--apply');

const FULL_NAME = 'Толеухан Жеңіс';
const USERNAME = 'zhengis';
const ROLE = 'admin';
const SUBJECT = 'ALL';
const STREAM = '01';

// Ауызша айтуға да, теруге де ыңғайлы, бірақ болжауға келмейтін пароль.
// Шатасатын таңбалар (l, o, 0, 1) әдейі алынып тасталған.
const ALPHA = 'abcdefghijkmnpqrstuvwxyz';
const DIGIT = '23456789';
const pick = (set) => set[crypto.randomInt(set.length)];
const makePassword = () =>
  Array.from({ length: 5 }, () => pick(ALPHA)).join('') +
  Array.from({ length: 3 }, () => pick(DIGIT)).join('');

async function run() {
  const existing = await pool.query('SELECT id, username FROM users WHERE username = $1', [USERNAME]);
  if (existing.rows.length) {
    console.log(`"${USERNAME}" логині бұрыннан бар (id=${existing.rows[0].id}) — ештеңе өзгертілмеді.`);
    await pool.end();
    return;
  }

  const password = makePassword();
  console.log(`${APPLY ? 'Құрылады' : 'Құрылатын болады'}:`);
  console.log(`  Аты-жөні : ${FULL_NAME}`);
  console.log(`  Логин    : ${USERNAME}`);
  console.log(`  Пароль   : ${password}`);
  console.log(`  Рөлі     : ${ROLE}`);

  if (!APPLY) {
    console.log('\n(Бұл dry-run — база өзгерген жоқ. Жазу үшін: node scripts/create-custdev-admin.js --apply)');
    console.log('ЕСКЕРТУ: --apply кезінде пароль ҚАЙТА генерацияланады, сондықтан жоғарыдағы');
    console.log('парольді емес, --apply шығарған паролді сақтаңыз.');
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (username, password, full_name, role, subject, stream_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [USERNAME, hash, FULL_NAME, ROLE, SUBJECT, STREAM]
  );

  console.log('\n✅ Аккаунт құрылды. Пароль тек осы жерде көрсетіледі — базада хэш түрінде сақталады.');
  console.log('Кірген соң профильден паролді өзгертіңіз.');
  await pool.end();
}

run().catch((err) => { console.error('Қате:', err.message); process.exit(1); });
