const bcrypt = require('bcryptjs');

// Кириллица (қазақша әріптерді қоса) -> латын, логин үшін
const MAP = {
  а:'a', ә:'a', б:'b', в:'v', г:'g', ғ:'g', д:'d', е:'e', ё:'e', ж:'zh',
  з:'z', и:'i', й:'i', к:'k', қ:'q', л:'l', м:'m', н:'n', ң:'ng', о:'o',
  ө:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ұ:'u', ү:'u', ф:'f', х:'h',
  һ:'h', ц:'c', ч:'ch', ш:'sh', щ:'sh', ъ:'', ы:'y', і:'i', ь:'', э:'e',
  ю:'yu', я:'ya',
};

function translit(str) {
  return str
    .toLowerCase()
    .split('')
    .map(ch => (ch in MAP ? MAP[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

// Аты-жөннен бірегей логин құрайды (users.username бос емес болса, соңына сан қосады)
async function makeUsername(fullName, pool) {
  const base = translit(fullName) || 'curator';
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await pool.query('SELECT id FROM users WHERE username = $1', [candidate]);
    if (exists.rows.length === 0) return candidate;
    n += 1;
    candidate = `${base}${n}`;
  }
}

const PWD_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // ұқсас әріптер (0/O, 1/l) алынып тасталды
function makePassword(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) out += PWD_CHARS[Math.floor(Math.random() * PWD_CHARS.length)];
  return out;
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

module.exports = { translit, makeUsername, makePassword, hashPassword };
