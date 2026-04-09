const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/contractController');
const reviewCtrl = require('../controllers/reviewController');

const router = Router();

router.get('/my', authenticate, ctrl.myContracts);
router.get('/:id', authenticate, ctrl.getContract);
router.get('/:id/payments', authenticate, ctrl.getPayments);

// [MEDIUM] 라우트 레벨 role 검증 추가
router.post('/:id/escrow/deposit', authenticate, requireRole('client'), [
  body('payment_key').notEmpty().withMessage('결제 키가 필요합니다.'),
  body('order_id').notEmpty().withMessage('주문 ID가 필요합니다.'),
  validate,
], ctrl.depositEscrow);

router.post('/:id/daily-check', authenticate, requireRole('expert'), [
  body('work_date').isDate().withMessage('근무일을 입력하세요.'),
  validate,
], ctrl.expertDailyCheck);

router.post('/:id/daily-confirm', authenticate, requireRole('client'), [
  body('work_date').isDate().withMessage('근무일을 입력하세요.'),
  validate,
], ctrl.clientDailyConfirm);

router.post('/:id/reviews', authenticate, [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString(),
  validate,
], reviewCtrl.createReview);

module.exports = router;
