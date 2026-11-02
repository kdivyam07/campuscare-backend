// A real temporary MongoDB process for a quick laptop demonstration; no Atlas needed.
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
const start = require('../src/server');
const User = require('../src/models/User');

async function main() {
  const database = await MongoMemoryServer.create();
  process.env.MONGODB_URI = database.getUri('campuscare_demo');
  let server;
  try {
    server = await start({ handleSignals: false });
    await User.init();
    await User.create({ name: 'Demo Maintenance Staff', email: 'staff@campus.edu', password: await bcrypt.hash('StaffDemo123!', 12), role: 'staff' });
    console.log('TEMPORARY DEMO: data is deleted when this process stops.');
    console.log('Staff login: staff@campus.edu / StaffDemo123!');
    let stopping = false;
    const cleanup = async () => {
      if (stopping) return;
      stopping = true;
      if (server.listening) await new Promise(resolve => server.close(resolve));
      await mongoose.disconnect();
      await database.stop();
    };
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    server.once('error', cleanup);
  } catch (error) {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await database.stop();
    throw error;
  }
}
main().catch(error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'Demo startup failed: port already in use. Stop the previous server or choose another PORT.'
    : 'Demo startup failed. Check the MongoDB binary download/network, or configure Atlas and run npm start.');
  process.exitCode = 1;
});
