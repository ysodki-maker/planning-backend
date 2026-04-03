const crypto = require('crypto');
const ProjectModel    = require('../models/project.model');
const UserModel       = require('../models/user.model');
const emailService    = require('../services/email.service');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const logger = require('../utils/logger');

const DEMANDE_STATUS = "Demande d'affectation";

// Génère un token de confirmation unique
function generateConfirmToken() {
  return crypto.randomBytes(32).toString('hex');
}

// URL de confirmation complète
function buildConfirmUrl(projectId, token) {
  const base = process.env.CLIENT_URL || 'https://planning.cosinus.ma';
  return `${base}/confirm?id=${projectId}&token=${token}`;
}

/** GET /api/projects */
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', status = '', type = '' } = req.query;
    const { rows, total } = await ProjectModel.findAll({ page, limit, search, status, type });
    return paginatedResponse(res, rows, total, page, limit, 'Projets récupérés avec succès.');
  } catch (err) { next(err); }
};

/** GET /api/projects/calendar */
exports.getCalendar = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return errorResponse(res, 'Paramètres start et end requis.', 400);
    const projects = await ProjectModel.findByDateRange(start, end);
    return successResponse(res, { projects }, 'Projets calendrier récupérés.');
  } catch (err) { next(err); }
};

/** GET /api/projects/stats */
exports.getStats = async (req, res, next) => {
  try {
    const { rows: all } = await ProjectModel.findAll({ limit: 9999 });
    const stats = {
      total: all.length,
      by_status: {
        [DEMANDE_STATUS]: all.filter(p => p.status === DEMANDE_STATUS).length,
        'En cours':       all.filter(p => p.status === 'En cours').length,
        'Terminé':        all.filter(p => p.status === 'Terminé').length,
      },
    };
    return successResponse(res, { stats });
  } catch (err) { next(err); }
};

/** GET /api/projects/:id */
exports.getOne = async (req, res, next) => {
  try {
    const project = await ProjectModel.findById(req.params.id);
    if (!project) return errorResponse(res, 'Projet introuvable.', 404);
    return successResponse(res, { project });
  } catch (err) { next(err); }
};

/** POST /api/projects */
exports.create = async (req, res, next) => {
  try {
    const {
      name, ville, status, type,
      start_date, end_date, heure_debut, heure_fin,
      localisation, description, user_ids = [],
    } = req.body;

    const project = await ProjectModel.create({
      name, ville, status, type,
      start_date:   start_date  || null,
      end_date:     end_date    || null,
      heure_debut:  heure_debut || null,
      heure_fin:    heure_fin   || null,
      localisation: localisation || null,
      description,
      created_by: req.user.id,
    });

    // Affectations
    if (user_ids.length) {
      await ProjectModel.assignUsers(project.id, user_ids);
      const assignedUsers = await ProjectModel.getAssignedUsers(project.id);
      for (const user of assignedUsers) {
        await emailService.sendProjectAssignmentEmail(user, project);
      }
    }

    let fullProject = await ProjectModel.findById(project.id);

    // ── Email planning si statut = Demande d'affectation ──────────────────
    if (status === DEMANDE_STATUS) {
      const token      = generateConfirmToken();
      await ProjectModel.setConfirmToken(fullProject.id, token);
      fullProject      = await ProjectModel.findById(fullProject.id);
      const creator    = await UserModel.findById(req.user.id);
      const confirmUrl = buildConfirmUrl(fullProject.id, token);
      await emailService.sendDemandeAffectationEmail(fullProject, creator, confirmUrl);
    }

    logger.info(`📁  Projet créé : "${name}" (${ville}) par user#${req.user.id}`);
    return successResponse(res, { project: fullProject }, 'Projet créé avec succès.', 201);
  } catch (err) { next(err); }
};

/** PUT /api/projects/:id */
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await ProjectModel.findById(id);
    if (!project) return errorResponse(res, 'Projet introuvable.', 404);

    const {
      name, ville, status, type,
      start_date, end_date, heure_debut, heure_fin,
      localisation, description, user_ids,
    } = req.body;

    const oldStatus = project.status;

    const updated = await ProjectModel.update(id, {
      name, ville, status, type,
      start_date:   start_date   !== undefined ? (start_date   || null) : undefined,
      end_date:     end_date     !== undefined ? (end_date     || null) : undefined,
      heure_debut:  heure_debut  !== undefined ? (heure_debut  || null) : undefined,
      heure_fin:    heure_fin    !== undefined ? (heure_fin    || null) : undefined,
      localisation: localisation !== undefined ? (localisation || null) : undefined,
      description,
    });

    // Sync affectations
    if (Array.isArray(user_ids)) {
      const prevUsers = await ProjectModel.getAssignedUsers(id);
      const prevIds   = prevUsers.map(u => u.id);
      await ProjectModel.syncAssignments(id, user_ids);
      const newIds = user_ids.filter(uid => !prevIds.includes(uid));
      for (const uid of newIds) {
        const user = await UserModel.findById(uid);
        if (user) await emailService.sendProjectAssignmentEmail(user, updated);
      }
    }

    let fullProject = await ProjectModel.findById(id);

    // ── Notifications changement de statut ────────────────────────────────
    if (status && status !== oldStatus) {
      const assignedUsers = await ProjectModel.getAssignedUsers(id);
      if (assignedUsers.length) {
        await emailService.sendStatusChangeEmail(assignedUsers, fullProject, oldStatus);
      }

      // Si nouveau statut = Demande d'affectation → email planning + token
      if (status === DEMANDE_STATUS) {
        const token = generateConfirmToken();
        await ProjectModel.setConfirmToken(id, token);
        fullProject = await ProjectModel.findById(id);
        const changer    = await UserModel.findById(req.user.id);
        const confirmUrl = buildConfirmUrl(id, token);
        await emailService.sendStatutDemandeEmail(fullProject, changer, confirmUrl);
      } else {
        // Si on quitte le statut Demande → supprimer le token
        await ProjectModel.setConfirmToken(id, null);
        fullProject = await ProjectModel.findById(id);
      }
    }

    logger.info(`✏️   Projet mis à jour : #${id} par user#${req.user.id}`);
    return successResponse(res, { project: fullProject }, 'Projet mis à jour avec succès.');
  } catch (err) { next(err); }
};

/** DELETE /api/projects/:id */
exports.delete = async (req, res, next) => {
  try {
    const project = await ProjectModel.findById(req.params.id);
    if (!project) return errorResponse(res, 'Projet introuvable.', 404);
    await ProjectModel.delete(req.params.id);
    logger.info(`🗑️   Projet supprimé : #${req.params.id} par user#${req.user.id}`);
    return successResponse(res, {}, 'Projet supprimé avec succès.');
  } catch (err) { next(err); }
};

/**
 * POST /api/projects/:id/confirm  → admin connecté (bouton app)
 *   body: { start_date?, end_date?, heure_debut?, heure_fin? }
 *
 * GET  /api/projects/confirm?id=&token=  → lien email (sans auth)
 *   Redirige vers page front de saisie des dates
 */
