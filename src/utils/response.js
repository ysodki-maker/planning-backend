/**
 * Réponse succès standardisée
 */
const successResponse = (res, data = {}, message = 'Succès', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Réponse erreur standardisée
 */
const errorResponse = (res, message = 'Erreur serveur', statusCode = 500, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

/**
 * Réponse paginée
 */
const paginatedResponse = (res, data, total, page, limit, message = 'Succès') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  });
};

module.exports = { successResponse, errorResponse, paginatedResponse };