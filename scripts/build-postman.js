// Rebuild the checked-in collection: node scripts/build-postman.js
const fs = require('node:fs');
const path = require('node:path');

function item(name, method, url, body, token, expected = 200, capture) {
  const checks = [
    `pm.test('HTTP ${expected}', () => pm.response.to.have.status(${expected}));`,
    `pm.test('Successful JSON response', () => pm.expect(pm.response.json().success).to.eql(true));`
  ];
  if (capture) checks.push(capture);
  return {
    name,
    request: {
      method,
      header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      auth: token ? { type: 'bearer', bearer: [{ key: 'token', value: `{{${token}}}`, type: 'string' }] } : { type: 'noauth' },
      url: `{{baseUrl}}${url}`,
      ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } } : {})
    },
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: checks } }]
  };
}
const payload = { title: 'Broken classroom fan', description: 'The fan above the front row does not rotate.', category: 'Electrical', location: 'Block A, Room 203' };
const saveToken = key => `if (pm.response.code < 300) pm.collectionVariables.set('${key}', pm.response.json().token);`;
const saveId = key => `if (pm.response.code < 300) pm.collectionVariables.set('${key}', pm.response.json().complaint._id);`;
const collection = {
  info: {
    name: 'CampusCare — College Maintenance Complaint API',
    description: 'Run requests in order with the server running. Student email/password are generated for each collection run. Demo staff credentials work with npm run demo; change staff variables for Atlas. The temporary demo database is deleted on shutdown.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: [
    ['baseUrl', 'http://localhost:5000'], ['studentEmail', ''], ['studentPassword', ''],
    ['staffEmail', 'staff@campus.edu'], ['staffPassword', 'StaffDemo123!'],
    ['studentToken', ''], ['staffToken', ''], ['complaintId', ''], ['withdrawId', '']
  ].map(([key, value]) => ({ key, value, type: 'string' })),
  item: [
    item('01 — Health check', 'GET', '/api/health'),
    item('02 — Register student', 'POST', '/api/auth/register', { name: 'Demo Student', email: '{{studentEmail}}', password: '{{studentPassword}}' }, null, 201, saveToken('studentToken')),
    item('03 — Student login', 'POST', '/api/auth/login', { email: '{{studentEmail}}', password: '{{studentPassword}}' }, null, 200, saveToken('studentToken')),
    item('04 — Current account', 'GET', '/api/auth/me', null, 'studentToken'),
    item('05 — Submit broken fan', 'POST', '/api/complaints', payload, 'studentToken', 201, saveId('complaintId')),
    item('06 — View my complaints', 'GET', '/api/complaints', null, 'studentToken'),
    item('07 — Read complaint', 'GET', '/api/complaints/{{complaintId}}', null, 'studentToken'),
    item('08 — Edit pending complaint', 'PATCH', '/api/complaints/{{complaintId}}', { description: 'Fan does not rotate even at maximum regulator setting.' }, 'studentToken'),
    item('09 — Staff login', 'POST', '/api/auth/login', { email: '{{staffEmail}}', password: '{{staffPassword}}' }, null, 200, saveToken('staffToken')),
    item('10 — Staff views all complaints', 'GET', '/api/complaints', null, 'staffToken'),
    item('11 — Mark In Progress', 'PATCH', '/api/complaints/{{complaintId}}/status', { status: 'In Progress' }, 'staffToken'),
    item('12 — Mark Resolved', 'PATCH', '/api/complaints/{{complaintId}}/status', { status: 'Resolved' }, 'staffToken'),
    item('13 — Student verifies resolution', 'GET', '/api/complaints/{{complaintId}}', null, 'studentToken'),
    item('14 — Filter resolved complaints', 'GET', '/api/complaints?status=Resolved&category=Electrical&page=1&limit=10', null, 'staffToken'),
    item('15 — Submit complaint to withdraw', 'POST', '/api/complaints', { ...payload, title: 'Duplicate fan complaint' }, 'studentToken', 201, saveId('withdrawId')),
    item('16 — Withdraw pending complaint', 'DELETE', '/api/complaints/{{withdrawId}}', null, 'studentToken')
  ]
};
collection.item[1].event.unshift({ listen: 'prerequest', script: { type: 'text/javascript', exec: [
  "pm.collectionVariables.set('studentEmail', 'student-' + pm.variables.replaceIn('{{$guid}}') + '@campus.edu');",
  "pm.collectionVariables.set('studentPassword', pm.variables.replaceIn('{{$guid}}') + 'Aa1!');"
] } });
fs.mkdirSync(path.join(__dirname, '../postman'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../postman/CampusCare.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
console.log('Postman collection generated.');
