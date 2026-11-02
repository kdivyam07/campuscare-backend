function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function bodyFields(body, allowed, required = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'A JSON object body is required.');
  const keys = Object.keys(body);
  if (!keys.length) fail(400, 'Request body must not be empty.');
  for (const key of keys) {
    if (!allowed.includes(key)) fail(400, `Unknown or forbidden field: ${key}`);
    if (typeof body[key] !== 'string' || !body[key].trim()) fail(400, `${key} must be a non-empty string.`);
  }
  for (const key of required) {
    if (!keys.includes(key)) fail(400, `${key} is required.`);
  }
}

function validatePassword(password) {
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    fail(400, 'Password must contain at least 8 characters and at most 72 UTF-8 bytes.');
  }
}

module.exports = { fail, bodyFields, validatePassword };
