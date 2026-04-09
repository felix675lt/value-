const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/proposalController');

const router = Router();

// Client accepts a proposal → contract created
router.post('/:id/accept', authenticate, requireRole('client'), [
  body('start_date').isDate().withMessage('시작일을 입력하세요.'),
  validate,
], ctrl.acceptProposal);

// Expert's own proposals
router.get('/my', authenticate, requireRole('expert'), ctrl.myProposals);

module.exports = router;
