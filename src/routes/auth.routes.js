const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate }     = require('../middlewares/validate.middleware');

const passwordRules = body('password')
  .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.')
  .matches(/[A-Z]/).withMessage('Au moins une majuscule requise.')
  .matches(/[0-9]/).withMessage('Au moins un chiffre requis.');

// ── Routes publiques ──────────────────────────────────────────────────────────

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Le nom est requis.').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Email invalide.').normalizeEmail(),
  passwordRules,
  body('role').optional().isIn(['admin', 'user']).withMessage('Rôle invalide.'),
  validate,
], authController.register);

router.post('/login', [
  body('email').isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('password').notEmpty().withMessage('Mot de passe requis.'),
  validate,
], authController.login);

router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token requis.'),
  validate,
], authController.refreshToken);

router.post('/logout', authController.logout);

router.post('/forgot-password', [
  body('email').isEmail().withMessage('Email invalide.').normalizeEmail(),
  validate,
], authController.forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token requis.'),
  passwordRules,
  validate,
], authController.resetPassword);

// ── Routes protégées ─────────────────────────────────────────────────────────

router.get('/me', authenticate, authController.me);

router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Mot de passe actuel requis.'),
  passwordRules,
  validate,
], authController.changePassword);

module.exports = router;