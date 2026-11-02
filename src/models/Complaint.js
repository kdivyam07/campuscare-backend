const mongoose = require('mongoose');

const categories = ['Electrical', 'Plumbing', 'Wi-Fi', 'Furniture', 'Cleaning', 'Other'];
const statuses = ['Pending', 'In Progress', 'Resolved'];
const complaintSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, required: true, enum: categories },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  status: { type: String, enum: statuses, default: 'Pending' },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
complaintSchema.index({ student: 1, createdAt: -1 });

module.exports = { Complaint: mongoose.model('Complaint', complaintSchema), categories, statuses };
