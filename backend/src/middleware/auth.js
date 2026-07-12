const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Токен жоқ' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.curatorId = decoded.id;
    req.curatorRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: 'Токен жарамсыз' });
  }
};

// auth-тан кейін қолдану керек — req.curatorRole соған тәуелді
const requireAdmin = (req, res, next) => {
  if (req.curatorRole !== 'admin') return res.status(403).json({ error: 'Тек admin рұқсаты бар' });
  next();
};

// Сапа трекеріне admin және сапа менеджері кіре алады
const requireQuality = (req, res, next) => {
  if (req.curatorRole !== 'admin' && req.curatorRole !== 'quality_manager') {
    return res.status(403).json({ error: 'Тек сапа менеджері/admin рұқсаты бар' });
  }
  next();
};

module.exports = auth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireQuality = requireQuality;
