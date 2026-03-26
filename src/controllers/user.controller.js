const bcrypt    = require('bcryptjs');
const UserModel = require('../models/user.model');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');
const { pool } = require('../config/database');

/**
 * GET /api/users  [admin]
 */
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const { rows, total } = await UserModel.findAll({ page, limit, search });
    return paginatedResponse(res, rows, total, page, limit, 'Utilisateurs récupérés.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id  [admin]
 */
exports.getOne = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return errorResponse(res, 'Utilisateur introuvable.', 404);
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users  [admin]
 */
exports.create = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user', color } = req.body;

    const existing = await UserModel.findByEmail(email);
    if (existing) return errorResponse(res, 'Cet email est déjà utilisé.', 409);

    const hashed = await bcrypt.hash(password, 12);
    const user   = await UserModel.create({ name, email, password: hashed, role, color });

    await emailService.sendWelcomeEmail(user);
    logger.info(`👤  Utilisateur créé par admin : ${email} (${role})`);

    return successResponse(res, { user }, 'Utilisateur créé avec succès.', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id  [admin]
 */
// exports.update = async (req, res, next) => {
//   try {
//     const user = await UserModel.findById(req.params.id);
//     if (!user) return errorResponse(res, 'Utilisateur introuvable.', 404);

//     const { name, email, role, color, is_active } = req.body;
//     const updated = await UserModel.update(req.params.id, { name, email, role, color, is_active });

//     logger.info(`✏️   Utilisateur #${req.params.id} mis à jour par admin#${req.user.id}`);
//     return successResponse(res, { user: updated }, 'Utilisateur mis à jour.');
//   } catch (err) {
//     next(err);
//   }
// };
exports.update = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return errorResponse(res, 'Utilisateur introuvable.', 404);

    const { name, email, role, color, is_active, password } = req.body;

    const updated = await UserModel.update(req.params.id, {
      name,
      email,
      role,
      color,
      is_active
    });

    // ✅ Mise à jour mot de passe
    if (password) {
      const hashed = await bcrypt.hash(password, 12);
      await UserModel.updatePassword(req.params.id, hashed);
    }

    logger.info(`✏️ Utilisateur #${req.params.id} mis à jour par admin#${req.user.id}`);

    return successResponse(res, {
      user: await UserModel.findById(req.params.id)
    }, 'Utilisateur mis à jour.');

  } catch (err) {
    next(err);
  }
};
/**
 * DELETE /api/users/:id  [admin]
 */
exports.delete = async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return errorResponse(res, 'Vous ne pouvez pas supprimer votre propre compte.', 400);
    }
    const user = await UserModel.findById(req.params.id);
    if (!user) return errorResponse(res, 'Utilisateur introuvable.', 404);
    await pool.query(
  'DELETE FROM projects WHERE created_by = ?',
  [req.params.id]
);
    await UserModel.delete(req.params.id);
    logger.info(`🗑️   Utilisateur #${req.params.id} supprimé par admin#${req.user.id}`);
    return successResponse(res, {}, 'Utilisateur supprimé.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/profile  [authenticated]
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/profile  [authenticated]
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, color } = req.body;
    const updated = await UserModel.update(req.user.id, { name, color });
    return successResponse(res, { user: updated }, 'Profil mis à jour.');
  } catch (err) {
    next(err);
  }
};