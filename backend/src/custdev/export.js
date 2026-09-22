// Раундты олардың Google Doc-тағы протокол пішініне сай мәтінге жинау:
// рөл бойынша топтар («ОҚУШЫЛАР» т.б.), әр сұхбат — тақырыбы, жазба
// сілтемесі, содан кейін «N. Сұрақ: … / Жауап: …» қатары. Copy-paste
// арқылы тікелей Google Doc-қа қоюға болатындай таза мәтін.

const { ROLE_LABEL } = require('./questions');

const SECTION_TITLE = { curator: 'КУРАТОРЛАР', student: 'ОҚУШЫЛАР', parent: 'АТА-АНА' };
const SECTION_ORDER = ['student', 'parent', 'curator'];

function sessionHeader(s) {
  const lines = [];
  const namePart = s.groupCode ? `${s.respondentName} - ${s.groupCode}` : s.respondentName;
  lines.push(namePart);
  if (s.role === 'student' && s.curatorName) lines.push(`(${s.curatorName})`);
  if (s.meetTimeLabel) lines.push(`Уақыты: ${s.meetTimeLabel}`);
  lines.push(`Запись сілтемесі: ${s.recordingRef || '—'}`);
  return lines.join('\n');
}

function sessionBody(s) {
  if (!Array.isArray(s.protocol) || !s.protocol.length) return '(протокол әлі дайын емес)';
  return s.protocol.map((qa, i) => `${i + 1}. Сұрақ: ${qa.question}\nЖауап: ${qa.answer}`).join('\n\n');
}

function exportRoundText(round, sessions) {
  const parts = [round.title];
  if (round.note) parts.push(round.note);
  parts.push('');

  for (const role of SECTION_ORDER) {
    const list = sessions.filter((s) => s.role === role);
    if (!list.length) continue;
    parts.push(SECTION_TITLE[role] || ROLE_LABEL[role]);
    for (const s of list) {
      parts.push(sessionHeader(s));
      parts.push('');
      parts.push(sessionBody(s));
      parts.push('');
    }
  }

  return parts.join('\n').trim() + '\n';
}

module.exports = { exportRoundText };
