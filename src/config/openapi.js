const { categories, statuses } = require('../models/Complaint');
const string = (maxLength, example) => ({ type: 'string', minLength: 1, maxLength, example });
const details = {
  title: string(120, 'Broken classroom fan'),
  description: string(2000, 'The ceiling fan above the front row does not rotate.'),
  category: { type: 'string', enum: categories, example: 'Electrical' },
  location: string(200, 'Block A, Room 203')
};
const credentials = {
  email: { type: 'string', format: 'email', example: 'student@campus.edu' },
  password: { type: 'string', format: 'password', minLength: 8, description: 'Maximum 72 UTF-8 bytes.', example: 'StudentDemo123!' }
};
function body(properties, required = Object.keys(properties)) {
  return { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, minProperties: 1, required, properties } } } };
}
function operation(summary, tag, requestBody, success = '200', secured = true) {
  return {
    summary, tags: [tag], security: secured ? [{ bearerAuth: [] }] : [],
    ...(requestBody ? { requestBody } : {}),
    responses: {
      [success]: { description: 'Success. Responses are JSON; login and registration include a token.' },
      '400': { description: 'Invalid request or fields.' },
      ...(secured ? { '401': { description: 'Login required or expired token.' }, '403': { description: 'Role not permitted.' }, '404': { description: 'Complaint not found or belongs to another student.' } } : {}),
      '409': { description: 'Duplicate email or complaint is no longer Pending.' }
    }
  };
}
const id = { name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' }, description: 'Copy _id from a complaint response.' };
module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'CampusCare — Maintenance Complaint API', version: '1.0.0',
    description: 'Your backend is running. Expand a request and select **Try it out**, then **Execute**.\n\n1. Register a student or log in.\n2. Copy the `token` from the response.\n3. Click **Authorize** and paste the token without the word Bearer.\n4. Create a complaint, then copy its `_id` to read, edit or withdraw it.\n5. Log in as staff, replace the authorization token, and update its status.\n\nPublic registration creates students only. In temporary demo mode the staff login is `staff@campus.edu` / `StaffDemo123!`; demo data is deleted when the server stops. For Atlas use your configured staff account.\n\n[Download Postman collection](/postman/CampusCare.postman_collection.json) · [Check database health](/api/health)'
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Health' }, { name: 'Accounts' }, { name: 'Complaints' }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/api/health': { get: operation('Check database connection', 'Health', null, '200', false) },
    '/api/auth/register': { post: operation('Register student', 'Accounts', body({ name: string(80, 'Demo Student'), ...credentials }), '201', false) },
    '/api/auth/login': { post: operation('Log in as student or staff', 'Accounts', body(credentials), '200', false) },
    '/api/auth/me': { get: operation('View current account', 'Accounts') },
    '/api/complaints': {
      post: operation('Student: create complaint', 'Complaints', body(details), '201'),
      get: { ...operation('Student: view own / Staff: view all complaints', 'Complaints'), parameters: [
        { name: 'status', in: 'query', schema: { type: 'string', enum: statuses } },
        { name: 'category', in: 'query', schema: { type: 'string', enum: categories } },
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
      ] }
    },
    '/api/complaints/{id}': {
      parameters: [id],
      get: operation('Owner or staff: read complaint', 'Complaints'),
      patch: operation('Student: edit own pending complaint', 'Complaints', body(details, [])),
      delete: operation('Student: withdraw own pending complaint', 'Complaints')
    },
    '/api/complaints/{id}/status': {
      parameters: [id],
      patch: operation('Staff: update complaint status', 'Complaints', body({ status: { type: 'string', enum: statuses, example: 'In Progress' } }))
    }
  }
};
