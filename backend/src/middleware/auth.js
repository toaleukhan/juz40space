const jwt = require('jsonwebtoken');

const JWT_SECRET = require('../config/jwtSecret');

// «media» (Media team тимлиді) — тек TikTok бөлімі мен өз профилі. Көп
// маршрут «куратор/координатор емес = бәрін көреді» деп тексереді, сондықтан
// бұл рөлді жеке маршруттарға сенбей, осы жерде бір рет шектейміз.
const MEDIA_ALLOWED = ['/api/tiktok', '/api/auth'];
function mediaMayAccess(role, url) {
  if (role !== 'media') return true;
  const path = String(url || '').split('?')[0];
  return MEDIA_ALLOWED.some((p) => path === p || path.startsWith(p + '/'));
}

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Токен жоқ' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!mediaMayAccess(decoded.role, req.originalUrl)) {
      return res.status(403).json({ error: 'Бұл бөлімге рұқсат жоқ' });
    }
    req.user = decoded;
    req.curatorId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Токен жарамсыз' });
  }
};

module.exports = authMiddleware;
module.exports.mediaMayAccess = mediaMayAccess;
