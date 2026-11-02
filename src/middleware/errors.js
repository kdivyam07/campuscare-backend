function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message;
  if (err.code === 11000) {
    status = 409;
    message = 'An account with this email already exists.';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map(error => error.message).join(' ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid value or identifier.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body.';
  }
  if (status >= 500) {
    console.error('Request failed:', err.name);
    message = 'Internal server error.';
  }
  res.status(status).json({ success: false, message });
}

module.exports = errorHandler;
