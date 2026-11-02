const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
const app = require('../src/app');
const User = require('../src/models/User');
const { Complaint } = require('../src/models/Complaint');
let database, studentToken, otherToken, staffToken, complaintId;
const complaint = { title: 'Broken classroom fan', description: 'The ceiling fan does not rotate.', category: 'Electrical', location: 'Block A, Room 203' };
const auth = token => ({ Authorization: `Bearer ${token}` });

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri('campuscare_test'));
  await Promise.all([User.init(), Complaint.init()]);
});
after(async () => {
  await mongoose.disconnect();
  if (database) await database.stop();
});

test('register students, hash passwords, and reject privilege escalation', async () => {
  await request(app).post('/api/auth/register').send({ name: 'Intruder', email: 'intruder@campus.edu', password: 'Password123!', role: 'staff' }).expect(400);
  const response = await request(app).post('/api/auth/register').send({ name: 'Student One', email: 'student@campus.edu', password: 'Password123!' }).expect(201);
  studentToken = response.body.token;
  assert.equal(response.body.user.role, 'student');
  assert.equal(response.body.user.password, undefined);
  const stored = await User.findById(response.body.user.id).select('+password');
  assert.notEqual(stored.password, 'Password123!');
  assert.equal(await bcrypt.compare('Password123!', stored.password), true);
  const other = await request(app).post('/api/auth/register').send({ name: 'Other Student', email: 'other@campus.edu', password: 'Password123!' }).expect(201);
  otherToken = other.body.token;
  await request(app).post('/api/auth/register').send({ name: 'Duplicate', email: 'STUDENT@campus.edu', password: 'Password123!' }).expect(409);
  await request(app).post('/api/auth/register').send({ name: 'Invalid', email: 'invalid', password: 'short' }).expect(400);
});

test('login validates credentials and tokens; staff can log in', async () => {
  await request(app).post('/api/auth/login').send({ email: 'student@campus.edu', password: 'Incorrect123!' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: 'Password123!' }).expect(400);
  const response = await request(app).post('/api/auth/login').send({ email: 'STUDENT@campus.edu', password: 'Password123!' }).expect(200);
  studentToken = response.body.token;
  await request(app).get('/api/auth/me').set(auth(studentToken)).expect(200);
  await request(app).get('/api/auth/me').set(auth('invalid')).expect(401);
  const expired = jwt.sign({}, process.env.JWT_SECRET, { subject: response.body.user.id, expiresIn: -1 });
  await request(app).get('/api/auth/me').set(auth(expired)).expect(401);
  await User.create({ name: 'Staff', email: 'staff@campus.edu', password: await bcrypt.hash('StaffDemo123!', 12), role: 'staff' });
  const staff = await request(app).post('/api/auth/login').send({ email: 'staff@campus.edu', password: 'StaffDemo123!' }).expect(200);
  staffToken = staff.body.token;
  assert.equal(staff.body.user.role, 'staff');
});

test('create validates input and assigns ownership and Pending status', async () => {
  await request(app).post('/api/complaints').send(complaint).expect(401);
  await request(app).post('/api/complaints').set(auth(studentToken)).send({ ...complaint, status: 'Resolved' }).expect(400);
  await request(app).post('/api/complaints').set(auth(studentToken)).send({ ...complaint, category: 'Invalid' }).expect(400);
  await request(app).post('/api/complaints').set(auth(studentToken)).send({ title: 'Missing fields' }).expect(400);
  await request(app).post('/api/complaints').set(auth(staffToken)).send(complaint).expect(403);
  const response = await request(app).post('/api/complaints').set(auth(studentToken)).send(complaint).expect(201);
  complaintId = response.body.complaint._id;
  assert.equal(response.body.complaint.status, 'Pending');
  assert.ok(response.body.complaint.student);
});

test('student reads are scoped; staff reads all; pagination and filters work', async () => {
  const own = await request(app).get('/api/complaints?status=Pending&category=Electrical&page=1&limit=5').set(auth(studentToken)).expect(200);
  assert.equal(own.body.total, 1);
  assert.equal(own.body.complaints[0].student.password, undefined);
  const other = await request(app).get('/api/complaints').set(auth(otherToken)).expect(200);
  assert.equal(other.body.total, 0);
  await request(app).get(`/api/complaints/${complaintId}`).set(auth(otherToken)).expect(404);
  const staff = await request(app).get('/api/complaints').set(auth(staffToken)).expect(200);
  assert.equal(staff.body.total, 1);
  await request(app).get(`/api/complaints/${complaintId}`).set(auth(staffToken)).expect(200);
  await request(app).get('/api/complaints/not-an-id').set(auth(studentToken)).expect(400);
  await request(app).get('/api/complaints/000000000000000000000000').set(auth(studentToken)).expect(404);
  for (const query of ['status=invalid', 'page=0', 'limit=101', 'page[$gt]=1', 'category=Electrical&category=Plumbing']) {
    await request(app).get(`/api/complaints?${query}`).set(auth(studentToken)).expect(400);
  }
});

