const logger = require('../utils/logger');

/**
 * Middleware de gestion globale des erreurs
 */
const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path} → ${err.message}`, err);

  // Erreurs MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Une entrée avec cette valeur existe déjà.',
    });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Référence invalide : l\'entité liée n\'existe pas.',
    });
  }

  // Erreurs de validation express-validator
  if (err.type === 'validation') {
    return res.status(422).json({
      success: false,
      message: 'Données invalides.',
      errors: err.errors,
    });
  }

  const statusCode = err.statusCode || 500;
  const message    = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Erreur interne du serveur.'
    : err.message;

  res.status(statusCode).json({ success: false, message });
};

/**
 * Route non trouvée
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route introuvable : ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFoundHandler };