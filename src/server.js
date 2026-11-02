require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const app = require('./app');

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) {
    throw new Error('Set JWT_SECRET to a random secret of at least 32 characters.');
  }
  await connectDB(process.env.MONGODB_URI);
  // Ensure the unique email index exists before accepting registration requests.
  await Promise.all([require('./models/User').init(), require('./models/Complaint').Complaint.init()]);
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const server = app.listen(port, () => console.log(`CampusCare running at http://localhost:${port}`));
  server.on('error', async () => {
    console.error('Server could not listen. Check PORT and whether another app is using it.');
    await mongoose.disconnect();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      const timeout = setTimeout(() => process.exit(1), 10000);
      timeout.unref();
      server.close(async () => {
        await mongoose.disconnect();
        clearTimeout(timeout);
      });
    });
  }
  return server;
}

if (require.main === module) {
  start().catch(async error => {
    console.error('Startup failed:', error.name === 'MongooseServerSelectionError' ? 'Cannot reach MongoDB. Check your URI, database user, and Atlas IP access list.' : error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}
module.exports = start;
