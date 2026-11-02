require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const { validatePassword } = require('../src/utils/validation');

async function main() {
  const { STAFF_NAME: name, STAFF_EMAIL: email, STAFF_PASSWORD: password } = process.env;
  if (!name || !email || !password) throw new Error('Set STAFF_NAME, STAFF_EMAIL and STAFF_PASSWORD in .env.');
  validatePassword(password);
  await connectDB(process.env.MONGODB_URI);
  await User.init();
  await User.create({ name, email, password: await bcrypt.hash(password, 12), role: 'staff' });
  console.log('Staff account created. Log in through POST /api/auth/login.');
}
main().catch(error => {
  console.error(error.code === 11000 ? 'This email already exists. No account was changed.' : 'Staff setup failed. Check configuration and database access.');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
