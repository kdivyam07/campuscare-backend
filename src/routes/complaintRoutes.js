const router = require('express').Router();
const controller = require('../controllers/complaintController');
const { protect, allowRole } = require('../middleware/auth');
const { fail } = require('../utils/validation');

router.use(protect);
router.param('id', (req, res, next, id) => {
  if (!/^[a-f\d]{24}$/i.test(id)) fail(400, 'Invalid complaint ID.');
  next();
});
router.route('/').get(controller.list).post(allowRole('student'), controller.create);
router.patch('/:id/status', allowRole('staff'), controller.updateStatus);
router.route('/:id').get(controller.read).patch(allowRole('student'), controller.edit).delete(allowRole('student'), controller.remove);
module.exports = router;
