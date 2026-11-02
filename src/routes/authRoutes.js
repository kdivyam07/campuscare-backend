const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Try again later.' } });

router.post('/register', limiter, controller.register);
router.post('/login', limiter, controller.login);
router.get('/me', protect, controller.me);
module.exports = router;
