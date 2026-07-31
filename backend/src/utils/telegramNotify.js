// Куратор Мит ашқан сайын, сол пән/ағымның координаторына (Telegram-мен
// байланыстырылған болса) хабарлама жібереді. Best-effort — координатор
// жоқ болса, Telegram жіберу сәтсіз болса да, брондау процесіне кедергі
// жасамайды (қателер осы файлдың ішінде "жұтылады", тек логқа жазылады).

function formatBookingMessage({ subject, streamId, curatorName, type, studentsCount, scheduledDate, startTime, endTime, meetLink }) {
  const [y, m, d] = String(scheduledDate).slice(0, 10).split('-');
  const dateLabel = (y && m && d) ? `${d}.${m}.${y}` : String(scheduledDate);
  const isPersonal = type === 'personal';

  const lines = [`${subject}-${streamId} ${curatorName}${isPersonal ? ' (Жеке сөйлесу)' : ''}`];
  if (!isPersonal) lines.push(`Оқушы саны: ${studentsCount || 0}`);
  lines.push(`Уақыты: ${dateLabel} ${String(startTime).slice(0, 5)}–${String(endTime).slice(0, 5)}`);
  lines.push(`Сілтемесі: ${meetLink || '—'}`);
  return lines.join('\n');
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error(`Telegram sendMessage сәтсіз (chat ${chatId}):`, res.status, await res.text());
    }
  } catch (err) {
    console.error(`Telegram хабарлама жіберу қатесі (chat ${chatId}):`, err.message);
  }
}

async function notifyCoordinatorsOfBooking(pool, booking) {
  try {
    const coordinators = await pool.query(
      `SELECT telegram_id FROM users WHERE role = 'coordinator' AND subject = $1 AND stream_id = $2 AND telegram_id IS NOT NULL`,
      [booking.subject, booking.streamId]
    );
    if (!coordinators.rows.length) return;
    const text = formatBookingMessage(booking);
    await Promise.all(coordinators.rows.map(row => sendTelegramMessage(row.telegram_id, text)));
  } catch (err) {
    console.error('Координаторларды іздеу қатесі:', err.message);
  }
}

module.exports = { formatBookingMessage, sendTelegramMessage, notifyCoordinatorsOfBooking };
