require('dotenv').config();
const { pool } = require('./database');
const logger = require('../utils/logger');

const migrations = [
  // ── 1. Utilisateurs ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)        NOT NULL,
    email       VARCHAR(150)        NOT NULL UNIQUE,
    password    VARCHAR(255)        NOT NULL,
    role        ENUM('admin','user') NOT NULL DEFAULT 'user',
    avatar      VARCHAR(10)         NULL,
    color       VARCHAR(7)          NULL DEFAULT '#6C63FF',
    is_active   TINYINT(1)          NOT NULL DEFAULT 1,
    reset_token VARCHAR(255)        NULL,
    reset_token_expires DATETIME    NULL,
    last_login  DATETIME            NULL,
    created_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── 2. Projets ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS projects (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(200)        NOT NULL,
    ville        VARCHAR(150)        NOT NULL,
    status       ENUM('Demande d''affectation','En cours','Terminé') NOT NULL DEFAULT 'Demande d''affectation',
    type         ENUM('Relevé','Installation')                       NOT NULL DEFAULT 'Relevé',
    start_date   DATE                NOT NULL,
    end_date     DATE                NOT NULL,
    heure_debut  TIME                NULL,
    heure_fin    TIME                NULL,
    description  TEXT                NULL,
    created_by   INT UNSIGNED        NOT NULL,
    created_at   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── 3. Affectations projet ↔ utilisateurs ────────────────────────────────
  `CREATE TABLE IF NOT EXISTS project_assignments (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id INT UNSIGNED NOT NULL,
    user_id    INT UNSIGNED NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pa_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_pa_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    UNIQUE KEY uq_assignment (project_id, user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── 4. Refresh tokens ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    token      VARCHAR(512) NOT NULL UNIQUE,
    expires_at DATETIME     NOT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function migrate() {
  const conn = await pool.getConnection();
  try {
    logger.info('🚀  Démarrage des migrations…');
    for (const sql of migrations) {
      await conn.query(sql);
    }
    logger.info('✅  Toutes les migrations ont réussi.');
  } catch (err) {
    logger.error(`❌  Erreur de migration : ${err.message}`);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();