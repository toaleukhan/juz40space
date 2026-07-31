const jwt = require('jsonwebtoken');

const JWT_SECRET = require('../config/jwtSecret');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Токен жоқ' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.curatorId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Токен жарамсыз' });
  }
};
