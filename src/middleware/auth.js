const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { fail } = require('../utils/validation');

async function protect(req, res, next) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
  if (!match) fail(401, 'A Bearer token is required.');
  let payload;
  try {
    payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    fail(401, 'Invalid or expired token.');
  }
  if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) fail(401, 'Invalid token.');
  req.user = await User.findById(payload.sub);
  if (!req.user) fail(401, 'Account no longer exists.');
  next();
}

function allowRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) fail(403, `Only ${role} accounts can perform this action.`);
    next();
  };
}

module.exports = { protect, allowRole };
