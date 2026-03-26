require('dotenv').config();
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const { testConnection }           = require('./config/database');
const { verifyConnection: verifyEmail } = require('./services/email.service');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const logger = require('./utils/logger');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes    = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const userRoutes    = require('./routes/user.routes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Sécurité ──────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = (process.env.CLIENT_URL || 'https://planning.cosinus.ma').split(',');

const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origin (Postman, server-to-server, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// ✅ Preflight handler — doit être placé AVANT les routes
app.options('*', cors(corsOptions));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Trop de requêtes. Réessayez dans 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
});

// app.use(globalLimiter);

// ── Parsers ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging HTTP ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'PlanFlow API opérationnelle',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── Routes API ────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users',    userRoutes);

// ── 404 & Error handlers ──────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Démarrage du serveur ──────────────────────────────────────────────────────
async function start() {
  await testConnection();
  await verifyEmail();

  app.listen(PORT, () => {
    logger.info('─────────────────────────────────────────────────');
    logger.info(`🚀  PlanFlow API démarrée sur le port ${PORT}`);
    logger.info(`🌍  Environnement : ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗  URL : http://localhost:${PORT}`);
    logger.info('─────────────────────────────────────────────────');
    logger.info('📡  Endpoints disponibles :');
    logger.info(`    GET    http://localhost:${PORT}/health`);
    logger.info(`    POST   http://localhost:${PORT}/api/auth/register`);
    logger.info(`    POST   http://localhost:${PORT}/api/auth/login`);
    logger.info(`    GET    http://localhost:${PORT}/api/projects`);
    logger.info(`    GET    http://localhost:${PORT}/api/users`);
    logger.info('─────────────────────────────────────────────────');
  });
}

// Gestion des erreurs non capturées
process.on('uncaughtException',  (err) => { logger.error('uncaughtException',  err); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error('unhandledRejection', err); process.exit(1); });

start();

module.exports = app;
