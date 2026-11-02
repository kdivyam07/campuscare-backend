const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const errorHandler = require('./middleware/errors');
const path = require('node:path');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./config/openapi');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '16kb' }));
app.get('/', (req, res) => {
  if (req.accepts('html')) return res.redirect('/docs/');
  res.json({ name: 'CampusCare', description: 'College Maintenance Complaint Management Backend', health: '/api/health', docs: '/docs/' });
});
app.get('/api/openapi.json', (req, res) => res.json(openapi));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'CampusCare API',
  swaggerOptions: { validatorUrl: null, persistAuthorization: false, supportedSubmitMethods: ['get', 'post', 'patch', 'delete'] }
}));
app.get('/postman/CampusCare.postman_collection.json', (req, res) => {
  res.download(path.join(__dirname, '../postman/CampusCare.postman_collection.json'));
});
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ success: connected, database: connected ? 'connected' : 'disconnected' });
});
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));
app.use(errorHandler);
module.exports = app;
