const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, maxlength: 254 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'staff'], default: 'student' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
