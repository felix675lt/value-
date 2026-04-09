const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const router = Router();

router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('유효한 이메일을 입력하세요.'),
  // [LOW] 비밀번호 복잡도 강화
  body('password')
    .isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다.')
    .matches(/[A-Za-z]/).withMessage('비밀번호에 영문자를 포함하세요.')
    .matches(/[0-9]/).withMessage('비밀번호에 숫자를 포함하세요.'),
  body('role').isIn(['expert', 'client']).withMessage('역할은 expert 또는 client여야 합니다.'),
  validate,
], ctrl.register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
], ctrl.login);

router.get('/me', authenticate, ctrl.me);

module.exports = router;
