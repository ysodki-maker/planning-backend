const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { errorResponse } = require('../utils/response');

/**
 * Vérifie le token JWT et charge l'utilisateur
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Token d\'authentification manquant.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(
      'SELECT id, name, email, role, avatar, color, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length) {
      return errorResponse(res, 'Utilisateur introuvable.', 401);
    }

    if (!rows[0].is_active) {
      return errorResponse(res, 'Compte désactivé. Contactez l\'administrateur.', 403);
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'Session expirée. Veuillez vous reconnecter.', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Token invalide.', 401);
    }
    next(err);
  }
};

/**
 * Restreint l'accès à certains rôles
 * Usage : authorize('admin') ou authorize('admin', 'user')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Non authentifié.', 401);
    }
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'Accès refusé. Droits insuffisants.', 403);
    }
    next();
  };
};

module.exports = { authenticate, authorize };