test('only owner edits pending details; no ownership/status injection', async () => {
  await request(app).patch(`/api/complaints/${complaintId}`).set(auth(otherToken)).send({ title: 'Hijack' }).expect(404);
  await request(app).delete(`/api/complaints/${complaintId}`).set(auth(otherToken)).expect(404);
  await request(app).patch(`/api/complaints/${complaintId}`).set(auth(staffToken)).send({ title: 'Staff edit' }).expect(403);
  await request(app).patch(`/api/complaints/${complaintId}`).set(auth(studentToken)).send({ student: '000000000000000000000000' }).expect(400);
  await request(app).patch(`/api/complaints/${complaintId}`).set(auth(studentToken)).send({ status: 'Resolved' }).expect(400);
  await request(app).patch(`/api/complaints/${complaintId}`).set(auth(studentToken)).send({ title: ' ' }).expect(400);
  const edited = await request(app).patch(`/api/complaints/${complaintId}`).set(auth(studentToken)).send({ title: 'Broken fan above front row' }).expect(200);
  assert.equal(edited.body.complaint.title, 'Broken fan above front row');
});

test('staff progresses and resolves; students cannot edit or withdraw after progress', async () => {
  const url = `/api/complaints/${complaintId}/status`;
  await request(app).patch(url).set(auth(studentToken)).send({ status: 'Resolved' }).expect(403);
  await request(app).patch(url).set(auth(staffToken)).send({ status: 'invalid' }).expect(400);
  await request(app).patch(url).set(auth(staffToken)).send({ status: 'Resolved', title: 'Override' }).expect(400);
  let response = await request(app).patch(url).set(auth(staffToken)).send({ status: 'In Progress' }).expect(200);
  assert.equal(response.body.complaint.status, 'In Progress');
  await request(app).patch(`/api/complaints/${complaintId}`).set(auth(studentToken)).send({ title: 'Too late' }).expect(409);
  await request(app).delete(`/api/complaints/${complaintId}`).set(auth(studentToken)).expect(409);
  await request(app).delete(`/api/complaints/${complaintId}`).set(auth(staffToken)).expect(403);
  response = await request(app).patch(url).set(auth(staffToken)).send({ status: 'Resolved' }).expect(200);
  assert.equal(response.body.complaint.status, 'Resolved');
  response = await request(app).patch(url).set(auth(staffToken)).send({ status: 'Pending' }).expect(200);
  assert.equal(response.body.complaint.status, 'Pending');
  await request(app).patch(url).set(auth(staffToken)).send({ status: 'Resolved' }).expect(200);
});

test('owner withdraws a pending complaint and it disappears', async () => {
  const created = await request(app).post('/api/complaints').set(auth(studentToken)).send(complaint).expect(201);
  const id = created.body.complaint._id;
  await request(app).delete(`/api/complaints/${id}`).set(auth(studentToken)).expect(200);
  await request(app).get(`/api/complaints/${id}`).set(auth(studentToken)).expect(404);
});

test('health, malformed JSON, unknown routes, and deleted-account tokens', async () => {
  await request(app).get('/api/health').expect(200);
  await request(app).get('/unknown').expect(404);
  await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{').expect(400);
  const user = await User.findOne({ email: 'other@campus.edu' });
  await user.deleteOne();
  await request(app).get('/api/auth/me').set(auth(otherToken)).expect(401);
});

test('browser home opens API docs; JSON clients and Postman download still work', async () => {
  const home = await request(app).get('/').set('Accept', 'text/html').expect(302);
  assert.equal(home.headers.location, '/docs/');
  const json = await request(app).get('/').set('Accept', 'application/json').expect(200);
  assert.equal(json.body.docs, '/docs/');
  await request(app).get('/docs/').expect('Content-Type', /html/).expect(200);
  const spec = await request(app).get('/api/openapi.json').expect(200);
  assert.equal(spec.body.openapi, '3.0.3');
  assert.ok(spec.body.paths['/api/complaints/{id}/status'].patch);
  await request(app).get('/docs/swagger-ui-init.js').expect(200);
  await request(app).get('/postman/CampusCare.postman_collection.json').expect('Content-Disposition', /attachment/).expect(200);
});

test('startup rejects an occupied port instead of returning a non-listening server', async () => {
  const net = require('node:net');
  const start = require('../src/server');
  const blocker = net.createServer();
  await new Promise(resolve => blocker.listen(0, resolve));
  const previousPort = process.env.PORT;
  const previousUri = process.env.MONGODB_URI;
  process.env.PORT = String(blocker.address().port);
  process.env.MONGODB_URI = database.getUri('campuscare_test');
  try {
    await assert.rejects(start({ handleSignals: false }), { code: 'EADDRINUSE' });
  } finally {
    await new Promise(resolve => blocker.close(resolve));
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
  }
});
