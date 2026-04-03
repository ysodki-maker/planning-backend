const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const projectController = require('../controllers/project.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

router.use(authenticate);

// Regex HH:MM (00:00 – 23:59)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const projectValidation = [
  body('name').trim().notEmpty().withMessage('Le nom du projet est requis.').isLength({ max: 200 }),
  body('ville').trim().notEmpty().withMessage('La ville est requise.').isLength({ max: 150 }),
  body('status')
    .isIn(["Demande d'affectation", 'En cours', 'Terminé'])
    .withMessage('Statut invalide.'),
  body('type')
    .isIn(['Relevé', 'Installation'])
    .withMessage('Type invalide. Valeurs acceptées : Relevé, Installation.'),
  body('start_date')
    .optional({ nullable: true, checkFalsy: true })
    .isDate().withMessage('Date de début invalide (YYYY-MM-DD).'),
  body('end_date')
    .optional({ nullable: true, checkFalsy: true })
    .isDate().withMessage('Date de fin invalide (YYYY-MM-DD).')
    .custom((end, { req }) => {
      if (end && req.body.start_date && end < req.body.start_date)
        throw new Error('La date de fin doit être après la date de début.');
      return true;
    }),
  body('localisation')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 }).withMessage('Localisation trop longue (max 500 car.).'),
  body('heure_debut')
    .optional({ nullable: true, checkFalsy: true })
    .matches(timeRegex).withMessage('Heure de début invalide (format HH:MM).'),
  body('heure_fin')
    .optional({ nullable: true, checkFalsy: true })
    .matches(timeRegex).withMessage('Heure de fin invalide (format HH:MM).')
    .custom((fin, { req }) => {
      if (fin && req.body.heure_debut && fin <= req.body.heure_debut)
        throw new Error("L'heure de fin doit être après l'heure de début.");
      return true;
    }),
  body('user_ids').optional().isArray().withMessage('user_ids doit être un tableau.'),
  body('user_ids.*').optional().isInt({ min: 1 }).withMessage('ID utilisateur invalide.'),
  validate,
];

const updateValidation = [
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('ville').optional().trim().notEmpty().isLength({ max: 150 }),
  body('status').optional().isIn(["Demande d'affectation", 'En cours', 'Terminé']),
  body('type').optional().isIn(['Relevé', 'Installation']),
  body('start_date').optional({ nullable: true, checkFalsy: true }).isDate(),
  body('end_date').optional({ nullable: true, checkFalsy: true }).isDate(),
  body('localisation').optional({ nullable: true, checkFalsy: true }).isLength({ max: 500 }),
  body('heure_debut')
    .optional({ nullable: true, checkFalsy: true })
    .matches(timeRegex).withMessage('Heure de début invalide (format HH:MM).'),
  body('heure_fin')
    .optional({ nullable: true, checkFalsy: true })
    .matches(timeRegex).withMessage('Heure de fin invalide (format HH:MM).'),
  body('user_ids').optional().isArray(),
  validate,
];

router.get('/',         projectController.getAll);
router.get('/stats',    projectController.getStats);
router.get('/calendar', projectController.getCalendar);
router.get('/:id',      projectController.getOne);

router.post('/',    authorize('admin'), projectValidation, projectController.create);
router.put('/:id',  authorize('admin'), updateValidation,  projectController.update);
router.delete('/:id', authorize('admin'), projectController.delete);

// Confirmation de projet
// GET  sans auth → lien email : redirige vers page front formulaire
// POST sans auth + token → soumission formulaire depuis lien email
// POST avec auth (admin) → bouton dans l'app
router.get('/confirm', projectController.confirmProject);
router.post('/confirm', projectController.confirmProject);
router.post('/:id/confirm', authenticate, authorize('admin'), projectController.confirmProject);

router.post('/:id/assign', authorize('admin'), [
  body('user_ids').isArray({ min: 1 }).withMessage('Fournissez au moins un utilisateur.'),
  validate,
], projectController.assignUsers);

router.delete('/:id/assign/:userId', authorize('admin'), projectController.removeUser);

module.exports = router;
