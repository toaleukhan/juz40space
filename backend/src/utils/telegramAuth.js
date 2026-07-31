const crypto = require('crypto');

// Telegram Mini App-тың initData-сын құжатталған алгоритм бойынша тексереді:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
//
// 1. hash кілтін алып тастап, қалғанын кілт бойынша сұрыптап, "key=value"
//    жолдарын \n-мен біріктіріп data-check-string құрамыз
// 2. secretKey = HMAC-SHA256("WebAppData", botToken)
// 3. computedHash = HMAC-SHA256(secretKey, dataCheckString)
// 4. computedHash initData-дағы hash-пен дәл сәйкес келуі керек
//
// Сәтсіз болса throw жасайды — қолданушыны шатастырмас үшін эндпоинт
// деңгейінде түсінікті қазақша хабарламаға айналдырылады.
function verifyInitData(initData, botToken, { maxAgeSeconds = 86400 } = {}) {
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN орнатылмаған');
  if (!initData) throw new Error('initData жоқ');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('initData-да hash жоқ');
  params.delete('hash');

  const pairs = [];
  for (const [key, value] of params.entries()) pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const hashBuf = Buffer.from(hash, 'hex');
  const computedBuf = Buffer.from(computedHash, 'hex');
  if (hashBuf.length !== computedBuf.length || !crypto.timingSafeEqual(hashBuf, computedBuf)) {
    throw new Error('Telegram қолтаңбасы жарамсыз');
  }

  const authDate = parseInt(params.get('auth_date'), 10);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    throw new Error('Telegram initData мерзімі өтіп кеткен');
  }

  const userJson = params.get('user');
  const user = userJson ? JSON.parse(userJson) : null;
  if (!user || !user.id) throw new Error('Telegram user деректері жоқ');

  return {
    id: user.id,
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    username: user.username || '',
  };
}

module.exports = { verifyInitData };