exports.confirmProject = async (req, res, next) => {
  try {
    // ── Cas 1 : lien email → redirige vers page front de confirmation ──────
    if (req.method === 'GET' && req.query.token) {
      const { id, token } = req.query;
      if (!id || !token) return errorResponse(res, 'Paramètres id et token requis.', 400);

      const project = await ProjectModel.findByConfirmToken(token);
      if (!project || String(project.id) !== String(id)) {
        const clientUrl = process.env.CLIENT_URL || 'https://planning.cosinus.ma';
        return res.redirect(`${clientUrl}/confirm-error`);
      }
      if (project.status !== DEMANDE_STATUS) {
        const clientUrl = process.env.CLIENT_URL || 'https://planning.cosinus.ma';
        return res.redirect(`${clientUrl}/confirm-error?reason=already`);
      }

      // Redirige vers le formulaire front avec id + token
      const clientUrl = process.env.CLIENT_URL || 'https://planning.cosinus.ma';
      return res.redirect(
        `${clientUrl}/confirm?id=${id}&token=${token}&name=${encodeURIComponent(project.name)}`
      );
    }

    // ── Cas 2 : soumission du formulaire via lien email (POST sans auth) ───
    if (req.query.token) {
      const { id, token } = req.query;
      const { start_date, end_date, heure_debut, heure_fin } = req.body;

      const project = await ProjectModel.findByConfirmToken(token);
      if (!project || String(project.id) !== String(id)) {
        return errorResponse(res, 'Lien invalide ou déjà utilisé.', 400);
      }
      if (project.status !== DEMANDE_STATUS) {
        return errorResponse(res, "Ce projet n'est plus en Demande d'affectation.", 400);
      }

      // Mise à jour des dates/heures si fournies
      if (start_date || end_date || heure_debut || heure_fin) {
        await ProjectModel.update(id, {
          start_date:  start_date  || undefined,
          end_date:    end_date    || undefined,
          heure_debut: heure_debut || undefined,
          heure_fin:   heure_fin   || undefined,
        });
      }

      const confirmed     = await ProjectModel.confirm(id, null);
      const assignedUsers = await ProjectModel.getAssignedUsers(id);
      await emailService.sendConfirmationSuccessEmail(confirmed, assignedUsers);

      logger.info(`✅  Projet #${id} confirmé via lien email`);
      const clientUrl = process.env.CLIENT_URL || 'https://planning.cosinus.ma';
      return res.redirect(
        `${clientUrl}/confirm-success?name=${encodeURIComponent(confirmed.name)}`
      );
    }

    // ── Cas 3 : admin connecté (bouton dans l'app) ────────────────────────
    const { id }   = req.params;
    const { start_date, end_date, heure_debut, heure_fin } = req.body;

    const project = await ProjectModel.findById(id);
    if (!project) return errorResponse(res, 'Projet introuvable.', 404);
    if (project.status !== DEMANDE_STATUS) {
      return errorResponse(res, "Ce projet n'est plus en Demande d'affectation.", 400);
    }

    // Mise à jour des dates/heures si fournies avant confirmation
    if (start_date || end_date || heure_debut || heure_fin) {
      await ProjectModel.update(id, {
        start_date:  start_date  || undefined,
        end_date:    end_date    || undefined,
        heure_debut: heure_debut || undefined,
        heure_fin:   heure_fin   || undefined,
      });
    }

    const confirmed     = await ProjectModel.confirm(id, req.user.id);
    const assignedUsers = await ProjectModel.getAssignedUsers(id);
    await emailService.sendConfirmationSuccessEmail(confirmed, assignedUsers);

    logger.info(`✅  Projet #${id} confirmé par admin#${req.user.id}`);
    return successResponse(res, { project: confirmed }, 'Projet confirmé et passé En cours.');
  } catch (err) { next(err); }
};

/** POST /api/projects/:id/assign */
exports.assignUsers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_ids = [] } = req.body;
    const project = await ProjectModel.findById(id);
    if (!project) return errorResponse(res, 'Projet introuvable.', 404);
    await ProjectModel.assignUsers(id, user_ids);
    for (const uid of user_ids) {
      const user = await UserModel.findById(uid);
      if (user) await emailService.sendProjectAssignmentEmail(user, project);
    }
    const fullProject = await ProjectModel.findById(id);
    return successResponse(res, { project: fullProject }, 'Utilisateurs affectés avec succès.');
  } catch (err) { next(err); }
};

/** DELETE /api/projects/:id/assign/:userId */
exports.removeUser = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const project = await ProjectModel.findById(id);
    if (!project) return errorResponse(res, 'Projet introuvable.', 404);
    await ProjectModel.removeUser(id, userId);
    return successResponse(res, {}, 'Utilisateur retiré du projet.');
  } catch (err) { next(err); }
};
