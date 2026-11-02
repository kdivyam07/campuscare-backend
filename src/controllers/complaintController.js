const { Complaint, categories, statuses } = require('../models/Complaint');
const { bodyFields, fail } = require('../utils/validation');
const editableFields = ['title', 'description', 'category', 'location'];

// Adding ownership to database queries prevents access to another student's data.
function scope(req) {
  return req.user.role === 'staff' ? {} : { student: req.user._id };
}

async function create(req, res) {
  bodyFields(req.body, editableFields, editableFields);
  const complaint = await Complaint.create({ ...req.body, student: req.user._id });
  res.status(201).json({ success: true, complaint });
}

async function list(req, res) {
  const filter = scope(req);
  for (const key of Object.keys(req.query)) {
    if (!['status', 'category', 'page', 'limit'].includes(key)) fail(400, `Unknown query: ${key}`);
  }
  for (const [key, values] of [['status', statuses], ['category', categories]]) {
    if (req.query[key] !== undefined) {
      if (!values.includes(req.query[key])) fail(400, `Invalid ${key}.`);
      filter[key] = req.query[key];
    }
  }
  function positiveInteger(value, fallback, max) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
      fail(400, 'Invalid page or limit.');
    }
    return Number(value);
  }
  const page = positiveInteger(req.query.page, 1, 1000000);
  const limit = positiveInteger(req.query.limit, 20, 100);
  const [complaints, total] = await Promise.all([
    Complaint.find(filter).populate('student', 'name email').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Complaint.countDocuments(filter)
  ]);
  res.json({ success: true, page, limit, total, complaints });
}

async function read(req, res) {
  const complaint = await Complaint.findOne({ _id: req.params.id, ...scope(req) }).populate('student', 'name email');
  if (!complaint) fail(404, 'Complaint not found.');
  res.json({ success: true, complaint });
}

async function edit(req, res) {
  bodyFields(req.body, editableFields);
  // Match Pending in the update itself so a concurrent staff status change is respected.
  const complaint = await Complaint.findOneAndUpdate({ _id: req.params.id, student: req.user._id, status: 'Pending' },
    { $set: req.body }, { returnDocument: 'after', runValidators: true });
  if (!complaint) {
    const exists = await Complaint.exists({ _id: req.params.id, ...scope(req) });
    fail(exists ? 409 : 404, exists ? 'Only pending complaints can be edited.' : 'Complaint not found.');
  }
  res.json({ success: true, complaint });
}

async function updateStatus(req, res) {
  bodyFields(req.body, ['status'], ['status']);
  const complaint = await Complaint.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { returnDocument: 'after', runValidators: true });
  if (!complaint) fail(404, 'Complaint not found.');
  res.json({ success: true, complaint });
}

async function remove(req, res) {
  const complaint = await Complaint.findOneAndDelete({ _id: req.params.id, student: req.user._id, status: 'Pending' });
  if (!complaint) {
    const exists = await Complaint.exists({ _id: req.params.id, ...scope(req) });
    fail(exists ? 409 : 404, exists ? 'Only pending complaints can be withdrawn.' : 'Complaint not found.');
  }
  res.json({ success: true, message: 'Complaint withdrawn.' });
}

module.exports = { create, list, read, edit, updateStatus, remove };
