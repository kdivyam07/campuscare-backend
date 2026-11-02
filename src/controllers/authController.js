const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { bodyFields, validatePassword, fail } = require('../utils/validation');

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function authResponse(res, status, user) {
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: user.id, algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
  res.status(status).json({ success: true, token, user: publicUser(user) });
}

async function register(req, res) {
  bodyFields(req.body, ['name', 'email', 'password'], ['name', 'email', 'password']);
  validatePassword(req.body.password);
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: await bcrypt.hash(req.body.password, 12),
    role: 'student'
  });
  authResponse(res, 201, user);
}

async function login(req, res) {
  bodyFields(req.body, ['email', 'password'], ['email', 'password']);
  validatePassword(req.body.password);
  const user = await User.findOne({ email: req.body.email.trim().toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) fail(401, 'Invalid email or password.');
  authResponse(res, 200, user);
}

function me(req, res) {
  res.json({ success: true, user: publicUser(req.user) });
}

module.exports = { register, login, me };
