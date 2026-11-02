const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) throw new Error('Set MONGODB_URI in .env before starting the server.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

module.exports = connectDB;
