const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { pool }     = require('../config/database');
const UserModel    = require('../models/user.model');
const emailService = require('../services/email.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// ── Helpers JWT ───────────────────────────────────────────────────────────────
const generateAccessToken  = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const generateRefreshToken = (user) =>
  jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });

async function saveRefreshToken(userId, token) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user', color } = req.body;

    const existing = await UserModel.findByEmail(email);
    if (existing) return errorResponse(res, 'Cet email est déjà utilisé.', 409);

    const hashed = await bcrypt.hash(password, 12);
    const user   = await UserModel.create({ name, email, password: hashed, role, color });

    await emailService.sendWelcomeEmail(user);

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, refreshToken);

    logger.info(`👤  Nouvel utilisateur inscrit : ${email} (${role})`);

    return successResponse(res, { user, accessToken, refreshToken }, 'Compte créé avec succès.', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findByEmail(email);
    if (!user) return errorResponse(res, 'Email ou mot de passe incorrect.', 401);
    if (!user.is_active) return errorResponse(res, 'Compte désactivé.', 403);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return errorResponse(res, 'Email ou mot de passe incorrect.', 401);

    // Mise à jour last_login
    await UserModel.update(user.id, { last_login: new Date() });

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, refreshToken);

    const { password: _, ...safeUser } = user;

    logger.info(`🔑  Connexion : ${email}`);
    return successResponse(res, { user: safeUser, accessToken, refreshToken }, 'Connexion réussie.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return errorResponse(res, 'Refresh token manquant.', 400);

    // Vérification en base
    const [rows] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [refreshToken]
    );
    if (!rows.length) return errorResponse(res, 'Refresh token invalide ou expiré.', 401);

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user    = await UserModel.findById(decoded.id);
    if (!user || !user.is_active) return errorResponse(res, 'Utilisateur introuvable.', 401);

    const newAccessToken  = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Rotation du refresh token
    await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    await saveRefreshToken(user.id, newRefreshToken);

    return successResponse(res, { accessToken: newAccessToken, refreshToken: newRefreshToken }, 'Token renouvelé.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    return successResponse(res, {}, 'Déconnexion réussie.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
exports.me = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await UserModel.findByEmail(email);

    // Toujours répondre 200 pour ne pas exposer les emails
    if (!user) return successResponse(res, {}, 'Si cet email existe, un lien de réinitialisation a été envoyé.');

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 heure

    await UserModel.setResetToken(user.id, token, expires);

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await emailService.sendPasswordResetEmail(user, resetUrl);

    logger.info(`🔐  Reset password demandé pour : ${email}`);
    return successResponse(res, {}, 'Si cet email existe, un lien de réinitialisation a été envoyé.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const user = await UserModel.findByResetToken(token);
    if (!user) return errorResponse(res, 'Token invalide ou expiré.', 400);

    const hashed = await bcrypt.hash(password, 12);
    await UserModel.updatePassword(user.id, hashed);
    await UserModel.clearResetToken(user.id);

    // Invalider tous les refresh tokens
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);

    logger.info(`🔐  Mot de passe réinitialisé pour : ${user.email}`);
    return successResponse(res, {}, 'Mot de passe réinitialisé avec succès.');
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/change-password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await UserModel.findByEmail(req.user.email);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return errorResponse(res, 'Mot de passe actuel incorrect.', 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await UserModel.updatePassword(req.user.id, hashed);

    return successResponse(res, {}, 'Mot de passe modifié avec succès.');
  } catch (err) {
    next(err);
  }
};