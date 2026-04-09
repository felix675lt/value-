const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/messageController');

const router = Router();

// [HIGH] 메시지 전송 rate limiting — 분당 20회
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '메시지 전송이 너무 빠릅니다. 잠시 후 다시 시도하세요.' },
});

router.post('/', authenticate, messageLimiter, [
  body('receiver_id').isUUID(),
  body('content').notEmpty().isLength({ max: 2000 }).withMessage('메시지는 2000자 이내로 입력하세요.'),
  validate,
], ctrl.sendMessage);

router.get('/', authenticate, ctrl.getConversation);
router.get('/threads', authenticate, ctrl.getThreads);

module.exports = router;
