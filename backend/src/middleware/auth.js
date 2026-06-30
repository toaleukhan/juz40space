const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Токен жоқ' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.curatorId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Токен жарамсыз' });
  }
};
