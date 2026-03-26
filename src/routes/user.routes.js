const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

router.use(authenticate);

// ── Profil (tout utilisateur connecté) ───────────────────────────────────────
router.get('/profile',  userController.getProfile);
router.put('/profile', [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Couleur HEX invalide.'),
  validate,
], userController.updateProfile);

// ── Admin uniquement ──────────────────────────────────────────────────────────
router.get('/',       authorize('admin'), userController.getAll);
router.get('/:id',    authorize('admin'), userController.getOne);

router.post('/', authorize('admin'), [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
  body('role').optional().isIn(['admin', 'user']),
  validate,
], userController.create);

// router.put('/:id', authorize('admin'), [
//   body('name').optional().trim().notEmpty().isLength({ max: 100 }),
//   body('email').optional().isEmail().normalizeEmail(),
//   body('role').optional().isIn(['admin', 'user']),
//   body('is_active').optional().isBoolean(),
//   validate,
// ], userController.update);
router.put('/:id', authorize('admin'), [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('password')
  .optional()
  .isLength({ min: 8 }).withMessage('Minimum 8 caractères')
  .matches(/[A-Z]/).withMessage('Une majuscule requise')
  .matches(/[a-z]/).withMessage('Une minuscule requise')
  .matches(/[0-9]/).withMessage('Un chiffre requis')
  .matches(/[@$!%*?&]/).withMessage('Un caractère spécial requis'),
  body('role').optional().isIn(['admin', 'user']),
  body('is_active').optional().isBoolean(),
  validate,
], userController.update);
router.delete('/:id', authorize('admin'), userController.delete);

module.exports = router;