const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/expertController');
const reviewCtrl = require('../controllers/reviewController');

const router = Router();

router.post('/profile', authenticate, requireRole('expert'), [
  body('name').notEmpty().withMessage('이름을 입력하세요.'),
  body('min_daily_rate').optional().isInt({ min: 0 }),
  body('max_daily_rate').optional().isInt({ min: 0 }),
  validate,
], ctrl.createProfile);

router.get('/profile', authenticate, requireRole('expert'), ctrl.getMyProfile);

// [MEDIUM] updateProfile에도 입력 유효성 검사 추가
router.put('/profile', authenticate, requireRole('expert'), [
  body('name').optional().notEmpty().withMessage('이름은 빈 값일 수 없습니다.'),
  body('min_daily_rate').optional().isInt({ min: 0 }).withMessage('최소 일당은 0 이상이어야 합니다.'),
  body('max_daily_rate').optional().isInt({ min: 0 }).withMessage('최대 일당은 0 이상이어야 합니다.'),
  validate,
], ctrl.updateProfile);

router.get('/:id', authenticate, ctrl.getExpertById);

router.get('/:id/reviews', authenticate, reviewCtrl.getExpertReviews);

module.exports = router;
