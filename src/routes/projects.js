const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const projCtrl = require('../controllers/projectController');
const propCtrl = require('../controllers/proposalController');

const router = Router();

// Project CRUD — Client
router.post('/', authenticate, requireRole('client'), [
  body('title').notEmpty().withMessage('프로젝트 제목을 입력하세요.'),
  body('category').isIn(['sales', 'marketing', 'production', 'rnd', 'finance', 'hr', 'overseas', 'other']),
  body('duration_days').isInt({ min: 1 }),
  body('budget_min').isInt({ min: 1 }),
  body('budget_max').isInt({ min: 1 }),
  validate,
], projCtrl.createProject);

router.get('/', authenticate, projCtrl.listProjects);
router.get('/my', authenticate, requireRole('client'), projCtrl.myProjects);
router.get('/:id', authenticate, projCtrl.getProject);
router.put('/:id', authenticate, requireRole('client'), projCtrl.updateProject);
router.delete('/:id', authenticate, requireRole('client'), projCtrl.cancelProject);

// Proposals
router.post('/:projectId/proposals', authenticate, requireRole('expert'), [
  body('proposed_daily_rate').isInt({ min: 1 }).withMessage('일당을 입력하세요.'),
  validate,
], propCtrl.submitProposal);

router.get('/:projectId/proposals', authenticate, propCtrl.listProposals);

module.exports = router;
